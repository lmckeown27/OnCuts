# 🐳 CampusCuts Frontend - Docker Deployment Guide

Complete guide for deploying the CampusCuts frontend using Docker.

---

## 📋 Prerequisites

- **Docker** 20.10+ installed ([Get Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.0+ (included with Docker Desktop)
- Backend API running and accessible
- Environment variables configured

---

## 🚀 Quick Start

### 1. Configure Environment Variables

```bash
# Copy example environment file
cp env.example .env

# Edit with your production values
nano .env
```

**Required Variables:**
```bash
VITE_API_URL=http://your-backend-api.com/api/v1
VITE_API_BASE_URL=http://your-backend-api.com
VITE_WS_URL=ws://your-backend-api.com
VITE_APTOS_MODULE_ADDRESS=0x...your_module_address
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 2. Build and Deploy (One Command)

```bash
./deploy-docker.sh
```

This script will:
- ✅ Check Docker installation
- ✅ Load environment variables
- ✅ Build the Docker image
- ✅ Stop old container (if running)
- ✅ Start new container
- ✅ Show deployment status

---

## 📦 Manual Deployment

### Build Image

```bash
./build-docker.sh
```

**What it does:**
- Loads `.env` variables
- Builds multi-stage Docker image
- Tags with version and `latest`
- Optimized production build

### Run Container

```bash
./run-docker.sh
```

**What it does:**
- Stops existing container (if any)
- Starts new container
- Maps port 80
- Sets restart policy
- Shows container status

---

## 🔧 Docker Commands Reference

### Container Management

```bash
# Start container
docker start campuscuts-frontend

# Stop container
docker stop campuscuts-frontend

# Restart container
docker restart campuscuts-frontend

# Remove container
docker rm campuscuts-frontend

# View container status
docker ps | grep campuscuts-frontend
```

### Logs & Debugging

```bash
# View logs (live)
docker logs -f campuscuts-frontend

# View last 100 lines
docker logs --tail 100 campuscuts-frontend

# Access container shell
docker exec -it campuscuts-frontend sh

# Check Nginx configuration
docker exec campuscuts-frontend nginx -t
```

### Image Management

```bash
# List images
docker images | grep campuscuts-frontend

# Remove old images
docker image prune -a

# Tag for registry
docker tag campuscuts-frontend:latest your-registry/campuscuts-frontend:v1.0.0

# Push to registry
docker push your-registry/campuscuts-frontend:v1.0.0
```

---

## 🐙 Docker Compose Deployment

### Development Environment

```bash
# Start all services (backend + frontend + database)
docker-compose up -d

# Start only frontend
docker-compose up -d frontend

# View logs
docker-compose logs -f frontend

# Stop all services
docker-compose down
```

### Production Environment

```bash
# Use production compose file
docker-compose -f docker-compose.production.yml up -d

# View status
docker-compose -f docker-compose.production.yml ps

# Stop
docker-compose -f docker-compose.production.yml down
```

---

## 🌐 Accessing the Application

### Local Development
- **Frontend**: http://localhost
- **Health Check**: http://localhost/health

### Production
- Configure your domain to point to server IP
- Set up reverse proxy (Nginx/Caddy) with SSL
- Use environment variables for production URLs

---

## 🏗️ Build Architecture

### Multi-Stage Build Process

```
┌─────────────────────────────────────┐
│  Stage 1: Builder (Node 20 Alpine)  │
├─────────────────────────────────────┤
│  • Install dependencies             │
│  • Copy source code                 │
│  • Build with Vite                  │
│  • Output: /app/dist                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Stage 2: Runtime (Nginx Alpine)    │
├─────────────────────────────────────┤
│  • Copy built assets                │
│  • Configure Nginx                  │
│  • Set up health checks             │
│  • Security hardening               │
└─────────────────────────────────────┘
```

**Benefits:**
- 🚀 Small final image (~50MB vs 1GB+)
- 🔒 Production-only dependencies
- ⚡ Fast startup time
- 🛡️ Security hardening

---

## 📊 Monitoring & Health Checks

### Built-in Health Check

The Docker container includes an automated health check:

```bash
# Manual health check
curl http://localhost/health

# Expected response:
# healthy
```

### Container Health Status

```bash
# View health status
docker inspect campuscuts-frontend --format='{{.State.Health.Status}}'

# Possible values:
# - starting  (warming up)
# - healthy   (running well)
# - unhealthy (failing checks)
```

---

## 🔒 Security Best Practices

### Image Security

1. **Non-root user**: Container runs as `nginx` user (not root)
2. **Minimal base**: Alpine Linux (minimal attack surface)
3. **No secrets in image**: All secrets via environment variables
4. **Security headers**: Configured in `nginx.conf`

### Nginx Security Headers

```nginx
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: no-referrer-when-downgrade
```

### Environment Variables

**✅ DO:**
- Use `.env` files (gitignored)
- Use secrets management (AWS Secrets Manager, Vault)
- Rotate keys regularly

**❌ DON'T:**
- Commit `.env` to Git
- Hard-code API keys
- Use production keys in development

---

## 🚨 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs campuscuts-frontend

# Common issues:
# - Port 80 already in use
# - Missing environment variables
# - Build errors
```

**Solution:**
```bash
# Use different port
docker run -p 8080:80 campuscuts-frontend:latest

# Check what's using port 80
sudo lsof -i :80
```

### Build Fails

```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -t campuscuts-frontend:latest .
```

### Container Unhealthy

```bash
# Check Nginx status
docker exec campuscuts-frontend nginx -s reload

# Check Nginx config
docker exec campuscuts-frontend nginx -t

# View Nginx error logs
docker exec campuscuts-frontend cat /var/log/nginx/error.log
```

### Can't Connect to Backend

**Check environment variables:**
```bash
docker exec campuscuts-frontend env | grep VITE
```

**Rebuild with correct API URL:**
```bash
# Update .env
nano .env

# Rebuild
./build-docker.sh
./run-docker.sh
```

---

## 📈 Performance Optimization

### Nginx Caching

Static assets are cached for 1 year:
```nginx
location ~* \.(js|css|png|jpg|svg|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Gzip Compression

All text-based files are gzipped:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

### Build Optimizations

- Tree-shaking (removes unused code)
- Code splitting (lazy load routes)
- Minification (reduces file size)
- Asset optimization (image compression)

---

## 🌍 Production Deployment Options

### Option 1: AWS ECS (Fargate)

```bash
# Build for ARM64 (AWS Graviton)
docker buildx build --platform linux/arm64 -t campuscuts-frontend:latest .

# Push to ECR
aws ecr get-login-password --region us-west-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-west-1.amazonaws.com
docker tag campuscuts-frontend:latest your-account.dkr.ecr.us-west-1.amazonaws.com/campuscuts-frontend:latest
docker push your-account.dkr.ecr.us-west-1.amazonaws.com/campuscuts-frontend:latest
```

### Option 2: DigitalOcean App Platform

```bash
# Use their built-in Docker support
# Just push to GitHub, they handle the rest
```

### Option 3: Your Own VPS

```bash
# On your server
git clone your-repo
cd web-app
./deploy-docker.sh

# Set up reverse proxy with Caddy (auto-SSL)
caddy reverse-proxy --from your-domain.com --to localhost:80
```

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Vite Build Guide](https://vitejs.dev/guide/build.html)
- [CampusCuts Main README](../README.md)

---

## 🆘 Support

If you encounter issues:

1. **Check logs**: `docker logs campuscuts-frontend`
2. **Health check**: `curl http://localhost/health`
3. **Verify env vars**: Review `.env` file
4. **Rebuild fresh**: `docker system prune -a` then rebuild

---

**Made with ❤️ by CampusCuts Team**

