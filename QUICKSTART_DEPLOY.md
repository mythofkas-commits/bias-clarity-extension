# Quick Deployment Guide

## 🚀 Deploy in 5 Minutes

This is a quick reference for deploying the Argument Clarifier to your Linux Nginx server. For detailed instructions, see [DEPLOYMENT_SELF_HOSTED.md](DEPLOYMENT_SELF_HOSTED.md).

## Prerequisites

- Linux server with Ubuntu 20.04+ or Debian 11+
- Root/sudo access
- Domain name(s) pointed to your server
- SSH access

## One-Command Deploy

```bash
# SSH to your server
ssh user@your-server.com

# Switch to root
sudo su -

# Clone and deploy
cd /opt && \
git clone https://github.com/mythofkas-commits/bias-clarity-extension.git && \
cd bias-clarity-extension && \
export DOMAIN_API="api.yourdomain.com" && \
export DOMAIN_EXT="extension.yourdomain.com" && \
chmod +x deployment/deploy.sh && \
./deployment/deploy.sh
```

The script will:
1. ✅ Install Node.js, Nginx, Redis, Certbot
2. ✅ Build the API server
3. ✅ Configure Nginx reverse proxy
4. ✅ Setup SSL certificates
5. ✅ Create systemd service
6. ✅ Start all services

## Post-Deployment

### Configure Environment

Edit `/var/www/argument-clarifier/server/.env`:

```bash
sudo nano /var/www/argument-clarifier/server/.env
```

**Required settings**:
```env
OPENAI_API_KEY=sk-your-actual-key-here
EXTENSION_ID=your-chrome-extension-id
```

Then restart:
```bash
sudo systemctl restart clarifier-api
```

### Update Extension

1. Open Chrome → `chrome://extensions/`
2. Find "Argument Clarifier" → **Options**
3. Set API Base URL: `https://api.yourdomain.com`
4. Save

### Verify

```bash
# Test API
curl https://api.yourdomain.com/health

# Should return: {"status":"ok","timestamp":"..."}
```

## What Gets Deployed

### API Server
- **URL**: `https://api.yourdomain.com`
- **Endpoints**:
  - `GET /health` - Health check
  - `POST /analyze` - Analyze text
  - `POST /nli` - Natural language inference

### Extension Files (Optional)
- **URL**: `https://extension.yourdomain.com`
- **Download**: `https://extension.yourdomain.com/download`
- Serves static extension files for users to download

### Services
- **API**: Systemd service `clarifier-api`
- **Nginx**: Reverse proxy with SSL
- **Redis**: Cache (optional)

## Common Commands

```bash
# View API logs
sudo journalctl -u clarifier-api -f

# Restart API
sudo systemctl restart clarifier-api

# Check API status
sudo systemctl status clarifier-api

# Reload Nginx
sudo systemctl reload nginx

# Update deployment
cd /var/www/argument-clarifier
sudo git pull
cd server && sudo npm ci && sudo npm run build
sudo systemctl restart clarifier-api
```

## Troubleshooting

### API not responding
```bash
sudo journalctl -u clarifier-api -n 50
sudo systemctl restart clarifier-api
```

### SSL certificate issues
```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Out of memory
```bash
free -h
sudo systemctl restart clarifier-api
```

## Security Checklist

- [ ] Changed OPENAI_API_KEY in .env
- [ ] Set proper EXTENSION_ID
- [ ] Firewall configured (UFW)
- [ ] SSL certificates installed
- [ ] .env file has 600 permissions
- [ ] Regular backups scheduled

## Alternative: PM2 Instead of Systemd

```bash
# Install PM2
sudo npm install -g pm2

# Start API
cd /var/www/argument-clarifier/server
pm2 start dist/index.js --name clarifier-api

# Setup startup
pm2 startup systemd
pm2 save
```

## File Locations

```
/var/www/argument-clarifier/     # Main directory
├── server/                       # API server
│   ├── dist/                     # Built files
│   └── .env                      # Config (sensitive!)
├── extension/                    # Extension files
└── extension.zip                 # Packaged extension

/etc/nginx/sites-enabled/
├── clarifier-api                 # API config
└── clarifier-extension           # Extension config

/var/log/nginx/
├── clarifier-api-access.log
└── clarifier-api-error.log
```

## Next Steps

1. ✅ **Test**: Visit `https://api.yourdomain.com/health`
2. ✅ **Configure Extension**: Set API URL in extension options
3. ✅ **Try It**: Analyze a webpage
4. 📖 **Read Full Docs**: [DEPLOYMENT_SELF_HOSTED.md](DEPLOYMENT_SELF_HOSTED.md)

## Need Help?

- 📖 Full guide: [DEPLOYMENT_SELF_HOSTED.md](DEPLOYMENT_SELF_HOSTED.md)
- 📁 Deployment files: `deployment/` directory
- 🐛 Issues: GitHub Issues
- 📧 Support: Check README for contact info

---

**Deployment Time**: ~10-15 minutes  
**Difficulty**: Intermediate  
**Cost**: Free (using Let's Encrypt SSL)
