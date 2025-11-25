# Getting Started with CampusCuts

Welcome to CampusCuts! This guide will help you set up your development environment and start building.

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/lmckeown27/CampusCuts.git
cd CampusCuts
```

### 2. Run Setup Script

```bash
chmod +x scripts/setup.sh
make setup
```

This will:
- Check prerequisites
- Install dependencies
- Create configuration files
- Set up the database

### 3. Configure Environment

Edit `backend/.env` with your credentials:

```bash
cp backend/.env.example backend/.env
nano backend/.env  # or use your preferred editor
```

Required configurations:
- Database credentials
- JWT secrets
- Stripe API keys (get from [stripe.com](https://stripe.com))
- AWS credentials (for S3)
- Firebase credentials (for push notifications)

### 4. Initialize Aptos

```bash
make init-aptos
```

This creates Aptos profiles for devnet and testnet.

### 5. Deploy Smart Contracts

```bash
make deploy-contracts-devnet
```

### 6. Start Development Environment

```bash
make start
```

This starts:
- PostgreSQL database (Docker)
- Redis cache (Docker)
- Backend API server (http://localhost:3000)

### 7. Open iOS App

```bash
cd ios-app
pod install
open CampusCuts.xcworkspace
```

Then build and run in Xcode (⌘R).

---

## Development Workflow

### Daily Development

1. **Start services:**
   ```bash
   make start
   ```

2. **Backend development:**
   ```bash
   cd backend
   npm run dev  # Auto-reloads on changes
   ```

3. **iOS development:**
   - Open in Xcode
   - Build and run on simulator

4. **Test changes:**
   ```bash
   make test
   ```

### Working with Smart Contracts

#### Compile contracts:
```bash
cd contracts
aptos move compile --skip-fetch-latest-git-deps
```

#### Run tests:
```bash
aptos move test --skip-fetch-latest-git-deps
```

#### Deploy to devnet:
```bash
make deploy-contracts-devnet
```

### Database Management

#### Reset database:
```bash
make db-reset
```

#### Run migrations:
```bash
cd backend
npm run migrate
```

#### View database:
```bash
docker-compose exec postgres psql -U postgres -d campuscuts
```

---

## Project Structure

```
CampusCuts/
├── contracts/              # Aptos Move smart contracts
│   ├── sources/
│   │   ├── booking_system.move
│   │   ├── review_system.move
│   │   ├── barber_registry.move
│   │   └── payment_system.move
│   └── Move.toml
│
├── backend/                # Node.js/TypeScript API
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation, etc.
│   │   ├── database/       # DB connection & schema
│   │   └── index.ts        # Entry point
│   └── package.json
│
├── ios-app/                # iOS SwiftUI app
│   ├── CampusCuts/
│   │   ├── Models/         # Data models
│   │   ├── Views/          # UI components
│   │   │   ├── Student/    # Student-facing views
│   │   │   ├── Barber/     # Barber-facing views
│   │   │   └── Shared/     # Shared components
│   │   ├── ViewModels/     # View models (MVVM)
│   │   ├── Services/       # API & network layer
│   │   └── Utilities/      # Helpers & constants
│   └── Podfile
│
├── docs/                   # Documentation
│   ├── MVP_SPECIFICATION.md
│   ├── ARCHITECTURE.md
│   ├── API_DOCUMENTATION.md
│   └── DEPLOYMENT.md
│
└── scripts/                # Utility scripts
    ├── setup.sh
    ├── deploy-contracts.sh
    └── start-dev.sh
```

---

## Key Concepts

### Hybrid Architecture

CampusCuts uses a hybrid architecture:

**On-Chain (Aptos Blockchain):**
- Booking records
- Payment transactions
- Reviews & ratings
- Barber metadata

**Off-Chain (PostgreSQL):**
- User profiles
- Portfolio images
- Chat messages
- Notifications
- Analytics

### Custodial Wallets

- Platform manages Aptos wallets for users
- Users never see cryptocurrency
- Platform pays all gas fees
- Web2-like user experience with Web3 benefits

### Payment Flow

1. Student books → Stripe payment intent created (manual capture)
2. Payment held in escrow
3. Barber completes service → Payment captured
4. Platform records on blockchain
5. Instant payout to barber (minus 5% fee)

---

## Testing

### Run all tests:
```bash
make test
```

### Test individual components:

**Smart contracts:**
```bash
cd contracts && aptos move test
```

**Backend:**
```bash
cd backend && npm test
```

**iOS:** 
Use Xcode's test navigator (⌘U)

---

## Troubleshooting

### Database connection failed

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart database
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### Aptos CLI issues

```bash
# Reinstall Aptos CLI
curl -fsSL https://aptos.dev/scripts/install_cli.py | python3

# Verify installation
aptos --version
```

### iOS build fails

```bash
# Clean build folder
cd ios-app
rm -rf DerivedData

# Reinstall pods
pod deintegrate
pod install
```

### Backend won't start

```bash
# Check environment variables
cat backend/.env

# Reinstall dependencies
cd backend
rm -rf node_modules
npm install
```

---

## Next Steps

1. **Read the MVP Specification:** `docs/MVP_SPECIFICATION.md`
2. **Review the Architecture:** `docs/ARCHITECTURE.md`
3. **Explore the API:** `docs/API_DOCUMENTATION.md`
4. **Join our Discord:** [Link TBD]
5. **Read Contributing Guidelines:** `CONTRIBUTING.md`

---

## Getting Help

- **Documentation:** `docs/` directory
- **Issues:** [GitHub Issues](https://github.com/lmckeown27/CampusCuts/issues)
- **Email:** dev@campuscuts.com

Happy coding! ✂️

