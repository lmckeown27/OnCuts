# Migration Guide: V1 → V2 Custodial Wallet System

**Version:** V1 (Simple Ledger) → V2 (Production Escrow)  
**Date:** November 27, 2025  
**Status:** Ready for Testing

---

## Overview

This guide covers migrating from the simple ledger-based system (V1) to the production-grade escrow-based custodial wallet (V2).

### Key Changes

| Aspect | V1 | V2 |
|--------|----|----|
| **Payment Flow** | Immediate debit/credit | Escrow hold → Release |
| **Database** | 2 tables (users, ledger_entries) | 7 tables (balances, transactions, escrow_holds, etc.) |
| **On-Chain** | Full data storage ($0.50/booking) | Hash-based anchoring ($0.0001/booking) |
| **Withdrawals** | Individual transactions | Batched (99.8% savings) |
| **Fees** | Mixed with transactions | Isolated platform_fees table |
| **Audit** | None | Complete audit_logs table |
| **Reconciliation** | Manual | Automated daily reports |

---

## 1. Database Migration

### Step 1: Backup Existing Data

```bash
# Backup V1 database
pg_dump campuscuts_db > campuscuts_v1_backup_$(date +%Y%m%d).sql
```

### Step 2: Run V2 Schema

```sql
-- Apply new schema
\i backend/src/database/schema-v2.sql
```

### Step 3: Migrate Existing User Balances

```sql
-- Create balance records from existing users
INSERT INTO balances (user_id, currency, available_amount, pending_amount)
SELECT
  id as user_id,
  'USD' as currency,
  COALESCE(balance_available, 0) as available_amount,
  COALESCE(balance_pending, 0) as pending_amount
FROM users
ON CONFLICT (user_id) DO NOTHING;
```

### Step 4: Migrate Transaction History

```sql
-- Migrate old ledger_entries to new transactions table
INSERT INTO transactions (
  tx_ref,
  user_id,
  type,
  amount,
  currency,
  status,
  related_booking_id,
  metadata,
  created_at,
  completed_at
)
SELECT
  'MIGRATED-' || id::text as tx_ref,
  user_id,
  CASE
    WHEN type = 'DEPOSIT' THEN 'charge'
    WHEN type = 'BOOKING_PAYMENT' THEN 'hold'
    WHEN type = 'TIP' THEN 'tip'
    WHEN type = 'REFUND' THEN 'refund'
    WHEN type = 'WITHDRAWAL' THEN 'payout'
    WHEN type = 'PLATFORM_FEE' THEN 'fee'
    ELSE 'adjustment'
  END as type,
  amount,
  'USD' as currency,
  'completed' as status,
  reference_id as related_booking_id,
  metadata,
  created_at,
  created_at as completed_at
FROM ledger_entries;
```

### Step 5: Migrate Active Bookings to Escrow

```sql
-- Create escrow holds for pending bookings
INSERT INTO escrow_holds (
  booking_id,
  consumer_id,
  barber_id,
  amount,
  currency,
  created_at,
  expires_at,
  status
)
SELECT
  b.id as booking_id,
  b.consumer_id,
  b.barber_id,
  b.price_cents as amount,
  'USD' as currency,
  b.created_at,
  b.requested_slot + INTERVAL '48 hours' as expires_at,
  'held' as status
FROM bookings b
WHERE b.status IN ('pending', 'confirmed');
```

---

## 2. Code Migration

### API Endpoint Changes

#### V1 Endpoints (Still Supported)
```
POST /api/bookings
POST /api/wallet/deposit
POST /api/wallet/withdraw
```

#### V2 Endpoints (New)
```
POST /api/v2/bookings
POST /api/v2/wallet/deposit/intent
POST /api/v2/wallet/withdraw/bank
POST /api/v2/wallet/withdraw/onchain
```

### Frontend Integration Example

**V1 Booking (Old):**
```typescript
// Old immediate payment flow
const response = await fetch('/api/bookings', {
  method: 'POST',
  body: JSON.stringify({
    barberId,
    priceCents,
    requestedSlot,
  }),
});
// Funds immediately debited
```

**V2 Booking (New):**
```typescript
// New escrow-based flow
const response = await fetch('/api/v2/bookings', {
  method: 'POST',
  body: JSON.stringify({
    barberId,
    priceCents,
    requestedSlot,
  }),
});

// Response includes escrow details
const { booking, escrow } = response.data;
console.log('Escrow ID:', escrow.id);
console.log('Expires:', escrow.expires_hours);
```

**Completing Booking:**
```typescript
// Barber completes service
await fetch(`/api/v2/bookings/${bookingId}/complete`, {
  method: 'POST',
  body: JSON.stringify({
    tipCents: 500, // Optional $5 tip
  }),
});
// Escrow released, barber receives funds
```

---

## 3. Service Layer Migration

### Old Service Calls (V1)

```typescript
// V1
import ledgerService from './services/ledger.service';

await ledgerService.creditUser(client, userId, amount, 'DEPOSIT', null, {});
```

### New Service Calls (V2)

```typescript
// V2
import transactionService from './services/transaction.service';
import escrowService from './services/escrow.service';
import paymentServiceV2 from './services/payment-v2.service';

// Deposit
await paymentServiceV2.processDeposit({
  userId,
  amountCents,
  paymentMethodId,
});

// Booking payment (creates escrow)
await paymentServiceV2.processBookingPayment({
  bookingId,
  consumerId,
  barberId,
  amountCents,
});

// Complete booking (release escrow)
await paymentServiceV2.completeBookingPayment({
  bookingId,
  tipCents,
});
```

---

## 4. Background Jobs Setup

### Withdrawal Batch Processing

**Cron Job (Run every 15 minutes):**
```typescript
import withdrawalBatchService from './services/withdrawal-batch.service';

// In your cron job handler
async function processWithdrawalBatches() {
  await withdrawalBatchService.processBatch('aptos', 1);
}

// Cron schedule: */15 * * * *
```

### Daily Reconciliation

**Cron Job (Run daily at 2 AM):**
```typescript
import reconciliationService from './services/reconciliation.service';

async function runDailyReconciliation() {
  const report = await reconciliationService.runDailyReconciliation();
  
  if (report.status === 'discrepancies') {
    // Send alert to admins
    await sendDiscrepancyAlert(report);
  }
}

// Cron schedule: 0 2 * * *
```

### Expired Escrow Cleanup

**Cron Job (Run every hour):**
```typescript
import escrowService from './services/escrow.service';

async function processExpiredEscrows() {
  const count = await escrowService.processExpiredEscrows();
  console.log(`Processed ${count} expired escrows`);
}

// Cron schedule: 0 * * * *
```

---

## 5. Testing Migration

### Test Checklist

#### ✅ Database
- [ ] All V1 user balances migrated
- [ ] All V1 transactions migrated
- [ ] All pending bookings have escrow holds
- [ ] Balance totals match before/after migration

#### ✅ Booking Flow
- [ ] Create booking → Escrow created
- [ ] Complete booking → Funds released to barber
- [ ] Cancel booking → Refund issued
- [ ] Escrow expiration → Auto-refund

#### ✅ Wallet Operations
- [ ] Deposit via Stripe → Balance increased
- [ ] Bank withdrawal → Stripe payout successful
- [ ] On-chain withdrawal → Queued for batching
- [ ] Tip → Instant transfer

#### ✅ Admin Functions
- [ ] View platform fees
- [ ] Withdraw fees
- [ ] Run reconciliation
- [ ] View audit logs
- [ ] Issue promotional credits

#### ✅ Background Jobs
- [ ] Withdrawal batching works
- [ ] Reconciliation runs successfully
- [ ] Expired escrows processed

---

## 6. Rollback Plan

If migration fails, rollback:

### Step 1: Stop Application
```bash
pm2 stop campuscuts-backend
```

### Step 2: Restore Database
```bash
psql campuscuts_db < campuscuts_v1_backup_YYYYMMDD.sql
```

### Step 3: Revert Code
```bash
git revert HEAD~3..HEAD
git push origin main
```

### Step 4: Restart Application
```bash
pm2 start campuscuts-backend
```

---

## 7. Production Deployment

### Pre-Deployment

1. **Environment Variables:**
```bash
# Add to .env
STRIPE_SECRET_KEY=sk_live_...
APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
APTOS_PLATFORM_PRIVATE_KEY=<secure_key>
```

2. **Database Backup:**
```bash
pg_dump campuscuts_production > pre_migration_backup.sql
```

3. **Feature Flags:**
```typescript
// Enable V2 gradually
const USE_V2_WALLET = process.env.ENABLE_V2_WALLET === 'true';
```

### Deployment Steps

1. Deploy code with both V1 and V2 routes active
2. Run database migration scripts
3. Test V2 endpoints with small transactions
4. Gradually increase V2 traffic
5. Monitor reconciliation reports
6. After 1 week stable, deprecate V1

### Post-Deployment Monitoring

```typescript
// Monitor key metrics
- Escrow hold count
- Daily reconciliation status
- Withdrawal batch success rate
- Transaction success rate
- Discrepancy count
```

---

## 8. Common Migration Issues

### Issue 1: Balance Mismatch

**Symptom:** User balance doesn't match sum of transactions

**Solution:**
```sql
-- Recalculate user balance
UPDATE balances b
SET available_amount = (
  SELECT COALESCE(SUM(amount), 0)
  FROM transactions
  WHERE user_id = b.user_id AND status = 'completed'
),
updated_at = NOW()
WHERE user_id = '<user_id>';
```

### Issue 2: Orphaned Escrows

**Symptom:** Escrow holds without corresponding bookings

**Solution:**
```sql
-- Find and refund orphaned escrows
SELECT e.* FROM escrow_holds e
LEFT JOIN bookings b ON e.booking_id = b.id
WHERE b.id IS NULL AND e.status = 'held';

-- Manually refund via admin panel or:
-- POST /api/v2/bookings/<booking_id>/cancel
```

### Issue 3: Duplicate Transactions

**Symptom:** Same transaction appears twice

**Solution:**
```sql
-- Identify duplicates
SELECT tx_ref, COUNT(*)
FROM transactions
GROUP BY tx_ref
HAVING COUNT(*) > 1;

-- Remove duplicates (keep earliest)
DELETE FROM transactions
WHERE id NOT IN (
  SELECT MIN(id)
  FROM transactions
  GROUP BY tx_ref
);
```

---

## 9. Performance Benchmarks

### Expected Improvements

| Metric | V1 | V2 | Improvement |
|--------|----|----|-------------|
| Booking creation | 500ms | 450ms | 10% faster |
| On-chain cost per booking | $0.50 | $0.0001 | 99.98% |
| Withdrawal cost (1000 users) | $1.00 | $0.002 | 99.8% |
| Reconciliation time | Manual | 30s automated | ∞ |
| Dispute resolution | Hours | Minutes | 90% faster |

---

## 10. Support & Troubleshooting

### Logs to Monitor

```bash
# Check escrow processing
tail -f logs/escrow.log

# Check batch processing
tail -f logs/withdrawals.log

# Check reconciliation
tail -f logs/reconciliation.log
```

### Health Check Endpoints

```
GET /api/admin/treasury
GET /api/admin/reconciliation/reports
GET /api/admin/withdrawals/batches
```

### Admin Dashboard Queries

```sql
-- Platform health overview
SELECT * FROM platform_treasury;

-- Today's reconciliation
SELECT * FROM reconciliation_reports
WHERE report_date = CURRENT_DATE;

-- Active escrows
SELECT COUNT(*), SUM(amount) / 100 as total_dollars
FROM escrow_holds
WHERE status = 'held';
```

---

## Questions?

Contact the development team or create an issue on GitHub.

**Migration Status:** ✅ Ready for Testing
**Estimated Downtime:** < 5 minutes
**Rollback Time:** < 10 minutes

