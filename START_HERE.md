# 🚀 START HERE - CampusCuts

Welcome to **CampusCuts**! This is your starting point.

---

## ⚡ Quick Start (Choose Your Path)

### 👨‍💻 I Want to Start Developing NOW

```bash
make setup
make start
```

Then read: `QUICKSTART.md`

---

### 📖 I Want to Understand the Project First

Read in this order:
1. `README.md` - Project overview
2. `docs/MVP_SPECIFICATION.md` - What we're building
3. `docs/ARCHITECTURE.md` - How it works
4. `docs/GETTING_STARTED.md` - Setup guide

---

### 🎯 I Want to See What Was Built

Read: `PROJECT_SUMMARY.md`

**TL;DR**: Fully functional decentralized barber booking platform with:
- ✅ Aptos smart contracts (4 modules)
- ✅ Backend API (Node.js/TypeScript)
- ✅ iOS app (SwiftUI)
- ✅ Database schema (PostgreSQL)
- ✅ Payment integration (Stripe)
- ✅ Complete documentation

---

### 🚢 I Want to Deploy This

Read: `docs/DEPLOYMENT.md`

**Quick deploy for testing**:
```bash
make init-aptos
make deploy-contracts-devnet
cd backend && npm run dev
```

---

## 📁 Project Structure

```
CampusCuts/
├── contracts/          ← Aptos smart contracts
├── backend/           ← Node.js API server
├── ios-app/           ← iOS SwiftUI app
├── docs/              ← Documentation
├── scripts/           ← Utility scripts
└── .github/           ← CI/CD workflows
```

---

## 🎓 What is CampusCuts?

**CampusCuts** is a decentralized barber booking platform for college campuses that:

- Connects student barbers with clients
- Uses blockchain for transparency (Aptos)
- Charges only 5% commission (vs 20-30% industry standard)
- Provides instant payouts
- Requires zero crypto knowledge

**Think**: "Uber for campus barbers, but decentralized"

---

## 🔑 Key Features

### For Students
- 📱 Browse barbers by campus
- 🔍 Filter by rating, price, style
- 📅 Book appointments easily
- 💳 Pay with credit/debit card
- ⭐ Leave reviews

### For Barbers
- 📊 Business dashboard
- 💰 Instant payouts (95% of booking)
- 📸 Portfolio management
- 📆 Schedule control
- 📈 Analytics & insights

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Aptos (Move) |
| **Backend** | Node.js + TypeScript + Express |
| **Database** | PostgreSQL + PostGIS |
| **Mobile** | iOS (SwiftUI) |
| **Payments** | Stripe Connect |
| **Storage** | AWS S3 |
| **Notifications** | Firebase |

---

## 📋 Prerequisites

Before starting, install:

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
3. **Aptos CLI** - [Install Guide](https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli/)
4. **Xcode 15+** (macOS only) - [Download](https://developer.apple.com/xcode/)

Optional but recommended:
- PostgreSQL (or use Docker)
- Git

---

## ⏱️ Time Estimates

- **Read overview**: 15 minutes
- **Initial setup**: 10 minutes
- **First deployment**: 15 minutes
- **Test all features**: 30 minutes
- **Full understanding**: 2-3 hours

---

## 🎯 What You Can Do Right Now

### 1. Explore the Code (5 minutes)

```bash
# Smart contracts
cat contracts/sources/booking_system.move

# Backend API
cat backend/src/index.ts

# iOS app
cat ios-app/CampusCuts/ContentView.swift
```

### 2. Set Up Environment (10 minutes)

```bash
make setup
```

### 3. Start Everything (5 minutes)

```bash
make start
cd backend && npm run seed
```

Test credentials:
- Student: `student@harvard.edu` / `password123`
- Barber: `barber1@harvard.edu` / `password123`

### 4. Test the API (2 minutes)

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@harvard.edu","password":"password123"}'

# Get barbers
curl http://localhost:3000/api/barbers?campusId=1
```

### 5. Run the iOS App (5 minutes)

```bash
cd ios-app
pod install
open CampusCuts.xcworkspace
```

Press ⌘R to build and run!

---

## 📚 Documentation Quick Links

| Document | Purpose |
|----------|---------|
| `QUICKSTART.md` | 10-minute setup guide |
| `PROJECT_SUMMARY.md` | What was built |
| `docs/MVP_SPECIFICATION.md` | Product requirements |
| `docs/ARCHITECTURE.md` | System design |
| `docs/API_DOCUMENTATION.md` | API reference |
| `docs/DEPLOYMENT.md` | Production deployment |
| `CONTRIBUTING.md` | How to contribute |

---

## 🆘 Common Issues

### "make: command not found"
```bash
# macOS: Install Xcode Command Line Tools
xcode-select --install
```

### "Docker not running"
- Start Docker Desktop application

### "Port 3000 in use"
```bash
lsof -ti:3000 | xargs kill -9
make start
```

### Need more help?
- Check `docs/GETTING_STARTED.md`
- Open GitHub Issue
- Email: dev@campuscuts.com

---

## 🎉 You're All Set!

The entire CampusCuts platform has been built and is ready to run.

**Choose your next step:**
- 🏃 **Jump right in**: `make setup && make start`
- 📖 **Learn first**: Read `QUICKSTART.md`
- 🔍 **Explore code**: Browse `contracts/`, `backend/`, `ios-app/`
- 📝 **Understand design**: Read `docs/ARCHITECTURE.md`

---

## 💬 Questions?

Don't hesitate to:
- Open a GitHub Issue
- Read the documentation
- Email dev@campuscuts.com

---

**Happy building! ✂️📱**

*Everything you need is here. The rest is execution!*

