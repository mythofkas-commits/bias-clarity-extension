// PM2 Ecosystem Configuration File
// Alternative to systemd for process management
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'clarifier-api',
    script: './dist/index.js',
    cwd: '/var/www/argument-clarifier/server',
    instances: 1,
    exec_mode: 'cluster',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // .env file (contains sensitive keys)
    env_file: '/var/www/argument-clarifier/server/.env',
    
    // Logging
    error_file: '/var/log/pm2/clarifier-api-error.log',
    out_file: '/var/log/pm2/clarifier-api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Restart policy
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Monitoring
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    
    // Advanced options
    instance_var: 'INSTANCE_ID',
    
    // Startup script (run as user)
    // Run: pm2 startup
    // Then: pm2 save
  }]
};
