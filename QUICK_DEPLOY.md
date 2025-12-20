# 🚀 Quick Deploy Guide

Get CampusCuts live in production in ~30 minutes.

---

## Option 1: Railway (Easiest - Recommended)

### Prerequisites
```bash
# Install Railway CLI
npm install -g @railway/cli

# Install Vercel CLI
npm install -g vercel
```

### Step 1: Deploy Backend + Database (5 minutes)

```bash
cd /Users/liammckeown/Desktop/CampusCuts

# Run automated deployment script
./scripts/deploy-railway.sh
```

**What this does:**
- ✅ Creates Railway project
- ✅ Provisions PostgreSQL database
- ✅ Deploys backend
- ✅ Runs database migrations
- ✅ Gives you a live API URL

### Step 2: Deploy Frontend (3 minutes)

```bash
# Run automated deployment script
./scripts/deploy-vercel.sh
```

**What this does:**
- ✅ Deploys React app to Vercel
- ✅ Configures API connection
- ✅ Gives you a live app URL

### Step 3: Deploy Smart Contracts (10 minutes)

```bash
cd contracts

# Initialize Aptos mainnet profile
aptos init --network mainnet --profile mainnet

# Deploy contracts
aptos move publish \
  --named-addresses campus_cuts=$(aptos config show-profiles --profile mainnet | grep account | awk '{print $2}') \
  --profile mainnet

# Initialize escrow
aptos move run \
  --function-id [YOUR_ADDRESS]::usdc_escrow::initialize \
  --profile mainnet
```

### Step 4: Fund Gas Wallet (2 minutes)

```bash
# Get gas wallet address
curl https://[your-railway-url].railway.app/api/admin/gas-wallet/status

# Send 100 APT from Coinbase/Binance to that address
# Wait 2-3 minutes for confirmation
```

### Step 5: Test (5 minutes)

```bash
# Backend health
curl https://[your-railway-url].railway.app/api/health

# Frontend
open https://[your-vercel-url].vercel.app

# Create test booking
# Visit app and try booking a barber
```

### Step 6: Custom Domains (5 minutes)

**Backend (Railway Dashboard):**
1. Go to https://railway.app/dashboard
2. Select your project > backend service
3. Settings > Domains > Add Custom Domain
4. Enter: `api.campuscuts.com`
5. Copy CNAME record
6. Add to your domain registrar DNS

**Frontend (Vercel Dashboard):**
1. Go to https://vercel.com/dashboard
2. Select project > Settings > Domains
3. Add: `app.campuscuts.com`
4. Copy DNS records
5. Add to your domain registrar

---

## Option 2: One-Command Docker Deploy

### Prerequisites
```bash
# Install Docker
# Mac: https://docs.docker.com/desktop/install/mac-install/
# Linux: sudo apt-get install docker-ce docker-ce-cli containerd.io
```

### Deploy Everything

```bash
cd /Users/liammckeown/Desktop/CampusCuts

# Create environment file
cp backend/env.example .env.prod

# Edit with your keys
nano .env.prod

# Deploy all services
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

**Your app is now live at:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Database: localhost:5432

---

## Manual Steps (If Scripts Fail)

### Backend (Railway)

```bash
# 1. Login
railway login

# 2. Create project
railway init

# 3. Add PostgreSQL
railway add --database postgres

# 4. Deploy
cd backend
railway up

# 5. Set environment variables
railway variables set NODE_ENV=production
railway variables set APTOS_PLATFORM_PRIVATE_KEY=0x...
railway variables set STRIPE_SECRET_KEY=sk_live_...
railway variables set CIRCLE_API_KEY=...

# 6. Run migrations
railway run npx prisma migrate deploy

# 7. Get URL
railway domain
```

### Frontend (Vercel)

```bash
# 1. Login
vercel login

# 2. Deploy
cd web-app
vercel --prod

# 3. Set API URL
vercel env add VITE_API_URL production
# Enter your Railway backend URL

# 4. Redeploy
vercel --prod
```

---

## Environment Variables Checklist

### Backend (Railway)

```bash
✅ NODE_ENV=production
✅ DATABASE_URL=[auto-set by Railway]
✅ APTOS_PLATFORM_PRIVATE_KEY=0x...
✅ APTOS_NETWORK=mainnet
✅ APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
✅ APTOS_MODULE_ADDRESS=0x[your-deployed-address]
✅ STRIPE_SECRET_KEY=sk_live_...
✅ CIRCLE_API_KEY=...
✅ GAS_WALLET_PRIVATE_KEY=0x...
✅ JWT_SECRET=[generate: openssl rand -hex 32]
✅ CUSTODIAL_ENCRYPTION_SECRET=[generate: openssl rand -hex 64]
```

### Frontend (Vercel)

```bash
✅ VITE_API_URL=https://api.campuscuts.com
✅ VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Post-Deployment Checklist

```bash
# 1. Backend health
curl https://api.campuscuts.com/api/health
# ✅ {"status":"ok","blockchain":"connected","database":"connected"}

# 2. Frontend loads
curl https://app.campuscuts.com
# ✅ 200 OK with HTML

# 3. Database connected
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
# ✅ Returns count

# 4. Gas wallet funded
curl https://api.campuscuts.com/api/admin/gas-wallet/status
# ✅ {"balance_apt": 100.0, "needs_refill": false}

# 5. Smart contracts deployed
curl "https://fullnode.mainnet.aptoslabs.com/v1/accounts/[YOUR_ADDRESS]/resources"
# ✅ usdc_escrow::EscrowRegistry found

# 6. SSL active
curl -vI https://api.campuscuts.com 2>&1 | grep "SSL"
# ✅ Valid certificate

# 7. Create test booking
# ✅ Visit app and complete a test booking
```

---

## Monitoring Setup (5 minutes)

### UptimeRobot (Free)

```bash
# 1. Visit https://uptimerobot.com
# 2. Add New Monitor:
#    - Type: HTTP(s)
#    - URL: https://api.campuscuts.com/api/health
#    - Interval: 5 minutes
#    - Alert: Email when down
```

### Railway Alerts

```bash
# In Railway dashboard:
# 1. Project Settings > Notifications
# 2. Add email for deployment failures
# 3. Add Slack/Discord webhook (optional)
```

---

## Cost Summary

### Month 1 (Development + First Users)
```
Railway (Backend + DB):    $20
Vercel (Frontend):         Free
Upstash (Redis):           Free
Domain:                    $12 (one-time)
APT for gas:               $50 (100 APT, lasts months)
─────────────────────────────
TOTAL:                     $82 (then $20/mo)
```

### At 100 bookings/day
```
Railway:                   $30
Vercel:                    $20
Upstash:                   $10
APT gas:                   $3/mo
─────────────────────────────
TOTAL:                     $63/month

Revenue (5% of ~$2500/day): $125/day = $3,750/month
Profit:                    $3,687/month 💰
```

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
railway logs --service backend --tail

# Common fixes:
railway variables # Verify all set
railway restart # Force restart
```

### Frontend shows "Network Error"
```bash
# Check CORS
railway variables get ALLOWED_ORIGINS
# Should include your Vercel URL

# Update if needed
railway variables set ALLOWED_ORIGINS=https://app.campuscuts.com,https://campuscuts.vercel.app
```

### Database connection failed
```bash
# Verify DATABASE_URL
railway variables get DATABASE_URL

# Test connection
railway run psql $DATABASE_URL -c "SELECT 1;"
```

### Gas wallet empty
```bash
# Check balance
curl https://api.campuscuts.com/api/admin/gas-wallet/status

# Refill from exchange (send APT to address shown)
```

---

## Next Steps

1. ✅ **Test thoroughly** - Create real test bookings
2. ✅ **Setup monitoring** - UptimeRobot + Railway alerts
3. ✅ **Configure Circle** - Production mode, bank accounts
4. ✅ **Configure Stripe** - Live mode, webhooks
5. ✅ **Backup strategy** - Railway auto-backups enabled
6. ✅ **Launch!** 🚀

---

## Support

If you get stuck:

1. Check `DEPLOYMENT_GUIDE.md` for detailed instructions
2. Railway docs: https://docs.railway.app
3. Vercel docs: https://vercel.com/docs
4. CampusCuts Discord: (coming soon)

---

**Ready to deploy? Run:**
```bash
./scripts/deploy-railway.sh
```

🚀 **Let's go!**



