# 🔑 CampusCuts - Complete API Keys & Configuration Guide

**Last Updated:** December 21, 2024  
**Platform:** CampusCuts - Blockchain-Powered Campus Barbershop Platform

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start Checklist](#quick-start-checklist)
3. [Required API Keys](#required-api-keys)
4. [Optional API Keys](#optional-api-keys)
5. [Configuration Files](#configuration-files)
6. [Security Best Practices](#security-best-practices)
7. [Cost Analysis](#cost-analysis)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

CampusCuts uses a **hybrid blockchain + traditional architecture** requiring multiple API keys and services:

- **Blockchain:** Aptos (source of truth for all data)
- **Database:** PostgreSQL (cache layer for fast queries)
- **File Storage:** IPFS via Pinata (decentralized image hosting)
- **Payments:** Stripe (fiat on-ramp) + USDC (blockchain payments)
- **Notifications:** Email (SMTP), Push (Firebase/APN)

---

## ✅ Quick Start Checklist

### **Minimum to Run Locally (Development)**

```bash
✅ REQUIRED:
[ ] PostgreSQL database (local install)
[ ] Redis (optional but recommended)
[ ] JWT_SECRET (any random string)
[ ] Aptos wallet (Petra Wallet private key)

⚠️ OPTIONAL (but needed for full functionality):
[ ] Stripe keys (for payments)
[ ] Pinata keys (for image uploads)
[ ] Circle API key (for USDC conversions)
[ ] SMTP credentials (for emails)
```

### **Production Deployment (All Features)**

All keys in the [Required](#required-api-keys) and most [Optional](#optional-api-keys) sections.

---

## 🔴 Required API Keys

### 1. **Aptos Blockchain Configuration**

#### **PETRA_PRIVATE_KEY** (formerly APTOS_PLATFORM_PRIVATE_KEY)
- **What:** Private key for your Aptos blockchain wallet
- **Purpose:** Signs all blockchain transactions on behalf of the platform
- **Where to Get:** 
  1. Install [Petra Wallet](https://petra.app/) browser extension
  2. Create new wallet or import existing
  3. Export private key from Petra settings
  4. **CRITICAL:** Remove the `ed25519-priv-` prefix if present
- **Format:** `0x1234567890abcdef...` (64-66 character hex string)
- **Cost:** FREE (Aptos devnet faucet provides free test APT)
- **Security:** 🔴 CRITICAL - NEVER commit to git or share publicly

```bash
# Backend .env
PETRA_PRIVATE_KEY=0x46fdf20ed53c3f9502501ecca82c48089d465081075b6944eb6aa99e149011b6

# Also set the platform address (get from Petra wallet)
APTOS_PLATFORM_ADDRESS=0x123abc...your_wallet_address
```

**Generate APT for testing:**
```bash
# Visit Aptos Faucet
https://aptoslabs.com/testnet-faucet

# Or use CLI
aptos account fund-with-faucet --account YOUR_ADDRESS
```

---

#### **APTOS_MODULE_ADDRESS**
- **What:** Address where your smart contracts are deployed
- **Purpose:** Frontend and backend need this to interact with your contracts
- **Where to Get:** Deploy smart contracts first, then copy the address
- **Format:** `0x123abc...` (66 character hex string)
- **Cost:** FREE (deployment on devnet is free)

```bash
# Backend .env
APTOS_MODULE_ADDRESS=0x...your_deployed_contract_address

# Frontend .env
VITE_APTOS_MODULE_ADDRESS=0x...your_deployed_contract_address
```

**How to Deploy Contracts:**
```bash
cd smart-contracts
aptos move compile
aptos move publish --named-addresses campuscuts=YOUR_ADDRESS
# Copy the deployed address from output
```

---

#### **APTOS_NETWORK** & **APTOS_NODE_URL**
- **What:** Which Aptos network to use (devnet/testnet/mainnet)
- **Purpose:** Determines where transactions are sent
- **Options:**
  - **devnet** (development): `https://fullnode.devnet.aptoslabs.com/v1`
  - **testnet** (staging): `https://fullnode.testnet.aptoslabs.com/v1`
  - **mainnet** (production): `https://fullnode.mainnet.aptoslabs.com/v1`
- **Cost:** FREE

```bash
# Backend .env
APTOS_NETWORK=devnet
APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
APTOS_FAUCET_URL=https://faucet.devnet.aptoslabs.com

# Frontend .env
VITE_APTOS_NETWORK=devnet
VITE_APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
```

---

### 2. **Database Configuration**

#### **DATABASE_URL**
- **What:** PostgreSQL connection string
- **Purpose:** Cache layer for fast queries (blockchain is source of truth)
- **Format:** `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`
- **Cost:** FREE (local install) or $5-20/month (hosted)

```bash
# Backend .env

# Local PostgreSQL (macOS/Linux)
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/campuscuts

# Docker/Windows
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/campuscuts

# Production (e.g., Railway, Supabase)
DATABASE_URL=postgresql://user:password@host.railway.app:5432/campuscuts
```

**Setup PostgreSQL Locally:**
```bash
# macOS
brew install postgresql
brew services start postgresql
createdb campuscuts

# Ubuntu/Debian
sudo apt install postgresql
sudo systemctl start postgresql
sudo -u postgres createdb campuscuts
```

---

#### **REDIS_URL** (Optional but Recommended)
- **What:** Redis connection string for caching blockchain queries
- **Purpose:** Speeds up repeated blockchain reads (5-10x faster)
- **Format:** `redis://HOST:PORT`
- **Cost:** FREE (local) or $5/month (hosted)

```bash
# Backend .env
REDIS_URL=redis://localhost:6379

# Production (e.g., Upstash, Railway)
REDIS_URL=redis://default:password@redis-host.upstash.io:6379
```

---

### 3. **Authentication & Security**

#### **JWT_SECRET**
- **What:** Secret key for signing JWT authentication tokens
- **Purpose:** Secure user sessions and API authentication
- **Format:** Any random string (minimum 32 characters recommended)
- **Cost:** FREE
- **Security:** 🔴 CRITICAL - Use strong random string in production

```bash
# Backend .env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
```

**Generate secure random key:**
```bash
# macOS/Linux
openssl rand -base64 48

# Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

---

#### **CUSTODIAL_ENCRYPTION_SECRET**
- **What:** Encryption key for custodial wallet data
- **Purpose:** Encrypts user wallet private keys stored in database
- **Format:** Random string (minimum 32 characters)
- **Cost:** FREE
- **Security:** 🔴 CRITICAL - If lost, all custodial wallets are unrecoverable

```bash
# Backend .env
CUSTODIAL_ENCRYPTION_SECRET=change-this-to-a-very-long-random-string-min-32-characters-please
```

**Best Practice:**
- Use a key management service (AWS KMS, Azure Key Vault)
- Store in environment variable, NOT in .env file
- Rotate periodically (with migration plan)

---

### 4. **File Storage (IPFS via Pinata)**

#### **PINATA_API_KEY, PINATA_SECRET_API_KEY, PINATA_JWT**
- **What:** Pinata credentials for IPFS file uploads
- **Purpose:** Store barber portfolio images, profile photos on decentralized storage
- **Where to Get:** [Pinata Cloud](https://app.pinata.cloud/)
- **Cost:** FREE tier (1GB storage, 100GB bandwidth/month)
- **Paid:** $20/month (100GB storage)

```bash
# Backend .env
PINATA_API_KEY=your-pinata-api-key-here
PINATA_SECRET_API_KEY=your-pinata-secret-api-key-here
PINATA_JWT=your-pinata-jwt-token-here
IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs
IPFS_API_URL=https://api.pinata.cloud
```

**How to Get Pinata Keys:**
1. Sign up at https://app.pinata.cloud/
2. Go to **API Keys** section
3. Click **New Key**
4. Enable **pinFileToIPFS** and **pinJSONToIPFS** permissions
5. Copy API Key, Secret Key, and JWT
6. Paste into `.env` file

**Why IPFS?**
- Decentralized (no single point of failure)
- Permanent storage (content-addressed)
- Blockchain-native (NFT metadata standard)
- Censorship-resistant

---

### 5. **Payment Processing**

#### **STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET**
- **What:** Stripe API credentials for payment processing
- **Purpose:** Handle fiat payments (USD → USDC conversions)
- **Where to Get:** [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
- **Cost:** FREE (Stripe takes 2.9% + $0.30 per transaction)

```bash
# Backend .env
STRIPE_SECRET_KEY=sk_test_51A1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
STRIPE_PUBLISHABLE_KEY=pk_test_51A1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz

# Frontend .env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51A1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```

**How to Get Stripe Keys:**
1. Sign up at https://stripe.com/
2. Go to **Developers** → **API Keys**
3. Copy **Publishable key** and **Secret key**
4. For webhook secret:
   - Go to **Developers** → **Webhooks**
   - Add endpoint: `https://your-domain.com/api/v1/stripe/webhook`
   - Select events: `payment_intent.succeeded`, `charge.failed`
   - Copy **Signing secret**

**Testing:**
- Use test keys (`sk_test_...` and `pk_test_...`)
- Test credit cards: `4242 4242 4242 4242` (any future date, any CVC)

---

#### **CIRCLE_API_KEY** (Optional but Recommended)
- **What:** Circle API for USD ↔ USDC conversions
- **Purpose:** Convert fiat payments to stablecoin on blockchain
- **Where to Get:** [Circle Developers](https://www.circle.com/en/developers)
- **Cost:** FREE tier ($100k/month transaction volume)

```bash
# Backend .env
CIRCLE_API_KEY=your-circle-api-key-here
CIRCLE_API_URL=https://api-sandbox.circle.com
CIRCLE_WALLET_ID=your-circle-wallet-id
```

**Why Circle/USDC?**
- 1:1 with USD (no volatility)
- Instant settlement on blockchain
- Industry standard for stablecoin payments
- Backed by US dollar reserves

---

### 6. **Gas Wallet Configuration**

#### **GAS_WALLET_PRIVATE_KEY**
- **What:** Wallet that pays blockchain gas fees
- **Purpose:** Platform pays ALL gas fees (users never pay)
- **Format:** Same as PETRA_PRIVATE_KEY (can use same wallet)
- **Cost:** ~$0.0001 per transaction (10,000 bookings ≈ $1)

```bash
# Backend .env
GAS_WALLET_PRIVATE_KEY=0x...your_gas_wallet_private_key

# If not set, will use PETRA_PRIVATE_KEY as gas wallet
# Recommended: Use separate wallet for gas vs USDC custody
```

**Best Practice:**
- Keep topped up with 100-200 APT (~$1000-2000)
- Monitor balance and set up auto-top-up alerts
- Separate wallet from custodial funds for security

---

## ⚪ Optional API Keys

### 7. **Email Configuration (SMTP)**

#### **SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS**
- **What:** Email server credentials for transactional emails
- **Purpose:** Send booking confirmations, password resets, notifications
- **Where to Get:** Gmail, SendGrid, AWS SES, Mailgun
- **Cost:** FREE (Gmail) or $5-15/month (professional)

```bash
# Backend .env

# Gmail (Free - using app password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-app-email@gmail.com
SMTP_PASS=your-16-char-app-password

# SendGrid (Professional)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Gmail Setup:**
1. Enable 2-factor authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate app password for "Mail"
4. Use 16-character password (no spaces) in SMTP_PASS

**Professional Alternatives:**
- **SendGrid:** 100 emails/day free, then $15/month for 40k emails
- **AWS SES:** $0.10 per 1,000 emails
- **Mailgun:** 5,000 emails/month free

---

### 8. **Push Notifications**

#### **Firebase (Android)**
- **What:** Firebase Cloud Messaging credentials
- **Purpose:** Send push notifications to Android users
- **Where to Get:** [Firebase Console](https://console.firebase.google.com/)
- **Cost:** FREE

```bash
# Backend .env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}
```

**How to Get Firebase Service Account:**
1. Go to Firebase Console
2. Create new project (or select existing)
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Copy entire JSON content to FIREBASE_SERVICE_ACCOUNT

---

#### **Apple Push Notifications (iOS)**
- **What:** APN credentials for iOS push notifications
- **Purpose:** Send push notifications to iPhone/iPad users
- **Where to Get:** [Apple Developer Portal](https://developer.apple.com/)
- **Cost:** $99/year (Apple Developer Program)

```bash
# Backend .env
APN_KEY_ID=your-apn-key-id
APN_TEAM_ID=your-apple-team-id
APN_PRIVATE_KEY=./path/to/AuthKey_XXXXXXXX.p8
APN_BUNDLE_ID=com.campuscuts.ios
```

**How to Get APN Keys:**
1. Join Apple Developer Program ($99/year)
2. Go to **Certificates, Identifiers & Profiles**
3. Go to **Keys** → Create new key
4. Enable **Apple Push Notifications service (APNs)**
5. Download `.p8` file and note Key ID and Team ID

---

### 9. **Analytics & Monitoring** (Optional)

#### **Google Analytics**
```bash
# Frontend .env
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

#### **Sentry (Error Tracking)**
```bash
# Backend .env
SENTRY_DSN=https://xxx@sentry.io/xxx

# Frontend .env
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

### 10. **External Services** (Optional)

#### **WHOIS_API_KEY**
- **What:** API for validating .edu email domains
- **Purpose:** Verify student email addresses are from real universities
- **Where to Get:** [WhoisXML API](https://whoisxmlapi.com/)
- **Cost:** FREE tier (1,000 requests/month)

```bash
# Backend .env
WHOIS_API_KEY=your-whois-api-key
```

---

## 📁 Configuration Files

### Backend Configuration

Create `backend/.env` file:

```bash
cd backend
cp env.example .env
nano .env  # or use your preferred editor
```

**Minimal development setup:**
```bash
# backend/.env (minimum for local dev)
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/campuscuts
JWT_SECRET=random-secret-string-change-in-production
PETRA_PRIVATE_KEY=0x...your_petra_private_key
APTOS_PLATFORM_ADDRESS=0x...your_wallet_address
APTOS_MODULE_ADDRESS=0x...deployed_contract_address
APTOS_NETWORK=devnet
APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
```

---

### Frontend Configuration

Create `web-app/.env` file:

```bash
cd web-app
cp env.example .env
nano .env
```

**Minimal development setup:**
```bash
# web-app/.env (minimum for local dev)
VITE_API_URL=http://localhost:3001/api/v1
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_APTOS_NETWORK=devnet
VITE_APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
VITE_APTOS_MODULE_ADDRESS=0x...deployed_contract_address
```

---

### Docker Configuration

Create `.env` in project root for Docker Compose:

```bash
# CampusCuts/.env (root directory)
APTOS_PLATFORM_ADDRESS=0x...
APTOS_PLATFORM_PRIVATE_KEY=0x...
APTOS_MODULE_ADDRESS=0x...
CUSTODIAL_ENCRYPTION_SECRET=your-secret
PINATA_API_KEY=your-key
PINATA_SECRET_API_KEY=your-secret
PINATA_JWT=your-jwt
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your-jwt-secret
```

---

## 🔒 Security Best Practices

### 1. **Never Commit Secrets to Git**

```bash
# Verify .env files are in .gitignore
cat .gitignore | grep .env

# Should output:
# .env
# .env.local
# .env.production
# backend/.env
# web-app/.env
```

### 2. **Use Environment Variables in Production**

**On EC2/Server:**
```bash
# Don't use .env files in production
# Set environment variables directly
export PETRA_PRIVATE_KEY="0x..."
export JWT_SECRET="..."

# Or use systemd environment file
sudo nano /etc/environment
```

**On Railway/Render/Vercel:**
- Use platform's environment variable UI
- Never paste .env files into dashboards

### 3. **Rotate Keys Regularly**

```bash
# Rotate every 90 days:
- JWT_SECRET
- CUSTODIAL_ENCRYPTION_SECRET (with migration!)
- Stripe keys (if compromised)
- API keys (Pinata, Circle, etc.)
```

### 4. **Use Key Management Services (Production)**

- **AWS Secrets Manager** ($0.40/secret/month)
- **Azure Key Vault** ($0.03/10k operations)
- **HashiCorp Vault** (open source)

### 5. **Monitor for Leaks**

```bash
# Check if secrets leaked to git history
git log -p | grep -i "SECRET\|API_KEY\|PRIVATE_KEY"

# Use git-secrets to prevent future leaks
brew install git-secrets
git secrets --install
git secrets --register-aws
```

---

## 💰 Cost Analysis

### Development (Local)
```
PostgreSQL: FREE (local install)
Redis: FREE (local install)
Aptos devnet: FREE (test APT from faucet)
Pinata: FREE (1GB storage)
Stripe: FREE (test mode)
────────────────────────────
TOTAL: $0/month
```

### Production (Small Scale - 100 users)
```
PostgreSQL: $5-10/month (Railway, Supabase)
Redis: $5/month (Upstash)
Aptos mainnet gas: ~$10/month (100 transactions/day)
Pinata: $20/month (10GB storage)
Stripe: 2.9% + $0.30 per transaction
Email (SendGrid): $15/month (40k emails)
────────────────────────────
TOTAL: ~$55-60/month + transaction fees
```

### Production (Medium Scale - 1,000 users)
```
PostgreSQL: $25/month (dedicated instance)
Redis: $10/month
Aptos mainnet gas: ~$50/month (1,000 transactions/day)
Pinata: $40/month (50GB storage)
Stripe: 2.9% + $0.30 per transaction
Email (SendGrid): $40/month (100k emails)
Circle USDC: FREE (under $100k/month volume)
────────────────────────────
TOTAL: ~$165-180/month + transaction fees
```

---

## 🔧 Troubleshooting

### Issue: "PETRA_PRIVATE_KEY not configured"

```bash
# Check if key is set
echo $PETRA_PRIVATE_KEY

# Check format (should be 0x... hex string)
# Remove ed25519-priv- prefix if present
PETRA_PRIVATE_KEY=0x46fdf20ed53c3f9502501ecca82c48089d465081075b6944eb6aa99e149011b6
```

### Issue: "Database connection refused"

```bash
# Check if PostgreSQL is running
pg_isready

# If not running:
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Check connection string
psql $DATABASE_URL
```

### Issue: "IPFS upload failed"

```bash
# Test Pinata credentials
curl -X GET "https://api.pinata.cloud/data/testAuthentication" \
  -H "Authorization: Bearer $PINATA_JWT"

# Should return: {"message":"Congratulations! You are communicating with the Pinata API!"}
```

### Issue: "Insufficient gas fees"

```bash
# Check gas wallet balance
aptos account list --account $APTOS_PLATFORM_ADDRESS

# Fund from faucet (devnet)
aptos account fund-with-faucet --account $APTOS_PLATFORM_ADDRESS

# For mainnet: Purchase APT on exchange and transfer
```

### Issue: "Stripe webhook signature verification failed"

```bash
# Test webhook locally with Stripe CLI
stripe listen --forward-to localhost:3001/api/v1/stripe/webhook

# Use the webhook signing secret from CLI output
# whsec_xxx...
```

---

## 📚 Additional Resources

### Documentation Links
- **Aptos:** https://aptos.dev/
- **Petra Wallet:** https://petra.app/docs
- **Pinata (IPFS):** https://docs.pinata.cloud/
- **Stripe:** https://stripe.com/docs/api
- **Circle (USDC):** https://developers.circle.com/
- **PostgreSQL:** https://www.postgresql.org/docs/
- **Redis:** https://redis.io/docs/

### Support
- **GitHub Issues:** https://github.com/lmckeown27/CampusCuts/issues
- **Email:** support@campuscuts.com

---

## 📝 Checklist: Ready for Production?

```bash
Backend:
[ ] All required environment variables set
[ ] Database migrations run (npx prisma migrate deploy)
[ ] JWT_SECRET is strong random string (32+ chars)
[ ] CUSTODIAL_ENCRYPTION_SECRET is strong and backed up
[ ] PostgreSQL has secure password
[ ] Redis has authentication enabled
[ ] CORS configured for production domain
[ ] Rate limiting enabled
[ ] Logging configured (Sentry, CloudWatch, etc.)

Frontend:
[ ] VITE_API_URL points to production backend
[ ] VITE_WS_URL uses wss:// (secure WebSocket)
[ ] VITE_STRIPE_PUBLISHABLE_KEY is production key
[ ] VITE_APTOS_NETWORK is mainnet
[ ] PWA manifest configured
[ ] Analytics configured (if using)

Blockchain:
[ ] Smart contracts deployed to mainnet
[ ] Platform wallet funded with USDC
[ ] Gas wallet funded with 100+ APT
[ ] Contract ownership verified
[ ] Emergency pause mechanism tested

Security:
[ ] All .env files in .gitignore
[ ] No secrets in git history
[ ] SSL/TLS certificates installed
[ ] Firewall rules configured
[ ] Backups automated
[ ] Monitoring alerts set up
```

---

**🎉 You're all set! If you have questions about any specific API key, refer to the relevant section above or check the official documentation.**

**Last Updated:** December 21, 2024  
**Version:** 1.0  
**Maintainer:** CampusCuts Team

