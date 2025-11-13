#!/usr/bin/env bash
################################################################################
# Argument Clarifier Backend Deployment Script (Virtualmin + Nginx, SAFE)
# - Virtualmin-aware (detects owner/home; uses create-proxy when possible)
# - Nginx edits scoped to *only* the target domain; full rollback on error
# - Runs PM2 as the Virtualmin domain user
# - Correct Node/TypeScript build order; resilient logging
################################################################################

set -Eeuo pipefail

# --------------------------- Config (edit if needed) ---------------------------
DOMAIN="api.kasra.one"
APP_NAME="argument-clarifier"
GITHUB_REPO="https://github.com/mythofkas-commits/bias-clarity-extension.git"
NODE_VERSION="${NODE_VERSION:-20}"            # Node 20 LTS still supported
APP_PORT="${APP_PORT:-3001}"
BRANCH="${BRANCH:-main}"                      # auto-switched if repo uses another

# Optional override; otherwise discovered from Virtualmin
DOMAIN_USER="${DOMAIN_USER:-}"                # leave empty to auto-detect
APP_DIR_OVERRIDE="${APP_DIR_OVERRIDE:-}"      # leave empty to auto-decide

# Modes
DRY_RUN=0                                     # set to 1 for a dry run (no changes)
# ------------------------------------------------------------------------------
LOG_FILE="/tmp/${APP_NAME}-deploy-$(date +%Y%m%d-%H%M%S).log"
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'; NC=$'\033[0m'

log()    { echo -e "${GREEN}[INFO]${NC} $*"    | tee -a "$LOG_FILE"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $*"   | tee -a "$LOG_FILE"; }
error()  { echo -e "${RED}[ERROR]${NC} $*"     | tee -a "$LOG_FILE"; }
success(){ echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$LOG_FILE"; }
run()    { echo "+ $*" | tee -a "$LOG_FILE"; [[ $DRY_RUN -eq 1 ]] || eval "$@" >>"$LOG_FILE" 2>&1; }
need()   { command -v "$1" >/dev/null 2>&1 || return 1; }

trap 'error "Failure at line $LINENO. Attempting rollback..."; rollback || true; exit 1' ERR

# ------------------------------ Pre-flight ------------------------------------
preflight() {
  [[ $EUID -eq 0 ]] || { error "Run as root/sudo"; exit 1; }

  for c in awk sed tee; do
    need "$c" || { error "Missing required tool: $c"; exit 1; }
  done
  if ! need curl; then run "apt-get update"; run "apt-get install -y curl"; fi
  if ! need git;  then run "apt-get install -y git";  fi
  if ! need nginx; then error "Nginx not installed"; exit 1; fi

  # Domain owner & home via Virtualmin (preferred)
  if need virtualmin; then
    local vu vh
    vu=$(virtualmin list-domains --domain "$DOMAIN" --user-only 2>/dev/null || true)
    vh=$(virtualmin list-domains --domain "$DOMAIN" --home-only 2>/dev/null || true)
    if [[ -n "${DOMAIN_USER}" ]]; then
      VUSER="$DOMAIN_USER"
      VHOME="${vh:-/home/$VUSER}"
    else
      VUSER="${vu:-${DOMAIN_USER:-}}"
      VHOME="${vh:-/home/${VUSER:-}}"
    fi
    if [[ -z "${VUSER:-}" || -z "${VHOME:-}" ]]; then
      warn "Could not resolve owner/home from Virtualmin; falling back to guess"
    fi
  fi

  # Fallback if Virtualmin CLI not present or returned empty
  if [[ -z "${VUSER:-}" ]]; then
    if [[ -n "${DOMAIN_USER:-}" ]] && id "$DOMAIN_USER" &>/dev/null; then
      VUSER="$DOMAIN_USER"; VHOME="/home/$DOMAIN_USER"
    else
      error "Cannot determine domain owner. Set DOMAIN_USER explicitly."
      exit 1
    fi
  fi
  [[ -d "$VHOME" ]] || { error "Home directory $VHOME does not exist"; exit 1; }

  APP_DIR="${APP_DIR_OVERRIDE:-$VHOME/${APP_NAME}}"
  log "Domain: $DOMAIN"
  log "Owner:  $VUSER"
  log "Home:   $VHOME"
  log "AppDir: $APP_DIR"
}

# ------------------------------ Node/Redis/PM2 --------------------------------
install_node() {
  if need node; then
    local major; major="$(node -v | sed 's/^v//' | cut -d. -f1)"
    if [[ "$major" -ge "$NODE_VERSION" ]]; then success "Node.js v$(node -v) OK"; return; fi
    warn "Node too old (v$major). Installing NodeSource $NODE_VERSION.x ..."
  fi
  # Download and run setup script safely; requires pipefail (enabled at top)
  run "curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x -o /tmp/nodesource_setup.sh"
  run "bash /tmp/nodesource_setup.sh"
  run "apt-get install -y nodejs"
  need node || { error "Node.js installation failed"; exit 1; }
  success "Node.js $(node -v) installed"
}

install_redis() {
  if need redis-server; then success "Redis present"; return; fi
  run "apt-get update"
  run "apt-get install -y redis-server"
  run "systemctl enable --now redis-server"
  systemctl is-active --quiet redis-server || warn "Redis not running; caching disabled"
}

install_pm2() {
  if sudo -u "$VUSER" bash -lc 'command -v pm2 >/dev/null'; then success "PM2 present for $VUSER"; return; fi
  run "npm install -g pm2"
  sudo -u "$VUSER" bash -lc 'command -v pm2 >/dev/null' || { error "PM2 install failed"; exit 1; }
  success "PM2 installed"
}

# ------------------------------ Deploy code -----------------------------------
deploy_code() {
  run "mkdir -p '$APP_DIR'"
  if [[ -d "$APP_DIR/.git" ]]; then
    # Use current branch if not BRANCH
    local cur; cur="$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "$BRANCH")"
    log "Updating repo (branch: $cur)"
    run "git -C '$APP_DIR' fetch --all --tags"
    run "git -C '$APP_DIR' pull --rebase origin '$cur' || git -C '$APP_DIR' pull --rebase"
  else
    log "Cloning $GITHUB_REPO into $APP_DIR"
    run "git clone '$GITHUB_REPO' '$APP_DIR'"
    # Switch branch if needed
    if [[ "$BRANCH" != "main" ]]; then run "git -C '$APP_DIR' checkout '$BRANCH' || true"; fi
  fi
  run "chown -R '$VUSER:$VUSER' '$APP_DIR'"
  success "Code deployed"
}

build_backend() {
  local server_dir="$APP_DIR/server"
  [[ -d "$server_dir" ]] || { error "Expected $server_dir to exist"; exit 1; }
  log "Installing deps (including dev) to build"
  sudo -u "$VUSER" bash -lc "cd '$server_dir' && npm ci"
  log "Building TypeScript"
  sudo -u "$VUSER" bash -lc "cd '$server_dir' && npm run build"
  # prune dev deps for runtime
  log "Pruning dev dependencies"
  sudo -u "$VUSER" bash -lc "cd '$server_dir' && npm prune --omit=dev"
  [[ -f "$server_dir/dist/index.js" ]] || { error "Build output missing: dist/index.js"; exit 1; }
  success "Backend built"
}

write_env() {
  local env="$APP_DIR/server/.env"
  [[ -f "$env" ]] && run "cp '$env' '$env.backup-$(date +%Y%m%d-%H%M%S)'"
  cat >"$env" <<'EOF'
NODE_ENV=production
PORT=3001
# REQUIRED: set a fresh key before starting!
OPENAI_API_KEY=REPLACE_WITH_YOUR_NEW_API_KEY
REDIS_URL=redis://localhost:6379
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_TEXT_LENGTH=120000
# EXTENSION_ID=your-extension-id-here
EOF
  run "chown $VUSER:$VUSER '$env'"
  run "chmod 600 '$env'"
  warn "Edit $env and set OPENAI_API_KEY before going live."
}

start_with_pm2() {
  local server_dir="$APP_DIR/server"
  # stop existing app for this user
  sudo -u "$VUSER" bash -lc "pm2 delete '$APP_NAME' >/dev/null 2>&1 || true"
  log "Starting app with PM2 as $VUSER"
  sudo -u "$VUSER" bash -lc "cd '$server_dir' && pm2 start dist/index.js --name '$APP_NAME' --update-env"
  # Save process list
  sudo -u "$VUSER" bash -lc "pm2 save"
  # Ensure PM2 starts on boot for this user (run the suggested command)
  local cmd
  cmd=$(sudo -u "$VUSER" bash -lc "pm2 startup systemd -u '$VUSER' --hp '$VHOME' | tail -n1" )
  [[ -n "$cmd" ]] && run "$cmd"
  # quick health
  sleep 2
  sudo -u "$VUSER" bash -lc "pm2 status '$APP_NAME' | grep -qi online" \
    || { error "PM2 status not online"; exit 1; }
  success "PM2 app online"
}

# ------------------------------ Nginx config ----------------------------------
# Prefer Virtualmin CLI (safest), else do a scoped file edit with rollback.
SNIPPET="/etc/nginx/snippets/${DOMAIN}-argument-clarifier.conf"
NGINX_CONF_FILE=""

find_nginx_conf_file() {
  # Use nginx -T to see the loaded config and track the file that contains
  # the server { listen 443 ssl; ... server_name DOMAIN; } block.
  NGINX_CONF_FILE="$(nginx -T 2>/dev/null | awk '
    /^\# configuration file /{f=$4}
    /server_name/ && $0 ~ /(^|[[:space:]])'"$DOMAIN"'(;|[[:space:]])/{in_srv=1; ssl=0; depth=0; file=f}
    in_srv && /listen/ && /443/ && /ssl/{ssl=1}
    in_srv && /\{/{depth++}
    in_srv && /\}/{depth--; if (depth==0){ if(ssl){print file}; in_srv=0}}
  ' | head -n1)"
}

configure_nginx() {
  log "Configuring Nginx reverse proxy for ${DOMAIN}"
  if need virtualmin; then
    # Safer: let Virtualmin write correct Nginx config for this domain
    warn "Using Virtualmin CLI to create proxy locations (safer)."
    run "virtualmin create-proxy --domain '$DOMAIN' --path /analyze --url 'http://127.0.0.1:${APP_PORT}'"
    run "virtualmin create-proxy --domain '$DOMAIN' --path /health  --url 'http://127.0.0.1:${APP_PORT}'"
  else
    # Fallback: minimal, robust include into the correct 443 server
    find_nginx_conf_file
    [[ -n "$NGINX_CONF_FILE" && -f "$NGINX_CONF_FILE" ]] || { error "Could not find Nginx 443 server for $DOMAIN"; exit 1; }

    # Backup
    run "cp '$NGINX_CONF_FILE' '${NGINX_CONF_FILE}.backup-$(date +%Y%m%d-%H%M%S)'"

    # Write snippet (safe to re-run)
    cat >"$SNIPPET" <<EOF
# Auto-generated proxy for ${DOMAIN}
location /analyze {
    proxy_pass http://127.0.0.1:${APP_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;

    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods "POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type" always;

    if (\$request_method = 'OPTIONS') { return 204; }
}
location /health {
    proxy_pass http://127.0.0.1:${APP_PORT};
    access_log off;
}
EOF

    # Insert a single include line into the chosen 443 server block (idempotent)
    if ! grep -qF "$SNIPPET" "$NGINX_CONF_FILE"; then
      awk -v d="$DOMAIN" -v inc="$SNIPPET" '
        BEGIN{in_srv=0; ssl=0; depth=0; done=0}
        /^\s*server\s*\{/ {depth=1; buf=$0; next}
        depth>0 {
          buf=buf ORS $0
          if ($0 ~ /server_name/ && $0 ~ ("(^|[[:space:]])" d "(;|[[:space:]])")) in_srv=1
          if ($0 ~ /listen/ && $0 ~ /443/ && $0 ~ /ssl/) ssl=1
          if ($0 ~ /\{/) depth++
          if ($0 ~ /\}/) {
            depth--
            if (depth==0) {
              if (in_srv && ssl && !done) {
                print buf | "cat"
                print "    include " inc ";"
                done=1
              } else { print buf | "cat" }
              buf=""
              in_srv=0; ssl=0
            }
          }
          next
        }
        { print }
      ' "$NGINX_CONF_FILE" > "${NGINX_CONF_FILE}.new"
      run "mv '${NGINX_CONF_FILE}.new' '$NGINX_CONF_FILE'"
    else
      log "Include already present; skipping edit"
    fi
  fi

  # Validate & reload
  run "nginx -t"
  run "systemctl reload nginx"
  success "Nginx configuration applied"
}

rollback() {
  if [[ -n "${NGINX_CONF_FILE:-}" && -f "${NGINX_CONF_FILE}.backup-"* ]]; then
    local latest; latest=$(ls -t "${NGINX_CONF_FILE}.backup-"* 2>/dev/null | head -1 || true)
    if [[ -n "$latest" ]]; then
      warn "Restoring Nginx from $latest"
      run "cp '$latest' '$NGINX_CONF_FILE'"
      run "systemctl reload nginx"
    fi
  fi
}

verify() {
  log "Verifying local health ..."
  run "curl -fsS http://127.0.0.1:${APP_PORT}/health >/dev/null" || { error "Local /health failed"; exit 1; }
  success "Local endpoint OK"

  log "Verifying public https ..."
  run "curl -fsSk https://${DOMAIN}/health >/dev/null" || warn "Public /health not responding yet (DNS/SSL/propagation?)"
}

next_steps() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  success "✅ DEPLOYMENT COMPLETE (see $LOG_FILE)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${YELLOW}CRITICAL: Update your OpenAI key in${NC} $APP_DIR/server/.env"
  echo "  pm2 restart $APP_NAME  (run as $VUSER)"
}

main() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Argument Clarifier - Virtualmin Deployment (SAFE)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  [[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1
  preflight
  log "Starting deployment (dry-run=$DRY_RUN) ..."
  install_node
  install_redis
  install_pm2
  deploy_code
  build_backend
  write_env
  start_with_pm2
  configure_nginx
  verify
  next_steps
}
main "$@"
