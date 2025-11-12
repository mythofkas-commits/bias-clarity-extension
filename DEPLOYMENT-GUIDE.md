# Server Deployment Guide

## 🚨 CRITICAL SECURITY ISSUE

**Your OpenAI API key was exposed publicly in your message!**

### Immediate Action Required:

1. **Go to https://platform.openai.com/api-keys**
2. **Find and REVOKE the exposed key** (starts with `sk-proj-9j2-oF...`)
3. **Create a NEW API key**
4. **Use the new key in the deployment**

---

## Quick Deployment

### Step 1: Upload Scripts to Your Server

```bash
# On your local machine, upload the deployment script
scp deploy-to-server.sh root@your-server-ip:/root/
scp rollback.sh root@your-server-ip:/root/
```

Or manually copy the contents via SSH:

```bash
ssh root@your-server-ip
nano /root/deploy-to-server.sh
# Paste the script contents
# Save: Ctrl+X, Y, Enter

chmod +x /root/deploy-to-server.sh
chmod +x /root/rollback.sh
```

### Step 2: Run Deployment

```bash
ssh root@your-server-ip
cd /root
bash deploy-to-server.sh
```

The script will:
- ✅ Check for Virtualmin and existing domain
- ✅ Install Node.js 20, Redis, and PM2
- ✅ Clone your GitHub repository
- ✅ Build the backend
- ✅ Start the app with PM2
- ✅ Configure nginx (without breaking existing sites)
- ✅ Set up automatic startup on boot

### Step 3: Add Your NEW API Key

**CRITICAL:** After deployment, you MUST add your new OpenAI API key:

```bash
# Edit the environment file
nano /home/api/argument-clarifier/server/.env

# Find this line:
OPENAI_API_KEY=REPLACE_WITH_YOUR_NEW_API_KEY

# Replace with your NEW key:
OPENAI_API_KEY=sk-your-new-key-here

# Save: Ctrl+X, Y, Enter
```

### Step 4: Restart the Application

```bash
pm2 restart argument-clarifier
pm2 logs argument-clarifier  # Check logs
```

### Step 5: Test It Works

```bash
# Test health endpoint
curl https://api.kasra.one/health

# Should return: {"status":"ok","timestamp":"..."}

# Test analysis endpoint
curl -X POST https://api.kasra.one/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"test","text":"This is a test. Maybe it works."}'

# Should return JSON with analysis results
```

---

## What the Script Does (Virtualmin-Safe)

### ✅ Safe Operations

1. **Checks for existing Virtualmin domain** - Won't proceed if domain not found
2. **Backs up nginx config** before modifying
3. **Only adds location blocks** - Doesn't replace entire nginx config
4. **Uses non-standard port (3001)** - Avoids conflicts with other apps
5. **Tests nginx config** before reloading
6. **Automatic rollback** if nginx test fails

### 📁 File Locations

- **App directory:** `/home/api/argument-clarifier/`
- **Backend code:** `/home/api/argument-clarifier/server/`
- **Environment file:** `/home/api/argument-clarifier/server/.env`
- **nginx config:** `/etc/nginx/sites-available/api.kasra.one.conf.conf`
- **PM2 logs:** `~/.pm2/logs/`

---

## Useful Commands

### Application Management

```bash
# Check app status
pm2 status

# View live logs
pm2 logs argument-clarifier

# Restart app (after config changes)
pm2 restart argument-clarifier

# Stop app
pm2 stop argument-clarifier

# Start app (if stopped)
pm2 start argument-clarifier
```

### Debugging

```bash
# Check if app is responding locally
curl http://localhost:3001/health

# Check if Redis is running
redis-cli ping

# Check nginx error logs
tail -f /var/log/nginx/error.log

# Check PM2 error logs
pm2 logs argument-clarifier --err --lines 100

# View full deployment log
cat /tmp/argument-clarifier-deploy-*.log
```

### Updating the Application

```bash
cd /home/api/argument-clarifier
git pull origin main
cd server
npm install --production
npm run build
pm2 restart argument-clarifier
```

### nginx Management

```bash
# Test nginx config
nginx -t

# Reload nginx (after config changes)
systemctl reload nginx

# Restart nginx (if needed)
systemctl restart nginx

# View nginx config
cat /etc/nginx/sites-available/api.kasra.one.conf
```

---

## Rollback (If Something Goes Wrong)

If deployment fails or you need to undo changes:

```bash
bash /root/rollback.sh
```

This will:
- Stop and remove the PM2 process
- Restore nginx config from backup
- Optionally remove application directory

---

## Troubleshooting

### Issue: "PM2 command not found" after deployment

```bash
# PM2 might be installed but not in PATH
export PATH=$PATH:/usr/local/bin
pm2 status

# Or use full path
/usr/local/bin/pm2 status
```

### Issue: nginx test fails

```bash
# Check what's wrong
nginx -t

# View detailed error
tail -f /var/log/nginx/error.log

# Rollback to previous config
bash /root/rollback.sh
```

### Issue: App not responding

```bash
# Check if app is running
pm2 status

# Check app logs
pm2 logs argument-clarifier --lines 100

# Common issues:
# 1. Missing OpenAI API key in .env
# 2. Port 3001 already in use
# 3. Redis connection failed (app should still work)
```

### Issue: "Server error: 500" from extension

```bash
# Most likely missing OpenAI API key
nano /home/api/argument-clarifier/server/.env

# Add your key:
OPENAI_API_KEY=sk-your-key-here

# Restart:
pm2 restart argument-clarifier
```

### Issue: CORS errors in browser console

The nginx config includes CORS headers. If still getting errors:

```bash
# Check nginx config has CORS headers
grep -A5 "Access-Control" /etc/nginx/sites-available/api.kasra.one.conf

# Should see:
# add_header Access-Control-Allow-Origin * always;
# add_header Access-Control-Allow-Methods "POST, OPTIONS" always;
# add_header Access-Control-Allow-Headers "Content-Type" always;
```

---

## Security Best Practices

### 1. Secure Your API Key

```bash
# .env file should be readable only by owner
chmod 600 /home/api/argument-clarifier/server/.env

# Never commit .env to git
# It's already in .gitignore
```

### 2. Monitor Usage

```bash
# Check OpenAI usage at:
# https://platform.openai.com/usage

# Check server resources
htop
df -h
free -h
```

### 3. Set Up Log Rotation

The script doesn't set up log rotation. To prevent disk space issues:

```bash
# PM2 handles its own log rotation, but you can configure:
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 4. Rate Limiting

Edit rate limits in `.env`:

```env
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100       # Adjust based on usage
```

---

## Monitoring

### Check Application Health

```bash
# Create a simple monitoring script
cat > /root/check-app.sh << 'EOF'
#!/bin/bash
if ! curl -s https://api.kasra.one/health > /dev/null; then
    echo "App is down! Restarting..."
    pm2 restart argument-clarifier
fi
EOF

chmod +x /root/check-app.sh

# Add to crontab to run every 5 minutes
crontab -e
# Add this line:
*/5 * * * * /root/check-app.sh
```

### View Resource Usage

```bash
# PM2 monitoring
pm2 monit

# Server resources
htop

# Disk space
df -h

# Redis memory
redis-cli INFO memory
```

---

## Cost Estimation

With Chrome AI and BYOK options, your server costs should be minimal:

- **Server:** $5-12/month (1-2GB RAM)
- **OpenAI API:** Only when users hit your server (fallback)
- **Redis:** Minimal (< 100MB memory)
- **nginx:** Minimal overhead

Most users will use Chrome AI (free) or BYOK (their cost), so your API costs should be very low.

---

## Support

If you run into issues:

1. Check the deployment log: `/tmp/argument-clarifier-deploy-*.log`
2. Check PM2 logs: `pm2 logs argument-clarifier`
3. Check nginx logs: `/var/log/nginx/error.log`
4. Test locally first: `curl http://localhost:3001/health`

For more help, check the main README.md and TESTING.md files.

---

## Next Steps After Deployment

1. ✅ Verify API key is added and working
2. ✅ Test the health endpoint
3. ✅ Test the analyze endpoint
4. ✅ Update Chrome extension settings to use `https://api.kasra.one`
5. ✅ Test from the extension
6. ✅ Set up monitoring (optional)
7. ✅ Configure log rotation (optional)

**Your backend is now live at:** https://api.kasra.one

Enjoy your hybrid analysis system! 🎉
