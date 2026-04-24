/**
 * PM2 process definition for the CampusCuts API.
 *
 * Production (sets NODE_ENV=production — required for correct Stripe fallbacks, etc.):
 *   cd backend && pm2 start ecosystem.config.cjs --env production
 *
 * Local / staging default:
 *   pm2 start ecosystem.config.cjs
 *
 * After changing this file: pm2 delete campuscuts-backend && pm2 start ecosystem.config.cjs --env production && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'campuscuts-backend',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 50,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
