# Complete Self-Hosted Deployment Guide

This guide provides comprehensive instructions for deploying both the **Chrome Extension** (static files) and the **API Server** on your own Linux Nginx web server.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start (Automated)](#quick-start-automated)
- [Manual Deployment](#manual-deployment)
- [Alternative: PM2 Process Manager](#alternative-pm2-process-manager)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Maintenance & Troubleshooting](#maintenance--troubleshooting)
- [Security Considerations](#security-considerations)

---

## Overview

This deployment will set up:

1. **API Server**: Node.js/Express backend behind Nginx reverse proxy
2. **Extension Files**: Static files served via Nginx for users to download
3. **Process Management**: Systemd service (or PM2) to keep the API running
4. **SSL/HTTPS**: Let's Encrypt certificates for secure connections
5. **Caching**: Redis for API response caching (optional)

**Architecture**:
```
Internet → Nginx (443) → Node.js API (3000)
                      ↓
                   Extension Files (static)
```

---

## Prerequisites

### Server Requirements

- Linux server (Ubuntu 20.04+ or Debian 11+ recommended)
- Root or sudo access
- Minimum 1GB RAM, 10GB disk space
- Public IP address with DNS configured

### Domain Names

You'll need two (sub)domains pointed to your server:

- `api.yourdomain.com` - for the API
- `extension.yourdomain.com` - for extension downloads (optional)

Alternatively, you can use a single domain with different paths.

### Software Requirements

- **Node.js** 20+ and npm
- **Nginx** (latest stable)
- **Git**
- **Redis** (optional, for caching)
- **Certbot** (for SSL certificates)

---

## Quick Start (Automated)

The easiest way to deploy is using the automated deployment script:

### Step 1: Download and Run Deployment Script

```bash
# SSH into your server
ssh user@your-server.com

# Switch to root
sudo su -

# Download the repository
cd /opt
git clone https://github.com/mythofkas-commits/bias-clarity-extension.git
cd bias-clarity-extension

# Set your domains
export DOMAIN_API="api.yourdomain.com"
export DOMAIN_EXT="extension.yourdomain.com"

# Run deployment script
chmod +x deployment/deploy.sh
./deployment/deploy.sh
```

### Step 2: Configure Environment Variables

The script will prompt you to edit the `.env` file. Add your configuration:

```bash
nano /var/www/argument-clarifier/server/.env
```

**Required settings**:
```env
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-your-openai-api-key-here
REDIS_URL=redis://localhost:6379
EXTENSION_ID=your-chrome-extension-id
```

### Step 3: Verify Deployment

```bash
# Check API health
curl https://api.yourdomain.com/health

# Check service status
systemctl status clarifier-api

# View logs
journalctl -u clarifier-api -f
```

**That's it!** Your API is now running at `https://api.yourdomain.com` and extension files are available at `https://extension.yourdomain.com`.

---

## Manual Deployment

If you prefer manual setup or need to customize the deployment:

### Step 1: Install System Dependencies

```bash
# Update package lists
sudo apt update

# Install required packages
sudo apt install -y nodejs npm nginx git redis-server certbot python3-certbot-nginx

# Verify Node.js version (should be 20+)
node -v
```

If Node.js is outdated, install using nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### Step 2: Create Deployment Directory

```bash
# Create directory
sudo mkdir -p /var/www/argument-clarifier
cd /var/www/argument-clarifier

# Clone repository
sudo git clone https://github.com/mythofkas-commits/bias-clarity-extension.git .
```

### Step 3: Build the Server

```bash
cd /var/www/argument-clarifier/server

# Install all dependencies (including dev dependencies for build)
sudo npm ci

# Build TypeScript
sudo npm run build

# Install production dependencies only
sudo rm -rf node_modules
sudo npm ci --production
```

### Step 4: Configure Environment

```bash
# Copy environment template
sudo cp .env.example .env

# Edit configuration
sudo nano .env
```

Add your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# OpenAI API (Required)
OPENAI_API_KEY=sk-your-actual-openai-api-key

# Redis Configuration (Optional but recommended)
REDIS_URL=redis://localhost:6379

# CORS Configuration
EXTENSION_ID=your-chrome-extension-id-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Text Processing
MAX_TEXT_LENGTH=120000
```

### Step 5: Package Extension

```bash
cd /var/www/argument-clarifier/extension
sudo zip -r /var/www/argument-clarifier/extension.zip . -x "*.git*" -x "node_modules/*"
```

### Step 6: Set Permissions

```bash
sudo chown -R www-data:www-data /var/www/argument-clarifier
sudo chmod -R 755 /var/www/argument-clarifier
sudo chmod 600 /var/www/argument-clarifier/server/.env
```

### Step 7: Configure Nginx

#### API Configuration

Create `/etc/nginx/sites-available/clarifier-api`:

```bash
sudo nano /etc/nginx/sites-available/clarifier-api
```

Copy the contents from `deployment/nginx-api.conf` and replace:
- `api.yourdomain.com` with your actual domain
- Adjust SSL certificate paths if needed

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/clarifier-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### Extension Static Files (Optional)

Create `/etc/nginx/sites-available/clarifier-extension`:

```bash
sudo nano /etc/nginx/sites-available/clarifier-extension
```

Copy contents from `deployment/nginx-extension.conf` and update domain.

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/clarifier-extension /etc/nginx/sites-enabled/

# Reload Nginx
sudo systemctl reload nginx
```

### Step 8: Setup SSL Certificates

```bash
# For API domain
sudo certbot --nginx -d api.yourdomain.com

# For Extension domain (if using)
sudo certbot --nginx -d extension.yourdomain.com
```

Certbot will automatically update your Nginx configuration.

### Step 9: Setup Systemd Service

```bash
# Copy service file
sudo cp /var/www/argument-clarifier/deployment/clarifier-api.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable clarifier-api

# Start the service
sudo systemctl start clarifier-api

# Check status
sudo systemctl status clarifier-api
```

### Step 10: Start Redis (Optional)

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
sudo systemctl status redis-server
```

### Step 11: Verify Deployment

```bash
# Test API locally
curl http://localhost:3000/health

# Test API via domain
curl https://api.yourdomain.com/health

# View service logs
sudo journalctl -u clarifier-api -f
```

---

## Alternative: PM2 Process Manager

If you prefer PM2 over systemd:

### Install PM2

```bash
sudo npm install -g pm2
```

### Start with PM2

```bash
cd /var/www/argument-clarifier/server

# Start using ecosystem file
pm2 start ../deployment/ecosystem.config.js

# Or start directly
pm2 start dist/index.js --name clarifier-api

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the command it outputs

# Monitor
pm2 monit

# View logs
pm2 logs clarifier-api
```

### PM2 Useful Commands

```bash
pm2 list                    # List all processes
pm2 restart clarifier-api   # Restart API
pm2 stop clarifier-api      # Stop API
pm2 delete clarifier-api    # Delete from PM2
pm2 logs clarifier-api      # View logs
pm2 monit                   # Monitor resources
```

---

## Post-Deployment Configuration

### Update Extension Settings

After deployment, update your Chrome extension to use your new API:

1. Open Chrome and go to `chrome://extensions/`
2. Find "Argument Clarifier" and click **Options**
3. Update **API Base URL** to: `https://api.yourdomain.com`
4. Click **Save Settings**

### Test the Extension

1. Navigate to any article or webpage
2. Click the extension icon
3. Click "Analyze This Page"
4. Verify it uses your self-hosted API

### Create Download Page (Optional)

Create a simple HTML page at `/var/www/argument-clarifier/extension/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Argument Clarifier - Download</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        .download-btn {
            display: inline-block;
            background: #4285f4;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <h1>Argument Clarifier Extension</h1>
    <p>Download the Chrome extension to analyze arguments on any webpage.</p>
    <a href="/download" class="download-btn">Download Extension</a>
    
    <h2>Installation Instructions</h2>
    <ol>
        <li>Download the extension zip file</li>
        <li>Extract the zip file to a folder</li>
        <li>Open Chrome and go to <code>chrome://extensions/</code></li>
        <li>Enable "Developer mode" in the top right</li>
        <li>Click "Load unpacked"</li>
        <li>Select the extracted folder</li>
        <li>Click the extension icon and go to Options</li>
        <li>Set API Base URL to: <code>https://api.yourdomain.com</code></li>
    </ol>
</body>
</html>
```

---

## Maintenance & Troubleshooting

### Viewing Logs

**Systemd**:
```bash
# Real-time logs
sudo journalctl -u clarifier-api -f

# Last 100 lines
sudo journalctl -u clarifier-api -n 100

# Logs since yesterday
sudo journalctl -u clarifier-api --since yesterday
```

**PM2**:
```bash
pm2 logs clarifier-api
pm2 logs clarifier-api --lines 100
```

**Nginx**:
```bash
sudo tail -f /var/log/nginx/clarifier-api-access.log
sudo tail -f /var/log/nginx/clarifier-api-error.log
```

### Updating the Application

```bash
cd /var/www/argument-clarifier

# Pull latest changes
sudo git pull

# Rebuild server
cd server
sudo npm ci
sudo npm run build
sudo rm -rf node_modules
sudo npm ci --production

# Restart service
sudo systemctl restart clarifier-api
# OR with PM2:
# pm2 restart clarifier-api

# Repackage extension
cd ../extension
sudo zip -r ../extension.zip . -x "*.git*"
```

### Common Issues

**API not responding**:
```bash
# Check if process is running
sudo systemctl status clarifier-api
# or: pm2 list

# Check logs for errors
sudo journalctl -u clarifier-api -n 50

# Verify port is listening
sudo netstat -tlnp | grep 3000
```

**SSL certificate issues**:
```bash
# Renew certificates manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

**Redis connection failed**:
```bash
# Check Redis status
sudo systemctl status redis-server

# Test Redis connection
redis-cli ping
# Should return: PONG
```

**High memory usage**:
```bash
# Check memory usage
free -h
pm2 monit  # if using PM2

# Restart API to free memory
sudo systemctl restart clarifier-api
```

### Performance Optimization

**Enable Nginx caching**:

Add to your Nginx config:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /analyze {
    proxy_cache api_cache;
    proxy_cache_valid 200 10m;
    proxy_cache_key "$host$request_uri$request_body";
    # ... rest of proxy settings
}
```

**Increase PM2 instances** (if using cluster mode):
```bash
pm2 scale clarifier-api 2  # Run 2 instances
```

---

## Security Considerations

### Firewall Setup

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Block direct access to Node.js port
sudo ufw deny 3000/tcp
```

### Secure Environment File

```bash
# Ensure .env is not readable by others
sudo chmod 600 /var/www/argument-clarifier/server/.env
sudo chown www-data:www-data /var/www/argument-clarifier/server/.env
```

### Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
cd /var/www/argument-clarifier/server
sudo npm audit fix
```

### Backup Strategy

```bash
# Backup script (save as /root/backup-clarifier.sh)
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backup/clarifier"
mkdir -p $BACKUP_DIR

# Backup code and config
tar -czf $BACKUP_DIR/clarifier-$DATE.tar.gz /var/www/argument-clarifier

# Backup Redis (if using persistence)
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis-$DATE.rdb

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
```

Add to crontab:
```bash
sudo crontab -e
# Add line:
0 2 * * * /root/backup-clarifier.sh
```

### Rate Limiting

Already configured in the API (100 requests per 15 minutes per IP). Adjust in `.env`:

```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

For additional Nginx-level rate limiting, add to your Nginx config:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /analyze {
    limit_req zone=api_limit burst=20 nodelay;
    # ... rest of config
}
```

---

## Support

For issues or questions:

1. Check logs first (see Troubleshooting section)
2. Review GitHub issues: https://github.com/mythofkas-commits/bias-clarity-extension/issues
3. Open a new issue with:
   - Server OS and version
   - Node.js version
   - Error messages from logs
   - Steps to reproduce

---

## License

Apache License 2.0 - See LICENSE file for details.
