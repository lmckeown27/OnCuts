# Environment Variables Template

Copy this to `backend/.env` and fill in your actual values.

```bash
# ============================================
# CAMPUSCUTS BACKEND ENVIRONMENT CONFIGURATION
# ============================================

# -------------------- DATABASE --------------------
DATABASE_URL="postgresql://campuscuts_user:your_password@localhost:5432/campuscuts?schema=public"

# -------------------- REDIS --------------------
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Redis Queue (separate DB for job queues)
REDIS_QUEUE_HOST=localhost
REDIS_QUEUE_PORT=6379
REDIS_QUEUE_DB=1

# -------------------- JWT AUTHENTICATION --------------------
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=generate_your_own_secret_here_32_bytes_minimum
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=generate_different_secret_for_refresh_tokens
JWT_REFRESH_EXPIRES_IN=30d

# -------------------- EMAIL SERVICE (SMTP) ⭐ NEW! ⭐ --------------------
# Required for email verification
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173

# Development Mode (set to 'true' to skip email sending and log codes instead)
AUTO_VERIFY_EMAILS=false

# -------------------- STRIPE PAYMENTS --------------------
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
STRIPE_CONNECT_CLIENT_ID=ca_xxxxxxxxxxxxxxxxxxxxx

# -------------------- APTOS BLOCKCHAIN --------------------
APTOS_PLATFORM_ADDRESS=0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa
APTOS_NETWORK=devnet
APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
APTOS_FAUCET_URL=https://faucet.devnet.aptoslabs.com
APTOS_PRIVATE_KEY=0xyour_platform_wallet_private_key_here

# -------------------- OPENAI --------------------
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=1000

# -------------------- APPLICATION SETTINGS --------------------
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
API_BASE_URL=http://localhost:3001

# CORS (comma-separated)
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# -------------------- SECURITY --------------------
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=generate_another_secret_here
COOKIE_SECRET=and_another_one_here
ENCRYPTION_KEY=32_byte_encryption_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# -------------------- LOGGING & MONITORING --------------------
LOG_LEVEL=info

# Optional: Sentry (Error tracking)
# SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
# SENTRY_ENVIRONMENT=development
```

---

## Quick Setup for SMTP

### Option 1: Gmail (For Testing)

1. Enable 2-Factor Authentication on your Google account
2. Go to: https://myaccount.google.com/apppasswords
3. Generate an "App Password" for "Mail"
4. Use the 16-character password in SMTP_PASS

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # 16-char app password
```

### Option 2: SendGrid (For Production)

1. Sign up at: https://sendgrid.com
2. Create API key with "Mail Send" permission
3. Use as SMTP password

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Generate All Secrets

Run these commands to generate secure secrets:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# COOKIE_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

