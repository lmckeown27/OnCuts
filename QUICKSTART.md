# CampusCuts Quick Start Guide

Get CampusCuts running in **under 10 minutes**!

## Prerequisites

Install these first:
- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Aptos CLI](https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli/)
- [Xcode 15+](https://developer.apple.com/xcode/) (macOS only, for iOS)

## Setup Steps

### 1. Clone & Setup (2 minutes)

```bash
git clone https://github.com/lmckeown27/CampusCuts.git
cd CampusCuts
make setup
```

### 2. Configure Environment (2 minutes)

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add:
- Your Stripe test keys from [dashboard.stripe.com](https://dashboard.stripe.com)
- Keep other defaults for local development

### 3. Start Services (2 minutes)

```bash
# From project root
make start
```

This starts:
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ Backend API (http://localhost:3000)

### 4. Deploy Smart Contracts (2 minutes)

```bash
make init-aptos
make deploy-contracts-devnet
```

### 5. Seed Database (1 minute)

```bash
cd backend
npm run seed
```

Test credentials:
- Student: `student@harvard.edu` / `password123`
- Barber: `barber1@harvard.edu` / `password123`

### 6. Run iOS App (1 minute)

```bash
cd ios-app
pod install
open CampusCuts.xcworkspace
```

Press ⌘R in Xcode to build and run.

---

## Verify Setup

### Test Backend
```bash
curl http://localhost:3000/health
```

Should return:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@harvard.edu",
    "password": "password123"
  }'
```

Should return a JWT token.

---

## Common Commands

```bash
make help           # Show all commands
make start          # Start dev environment
make stop           # Stop all services
make test           # Run all tests
make db-reset       # Reset database
make logs-backend   # View backend logs
```

---

## Next Steps

1. **Explore the app** - Login with test credentials
2. **Read the docs** - Check `docs/MVP_SPECIFICATION.md`
3. **View API docs** - See `docs/API_DOCUMENTATION.md`
4. **Start coding** - See `CONTRIBUTING.md`

---

## Troubleshooting

### "Port 3000 already in use"

```bash
lsof -ti:3000 | xargs kill -9
```

### "Database connection failed"

```bash
docker-compose restart postgres
```

### "Aptos CLI not found"

```bash
curl -fsSL https://aptos.dev/scripts/install_cli.py | python3
```

### iOS build fails

```bash
cd ios-app
rm -rf Pods DerivedData
pod install
```

---

## Need Help?

- 📚 Docs: `docs/` directory
- 🐛 Issues: [GitHub Issues](https://github.com/lmckeown27/CampusCuts/issues)
- 📧 Email: dev@campuscuts.com

---

**Total Setup Time: ~10 minutes** ⏱️

Happy coding! ✂️

