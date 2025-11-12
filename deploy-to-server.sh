#!/bin/bash
################################################################################
# Argument Clarifier Backend Deployment Script for Virtualmin Servers
#
# This script safely deploys the Node.js backend without interfering with
# existing Virtualmin websites.
#
# Usage:
#   bash deploy-to-server.sh
#
# Requirements:
#   - Domain api.kasra.one already configured in Virtualmin with HTTPS
#   - Root or sudo access
#   - Virtualmin server
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="api.kasra.one"
DOMAIN_USER="api"  # Virtualmin uses short domain name for user/home
APP_NAME="argument-clarifier"
APP_DIR="/home/${DOMAIN_USER}/${APP_NAME}"
GITHUB_REPO="https://github.com/mythofkas-commits/bias-clarity-extension.git"
NODE_VERSION="20"
APP_PORT="3001"  # Using 3001 to avoid conflicts with other apps

# Log file
LOG_FILE="/tmp/argument-clarifier-deploy-$(date +%Y%m%d-%H%M%S).log"

################################################################################
# Helper Functions
################################################################################

log() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

prompt_confirm() {
    while true; do
        read -p "$1 [y/n] " yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        return 1
    fi
    return 0
}

backup_file() {
    if [ -f "$1" ]; then
        cp "$1" "$1.backup-$(date +%Y%m%d-%H%M%S)"
        log "Backed up: $1"
    fi
}

################################################################################
# Pre-flight Checks
################################################################################

preflight_checks() {
    log "Running pre-flight checks..."

    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root or with sudo"
        exit 1
    fi

    # Check if Virtualmin is installed
    if [ ! -d "/etc/webmin" ]; then
        warn "Virtualmin/Webmin not detected. Proceeding anyway..."
    fi

    # Check if domain directory exists
    if [ ! -d "/home/${DOMAIN_USER}" ]; then
        error "Domain directory /home/${DOMAIN_USER} does not exist!"
        error "Please create the domain '${DOMAIN}' in Virtualmin first."
        exit 1
    fi

    # Check if HTTPS is configured
    if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
        warn "Let's Encrypt SSL not found for ${DOMAIN}"
        warn "Make sure HTTPS is configured in Virtualmin"
        if ! prompt_confirm "Continue anyway?"; then
            exit 1
        fi
    fi

    success "Pre-flight checks passed"
}

################################################################################
# Install Dependencies
################################################################################

install_node() {
    log "Checking Node.js installation..."

    if check_command node; then
        NODE_CURRENT=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_CURRENT" -ge "$NODE_VERSION" ]; then
            success "Node.js $NODE_CURRENT is already installed"
            return 0
        else
            warn "Node.js $NODE_CURRENT is too old. Upgrading to v${NODE_VERSION}..."
        fi
    fi

    log "Installing Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >> "$LOG_FILE" 2>&1
    apt-get install -y nodejs >> "$LOG_FILE" 2>&1

    if check_command node; then
        success "Node.js $(node --version) installed"
    else
        error "Failed to install Node.js"
        exit 1
    fi
}

install_redis() {
    log "Checking Redis installation..."

    if check_command redis-server; then
        success "Redis is already installed"
        return 0
    fi

    log "Installing Redis..."
    apt-get update >> "$LOG_FILE" 2>&1
    apt-get install -y redis-server >> "$LOG_FILE" 2>&1

    systemctl enable redis-server >> "$LOG_FILE" 2>&1
    systemctl start redis-server >> "$LOG_FILE" 2>&1

    if systemctl is-active --quiet redis-server; then
        success "Redis installed and running"
    else
        warn "Redis installed but not running. App will work without caching."
    fi
}

install_pm2() {
    log "Checking PM2 installation..."

    if check_command pm2; then
        success "PM2 is already installed"
        return 0
    fi

    log "Installing PM2..."
    npm install -g pm2 >> "$LOG_FILE" 2>&1

    if check_command pm2; then
        success "PM2 installed"
    else
        error "Failed to install PM2"
        exit 1
    fi
}

################################################################################
# Deploy Application
################################################################################

deploy_app() {
    log "Deploying application..."

    # Create app directory if it doesn't exist
    if [ ! -d "$APP_DIR" ]; then
        log "Creating app directory: $APP_DIR"
        mkdir -p "$APP_DIR"
    fi

    # Clone or update repository
    if [ -d "$APP_DIR/.git" ]; then
        log "Updating existing repository..."
        cd "$APP_DIR"
        git pull origin main >> "$LOG_FILE" 2>&1 || {
            error "Failed to update repository"
            exit 1
        }
    else
        log "Cloning repository..."
        git clone "$GITHUB_REPO" "$APP_DIR" >> "$LOG_FILE" 2>&1 || {
            error "Failed to clone repository"
            exit 1
        }
    fi

    # Set proper ownership (Virtualmin typically uses domain user)
    if id "${DOMAIN_USER}" &>/dev/null; then
        chown -R "${DOMAIN_USER}:${DOMAIN_USER}" "$APP_DIR"
        log "Set ownership to ${DOMAIN_USER} user"
    else
        warn "User '${DOMAIN_USER}' not found, skipping ownership change"
    fi

    success "Application code deployed"
}

setup_backend() {
    log "Setting up backend..."

    cd "$APP_DIR/server"

    # Install dependencies
    log "Installing Node.js dependencies..."
    npm install --production >> "$LOG_FILE" 2>&1 || {
        error "Failed to install dependencies"
        exit 1
    }

    # Build TypeScript
    log "Building TypeScript..."
    npm run build >> "$LOG_FILE" 2>&1 || {
        error "Failed to build TypeScript"
        exit 1
    }

    # Check if dist directory was created
    if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
        error "Build failed - dist/index.js not found"
        exit 1
    fi

    success "Backend built successfully"
}

create_env_file() {
    log "Creating environment configuration..."

    ENV_FILE="$APP_DIR/server/.env"

    # Backup existing .env if present
    backup_file "$ENV_FILE"

    # Create new .env file
    cat > "$ENV_FILE" << 'EOF'
# Server Configuration
NODE_ENV=production
PORT=3001

# OpenAI API Key (REQUIRED - REPLACE THIS!)
# ⚠️ SECURITY: Get a NEW key from https://platform.openai.com/api-keys
# The key in the deployment message was EXPOSED and must be rotated!
OPENAI_API_KEY=REPLACE_WITH_YOUR_NEW_API_KEY

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Text Processing
MAX_TEXT_LENGTH=120000

# CORS - Chrome Extension ID (optional)
# EXTENSION_ID=your-extension-id-here
EOF

    # Secure the env file
    chmod 600 "$ENV_FILE"

    warn "⚠️  IMPORTANT: Edit $ENV_FILE and add your NEW OpenAI API key!"
    warn "⚠️  Your old key was exposed and should be revoked!"

    success "Environment file created"
}

start_app_with_pm2() {
    log "Starting application with PM2..."

    cd "$APP_DIR/server"

    # Stop existing process if running
    if pm2 list | grep -q "$APP_NAME"; then
        log "Stopping existing PM2 process..."
        pm2 stop "$APP_NAME" >> "$LOG_FILE" 2>&1
        pm2 delete "$APP_NAME" >> "$LOG_FILE" 2>&1
    fi

    # Start with PM2
    log "Starting new PM2 process..."
    pm2 start dist/index.js --name "$APP_NAME" >> "$LOG_FILE" 2>&1 || {
        error "Failed to start application with PM2"
        exit 1
    }

    # Save PM2 configuration
    pm2 save >> "$LOG_FILE" 2>&1

    # Set up PM2 to start on boot (if not already done)
    if ! systemctl is-enabled pm2-root.service &>/dev/null; then
        log "Configuring PM2 to start on boot..."
        pm2 startup systemd -u root --hp /root >> "$LOG_FILE" 2>&1
    fi

    # Wait a moment for app to start
    sleep 3

    # Check if app is running
    if pm2 list | grep -q "$APP_NAME.*online"; then
        success "Application started successfully"
    else
        error "Application failed to start"
        error "Check logs with: pm2 logs $APP_NAME"
        exit 1
    fi
}

################################################################################
# Configure nginx (Virtualmin-safe)
################################################################################

configure_nginx() {
    log "Configuring nginx reverse proxy..."

    # Virtualmin nginx config location (uses .conf extension)
    NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"

    if [ ! -f "$NGINX_CONF" ]; then
        error "Nginx config not found: $NGINX_CONF"
        error "Please create the domain in Virtualmin first with HTTPS enabled"
        exit 1
    fi

    # Backup existing config
    backup_file "$NGINX_CONF"

    # Check if our location block already exists
    if grep -q "# Argument Clarifier Proxy" "$NGINX_CONF"; then
        warn "Nginx configuration already contains our proxy rules"
        if ! prompt_confirm "Overwrite existing proxy configuration?"; then
            log "Skipping nginx configuration"
            return 0
        fi

        # Remove old configuration
        sed -i '/# Argument Clarifier Proxy/,/# End Argument Clarifier Proxy/d' "$NGINX_CONF"
    fi

    log "Adding proxy configuration to nginx..."

    # Find the server block for HTTPS (port 443)
    # Insert our location blocks before the closing brace of the HTTPS server block

    # Create temporary file with our proxy config
    cat > /tmp/nginx-proxy-block.conf << 'NGINXCONF'
    # Argument Clarifier Proxy - Auto-generated
    # Location blocks for API
    location /analyze {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long-running analysis
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # CORS headers for Chrome Extension
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    location /health {
        proxy_pass http://localhost:3001;
        access_log off;
    }
    # End Argument Clarifier Proxy
NGINXCONF

    # Find the last occurrence of "}" in the HTTPS server block and insert before it
    # This is safer than trying to parse nginx config

    # Use awk to insert the proxy config before the last closing brace
    awk '
        /listen.*443.*ssl/ { in_ssl=1 }
        in_ssl && /^}/ && !done {
            while ((getline line < "/tmp/nginx-proxy-block.conf") > 0) {
                print line
            }
            close("/tmp/nginx-proxy-block.conf")
            done=1
        }
        { print }
    ' "$NGINX_CONF" > "$NGINX_CONF.new"

    mv "$NGINX_CONF.new" "$NGINX_CONF"

    # Clean up temp file
    rm -f /tmp/nginx-proxy-block.conf

    # Test nginx configuration
    log "Testing nginx configuration..."
    if nginx -t >> "$LOG_FILE" 2>&1; then
        success "Nginx configuration is valid"

        # Reload nginx
        log "Reloading nginx..."
        systemctl reload nginx >> "$LOG_FILE" 2>&1
        success "Nginx reloaded"
    else
        error "Nginx configuration test failed!"
        error "Restoring backup..."

        # Restore backup
        if [ -f "${NGINX_CONF}.backup-"* ]; then
            LATEST_BACKUP=$(ls -t "${NGINX_CONF}.backup-"* | head -1)
            cp "$LATEST_BACKUP" "$NGINX_CONF"
            systemctl reload nginx >> "$LOG_FILE" 2>&1
        fi

        error "Check nginx error log: /var/log/nginx/error.log"
        exit 1
    fi
}

################################################################################
# Verification
################################################################################

verify_deployment() {
    log "Verifying deployment..."

    # Wait a moment for everything to settle
    sleep 2

    # Check if PM2 process is running
    if ! pm2 list | grep -q "$APP_NAME.*online"; then
        error "PM2 process is not running"
        return 1
    fi

    # Check local health endpoint
    log "Testing local endpoint..."
    if curl -s http://localhost:${APP_PORT}/health > /dev/null 2>&1; then
        success "Local endpoint responding"
    else
        error "Local endpoint not responding"
        return 1
    fi

    # Check public HTTPS endpoint
    log "Testing public endpoint..."
    if curl -s -k https://${DOMAIN}/health > /dev/null 2>&1; then
        success "Public HTTPS endpoint responding"
    else
        warn "Public endpoint not responding yet (may need DNS propagation)"
        warn "Try: curl https://${DOMAIN}/health"
    fi

    success "Deployment verification complete!"
    return 0
}

################################################################################
# Post-deployment Instructions
################################################################################

print_next_steps() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    success "✅ DEPLOYMENT COMPLETE!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${YELLOW}⚠️  CRITICAL: YOU MUST COMPLETE THESE STEPS:${NC}"
    echo ""
    echo "1. 🔐 REVOKE YOUR OLD API KEY (it was exposed publicly!):"
    echo "   https://platform.openai.com/api-keys"
    echo ""
    echo "2. 🔑 GET A NEW API KEY:"
    echo "   https://platform.openai.com/api-keys"
    echo ""
    echo "3. ✏️  ADD THE NEW KEY TO YOUR ENV FILE:"
    echo "   nano $APP_DIR/server/.env"
    echo "   Replace: OPENAI_API_KEY=REPLACE_WITH_YOUR_NEW_API_KEY"
    echo "   Save: Ctrl+X, Y, Enter"
    echo ""
    echo "4. 🔄 RESTART THE APPLICATION:"
    echo "   pm2 restart $APP_NAME"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${GREEN}Useful Commands:${NC}"
    echo ""
    echo "  Check status:    pm2 status"
    echo "  View logs:       pm2 logs $APP_NAME"
    echo "  Restart app:     pm2 restart $APP_NAME"
    echo "  Stop app:        pm2 stop $APP_NAME"
    echo ""
    echo "  Test health:     curl https://${DOMAIN}/health"
    echo "  Test analysis:   curl -X POST https://${DOMAIN}/analyze \\"
    echo "                     -H 'Content-Type: application/json' \\"
    echo "                     -d '{\"url\":\"test\",\"text\":\"This is a test.\"}'"
    echo ""
    echo "  nginx logs:      tail -f /var/log/nginx/error.log"
    echo "  Reload nginx:    systemctl reload nginx"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${BLUE}Update Your Chrome Extension Settings:${NC}"
    echo "  1. Open extension options"
    echo "  2. Enable 'hosted cloud service'"
    echo "  3. Set API Base URL to: https://${DOMAIN}"
    echo "  4. Save settings"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Deployment log saved to: $LOG_FILE"
    echo ""
}

################################################################################
# Main Execution
################################################################################

main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Argument Clarifier - Virtualmin Deployment Script"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "This script will:"
    echo "  • Install Node.js ${NODE_VERSION}, Redis, and PM2"
    echo "  • Clone application from GitHub"
    echo "  • Build and start the backend"
    echo "  • Configure nginx reverse proxy"
    echo "  • Set up automatic startup on boot"
    echo ""
    echo "Domain: ${DOMAIN}"
    echo "App Directory: ${APP_DIR}"
    echo "App Port: ${APP_PORT}"
    echo ""

    if ! prompt_confirm "Continue with deployment?"; then
        log "Deployment cancelled by user"
        exit 0
    fi

    echo ""
    log "Starting deployment..."
    echo ""

    # Run deployment steps
    preflight_checks
    install_node
    install_redis
    install_pm2
    deploy_app
    setup_backend
    create_env_file
    start_app_with_pm2
    configure_nginx
    verify_deployment

    # Print next steps
    print_next_steps
}

# Run main function
main "$@"
