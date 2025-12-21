# 🔧 CampusCuts - Minimal Build Fix

This directory contains scripts to create a **minimal working base website** that builds successfully, ignoring TypeScript errors and missing features. This allows you to deploy the frontend in Docker first, then incrementally add features back.

---

## 🎯 Problem

The full CampusCuts web-app has:
- Complex routing with many pages
- TypeScript strict mode enabled
- Dependencies on backend services
- Missing type definitions
- Build errors preventing deployment

---

## ✨ Solution

The `fix-build.sh` script creates a **minimal base website** that:
- ✅ Builds successfully
- ✅ Runs in Docker
- ✅ Shows system status
- ✅ Maintains all routes (for future use)
- ✅ Backs up original files (easy to restore)

---

## 🚀 Quick Start

### Step 1: Fix the Build

```bash
cd ~/Desktop/CampusCuts/web-app

# Run the fix script
./fix-build.sh
```

**What it does:**
1. Creates backups of original files (`.backup` extension)
2. Adds missing routes (LOGIN, SIGNUP, CAMPUS_SELECT)
3. Replaces App.tsx with minimal version
4. Disables TypeScript strict mode
5. Tests the build

### Step 2: Test Locally

```bash
npm run dev
```

Visit http://localhost:3000 - you should see a clean base website!

### Step 3: Deploy to Docker

```bash
# Make sure .env is configured
cp env.example .env
nano .env  # Add your EC2 IP and keys

# Deploy
./deploy-docker.sh
```

---

## 📦 What Gets Changed

### 1. `src/config/constants.ts`
**Added missing routes:**
```typescript
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',           // ← ADDED
  SIGNUP: '/signup',         // ← ADDED
  CAMPUS_SELECT: '/campus-select',  // ← ADDED
  // ... all other routes
}
```

### 2. `src/App.tsx`
**Replaced with minimal version:**
```typescript
// Simple component showing:
// - App name and version
// - System status
// - Available routes
// - No complex dependencies
```

### 3. `tsconfig.app.json`
**Disabled strict checks:**
```json
{
  "strict": false,              // ← Was true
  "noUnusedLocals": false,      // ← Was true
  "noUnusedParameters": false,  // ← Was true
}
```

---

## 🔄 Restoring Original Files

If you want to go back to the full app:

```bash
./restore-original.sh
```

This restores:
- `src/App.tsx`
- `tsconfig.app.json`
- `src/config/constants.ts`

---

## 📊 What the Minimal Site Shows

The base website displays:

### Header
- App name (CampusCuts)
- Version number
- Build success indicator ✅

### System Status
- App version
- Backend API URL
- Environment (development/production)

### Available Routes
- List of all configured routes
- Ready for incremental implementation

### Footer
- Deployment success message
- Next steps guidance

---

## 🎨 Appearance

The minimal site uses:
- **Tailwind CSS** (same as full app)
- **Clean, professional design**
- **Responsive layout**
- **Green "Build Successful" badge**

---

## 📁 File Structure

```
web-app/
├── fix-build.sh              ← Fix script (run this)
├── restore-original.sh       ← Restore script
├── MINIMAL_BUILD_README.md   ← This file
│
├── src/
│   ├── App.tsx              ← Simplified version
│   ├── App.tsx.backup       ← Original (created by script)
│   │
│   └── config/
│       ├── constants.ts     ← With missing routes added
│       └── constants.ts.backup  ← Original
│
└── tsconfig.app.json        ← Relaxed TypeScript
    └── tsconfig.app.json.backup  ← Original
```

---

## 🔍 Troubleshooting

### Script says "npm run build" failed

Check the error output. Common issues:
- Missing `node_modules`: Run `npm install`
- Port already in use: Stop other dev servers
- Environment variables: Check `.env` file

### Docker build fails

Make sure you have a `.env` file:
```bash
cp env.example .env
nano .env  # Configure with your values
```

### Can't access at http://localhost

Check Docker is running:
```bash
docker ps | grep campuscuts-frontend
```

---

## ✅ Next Steps After Minimal Deploy

Once the minimal site is running in Docker:

### 1. Verify Deployment
```bash
# Check frontend
curl http://localhost/health

# Check it's serving
open http://localhost
```

### 2. Connect to Backend
Make sure `.env` has your EC2 IP:
```bash
VITE_API_URL=http://13.57.186.52:3001/api/v1
```

### 3. Add Features Back Incrementally

Restore one page at a time:

**Example - Add Landing Page:**
```typescript
// In App.tsx, uncomment:
import LandingPage from './pages/LandingPage';

// Add route:
<Route path="/" element={<LandingPage />} />
```

**Test after each addition:**
```bash
npm run build  # Make sure it still builds
```

### 4. Re-enable TypeScript Checks Gradually

Once stable, restore strict mode in `tsconfig.app.json`:
```json
{
  "strict": true,
  "noUnusedLocals": true
}
```

Fix errors one file at a time.

---

## 🎯 Deployment Checklist

- [ ] Run `./fix-build.sh` successfully
- [ ] Test with `npm run dev` (should see base site)
- [ ] Configure `.env` with EC2 IP
- [ ] Run `./deploy-docker.sh`
- [ ] Verify at http://localhost
- [ ] Check backend connectivity
- [ ] (Optional) Start adding features back

---

## 📚 Related Documentation

- **Docker Deployment**: See `DOCKER_DEPLOYMENT.md`
- **Full Stack Guide**: See `../DOCKER_DEPLOYMENT_GUIDE.md`
- **Environment Setup**: See `env.example`

---

## 💡 Tips

1. **Keep backups**: The script creates `.backup` files - don't delete them
2. **Test incrementally**: Add one feature at a time
3. **Check build after changes**: Run `npm run build` frequently
4. **Use Docker for testing**: `docker-compose up -d` is fast
5. **Version control**: Commit working states as you add features

---

## 🆘 Need Help?

1. **Build fails**: Check script output for specific errors
2. **Docker issues**: See `DOCKER_DEPLOYMENT.md`
3. **Backend connectivity**: Verify EC2 security group allows port 3001
4. **Restore needed**: Run `./restore-original.sh`

---

**🎉 You're ready to deploy a working base website!**

Run `./fix-build.sh` to get started! 🚀

