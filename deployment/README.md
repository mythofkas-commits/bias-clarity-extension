# Deployment Files

This directory contains all the necessary files for deploying the Argument Clarifier Extension and API to a self-hosted Linux Nginx server.

## Files Overview

### Configuration Files

- **`nginx-api.conf`** - Nginx configuration for the API server
  - Sets up reverse proxy to Node.js backend
  - Configures SSL/HTTPS
  - Adds security headers
  - Handles rate limiting and buffering

- **`nginx-extension.conf`** - Nginx configuration for serving extension static files
  - Serves extension files for download
  - Configures caching for static assets
  - Provides download endpoint for packaged extension

- **`clarifier-api.service`** - Systemd service file for API process management
  - Ensures API starts on boot
  - Automatic restart on failure
  - Proper logging and security settings

- **`ecosystem.config.js`** - PM2 configuration (alternative to systemd)
  - Cluster mode support
  - Automatic restart and monitoring
  - Log management

- **`.env.production.template`** - Production environment variables template
  - All required and optional configuration settings
  - Comments explaining each variable

### Scripts

- **`deploy.sh`** - Automated deployment script
  - Installs dependencies
  - Builds the server
  - Configures Nginx
  - Sets up SSL certificates
  - Starts services

## Quick Start

### Option 1: Automated Deployment

```bash
# On your server
sudo su -
cd /opt
git clone https://github.com/mythofkas-commits/bias-clarity-extension.git
cd bias-clarity-extension

export DOMAIN_API="api.yourdomain.com"
export DOMAIN_EXT="extension.yourdomain.com"

chmod +x deployment/deploy.sh
./deployment/deploy.sh
```

### Option 2: Manual Deployment

Follow the comprehensive guide in `DEPLOYMENT_SELF_HOSTED.md` for step-by-step manual installation.

## Usage

### Systemd Service Management

```bash
# Start API
sudo systemctl start clarifier-api

# Stop API
sudo systemctl stop clarifier-api

# Restart API
sudo systemctl restart clarifier-api

# Check status
sudo systemctl status clarifier-api

# View logs
sudo journalctl -u clarifier-api -f
```

### PM2 Process Management

```bash
# Start API
pm2 start deployment/ecosystem.config.js

# Stop API
pm2 stop clarifier-api

# Restart API
pm2 restart clarifier-api

# View logs
pm2 logs clarifier-api

# Monitor
pm2 monit
```

### Nginx Management

```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

## Prerequisites

Before using these deployment files, ensure your server has:

- Ubuntu 20.04+ or Debian 11+
- Node.js 20+
- Nginx
- Git
- Root/sudo access
- DNS configured pointing to your server

## Environment Variables

Copy `.env.production.template` to `/var/www/argument-clarifier/server/.env` and configure:

**Required**:
- `OPENAI_API_KEY` - Your OpenAI API key
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to `production`

**Recommended**:
- `REDIS_URL` - Redis connection string for caching
- `EXTENSION_ID` - Chrome extension ID for CORS

**Optional**:
- `RATE_LIMIT_WINDOW_MS` - Rate limiting window
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window
- `MAX_TEXT_LENGTH` - Maximum text length

## File Locations

After deployment:

```
/var/www/argument-clarifier/          # Main application directory
├── server/                            # API server
│   ├── dist/                          # Built JavaScript
│   ├── src/                           # TypeScript source
│   ├── .env                           # Environment variables (sensitive!)
│   └── package.json
├── extension/                         # Extension files
│   ├── manifest.json
│   ├── src/
│   └── ...
├── extension.zip                      # Packaged extension
└── deployment/                        # Deployment files (this directory)

/etc/nginx/sites-available/
├── clarifier-api                      # API Nginx config
└── clarifier-extension                # Extension Nginx config

/etc/systemd/system/
└── clarifier-api.service              # Systemd service

/var/log/nginx/
├── clarifier-api-access.log           # API access logs
├── clarifier-api-error.log            # API error logs
├── clarifier-extension-access.log     # Extension access logs
└── clarifier-extension-error.log      # Extension error logs
```

## Security Notes

1. **Environment File**: Ensure `.env` has restricted permissions:
   ```bash
   chmod 600 /var/www/argument-clarifier/server/.env
   ```

2. **Firewall**: Block direct access to Node.js port:
   ```bash
   sudo ufw deny 3000/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. **SSL Certificates**: Use Let's Encrypt for free SSL:
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```

4. **Regular Updates**: Keep dependencies updated:
   ```bash
   cd /var/www/argument-clarifier/server
   sudo npm audit fix
   ```

## Troubleshooting

### API won't start
```bash
# Check logs
sudo journalctl -u clarifier-api -n 50

# Check if port is in use
sudo netstat -tlnp | grep 3000

# Verify environment variables
sudo cat /var/www/argument-clarifier/server/.env
```

### Nginx errors
```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/clarifier-api-error.log
```

### SSL issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates
sudo certbot renew --dry-run
```

## Support

For detailed instructions, see `DEPLOYMENT_SELF_HOSTED.md` in the root directory.

For issues:
1. Check application logs
2. Review Nginx logs
3. Verify environment configuration
4. Open an issue on GitHub with details

## License

Apache License 2.0
