# Gas Fee Economics in CampusCuts

## 📘 **Overview**

CampusCuts uses the **Aptos blockchain** for transparency and auditability, but blockchain transactions require **gas fees** (paid in APT). This document explains who pays for gas, when gas is consumed, and how the platform minimizes costs.

---

## 🎯 **Core Principle: Platform Pays All Gas**

### **User Experience:**
- ✅ **Students:** Never pay gas fees (only Stripe payment processing)
- ✅ **Barbers:** Never pay gas fees (receive payouts via Stripe)
- ✅ **Platform:** Absorbs all Aptos gas costs as operational expense

### **Why This Matters:**
- No crypto knowledge required
- No wallet setup needed
- No APT token purchases
- Seamless fiat-only experience

---

## 💰 **Who Pays What?**

| **Party** | **Stripe Fees** | **Aptos Gas Fees** | **Platform Fees** |
|-----------|----------------|-------------------|------------------|
| **Student** | ✅ (credit card fee) | ❌ Platform pays | ✅ (5% on services) |
| **Barber** | ❌ Platform pays | ❌ Platform pays | ❌ |
| **Platform** | ✅ (payouts, transfers) | ✅ All gas | ✅ (earns 5%) |

---

## ⛽ **Platform Gas Wallet**

### **Dedicated Wallet for Gas:**

```
Address: 0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa
Network: Aptos Devnet (for now)
Purpose: Pay gas for all on-chain transactions
Balance: Monitored 24/7 by admin dashboard
```

### **Gas Wallet Management:**

```
┌──────────────────────────────────────────┐
│   Platform Gas Wallet (Aptos)            │
│   Address: 0x50c7b...                    │
│   Balance: 1,000 APT                     │
└───────────┬──────────────────────────────┘
            │
            │ Signs all on-chain transactions
            │
            ▼
┌──────────────────────────────────────────┐
│   Aptos Blockchain                       │
│   - Anchor booking hashes                │
│   - Batch withdrawals                    │
│   - On-chain proofs                      │
└──────────────────────────────────────────┘
```

---

## 🔥 **What Operations Cost Gas?**

### **1. On-Chain Anchoring (Hash Proofs)**

**Operation:** Store hash of critical events on-chain for auditability

**Cost:** ~0.0001 APT per transaction

**Frequency:** Daily batch (not per booking)

**Example:**
```typescript
// Anchor completed booking hash
await aptosService.submitHashProof(
  'booking_completed',
  bookingHash,
  { bookingId, studentId, barberId, amount }
);
```

**What Gets Hashed:**
- Booking completion records
- Batch withdrawal proofs
- Platform fee collections
- Critical audit events

**Gas Cost:**
- 1 hash proof ≈ 0.0001 APT
- 1,000 bookings/day → 1 batch → 0.0001 APT/day
- Monthly cost: ~0.003 APT ($0.01)

---

### **2. Batch On-Chain Withdrawals**

**Operation:** When users withdraw APT to external wallets (rare)

**Cost:** ~0.005 APT per batch (not per user)

**Frequency:** Daily batch of all pending withdrawals

**Example:**
```typescript
// Batch 10 withdrawals into 1 transaction
await aptosService.submitBatchWithdrawal([
  { userId: 'user-1', amount: 50, destination: '0xabc...' },
  { userId: 'user-2', amount: 30, destination: '0xdef...' },
  // ... 8 more
]);
```

**Gas Savings:**
- 10 separate transactions: 10 × 0.005 APT = 0.05 APT
- 1 batched transaction: 0.005 APT
- **Savings: 90%**

---

### **3. Barber Registration (Future)**

**Operation:** Register barber metadata on-chain (optional transparency)

**Cost:** ~0.001 APT per barber

**Frequency:** One-time per barber

**Example:**
```typescript
await aptosService.registerBarber(
  barberId,
  {
    name: "John's Cuts",
    campus: "Cal Poly SLO",
    servicesHash: "0x123..."
  }
);
```

---

### **4. Review Submissions (Future)**

**Operation:** Store review hashes on-chain for immutability

**Cost:** ~0.0002 APT per review

**Frequency:** Optional (batched daily)

---

## 📊 **Gas Cost Breakdown**

### **Monthly Gas Budget (1,000 bookings/month):**

| **Operation** | **Frequency** | **Cost per Tx** | **Monthly Total** |
|---------------|---------------|-----------------|-------------------|
| Booking hash anchoring | 30 batches/month | 0.0001 APT | 0.003 APT |
| Batch withdrawals | 10 batches/month | 0.005 APT | 0.05 APT |
| Barber registrations | 20/month | 0.001 APT | 0.02 APT |
| Review hashes | 30 batches/month | 0.0001 APT | 0.003 APT |
| **TOTAL** | | | **0.076 APT/month** |

**At $10/APT:** 0.076 APT × $10 = **$0.76/month**

**Platform Revenue (5% fee on 1,000 × $30 bookings):**
- 1,000 bookings × $30 × 5% = **$1,500/month**

**Gas as % of Revenue:** $0.76 / $1,500 = **0.05%**

---

## 💡 **Cost Optimization Strategies**

### **1. Batching (Implemented)**

Instead of 1 transaction per action, batch multiple actions:

```typescript
// ❌ Bad: 100 separate transactions
for (const booking of completedBookings) {
  await aptosService.submitHashProof(booking.hash);
  // Cost: 100 × 0.0001 APT = 0.01 APT
}

// ✅ Good: 1 batched transaction
await aptosService.submitBatchHashProofs(
  completedBookings.map(b => b.hash)
);
// Cost: 1 × 0.0001 APT = 0.0001 APT
// Savings: 99%
```

### **2. Hash-Only Storage (Implemented)**

Instead of storing full data on-chain, only store hashes:

```typescript
// ❌ Expensive: Store full booking data on-chain
await aptosService.storeBooking({
  bookingId: "booking-123",
  studentId: "student-1",
  barberId: "barber-1",
  service: "Fade + Beard Trim",
  price: 30,
  timestamp: "2025-11-29T10:00:00Z",
  location: "Cal Poly SLO Dorms",
  notes: "Low fade, clean up beard edges"
});
// Cost: ~0.01 APT (lots of data)

// ✅ Cheap: Store only hash
const bookingData = {
  bookingId: "booking-123",
  studentId: "student-1",
  barberId: "barber-1",
  service: "Fade + Beard Trim",
  price: 30,
  timestamp: "2025-11-29T10:00:00Z"
};
const hash = sha256(JSON.stringify(bookingData));

await aptosService.submitHashProof('booking_completed', hash, {
  bookingId: "booking-123"
});
// Cost: 0.0001 APT (just a hash)
// Savings: 99%
```

### **3. Off-Chain Ledger for Most Operations (Implemented)**

99% of operations happen in the custodial wallet (free):

```
┌────────────────────────────────────────────────┐
│   OFF-CHAIN (FREE)                             │
├────────────────────────────────────────────────┤
│ ✅ Student deposits (Stripe → Custodial)       │
│ ✅ Booking escrow holds                        │
│ ✅ Escrow releases                             │
│ ✅ Internal balance transfers                  │
│ ✅ Barber payouts (Custodial → Stripe)         │
│ ✅ Platform fee collection                     │
│ ✅ Tips between users                          │
│ ✅ Refunds                                     │
│                                                │
│ Total Gas Cost: $0                             │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│   ON-CHAIN (COSTS GAS)                         │
├────────────────────────────────────────────────┤
│ ⛽ Booking completion hash (batched daily)     │
│ ⛽ Batch withdrawals to external wallets       │
│ ⛽ Critical audit trail anchoring              │
│                                                │
│ Total Gas Cost: $0.76/month                    │
└────────────────────────────────────────────────┘
```

### **4. Lazy On-Chain Sync (Implemented)**

Critical events are batched and synced once per day:

```typescript
// Daily cron job (runs at 2 AM)
async function syncCriticalEventsToBlockchain() {
  // 1. Get all completed bookings since last sync
  const completedBookings = await db.query(
    'SELECT * FROM bookings WHERE status = "completed" AND synced_to_chain = false'
  );

  // 2. Batch hash them
  const hashes = completedBookings.map(b => 
    sha256(JSON.stringify({
      bookingId: b.id,
      studentId: b.student_id,
      barberId: b.barber_id,
      amount: b.amount,
      completedAt: b.completed_at
    }))
  );

  // 3. Single on-chain transaction
  await aptosService.submitBatchHashProofs('booking_completions', hashes);

  // 4. Mark as synced
  await db.query('UPDATE bookings SET synced_to_chain = true WHERE id IN (...)')
}
```

**Result:** 1,000 bookings → 1 transaction → 0.0001 APT

---

## 🔐 **Gas Wallet Security**

### **Private Key Management:**

```typescript
// backend/.env (NEVER commit to git)
APTOS_PLATFORM_PRIVATE_KEY=0x742f...  // 🔒 Encrypted in production
```

**Production Security:**
- Private key stored in AWS KMS or Google Secret Manager
- Never hardcoded in source code
- Rotated quarterly
- Multisig for large treasury movements (future)

### **Hot vs Cold Wallet (Future):**

```
┌──────────────────────────────────────┐
│   HOT WALLET (Gas Operations)        │
│   Balance: 100 APT                   │
│   Daily spending limit: 10 APT       │
│   Auto-refilled from cold wallet     │
└──────────────────────────────────────┘
            ↑
            │ Refill when balance < 20 APT
            │
┌──────────────────────────────────────┐
│   COLD WALLET (Treasury)             │
│   Balance: 10,000 APT                │
│   Multisig required for withdrawals  │
│   Offline storage                    │
└──────────────────────────────────────┘
```

---

## 📈 **Gas Monitoring & Top-Up**

### **Admin Dashboard View:**

The admin can see real-time gas wallet status:

```
┌─────────────────────────────────────────────┐
│  ⛽ GAS WALLET MANAGEMENT                    │
├─────────────────────────────────────────────┤
│                                             │
│  Current Balance: 847.23 APT                │
│  Estimated Daily Usage: 0.05 APT            │
│  Days Until Empty: 16,944 days              │
│                                             │
│  ⚠️  Alerts:                                │
│  🟢 Healthy - Balance above threshold       │
│                                             │
│  Recent Transactions:                       │
│  • 0.0001 APT - Batch hash anchoring        │
│  • 0.005 APT  - Withdrawal batch (10 users) │
│  • 0.0002 APT - Review batch (50 reviews)   │
│                                             │
│  [Create Top-Up Request]                    │
│                                             │
└─────────────────────────────────────────────┘
```

### **Automated Alerts:**

```typescript
// Gas monitor service (runs every 30 minutes)
async function checkGasLevels() {
  const balance = await aptosService.getAccountBalance();
  const dailyUsage = await calculateAverageDailyGasUsage();
  const daysRemaining = balance / dailyUsage;

  if (daysRemaining < 30) {
    await notificationService.alertAdmin({
      type: 'gas_low',
      message: `Gas wallet has ${daysRemaining} days remaining`,
      balance,
      recommendedTopUp: dailyUsage * 90 // 90 days
    });
  }
}
```

### **Top-Up Process:**

1. **Admin gets alert:** "Gas wallet below 30-day threshold"
2. **Admin creates top-up request** in dashboard
3. **System generates top-up instructions:**
   ```
   Send APT to:
   0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa
   
   Recommended amount: 5 APT (~$50)
   Current balance: 0.5 APT
   ```
4. **Admin uses Petra Wallet or Aptos CLI:**
   ```bash
   aptos account transfer \
     --account 0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa \
     --amount 500000000  # 5 APT in octas
   ```
5. **System verifies transaction on-chain** and updates dashboard

---

## 💸 **Complete Payment Flow with Gas**

### **Example: $30 Haircut Booking**

```
┌──────────────────────────────────────────────────────┐
│  STEP 1: STUDENT DEPOSITS $50                        │
└──────────┬───────────────────────────────────────────┘
           │
           │ Stripe charges card: $50 + 2.9% + $0.30 = $51.75
           │ Platform receives: $50
           │ GAS COST: $0 (Stripe only)
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  Custodial Wallet: Student balance = $50             │
│  GAS COST: $0 (off-chain database update)            │
└──────────┬───────────────────────────────────────────┘
           │
┌──────────┴───────────────────────────────────────────┐
│  STEP 2: STUDENT BOOKS $30 HAIRCUT                   │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  Custodial Wallet Escrow:                            │
│  - Student available: $20                            │
│  - Student pending: $30                              │
│  GAS COST: $0 (off-chain database update)            │
└──────────┬───────────────────────────────────────────┘
           │
┌──────────┴───────────────────────────────────────────┐
│  STEP 3: BARBER COMPLETES SERVICE                    │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  Custodial Wallet Release:                           │
│  - Student pending: $0                               │
│  - Barber available: $28.50 (95%)                    │
│  - Platform fees: $1.50 (5%)                         │
│  GAS COST: $0 (off-chain database update)            │
└──────────┬───────────────────────────────────────────┘
           │
           │ ⛽ OPTIONAL: Anchor booking hash on-chain
           │    (batched with other bookings at 2 AM)
           │    Platform pays: 0.0001 APT (~$0.001)
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  Aptos Blockchain (batched daily)                    │
│  - Hash: sha256(booking-123 + student-1 + ...)       │
│  - Timestamp: 2025-11-29T10:00:00Z                   │
│  - Paid by: Platform Gas Wallet                      │
│  GAS COST: $0.001 (platform absorbs)                 │
└──────────┬───────────────────────────────────────────┘
           │
┌──────────┴───────────────────────────────────────────┐
│  STEP 4: BARBER INSTANT PAYOUT                       │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────┐
│  Stripe Connect Transfer:                            │
│  - Barber receives: $28.50 in bank account           │
│  - Platform pays Stripe fee: ~$0.85                  │
│  - Custodial wallet debited: $28.50                  │
│  GAS COST: $0 (Stripe only)                          │
└──────────────────────────────────────────────────────┘
```

### **Total Costs Paid by Platform:**
- Stripe deposit fee: $1.75 (student paid)
- Stripe transfer fee: $0.85 (platform paid)
- Aptos gas fee: $0.001 (platform paid)
- **Platform net cost: $0.851**
- **Platform revenue: $1.50**
- **Platform profit: $0.649 per booking**

---

## 🎯 **Gas Economics Summary**

### **Key Metrics:**

| **Metric** | **Value** |
|------------|-----------|
| **Gas cost per booking** | $0.001 |
| **Gas cost as % of revenue** | 0.05% |
| **Monthly gas budget (1K bookings)** | $0.76 |
| **Annual gas budget (12K bookings)** | $9.12 |
| **Platform revenue (1K bookings)** | $1,500 |
| **Gas ROI** | 19,600% |

### **Why This Works:**

1. **Volume Economics:** Fixed gas cost per batch, infinite users per batch
2. **Off-chain First:** 99% of operations free (custodial wallet)
3. **Strategic On-chain:** Only critical audit trail on blockchain
4. **User Abstraction:** Students/barbers never see crypto
5. **Platform Value:** 5% fee >> gas costs

---

## 📚 **Related Documentation**

- [**CUSTODIAL_WALLET_ARCHITECTURE.md**](./CUSTODIAL_WALLET_ARCHITECTURE.md) - Full custodial wallet details
- [**STRIPE_CUSTODIAL_WALLET_INTEGRATION.md**](./STRIPE_CUSTODIAL_WALLET_INTEGRATION.md) - Stripe + wallet integration
- [**GAS_WALLET_OPERATIONS_README.md**](./GAS_WALLET_OPERATIONS_README.md) - Admin gas management guide

---

## 🎯 **Bottom Line**

### **For Users:**
- ✅ **No gas fees ever**
- ✅ **No crypto needed**
- ✅ **Just credit cards & bank accounts**

### **For Platform:**
- ✅ **Negligible gas costs** (0.05% of revenue)
- ✅ **Blockchain transparency** (critical events on-chain)
- ✅ **Scalable economics** (batching = 90%+ savings)

### **Result:**
**CampusCuts gets blockchain benefits (transparency, auditability) without blockchain UX problems (wallets, gas, crypto)** while keeping costs at **$0.76/month for 1,000 bookings**. 🚀

---

## 💡 **Future Optimizations**

### **1. Aptos Subsidized Transactions (Potential)**
- Work with Aptos Foundation for gas grants
- Protocol-level subsidies for dApps
- Could reduce gas costs to near-zero

### **2. Layer 2 / Rollup (If Needed)**
- Move hash anchoring to Aptos L2
- Even cheaper gas (10-100x reduction)
- Same security guarantees

### **3. Sponsored Transactions (Future)**
- Users could optionally pay their own gas
- Advanced users who want full on-chain presence
- Platform still pays by default

### **4. Dynamic Batching (Future)**
- Adjust batch frequency based on volume
- High volume: batch every hour (more frequent)
- Low volume: batch weekly (less frequent)
- Optimize gas vs freshness tradeoff

