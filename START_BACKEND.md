# Start Backend - Simple Instructions

## ✅ The TypeScript error is now FIXED!

The `lazyConnect` Redis option has been removed.

---

## 🚀 Two Ways to Start

### Option 1: With Docker (Full Features)

**Start all services:**
```bash
# From project root
docker-compose up -d

# Then start backend
cd backend
npm run dev
```

This starts:
- PostgreSQL (database)
- Redis (caching)
- Backend API

---

### Option 2: Backend Only (No Database)

The backend will run **without PostgreSQL and Redis**, but some features won't work:

```bash
cd backend
npm run dev
```

**Expected behavior:**
- ✅ Server will start on port 3000
- ⚠️ Redis connection will fail (gracefully)
- ⚠️ Database queries will fail (gracefully)
- ✅ Basic routes will work

---

## 🧪 Test the Backend

Once running, test with:

```bash
curl http://localhost:3000/health
```

**Expected response (without DB):**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-11-26T...",
  "database": "disconnected"
}
```

**Expected response (with DB):**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-26T...",
  "database": "connected"
}
```

---

## 📊 What Works Without Database?

Even without PostgreSQL/Redis, you can still:
- ✅ Start the server
- ✅ Test API structure
- ✅ Work on frontend integration
- ✅ Test routes (they'll return errors gracefully)

To use **full features**, you need the database.

---

## 🐳 Quick Docker Setup

```bash
# Install Docker Desktop (if not installed)
# https://www.docker.com/products/docker-desktop

# Start services
docker-compose up -d postgres redis

# Check they're running
docker ps

# Stop services when done
docker-compose down
```

---

## 🔧 Troubleshooting

### "Port 3000 already in use"

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### "Cannot find module"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "TypeScript errors"

The Redis error is fixed! If you see other TS errors:

```bash
# Pull latest code
git pull origin main

# Clean and reinstall
npm install
```

---

## ✅ Current Status

- ✅ TypeScript compilation error **FIXED**
- ✅ Redis configuration **FIXED**
- ✅ Backend ready to run
- ⚠️ Needs PostgreSQL + Redis for full functionality
- ✅ Can run without database (limited features)

---

## 🎯 Recommended Workflow

**For Full Development:**
```bash
# Terminal 1: Services
docker-compose up

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: Web App
cd web-app
npm run dev
```

**For Quick Testing (no DB):**
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Web App
cd web-app
npm run dev
```

---

**The backend is ready to run! Just choose your setup (with or without Docker). 🚀**

