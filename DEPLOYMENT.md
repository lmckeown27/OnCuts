# CampusCuts Deployment Guide

Complete guide for deploying CampusCuts to production.

---

## 📋 Prerequisites

### Required Services
- ✅ **Aptos Wallet** (with APT for gas)
- ✅ **Stripe Account** (with API keys)
- ✅ **Pinata Account** (for IPFS)
- ✅ **Domain Name** (optional but recommended)
- ✅ **VPS/Cloud Server** (2GB RAM minimum)

### Required Tools
- Docker & Docker Compose
- Git
- Node.js 20+ (for local development)

---

## 🚀 Deployment Options

### Option 1: Docker Compose (Recommended)

**Best for:** VPS, dedicated servers, self-hosting

```bash
# 1. Clone repository
git clone https://github.com/your-username/CampusCuts.git
cd CampusCuts

# 2. Create environment file
cp backend/.env.example backend/.env
nano backend/.env  # Edit with your values

# 3. Build and start
docker-compose -f docker-compose.prod.yml up -d

# 4. Check health
curl http://localhost/health
```

### Option 2: Separate Deployments

**Backend:** Deploy to any Node.js host (Heroku, Railway, Render)
**Frontend:** Deploy to Vercel, Netlify, or Cloudflare Pages

### Option 3: Kubernetes

For large-scale deployments, use the Helm chart (coming soon).

---

## ⚙️ Environment Configuration

### Backend Environment Variables

Create `backend/.env`:

```bash
# ═══════════════════════════════════════════════════════════
#  SERVER
# ═══════════════════════════════════════════════════════════
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://app.campuscuts.com

# ═══════════════════════════════════════════════════════════
#  APTOS BLOCKCHAIN
# ═══════════════════════════════════════════════════════════
APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
APTOS_PLATFORM_ADDRESS=0x...your_platform_wallet_address
APTOS_PRIVATE_KEY=0x...your_platform_private_key
APTOS_MODULE_ADDRESS=0x...your_deployed_contract_address

# ═══════════════════════════════════════════════════════════
#  STRIPE PAYMENTS
# ═══════════════════════════════════════════════════════════
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ═══════════════════════════════════════════════════════════
#  IPFS / PINATA
# ═══════════════════════════════════════════════════════════
PINATA_API_KEY=...
PINATA_SECRET_KEY=...
IPFS_GATEWAY=https://gateway.pinata.cloud

# ═══════════════════════════════════════════════════════════
#  REDIS CACHE
# ═══════════════════════════════════════════════════════════
REDIS_URL=redis://localhost:6379

# ═══════════════════════════════════════════════════════════
#  SECURITY
# ═══════════════════════════════════════════════════════════
ENCRYPTION_KEY=...generate_random_32_byte_key
JWT_SECRET=...generate_random_string

# ═══════════════════════════════════════════════════════════
#  RATE LIMITING
# ═══════════════════════════════════════════════════════════
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend Environment Variables

Create `web-app/.env`:

```bash
VITE_API_BASE_URL=https://api.campuscuts.com
VITE_APTOS_NETWORK=mainnet
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## 📦 Building for Production

### Backend

```bash
cd backend
npm ci --only=production
npm run build
node dist/index.js
```

### Frontend

```bash
cd web-app
npm ci
npm run build
# Output in dist/
```

---

## 🐳 Docker Deployment

### Build Images

```bash
# Backend
docker build -t campuscuts-backend:latest ./backend

# Frontend
docker build -t campuscuts-frontend:latest ./web-app
```

### Run with Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Individual Container Commands

```bash
# Run backend
docker run -d \
  --name campuscuts-backend \
  -p 3001:3001 \
  --env-file backend/.env \
  campuscuts-backend:latest

# Run frontend
docker run -d \
  --name campuscuts-frontend \
  -p 80:80 \
  campuscuts-frontend:latest

# Run Redis
docker run -d \
  --name campuscuts-redis \
  -p 6379:6379 \
  redis:7-alpine
```

---

## 🔧 Smart Contract Deployment

### Deploy to Aptos Mainnet

```bash
cd contracts

# 1. Initialize Move project
aptos move init --name campus_cuts

# 2. Compile contracts
aptos move compile

# 3. Test locally
aptos move test

# 4. Deploy to mainnet (requires APT for gas)
aptos move publish \
  --profile mainnet \
  --named-addresses campus_cuts=0x...your_address

# 5. Initialize modules
aptos move run \
  --function-id '0x...your_address::user_accounts::initialize' \
  --profile mainnet

aptos move run \
  --function-id '0x...your_address::bookings::initialize' \
  --profile mainnet

aptos move run \
  --function-id '0x...your_address::reviews::initialize' \
  --profile mainnet

aptos move run \
  --function-id '0x...your_address::platform_admin::initialize' \
  --profile mainnet
```

---

## 🌐 Domain & SSL Setup

### Option 1: Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/campuscuts
server {
    listen 80;
    server_name campuscuts.com www.campuscuts.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name campuscuts.com www.campuscuts.com;

    ssl_certificate /etc/letsencrypt/live/campuscuts.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/campuscuts.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Option 2: Caddy (Automatic HTTPS)

```caddyfile
# Caddyfile
campuscuts.com {
    reverse_proxy localhost:80
}

api.campuscuts.com {
    reverse_proxy localhost:3001
}
```

### Get SSL Certificate

```bash
# Using Certbot
sudo certbot --nginx -d campuscuts.com -d www.campuscuts.com
```

---

## 🔄 CI/CD Setup (GitHub Actions)

### 1. Configure Secrets

Go to GitHub repo settings → Secrets and add:

```
DEPLOY_HOST: your-server-ip
DEPLOY_USER: deploy
DEPLOY_KEY: <your-ssh-private-key>
DISCORD_WEBHOOK: <webhook-url> (optional)
```

### 2. Push to Main Branch

```bash
git push origin main
```

GitHub Actions will automatically:
1. Run tests
2. Build Docker images
3. Push to GitHub Container Registry
4. Deploy to your server
5. Run health checks

---

## 📊 Monitoring & Logging

### Health Checks

```bash
# Backend health
curl https://api.campuscuts.com/health

# Frontend health
curl https://campuscuts.com/health
```

### View Logs

```bash
# Docker logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Individual container
docker logs -f campuscuts-backend
```

### Monitor Resources

```bash
# Docker stats
docker stats

# System resources
htop
```

---

## 🔒 Security Checklist

Before going live:

- [ ] Change all default passwords
- [ ] Rotate encryption keys
- [ ] Enable Stripe webhook signature verification
- [ ] Set up firewall rules
- [ ] Enable fail2ban
- [ ] Configure rate limiting
- [ ] Set up monitoring alerts
- [ ] Enable HTTPS only
- [ ] Set secure headers
- [ ] Backup encryption keys securely

---

## 🆘 Troubleshooting

### Backend won't start

```bash
# Check logs
docker logs campuscuts-backend

# Common issues:
# - Missing environment variables
# - Redis not running
# - Invalid Aptos keys
```

### Frontend not loading

```bash
# Check nginx logs
docker logs campuscuts-frontend

# Common issues:
# - API URL misconfigured
# - CORS issues
# - Build failed
```

### Blockchain connection errors

```bash
# Test Aptos connection
curl https://fullnode.mainnet.aptoslabs.com/v1

# Verify wallet has APT
aptos account list --profile mainnet
```

---

## 📈 Scaling

### Horizontal Scaling

```bash
# Scale backend replicas
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

### Load Balancer Setup

Use Nginx or HAProxy for load balancing multiple backend instances.

### Database Scaling

Redis Cluster for high availability:

```yaml
# docker-compose.prod.yml
redis-master:
  image: redis:7-alpine
  
redis-replica-1:
  image: redis:7-alpine
  command: redis-server --replicaof redis-master 6379
```

---

## 💰 Cost Estimates

**Monthly Production Costs:**

- VPS (2GB RAM): $10-20
- Domain: $12/year
- SSL: Free (Let's Encrypt)
- Redis Cloud: $0 (self-hosted) or $5-10 (managed)
- Stripe fees: 2.9% + $0.30 per transaction
- Aptos gas: ~$0.001 per transaction
- IPFS (Pinata): $0-20/month
- **Total:** ~$15-50/month + transaction fees

---

## 🎉 Post-Deployment

1. Test all features thoroughly
2. Set up monitoring dashboards
3. Configure backup automation
4. Document any custom changes
5. Train team on admin dashboard
6. Launch! 🚀

---

## 🆘 Support

Need help? Check:
- GitHub Issues: https://github.com/your-username/CampusCuts/issues
- Documentation: README.md
- Backend API: BACKEND_OVERVIEW.md
- Architecture: ARCHITECTURE.md

---

**Built with ❤️ by the CampusCuts team**

Blockchain-First, Web2 UX ✨

