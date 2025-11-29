# 💳 CampusCuts Payment Flow Documentation

**Complete Guide to Payment Processing on the Platform**

> **Architecture:** Fiat-to-Blockchain Bridge with Custodial Wallet Abstraction  
> **User Experience:** Traditional credit card payments (Web2)  
> **Backend Reality:** On-chain escrow and settlements (Web3)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Payment Actors](#payment-actors)
3. [Student Payment Flow](#student-payment-flow)
4. [Booking & Escrow Flow](#booking--escrow-flow)
5. [Completion & Release Flow](#completion--release-flow)
6. [Barber Withdrawal Flow](#barber-withdrawal-flow)
7. [Cancellation & Refund Flow](#cancellation--refund-flow)
8. [Fee Distribution](#fee-distribution)
9. [Technical Architecture](#technical-architecture)
10. [Payment States](#payment-states)
11. [Error Handling](#error-handling)
12. [Security & Compliance](#security--compliance)

---

## 🎯 Overview

### **The Core Principle: Custodial Wallet Illusion**

CampusCuts uses a **hybrid payment architecture** that combines the familiarity of traditional payment processing with the transparency and security of blockchain technology.

**What Users See:**
```
Student → Credit Card → Booking → Barber → Bank Account
(Just like Uber, DoorDash, etc.)
```

**What Actually Happens:**
```
Student → Stripe → Platform USDC Pool → On-Chain Escrow → Barber Blockchain Wallet → Coinbase/Stripe → Bank
```

### **Key Benefits**

✅ **For Students:**
- Pay with credit/debit cards (no crypto needed)
- Instant confirmations
- Standard refund processes
- No gas fees

✅ **For Barbers:**
- Receive payments in USD to bank account
- Protected by escrow
- No chargebacks
- Transparent settlement

✅ **For Platform:**
- Minimal cost ($0.003-0.006/transaction)
- Transparent, auditable records
- No database needed for payments
- Censorship-resistant

---

## 👥 Payment Actors

### **1. Student (Payer)**
- Pays with credit/debit card via Stripe
- Never sees cryptocurrency
- Has an on-chain wallet (managed by platform)
- On-chain balance tracked in smart contract

### **2. Barber (Payee)**
- Receives payment to on-chain wallet
- Can withdraw to bank account anytime
- Never handles crypto directly
- Balance visible in dashboard

### **3. Platform**
- Manages custodial wallets for all users
- Operates Stripe account for fiat on/off-ramps
- Maintains USDC liquidity pool
- Pays all blockchain gas fees
- Takes 5% service fee

### **4. Smart Contracts**
- `user_accounts.move`: Tracks all user balances
- `bookings.move`: Manages escrow for active bookings
- `reviews.move`: Links payments to reviews

### **5. External Services**
- **Stripe:** Fiat payment processing
- **Aptos:** Blockchain for settlement
- **Coinbase/Circle:** USDC conversion (backend)

---

## 💰 Student Payment Flow

### **Step 1: Deposit Funds**

**User Action:**
```
1. Student clicks "Add Funds" in app
2. Enters amount (e.g., $50)
3. Enters credit card details
4. Clicks "Deposit"
```

**Backend Processing:**

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1A: Stripe Payment Processing                         │
└─────────────────────────────────────────────────────────────┘
1. Frontend sends deposit request to backend
   POST /api/fiat-bridge/deposit
   {
     "email": "john@university.edu",
     "amount": 50.00,
     "currency": "USD"
   }

2. Backend creates Stripe Payment Intent
   - Amount: $50.00
   - Fee: $1.76 (2.9% + $0.30)
   - Net to platform: $48.24

3. Frontend displays Stripe checkout
4. Student completes payment
5. Stripe confirms payment
6. Stripe webhook fires to backend


┌─────────────────────────────────────────────────────────────┐
│ STEP 1B: USDC Conversion (Backend)                         │
└─────────────────────────────────────────────────────────────┘
Option A (Liquidity Pool - Recommended):
- Platform maintains pre-funded USDC pool on Aptos
- No conversion needed (instant)
- Platform reconciles with Stripe balance later

Option B (Real-Time Conversion):
- Backend calls Coinbase/Circle API
- Converts $50 USD → 50 USDC
- Transfer USDC to platform Aptos wallet


┌─────────────────────────────────────────────────────────────┐
│ STEP 1C: On-Chain Credit                                   │
└─────────────────────────────────────────────────────────────┘
1. Backend retrieves student's Aptos address
   - Derived from email (deterministic)
   - Encrypted private key from KMS

2. Backend signs & submits transaction to Aptos
   Function: user_accounts::deposit
   {
     student_addr: "0xabc123...",
     amount: 5000000000 (50 USDC in micro-units)
   }

3. Smart contract updates student's balance
   - Old balance: 0 USDC
   - New balance: 50 USDC

4. Transaction confirmed on-chain (~2 seconds)
   - Gas fee: 0.001 APT (~$0.003)
   - Paid by platform

5. Backend returns success to frontend
   {
     "success": true,
     "new_balance": 50.00,
     "tx_hash": "0xdef456..."
   }

6. Frontend shows optimistic update immediately
   - "Balance updated: $50.00"
   - Confirmation in background
```

**Timing:**
- **User sees:** Instant confirmation (~500ms)
- **Stripe confirms:** 1-2 seconds
- **Blockchain confirms:** 2-3 seconds
- **Total:** ~3-5 seconds end-to-end

**Costs:**
```
Student pays:                     $50.00
Stripe fee:                       -$1.76
Platform receives:                $48.24
Blockchain gas:                   -$0.003
Platform keeps in user balance:   $50.00
Platform subsidy:                 $1.763
```

**On-Chain State After Deposit:**
```rust
UserAccount {
  addr: "0xabc123...",
  balance: 50.0 USDC,
  reserved: 0.0 USDC,
  total_spent: 0.0 USDC,
  created_at: 1701234567
}
```

---

## 📅 Booking & Escrow Flow

### **Step 2: Create Booking**

**User Action:**
```
1. Student browses barber profiles
2. Selects service ($30 haircut)
3. Chooses date/time
4. Clicks "Book Now"
```

**Backend Processing:**

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 2A: Balance Check                                     │
└─────────────────────────────────────────────────────────────┘
1. Frontend queries student's on-chain balance
   GET /api/auth-blockchain/balance
   Response: { balance: 50.00 }

2. Frontend validates:
   - Service price: $30.00
   - Platform fee (5%): $1.50
   - Total needed: $31.50
   - User balance: $50.00 ✓

3. Frontend proceeds to booking


┌─────────────────────────────────────────────────────────────┐
│ STEP 2B: Escrow Lock                                       │
└─────────────────────────────────────────────────────────────┘
1. Frontend sends booking request
   POST /api/bookings-blockchain/create
   {
     "student_email": "john@university.edu",
     "barber_email": "barber@cuts.com",
     "service_id": "haircut_basic",
     "amount": 30.00,
     "scheduled_time": "2025-12-01T14:00:00Z"
   }

2. Backend retrieves both parties' Aptos addresses
   - Student: "0xabc123..."
   - Barber: "0xdef456..."

3. Backend calculates amounts
   - Service amount: 30.00 USDC
   - Platform fee (5%): 1.50 USDC
   - Total to lock: 31.50 USDC

4. Backend signs & submits escrow transaction
   Function: bookings::create_booking
   {
     student_addr: "0xabc123...",
     barber_addr: "0xdef456...",
     amount: 3000000000, // 30 USDC
     platform_fee: 150000000, // 1.50 USDC
     scheduled_time: 1733065200
   }

5. Smart contract executes:
   a) Verify student has sufficient balance
   b) Lock funds in escrow
   c) Create booking record
   d) Emit BookingCreatedEvent

6. Transaction confirmed (~2 seconds)
   - Gas: 0.002 APT (~$0.006)
   - Paid by platform

7. Backend returns booking confirmation
   {
     "success": true,
     "booking_id": "0x789abc...",
     "status": "pending",
     "escrow_amount": 31.50
   }
```

**On-Chain State After Booking:**

```rust
// User Account Updated
UserAccount {
  addr: "0xabc123...",
  balance: 18.50 USDC,        // 50 - 31.50
  reserved: 31.50 USDC,       // locked in escrow
  total_spent: 0.0 USDC,      // not spent yet
  created_at: 1701234567
}

// Booking Created
Booking {
  id: "0x789abc...",
  student_addr: "0xabc123...",
  barber_addr: "0xdef456...",
  amount: 30.0 USDC,
  platform_fee: 1.50 USDC,
  status: "pending",
  scheduled_time: 1733065200,
  created_at: 1701234600,
  escrow_locked: true
}
```

**User Dashboard Shows:**
```
Available Balance: $18.50
Reserved (in escrow): $31.50
Total: $50.00

Upcoming Bookings:
- Haircut with John's Cuts - Dec 1, 2:00 PM - $30.00 (Pending)
```

---

## ✅ Completion & Release Flow

### **Step 3: Service Completion**

**User Actions:**
```
1. Barber completes service
2. Barber marks booking as "Complete" in app
3. (Optional) Student confirms completion
4. (Optional) Student leaves review
```

**Backend Processing:**

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 3A: Completion Request                                │
└─────────────────────────────────────────────────────────────┘
1. Barber clicks "Complete Booking"
   POST /api/bookings-blockchain/complete
   {
     "booking_id": "0x789abc...",
     "barber_email": "barber@cuts.com"
   }

2. Backend validates:
   - Barber is the service provider ✓
   - Booking status is "pending" ✓
   - Scheduled time has passed ✓


┌─────────────────────────────────────────────────────────────┐
│ STEP 3B: Escrow Release                                    │
└─────────────────────────────────────────────────────────────┘
1. Backend signs & submits completion transaction
   Function: bookings::complete_booking
   {
     booking_id: "0x789abc...",
     barber_addr: "0xdef456..."
   }

2. Smart contract executes:
   a) Verify caller is barber or platform
   b) Release escrow funds:
      - Student reserved: -31.50 USDC
      - Barber balance: +30.00 USDC
      - Platform balance: +1.50 USDC
   c) Update booking status to "completed"
   d) Update student total_spent
   e) Emit BookingCompletedEvent

3. Transaction confirmed (~2 seconds)
   - Gas: 0.002 APT (~$0.006)

4. Backend broadcasts WebSocket event
   {
     "type": "booking_completed",
     "booking_id": "0x789abc...",
     "student_addr": "0xabc123...",
     "barber_addr": "0xdef456..."
   }

5. Both users receive real-time notification
   - Student: "Your haircut is complete! Please leave a review."
   - Barber: "Payment released! $30.00 added to your balance."
```

**On-Chain State After Completion:**

```rust
// Student Account
UserAccount {
  addr: "0xabc123...",
  balance: 18.50 USDC,        // unchanged (was already deducted)
  reserved: 0.0 USDC,         // escrow released
  total_spent: 30.0 USDC,     // updated
  created_at: 1701234567
}

// Barber Account
UserAccount {
  addr: "0xdef456...",
  balance: 30.0 USDC,         // +30.00 from escrow
  reserved: 0.0 USDC,
  total_earned: 30.0 USDC,    // new field (if tracked)
  created_at: 1701200000
}

// Platform Account
UserAccount {
  addr: "0x[platform]...",
  balance: 1.50 USDC,         // +1.50 fee
  total_fees_collected: 1.50 USDC,
  ...
}

// Booking Updated
Booking {
  id: "0x789abc...",
  status: "completed",
  completed_at: 1733065300,
  escrow_locked: false,
  ...
}
```

---

## 🏦 Barber Withdrawal Flow

### **Step 4: Cash Out to Bank Account**

**User Action:**
```
1. Barber views balance: $150.00 (after 5 bookings)
2. Clicks "Withdraw to Bank"
3. Enters amount: $150.00
4. Confirms withdrawal
```

**Backend Processing:**

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 4A: Withdrawal Request                                │
└─────────────────────────────────────────────────────────────┘
1. Frontend sends withdrawal request
   POST /api/fiat-bridge/withdraw
   {
     "email": "barber@cuts.com",
     "amount": 150.00,
     "method": "bank_account"
   }

2. Backend validates:
   - On-chain balance >= 150 USDC ✓
   - Bank account connected (Stripe) ✓
   - No reserved funds ✓
   - Daily withdrawal limit not exceeded ✓


┌─────────────────────────────────────────────────────────────┐
│ STEP 4B: On-Chain Debit                                    │
└─────────────────────────────────────────────────────────────┘
1. Backend signs & submits withdrawal transaction
   Function: user_accounts::withdraw
   {
     user_addr: "0xdef456...",
     amount: 15000000000 // 150 USDC
   }

2. Smart contract executes:
   - Verify sufficient balance ✓
   - Debit 150 USDC from balance
   - Emit WithdrawalEvent
   - Update total_withdrawn counter

3. Transaction confirmed (~2 seconds)


┌─────────────────────────────────────────────────────────────┐
│ STEP 4C: USDC → USD Conversion                             │
└─────────────────────────────────────────────────────────────┘
Option A (Liquidity Pool):
- Platform uses its USD reserves
- No conversion needed (instant)
- Platform replenishes USD later

Option B (Real-Time Conversion):
- Backend sends 150 USDC to Coinbase
- Coinbase converts 150 USDC → $150 USD
- Receives USD in platform bank account


┌─────────────────────────────────────────────────────────────┐
│ STEP 4D: Stripe Payout                                     │
└─────────────────────────────────────────────────────────────┘
1. Backend creates Stripe payout
   stripe.payouts.create({
     amount: 15000, // cents
     currency: 'usd',
     destination: barber.stripe_account_id
   })

2. Stripe processes payout
   - Standard: 2-3 business days
   - Instant (optional): $0.50 fee, arrives in 30 minutes

3. Stripe fee deducted
   - Amount: $150.00
   - Stripe fee: $0.25 (0.25% + instant fee if applicable)
   - Barber receives: $149.75

4. Backend logs withdrawal
   {
     "withdrawal_id": "wd_123",
     "user_addr": "0xdef456...",
     "amount": 150.00,
     "stripe_payout_id": "po_abc",
     "status": "processing"
   }

5. Frontend shows confirmation
   "Withdrawal processing. Funds will arrive in 2-3 business days."
```

**On-Chain State After Withdrawal:**

```rust
UserAccount {
  addr: "0xdef456...",
  balance: 0.0 USDC,          // 150 - 150
  reserved: 0.0 USDC,
  total_earned: 150.0 USDC,
  total_withdrawn: 150.0 USDC,
  created_at: 1701200000
}
```

**Costs:**
```
On-chain balance:                 150.00 USDC
Blockchain gas (withdrawal):      -$0.003
USDC → USD conversion:            -$0.00 (1:1)
Stripe payout fee:                -$0.25
Barber receives in bank:          $149.75
Platform cost:                    $0.253
```

---

## ❌ Cancellation & Refund Flow

### **Scenario A: Student Cancels Before Service**

```
┌─────────────────────────────────────────────────────────────┐
│ Student Initiates Cancellation                             │
└─────────────────────────────────────────────────────────────┘
1. Student clicks "Cancel Booking"
   POST /api/bookings-blockchain/cancel
   {
     "booking_id": "0x789abc...",
     "cancelled_by": "student"
   }

2. Backend checks cancellation policy
   - More than 24 hours before: Full refund
   - Less than 24 hours: 50% refund
   - Less than 2 hours: No refund

3. Backend submits cancellation transaction
   Function: bookings::cancel_booking
   {
     booking_id: "0x789abc...",
     refund_amount: 31.50 USDC // full refund
   }

4. Smart contract executes:
   - Release escrow back to student
   - Update booking status to "cancelled"
   - Emit BookingCancelledEvent

5. On-chain state updated:
   Student balance: 18.50 → 50.00 USDC
   Student reserved: 31.50 → 0.0 USDC
   Booking status: "pending" → "cancelled"
```

### **Scenario B: Barber Cancels**

```
1. Barber cancels via app
2. Full refund automatically issued to student
3. Barber may receive penalty (flagged)
4. Escrow released back to student
```

### **Scenario C: Dispute Resolution**

```
1. Student or barber files dispute
2. Platform admin reviews
3. Admin can manually:
   - Release funds to barber
   - Refund student
   - Split amount
4. Admin signs special transaction
   Function: bookings::resolve_dispute
   {
     booking_id: "0x789abc...",
     student_refund: 15.75 USDC,
     barber_payment: 15.75 USDC
   }
```

---

## 💵 Fee Distribution

### **Complete Fee Breakdown**

**For a $30 Booking:**

```
STUDENT PAYS TO STRIPE:
Credit card payment:              $30.00
Platform fee (5%):                +$1.50
────────────────────────────────────────
Total charged:                    $31.50


STRIPE FEES:
Stripe rate (2.9% + $0.30):       $1.24
────────────────────────────────────────
Net to platform from Stripe:     $30.26


PLATFORM RECEIVES ON-CHAIN:
Deposited to student wallet:      $31.50
(Platform subsidizes Stripe fee)


ESCROW LOCK:
Student balance locked:            $31.50
- Service amount: $30.00
- Platform fee: $1.50


ON COMPLETION:
Barber receives:                   $30.00
Platform receives:                 $1.50
Student refunded:                  $0.00


BARBER WITHDRAWS $30:
On-chain balance debit:            $30.00
Blockchain gas:                    $0.003 (platform pays)
Stripe payout fee (0.25%):         $0.08
────────────────────────────────────────
Barber receives in bank:          $29.92


PLATFORM NET:
Revenue (5% fee):                  $1.50
Costs:
  - Stripe deposit fee:            -$1.24
  - Blockchain gas (3 txs):        -$0.009
  - Stripe withdrawal fee:         -$0.08
────────────────────────────────────────
Platform net profit:               $0.17 (0.55% of booking)
```

### **Fee Optimization**

Platform can improve margins by:

1. **Bulk USDC Conversion**: Convert fiat to USDC in bulk ($10k+) to reduce conversion fees
2. **Liquidity Pool**: Maintain USDC/USD reserves to avoid per-transaction conversion
3. **Batch Withdrawals**: Encourage weekly withdrawals vs daily
4. **Gas Optimization**: Batch multiple operations in single transaction
5. **Higher Platform Fee**: Increase from 5% to 7-10% (standard for gig platforms)

**At 7% Fee ($30 booking):**
```
Platform fee:                      $2.10
Platform costs:                    -$1.33
Platform profit:                   $0.77 (2.6% of booking) ✓
```

---

## 🏗️ Technical Architecture

### **System Components**

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  React App (IPFS Hosted)                                   │
│  - Stripe Elements (card input)                            │
│  - React Query (optimistic UI)                             │
│  - WebSocket (real-time updates)                           │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTPS
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Fiat Bridge Service                                  │  │
│  │  - Stripe integration                                │  │
│  │  - USDC conversion                                    │  │
│  │  - Deposit/withdrawal logic                          │  │
│  └────────────┬────────────────────────────────┬────────┘  │
│               │                                │            │
│  ┌────────────▼────────────┐    ┌─────────────▼──────────┐ │
│  │ Custodial Signer        │    │ Blockchain Query       │ │
│  │ - Key derivation        │    │ - Balance checks       │ │
│  │ - Transaction signing   │    │ - History queries      │ │
│  │ - KMS integration       │    │ - Event listening      │ │
│  └────────────┬────────────┘    └─────────────┬──────────┘ │
└───────────────┼──────────────────────────────┼─────────────┘
                │                              │
                │                              │
                ▼                              ▼
┌──────────────────────────────┐   ┌──────────────────────┐
│   Aptos Blockchain (Devnet)  │   │   Stripe API         │
│   ┌──────────────────────┐   │   │   - Payments         │
│   │ user_accounts.move   │   │   │   - Payouts          │
│   │ - Balances          │   │   │   - Webhooks         │
│   │ - Deposits          │   │   └──────────────────────┘
│   │ - Withdrawals       │   │
│   └──────────────────────┘   │   ┌──────────────────────┐
│   ┌──────────────────────┐   │   │   IPFS (Pinata)      │
│   │ bookings.move        │   │   │   - Profile pics     │
│   │ - Escrow            │   │   │   - Service images   │
│   │ - Completion        │   │   └──────────────────────┘
│   │ - Cancellation      │   │
│   └──────────────────────┘   │   ┌──────────────────────┐
│   ┌──────────────────────┐   │   │   Redis Cache        │
│   │ reviews.move         │   │   │   - Balance cache    │
│   │ - Rating storage    │   │   │   - Tx cache         │
│   └──────────────────────┘   │   └──────────────────────┘
└──────────────────────────────┘
```

### **Data Flow: Complete Transaction**

```
1. DEPOSIT
Frontend → Backend → Stripe → Webhook → Backend → Aptos → Balance Updated

2. BOOKING
Frontend → Backend → Aptos (escrow lock) → Event → WebSocket → Frontend

3. COMPLETION
Barber App → Backend → Aptos (escrow release) → Event → Both Apps

4. WITHDRAWAL
Frontend → Backend → Aptos (debit) → Stripe Payout → Bank Account
```

---

## 🔄 Payment States

### **Deposit States**

| State | Description | Next State |
|-------|-------------|------------|
| `initiated` | Stripe payment intent created | `processing` |
| `processing` | Stripe confirms, awaiting blockchain | `confirmed` |
| `confirmed` | On-chain balance credited | `complete` |
| `failed` | Stripe or blockchain failed | `refunded` |
| `refunded` | Money returned to card | - |

### **Booking States**

| State | Description | Escrow Status |
|-------|-------------|---------------|
| `pending` | Awaiting service completion | Locked |
| `confirmed` | Barber accepted | Locked |
| `in_progress` | Service started | Locked |
| `completed` | Service done, payment released | Released |
| `cancelled_student` | Student cancelled | Refunded |
| `cancelled_barber` | Barber cancelled | Refunded |
| `disputed` | Dispute opened | Locked |
| `resolved` | Dispute resolved by admin | Released/Refunded |

### **Withdrawal States**

| State | Description | Timeline |
|-------|-------------|----------|
| `requested` | User initiated | Instant |
| `blockchain_confirmed` | On-chain debit done | 2-3 sec |
| `processing` | Stripe payout created | 0-30 min |
| `sent` | Sent to bank | 2-3 days |
| `complete` | In bank account | - |
| `failed` | Bank rejected | Refund to balance |

---

## ⚠️ Error Handling

### **Stripe Payment Failures**

```javascript
// Insufficient funds
{
  "error": "card_declined",
  "message": "Your card has insufficient funds.",
  "action": "Try a different card"
}

// Solution: Show user-friendly error, suggest alternative payment method
```

### **Blockchain Transaction Failures**

```javascript
// Insufficient gas (should never happen - platform pays)
{
  "error": "INSUFFICIENT_GAS",
  "action": "Platform should top up gas wallet"
}

// Escrow insufficient balance
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Please add funds before booking",
  "current_balance": 10.00,
  "required": 31.50
}

// Solution: Query balance before booking, show clear error
```

### **Withdrawal Failures**

```javascript
// Bank account not verified
{
  "error": "bank_account_not_verified",
  "message": "Please verify your bank account in settings",
  "action": "redirect_to_settings"
}

// Daily limit exceeded
{
  "error": "withdrawal_limit_exceeded",
  "message": "Daily limit: $500. Try again tomorrow.",
  "current_limit": 500,
  "already_withdrawn_today": 500
}
```

### **Retry Logic**

```javascript
// Automatic retries for transient failures
const retryConfig = {
  blockchain: {
    maxRetries: 3,
    backoff: 'exponential', // 1s, 2s, 4s
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT']
  },
  stripe: {
    maxRetries: 2,
    backoff: 'linear',
    retryableErrors: ['rate_limit']
  }
}
```

---

## 🔒 Security & Compliance

### **PCI Compliance**

✅ **Platform is PCI compliant** because:
- Never touches credit card data
- Stripe handles all card processing
- Stripe Elements embedded for card input
- No card data stored in database

### **KYC/AML (Anti-Money Laundering)**

**Student Accounts:**
- No KYC required (deposits only)
- Monitored for suspicious patterns
- Max deposit: $500/day

**Barber Accounts:**
- KYC required for withdrawals >$600/month (IRS threshold)
- Stripe Identity verification
- Tax form (W-9/1099) collection
- SSN/EIN verification

### **Fraud Prevention**

```javascript
// Velocity checks
{
  max_deposits_per_day: 10,
  max_deposit_amount: 500,
  max_bookings_per_day: 5,
  cooling_period_after_failed_payment: 3600 // 1 hour
}

// Stripe Radar (built-in)
{
  ml_fraud_detection: true,
  3d_secure: true,
  address_verification: true
}
```

### **Escrow Security**

**Smart Contract Guarantees:**
1. **Immutability**: Funds can only be released via defined functions
2. **No Admin Override**: Platform cannot steal funds
3. **Time Locks**: Auto-refund after 7 days if service not confirmed
4. **Multi-Sig Option**: Large amounts require multiple approvals

**Audit Trail:**
```
Every transaction is:
- Recorded on-chain (permanent)
- Timestamped (immutable)
- Attributed (signed by address)
- Queryable (public blockchain explorer)
```

---

## 📊 Payment Analytics

### **Platform Dashboard Queries**

**Total Volume:**
```graphql
query {
  bookings(status: "completed") {
    sum(amount)
    count
    avg(amount)
  }
}
# Returns: { sum: 15000, count: 500, avg: 30 }
```

**Revenue:**
```graphql
query {
  user_account(addr: PLATFORM_ADDRESS) {
    balance          # Current fees not withdrawn
    total_fees       # All-time fees collected
  }
}
```

**User Metrics:**
```graphql
query {
  user_account(addr: STUDENT_ADDRESS) {
    total_spent
    total_bookings
    avg_booking_amount
  }
}
```

---

## 🎯 Summary

### **Payment Flow Recap**

```
┌──────────────────────────────────────────────────────────────┐
│                    MONEY FLOW                                │
└──────────────────────────────────────────────────────────────┘

1. Student Credit Card → Stripe → Platform USD Account
   Time: 1-2 seconds
   Cost: 2.9% + $0.30

2. Platform USD → On-Chain USDC → Student Wallet
   Time: 2-3 seconds
   Cost: $0.003 gas (platform pays)

3. Student Wallet → Escrow Lock (Booking Created)
   Time: 2-3 seconds
   Cost: $0.006 gas (platform pays)

4. Escrow → Barber Wallet (Service Completed)
   Time: 2-3 seconds
   Cost: $0.006 gas (platform pays)

5. Barber Wallet → Platform USDC → USD → Stripe → Bank
   Time: 2-3 business days
   Cost: 0.25% Stripe fee

TOTAL USER EXPERIENCE TIME: 5-10 seconds
TOTAL PLATFORM COST PER $30 BOOKING: $1.33
PLATFORM NET PROFIT (5% fee): $0.17
```

### **Key Advantages**

1. **Transparent**: Every transaction on public blockchain
2. **Secure**: Smart contract escrow, no chargebacks
3. **Fast**: 2-3 second confirmations
4. **Cheap**: $0.015 total blockchain cost
5. **Familiar**: Users see normal credit card payments
6. **Global**: Works anywhere Stripe is available
7. **Auditable**: Complete transaction history on-chain

### **User Benefits**

| User Type | Key Benefit |
|-----------|-------------|
| **Students** | Pay with card, instant bookings, protected by escrow |
| **Barbers** | No chargebacks, transparent settlements, quick payouts |
| **Platform** | 92% cheaper than traditional, auditable, scalable |

---

**🎉 CampusCuts: The best of Web2 UX + Web3 infrastructure!**

