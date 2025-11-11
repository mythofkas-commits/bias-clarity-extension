#!/bin/bash
# Deployment script for Argument Clarifier Extension and API
# This script automates the deployment process to your Linux Nginx server

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_USER="${DEPLOY_USER:-www-data}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/argument-clarifier}"
API_PORT="${API_PORT:-3000}"
DOMAIN_API="${DOMAIN_API:-api.yourdomain.com}"
DOMAIN_EXT="${DOMAIN_EXT:-extension.yourdomain.com}"

echo -e "${GREEN}=== Argument Clarifier Deployment Script ===${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Step 1: Install dependencies
echo -e "${YELLOW}Step 1: Installing system dependencies...${NC}"
apt-get update
apt-get install -y nodejs npm nginx certbot python3-certbot-nginx git redis-server

# Install PM2 globally
npm install -g pm2

# Step 2: Create deployment directory
echo -e "${YELLOW}Step 2: Creating deployment directory...${NC}"
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Step 3: Clone or update repository
echo -e "${YELLOW}Step 3: Setting up repository...${NC}"
if [ -d ".git" ]; then
    echo "Repository exists, pulling latest changes..."
    git pull
else
    echo "Cloning repository..."
    echo -e "${RED}Please enter your repository URL:${NC}"
    read -r REPO_URL
    git clone "$REPO_URL" .
fi

# Step 4: Build server
echo -e "${YELLOW}Step 4: Building server...${NC}"
cd "$DEPLOY_DIR/server"
npm ci --production=false
npm run build

# Step 5: Install production dependencies only
echo -e "${YELLOW}Step 5: Installing production dependencies...${NC}"
rm -rf node_modules
npm ci --production

# Step 6: Setup environment variables
echo -e "${YELLOW}Step 6: Configuring environment variables...${NC}"
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo -e "${RED}Please edit the .env file and add your configuration:${NC}"
    echo "  - OPENAI_API_KEY"
    echo "  - REDIS_URL (if using Redis)"
    echo "  - EXTENSION_ID (Chrome extension ID)"
    echo "  - PORT (default: 3000)"
    echo ""
    echo "Press Enter when done editing .env..."
    nano .env
fi

# Step 7: Package extension
echo -e "${YELLOW}Step 7: Packaging extension...${NC}"
cd "$DEPLOY_DIR/extension"
zip -r "$DEPLOY_DIR/extension.zip" . -x "*.git*" -x "node_modules/*"

# Step 8: Set permissions
echo -e "${YELLOW}Step 8: Setting permissions...${NC}"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR"
chmod 600 "$DEPLOY_DIR/server/.env"

# Step 9: Setup Nginx
echo -e "${YELLOW}Step 9: Configuring Nginx...${NC}"

# API configuration
sed "s/api.yourdomain.com/$DOMAIN_API/g" "$DEPLOY_DIR/deployment/nginx-api.conf" > /etc/nginx/sites-available/clarifier-api
sed "s/extension.yourdomain.com/$DOMAIN_EXT/g" "$DEPLOY_DIR/deployment/nginx-extension.conf" > /etc/nginx/sites-available/clarifier-extension

# Enable sites
ln -sf /etc/nginx/sites-available/clarifier-api /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/clarifier-extension /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Step 10: Setup SSL certificates
echo -e "${YELLOW}Step 10: Setting up SSL certificates...${NC}"
echo "Obtaining SSL certificate for $DOMAIN_API..."
certbot --nginx -d "$DOMAIN_API" --non-interactive --agree-tos --register-unsafely-without-email || true

echo "Obtaining SSL certificate for $DOMAIN_EXT..."
certbot --nginx -d "$DOMAIN_EXT" --non-interactive --agree-tos --register-unsafely-without-email || true

# Step 11: Setup systemd service (alternative to PM2)
echo -e "${YELLOW}Step 11: Setting up systemd service...${NC}"
cp "$DEPLOY_DIR/deployment/clarifier-api.service" /etc/systemd/system/
sed -i "s|/var/www/argument-clarifier|$DEPLOY_DIR|g" /etc/systemd/system/clarifier-api.service
systemctl daemon-reload
systemctl enable clarifier-api

# Step 12: Start services
echo -e "${YELLOW}Step 12: Starting services...${NC}"

# Start Redis
systemctl enable redis-server
systemctl start redis-server

# Start API (using systemd)
systemctl restart clarifier-api

# Reload Nginx
systemctl reload nginx

# Step 13: Verify deployment
echo -e "${YELLOW}Step 13: Verifying deployment...${NC}"
sleep 3

# Check API health
if curl -f "http://localhost:$API_PORT/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API is running${NC}"
else
    echo -e "${RED}✗ API failed to start. Check logs with: journalctl -u clarifier-api${NC}"
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx is not running${NC}"
fi

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Access your services at:"
echo "  - API: https://$DOMAIN_API"
echo "  - Extension: https://$DOMAIN_EXT"
echo "  - Extension Download: https://$DOMAIN_EXT/download"
echo ""
echo "Useful commands:"
echo "  - View API logs: journalctl -u clarifier-api -f"
echo "  - Restart API: systemctl restart clarifier-api"
echo "  - Check API status: systemctl status clarifier-api"
echo "  - Reload Nginx: systemctl reload nginx"
echo ""
