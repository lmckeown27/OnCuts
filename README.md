# 🎓 CampusCuts: Decentralized Campus Barber Marketplace

**A blockchain-powered barber booking platform that feels like Uber, but costs 85% less to operate.**

---

## 🎯 **What is CampusCuts?**

CampusCuts is a revolutionary campus marketplace that:
- **Looks and feels like any Web2 app** (Uber, Airbnb, etc.)
- **Actually runs on blockchain** (Aptos) + decentralized storage (IPFS)
- **Costs 85% less** than traditional marketplace platforms ($90/mo vs $600/mo)
- **Users have NO IDEA they're using crypto** - Perfect Web2 UX

### **The Magic: Custodial Wallet Illusion** 🎭

| What Users See | What Actually Happens |
|----------------|----------------------|
| "Sign up with email + password" | Creates Aptos blockchain account |
| "Upload profile photo" | Uploads to IPFS, stores CID on-chain |
| "Add $100" | Credits on-chain USDC balance |
| "Book $30 haircut" | Locks 3 APT in smart contract escrow |
| "Leave 5-star review" | Text on IPFS, rating on blockchain |
| "Withdraw $500" | Deducts from blockchain, sends via Stripe |

**Users NEVER see: "wallet", "blockchain", "gas fee", or "transaction hash"**

---

## 🏗️ **Architecture**

### **Blockchain-First Stack**

```
┌────────────────────────────────────────────┐
│         FRONTEND (React + Vite)            │
│  Users interact with familiar Web2 UI     │
└──────────────────┬─────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────┐
│      THIN BACKEND (Node.js + Express)      │
│  Only 3 responsibilities:                  │
│  1. Fiat Gateway (Stripe)                  │
│  2. IPFS Gateway (Pinata)                  │
│  3. Transaction Signing (Custodial)        │
│                                            │
│  NO PostgreSQL - All data on blockchain!   │
└─────┬──────────┬──────────┬────────────────┘
      │          │          │
      ▼          ▼          ▼
┌─────────┐ ┌────────┐ ┌──────────────┐
│ Stripe  │ │  IPFS  │ │    Aptos     │
│         │ │        │ │  Blockchain  │
│ Fiat    │ │ Media  │ │              │
│ In/Out  │ │ Storage│ │ User Accounts│
│         │ │        │ │ Bookings     │
│         │ │        │ │ Reviews      │
└─────────┘ └────────┘ └──────────────┘
```

### **Data Storage**

| Data Type | Storage Location | Why |
|-----------|------------------|-----|
| User accounts | Aptos blockchain | Immutable, transparent |
| Balances | Aptos blockchain | Trustless escrow |
| Bookings | Aptos blockchain | Smart contract enforced |
| Reviews | Aptos blockchain | Can't be faked/deleted |
| Profile pictures | IPFS | Decentralized, permanent |
| Portfolio images | IPFS | Cost-effective CDN |
| Review text | IPFS | Censorship-resistant |

**NO PostgreSQL, NO AWS S3, NO centralized database!**

---

## 💰 **Cost Savings: 85% Reduction**

### **Traditional Marketplace Stack**
```
PostgreSQL:    $200/month
AWS EC2:       $300/month
S3 Storage:    $50/month
Redis:         $50/month
───────────────────────────
TOTAL:         $600/month
```

### **CampusCuts Blockchain Stack**
```
Aptos blockchain:    $50/month (1000 transactions)
IPFS (Pinata):       $20/month (100GB storage)
Serverless backend:  $10/month (minimal compute)
Redis (cache):       $10/month (optional)
───────────────────────────
TOTAL:               $90/month

💰 SAVINGS: $510/month ($6,120/year) - 85% reduction!
```

---

## 🚀 **Quick Start**

### **Prerequisites**

- Node.js 18+ and npm
- Aptos CLI (for deploying smart contracts)
- Pinata account (free tier works for development)
- Stripe account (for fiat payments)

### **1. Clone Repository**

```bash
git clone https://github.com/yourusername/CampusCuts.git
cd CampusCuts
```

### **2. Deploy Smart Contracts**

```bash
# Install Aptos CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# Initialize Aptos account
aptos init --network devnet

# Deploy contracts
cd contracts
aptos move publish --named-addresses campus_cuts=default

# Copy the deployed module address for env config
```

### **3. Set Up Backend**

```bash
cd backend
npm install

# Copy and configure environment variables
cp env.example .env

# Edit .env with your values:
# - APTOS_PLATFORM_ADDRESS (from aptos init)
# - APTOS_PLATFORM_PRIVATE_KEY (from aptos init)
# - APTOS_MODULE_ADDRESS (from deploy step)
# - CUSTODIAL_ENCRYPTION_SECRET (generate strong random string)
# - PINATA_API_KEY, PINATA_SECRET_API_KEY (from Pinata dashboard)
# - STRIPE_SECRET_KEY (from Stripe dashboard)
```

### **4. Start Backend**

```bash
npm run dev
```

You should see:
```
✅ Aptos Service initialized
✅ Custodial Signer Service initialized
✅ Blockchain Query Service initialized
✅ IPFS Service initialized
✅ Socket.IO server initialized
🌐 Blockchain-first routes enabled:
   - /api/auth-blockchain ✅
   - /api/bookings-blockchain ✅
   - /api/reviews-blockchain ✅
   - /api/fiat-bridge ✅
🚀 CampusCuts API server running on port 3001
```

### **5. Set Up Frontend**

```bash
cd ../web-app
npm install
npm run dev
```

Frontend runs on `http://localhost:3000` (or 3001 if 3000 is taken)

---

## 📚 **API Endpoints**

### **Authentication (Blockchain-Based)**

```bash
# Sign up (creates blockchain account)
POST /api/auth-blockchain/signup
Body: { email, password, username, campus_domain, role }

# Login (loads from blockchain)
POST /api/auth-blockchain/login
Body: { email, password }

# Get current user
GET /api/auth-blockchain/me
Headers: { Authorization: "Bearer <token>" }

# Update profile (on-chain transaction)
PUT /api/auth-blockchain/profile
Body: { username, bio, password }

# Upload profile photo (IPFS + on-chain CID)
POST /api/auth-blockchain/profile/photo
Body: multipart/form-data with 'photo' field
```

### **Bookings (Smart Contract Escrow)**

```bash
# Create booking (locks funds on-chain)
POST /api/bookings-blockchain
Body: {
  barber_address,
  service_name,
  amount,
  scheduled_time,
  location,
  notes,
  password
}

# Get user bookings (from blockchain events)
GET /api/bookings-blockchain

# Complete booking (releases funds to barber)
POST /api/bookings-blockchain/:id/complete
Body: { booking_id }

# Cancel booking (auto-refund to student)
POST /api/bookings-blockchain/:id/cancel
Body: { booking_id, reason, password }
```

### **Reviews (Immutable + IPFS)**

```bash
# Create review (IPFS upload + on-chain storage)
POST /api/reviews-blockchain
Body: {
  booking_id,
  barber_address,
  rating,
  review_text,
  student_performance_score,
  password
}

# Get barber reviews (blockchain + IPFS)
GET /api/reviews-blockchain/barber/:address

# Get barber rating (on-chain aggregate)
GET /api/reviews-blockchain/barber/:address/rating
```

### **Fiat Bridge (Stripe Integration)**

```bash
# Create deposit intent (add funds)
POST /api/fiat-bridge/deposit
Body: { amount }

# Get balance (on-chain balance in USD)
GET /api/fiat-bridge/balance

# Request withdrawal (cash out to bank)
POST /api/fiat-bridge/withdrawal
Body: { amount, password }

# Get conversion rates
GET /api/fiat-bridge/rates

# Calculate platform fee
GET /api/fiat-bridge/calculate-fee?amount=30

# Stripe webhook (automatic on-chain crediting)
POST /api/fiat-bridge/webhook
```

---

## 🔧 **How It Works**

### **1. User Signup Flow**

```typescript
// User does:
POST /api/auth-blockchain/signup
{
  "email": "student@calpoly.edu",
  "password": "mypassword123",
  "username": "john_doe",
  "campus_domain": "calpoly.edu",
  "role": "student"
}

// Backend does (behind the scenes):
1. Derive Aptos address from email (deterministic)
   → "student@calpoly.edu" always = 0xabc123...

2. Encrypt private key with password (AES-256-GCM)
   → Stored in KMS or database

3. Submit blockchain transaction:
   user_accounts::register_user(
     email_hash,
     campus_domain,
     role,
     username
   )

4. Return JWT token (normal Web2 auth)
   → { token: "eyJhbG...", user: { address, email, ... } }

// User sees:
✅ "Account created! Welcome to CampusCuts."

// User has NO IDEA they just created a blockchain account!
```

### **2. Booking Flow**

```typescript
// User does:
POST /api/bookings-blockchain
{
  "barber_address": "0xdef456...",
  "service_name": "Classic Haircut",
  "amount": 30,
  "scheduled_time": 1701360000,
  "location": "Dorm 4",
  "password": "mypassword123"
}

// Backend does:
1. Load user's custodial account
2. Check on-chain balance >= $30
3. Submit blockchain transaction:
   bookings::create_booking(
     student_addr,
     barber_addr,
     "Classic",
     30 * 100_000_000, // Convert to octas
     timestamp,
     location,
     notes
   )

// Smart contract does:
1. Verify student.balance_available >= 30 APT
2. Lock funds in escrow:
   student.balance_available -= 30 APT
   student.balance_locked += 30 APT
3. Create immutable booking record
4. Emit BookingCreatedEvent

// User sees:
✅ "Booking confirmed! See you at 3:00 PM."

// Reality: Funds locked in immutable smart contract escrow!
```

### **3. Review Flow**

```typescript
// User does:
POST /api/reviews-blockchain
{
  "booking_id": "123",
  "barber_address": "0xdef456...",
  "rating": 5,
  "review_text": "Amazing haircut! Very professional.",
  "password": "mypassword123"
}

// Backend does:
1. Upload review text to IPFS
   → Returns: { cid: "QmXyz123..." }

2. Submit blockchain transaction:
   reviews::create_review(
     student_addr,
     barber_addr,
     booking_id,
     5,                    // rating
     "QmXyz123...",         // IPFS CID
     85                    // student performance score
   )

// Smart contract does:
1. Verify booking is completed
2. Calculate weighted rating (VIP students = 1.2x weight)
3. Update barber's aggregate rating
4. Store review (immutable forever!)
5. Emit ReviewCreatedEvent

// User sees:
✅ "Review posted! Thank you for your feedback."

// Reality: Review permanently stored on IPFS + blockchain!
```

### **4. Fiat Deposit Flow**

```typescript
// User does:
1. Click "Add Funds"
2. Enter $100
3. Enter credit card details (Stripe Elements)
4. Confirm payment

// Backend does:
1. Stripe charges card → $100
2. Stripe webhook fires: payment_intent.succeeded
3. handleDeposit() converts $100 → 10 APT
4. Submit blockchain transaction:
   user_accounts::deposit_funds(
     user_address,
     10 * 100_000_000  // 10 APT in octas
   )
5. User's on-chain balance updated

// User sees:
✅ "Balance: $100.00"

// Reality: 10 APT on Aptos blockchain!
```

### **5. Withdrawal Flow**

```typescript
// Barber does:
POST /api/fiat-bridge/withdrawal
{
  "amount": 500,
  "password": "barberpw123"
}

// Backend does:
1. Check on-chain balance >= $500
2. Submit blockchain transaction:
   user_accounts::withdraw_funds(
     barber_address,
     50 * 100_000_000  // 50 APT in octas
   )
3. Send $500 to bank via Stripe Connect
4. Charge $1 withdrawal fee

// Barber sees:
✅ "Transfer initiated! Arrives in 1-2 business days."

// Reality: 50 APT deducted from blockchain, $500 sent to bank!
```

---

## 🛠️ **Tech Stack**

### **Smart Contracts (On-Chain Logic)**
- **Language:** Move
- **Blockchain:** Aptos (devnet for testing, mainnet for production)
- **Modules:**
  - `user_accounts.move` - User profiles, balances, metadata
  - `bookings.move` - Escrow-based booking lifecycle
  - `reviews.move` - Weighted rating system

### **Backend (Thin Signing Layer)**
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Key Services:**
  - `custodial-signer.service.ts` - Signs transactions for users
  - `blockchain-query.service.ts` - Queries Aptos blockchain
  - `ipfs.service.ts` - Uploads to IPFS via Pinata
  - `fiat-blockchain-bridge.service.ts` - Stripe ↔ Blockchain

### **Frontend (User Interface)**
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State:** React Query (for blockchain data)
- **PWA:** Service workers for offline support

### **Data Layer**
- **Primary Storage:** Aptos blockchain (replaces PostgreSQL)
- **Media Storage:** IPFS via Pinata (replaces AWS S3)
- **Caching:** Redis (optional, for performance)

---

## 📊 **Project Structure**

```
CampusCuts/
├── contracts/                   # Move smart contracts
│   ├── sources/
│   │   ├── user_accounts.move   # User profiles + balances
│   │   ├── bookings.move        # Escrow-based bookings
│   │   └── reviews.move         # Weighted review system
│   └── Move.toml
│
├── backend/                     # Node.js backend (thin signing layer)
│   ├── src/
│   │   ├── services/
│   │   │   ├── custodial-signer.service.ts    # 🔑 The magic!
│   │   │   ├── blockchain-query.service.ts    # 🔍 Query blockchain
│   │   │   ├── ipfs.service.ts                # 📦 IPFS uploads
│   │   │   └── fiat-blockchain-bridge.service.ts  # 💰 Fiat bridge
│   │   │
│   │   ├── controllers/
│   │   │   ├── auth-blockchain.controller.ts      # Auth
│   │   │   ├── booking-blockchain.controller.ts   # Bookings
│   │   │   ├── review-blockchain.controller.ts    # Reviews
│   │   │   └── fiat-bridge.controller.ts          # Deposits/Withdrawals
│   │   │
│   │   ├── routes/              # API endpoints
│   │   ├── middleware/          # Auth, validation, etc.
│   │   └── index.ts             # Main server (NO PostgreSQL!)
│   │
│   ├── env.example              # Configuration template
│   └── package.json
│
├── web-app/                     # React frontend
│   ├── src/
│   │   ├── components/          # UI components
│   │   ├── pages/               # Pages/views
│   │   ├── hooks/               # Custom React hooks
│   │   └── services/            # API client
│   └── package.json
│
└── docs/                        # Documentation
    ├── DECENTRALIZED_ARCHITECTURE_ROADMAP.md
    ├── DECENTRALIZED_BUILD_STATUS.md
    ├── SESSION_SUMMARY.md
    └── ...
```

---

## 🔐 **Security**

### **Custodial Wallet Security**

1. **Private Key Encryption**
   - User password → scrypt key derivation
   - AES-256-GCM encryption
   - Never stored in plain text

2. **Deterministic Address Derivation**
   - Email → SHA-256 → Aptos address
   - Same email always generates same address
   - Enables password recovery

3. **Production Key Management**
   ```
   Development:  Password-encrypted keys in memory
   Staging:      AWS KMS for key encryption
   Production:   Google Cloud HSM / AWS CloudHSM
                 + Multisig for platform treasury
   ```

### **Platform Gas Fee Coverage**

- Platform pays ALL gas fees
- Users never interact with crypto wallets
- Gas costs absorbed into platform fee (5% on bookings)

---

## 🎭 **The Custodial Wallet Illusion**

### **How Users Experience It**

```javascript
// User signs up
const response = await fetch('/api/auth-blockchain/signup', {
  method: 'POST',
  body: JSON.stringify({
    email: 'student@calpoly.edu',
    password: 'mypassword123',
    username: 'john_doe',
    campus_domain: 'calpoly.edu',
    role: 'student'
  })
});

// Response:
{
  "success": true,
  "message": "Account created successfully!",
  "data": {
    "token": "eyJhbG...",
    "user": {
      "address": "0xabc123...",
      "email": "student@calpoly.edu",
      "username": "john_doe",
      "role": "student"
    }
  }
}

// User thinks: "Normal signup, like any other app"
// Reality: They just created a blockchain account with:
//   - Aptos address: 0xabc123...
//   - Encrypted private key stored in KMS
//   - On-chain user account created
//   - Ready to transact on blockchain
```

### **How Backend Handles It**

```typescript
// Custodial signer service (the magic!)
const account = await custodialSigner.createUserAccount(
  "student@calpoly.edu",
  "mypassword123"
);
// Returns:
// {
//   address: "0xabc123...",
//   publicKey: "0x456def...",
//   encryptedPrivateKey: "iv:tag:encrypted_data"
// }

// Sign transaction on behalf of user
const tx = await custodialSigner.signAndSubmitOptimistic(email, {
  function: `${moduleAddress}::user_accounts::register_user`,
  arguments: [emailHash, campusDomain, role, username]
});

// Transaction submitted to blockchain
// User gets instant confirmation
// Blockchain confirms in background (2-5 seconds)
```

---

## 📊 **Platform Economics**

### **Fees**

| Action | Fee | Who Pays |
|--------|-----|----------|
| Deposit (add funds) | FREE | User pays Stripe fee (~3%) |
| Booking | 5% | Deducted from total |
| Withdrawal | $1 flat | Deducted from amount |
| Gas fees | FREE | Platform absorbs all gas |

### **Example Booking Economics**

```
Student books: $30 haircut

Breakdown:
- Total charge: $30.00
- Platform fee:  $1.50 (5%)
- Barber gets:  $28.50

On-chain:
- Locked in escrow: 3 APT (@ $10/APT)
- Platform fee: 0.15 APT
- Barber receives: 2.85 APT
- Gas fee: ~0.001 APT (platform absorbs)

All handled by smart contract automatically!
```

---

## 🌐 **Environment Variables**

### **Required (Minimum Setup)**

```bash
# Aptos Blockchain
APTOS_PLATFORM_ADDRESS=0x...
APTOS_PLATFORM_PRIVATE_KEY=0x...
APTOS_MODULE_ADDRESS=0x...

# Custodial Wallet
CUSTODIAL_ENCRYPTION_SECRET=your-32-char-secret

# IPFS (Pinata)
PINATA_API_KEY=your-key
PINATA_SECRET_API_KEY=your-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### **Optional (Enhanced Features)**

```bash
# Redis (caching)
REDIS_URL=redis://localhost:6379

# Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Push notifications
FIREBASE_SERVICE_ACCOUNT={...}
```

---

## 🧪 **Testing**

### **Test the Blockchain Auth**

```bash
# Signup
curl -X POST http://localhost:3000/api/auth-blockchain/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@calpoly.edu",
    "password": "test123",
    "username": "testuser",
    "campus_domain": "calpoly.edu",
    "role": "student"
  }'

# Should return JWT token + user data
```

### **Test Blockchain Query**

```bash
# Get current user (from blockchain)
curl http://localhost:3000/api/auth-blockchain/me \
  -H "Authorization: Bearer <your-jwt-token>"

# Should return on-chain user data
```

### **Health Check**

```bash
curl http://localhost:3000/health

# Should return:
{
  "status": "healthy",
  "blockchain": "connected",
  "data_layer": "aptos + ipfs",
  "stats": {
    "total_users": 123,
    "total_bookings": 456
  }
}
```

---

## 📖 **Documentation**

| Document | Description |
|----------|-------------|
| `README.md` | This file - complete setup guide |
| `DECENTRALIZED_ARCHITECTURE_ROADMAP.md` | Complete architectural overview |
| `DECENTRALIZED_BUILD_STATUS.md` | Current build progress |
| `SESSION_SUMMARY.md` | Latest build session details |
| `CUSTODIAL_WALLET_ARCHITECTURE.md` | Detailed custodial wallet design |
| `GAS_FEE_ECONOMICS.md` | How platform absorbs gas fees |
| `STRIPE_CUSTODIAL_WALLET_INTEGRATION.md` | Fiat-blockchain bridge details |

---

## 🎯 **Key Features**

### **For Students**
- ✅ Sign up with .edu email (no wallet needed)
- ✅ Browse barbers by campus
- ✅ Book haircuts with credit card
- ✅ Automatic escrow protection
- ✅ Leave verified reviews
- ✅ Track booking history

### **For Barbers**
- ✅ Create professional profile
- ✅ Upload portfolio to IPFS
- ✅ Set availability and services
- ✅ Receive instant booking notifications
- ✅ Automatic payment on completion
- ✅ Cash out earnings to bank account

### **Platform Benefits**
- ✅ 85% lower operational costs
- ✅ Immutable review system (can't be faked)
- ✅ Transparent on-chain escrow
- ✅ Censorship-resistant
- ✅ Automated payments
- ✅ Real-time blockchain monitoring

---

## 🚀 **Deployment**

### **Smart Contracts**

```bash
# Deploy to Aptos devnet
cd contracts
aptos move publish --named-addresses campus_cuts=default --network devnet

# Deploy to Aptos mainnet (production)
aptos move publish --named-addresses campus_cuts=default --network mainnet
```

### **Backend**

```bash
# Option 1: Serverless (recommended)
# Deploy to AWS Lambda, Google Cloud Functions, or Vercel

# Option 2: Traditional server
# Deploy to AWS EC2, DigitalOcean, or any VPS
npm run build
npm start
```

### **Frontend**

```bash
# Option 1: IPFS (fully decentralized)
npm run build
ipfs add -r dist/

# Option 2: Traditional CDN
# Deploy to Vercel, Netlify, or Cloudflare Pages
npm run build
# Upload dist/ folder
```

---

## 🔍 **Monitoring**

### **Blockchain Monitoring**

```bash
# Real-time transaction feed
GET /api/admin/live-feed

# Platform statistics
GET /api/admin/stats

# Aptos Explorer (view all transactions)
https://explorer.aptoslabs.com/account/<your-module-address>?network=devnet
```

### **IPFS Monitoring**

```bash
# Pinata dashboard
https://app.pinata.cloud/

# View pinned content
# Check storage usage
# Monitor upload activity
```

---

## 🤝 **Contributing**

We welcome contributions! This project is open source.

### **Development Setup**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with blockchain-first architecture
5. Submit a pull request

### **Testing Guidelines**

- Test all API endpoints with blockchain integration
- Ensure frontend works with optimistic UI
- Verify smart contract functions correctly
- Test fiat deposit/withdrawal flows

---

## 📜 **License**

MIT License - see LICENSE file for details

---

## 🙏 **Acknowledgments**

Built with:
- Aptos Labs (blockchain infrastructure)
- Pinata (IPFS pinning service)
- Stripe (fiat payment processing)
- Open source community

---

## 📞 **Support**

- **Documentation:** See `/docs` folder
- **Issues:** GitHub Issues
- **Email:** support@campuscuts.app (coming soon)

---

## 🎉 **Why CampusCuts is Revolutionary**

1. **Web2 UX + Web3 Infrastructure** - Best of both worlds
2. **85% Cost Savings** - Blockchain is cheaper than databases
3. **Immutable Data** - Reviews can't be faked or deleted
4. **Trustless Escrow** - Smart contracts, not platform, hold funds
5. **Censorship-Resistant** - No single point of control
6. **Transparent** - All transactions auditable on-chain

**This is the future of campus marketplaces!** 🚀

---

**Ready to revolutionize campus services? Let's build!** 🎓✨
