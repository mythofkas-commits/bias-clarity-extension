# Deployment Testing Checklist

Use this checklist to verify your deployment is working correctly.

## Pre-Deployment Checks

- [ ] Server meets minimum requirements (1GB RAM, 10GB disk)
- [ ] Node.js 20+ is installed (`node -v`)
- [ ] Nginx is installed (`nginx -v`)
- [ ] DNS records point to your server
  - [ ] api.yourdomain.com → Server IP
  - [ ] extension.yourdomain.com → Server IP (optional)
- [ ] SSH access to server working
- [ ] Root/sudo privileges available
- [ ] Ports 80, 443 are open

## Deployment Steps

- [ ] Repository cloned to `/var/www/argument-clarifier`
- [ ] Server dependencies installed (`npm ci`)
- [ ] Server built successfully (`npm run build`)
- [ ] Production dependencies installed
- [ ] `.env` file created with required variables:
  - [ ] `OPENAI_API_KEY` set
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3000`
  - [ ] `EXTENSION_ID` set (if using extension)
- [ ] Extension packaged (`extension.zip` created)
- [ ] Nginx configurations copied and enabled
- [ ] SSL certificates obtained (Let's Encrypt)
- [ ] Systemd service or PM2 configured
- [ ] File permissions set correctly
  - [ ] `.env` has 600 permissions
  - [ ] Application owned by www-data

## Service Verification

### API Service

- [ ] Service is running: `systemctl status clarifier-api`
- [ ] Service starts on boot: `systemctl is-enabled clarifier-api`
- [ ] No errors in logs: `journalctl -u clarifier-api -n 50`
- [ ] Process listening on port 3000: `netstat -tlnp | grep 3000`

### Nginx

- [ ] Nginx configuration valid: `nginx -t`
- [ ] Nginx is running: `systemctl status nginx`
- [ ] API site enabled: `ls -l /etc/nginx/sites-enabled/clarifier-api`
- [ ] Extension site enabled (if used): `ls -l /etc/nginx/sites-enabled/clarifier-extension`

### Redis (Optional)

- [ ] Redis is running: `systemctl status redis-server`
- [ ] Redis responds: `redis-cli ping` returns `PONG`

## Functional Testing

### API Endpoints

Test locally:
```bash
# Health check
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}

# Health check via domain
curl https://api.yourdomain.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

- [ ] Local health check works (`http://localhost:3000/health`)
- [ ] Domain health check works (`https://api.yourdomain.com/health`)
- [ ] SSL certificate is valid (no browser warnings)
- [ ] HTTPS redirect works (http → https)

Test analyze endpoint:
```bash
curl -X POST https://api.yourdomain.com/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "text": "This is a test. Climate change is real. Studies show correlation."
  }'
```

- [ ] Analyze endpoint responds (may take 5-30 seconds)
- [ ] Response includes expected fields: `url`, `hash`, `merged`, `model`
- [ ] No errors in response

### Extension (if serving static files)

- [ ] Extension files accessible: `https://extension.yourdomain.com`
- [ ] Download link works: `https://extension.yourdomain.com/download`
- [ ] Downloaded zip file is valid
- [ ] Directory listing shows files (if enabled)

### Chrome Extension Integration

- [ ] Extension installed in Chrome
- [ ] Options page opens
- [ ] API Base URL updated to `https://api.yourdomain.com`
- [ ] Settings saved successfully
- [ ] Navigate to a test webpage
- [ ] Extension icon clickable
- [ ] Side panel opens
- [ ] "Analyze This Page" button visible
- [ ] Analysis completes successfully
- [ ] Results display properly
- [ ] No errors in browser console

## Security Checks

- [ ] Firewall configured:
  - [ ] Port 22 (SSH) allowed
  - [ ] Port 80 (HTTP) allowed
  - [ ] Port 443 (HTTPS) allowed
  - [ ] Port 3000 blocked externally: `nmap -p 3000 your-server.com` shows filtered/closed
- [ ] `.env` file not accessible via web
- [ ] Nginx security headers present:
  ```bash
  curl -I https://api.yourdomain.com/health | grep -E "X-Frame-Options|X-Content-Type"
  ```
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] SSL certificate valid and not expiring soon:
  ```bash
  sudo certbot certificates
  ```
- [ ] Rate limiting working:
  ```bash
  # Run multiple times quickly
  for i in {1..10}; do curl https://api.yourdomain.com/health; done
  ```
- [ ] CORS headers configured for extension origin

## Performance Checks

- [ ] API responds in < 5 seconds for health check
- [ ] Nginx access logs rotating properly
- [ ] Redis cache being used (check logs for "Cache hit")
- [ ] Memory usage acceptable: `free -h`
- [ ] Disk space sufficient: `df -h`
- [ ] No memory leaks (monitor over time)

## Monitoring Setup

- [ ] Log rotation configured
- [ ] Logs accessible and readable:
  - [ ] API logs: `journalctl -u clarifier-api`
  - [ ] Nginx access: `/var/log/nginx/clarifier-api-access.log`
  - [ ] Nginx error: `/var/log/nginx/clarifier-api-error.log`
- [ ] Error alerting configured (optional)
- [ ] Uptime monitoring configured (optional)

## Backup Verification

- [ ] Backup script created (optional)
- [ ] Backup directory exists
- [ ] Test backup restoration
- [ ] Cron job scheduled for automatic backups

## Documentation

- [ ] `.env` file documented with actual values used
- [ ] Domain names documented
- [ ] SSL certificate renewal dates noted
- [ ] Emergency contacts/procedures documented
- [ ] Runbook created for common tasks

## Long-term Stability

Monitor these over the first week:

- [ ] Day 1: No crashes or restarts
- [ ] Day 2: Memory stable
- [ ] Day 3: Logs clean (no recurring errors)
- [ ] Day 7: Performance consistent
- [ ] Day 7: SSL auto-renewal test passed
- [ ] Day 30: Update procedure tested

## Common Issues to Check

### API won't start
```bash
# Check environment variables
sudo cat /var/www/argument-clarifier/server/.env

# Check permissions
ls -la /var/www/argument-clarifier/server/dist/

# Check Node.js version
node -v

# Check for port conflicts
sudo netstat -tlnp | grep 3000
```

### SSL not working
```bash
# Verify certificate exists
sudo ls -la /etc/letsencrypt/live/

# Test certificate
sudo certbot certificates

# Manually renew
sudo certbot renew --dry-run
```

### High latency
```bash
# Check OpenAI API status
curl https://status.openai.com/

# Check Redis
redis-cli ping

# Check system resources
htop
```

## Sign-off

- [ ] All critical checks passed
- [ ] Documentation updated
- [ ] Team notified of deployment
- [ ] Rollback plan documented
- [ ] Deployment date/time recorded: _______________
- [ ] Deployed by: _______________
- [ ] Production URL: _______________

---

## Notes

Use this space to record any issues, customizations, or deviations from standard deployment:

```
[Your notes here]
```

---

## Next Steps After Successful Deployment

1. Monitor logs for 24-48 hours
2. Test with real users
3. Set up automated monitoring
4. Schedule regular maintenance windows
5. Plan for scaling if needed
6. Review and update documentation

## Support

If you encounter issues not covered here:
- Check [DEPLOYMENT_SELF_HOSTED.md](DEPLOYMENT_SELF_HOSTED.md) for detailed troubleshooting
- Review logs: `sudo journalctl -u clarifier-api -n 100`
- Check GitHub issues
- Contact support with logs and error messages
