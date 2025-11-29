# Stripe ↔ Custodial Wallet Integration

## 📘 **Overview**

This document explains how **Stripe payments** and the **Custodial Wallet backend** work together in CampusCuts to create a seamless fiat-to-crypto-hybrid payment system.

---

## 🏗️ **Architecture: Two Payment Rails**

CampusCuts uses a **dual-ledger system**:

1. **Stripe** (Off-chain, Fiat Layer)
   - Students pay with credit/debit cards
   - Platform receives USD via Stripe
   - Barbers receive instant payouts via Stripe Connect

2. **Custodial Wallet** (Internal Ledger + Aptos Blockchain)
   - Tracks user balances in database
   - Manages escrow holds for bookings
   - Anchors critical events on Aptos blockchain
   - Batches on-chain withdrawals to reduce gas fees

### **Why Both?**

- **Stripe**: User-friendly fiat payments (no crypto knowledge required)
- **Custodial Wallet**: Blockchain transparency, auditability, and cost efficiency
- **Integration**: Stripe is the "front door" for money entering the platform; the custodial wallet is the "ledger" tracking internal balances and escrow

---

## 🔄 **Complete Payment Flow**

### **Phase 1: Student Deposits Funds (Stripe → Custodial Wallet)**

```
┌─────────────┐
│   Student   │
└──────┬──────┘
       │
       │ 1. Clicks "Add Funds"
       │
       ▼
┌─────────────────────────────────────┐
│   Frontend (React)                   │
│   - Uses Stripe.js + Elements        │
│   - Creates Payment Intent           │
└──────┬──────────────────────────────┘
       │
       │ 2. POST /api/booking-payment/create-intent
       │    { amount: 50, studentId: "student-1" }
       │
       ▼
┌─────────────────────────────────────┐
│   Backend: booking-payment.controller│
│   - Calls StripeService              │
└──────┬──────────────────────────────┘
       │
       │ 3. Creates Payment Intent
       │
       ▼
┌─────────────────────────────────────┐
│   StripeService                      │
│   - stripe.paymentIntents.create()  │
│   - Returns client_secret            │
└──────┬──────────────────────────────┘
       │
       │ 4. Returns { clientSecret }
       │
       ▼
┌─────────────────────────────────────┐
│   Frontend                           │
│   - stripe.confirmCardPayment()     │
│   - Student enters card info         │
└──────┬──────────────────────────────┘
       │
       │ 5. Payment succeeded
       │
       ▼
┌─────────────────────────────────────┐
│   Stripe (external)                  │
│   - Processes payment                │
│   - Sends webhook event              │
└──────┬──────────────────────────────┘
       │
       │ 6. POST /api/webhooks/stripe
       │    Event: payment_intent.succeeded
       │
       ▼
┌─────────────────────────────────────┐
│   webhook.controller                 │
│   - Verifies webhook signature       │
│   - Calls PaymentServiceV2           │
└──────┬──────────────────────────────┘
       │
       │ 7. processDeposit()
       │
       ▼
┌─────────────────────────────────────┐
│   PaymentServiceV2                   │
│   - Calls TransactionService         │
└──────┬──────────────────────────────┘
       │
       │ 8. credit(studentId, amount, "deposit")
       │
       ▼
┌─────────────────────────────────────┐
│   TransactionService                 │
│   - UPDATE balances                  │
│     SET available_amount += 50       │
│   - INSERT INTO transactions         │
│     (type: "charge")                 │
└──────┬──────────────────────────────┘
       │
       │ 9. Funds now in custodial wallet
       │
       ▼
┌─────────────────────────────────────┐
│   Custodial Wallet                   │
│   Student Balance:                   │
│   - Available: $50                   │
│   - Pending: $0                      │
│   - Locked: $0                       │
└─────────────────────────────────────┘
```

**Result:** Student's Stripe payment is now reflected in their internal custodial wallet balance.

---

### **Phase 2: Student Books Appointment (Custodial Wallet Escrow)**

```
┌─────────────┐
│   Student   │
└──────┬──────┘
       │
       │ 1. Books haircut ($30)
       │
       ▼
┌─────────────────────────────────────┐
│   Frontend                           │
│   POST /api/v2/bookings              │
│   { barberId, serviceId, time }      │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   booking-v2.controller              │
│   - Calls EscrowService              │
└──────┬──────────────────────────────┘
       │
       │ 2. createHold()
       │
       ▼
┌─────────────────────────────────────┐
│   EscrowService                      │
│   - Validates student has funds      │
│   - Calls TransactionService         │
└──────┬──────────────────────────────┘
       │
       │ 3. debit(studentId, $30, "hold")
       │
       ▼
┌─────────────────────────────────────┐
│   TransactionService                 │
│   - UPDATE balances                  │
│     SET available_amount -= 30       │
│     SET pending_amount += 30         │
│   - INSERT INTO transactions         │
│     (type: "hold")                   │
└──────┬──────────────────────────────┘
       │
       │ 4. Creates escrow hold
       │
       ▼
┌─────────────────────────────────────┐
│   EscrowService                      │
│   - INSERT INTO escrow_holds         │
│     { bookingId, amount: 30,         │
│       status: "held" }               │
└──────┬──────────────────────────────┘
       │
       │ 5. Escrow created
       │
       ▼
┌─────────────────────────────────────┐
│   Custodial Wallet                   │
│   Student Balance:                   │
│   - Available: $20 (50 - 30)         │
│   - Pending: $30 (in escrow)         │
│   - Locked: $0                       │
└─────────────────────────────────────┘
```

**Key Point:** No Stripe interaction here! The custodial wallet manages escrow internally using funds already deposited via Stripe in Phase 1.

---

### **Phase 3: Service Completed (Release Escrow + Stripe Payout)**

```
┌─────────────┐
│   Barber    │
└──────┬──────┘
       │
       │ 1. Marks booking complete
       │
       ▼
┌─────────────────────────────────────┐
│   booking-v2.controller              │
│   POST /api/v2/bookings/:id/complete │
└──────┬──────────────────────────────┘
       │
       │ 2. releaseHold()
       │
       ▼
┌─────────────────────────────────────┐
│   EscrowService                      │
│   - UPDATE escrow_holds              │
│     SET status = "released"          │
│   - Calls TransactionService         │
└──────┬──────────────────────────────┘
       │
       │ 3. debit(student, $30, "release")
       │    credit(barber, $28.50, "release")
       │    credit(platform, $1.50, "fee")
       │
       ▼
┌─────────────────────────────────────┐
│   TransactionService                 │
│   - UPDATE balances                  │
│     Student: pending -= 30           │
│     Barber: available += 28.50       │
│     Platform: available += 1.50      │
│   - INSERT INTO transactions (x3)    │
│   - INSERT INTO platform_fees        │
└──────┬──────────────────────────────┘
       │
       │ 4. Funds released
       │
       ▼
┌─────────────────────────────────────┐
│   Custodial Wallet                   │
│   Student: Available $20, Pending $0 │
│   Barber: Available $28.50           │
│   Platform Fees: $1.50               │
└──────┬──────────────────────────────┘
       │
       │ 5. Trigger instant payout
       │
       ▼
┌─────────────────────────────────────┐
│   PayoutServiceV2                    │
│   - instantPayoutToBank()            │
└──────┬──────────────────────────────┘
       │
       │ 6. transferToBarber()
       │
       ▼
┌─────────────────────────────────────┐
│   StripeService                      │
│   - stripe.transfers.create()        │
│     { amount: 2850,                  │
│       destination: barber_stripe_id, │
│       metadata: { bookingId } }      │
└──────┬──────────────────────────────┘
       │
       │ 7. Transfer complete
       │
       ▼
┌─────────────────────────────────────┐
│   Stripe Connect                     │
│   - $28.50 sent to barber's account  │
│   - Instant payout to bank           │
└──────┬──────────────────────────────┘
       │
       │ 8. Update custodial wallet
       │
       ▼
┌─────────────────────────────────────┐
│   PayoutServiceV2                    │
│   - Calls TransactionService         │
│   - debit(barber, $28.50, "payout")  │
└──────┬──────────────────────────────┘
       │
       │ 9. Barber balance updated
       │
       ▼
┌─────────────────────────────────────┐
│   Custodial Wallet                   │
│   Barber: Available $0 (paid out)    │
└─────────────────────────────────────┘
```

**Key Point:** The custodial wallet releases escrow internally, then triggers a **Stripe Connect transfer** to send the barber their money. The custodial wallet is debited to reflect the outgoing Stripe payout.

---

## 💾 **Database Integration Points**

### **1. Stripe Payment Intent → Custodial Wallet Credit**

**Location:** `backend/src/services/payment-v2.service.ts`

```typescript
async processDeposit(paymentIntentId: string): Promise<void> {
  // 1. Get Stripe Payment Intent
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  
  const amount = paymentIntent.amount / 100; // cents → dollars
  const studentId = paymentIntent.metadata.studentId;

  // 2. Credit custodial wallet
  await transactionService.credit(
    studentId,
    amount,
    'deposit',
    `Stripe deposit: ${paymentIntentId}`
  );

  // 3. Log in audit trail
  await auditService.createLog({
    user_id: studentId,
    action: 'stripe_deposit_completed',
    details: { paymentIntentId, amount }
  });
}
```

**What Happens:**
1. Stripe confirms payment succeeded
2. PaymentServiceV2 retrieves the Payment Intent
3. TransactionService credits the student's `available_amount`
4. Database row inserted into `transactions` table
5. Audit log created for compliance

---

### **2. Custodial Wallet Payout → Stripe Connect Transfer**

**Location:** `backend/src/services/payout-v2.service.ts`

```typescript
async instantPayoutToBank(
  barberId: string,
  amount: number,
  bookingId: string
): Promise<void> {
  // 1. Verify barber has Stripe Connect account
  const barber = await db.query('SELECT stripe_account_id FROM barbers WHERE id = $1', [barberId]);
  
  if (!barber.stripe_account_id) {
    throw new Error('Barber must complete Stripe Connect onboarding');
  }

  // 2. Create Stripe transfer
  const transfer = await stripeService.transferToBarber(
    amount,
    barber.stripe_account_id,
    bookingId,
    `Booking ${bookingId} payout`
  );

  // 3. Debit custodial wallet
  await transactionService.debit(
    barberId,
    amount,
    'payout',
    `Stripe payout: ${transfer.id}`
  );

  // 4. Log withdrawal
  await db.query(
    'INSERT INTO withdrawal_requests (user_id, amount, destination_type, status) VALUES ($1, $2, $3, $4)',
    [barberId, amount, 'stripe_bank', 'completed']
  );
}
```

**What Happens:**
1. Custodial wallet has barber's available balance
2. PayoutServiceV2 initiates Stripe Connect transfer
3. Stripe sends $28.50 to barber's bank account
4. TransactionService debits barber's `available_amount`
5. Database row inserted into `transactions` and `withdrawal_requests`

---

## 🔗 **Key Integration Points**

### **1. Stripe Metadata ↔ Custodial Wallet IDs**

Every Stripe Payment Intent includes metadata linking it to the custodial wallet:

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000, // $50 in cents
  currency: 'usd',
  metadata: {
    studentId: 'student-1',      // ← Links to custodial wallet user
    bookingId: 'booking-123',    // ← Links to escrow hold
    platform: 'CampusCuts'
  }
});
```

### **2. Stripe Connect Account ID ↔ Barber Record**

Barbers have a `stripe_account_id` field linking them to Stripe:

```sql
CREATE TABLE barbers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  stripe_account_id TEXT,  -- ← Stripe Connect account
  ...
);
```

### **3. Webhook Events → Custodial Wallet Updates**

Stripe webhooks trigger custodial wallet updates:

```typescript
// webhook.controller.ts
switch (event.type) {
  case 'payment_intent.succeeded':
    await paymentServiceV2.processDeposit(event.data.object.id);
    break;
  
  case 'transfer.created':
    // Log successful payout in custodial wallet
    break;
  
  case 'payout.paid':
    // Confirm barber received funds
    break;
}
```

---

## 📊 **Money Flow Diagram**

```
┌──────────────────────────────────────────────────────────────┐
│                    STUDENT DEPOSITS $50                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Stripe API   │
                    │  (External)   │
                    └───────┬───────┘
                            │
                            │ Webhook: payment_intent.succeeded
                            │
                            ▼
                ┌───────────────────────────┐
                │  PaymentServiceV2         │
                │  processDeposit()         │
                └───────────┬───────────────┘
                            │
                            ▼
                ┌───────────────────────────┐
                │  TransactionService       │
                │  credit(student, $50)     │
                └───────────┬───────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │     CUSTODIAL WALLET DATABASE             │
        │  ┌─────────────────────────────────────┐  │
        │  │ balances                            │  │
        │  │ student-1: available_amount = $50   │  │
        │  └─────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────┐  │
        │  │ transactions                        │  │
        │  │ type: "charge"                      │  │
        │  │ amount: $50                         │  │
        │  └─────────────────────────────────────┘  │
        └───────────────────┬───────────────────────┘
                            │
        ┌───────────────────┴────────────────────┐
        │  STUDENT BOOKS $30 HAIRCUT             │
        └───────────────────┬────────────────────┘
                            │
                            ▼
                ┌───────────────────────────┐
                │  EscrowService            │
                │  createHold($30)          │
                └───────────┬───────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │     CUSTODIAL WALLET DATABASE             │
        │  ┌─────────────────────────────────────┐  │
        │  │ balances                            │  │
        │  │ student-1:                          │  │
        │  │   available = $20                   │  │
        │  │   pending = $30                     │  │
        │  └─────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────┐  │
        │  │ escrow_holds                        │  │
        │  │ booking_id: booking-123             │  │
        │  │ amount: $30                         │  │
        │  │ status: "held"                      │  │
        │  └─────────────────────────────────────┘  │
        └───────────────────┬───────────────────────┘
                            │
        ┌───────────────────┴────────────────────┐
        │  SERVICE COMPLETED                     │
        └───────────────────┬────────────────────┘
                            │
                            ▼
                ┌───────────────────────────┐
                │  EscrowService            │
                │  releaseHold()            │
                └───────────┬───────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │     CUSTODIAL WALLET DATABASE             │
        │  ┌─────────────────────────────────────┐  │
        │  │ balances                            │  │
        │  │ student-1: pending = $0             │  │
        │  │ barber-1: available = $28.50        │  │
        │  │ platform: available = $1.50         │  │
        │  └─────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────┐  │
        │  │ platform_fees                       │  │
        │  │ amount: $1.50                       │  │
        │  └─────────────────────────────────────┘  │
        └───────────────────┬───────────────────────┘
                            │
        ┌───────────────────┴────────────────────┐
        │  INSTANT PAYOUT TO BARBER              │
        └───────────────────┬────────────────────┘
                            │
                            ▼
                ┌───────────────────────────┐
                │  PayoutServiceV2          │
                │  instantPayoutToBank()    │
                └───────────┬───────────────┘
                            │
                            ▼
                ┌───────────────────────────┐
                │  StripeService            │
                │  transferToBarber()       │
                └───────────┬───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Stripe API   │
                    │  Transfer     │
                    │  $28.50 →     │
                    │  Barber Bank  │
                    └───────┬───────┘
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │     CUSTODIAL WALLET DATABASE             │
        │  ┌─────────────────────────────────────┐  │
        │  │ balances                            │  │
        │  │ barber-1: available = $0 (paid out) │  │
        │  └─────────────────────────────────────┘  │
        │  ┌─────────────────────────────────────┐  │
        │  │ transactions                        │  │
        │  │ type: "payout"                      │  │
        │  │ amount: $28.50                      │  │
        │  └─────────────────────────────────────┘  │
        └───────────────────────────────────────────┘
```

---

## 🔐 **Security & Reconciliation**

### **1. Stripe Webhook Signature Verification**

Every webhook is verified before processing:

```typescript
const signature = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  req.body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### **2. Idempotency Keys**

Stripe operations use idempotency keys to prevent duplicate charges:

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000,
  currency: 'usd',
}, {
  idempotencyKey: `deposit-${studentId}-${Date.now()}`
});
```

### **3. Daily Reconciliation**

The `ReconciliationService` compares:
- Stripe balance vs Custodial wallet total
- Stripe transfers vs Payout transactions
- Missing or duplicate transactions

```typescript
async runDailyReconciliation(): Promise<ReconciliationReport> {
  // 1. Sum all Stripe deposits
  const stripeTotal = await stripe.balanceTransactions.list({...});
  
  // 2. Sum all custodial wallet deposits
  const walletTotal = await db.query('SELECT SUM(amount) FROM transactions WHERE type = "charge"');
  
  // 3. Flag discrepancies
  if (stripeTotal !== walletTotal) {
    // Alert admin
  }
}
```

---

## 🎯 **Key Advantages of This Integration**

### **1. User Experience**
- Students pay with credit cards (familiar, no crypto)
- Barbers receive instant bank deposits (no crypto needed)
- Platform handles all complexity

### **2. Cost Efficiency**
- Stripe fees only on entry/exit (deposits/payouts)
- Internal transfers are free (custodial wallet)
- Batch on-chain withdrawals reduce gas fees

### **3. Transparency**
- All internal movements tracked in database
- Critical events anchored on Aptos blockchain
- Full audit trail for compliance

### **4. Flexibility**
- Students can hold balances for multiple bookings
- Escrow protects both parties
- Platform can offer refunds, credits, bonuses

### **5. Scale**
- Thousands of internal transactions per second
- Only occasional Stripe API calls (deposits/payouts)
- Blockchain writes batched daily

---

## 📝 **Summary Table**

| **Operation** | **Stripe Involved?** | **Custodial Wallet Involved?** | **Blockchain Involved?** |
|---------------|----------------------|--------------------------------|--------------------------|
| Student deposit | ✅ Payment Intent | ✅ Credit balance | ❌ |
| Create booking escrow | ❌ | ✅ Hold funds | ❌ |
| Complete booking | ❌ | ✅ Release escrow | ✅ (hash anchored) |
| Barber instant payout | ✅ Transfer to bank | ✅ Debit balance | ❌ |
| Student tip barber | ❌ | ✅ Internal transfer | ❌ |
| Platform withdraw fees | ✅ Payout | ✅ Debit fees | ❌ |
| Student on-chain withdrawal | ❌ | ✅ Debit balance | ✅ (actual APT transfer) |
| Batch withdrawals | ❌ | ✅ Aggregate requests | ✅ (single tx) |

---

## 🔧 **Code Examples**

### **Example 1: Student Deposits $50**

```typescript
// Frontend: Create Payment Intent
const response = await fetch('/api/booking-payment/create-intent', {
  method: 'POST',
  body: JSON.stringify({
    amount: 50,
    studentId: 'student-1'
  })
});
const { clientSecret } = await response.json();

// Confirm with Stripe
const result = await stripe.confirmCardPayment(clientSecret, {
  payment_method: { card: cardElement }
});

// Backend: Webhook processes deposit
// webhook.controller.ts → paymentServiceV2.processDeposit()
// → transactionService.credit('student-1', 50, 'deposit')
```

### **Example 2: Student Books Haircut**

```typescript
// Frontend: Book appointment
await fetch('/api/v2/bookings', {
  method: 'POST',
  body: JSON.stringify({
    barberId: 'barber-1',
    serviceId: 'service-1',
    scheduledAt: '2025-12-01T10:00:00Z'
  })
});

// Backend: Create escrow hold
// booking-v2.controller.ts → escrowService.createHold()
// → transactionService.debit('student-1', 30, 'hold')
// → Student's available balance: $20, pending balance: $30
```

### **Example 3: Barber Completes Service**

```typescript
// Frontend: Mark complete
await fetch('/api/v2/bookings/booking-123/complete', {
  method: 'POST'
});

// Backend: Release escrow + payout
// booking-v2.controller.ts → escrowService.releaseHold()
// → transactionService.credit('barber-1', 28.50, 'release')
// → payoutServiceV2.instantPayoutToBank('barber-1', 28.50)
// → stripeService.transferToBarber(28.50, barberStripeId)
// → Barber receives $28.50 in bank account
```

---

## 🚨 **Error Handling**

### **Scenario: Stripe Payout Fails**

```typescript
try {
  await stripe.transfers.create({...});
} catch (error) {
  // 1. Log error
  await auditService.createLog({
    action: 'stripe_payout_failed',
    details: { error: error.message, barberId }
  });
  
  // 2. Credit barber's custodial wallet back
  await transactionService.credit(
    barberId,
    amount,
    'payout_reversal',
    'Stripe payout failed, funds returned to wallet'
  );
  
  // 3. Notify admin
  await notificationService.alertAdmin('Payout failure', { barberId, amount });
}
```

---

## 📚 **Related Documentation**

- [**CUSTODIAL_WALLET_ARCHITECTURE.md**](./CUSTODIAL_WALLET_ARCHITECTURE.md) - Full custodial wallet technical deep-dive
- [**STRIPE_PAYMENT_INTEGRATION.md**](./STRIPE_PAYMENT_INTEGRATION.md) - Stripe integration details
- [**BACKEND.md**](./BACKEND.md) - Complete backend architecture

---

## 🎯 **Bottom Line**

**Stripe** is the **fiat gateway** (entry/exit ramp).  
**Custodial Wallet** is the **internal ledger** (balance tracking, escrow, compliance).  
**Aptos Blockchain** is the **audit layer** (immutable proof of critical events).

Together, they create a payment system that's:
- ✅ User-friendly (no crypto needed)
- ✅ Cost-efficient (batched on-chain writes)
- ✅ Transparent (blockchain-auditable)
- ✅ Fast (internal transfers instant)
- ✅ Compliant (full audit trail)

**Result:** Students and barbers use CampusCuts like Venmo, while the platform leverages blockchain cost savings and transparency. 🎉

