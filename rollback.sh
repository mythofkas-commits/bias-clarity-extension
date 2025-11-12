#!/bin/bash
################################################################################
# Rollback Script for Argument Clarifier Deployment
#
# This script safely removes the deployed application and restores nginx config
#
# Usage:
#   bash rollback.sh
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="api.kasra.one"
APP_NAME="argument-clarifier"
APP_DIR="/home/${DOMAIN}/${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
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

main() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root or with sudo"
        exit 1
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Argument Clarifier - ROLLBACK SCRIPT"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    warn "⚠️  This will:"
    echo "  • Stop and remove the PM2 process"
    echo "  • Restore nginx configuration from backup"
    echo "  • Optionally remove the application directory"
    echo ""

    if ! prompt_confirm "Are you sure you want to rollback?"; then
        log "Rollback cancelled"
        exit 0
    fi

    echo ""

    # Stop PM2 process
    if command -v pm2 &> /dev/null; then
        if pm2 list | grep -q "$APP_NAME"; then
            log "Stopping PM2 process..."
            pm2 stop "$APP_NAME" || true
            pm2 delete "$APP_NAME" || true
            pm2 save
            success "PM2 process removed"
        else
            log "No PM2 process found"
        fi
    fi

    # Restore nginx config
    if [ -f "$NGINX_CONF" ]; then
        LATEST_BACKUP=$(ls -t "${NGINX_CONF}.backup-"* 2>/dev/null | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            log "Restoring nginx config from backup..."
            cp "$LATEST_BACKUP" "$NGINX_CONF"

            if nginx -t &>/dev/null; then
                systemctl reload nginx
                success "Nginx configuration restored"
            else
                error "Backup nginx config is invalid!"
                error "Manual intervention required"
            fi
        else
            warn "No nginx backup found"
        fi
    fi

    # Ask about removing app directory
    echo ""
    if prompt_confirm "Remove application directory ($APP_DIR)?"; then
        if [ -d "$APP_DIR" ]; then
            log "Removing application directory..."
            rm -rf "$APP_DIR"
            success "Application directory removed"
        fi
    else
        log "Keeping application directory"
    fi

    echo ""
    success "Rollback complete!"
    echo ""
}

main "$@"
