# ✅ Docker Deployment Setup Complete!

Your CampusCuts platform is now fully Dockerized and ready for deployment!

---

## 🎯 What Was Accomplished

### 📦 Files Created

#### Frontend (web-app/)
1. **`.dockerignore`** - Optimizes Docker builds by excluding unnecessary files
2. **`env.example`** - Template for environment variables
3. **`Dockerfile`** (updated) - Multi-stage build with environment variable support
4. **`build-docker.sh`** - Automated build script
5. **`run-docker.sh`** - Container run script
6. **`deploy-docker.sh`** - Complete deployment automation
7. **`DOCKER_DEPLOYMENT.md`** - Comprehensive frontend deployment guide

#### Root Level
1. **`docker-compose.yml`** (updated) - Added frontend service
2. **`docker-compose.production.yml`** - Production-optimized configuration
3. **`DOCKER_DEPLOYMENT_GUIDE.md`** - Full-stack deployment guide
4. **`Makefile.docker`** - Simplified deployment commands

#### Backend
- Already had Dockerfile and configuration ✅

---

## 🚀 Quick Start Guide

### Option 1: Using Make (Easiest)

```bash
# 1. Setup environment files
make -f Makefile.docker setup

# 2. Edit .env files with your values
nano backend/.env
nano web-app/.env

# 3. Start development environment
make -f Makefile.docker dev

# Done! 🎉
```

### Option 2: Using Docker Compose

```bash
# 1. Copy environment files
cp backend/env.example backend/.env
cp web-app/env.example web-app/.env

# 2. Edit with your values
nano backend/.env
nano web-app/.env

# 3. Start all services
docker-compose up -d

# 4. Initialize database
docker-compose exec backend npx prisma migrate deploy

# Done! 🎉
```

### Option 3: Frontend Only (Deployment Scripts)

```bash
cd web-app

# 1. Create .env from example
cp env.example .env
nano .env

# 2. Deploy (builds and runs)
./deploy-docker.sh

# Done! 🎉
```

---

## 🌐 Access Your Application

Once deployed:

- **Frontend**: http://localhost (port 80)
- **Backend API**: http://localhost:3001
- **Health Checks**:
  - Frontend: `curl http://localhost/health`
  - Backend: `curl http://localhost:3001/health`

---

## 📋 Environment Variables to Configure

### Backend (.env)

**Critical:**
```bash
# Database
DATABASE_URL=postgresql://campuscuts_user:password@localhost:5432/campuscuts

# Blockchain
PETRA_PRIVATE_KEY=0x...your_key_here (NO ed25519-priv- prefix!)
APTOS_PLATFORM_ADDRESS=0x...your_address
APTOS_MODULE_ADDRESS=0x...deployed_module

# Security
JWT_SECRET=your-super-secret-jwt-key
CUSTODIAL_ENCRYPTION_SECRET=min-32-characters-secret

# Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Optional:**
```bash
REDIS_URL=redis://localhost:6379
PINATA_JWT=...
AWS_ACCESS_KEY_ID=...
```

### Frontend (.env)

```bash
# API
VITE_API_URL=http://localhost:3001/api/v1
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# Blockchain
VITE_APTOS_NETWORK=devnet
VITE_APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
VITE_APTOS_MODULE_ADDRESS=0x...same_as_backend

# Payments
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 📊 Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Environment                     │
├───────────────┬──────────────────┬───────────────────────┤
│   Frontend    │    Backend API   │    Infrastructure     │
│ (Nginx:Alpine)│ (Node 20:Alpine) │ (Postgres + Redis)    │
│               │                  │                       │
│   Port: 80    │   Port: 3001     │  Ports: 5432, 6379    │
│   ~50MB       │   ~200MB         │  ~100MB each          │
└───────┬───────┴────────┬─────────┴───────────┬───────────┘
        │                │                     │
        └────────────────┴─────────────────────┘
                         │
              ┌──────────▼───────────┐
              │  Aptos Blockchain    │
              │     (External)       │
              └──────────────────────┘
```

---

## 🛠️ Useful Commands

### Using Make (Recommended)

```bash
# View all commands
make -f Makefile.docker help

# Development
make -f Makefile.docker dev          # Start dev environment
make -f Makefile.docker logs         # View logs
make -f Makefile.docker status       # Check status

# Production
make -f Makefile.docker prod         # Start production
make -f Makefile.docker prod-logs    # View prod logs

# Individual services
make -f Makefile.docker backend      # Backend only
make -f Makefile.docker frontend     # Frontend only

# Database
make -f Makefile.docker migrate      # Run migrations
make -f Makefile.docker backup       # Backup database

# Cleanup
make -f Makefile.docker clean        # Clean up containers
```

### Using Docker Compose

```bash
# Start/Stop
docker-compose up -d                 # Start all
docker-compose down                  # Stop all
docker-compose restart               # Restart

# Logs
docker-compose logs -f               # All logs
docker-compose logs -f backend       # Backend logs
docker-compose logs -f frontend      # Frontend logs

# Status
docker-compose ps                    # Show all services

# Individual services
docker-compose up -d backend         # Backend only
docker-compose up -d frontend        # Frontend only
```

### Using Frontend Scripts

```bash
cd web-app

./deploy-docker.sh    # Complete deployment
./build-docker.sh     # Build only
./run-docker.sh       # Run only
```

---

## 🎯 Production Deployment

### AWS (EC2 or ECS)

```bash
# 1. On your EC2 instance
git clone https://github.com/your-username/CampusCuts.git
cd CampusCuts

# 2. Configure production environment
cp backend/env.example backend/.env
cp web-app/env.example web-app/.env
# Edit with production values

# 3. Deploy
docker-compose -f docker-compose.production.yml up -d

# 4. Set up SSL (optional)
sudo apt install caddy
sudo caddy reverse-proxy --from your-domain.com --to localhost:80
```

### Your VPS

Same as AWS EC2 above! Works on any Linux server with Docker.

---

## 🔍 Health Checks

The Docker setup includes automated health checks:

### Frontend Health Check
- **URL**: http://localhost/health
- **Interval**: Every 30 seconds
- **Expected**: `healthy` response

### Backend Health Check
- **URL**: http://localhost:3001/health
- **Interval**: Every 30 seconds
- **Expected**: `{"status":"ok"}` JSON response

### Check Status
```bash
# View health status
docker ps

# Or use Make
make -f Makefile.docker status
```

---

## 📚 Documentation

- **Frontend Docker Guide**: `web-app/DOCKER_DEPLOYMENT.md`
- **Full Stack Guide**: `DOCKER_DEPLOYMENT_GUIDE.md`
- **Make Commands**: Run `make -f Makefile.docker help`
- **Backend README**: `backend/README.md` (if exists)

---

## 🐛 Troubleshooting

### Backend won't start?
```bash
# Check private key format (no ed25519-priv- prefix)
cat backend/.env | grep PETRA_PRIVATE_KEY

# Should be: PETRA_PRIVATE_KEY=0x1234...
```

### Frontend can't connect to backend?
```bash
# Check API URL
cat web-app/.env | grep VITE_API_URL

# Should be: VITE_API_URL=http://localhost:3001/api/v1
# or your production URL
```

### Database errors?
```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Check connection
docker-compose exec postgres psql -U campuscuts_user -d campuscuts
```

### Reset everything?
```bash
make -f Makefile.docker reset
# or
docker-compose down -v && docker-compose up -d
```

---

## ✅ Next Steps

1. **Configure environment variables** in `backend/.env` and `web-app/.env`
2. **Deploy contracts** to Aptos (if not already done)
3. **Start services**: `make -f Makefile.docker dev` or `docker-compose up -d`
4. **Run migrations**: `make -f Makefile.docker migrate`
5. **Test application**: Visit http://localhost
6. **Deploy to production** when ready!

---

## 🎉 You're All Set!

Your CampusCuts platform is now:
- ✅ Fully Dockerized
- ✅ Ready for local development
- ✅ Ready for production deployment
- ✅ Easy to deploy with scripts or Make commands
- ✅ Monitored with health checks
- ✅ Optimized for performance
- ✅ Secure with best practices

**Need help?** Check the documentation files or run `make -f Makefile.docker help`

---

**Happy Deploying! 🚀**

