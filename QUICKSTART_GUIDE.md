# CampusCuts - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites Check

Make sure you have installed:
- ✅ Node.js 18+ (`node --version`)
- ✅ PostgreSQL 14+ (optional for full functionality)
- ✅ Redis 7+ (optional for caching)

---

## 1️⃣ Backend Setup

### Start the Backend (Development Mode)

```bash
# Navigate to backend
cd backend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

The backend will start on **http://localhost:3000**

**✅ You should see:** `🚀 CampusCuts API server running on port 3000`

### Common Backend Commands

```bash
# Development (with hot-reload)
npm run dev

# Production build
npm run build
npm start

# Run database migrations (when DB is ready)
npm run migrate

# Seed test data
npm run seed

# Run tests
npm test
```

---

## 2️⃣ Web App Setup

### Start the Web Frontend

```bash
# Navigate to web app
cd web-app

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

The web app will start on **http://localhost:5173**

**✅ You should see:** `Local: http://localhost:5173/`

### Common Web App Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Deploy to IPFS
./deploy-ipfs.sh
```

---

## 3️⃣ Database Setup (Optional)

### Using Docker (Easiest)

```bash
# From project root
docker-compose up -d postgres redis
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### Using Local PostgreSQL

```bash
# Create database
createdb campuscuts

# Run migrations
cd backend
npm run migrate
```

---

## 4️⃣ Test the Application

### Backend Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-26T...",
  "database": "connected"
}
```

### Access Web App

Open browser to: **http://localhost:5173**

You should see the CampusCuts login page!

---

## 🎯 Quick Development Workflow

### Terminal 1: Backend
```bash
cd backend
npm run dev
```

### Terminal 2: Web App
```bash
cd web-app
npm run dev
```

### Terminal 3: Database (if using Docker)
```bash
docker-compose up postgres redis
```

---

## 📝 Environment Configuration

### Backend `.env` (already created)

Located at: `backend/.env`

**Key variables to update:**

```env
# Database (if using local PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/campuscuts

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_your_key_here

# Email (for .edu verification)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password

# JWT (already set for dev)
JWT_SECRET=dev-secret-key-change-in-production
```

### Web App `.env`

Create `web-app/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
VITE_STRIPE_PUBLIC_KEY=pk_test_your_key_here
```

---

## 🔧 Troubleshooting

### Backend won't start

**Error:** `Cannot find module 'dist/index.js'`

**Solution:** Use `npm run dev` instead of `npm start`

### Database connection error

**Error:** `ECONNREFUSED postgresql://...`

**Solution:**
1. Start PostgreSQL: `docker-compose up -d postgres`
2. Or comment out DB code for now (app will run without DB)

### Redis connection error

**Solution:**
1. Start Redis: `docker-compose up -d redis`
2. Or app will continue without Redis (caching disabled)

### Port already in use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using port
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)
```

### Web app can't connect to backend

**Error:** Network errors in browser console

**Solution:**
1. Ensure backend is running on port 3000
2. Check CORS settings in `backend/.env`:
   ```env
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
   ```

---

## 📱 Testing Features

### 1. Authentication

1. Go to **http://localhost:5173/signup**
2. Create account with `.edu` email (validation is lenient in dev)
3. Select campus
4. Login

### 2. Student Flow

- Discover barbers
- View barber profiles
- Book appointments (mock for now)
- View bookings
- Send messages (requires Socket.IO)

### 3. Barber Flow

- Dashboard with stats
- Calendar (placeholder)
- Earnings (placeholder)
- Manage profile

---

## 🎨 Development Tips

### Hot Reload

Both backend and frontend support hot-reload:
- **Backend:** Nodemon watches TypeScript files
- **Frontend:** Vite HMR (instant updates)

### API Testing

Use the REST API directly:

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@university.edu",
    "password": "password123",
    "first_name": "John",
    "last_name": "Doe",
    "user_type": "student"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@university.edu",
    "password": "password123"
  }'
```

### Database GUI

Use a database client to view data:
- **TablePlus** (Mac)
- **pgAdmin** (Cross-platform)
- **DBeaver** (Open-source)

Connection:
- Host: `localhost`
- Port: `5432`
- Database: `campuscuts`
- User: `postgres`
- Password: `password`

---

## 🚀 Quick Deploy

### Web App to IPFS

```bash
cd web-app
./deploy-ipfs.sh
```

### Backend to Production

```bash
# Build
cd backend
npm run build

# Run with PM2
pm2 start dist/index.js --name campuscuts-api

# Or with Docker
docker build -t campuscuts-backend .
docker run -p 3000:3000 campuscuts-backend
```

---

## 📚 Next Steps

1. **Configure Stripe** - Get test API keys from stripe.com
2. **Set up Gmail SMTP** - For .edu email verification
3. **Deploy Aptos contracts** - Run `scripts/deploy-contracts.sh`
4. **Customize branding** - Update colors in Tailwind config
5. **Add barber data** - Use the seed script or add manually

---

## 🆘 Need Help?

- **Backend API Docs:** See `docs/API_DOCUMENTATION.md` (if exists)
- **Architecture:** See `OVERVIEW.md`
- **Web Frontend:** See `web-app/README.md`

---

## ✅ Checklist

Development environment ready when:

- [ ] Backend running on port 3000
- [ ] Web app running on port 5173
- [ ] Can access login page
- [ ] Database connected (optional)
- [ ] Redis connected (optional)

**You're all set! Start building! 🎉**

