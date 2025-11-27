# Custodial Wallet Architecture

## 🏗️ System Design

This document explains the technical architecture of CampusCuts' custodial wallet system.

---

## 📐 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    EXTERNAL WORLD                        │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Stripe  │  │ PayPal  │  │  Banks   │  │  Crypto  │ │
│  └────┬────┘  └────┬────┘  └─────┬────┘  └────┬─────┘ │
└───────┼────────────┼─────────────┼────────────┼────────┘
        │            │             │            │
        └────────────┴─────────────┴────────────┘
                     │
              ┌──────▼──────┐
              │   GATEWAY   │ ← Payment/Payout Services
              └──────┬──────┘
                     │
         ┌───────────▼───────────┐
         │  CUSTODIAL LEDGER     │ ← Internal Balance System
         │  ┌─────────────────┐  │
         │  │ User: $100      │  │
         │  │ Barber: $175    │  │
         │  │ Platform: $50K  │  │
         │  └─────────────────┘  │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │    DATABASE           │
         │  • users (balances)   │
         │  • ledger_entries     │
         │  • withdrawals        │
         └───────────────────────┘
```

---

## 🔄 Money Flow Diagram

### 1. Deposit (Money In)

```
External → CampusCuts Ledger
┌─────────────────────────────────────────────┐
│                                             │
│  USER                                       │
│   │                                         │
│   │ 1. Stripe Charge ($100)                │
│   └──────┐                                  │
│          ▼                                  │
│    ┌──────────┐                             │
│    │  Stripe  │ ─── $100 ──→ Platform      │
│    └──────────┘              Account        │
│                                ↓            │
│                       payment.service.ts    │
│                       processDeposit()      │
│                                ↓            │
│                       ledger.service.ts     │
│                       createLedgerEntry()   │
│                                ↓            │
│                    user.balance_available   │
│                          += 10000 cents     │
│                                             │
└─────────────────────────────────────────────┘
```

### 2. Booking Payment (Internal Transfer)

```
Internal Ledger Only (Zero Cost)
┌─────────────────────────────────────────────┐
│                                             │
│  CUSTOMER         LEDGER         BARBER     │
│     │               │              │        │
│     │  $30 booking  │              │        │
│     └──────────────►│              │        │
│                     │              │        │
│            customer.available     │         │
│               -= 3000 cents       │         │
│                     │              │        │
│                     │    $28.50    │        │
│                     └─────────────►│        │
│                                    │        │
│                         barber.pending      │
│                            += 2850 cents    │
│                                             │
│                     Platform Fee: $1.50     │
│                                             │
└─────────────────────────────────────────────┘
```

### 3. Service Completion (Pending → Available)

```
Internal Balance Transfer
┌─────────────────────────────────────────────┐
│                                             │
│  BARBER                                     │
│    │                                        │
│    │ Completes Service                     │
│    └──────┐                                 │
│           ▼                                 │
│    ledger.service.ts                        │
│    releaseBookingFunds()                    │
│           │                                 │
│           ├─► barber.pending -= 2850       │
│           │                                 │
│           └─► barber.available += 2850     │
│                                             │
│    Now barber can withdraw to bank          │
│                                             │
└─────────────────────────────────────────────┘
```

### 4. Withdrawal (Money Out)

```
CampusCuts Ledger → External
┌─────────────────────────────────────────────┐
│                                             │
│  BARBER                                     │
│    │                                        │
│    │ Request $100 withdrawal               │
│    └──────┐                                 │
│           ▼                                 │
│    payout.service.ts                        │
│    createWithdrawalRequest()                │
│           │                                 │
│           ├─► barber.available -= 10000    │
│           │                                 │
│           ▼                                 │
│    ┌──────────┐                             │
│    │  Stripe  │ ─── $100 ──→ Barber's Bank │
│    │ Connect  │                             │
│    └──────────┘                             │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔐 Transaction Atomicity

All financial operations use database transactions:

```typescript
const client = await pool.connect();

try {
  await client.query('BEGIN');
  
  // Operation 1: Debit customer
  await debitCustomer(client, customerId, amount);
  
  // Operation 2: Credit barber
  await creditBarber(client, barberId, amount);
  
  await client.query('COMMIT'); // Both succeed
  
} catch (error) {
  await client.query('ROLLBACK'); // Both fail
  throw error;
} finally {
  client.release();
}
```

**Guarantees:**
- ✅ All operations succeed together
- ✅ Or all operations fail together
- ✅ No partial state
- ✅ No lost funds
- ✅ No double-spending

---

## 🔒 Race Condition Prevention

Uses PostgreSQL row-level locking:

```sql
SELECT balance_available 
FROM users 
WHERE id = $1 
FOR UPDATE;  -- ← Locks this row until transaction commits
```

**Scenario:**
1. Thread A: locks user row, reads balance ($100)
2. Thread B: waits for lock
3. Thread A: deducts $50, commits
4. Thread B: acquires lock, reads balance ($50)
5. Thread B: deducts $40, commits
6. Final balance: $10 ✅ (correct)

**Without locking:**
- Both threads read $100
- Both deduct independently
- Final balance could be wrong

---

## 📊 Data Consistency

### Double-Entry Bookkeeping

Every transfer creates TWO ledger entries:

```typescript
// Transfer $10 from Alice to Bob
[
  {
    user_id: 'alice',
    amount: -1000,  // Debit
    type: 'TIP',
    balance_after: 9000
  },
  {
    user_id: 'bob',
    amount: +1000,  // Credit
    type: 'TIP',
    balance_after: 1000
  }
]
```

**Benefits:**
- Audit trail for both parties
- Easy reconciliation
- Prevents "ghost money"

### Balance Snapshots

Each ledger entry stores `balance_after`:

```sql
SELECT balance_after 
FROM ledger_entries 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 1;

-- Should match users.balance_available
```

This allows:
- Historical balance reconstruction
- Anomaly detection
- Audit compliance

---

## 🛡️ Security Measures

### 1. Balance Validation

```sql
-- Database-level constraints
ALTER TABLE users ADD CONSTRAINT check_balance_available 
  CHECK (balance_available >= 0);

ALTER TABLE users ADD CONSTRAINT check_balance_pending 
  CHECK (balance_pending >= 0);
```

### 2. Transaction Type Validation

```sql
ALTER TABLE ledger_entries ADD CONSTRAINT check_transaction_type
  CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TIP', ...));
```

### 3. Service-Level Validation

```typescript
// Check balance before debit
const newBalance = currentBalance + input.amount;
if (newBalance < 0) {
  throw new ApiError(400, 'Insufficient balance');
}
```

### 4. Idempotency

```typescript
// Each transaction has unique reference
{
  reference_type: 'booking',
  reference_id: 'booking_456' // Prevents duplicate charges
}
```

---

## 📈 Scalability

### Ledger Table Growth

| Users | Transactions/User/Year | Entries/Year |
|-------|------------------------|--------------|
| 1,000 | 50 | 50,000 |
| 10,000 | 50 | 500,000 |
| 100,000 | 50 | 5,000,000 |
| 1,000,000 | 50 | 50,000,000 |

**Optimization strategies:**
1. **Partitioning**: Partition by user_id or created_at
2. **Archiving**: Move old entries to cold storage
3. **Indexing**: Composite indexes on (user_id, created_at)
4. **Caching**: Cache current balances in Redis

### Database Indexes

```sql
CREATE INDEX idx_ledger_user_id ON ledger_entries(user_id);
CREATE INDEX idx_ledger_created_at ON ledger_entries(created_at DESC);
CREATE INDEX idx_ledger_reference ON ledger_entries(reference_type, reference_id);
CREATE INDEX idx_ledger_type ON ledger_entries(type);
```

---

## 🔍 Reconciliation

### Daily Balance Audit

```typescript
// Verify ledger matches user balances
async function auditBalances() {
  const users = await getAllUsers();
  
  for (const user of users) {
    // Calculate balance from ledger
    const ledgerBalance = await calculateLedgerBalance(user.id);
    
    // Compare with stored balance
    if (ledgerBalance !== user.balance_available) {
      logger.error('Balance mismatch detected', {
        user_id: user.id,
        expected: ledgerBalance,
        actual: user.balance_available,
        difference: ledgerBalance - user.balance_available,
      });
    }
  }
}
```

### Ledger Integrity Check

```typescript
// Verify all transactions balance out
async function verifyLedgerIntegrity() {
  const allEntries = await getAllLedgerEntries();
  
  // Group by reference_id (e.g., booking_456)
  const grouped = groupBy(allEntries, 'reference_id');
  
  for (const [refId, entries] of grouped) {
    const sum = entries.reduce((acc, entry) => acc + entry.amount, 0);
    
    // For transfers, sum should be 0 (debit + credit)
    // For deposits/withdrawals, sum is non-zero (external money)
    if (isInternalTransfer(entries) && sum !== 0) {
      logger.error('Ledger imbalance detected', {
        reference_id: refId,
        expected: 0,
        actual: sum,
      });
    }
  }
}
```

---

## 🎯 Implementation Checklist

- [x] Database schema (users balances, ledger table, withdrawals)
- [x] Transaction types enum
- [x] Ledger service (core logic)
- [x] Payout service (withdrawals)
- [x] Payment service (deposits)
- [x] Wallet controller & routes
- [x] Booking flow integration
- [x] Mock data with balances
- [x] Documentation
- [ ] Frontend wallet UI
- [ ] Stripe webhook handlers
- [ ] Reconciliation scripts
- [ ] Admin dashboard for ledger
- [ ] Dispute management flow

---

**Status: Core infrastructure complete and operational** ✅

The custodial wallet system is production-ready for internal testing.
External payment rails (Stripe Connect) require configuration.

