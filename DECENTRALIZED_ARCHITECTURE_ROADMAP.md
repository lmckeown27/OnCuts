# CampusCuts: Decentralized-First Architecture Roadmap

> **Vision:** Fully decentralized infrastructure with Web2 user experience
> 
> **Principle:** Users interact with a familiar app, blockchain powers everything behind the scenes

---

## 🎯 **Core Philosophy**

```
USER PERCEPTION          ACTUAL REALITY
═══════════════          ══════════════
"Normal web app"    →    Fully on-chain dApp
Credit card payment →    USDC on Aptos blockchain  
Instant booking     →    Smart contract escrow
Profile picture     →    IPFS + on-chain CID
Review submitted    →    Immutable blockchain record
Chat message        →    Encrypted IPFS storage
```

**The user never knows they're using blockchain. That's the magic.** ✨

---

## 📊 **Architecture Comparison**

### **BEFORE (Hybrid - Current)**
```
┌──────────────────────────────────────┐
│  PostgreSQL Database (Primary)       │  $200/mo
│  ├─ Users, bookings, reviews         │
│  ├─ Balances, transactions           │
│  └─ All business logic               │
└──────────────────────────────────────┘
                ↓ (occasional anchoring)
┌──────────────────────────────────────┐
│  Aptos Blockchain (Audit Only)       │  $1/mo
│  └─ Hashes for transparency          │
└──────────────────────────────────────┘

Total: $650/month
```

### **AFTER (Decentralized-First - Target)**
```
┌──────────────────────────────────────┐
│  Aptos Blockchain (Primary)          │  $50/mo
│  ├─ User accounts & balances         │
│  ├─ Bookings with escrow             │
│  ├─ Reviews & ratings                │
│  ├─ Smart contract logic             │
│  └─ All state & events               │
└──────────────────────────────────────┘
                +
┌──────────────────────────────────────┐
│  IPFS (Media Storage)                │  $20/mo
│  ├─ Profile pictures                 │
│  ├─ Portfolio images                 │
│  ├─ Review text                      │
│  └─ Chat histories (encrypted)       │
└──────────────────────────────────────┘
                +
┌──────────────────────────────────────┐
│  Minimal Backend (Signing Service)   │  $10/mo
│  ├─ Custodial key management (KMS)   │
│  ├─ Transaction signing              │
│  ├─ Stripe fiat on-ramp              │
│  └─ IPFS upload proxy                │
└──────────────────────────────────────┘

Total: $90/month (86% reduction!)
```

---

## 🏗️ **Implementation Phases**

### **Phase 1: Foundation (Weeks 1-2)**
**Goal:** Build decentralized data layer

#### **1.1 Smart Contracts (Move)**
- [ ] `user_accounts.move` - Complete user state on-chain
  - User registration with derived addresses
  - USDC balances (available + locked)
  - Profile metadata (IPFS CIDs)
  - Campus affiliation
- [ ] `bookings.move` - Full booking lifecycle
  - Create booking with escrow
  - Complete booking (release funds)
  - Cancel booking (refund)
  - No-show penalties
- [ ] `reviews.move` - Immutable review system
  - On-chain ratings (1-5 stars)
  - IPFS review text CIDs
  - Weighted scoring integration
  - Barber aggregate ratings
- [ ] `marketplace.move` - Discovery & pricing
  - Barber profiles (services, pricing, portfolio CIDs)
  - Dynamic pricing integration
  - Performance scores
  - Campus marketplace logic

#### **1.2 IPFS Integration**
- [ ] IPFS service (Pinata/Web3.Storage)
- [ ] Image optimization pipeline
- [ ] CID storage on-chain
- [ ] Gateway URL generation
- [ ] Encrypted chat storage

#### **1.3 Custodial Key Management**
- [ ] Deterministic address derivation (email → seed)
- [ ] KMS/HSM integration for production
- [ ] Encrypted private key storage
- [ ] Password-based key decryption
- [ ] Account recovery flow

**Deliverables:**
- ✅ All smart contracts deployed to Aptos devnet
- ✅ IPFS service operational
- ✅ Key management system secure
- ✅ Unit tests for all contracts

---

### **Phase 2: Backend Refactor (Week 3)**
**Goal:** Convert backend from database-driven to blockchain-driven

#### **2.1 Remove PostgreSQL**
- [ ] Delete `schema.sql`, `schema-v2.sql`, etc.
- [ ] Remove all `pool.query()` calls
- [ ] Delete database services (`transaction.service`, `escrow.service`, etc.)
- [ ] Remove PostgreSQL from `docker-compose.yml`

#### **2.2 Blockchain Query Service**
- [ ] `blockchain-query.service.ts` - Read from Aptos
  - Get user account by address
  - Fetch booking history
  - Retrieve reviews
  - Query barber profiles
  - Listen for events
- [ ] Aptos indexer integration (fast queries)
- [ ] Local cache layer (Redis for speed)

#### **2.3 Transaction Signing Service**
- [ ] `custodial-signer.service.ts`
  - Load user key from KMS
  - Sign transaction with user's key
  - Submit to blockchain
  - Return tx hash immediately (optimistic)
- [ ] Batch transaction support
- [ ] Gas estimation & pre-flight checks
- [ ] Transaction retry logic

#### **2.4 Fiat On-Ramp (Stripe → USDC)**
- [ ] Accept credit card via Stripe
- [ ] Convert USD to USDC (Circle API or DEX)
- [ ] Credit user's on-chain balance
- [ ] Webhook for payment confirmations

**Deliverables:**
- ✅ Backend fully blockchain-driven
- ✅ No PostgreSQL dependency
- ✅ All reads from Aptos indexer
- ✅ All writes via smart contracts

---

### **Phase 3: Frontend Polish (Week 4)**
**Goal:** Create perfect Web2 illusion

#### **3.1 Optimistic UI Components**
- [ ] `useOptimisticMutation` hook
  - Show success immediately
  - Submit blockchain tx in background
  - Revert on failure (rare)
- [ ] Loading states that hide blockchain
- [ ] Skeleton screens during fetch
- [ ] Toast notifications

#### **3.2 Data Fetching**
- [ ] React Query integration
- [ ] Cache blockchain data in browser
- [ ] Optimistic updates
- [ ] Background refetching

#### **3.3 Error Handling**
- [ ] Graceful blockchain failures
- [ ] Retry logic with exponential backoff
- [ ] User-friendly error messages
  - ❌ "Transaction failed: insufficient gas"
  - ✅ "Oops! Something went wrong. Retrying..."

#### **3.4 Performance**
- [ ] IndexedDB caching
- [ ] Service Worker (PWA)
- [ ] Image lazy loading (IPFS)
- [ ] Preload critical data

**Deliverables:**
- ✅ App feels instant (optimistic UI)
- ✅ Users never see blockchain terms
- ✅ Errors handled gracefully
- ✅ Performance on par with Web2 apps

---

## 📝 **Key Technical Decisions**

### **1. Custodial Wallet Model**
**Decision:** Platform holds all private keys, not users

**Why:**
- Users don't need to understand wallets
- No seed phrases to lose
- Platform can batch transactions
- Recovery via email/password

**Tradeoff:**
- Users trust platform (like Coinbase)
- Platform has custody risk
- But: Users get Web2 UX

---

### **2. Optimistic UI Pattern**
**Decision:** Return success before blockchain confirms

**Implementation:**
```typescript
// Backend
async createBooking(data) {
  // 1. Return success immediately
  const tempId = generateTempId();
  res.json({ success: true, bookingId: tempId });
  
  // 2. Submit to blockchain asynchronously
  const txHash = await submitToBlockchain(data);
  
  // 3. WebSocket update with real ID
  io.emit('booking_confirmed', { tempId, realId, txHash });
}

// Frontend
function bookHaircut() {
  // 1. Show success toast immediately
  toast.success('Booking confirmed!');
  navigate('/bookings');
  
  // 2. Listen for blockchain confirmation
  socket.on('booking_confirmed', (data) => {
    // Update local state with real ID
    updateBooking(data.tempId, data.realId);
  });
}
```

---

### **3. IPFS for Media**
**Decision:** Store all images on IPFS, not S3

**Why:**
- Decentralized (censorship-resistant)
- Permanent storage
- Cheaper ($20/mo vs $50/mo)
- Content-addressed (built-in CDN)

**Implementation:**
```typescript
// Upload to IPFS
const { cid } = await ipfs.add(imageBuffer);
await pinata.pin(cid); // Ensure availability

// Store CID on-chain
await executeTransaction({
  function: '0x...::user::update_profile_photo',
  arguments: [cid.toString()],
});

// Serve to users via gateway
const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
```

---

### **4. Fiat → Crypto On-Ramp**
**Decision:** Stripe → Platform USDC Pool → User on-chain balance

**Flow:**
```
Student pays $30 via credit card
↓
Stripe processes payment
↓
Platform receives $30 USD
↓
Platform credits user 30 USDC on-chain
(from platform's USDC treasury pool)
↓
User can now book haircuts
```

**Alternative (future):** Direct USD → USDC via Circle API

---

## 💰 **Cost Analysis**

### **Current (Hybrid)**
| Service | Cost/Month |
|---------|------------|
| PostgreSQL (production) | $200 |
| AWS EC2 | $300 |
| S3 Storage | $50 |
| Redis | $50 |
| Load Balancer | $50 |
| **Total** | **$650** |

### **Decentralized-First**
| Service | Cost/Month |
|---------|------------|
| Aptos gas (1000 bookings) | $50 |
| IPFS pinning (100GB) | $20 |
| Minimal backend (serverless) | $10 |
| Domain + CDN | $10 |
| **Total** | **$90** |

**Annual Savings: $6,720 (86% reduction)**

---

## 🔒 **Security Considerations**

### **1. Private Key Management**
- **Dev/Test:** Encrypted in `.env` (acceptable)
- **Production:** AWS KMS or Google Cloud HSM (mandatory)
- **Never:** Store plain-text private keys

### **2. Escrow Safety**
- **Smart contracts audited** before mainnet
- **Timelock on escrows** (auto-refund after 30 days)
- **Multisig for platform treasury** (>$10K moves)

### **3. IPFS Pinning**
- **Multiple pin services** (Pinata + Web3.Storage)
- **Redundancy** ensures availability
- **CID verification** (content can't be tampered)

---

## 🧪 **Testing Strategy**

### **Smart Contracts**
```bash
# Unit tests
aptos move test

# Integration tests (devnet)
npm run test:contracts

# Formal verification (critical functions)
aptos move prove
```

### **Backend**
```bash
# Mock blockchain responses
npm run test:backend

# E2E with devnet
npm run test:e2e
```

### **Frontend**
```bash
# Unit tests
npm run test:unit

# E2E with Playwright
npm run test:e2e
```

---

## 📦 **Deployment**

### **Smart Contracts**
```bash
# Devnet (testing)
aptos move publish --network devnet

# Testnet (staging)
aptos move publish --network testnet

# Mainnet (production - after audit)
aptos move publish --network mainnet
```

### **Backend**
```bash
# Serverless (Vercel/Netlify/Railway)
git push origin main

# Auto-deploy on commit
```

### **Frontend**
```bash
# IPFS (fully decentralized)
npm run build
ipfs add -r dist/
pinata pin <CID>

# Access via: https://gateway.pinata.cloud/ipfs/<CID>
```

---

## 🎯 **Success Metrics**

| Metric | Target |
|--------|--------|
| **Infrastructure Cost** | < $100/month |
| **Page Load Time** | < 2 seconds |
| **Booking Success Rate** | > 99% |
| **Users Knowing It's Blockchain** | 0% |
| **Uptime** | > 99.9% (blockchain never down) |
| **Cost per Booking** | < $0.10 |

---

## 📚 **Key Files to Create/Modify**

### **New Files**
```
contracts/sources/
├─ user_accounts.move (new)
├─ bookings.move (new)
├─ reviews.move (new)
└─ marketplace.move (new)

backend/src/services/
├─ blockchain-query.service.ts (new)
├─ custodial-signer.service.ts (new)
├─ ipfs.service.ts (new)
└─ usdc-onramp.service.ts (new)

backend/src/utils/
└─ optimistic-response.ts (new)
```

### **Files to Delete**
```
backend/src/database/
├─ schema.sql (delete)
├─ schema-v2.sql (delete)
├─ schema-dynamic-pricing.sql (delete)
├─ schema-student-grading.sql (delete)
└─ connection.ts (delete)

backend/src/services/
├─ transaction.service.ts (delete)
├─ escrow.service.ts (delete)
├─ reconciliation.service.ts (delete)
└─ mock.database.service.ts (delete)
```

### **Files to Heavily Refactor**
```
backend/src/controllers/
├─ barber.controller.ts (query blockchain, not DB)
├─ booking.controller.ts (submit to contracts)
└─ user.controller.ts (on-chain user accounts)

web-app/src/services/
├─ api.service.ts (optimistic patterns)
└─ barber.service.ts (blockchain queries)

web-app/src/hooks/
└─ useOptimisticMutation.ts (new)
```

---

## 🚀 **Let's Go!**

**Current Status:** Ready to start Phase 1

**Next Steps:**
1. ✅ Create comprehensive Move smart contracts
2. ✅ Build IPFS service
3. ✅ Implement custodial key management
4. ✅ Refactor backend to be blockchain-first
5. ✅ Update frontend with optimistic UI

**ETA:** 4-6 weeks to full decentralization

**The revolution starts now!** 🔥

