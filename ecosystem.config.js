module.exports = {
  apps: [{
    name: 'hipro-api',
    script: 'dist/server.js',
    instances: 1, // Start with 1, can scale up later
    exec_mode: 'fork',
    watch: false,
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      MONGODB_URI: 'mongodb://localhost:27017/hipro-comm-prod',
      JWT_SECRET: 'your-production-jwt-secret-change-this',
      JWT_EXPIRES_IN: '7d',
      COOKIE_SECRET: 'your-production-cookie-secret-change-this',
      FRONTEND_URL: 'https://shop.hiprotech.org',
      RATE_LIMIT_WINDOW_MS: 900000,
      RATE_LIMIT_MAX_REQUESTS: 100,
      SMTP_HOST: 'smtp.hostinger.com',
      SMTP_PORT: 587,
      SMTP_USER: 'info@hiprotech.org',
      SMTP_PASS: 'Abhi@2026',
      SMTP_FROM_NAME: 'HiPro Commerce'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G'
  }]
};