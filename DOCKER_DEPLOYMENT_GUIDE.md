# 🐳 CampusCuts - Complete Docker Deployment Guide

Deploy the entire CampusCuts platform (Backend + Frontend) using Docker.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start (All Services)](#quick-start-all-services)
- [Individual Service Deployment](#individual-service-deployment)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Overview

CampusCuts consists of:

- **Backend API** (Node.js + TypeScript + PostgreSQL + Redis)
- **Frontend** (React + Vite + Nginx)
- **Database** (PostgreSQL with Prisma ORM)
- **Cache** (Redis)
- **Blockchain** (Aptos - external)

```
┌─────────────────────────────────────────────────────────┐
│                    CampusCuts Platform                  │
├──────────────────┬──────────────────┬───────────────────┤
│    Frontend      │    Backend API   │    Services       │
│  (React+Nginx)   │  (Node+Express)  │  (Postgres+Redis) │
│                  │                  │                   │
│  Port: 80        │  Port: 3001      │  Ports: 5432,6379 │
└──────────────────┴──────────────────┴───────────────────┘
           │                  │                  │
           └──────────────────┴──────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Aptos Blockchain  │
                    │     (External)     │
                    └────────────────────┘
```

---

## 📋 Prerequisites

### Required Software

- **Docker** 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.0+
- **Git**

### System Requirements

- **Minimum**: 4GB RAM, 2 CPU cores, 20GB disk
- **Recommended**: 8GB RAM, 4 CPU cores, 50GB disk

### Before You Start

1. **Aptos Wallet Setup**
   - Create wallet on [Petra](https://petra.app/)
   - Get private key and address
   - Fund with devnet APT (from faucet)

2. **Deploy Smart Contracts**
   ```bash
   cd contracts
   aptos move publish --network devnet
   # Note the module address
   ```

3. **Get API Keys**
   - Stripe account (for payments)
   - Pinata account (for IPFS)

---

## 🚀 Quick Start (All Services)

### 1. Clone Repository

```bash
git clone https://github.com/your-username/CampusCuts.git
cd CampusCuts
```

### 2. Configure Environment

```bash
# Copy example environment files
cp backend/env.example backend/.env
cp web-app/env.example web-app/.env
cp env.production.example .env

# Edit with your values
nano backend/.env
nano web-app/.env
```

**Critical Variables:**
```bash
# Backend (.env)
PETRA_PRIVATE_KEY=0x...
APTOS_MODULE_ADDRESS=0x...
STRIPE_SECRET_KEY=sk_...
JWT_SECRET=your-secret

# Frontend (.env)
VITE_API_URL=http://localhost:3001/api/v1
VITE_APTOS_MODULE_ADDRESS=0x...
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
```

### 3. Start All Services

```bash
# Development mode
docker-compose up -d

# Production mode
docker-compose -f docker-compose.production.yml up -d
```

### 4. Initialize Database

```bash
# Run Prisma migrations
docker-compose exec backend npx prisma migrate deploy

# (Optional) Seed with test data
docker-compose exec backend npm run seed
```

### 5. Verify Deployment

```bash
# Check all services are running
docker-compose ps

# Test backend
curl http://localhost:3001/health

# Test frontend
curl http://localhost/health

# View logs
docker-compose logs -f
```

**Expected Output:**
```
✅ Backend running on port 3001
✅ Frontend running on port 80
✅ PostgreSQL ready
✅ Redis ready
```

---

## 🔧 Individual Service Deployment

### Backend API Only

```bash
cd backend

# Build
docker build -t campuscuts-backend .

# Run
docker run -d \
  --name campuscuts-backend \
  -p 3001:3001 \
  --env-file .env \
  campuscuts-backend
```

### Frontend Only

```bash
cd web-app

# Build (with environment variables)
./build-docker.sh

# Run
./run-docker.sh

# Or manually
docker run -d \
  --name campuscuts-frontend \
  -p 80:80 \
  campuscuts-frontend:latest
```

### Database & Redis

```bash
# PostgreSQL
docker run -d \
  --name campuscuts-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=campuscuts \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Redis
docker run -d \
  --name campuscuts-redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine
```

---

## 🌐 Production Deployment

### AWS (Elastic Container Service)

```bash
# 1. Build for production
docker-compose -f docker-compose.production.yml build

# 2. Tag images
docker tag campuscuts-backend:latest your-account.dkr.ecr.us-west-1.amazonaws.com/campuscuts-backend:latest
docker tag campuscuts-frontend:latest your-account.dkr.ecr.us-west-1.amazonaws.com/campuscuts-frontend:latest

# 3. Push to ECR
aws ecr get-login-password --region us-west-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-west-1.amazonaws.com
docker push your-account.dkr.ecr.us-west-1.amazonaws.com/campuscuts-backend:latest
docker push your-account.dkr.ecr.us-west-1.amazonaws.com/campuscuts-frontend:latest

# 4. Deploy via ECS (use AWS Console or CLI)
```

### DigitalOcean

```bash
# Use their App Platform with GitHub integration
# 1. Connect GitHub repo
# 2. Select docker-compose.production.yml
# 3. Set environment variables in UI
# 4. Deploy automatically
```

### Your VPS (EC2, Linode, etc.)

```bash
# 1. SSH into server
ssh ubuntu@your-server-ip

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Clone repo
git clone https://github.com/your-username/CampusCuts.git
cd CampusCuts

# 4. Configure environment
cp backend/env.example backend/.env
cp web-app/env.example web-app/.env
# Edit with production values

# 5. Deploy
docker-compose -f docker-compose.production.yml up -d

# 6. Set up SSL with Caddy
sudo apt install caddy
sudo caddy reverse-proxy --from your-domain.com --to localhost:80
```

---

## ⚙️ Environment Configuration

### Backend Environment Variables

**Critical (Required):**
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/campuscuts

# Blockchain
PETRA_PRIVATE_KEY=0x...your_private_key
APTOS_PLATFORM_ADDRESS=0x...your_address
APTOS_MODULE_ADDRESS=0x...deployed_module

# Security
JWT_SECRET=your-super-secret-key
CUSTODIAL_ENCRYPTION_SECRET=min-32-chars-secret

# Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Optional (Recommended):**
```bash
# Redis (for caching)
REDIS_URL=redis://localhost:6379

# IPFS (for profile images)
PINATA_JWT=eyJ...
PINATA_API_KEY=...

# AWS (for file storage)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=campuscuts-uploads
```

### Frontend Environment Variables

```bash
# API Connection
VITE_API_URL=https://api.campuscuts.com/api/v1
VITE_API_BASE_URL=https://api.campuscuts.com
VITE_WS_URL=wss://api.campuscuts.com

# Blockchain
VITE_APTOS_NETWORK=mainnet
VITE_APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
VITE_APTOS_MODULE_ADDRESS=0x...

# Payments
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## 🐛 Troubleshooting

### Backend Won't Start

**Problem:** `Error: PETRA_PRIVATE_KEY not configured`

**Solution:**
```bash
# Check .env exists
ls -la backend/.env

# Verify format (no quotes, no ed25519-priv- prefix)
cat backend/.env | grep PETRA_PRIVATE_KEY
# Should be: PETRA_PRIVATE_KEY=0x1234...

# Rebuild after fixing
docker-compose restart backend
```

---

**Problem:** `Error: Cannot connect to database`

**Solution:**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection string
docker-compose exec backend env | grep DATABASE_URL

# Restart database
docker-compose restart postgres

# Wait for it to be ready
docker-compose logs -f postgres
```

---

**Problem:** `Redis connection refused`

**Solution:**
```bash
# Check Redis is running
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping
# Should return: PONG

# Restart if needed
docker-compose restart redis
```

---

### Frontend Won't Start

**Problem:** Build fails with "module not found"

**Solution:**
```bash
cd web-app

# Clear cache
rm -rf node_modules dist .vite
npm install

# Rebuild
./build-docker.sh
```

---

**Problem:** "Failed to fetch from backend"

**Solution:**
```bash
# Check API URL in frontend .env
cat web-app/.env | grep VITE_API_URL

# Test backend is accessible
curl http://localhost:3001/health

# Rebuild with correct URL
cd web-app
./build-docker.sh
./run-docker.sh
```

---

### Database Issues

**Problem:** Tables don't exist

**Solution:**
```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Check tables
docker-compose exec backend npx prisma studio
# Opens browser at localhost:5555
```

---

**Problem:** Permission denied for database

**Solution:**
```bash
# Grant permissions
docker-compose exec postgres psql -U postgres -d campuscuts << EOF
GRANT ALL ON SCHEMA public TO campuscuts_user;
ALTER DATABASE campuscuts OWNER TO campuscuts_user;
EOF

# Restart backend
docker-compose restart backend
```

---

### Container Health Checks

```bash
# Check all container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# View specific container logs
docker logs campuscuts-backend
docker logs campuscuts-frontend
docker logs campuscuts-postgres
docker logs campuscuts-redis

# Restart unhealthy container
docker restart campuscuts-backend
```

---

## 📊 Monitoring

### Docker Stats

```bash
# Real-time resource usage
docker stats

# Logs from all services
docker-compose logs -f

# Specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Health Checks

```bash
# Backend health
curl http://localhost:3001/health

# Frontend health
curl http://localhost/health

# Database health
docker-compose exec postgres pg_isready

# Redis health
docker-compose exec redis redis-cli ping
```

---

## 🧹 Maintenance

### Update Services

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose build

# Restart services (no downtime for stateless services)
docker-compose up -d

# Run new migrations if needed
docker-compose exec backend npx prisma migrate deploy
```

### Backup Database

```bash
# Backup
docker-compose exec postgres pg_dump -U postgres campuscuts > backup.sql

# Restore
cat backup.sql | docker-compose exec -T postgres psql -U postgres campuscuts
```

### Clean Up

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes data!)
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a --volumes
```

---

## 📚 Additional Resources

- [Backend README](./backend/README.md)
- [Frontend Docker Guide](./web-app/DOCKER_DEPLOYMENT.md)
- [AWS Deployment Guide](./AWS_DEPLOYMENT_GUIDE.md)
- [Aptos Documentation](https://aptos.dev/)

---

## 🆘 Getting Help

1. **Check logs first**: `docker-compose logs -f`
2. **Verify environment variables**: Review all `.env` files
3. **Test individually**: Deploy services one at a time
4. **Reset everything**: `docker-compose down -v && docker-compose up -d`

---

**🚀 Ready to deploy! Good luck!**

