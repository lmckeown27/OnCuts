# CampusCuts Configuration Guide

## Overview

CampusCuts can run in multiple modes depending on which services are configured:

1. **Blockchain-Only Mode** (Minimal) - No PostgreSQL required
2. **Hybrid Mode** (Recommended) - PostgreSQL + Blockchain for better performance
3. **Full Mode** (Production) - All services enabled

---

## Required Configuration

### 1. Aptos Blockchain (REQUIRED)

```env
APTOS_NETWORK=devnet
APTOS_PLATFORM_ADDRESS=0x...
APTOS_PRIVATE_KEY=0x...
```

**How to get**:
```bash
# Install Aptos CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# Create account
aptos init

# Get your address and private key from .aptos/config.yaml
```

### 2. JWT Secret (REQUIRED)

```env
JWT_SECRET=your-secret-key-here
```

**Generate**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Optional Configuration

### PostgreSQL (Recommended for Production)

**Why**: Better performance, analytics, caching

**Setup**:
```bash
# Install PostgreSQL
brew install postgresql  # Mac
# or
sudo apt install postgresql  # Linux

# Start PostgreSQL
brew services start postgresql  # Mac
# or
sudo systemctl start postgresql  # Linux

# Create database
createdb campuscuts

# Add to .env
DATABASE_URL=postgresql://localhost:5432/campuscuts
```

**Run migrations**:
```bash
cd backend
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -f migrations/002_admin_features.sql
psql $DATABASE_URL -f migrations/003_payment_system.sql
psql $DATABASE_URL -f migrations/004_capitalistic_marketplace.sql
psql $DATABASE_URL -f migrations/005_booking_requests.sql
```

**Without PostgreSQL**: System runs in blockchain-only mode (slower but functional)

---

### Gas Wallet Monitoring (Optional)

**Why**: Automated alerts when gas wallet balance is low

```env
GAS_WALLET_ADDRESS=0x...
GAS_ALERT_THRESHOLD_APT=5
```

**Without this**: Gas monitoring disabled, no automatic alerts

---

### Stripe Payments (Optional)

**Why**: Fiat payments, barber payouts

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Setup**:
1. Go to https://stripe.com
2. Create account
3. Get API keys from dashboard

**Without this**: Only crypto payments work

---

### Email Notifications (Optional)

**Why**: Send booking confirmations, alerts

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Setup for Gmail**:
1. Enable 2FA on Google account
2. Generate app password
3. Use app password in SMTP_PASS

**Without this**: No email notifications

---

### AI Worker (Optional)

**Why**: Dynamic pricing, fraud detection, automated insights

```env
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379
```

**Without this**: No AI features, static pricing only

---

## Minimal Setup (Quick Start)

For development/testing, you only need:

```env
# Required
APTOS_NETWORK=devnet
APTOS_PLATFORM_ADDRESS=0x... # From aptos init
APTOS_PRIVATE_KEY=0x...      # From aptos init
JWT_SECRET=generate-a-random-string

# Optional (for development)
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

**This is enough to run the app in blockchain-only mode!**

---

## Recommended Production Setup

```env
# Core
PORT=3001
NODE_ENV=production
APTOS_NETWORK=mainnet
APTOS_PLATFORM_ADDRESS=0x...
APTOS_PRIVATE_KEY=0x...
JWT_SECRET=secure-random-string

# Performance (PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/campuscuts

# Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Monitoring
GAS_WALLET_ADDRESS=0x...
GAS_ALERT_THRESHOLD_APT=10

# Notifications
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG....

SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Security
ALLOWED_ORIGINS=https://campuscuts.com
```

---

## Feature Availability by Mode

| Feature | Blockchain-Only | Hybrid | Full |
|---------|----------------|--------|------|
| User Accounts | ✅ | ✅ | ✅ |
| Bookings | ✅ | ✅ | ✅ |
| Reviews | ✅ | ✅ | ✅ |
| Crypto Payments | ✅ | ✅ | ✅ |
| Fiat Payments | ❌ | ❌ | ✅ (Stripe) |
| Fast Queries | ⚠️ Slow | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ |
| BQS/Marketplace | ❌ | ✅ | ✅ |
| Gas Monitoring | ❌ | ✅ | ✅ |
| AI Features | ❌ | ❌ | ✅ (OpenAI) |
| Email Notifications | ❌ | ❌ | ✅ (SMTP) |
| Push Notifications | ❌ | ❌ | ✅ (Firebase) |

---

## Troubleshooting

### PostgreSQL Connection Errors

**Error**: `database "liammckeown" does not exist`

**Solution**:
```bash
# Option 1: Create the database
createdb campuscuts
# Update DATABASE_URL to point to campuscuts

# Option 2: Remove DATABASE_URL from .env
# System will run in blockchain-only mode
```

### Gas Wallet Errors

**Error**: `GAS_WALLET_ADDRESS not configured`

**Solution**:
```bash
# Option 1: Set GAS_WALLET_ADDRESS in .env
GAS_WALLET_ADDRESS=0x...

# Option 2: Ignore (gas monitoring is optional)
# The warning is harmless
```

### Marketplace Cron Errors

**Error**: Marketplace cron jobs failing

**Solution**:
- Ensure PostgreSQL is running and configured
- Run marketplace migration: `migrations/004_capitalistic_marketplace.sql`
- Or remove DATABASE_URL to disable (marketplace features won't work)

---

## Quick Setup Script

```bash
#!/bin/bash

# 1. Install dependencies
cd backend
npm install

cd ../web-app
npm install

# 2. Setup Aptos
cd ..
aptos init

# 3. Create .env
cat > backend/.env << EOL
APTOS_NETWORK=devnet
APTOS_PLATFORM_ADDRESS=$(cat .aptos/config.yaml | grep account | awk '{print $2}')
APTOS_PRIVATE_KEY=$(cat .aptos/config.yaml | grep private_key | awk '{print $2}')
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
PORT=3001
NODE_ENV=development
EOL

# 4. Start backend
cd backend
npm run dev &

# 5. Start frontend
cd ../web-app
npm run dev
```

---

## Summary

**Minimal (Dev)**: Just Aptos + JWT → Blockchain-only mode  
**Recommended (Prod)**: + PostgreSQL → Hybrid mode (faster)  
**Full (Enterprise)**: + All services → All features enabled

Start minimal, add services as needed!

