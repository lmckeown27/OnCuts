# CampusCuts

**Decentralized Marketplace for Campus Barbers**

CampusCuts connects student barbers with student consumers using blockchain technology for transparent, fair, and instant payments.

---

## 🏗️ Architecture Overview

### **Payment System: USDC-Based with APT Gas**

```
┌─────────────────────────────────────────────────────────────────┐
│                      PAYMENT FLOW                               │
└─────────────────────────────────────────────────────────────────┘

1. CONSUMER PAYS (USD)
   ├─ Consumer pays $25 via Stripe credit card
   └─ Stripe deposits $25 to CampusCuts bank account

2. USD → USDC CONVERSION (Circle API)
   ├─ Backend calls Circle API: $25 USD → 25 USDC (1:1)
   ├─ Circle sends 25 USDC to platform's Aptos wallet
   └─ Settlement time: 1-5 minutes

3. ESCROW ON BLOCKCHAIN
   ├─ Smart contract locks 25 USDC in escrow
   ├─ Status: "escrowed" (immutable, transparent)
   ├─ Gas fee: ~$0.0001 (paid by platform in APT)
   └─ Transaction hash stored for auditing

4. SERVICE HAPPENS
   ├─ Barber cuts hair
   ├─ Consumer confirms completion
   └─ Off-chain coordination

5. ESCROW RELEASE (Smart Contract)
   ├─ Automatically splits USDC:
   │  ├─ 23.75 USDC → Barber (95%)
   │  └─ 1.25 USDC → Platform (5%)
   ├─ Gas fee: ~$0.0001 (paid by platform in APT)
   └─ Instant, atomic, on-chain

6. USDC → USD CONVERSION (Circle API)
   ├─ Backend calls Circle API: 23.75 USDC → $23.75 USD (1:1)
   ├─ Circle deposits to barber's linked bank account
   └─ Settlement time: 1-2 business days (ACH)

7. BARBER RECEIVES PAYOUT
   └─ $23.75 arrives in bank account
```

### **Why USDC Instead of APT?**

| Factor | APT (Native Coin) | USDC (Stablecoin) |
|--------|-------------------|-------------------|
| **Price Stability** | ❌ Volatile ($5-$20) | ✅ Stable ($1.00) |
| **Predictability** | ❌ Barber payout varies | ✅ $25 in = $23.75 out |
| **User Trust** | ❌ "Why did my payout change?" | ✅ Clear, consistent amounts |
| **Accounting** | ❌ FX losses/gains messy | ✅ Clean 1:1 conversion |
| **Regulatory** | ❌ Unregulated | ✅ Circle is licensed |
| **Use Case** | Gas fees | Payments |

**Decision: USDC for all payments, APT only for gas**

---

## 💰 Economics

### **For Barbers**
- **Keep 95%** of every payment
- Traditional barbershops: 40-60% payout
- **No volatility risk** (USDC = USD)
- Instant escrow visibility on-chain
- Payout to bank in 1-2 days

### **For Consumers**
- Pay **5% less** than traditional shops
- Transparent pricing (on-chain)
- Escrow protection (refund if cancelled)
- No hidden fees

### **Platform Costs**
- **5% platform fee** from each booking
- **Gas fees**: ~$0.10 per 1000 transactions (paid by platform)
- **Stripe fees**: 3% + $0.30 (absorbed by platform)
- **Circle fees**: 0.5% for USD ↔ USDC (absorbed by platform)

**Example $25 booking:**
```
Consumer pays:    $25.00 (Stripe)
Platform receives: $24.25 (after Stripe 3% fee)
Convert to USDC:   24.25 USDC
Escrow on-chain:   24.25 USDC
Barber gets:       23.04 USDC (95%)
Platform keeps:    1.21 USDC (5%)
Gas cost:          $0.0002 APT (platform pays)
```

---

## 🛠️ Tech Stack

### **Blockchain**
- **Aptos** - High-performance L1 blockchain
- **Move** - Secure smart contract language
- **USDC** - Circle's USD stablecoin on Aptos

### **Backend**
- **Node.js + TypeScript**
- **NestJS** - Enterprise framework
- **PostgreSQL** - Cache layer (blockchain is source of truth)
- **Redis** - Job queues & caching
- **Prisma** - Database ORM

### **Frontend**
- **React + TypeScript**
- **Vite** - Fast build tool
- **TailwindCSS** - Styling
- **PWA** - Mobile app capabilities

### **External Services**
- **Stripe** - Fiat payment processing
- **Circle** - USD ↔ USDC conversions
- **Pinata** - IPFS file storage
- **OpenAI** - AI enrichment & fraud detection

---

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+
- PostgreSQL 15+
- Redis 6+
- Aptos CLI

### **Installation**

1. **Clone repository**
   ```bash
   git clone https://github.com/campuscuts/campuscuts.git
   cd campuscuts
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install
   cd ../web-app && npm install
   cd ../contracts && aptos move compile
   ```

3. **Configure environment**
   ```bash
   cd backend
   cp env.example .env
   # Edit .env with your API keys:
   # - APTOS_PLATFORM_PRIVATE_KEY (generate: aptos init)
   # - STRIPE_SECRET_KEY (from Stripe dashboard)
   # - CIRCLE_API_KEY (from Circle developer portal)
   # - DATABASE_URL (PostgreSQL connection string)
   ```

4. **Deploy smart contracts**
   ```bash
   cd contracts
   aptos move publish --named-addresses campus_cuts=YOUR_ADDRESS
   ```

5. **Initialize database**
   ```bash
   cd backend
   npx prisma migrate deploy
   npx prisma db seed
   ```

6. **Start services**
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Frontend
   cd web-app && npm run dev

   # Terminal 3: Redis
   redis-server

   # Terminal 4: PostgreSQL
   # (already running as service)
   ```

7. **Fund gas wallet (devnet)**
   ```bash
   curl -X POST http://localhost:3001/api/admin/gas-wallet/fund-faucet
   ```

---

## 📁 Project Structure

```
campuscuts/
├── backend/               # Node.js API
│   ├── src/
│   │   ├── services/
│   │   │   ├── usdc.service.ts        # Circle API integration
│   │   │   ├── gas-wallet.service.ts  # APT gas management
│   │   │   ├── aptos.service.ts       # Blockchain calls
│   │   │   └── payment.service.ts     # Payment orchestration
│   │   ├── routes/
│   │   │   ├── admin-gas-wallet.routes.ts
│   │   │   └── payment.routes.ts
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── env.example
│
├── contracts/             # Move smart contracts
│   └── sources/
│       ├── usdc_escrow.move          # USDC payment escrow
│       ├── booking_system.move        # Booking logic
│       └── user_accounts.move         # User management
│
├── web-app/               # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ConsumerPage.tsx
│   │   │   ├── BarberPage.tsx
│   │   │   └── AdminPage.tsx
│   │   └── services/
│   │       └── api.ts
│   └── public/
│
├── ai-worker/             # AI automation microservice
│   ├── src/
│   │   ├── processors/
│   │   └── prompts/
│   └── Dockerfile
│
└── README.md
```

---

## 🔑 Key APIs

### **Admin Gas Wallet API**

Monitor and manage gas fees:

```bash
# Check gas wallet status
GET /api/admin/gas-wallet/status

Response:
{
  "address": "0x...",
  "balance_apt": 47.23,
  "balance_usd_estimate": 472.30,
  "estimated_transactions_remaining": 472300,
  "needs_refill": false
}

# Get refill instructions
GET /api/admin/gas-wallet/refill-instructions

# Fund from faucet (devnet only)
POST /api/admin/gas-wallet/fund-faucet
```

### **Payment API**

Process USDC payments:

```bash
# Create booking payment
POST /api/payments/booking

Body:
{
  "bookingId": "uuid",
  "amountCents": 2500,
  "barberId": "uuid",
  "consumerId": "uuid",
  "stripePaymentIntentId": "pi_..."
}

Response:
{
  "escrowTxHash": "0x...",
  "usdcAmount": 25.0,
  "status": "escrowed"
}

# Release payment after service
POST /api/payments/release

Body:
{
  "bookingId": "uuid"
}

Response:
{
  "releaseTxHash": "0x...",
  "barberPayout": 23.75,
  "platformFee": 1.25
}
```

---

## 🔐 Security

### **Smart Contract Security**
- ✅ Move language prevents reentrancy
- ✅ No integer overflow (Move safety)
- ✅ Formal verification compatible
- ✅ Immutable escrow logic
- ✅ Admin-only release functions

### **API Security**
- ✅ JWT authentication
- ✅ Rate limiting (750 req/10min)
- ✅ Input validation (Zod)
- ✅ SQL injection prevention (Prisma)
- ✅ CORS whitelisting

### **Key Management**
- ✅ Private keys in .env (never commit)
- ✅ Custodial wallet encryption
- ✅ Separate gas wallet
- ✅ Production: AWS Secrets Manager

### **Gas Wallet Protection**
- ✅ Only backend has access
- ✅ Cannot be drained by users
- ✅ Auto-alerts when balance low
- ✅ Separate from USDC custody

---

## 📊 Monitoring

### **Gas Wallet Dashboard**
Admin page shows real-time gas wallet status:
- Current APT balance
- USD value estimate
- Transactions remaining
- Alert level (OK / LOW / CRITICAL)
- Refill instructions

### **Payment Analytics**
- Total USDC locked in escrow
- Total platform fees collected
- Average gas cost per transaction
- USDC → USD conversion success rate

---

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Smart contract tests
cd contracts && aptos move test

# E2E tests
cd e2e && npx playwright test
```

---

## 📈 Roadmap

### **Phase 1: MVP** ✅
- [x] USDC escrow smart contracts
- [x] Circle API integration
- [x] Stripe payment processing
- [x] Basic consumer/barber flows
- [x] Gas wallet management

### **Phase 2: Advanced Features** (Current)
- [ ] AI-powered dynamic pricing
- [ ] Automated dispute resolution
- [ ] Campus location ingestion
- [ ] Campus Manager roles
- [ ] Multi-campus support

### **Phase 3: Scale**
- [ ] Mobile apps (iOS + Android)
- [ ] Multi-chain support (Solana, Polygon)
- [ ] International markets
- [ ] Enterprise barber shops
- [ ] DAO governance

---

## 🚢 Deployment

### **AWS Deployment (Production)**

For complete AWS deployment with PostgreSQL RDS, EC2/ECS, and CloudFront:

**See: [AWS_DEPLOYMENT_GUIDE.md](AWS_DEPLOYMENT_GUIDE.md)**

Includes:
- PostgreSQL on RDS (with Multi-AZ)
- Backend on EC2/ECS Fargate
- Frontend on S3 + CloudFront
- ElastiCache Redis
- SSL/TLS setup
- Monitoring & logging
- Cost estimates
- Security checklist

### **Quick Deploy**

```bash
# Deploy to AWS
./scripts/aws-deploy.sh production

# Or use Railway (PostgreSQL + Backend)
railway link
railway up

# Frontend to Vercel
cd web-app
vercel --prod
```

---

## 🏗️ Hybrid Architecture

CampusCuts uses a **hybrid Postgres + Blockchain** architecture:

- **Blockchain (Aptos)**: Source of truth for all payments
  - USDC escrow & settlements
  - Immutable transaction records
  - Cryptographic proof
  
- **PostgreSQL**: Performance cache layer
  - Fast queries (10-50ms vs 1-3s blockchain)
  - User profiles & availability
  - Search & discovery
  - Cached payment data (synced from blockchain)

**Key Principle:** PostgreSQL caches blockchain data for speed, but blockchain is always the source of truth for financial data.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 📞 Support

- **Email**: support@campuscuts.com
- **GitHub Issues**: https://github.com/campuscuts/campuscuts/issues
- **Documentation**: See AWS_DEPLOYMENT_GUIDE.md for deployment help

---

**Built with ❤️  by the CampusCuts team**
