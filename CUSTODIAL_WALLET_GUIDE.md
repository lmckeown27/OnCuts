# CampusCuts Custodial Wallet System

## 🏦 Overview

CampusCuts implements a **Coinbase-style custodial wallet system** where all payments, tips, and transfers happen off-chain through an internal ledger. Users never need to know about blockchain or cryptocurrency - they just see USD balances in their account.

---

## 🎯 Core Concept

### What is a Custodial Wallet?

Like Coinbase, CampusCuts holds user funds in a **platform master account** and tracks individual balances in an **internal ledger**. This means:

- ✅ **Instant** internal transfers (no blockchain delays)
- ✅ **Zero-cost** tips and payments (no transaction fees)
- ✅ **Complete** transaction history
- ✅ **Atomic** operations (no race conditions)
- ✅ **Flexible** refunds, promos, and credits
- ✅ **Scalable** to millions of users

### External vs. Internal

| Type | What Happens | Cost | Speed |
|------|-------------|------|-------|
| **External** (Deposit/Withdrawal) | Money enters/leaves via Stripe | Stripe fee (~2.9%) | 1-3 days |
| **Internal** (Booking/Tip/Refund) | Balance updates in ledger | $0.00 | Instant |

---

## 💰 Balance Types

Each user has three balance buckets:

### 1. **Available Balance** (`balance_available`)
- Funds ready to spend or withdraw
- Used for: new bookings, tips, withdrawals
- Example: Student has $100 available → can book any barber

### 2. **Pending Balance** (`balance_pending`)
- Funds held until service completion
- Used for: barber earnings awaiting service completion
- Example: Barber completes haircut → pending becomes available

### 3. **Locked Balance** (`balance_locked`)
- Funds frozen during disputes
- Used for: dispute resolution, chargebacks
- Example: Customer disputes charge → funds locked until resolved

**All balances stored in CENTS to avoid floating-point errors.**

---

## 🔄 Transaction Flow Examples

### 1. **Deposit Flow** (Money Enters CampusCuts)

```
Customer adds $100 to wallet:
┌─────────────┐
│ Stripe Card │ ─── $100 ──→ Platform Account
└─────────────┘
                      ↓
              Ledger Entry Created:
              user_id: customer_123
              amount: +10000 cents
              type: DEPOSIT
              balance_type: available
                      ↓
              customer.balance_available = 10000 cents ($100)
```

**Code:**
```typescript
await paymentService.processDeposit({
  userId: 'customer_123',
  amountCents: 10000,
  paymentMethodId: 'pm_stripe_123',
  description: 'Wallet deposit',
});
```

### 2. **Booking Payment Flow** (Internal Transfer)

```
Customer books $30 haircut + $5 tip:
┌──────────┐                      ┌────────┐
│ Customer │ ─── $30 + $5 ──→ │ Barber │
└──────────┘                      └────────┘
     ↓                               ↓
customer.available -= 3500      barber.pending += 3325 (minus 5% fee)
                                     barber.available += 500 (tip)
                                     platform_fee = 175 ($1.75)
```

**Code:**
```typescript
await paymentService.processBookingPayment({
  bookingId: 'booking_456',
  customerId: 'customer_123',
  barberId: 'barber_789',
  totalAmountCents: 3000, // $30
  tipAmountCents: 500,     // $5
});
```

**Ledger Entries Created:**
1. Customer: -3500 (BOOKING_PAYMENT, available)
2. Barber: +3325 (BOOKING_PAYMENT, pending)
3. Barber: +500 (TIP, available)
4. Barber: -175 (PLATFORM_FEE, available)

### 3. **Service Completion Flow** (Pending → Available)

```
Barber completes service:
┌────────┐
│ Barber │
└────────┘
     ↓
barber.pending -= 3325
barber.available += 3325
```

**Code:**
```typescript
await paymentService.releaseBookingFunds({
  bookingId: 'booking_456',
  barberId: 'barber_789',
  amountCents: 3325,
});
```

### 4. **Withdrawal Flow** (Money Exits CampusCuts)

```
Barber withdraws $100:
┌────────┐
│ Barber │ balance_available -= 10000
└────────┘
     ↓
Stripe Connect Payout
     ↓
Barber's Bank Account: +$100
```

**Code:**
```typescript
await payoutService.createWithdrawalRequest({
  user_id: 'barber_789',
  amount: 10000, // $100 in cents
  stripe_destination_id: 'acct_stripe_connect_123',
});
```

### 5. **Tip Flow** (Instant Internal Transfer)

```
Customer tips $5:
┌──────────┐              ┌────────┐
│ Customer │ ─── $5 ──→ │ Barber │
└──────────┘              └────────┘
     ↓                        ↓
-500 (available)        +500 (available)
```

**Code:**
```typescript
await paymentService.processTip({
  fromUserId: 'customer_123',
  toUserId: 'barber_789',
  amountCents: 500,
  bookingId: 'booking_456',
});
```

### 6. **Refund Flow** (Booking Cancelled)

```
Booking cancelled → auto refund:
┌────────┐              ┌──────────┐
│ Barber │ ─── $30 ──→ │ Customer │
└────────┘              └──────────┘
(pending)                 (available)
```

**Code:**
```typescript
await paymentService.refundBookingPayment({
  bookingId: 'booking_456',
  customerId: 'customer_123',
  barberId: 'barber_789',
  totalAmountCents: 3000,
});
```

---

## 🔐 Transaction Types

All financial events are categorized:

| Type | Direction | Description | Balance Type |
|------|-----------|-------------|--------------|
| `DEPOSIT` | +USD | Card/bank deposit | available |
| `WITHDRAWAL` | -USD | Cash out to bank | available |
| `BOOKING_PAYMENT` | Transfer | Customer → Barber | pending |
| `BOOKING_REFUND` | Transfer | Barber → Customer | available |
| `SERVICE_COMPLETION` | Internal | Pending → Available | available |
| `TIP` | Transfer | Customer → Barber | available |
| `PLATFORM_FEE` | -USD | 5% commission | available |
| `PROMOTIONAL_CREDIT` | +USD | Platform promo | available |
| `DISPUTE_HOLD` | Internal | Available → Locked | locked |
| `DISPUTE_RELEASE` | Internal | Locked → Available | available |
| `ADJUSTMENT` | +/- USD | Admin correction | available |

---

## 📡 API Endpoints

### User Endpoints

#### GET `/api/wallet/balance`
Get current wallet balance.

**Response:**
```json
{
  "success": true,
  "data": {
    "available": 125.00,
    "pending": 50.00,
    "locked": 0.00,
    "total": 175.00,
    "available_cents": 12500,
    "pending_cents": 5000,
    "locked_cents": 0,
    "total_cents": 17500
  }
}
```

#### POST `/api/wallet/deposit/intent`
Create a deposit payment intent.

**Request:**
```json
{
  "amount": 100  // Dollars
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_yyy",
    "paymentIntentId": "pi_xxx"
  }
}
```

#### GET `/api/wallet/transactions`
Get transaction history.

**Query Params:**
- `limit` (default: 50)
- `offset` (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "ledger_123",
        "amount": 10000,
        "amount_dollars": 100,
        "type": "DEPOSIT",
        "balance_type": "available",
        "balance_after": 10000,
        "description": "Wallet deposit",
        "created_at": "2025-11-01T12:00:00Z"
      }
    ],
    "total": 25,
    "limit": 50,
    "offset": 0
  }
}
```

#### POST `/api/wallet/withdraw`
Request a withdrawal.

**Request:**
```json
{
  "amount": 50  // Dollars
}
```

#### GET `/api/wallet/withdrawals`
Get withdrawal history.

#### DELETE `/api/wallet/withdrawals/:id`
Cancel a pending withdrawal.

#### POST `/api/wallet/tip`
Send a tip to a barber.

**Request:**
```json
{
  "toUserId": "barber_789",
  "amount": 5,  // Dollars
  "bookingId": "booking_456" // Optional
}
```

### Admin Endpoints

#### POST `/api/wallet/admin/credit`
Issue promotional credit.

**Request:**
```json
{
  "userId": "customer_123",
  "amount": 10,
  "description": "Welcome bonus"
}
```

#### GET `/api/wallet/admin/users/:userId/balance`
Get any user's balance (admin only).

---

## 💻 Code Examples

### Frontend: Check Balance

```typescript
import walletService from '@services/wallet.service';

const balance = await walletService.getBalance();
console.log(`Available: $${balance.available}`);
console.log(`Pending: $${balance.pending}`);
```

### Frontend: Add Funds

```typescript
// Step 1: Create deposit intent
const { clientSecret } = await walletService.createDepositIntent(100);

// Step 2: Use Stripe Elements to collect payment
const stripe = await loadStripe(STRIPE_PUBLIC_KEY);
const { error } = await stripe.confirmPayment({
  clientSecret,
  confirmParams: {
    return_url: 'https://campuscuts.app/wallet/success',
  },
});
```

### Frontend: Request Withdrawal

```typescript
await walletService.requestWithdrawal(50); // $50
toast.success('Withdrawal request submitted');
```

### Backend: Process Booking

```typescript
// Already integrated in booking.controller.ts
await paymentService.processBookingPayment({
  bookingId,
  customerId,
  barberId,
  totalAmountCents: 3000,
  tipAmountCents: 500,
});
```

---

## 🔒 Security Features

1. **Atomic Transactions**
   - Database-level transactions with `BEGIN`/`COMMIT`
   - `FOR UPDATE` locks prevent race conditions
   - Either all operations succeed or all fail

2. **Balance Validation**
   - Balances can NEVER go negative
   - Database CHECK constraints enforce non-negative balances
   - Ledger service validates before each operation

3. **Audit Trail**
   - Every balance change logged in `ledger_entries`
   - Immutable transaction history
   - Full metadata for reconciliation

4. **Idempotency**
   - Each operation has a unique reference_id
   - Prevents duplicate charges/refunds
   - Safe to retry failed operations

---

## 📊 Database Schema

### Users Table (Updated)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  ...
  balance_available INTEGER DEFAULT 0,  -- Cents
  balance_pending INTEGER DEFAULT 0,    -- Cents
  balance_locked INTEGER DEFAULT 0,     -- Cents
  stripe_account_id VARCHAR(255),       -- For withdrawals
  ...
);
```

### Ledger Entries Table (New)
```sql
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  amount INTEGER,                    -- Cents (can be negative)
  type VARCHAR(50),                  -- Transaction type
  balance_type VARCHAR(20),          -- available/pending/locked
  balance_after INTEGER,             -- Balance snapshot
  reference_type VARCHAR(50),        -- 'booking', 'payout', etc.
  reference_id VARCHAR(255),         -- Related entity ID
  metadata JSONB,                    -- Additional data
  description TEXT,
  created_at TIMESTAMP,
  created_by UUID                    -- For admin actions
);
```

### Withdrawal Requests Table (New)
```sql
CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  amount INTEGER,                    -- Cents
  status VARCHAR(50),                -- pending/processing/completed/failed
  stripe_payout_id VARCHAR(255),
  stripe_destination_id VARCHAR(255),
  requested_at TIMESTAMP,
  processed_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

---

## 🚀 Quick Start

### 1. Check Balance
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/wallet/balance
```

### 2. View Transaction History
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3001/api/wallet/transactions?limit=20"
```

### 3. Request Withdrawal
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}' \
  http://localhost:3001/api/wallet/withdraw
```

### 4. Send Tip
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toUserId": "barber_789", "amount": 5, "bookingId": "booking_456"}' \
  http://localhost:3001/api/wallet/tip
```

---

## 📈 Mock Data

### Sample Users with Balances

| User | Type | Available | Pending | Total |
|------|------|-----------|---------|-------|
| Alex (student) | Student | $100.00 | $0 | $100.00 |
| Emma (student) | Student | $100.00 | $0 | $100.00 |
| Carlos (barber) | Barber | $125.00 | $50.00 | $175.00 |
| David (barber) | Barber | $125.00 | $50.00 | $175.00 |
| Sarah (student) | Student | $100.00 | $0 | $100.00 |

### Sample Ledger Entries

1. **Student deposit**: Alex deposits $100
2. **Booking payment**: Emma books Carlos for $30
3. **Service completion**: Carlos completes booking, $28.50 pending → available
4. **Tip**: Customer tips David $5
5. **Platform fee**: Carlos charged $1.50 (5%)
6. **Withdrawal**: David withdraws $50 to bank
7. **Promo credit**: Sarah receives $100 welcome bonus

---

## 🔧 Services Architecture

### LedgerService (`backend/src/services/ledger.service.ts`)

Core custodial wallet logic:

```typescript
class LedgerService {
  // Get user balances
  async getUserBalance(userId: string): Promise<UserBalance>
  
  // Create single ledger entry (atomic)
  async createLedgerEntry(input: CreateLedgerEntryInput): Promise<LedgerEntry>
  
  // Transfer between two users (double-entry, atomic)
  async internalTransfer(input: InternalTransferInput): Promise<{ debit, credit }>
  
  // Process booking payment (multi-entry, atomic)
  async processBookingPayment(input: BookingPaymentInput): Promise<void>
  
  // Release funds (pending → available)
  async releaseBookingFunds(bookingId, barberId, amount): Promise<void>
  
  // Get transaction history
  async getLedgerHistory(userId, limit, offset): Promise<{ entries, total }>
}
```

### PaymentService (`backend/src/services/payment.service.ts`)

Integrates Stripe with ledger:

```typescript
class PaymentService {
  // Process deposit from Stripe
  async processDeposit(params): Promise<{ ledgerEntryId, stripeChargeId }>
  
  // Create payment intent for deposits
  async createDepositIntent(params): Promise<{ clientSecret, paymentIntentId }>
  
  // Confirm deposit from webhook
  async confirmDeposit(paymentIntentId): Promise<void>
  
  // Process booking payment through ledger
  async processBookingPayment(params): Promise<void>
  
  // Process tip
  async processTip(params): Promise<void>
  
  // Refund booking payment
  async refundBookingPayment(params): Promise<void>
  
  // Release booking funds
  async releaseBookingFunds(params): Promise<void>
  
  // Issue promo credit
  async issuePromotionalCredit(params): Promise<void>
}
```

### PayoutService (`backend/src/services/payout.service.ts`)

Handles withdrawals via Stripe Connect:

```typescript
class PayoutService {
  // Create withdrawal request
  async createWithdrawalRequest(input): Promise<WithdrawalRequest>
  
  // Process withdrawal (internal → Stripe)
  async processWithdrawal(withdrawalId): Promise<void>
  
  // Create Stripe Connect account
  async createConnectedAccount(userId, email): Promise<string>
  
  // Generate onboarding link
  async createAccountLink(accountId, returnUrl, refreshUrl): Promise<string>
  
  // Get withdrawal history
  async getWithdrawalHistory(userId, limit, offset): Promise<{ withdrawals, total }>
  
  // Cancel pending withdrawal
  async cancelWithdrawal(withdrawalId, userId): Promise<void>
}
```

---

## 🎨 Integration Points

### Booking Flow

**Before:**
```typescript
// Old: Direct Stripe charge
const payment = await stripe.charges.create({ amount: 3000 });
```

**After:**
```typescript
// New: Custodial wallet (already integrated)
await paymentService.processBookingPayment({
  bookingId,
  customerId,
  barberId,
  totalAmountCents: 3000,
  tipAmountCents: 500,
});
```

### Barber Onboarding

```typescript
// 1. Create Stripe Connect account
const accountId = await payoutService.createConnectedAccount(
  userId,
  'barber@example.com'
);

// 2. Generate onboarding link
const onboardingUrl = await payoutService.createAccountLink(
  accountId,
  'https://campuscuts.app/onboarding/return',
  'https://campuscuts.app/onboarding/refresh'
);

// 3. Redirect barber to onboardingUrl to complete Stripe setup
```

---

## 💡 Advantages Over Direct Stripe

| Feature | Custodial Wallet | Direct Stripe |
|---------|------------------|---------------|
| **Tips** | Instant, $0 fee | 2.9% + $0.30 per tip |
| **Refunds** | Instant | 2-10 business days |
| **Promos** | Platform credits | Can't issue credits |
| **Disputes** | Lock funds internally | Complex Stripe disputes |
| **History** | Complete audit trail | Scattered across charges |
| **Speed** | Instant | Payment processing delays |
| **Fees** | Only on deposit/withdrawal | Every transaction |

---

## 🧪 Testing with Mock Data

The mock database includes sample wallet data:

```bash
# Get mock barber balance
curl http://localhost:3001/api/dev/barbers

# Sample barber (Carlos):
# - Available: $125.00
# - Pending: $50.00
# - Total: $175.00
```

**Mock ledger entries include:**
- Deposits ($100)
- Booking payments ($28.50)
- Tips ($5)
- Platform fees ($1.75)
- Withdrawals ($50)
- Promo credits ($100)

---

## 🔮 Future Enhancements

1. **Crypto Integration**
   - Accept Aptos/Solana deposits
   - Same ledger system, different external rail
   - User sees "Add funds via crypto" option

2. **Subscription Credits**
   - Monthly barber subscription → credits
   - Deduct from ledger automatically

3. **Loyalty Rewards**
   - Booking milestones → promotional credits
   - Referral bonuses through ledger

4. **Multi-Currency**
   - Store balances in multiple currencies
   - Convert at time of transaction

5. **Instant Refunds**
   - Already instant internally
   - External refunds via Stripe

---

## 📝 Best Practices

### 1. Always Use Cents
```typescript
// ✅ Good
const amountCents = 3499; // $34.99

// ❌ Bad
const amountDollars = 34.99; // Floating point errors
```

### 2. Check Balance Before Transactions
```typescript
const balance = await ledgerService.getUserBalance(userId);
if (balance.balance_available < amountCents) {
  throw new ApiError(400, 'Insufficient balance');
}
```

### 3. Use Reference IDs for Idempotency
```typescript
await ledgerService.createLedgerEntry({
  // ...
  reference_type: 'booking',
  reference_id: bookingId, // Unique identifier
});
```

### 4. Log All Financial Operations
```typescript
logger.info('Payment processed', {
  user_id,
  amount_cents,
  type,
  reference_id,
});
```

---

## 🆘 Troubleshooting

### Issue: "Insufficient balance"
**Cause:** User doesn't have enough funds in available balance  
**Solution:** User needs to deposit more funds

### Issue: Withdrawal fails
**Cause:** Stripe Connect not set up or insufficient balance  
**Solution:** Complete Stripe onboarding, ensure available balance

### Issue: Balance mismatch
**Cause:** Ledger entries out of sync  
**Solution:** Run reconciliation script to audit ledger

### Issue: Pending balance stuck
**Cause:** Booking not marked as completed  
**Solution:** Complete the booking to release funds

---

## 📞 Support

For implementation questions or issues:

1. Check `BACKEND_STATUS.md` for service status
2. Review `backend/src/services/ledger.service.ts` for logic
3. Check logs for detailed error messages
4. Use `/api/dev` endpoints for testing

---

**The custodial wallet system is now fully operational!** 🎉

All bookings, tips, and refunds flow through the internal ledger automatically.

