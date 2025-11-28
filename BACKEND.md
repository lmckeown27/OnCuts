# CampusCuts Backend Documentation

**Version:** 2.0  
**Tech Stack:** Node.js, TypeScript, Express, PostgreSQL, Aptos, Stripe  
**Architecture:** Production Custodial Wallet with Escrow-Based Payments

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Services Layer](#services-layer)
4. [Controllers & Routes](#controllers--routes)
5. [API Reference](#api-reference)
6. [Background Jobs](#background-jobs)
7. [Security & Compliance](#security--compliance)
8. [Deployment Guide](#deployment-guide)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API LAYER (Express.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   V2 Booking │  │  V2 Wallet   │  │    Admin     │      │
│  │   Routes     │  │   Routes     │  │   Routes     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Transaction  │  │   Escrow     │  │ Reconciliation│      │
│  │   Service    │  │   Service    │  │   Service     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ On-Chain     │  │  Withdrawal  │  │    Audit      │      │
│  │ Anchoring    │  │  Batching    │  │   Service     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Payment    │  │    Payout    │  │    Aptos      │      │
│  │   Service    │  │   Service    │  │   Service     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
  ┌───────────┐   ┌───────────┐   ┌───────────┐
  │PostgreSQL │   │  Aptos    │   │  Stripe   │
  │ Database  │   │Blockchain │   │  Connect  │
  └───────────┘   └───────────┘   └───────────┘
```

### Request Flow

```
1. Request → Middleware → Controller → Service → Database/Blockchain
2. Database/Blockchain → Service → Controller → Middleware → Response
```

### Middleware Stack

1. **CORS** - Cross-origin resource sharing
2. **Helmet** - Security headers
3. **Morgan** - HTTP request logging
4. **Rate Limiting** - DDoS protection
5. **Compression** - Response compression
6. **Authentication** - JWT validation
7. **Validation** - Request payload validation
8. **Error Handler** - Global error handling

---

## Database Schema

### Core Tables (7 Production Tables)

#### 1. `balances` - User Wallet Balances
```sql
CREATE TABLE balances (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  available_amount BIGINT DEFAULT 0 CHECK (available_amount >= 0),
  pending_amount BIGINT DEFAULT 0 CHECK (pending_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Purpose:** Separate balance tracking with available/pending split  
**Amounts:** Stored in cents (BIGINT) for precision  
**Constraints:** Non-negative balances enforced

#### 2. `transactions` - Immutable Transaction Ledger
```sql
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  tx_ref TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN (
    'charge', 'hold', 'release', 'payout', 'refund',
    'fee', 'onchain_withdrawal', 'tip', 'adjustment', 'reversal'
  )),
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT CHECK (status IN ('pending','completed','failed','reversed')),
  related_booking_id UUID NULL,
  related_tx_id BIGINT NULL REFERENCES transactions(id),
  stripe_payment_intent_id TEXT,
  stripe_payout_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);
```

**Purpose:** Immutable record of all balance changes  
**tx_ref:** Unique reference (e.g., "TX-20251127-0001")  
**Type System:** 10 transaction types for complete tracking  
**Relationships:** Links to bookings and parent transactions

#### 3. `escrow_holds` - Booking Payment Reserves
```sql
CREATE TABLE escrow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID UNIQUE NOT NULL,
  consumer_id UUID REFERENCES users(id) NOT NULL,
  barber_id UUID REFERENCES users(id) NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  onchain_tx_hash TEXT NULL,
  status TEXT CHECK (status IN ('held','released','refunded','expired')),
  released_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE
);
```

**Purpose:** Hold funds until service completion  
**Expiration:** Auto-refund after 48 hours (default)  
**States:** held → released/refunded/expired  
**On-Chain:** Optional hash anchoring

#### 4. `onchain_records` - Hash-Based Blockchain Proofs
```sql
CREATE TABLE onchain_records (
  id BIGSERIAL PRIMARY KEY,
  record_type TEXT NOT NULL CHECK (record_type IN (
    'booking_hash', 'payment_hash', 'review_hash',
    'withdrawal', 'batch_anchor'
  )),
  subject_id UUID,
  chain TEXT NOT NULL CHECK (chain IN ('aptos','solana','ethereum','base','arbitrum')),
  tx_hash TEXT NOT NULL,
  block_number BIGINT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  raw_receipt JSONB,
  proof_data JSONB
);
```

**Purpose:** Compact on-chain proofs (500x cheaper than full data)  
**Hash-Based:** Only hashes stored on-chain, full data in database  
**Verification:** Can verify data against stored hash  
**Multi-Chain:** Supports multiple blockchains

#### 5. `platform_fees` - Platform Revenue Tracking
```sql
CREATE TABLE platform_fees (
  id BIGSERIAL PRIMARY KEY,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  source_tx_id BIGINT REFERENCES transactions(id) NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  withdrawn BOOLEAN DEFAULT false,
  withdrawal_tx_hash TEXT NULL,
  withdrawal_date TIMESTAMP WITH TIME ZONE
);
```

**Purpose:** Isolated platform fee accounting  
**Tracking:** Links back to source transaction  
**Withdrawal:** Marks fees as withdrawn when collected  
**Transparency:** Complete audit trail

#### 6. `audit_logs` - Complete Audit Trail
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) NULL,
  action TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**Purpose:** Immutable audit logging  
**Actor Tracking:** User ID, IP, user agent  
**Never Deleted:** Append-only log  
**Compliance:** Required for fraud detection

#### 7. `withdrawal_queue` + `withdrawal_batches` - Batching Infrastructure
```sql
CREATE TABLE withdrawal_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  transaction_id BIGINT REFERENCES transactions(id) UNIQUE NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  destination_type TEXT CHECK (destination_type IN ('bank','onchain')),
  destination_address TEXT,
  chain TEXT,
  status TEXT CHECK (status IN ('queued','batched','processing','completed','failed')),
  batch_id UUID NULL,
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT
);

CREATE TABLE withdrawal_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain TEXT NOT NULL,
  total_amount BIGINT NOT NULL,
  withdrawal_count INTEGER NOT NULL,
  tx_hash TEXT UNIQUE,
  status TEXT CHECK (status IN ('pending','submitted','confirmed','failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  gas_used BIGINT,
  failure_reason TEXT
);
```

**Purpose:** 99.8% gas savings through batching  
**Queue:** Individual withdrawal requests  
**Batches:** Groups processed together on-chain  
**Process:** Queue → Batch (every 15min) → On-chain → Confirmed

### Supporting Tables

- **users** - User accounts (students, barbers, admins)
- **campuses** - College campus data
- **bookings** - Booking records
- **reconciliation_reports** - Daily reconciliation results

### Database Functions & Triggers

```sql
-- Auto-generate transaction references
CREATE SEQUENCE tx_ref_seq;
CREATE FUNCTION generate_tx_ref() RETURNS TEXT AS $$
  SELECT 'TX-' || to_char(current_date, 'YYYYMMDD') || '-' || 
         lpad(nextval('tx_ref_seq')::TEXT, 6, '0');
$$ LANGUAGE SQL;

-- Auto-update timestamps
CREATE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_balances_updated_at
  BEFORE UPDATE ON balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Views

```sql
-- Platform treasury overview
CREATE VIEW platform_treasury AS
SELECT
  SUM(available_amount + pending_amount) as total_user_balances_cents,
  (SELECT SUM(amount) FROM escrow_holds WHERE status = 'held') as total_escrow_cents,
  (SELECT SUM(amount) FROM platform_fees WHERE NOT withdrawn) as total_fees_cents;

-- User balance summary
CREATE VIEW user_balance_summary AS
SELECT
  u.id,
  u.email,
  u.role,
  COALESCE(b.available_amount, 0) as available_cents,
  COALESCE(b.pending_amount, 0) as pending_cents,
  (SELECT COUNT(*) FROM escrow_holds WHERE barber_id = u.id AND status = 'held') as active_escrows
FROM users u
LEFT JOIN balances b ON u.id = b.user_id;
```

---

## Services Layer

### 1. Transaction Service (`transaction.service.ts`)

**Purpose:** Core custodial wallet operations

**Key Methods:**
```typescript
class TransactionService {
  // Get user balance (available + pending)
  async getUserBalance(userId: string): Promise<UserBalance>

  // Create transaction and update balance atomically
  async createTransaction(input: CreateTransactionInput): Promise<Transaction>

  // Update pending balance (for escrow operations)
  async updatePendingBalance(userId: string, amountChange: number): Promise<void>

  // Transfer between users (e.g., tips)
  async transfer(params: TransferParams): Promise<{ debit: Transaction; credit: Transaction }>

  // Get transaction history
  async getTransactionHistory(userId: string, limit, offset): Promise<TransactionHistory>
}
```

**Features:**
- Atomic database transactions with row locking
- Balance validation (prevents negative balances)
- Transaction references (TX-YYYYMMDD-NNNNNN)
- Complete audit trail

**Transaction Types:**
- `CHARGE` - Stripe charge to user balance
- `HOLD` - Funds held in escrow
- `RELEASE` - Escrow released to barber
- `PAYOUT` - Withdrawal to bank
- `REFUND` - Refund to consumer
- `FEE` - Platform fee collected
- `ONCHAIN_WITHDRAWAL` - Blockchain withdrawal
- `TIP` - Tip payment
- `ADJUSTMENT` - Admin adjustment
- `REVERSAL` - Transaction reversal

### 2. Escrow Service (`escrow.service.ts`)

**Purpose:** Booking payment holds (hold → release → refund)

**Key Methods:**
```typescript
class EscrowService {
  // Create escrow hold for booking
  async createHold(input: CreateEscrowInput): Promise<EscrowHold>

  // Release escrow to barber on completion
  async releaseHold(input: ReleaseEscrowInput): Promise<{ escrow, net_to_barber }>

  // Refund escrow to consumer on cancellation
  async refundHold(bookingId: string, reason: string): Promise<EscrowHold>

  // Get escrow by booking ID
  async getEscrowByBooking(bookingId: string): Promise<EscrowHold | null>

  // Get all escrows for user
  async getUserEscrows(userId: string, status?): Promise<EscrowHold[]>

  // Process expired escrows (background job)
  async processExpiredEscrows(): Promise<number>
}
```

**Flow:**
1. **Create Hold:** Debit consumer, credit barber.pending
2. **Release Hold:** Move barber.pending → barber.available, deduct platform fee
3. **Refund Hold:** Debit barber.pending, credit consumer.available

**Expiration Handling:**
- Default: 48 hours
- Auto-refund if expired
- Background job runs hourly

### 3. On-Chain Anchor Service (`onchain-anchor.service.ts`)

**Purpose:** Hash-based blockchain proofs (500x cheaper!)

**Key Methods:**
```typescript
class OnChainAnchorService {
  // Anchor single proof on-chain
  async anchorProof(input: AnchorProofInput): Promise<OnChainRecord>

  // Anchor batch (Merkle root for multiple proofs)
  async anchorBatch(input: BatchAnchorInput): Promise<OnChainRecord>

  // Verify proof against on-chain record
  async verifyProof(subjectId: string, data: any): Promise<boolean>

  // Helper: Anchor booking completion
  async anchorBookingCompletion(bookingId: string, details: any): Promise<OnChainRecord>
}
```

**Cost Comparison:**
- Full data: $0.50 per booking
- Hash proof: $0.0001 per booking
- **Savings: 500x!**

**How It Works:**
1. Compute SHA-256 hash of data
2. Store hash on-chain (compact)
3. Store full data in database
4. Can verify data against hash later

**Batching:**
- Multiple proofs → Single Merkle root
- Even more gas efficient
- Background job batches proofs

### 4. Withdrawal Batch Service (`withdrawal-batch.service.ts`)

**Purpose:** 99.8% gas savings through batching

**Key Methods:**
```typescript
class WithdrawalBatchService {
  // Queue withdrawal for batching
  async queueWithdrawal(input: QueueWithdrawalInput): Promise<WithdrawalQueueItem>

  // Process batch (background job, every 15min)
  async processBatch(chain: string, minBatchSize: number): Promise<WithdrawalBatch | null>

  // Get user's withdrawal history
  async getUserWithdrawals(userId: string): Promise<WithdrawalQueueItem[]>

  // Get batch statistics
  async getStats(): Promise<WithdrawalBatchStats>
}
```

**Cost Comparison:**
- Individual: 1000 withdrawals × $0.001 = $1.00
- Batched: 1 transaction = $0.002
- **Savings: 99.8%!**

**Process:**
1. User requests withdrawal → Queued
2. Background job (every 15min) → Batches queued withdrawals
3. Single on-chain transaction → All recipients
4. Mark all as completed

### 5. Reconciliation Service (`reconciliation.service.ts`)

**Purpose:** Daily fraud detection & compliance

**Key Methods:**
```typescript
class ReconciliationService {
  // Run daily reconciliation
  async runDailyReconciliation(date?: Date): Promise<ReconciliationReport>

  // Get recent reports
  async getRecentReports(limit: number): Promise<ReconciliationReport[]>
}
```

**Checks:**
1. **Stripe Reconciliation:** Stripe charges vs internal transactions
2. **On-Chain Reconciliation:** On-chain records vs internal records
3. **Internal Consistency:** User balances vs transaction sum

**Discrepancy Handling:**
- Alert admins immediately
- Log in reconciliation_reports table
- Requires manual resolution

**Schedule:** Daily at 2 AM (cron: `0 2 * * *`)

### 6. Audit Service (`audit.service.ts`)

**Purpose:** Immutable audit logging

**Key Methods:**
```typescript
class AuditService {
  // Create audit log entry
  async log(input: AuditLogInput): Promise<AuditLog>

  // Get user audit logs
  async getUserAuditLogs(userId: string): Promise<AuditLog[]>

  // Get object audit logs
  async getObjectAuditLogs(objectType: string, objectId: string): Promise<AuditLog[]>
}
```

**Logged Actions:**
- escrow_hold_created
- escrow_released
- escrow_refunded
- withdrawal_queued
- platform_fees_withdrawn
- promotional_credit_issued
- booking_created
- booking_completed
- booking_cancelled

### 7-9. Integration Services

**Payment Service V2 (`payment-v2.service.ts`):**
- Stripe integration
- Escrow-based booking payments
- Deposit handling
- Tip processing

**Payout Service V2 (`payout-v2.service.ts`):**
- Bank withdrawals (Stripe Connect)
- On-chain withdrawals (queued)
- Stripe account management

**Aptos Service (`aptos.service.ts`):**
- Blockchain interaction
- Batch withdrawals
- Hash anchoring
- Account management

---

## Controllers & Routes

### V2 Booking Controller (`booking-v2.controller.ts`)

**Routes:** `/api/v2/bookings`

```typescript
// Create booking (creates escrow hold)
POST /api/v2/bookings
Body: { barberId, serviceId, priceCents, requestedSlot }
Response: { booking, escrow }

// Get bookings
GET /api/v2/bookings?status=pending
Response: { bookings[] }

// Get booking by ID
GET /api/v2/bookings/:id
Response: { booking }

// Complete booking (release escrow)
POST /api/v2/bookings/:id/complete
Body: { tipCents? }
Response: { net_to_barber_dollars, platform_fee_dollars }

// Cancel booking (refund escrow)
POST /api/v2/bookings/:id/cancel
Body: { reason }
Response: { refund_amount_dollars }
```

### V2 Wallet Controller (`wallet-v2.controller.ts`)

**Routes:** `/api/v2/wallet`

```typescript
// Get balance
GET /api/v2/wallet/balance
Response: { available_dollars, pending_dollars, active_escrows }

// Create deposit intent (Stripe Elements)
POST /api/v2/wallet/deposit/intent
Body: { amount }
Response: { clientSecret, paymentIntentId }

// Get transaction history
GET /api/v2/wallet/transactions?limit=50&offset=0
Response: { transactions[], total }

// Withdraw to bank (instant)
POST /api/v2/wallet/withdraw/bank
Body: { amount }
Response: { payout_id }

// Withdraw on-chain (queued for batching)
POST /api/v2/wallet/withdraw/onchain
Body: { amount, destinationAddress, chain }
Response: { queue_id, status: 'queued' }

// Get withdrawal history
GET /api/v2/wallet/withdrawals
Response: { withdrawals[] }

// Send tip
POST /api/v2/wallet/tip
Body: { toUserId, amount, bookingId? }
Response: { success }

// Get active escrows
GET /api/v2/wallet/escrows?status=held
Response: { escrows[] }
```

### Admin Controller (`admin.controller.ts`)

**Routes:** `/api/admin`

```typescript
// Get platform treasury stats
GET /api/admin/treasury
Response: { total_user_balances_dollars, total_escrow_dollars, total_fees_dollars }

// Get platform fees summary
GET /api/admin/fees
Response: { available_fees_dollars, withdrawn_fees_dollars, available_count }

// Withdraw platform fees
POST /api/admin/fees/withdraw
Body: { amountCents, destinationType, destinationId }
Response: { amount_withdrawn_dollars, remaining_fees_dollars }

// Run reconciliation
POST /api/admin/reconciliation/run
Body: { date? }
Response: { report }

// Get reconciliation reports
GET /api/admin/reconciliation/reports?limit=30
Response: { reports[] }

// Get withdrawal batch stats
GET /api/admin/withdrawals/batches
Response: { queued_count, queued_total_dollars, processing_count }

// Manually process batch
POST /api/admin/withdrawals/process-batch
Body: { chain }
Response: { batch }

// Get user balance (admin)
GET /api/admin/users/:userId/balance
Response: { available_dollars, pending_dollars, total_dollars }

// Issue promotional credit
POST /api/admin/users/:userId/credit
Body: { amount, description }
Response: { success }

// Get audit logs
GET /api/admin/audit-logs?limit=100&offset=0
Response: { logs[], total }
```

---

## Background Jobs

### 1. Withdrawal Batching

**File:** `scripts/batch-withdrawals.js`

**Schedule:** Every 15 minutes (`*/15 * * * *`)

**Function:**
```typescript
import withdrawalBatchService from './services/withdrawal-batch.service';

async function batchWithdrawals() {
  await withdrawalBatchService.processBatch('aptos', 1);
}
```

**What It Does:**
1. Gets all queued withdrawals
2. Groups them into a batch
3. Submits single on-chain transaction
4. Marks all as completed

**Monitoring:**
- Check `/api/admin/withdrawals/batches` for stats
- Alert if batch fails
- Retry logic for failures

### 2. Daily Reconciliation

**File:** `scripts/daily-reconciliation.js`

**Schedule:** Daily at 2 AM (`0 2 * * *`)

**Function:**
```typescript
import reconciliationService from './services/reconciliation.service';

async function dailyReconciliation() {
  const report = await reconciliationService.runDailyReconciliation();
  
  if (report.status === 'discrepancies') {
    // Send alert to admins
    await sendDiscrepancyAlert(report);
  }
}
```

**What It Does:**
1. Reconciles Stripe vs internal ledger
2. Checks on-chain records vs internal
3. Validates user balances vs transaction sum
4. Creates reconciliation report

**Alerts:**
- Email admins if discrepancies found
- Slack notification
- Admin dashboard notification

### 3. Expired Escrow Cleanup

**File:** `scripts/process-expired-escrows.js`

**Schedule:** Every hour (`0 * * * *`)

**Function:**
```typescript
import escrowService from './services/escrow.service';

async function processExpiredEscrows() {
  const count = await escrowService.processExpiredEscrows();
  console.log(`Processed ${count} expired escrows`);
}
```

**What It Does:**
1. Finds escrows with status='held' and expires_at < NOW()
2. Auto-refunds each expired escrow
3. Updates escrow status to 'expired'

---

## Security & Compliance

### Authentication

**JWT-Based:**
```typescript
// middleware/auth.ts
export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
};
```

**Role-Based Access:**
- Student: Can book, view own bookings, manage wallet
- Barber: Can view bookings, complete services, withdraw funds
- Admin: Full platform access

### Input Validation

**Joi Schemas:**
```typescript
// utils/validation.ts
export const createBookingSchema = Joi.object({
  barberId: Joi.string().uuid().required(),
  priceCents: Joi.number().integer().min(100).required(),
  requestedSlot: Joi.date().iso().required(),
});
```

**Validation Middleware:**
```typescript
app.post('/api/v2/bookings', 
  authenticate,
  validate(createBookingSchema),
  bookingController.createBooking
);
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
});

app.use('/api/', limiter);
```

### Error Handling

**Global Error Handler:**
```typescript
// middleware/errorHandler.ts
export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  logger.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
```

### Database Security

**Row-Level Locking:**
```typescript
const client = await pool.connect();
await client.query('BEGIN');

// Lock user's balance row
const result = await client.query(
  'SELECT * FROM balances WHERE user_id = $1 FOR UPDATE',
  [userId]
);

// Perform balance update
await client.query(
  'UPDATE balances SET available_amount = $1 WHERE user_id = $2',
  [newAmount, userId]
);

await client.query('COMMIT');
client.release();
```

**Atomic Transactions:**
- All balance updates wrapped in transactions
- Row locking prevents race conditions
- Rollback on any error

---

## Deployment Guide

### Environment Variables

```bash
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/campuscuts

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Aptos
APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
APTOS_PLATFORM_PRIVATE_KEY=0x...
APTOS_PLATFORM_ADDRESS=0x...

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=campuscuts-media

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

### Database Setup

```bash
# Create database
createdb campuscuts_production

# Run migrations
psql -d campuscuts_production -f src/database/schema-v2.sql

# Verify tables
psql -d campuscuts_production -c "\dt"
```

### Production Deployment (AWS Example)

```bash
# Build
npm run build

# Start with PM2
pm2 start dist/index.js --name campuscuts-backend

# Set up cron jobs
crontab -e
```

**Cron Jobs:**
```cron
*/15 * * * * cd /app && node dist/scripts/batch-withdrawals.js
0 2 * * * cd /app && node dist/scripts/daily-reconciliation.js
0 * * * * cd /app && node dist/scripts/process-expired-escrows.js
```

### Monitoring

**Health Check Endpoint:**
```typescript
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

**Monitoring Metrics:**
- Request rate & latency
- Error rate
- Database connection pool
- Memory usage
- Withdrawal batch success rate
- Reconciliation status

---

## Troubleshooting

### Common Issues

**1. Backend won't start:**
```bash
# Check TypeScript compilation
npm run build

# Check environment variables
cat .env

# Check database connection
psql -d campuscuts_dev -c "SELECT 1;"
```

**2. Balance mismatch:**
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

**3. Escrow stuck:**
```typescript
// Manually process expired escrows
import escrowService from './src/services/escrow.service';
await escrowService.processExpiredEscrows();
```

**4. Withdrawal batch failed:**
```sql
-- Check batch status
SELECT * FROM withdrawal_batches WHERE status = 'failed';

-- Get failed withdrawals
SELECT * FROM withdrawal_queue WHERE status = 'failed';

-- Refund failed withdrawals (creates adjustment transactions)
-- This is handled automatically by withdrawalBatchService
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev

# Or specific namespaces
DEBUG=express:*,campuscuts:* npm run dev
```

### Database Queries

**Platform Stats:**
```sql
SELECT * FROM platform_treasury;
```

**User Balance:**
```sql
SELECT * FROM user_balance_summary WHERE email = 'user@example.edu';
```

**Recent Transactions:**
```sql
SELECT * FROM transactions 
WHERE user_id = '<user_id>' 
ORDER BY created_at DESC 
LIMIT 20;
```

**Active Escrows:**
```sql
SELECT * FROM escrow_holds WHERE status = 'held';
```

---

## API Testing

### Using cURL

**Create Booking:**
```bash
curl -X POST http://localhost:3001/api/v2/bookings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "barberId": "uuid",
    "priceCents": 3000,
    "requestedSlot": "2025-12-01T10:00:00Z"
  }'
```

**Get Balance:**
```bash
curl http://localhost:3001/api/v2/wallet/balance \
  -H "Authorization: Bearer <token>"
```

**Admin: Run Reconciliation:**
```bash
curl -X POST http://localhost:3001/api/admin/reconciliation/run \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
```

---

## Performance Optimization

### Database Indexes
- All foreign keys indexed
- Created_at timestamps indexed for sorting
- tx_ref unique index for fast lookups
- Composite indexes for common queries

### Caching (Redis)
- User balances (5 min TTL)
- Platform stats (1 min TTL)
- Barber profiles (10 min TTL)

### Query Optimization
- Use of database views for complex queries
- Pagination for all list endpoints
- Selective field loading
- Connection pooling

---

**For more information, see:**
- README.md - Project overview
- FRONTEND.md - Frontend documentation
- API testing examples in Postman collection

**Support:** Create an issue on GitHub or contact support@campuscuts.com

