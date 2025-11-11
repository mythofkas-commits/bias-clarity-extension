# Deployment Summary - Self-Hosted Nginx Server Setup

## 🎉 What Has Been Prepared

Your repository now includes everything needed to deploy both the **Chrome Extension** (static files) and the **API Server** to your own Linux Nginx web server.

## 📦 What You Received

### Configuration Files (`deployment/` directory)

1. **`nginx-api.conf`** - Nginx reverse proxy configuration for API
   - SSL/HTTPS setup
   - Security headers
   - Rate limiting
   - Proxy settings for Node.js backend

2. **`nginx-extension.conf`** - Nginx configuration for extension static files
   - Static file serving
   - Download endpoint
   - Asset caching

3. **`clarifier-api.service`** - Systemd service file
   - Auto-start on boot
   - Auto-restart on failure
   - Logging configuration

4. **`ecosystem.config.js`** - PM2 configuration (alternative to systemd)
   - Cluster mode support
   - Process monitoring
   - Log management

5. **`.env.production.template`** - Production environment template
   - All required variables documented
   - Comments explaining each setting

### Automation Script

**`deployment/deploy.sh`** - One-command deployment
- Installs all dependencies (Node.js, Nginx, Redis, Certbot)
- Builds the server
- Configures Nginx with SSL
- Sets up systemd service
- Starts all services
- Verifies deployment

### Documentation

1. **`DEPLOYMENT_SELF_HOSTED.md`** (13KB) - Complete deployment guide
   - Quick start with automated script
   - Detailed manual deployment steps
   - PM2 alternative setup
   - Security hardening
   - Monitoring and maintenance
   - Troubleshooting

2. **`QUICKSTART_DEPLOY.md`** - 5-minute quick reference
   - One-command deploy
   - Essential post-deployment steps
   - Common commands

3. **`deployment/README.md`** - Deployment files documentation
   - File descriptions
   - Usage examples
   - Common commands

4. **`deployment/TESTING_CHECKLIST.md`** - Verification checklist
   - Pre-deployment checks
   - Functional testing
   - Security verification
   - Performance checks

## 🚀 How to Deploy (Quick Start)

### Step 1: SSH to Your Server

```bash
ssh user@your-server.com
sudo su -
```

### Step 2: Set Your Domain Names

```bash
export DOMAIN_API="api.yourdomain.com"
export DOMAIN_EXT="extension.yourdomain.com"  # Optional
```

### Step 3: Run Deployment Script

```bash
cd /opt
git clone https://github.com/mythofkas-commits/bias-clarity-extension.git
cd bias-clarity-extension
chmod +x deployment/deploy.sh
./deployment/deploy.sh
```

### Step 4: Configure Environment

When prompted, edit the `.env` file:

```bash
nano /var/www/argument-clarifier/server/.env
```

**Required settings:**
```env
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=sk-your-actual-openai-key-here
EXTENSION_ID=your-chrome-extension-id
```

Save and exit, then restart:

```bash
systemctl restart clarifier-api
```

### Step 5: Update Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Find "Argument Clarifier" → **Options**
3. Set **API Base URL** to: `https://api.yourdomain.com`
4. Click **Save**

### Step 6: Test It

```bash
curl https://api.yourdomain.com/health
```

Should return: `{"status":"ok","timestamp":"..."}`

## 📚 Documentation Guide

| Need to... | Read this file |
|------------|----------------|
| Deploy in 5 minutes | `QUICKSTART_DEPLOY.md` |
| Understand deployment in detail | `DEPLOYMENT_SELF_HOSTED.md` |
| Learn about deployment files | `deployment/README.md` |
| Verify deployment works | `deployment/TESTING_CHECKLIST.md` |
| Troubleshoot issues | `DEPLOYMENT_SELF_HOSTED.md` (Maintenance section) |

## 🎯 What Gets Deployed

### On Your Server

```
/var/www/argument-clarifier/
├── server/                    # API server
│   ├── dist/                  # Built JavaScript
│   ├── .env                   # Your configuration (sensitive!)
│   └── node_modules/          # Dependencies
├── extension/                 # Extension files
│   ├── manifest.json
│   ├── src/
│   └── ...
└── extension.zip              # Packaged for download

/etc/nginx/sites-enabled/
├── clarifier-api              # API proxy config
└── clarifier-extension        # Static files config (optional)

/etc/systemd/system/
└── clarifier-api.service      # Service config
```

### Services Running

1. **Nginx** - Web server and reverse proxy (ports 80, 443)
2. **Node.js API** - Your backend (port 3000, not exposed)
3. **Redis** - Cache for API responses (port 6379, optional)

### URLs You Get

- `https://api.yourdomain.com` - Your API
- `https://api.yourdomain.com/health` - Health check
- `https://api.yourdomain.com/analyze` - Analysis endpoint
- `https://extension.yourdomain.com` - Extension download page (optional)
- `https://extension.yourdomain.com/download` - Extension zip (optional)

## 🔒 Security Features Included

- ✅ SSL/HTTPS with Let's Encrypt (auto-renewal)
- ✅ Security headers (X-Frame-Options, CSP, HSTS, etc.)
- ✅ Rate limiting (100 requests per 15 min per IP)
- ✅ Firewall configuration (UFW)
- ✅ API port not exposed to internet
- ✅ Secure file permissions (.env at 600)
- ✅ CORS restricted to extension origins

## 🛠️ Common Post-Deployment Tasks

### View Logs

```bash
# API logs
sudo journalctl -u clarifier-api -f

# Nginx logs
sudo tail -f /var/log/nginx/clarifier-api-access.log
sudo tail -f /var/log/nginx/clarifier-api-error.log
```

### Restart API

```bash
sudo systemctl restart clarifier-api
```

### Check Status

```bash
sudo systemctl status clarifier-api
sudo systemctl status nginx
sudo systemctl status redis-server
```

### Update Deployment

```bash
cd /var/www/argument-clarifier
sudo git pull
cd server
sudo npm ci && sudo npm run build
sudo systemctl restart clarifier-api
```

## 🆘 Troubleshooting

### API Not Responding

```bash
# Check if running
sudo systemctl status clarifier-api

# Check logs
sudo journalctl -u clarifier-api -n 50

# Restart
sudo systemctl restart clarifier-api
```

### SSL Certificate Issues

```bash
# Check certificates
sudo certbot certificates

# Renew manually
sudo certbot renew

# Reload Nginx
sudo systemctl reload nginx
```

### Extension Can't Connect

1. Verify API URL in extension options: `https://api.yourdomain.com`
2. Check API is responding: `curl https://api.yourdomain.com/health`
3. Check browser console for CORS errors
4. Verify EXTENSION_ID in .env matches your extension

## 📊 What Was Changed in Your Code

### Modified Files

1. **`server/src/pipeline/heuristics.ts`**
   - Fixed TypeScript build error
   - Added missing `simplification` and `conclusion_trace` fields to match schema

2. **`README.md`**
   - Added "Production Deployment" section
   - Links to deployment guides

### New Files (All in `deployment/` directory)

- Configuration: nginx-api.conf, nginx-extension.conf, clarifier-api.service, ecosystem.config.js
- Template: .env.production.template
- Script: deploy.sh
- Docs: README.md, TESTING_CHECKLIST.md
- Root docs: DEPLOYMENT_SELF_HOSTED.md, QUICKSTART_DEPLOY.md

### No Changes To

- ✅ Extension functionality
- ✅ API endpoints or behavior
- ✅ Development workflow
- ✅ Existing deployment methods

## ✅ Deployment Checklist

Use `deployment/TESTING_CHECKLIST.md` for complete verification, but here's the essentials:

- [ ] DNS pointing to your server
- [ ] Server has 1GB+ RAM
- [ ] Run deployment script
- [ ] Configure .env with OPENAI_API_KEY
- [ ] Test: `curl https://api.yourdomain.com/health`
- [ ] Update extension API URL
- [ ] Test extension analysis on a webpage

## 🎓 Learn More

- **Quick Deploy**: Start with `QUICKSTART_DEPLOY.md`
- **Full Guide**: Read `DEPLOYMENT_SELF_HOSTED.md`
- **Testing**: Use `deployment/TESTING_CHECKLIST.md`
- **Maintenance**: See "Maintenance & Troubleshooting" in `DEPLOYMENT_SELF_HOSTED.md`

## 💡 Pro Tips

1. **Start Simple**: Use the automated script first
2. **Read Logs**: Most issues are visible in logs
3. **Test Locally**: Use `curl http://localhost:3000/health` to test before DNS
4. **Backup .env**: Your .env file contains sensitive keys - back it up securely
5. **Monitor Resources**: Check `free -h` and `df -h` periodically

## 📞 Need Help?

1. Check logs: `sudo journalctl -u clarifier-api -n 100`
2. Review troubleshooting section in `DEPLOYMENT_SELF_HOSTED.md`
3. Use `deployment/TESTING_CHECKLIST.md` to identify what's not working
4. Check GitHub issues for similar problems
5. Create new issue with logs and error messages

## 🎉 Success Criteria

Your deployment is successful when:

1. ✅ `curl https://api.yourdomain.com/health` returns OK
2. ✅ Extension analyzes a webpage successfully
3. ✅ No errors in logs
4. ✅ Service survives a reboot: `sudo reboot` then check `systemctl status clarifier-api`

---

## Next Steps

1. **Deploy**: Follow QUICKSTART_DEPLOY.md
2. **Test**: Use TESTING_CHECKLIST.md
3. **Monitor**: Watch logs for first 24-48 hours
4. **Optimize**: Add monitoring, backups as needed
5. **Enjoy**: You now have full control of your deployment! 🚀

---

**Deployment Time Estimate**: 10-15 minutes  
**Difficulty**: Intermediate (Linux/server experience helpful)  
**Cost**: Free (using Let's Encrypt SSL)  
**Maintenance**: Minimal (auto-restart, auto-renew SSL)
