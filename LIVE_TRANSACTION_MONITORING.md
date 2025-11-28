# Live Transaction Monitoring System

**Real-time blockchain and payment tracking for CampusCuts Admin Dashboard**

---

## Overview

The Live Transaction Monitoring System provides **real-time visibility** into all financial transactions occurring on the CampusCuts platform, combining data from both:

1. **Aptos Blockchain** (on-chain custodial wallet transactions)
2. **Stripe Payments** (off-chain fiat payments between students and barbers)

Admins can monitor transactions as they happen, with **WebSocket-powered live updates** appearing instantly in the dashboard.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD (FRONTEND)                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  LiveTransactionFeed Component                           │ │
│  │  - Displays transactions in real-time                    │ │
│  │  - Filters by platform (Aptos / Stripe / All)           │ │
│  │  - Shows stats (24h volume, count)                      │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
                            ↑ ↓
                    WebSocket Connection
                    (Socket.IO - Real-time)
                            ↑ ↓
┌───────────────────────────────────────────────────────────────┐
│                     BACKEND SERVER                             │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  │
│  │  Aptos Monitor Service   │  │ Stripe Monitor Service   │  │
│  │  - Polls Aptos API       │  │ - Captures webhooks      │  │
│  │  - Parses transactions   │  │ - Processes events       │  │
│  │  - Filters platform txs  │  │ - Extracts metadata      │  │
│  │  - Stores in DB          │  │ - Stores in DB           │  │
│  │  - Broadcasts via WS     │  │ - Broadcasts via WS      │  │
│  └──────────────────────────┘  └──────────────────────────┘  │
│                            ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database                                     │ │
│  │  - aptos_transactions table                             │ │
│  │  - stripe_events table                                  │ │
│  │  - admin_transaction_feed view (combined)               │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
            ↑                                       ↑
    ┌───────┴──────────┐                  ┌─────────┴────────┐
    │  Aptos Blockchain│                  │   Stripe API      │
    │  Public Ledger   │                  │   Webhooks        │
    └──────────────────┘                  └───────────────────┘
```

---

## Components

### 1. Aptos Monitor Service

**File:** `backend/src/services/aptos-monitor.service.ts`

**Purpose:** Continuously monitors the Aptos blockchain for transactions involving the platform's master wallet.

**How It Works:**

1. **Polling:** Queries Aptos REST API every 10 seconds
   - Endpoint: `GET /accounts/{address}/transactions`
   - Fetches last 25 transactions
   - Tracks last processed version to avoid duplicates

2. **Parsing:** Identifies platform-specific transactions
   - **Deposits:** APT sent to platform wallet
   - **Withdrawals:** APT sent from platform wallet
   - **Batch Withdrawals:** Multiple withdrawals in one transaction
   - **On-chain Proofs:** Hash anchoring (booking completion, etc.)

3. **Storage:** Stores in `aptos_transactions` table
   ```sql
   INSERT INTO aptos_transactions (
     version, tx_hash, tx_type, sender, recipient,
     amount_octas, amount_usd, gas_used, success,
     timestamp, description, metadata, platform_address, raw_data
   ) VALUES (...)
   ```

4. **Broadcasting:** Sends to admin dashboard via Socket.IO
   ```typescript
   io.to('admin-live-feed').emit('aptos-transaction', parsedTransaction);
   ```

**Transaction Types Detected:**

| Type | Description | Example |
|------|-------------|---------|
| `deposit` | APT sent to platform wallet | Student deposits 10 APT |
| `withdrawal` | APT sent from platform wallet | Barber withdraws 5 APT |
| `batch_withdrawal` | Multiple withdrawals in 1 tx | Payout to 50 barbers |
| `onchain_proof` | Hash stored on-chain | Booking completion proof |

---

### 2. Stripe Monitor Service

**File:** `backend/src/services/stripe-monitor.service.ts`

**Purpose:** Captures all Stripe payment events in real-time via webhooks.

**How It Works:**

1. **Webhook Reception:** Stripe sends events to `/api/webhooks/stripe`
   - Events like `payment_intent.succeeded`, `transfer.paid`, `payout.paid`

2. **Processing:** Extracts relevant data
   - Student email, barber email, booking ID
   - Payment amounts, statuses
   - Metadata (stored from payment creation)

3. **Storage:** Stores in `stripe_events` table
   ```sql
   INSERT INTO stripe_events (
     event_id, event_type, payment_intent_id, customer_id,
     amount_cents, amount_usd, status, timestamp,
     description, metadata, student_email, barber_email,
     booking_id, raw_data
   ) VALUES (...)
   ```

4. **Broadcasting:** Sends to admin dashboard via Socket.IO
   ```typescript
   io.to('admin-live-feed').emit('stripe-payment', parsedEvent);
   ```

**Event Types Captured:**

| Event | Description | Example |
|-------|-------------|---------|
| `payment_intent.created` | Payment initiated | Student starts payment |
| `payment_intent.succeeded` | Payment completed | Student pays $30 |
| `charge.refunded` | Payment refunded | Barber cancels, refund issued |
| `transfer.created` | Money transferred to barber | Platform → Barber (Stripe Connect) |
| `payout.paid` | Barber receives money in bank | Barber's bank account credited |

---

### 3. Database Schema

**File:** `backend/src/database/migrations/002_live_transaction_monitoring.sql`

**Tables:**

#### `aptos_transactions`
Stores Aptos blockchain transactions.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| version | TEXT | Aptos transaction version |
| tx_hash | TEXT | Transaction hash (unique) |
| tx_type | TEXT | deposit, withdrawal, batch_withdrawal, onchain_proof |
| sender | TEXT | Sender address |
| recipient | TEXT | Recipient address (nullable) |
| amount_octas | BIGINT | Amount in octas (1 APT = 100M octas) |
| amount_usd | DECIMAL | Approximate USD value |
| gas_used | BIGINT | Gas consumed |
| success | BOOLEAN | Transaction success status |
| timestamp | TIMESTAMPTZ | Transaction timestamp |
| description | TEXT | Human-readable description |
| metadata | JSONB | Additional data |
| platform_address | TEXT | Platform wallet address |
| raw_data | JSONB | Full Aptos transaction data |

#### `stripe_events`
Stores Stripe webhook events.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| event_id | TEXT | Stripe event ID (unique) |
| event_type | TEXT | Event type (e.g., payment_intent.succeeded) |
| payment_intent_id | TEXT | Associated payment intent |
| customer_id | TEXT | Stripe customer ID |
| amount_cents | BIGINT | Amount in cents |
| amount_usd | DECIMAL | Amount in dollars |
| status | TEXT | Event status |
| timestamp | TIMESTAMPTZ | Event timestamp |
| description | TEXT | Human-readable description |
| metadata | JSONB | Additional data |
| student_email | TEXT | Student email |
| barber_email | TEXT | Barber email |
| booking_id | TEXT | Associated booking |
| raw_data | JSONB | Full Stripe event data |

#### `admin_transaction_feed` (VIEW)
Combined view of both Aptos and Stripe transactions.

```sql
SELECT 
  'aptos' AS platform,
  tx_hash AS transaction_id,
  tx_type AS transaction_type,
  sender AS from_address,
  recipient AS to_address,
  amount_usd,
  description,
  timestamp,
  success AS status_success,
  metadata
FROM aptos_transactions

UNION ALL

SELECT 
  'stripe' AS platform,
  event_id AS transaction_id,
  event_type AS transaction_type,
  student_email AS from_address,
  barber_email AS to_address,
  amount_usd,
  description,
  timestamp,
  (status IN ('succeeded', 'paid', 'created')) AS status_success,
  metadata
FROM stripe_events

ORDER BY timestamp DESC;
```

---

### 4. API Endpoints

**File:** `backend/src/routes/live-feed.routes.ts`

All endpoints require authentication and admin role.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/live-feed` | GET | Get combined transaction feed |
| `/api/admin/live-feed/aptos` | GET | Get recent Aptos transactions |
| `/api/admin/live-feed/stripe` | GET | Get recent Stripe events |
| `/api/admin/live-feed/stats` | GET | Get platform statistics |
| `/api/admin/live-feed/search` | GET | Search transactions with filters |

**Example Request:**

```bash
# Get last 50 transactions from all platforms
GET /api/admin/live-feed?limit=50&platform=all

# Get Stripe transactions only
GET /api/admin/live-feed?limit=25&platform=stripe

# Search for specific transaction
GET /api/admin/live-feed/search?query=booking-123&platform=all
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "platform": "stripe",
      "transaction_id": "evt_1234567890",
      "transaction_type": "payment_intent.succeeded",
      "from_address": "student@calpoly.edu",
      "to_address": "barber@calpoly.edu",
      "amount_usd": 30.00,
      "description": "Payment succeeded: $30.00",
      "timestamp": "2025-11-28T10:30:00Z",
      "status_success": true,
      "metadata": {
        "bookingId": "booking-123",
        "barberId": "barber-456"
      }
    },
    {
      "platform": "aptos",
      "transaction_id": "0xabc123...",
      "transaction_type": "batch_withdrawal",
      "from_address": "0x50c7bf...",
      "to_address": null,
      "amount_usd": 1250.00,
      "description": "Batch withdrawal to 50 users",
      "timestamp": "2025-11-28T10:15:00Z",
      "status_success": true,
      "metadata": {
        "recipients": ["0x123...", "0x456..."],
        "amounts": [30000000, 25000000]
      }
    }
  ],
  "count": 2,
  "platform": "all"
}
```

---

### 5. Frontend Component

**File:** `web-app/src/components/LiveTransactionFeed.tsx`

**Features:**

1. **Real-time WebSocket Connection**
   - Connects to `http://localhost:3001` via Socket.IO
   - Joins `admin-live-feed` room
   - Listens for `aptos-transaction` and `stripe-payment` events

2. **Live Updates**
   - New transactions appear at the top
   - Toast notifications for each new transaction
   - Connection status indicator (🟢 Connected / 🔴 Disconnected)

3. **Filtering**
   - Filter by platform: All / Aptos / Stripe
   - Shows transaction count for each filter

4. **Transaction Display**
   - Platform icon (⛓️ Aptos / 💳 Stripe)
   - Description and transaction ID
   - From/To addresses (truncated)
   - Amount in USD (and APT for Aptos)
   - Status badge (Success / Failed / Refunded / etc.)
   - Relative timestamp ("2m ago", "1h ago")

5. **Statistics Cards**
   - WebSocket connection status
   - Total transactions (last 24h)
   - Total volume (last 24h)

6. **Auto-scrolling Feed**
   - Max height: 600px
   - Keeps last 100 transactions
   - Scrollable list

---

## Usage

### Starting the System

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   ```
   - Aptos monitor starts automatically if `APTOS_PLATFORM_ADDRESS` is configured
   - Stripe monitor is always active (webhook-driven)

2. **Start Frontend:**
   ```bash
   cd web-app
   npm run dev
   ```

3. **Access Admin Dashboard:**
   ```
   http://localhost:3000/admin
   ```

4. **Navigate to Live Feed:**
   - Click **"Custodial Wallet"** tab
   - Click **"🔴 Live Feed"** sub-tab

### What You'll See

**Real-time transactions appearing as they happen:**

```
⛓️ Batch withdrawal to 50 users
   Transaction ID: 0xabc123...
   From: 0x50c7bf... → Multiple recipients
   Amount: $1,250.00
   Gas: 15000 units
   Status: Success
   2m ago

💳 Payment succeeded: $30.00
   Transaction ID: evt_1234567890
   Student: student@calpoly.edu
   Barber: barber@calpoly.edu
   Booking: booking-123
   Value: $30.00
   Status: Succeeded
   5m ago

⛓️ Deposit: 10.0000 APT
   Transaction ID: 0xdef456...
   From: 0x789abc...
   Amount: 10.0000 APT ($100.00)
   Status: Success
   10m ago
```

---

## Configuration

### Environment Variables

Add to `backend/.env`:

```bash
# Platform wallet address (for Aptos monitoring)
APTOS_PLATFORM_ADDRESS=0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa

# Stripe webhook secret (for signature verification)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Database Setup

Run migration:

```bash
cd backend
psql -U postgres -d campuscuts -f src/database/migrations/002_live_transaction_monitoring.sql
```

This creates:
- `aptos_transactions` table
- `stripe_events` table
- `admin_transaction_feed` view
- `daily_transaction_stats` view
- `realtime_platform_stats` view

---

## Platform Address

The platform's custodial wallet address on Aptos:

```
Network: Devnet
Address: 0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa

Explorer: https://explorer.aptoslabs.com/account/0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa?network=devnet
```

**All monitored transactions involve this address.**

---

## Security

1. **Admin-Only Access:**
   - All live feed endpoints require authentication
   - WebSocket room `admin-live-feed` should verify admin role
   - TODO: Add role check before allowing WebSocket join

2. **Webhook Signature Verification:**
   - All Stripe webhooks are verified with `STRIPE_WEBHOOK_SECRET`
   - Prevents unauthorized event injection

3. **Rate Limiting:**
   - Aptos polling: 10-second intervals (6 requests/minute)
   - API endpoints: Rate-limited via express-rate-limit

4. **Data Privacy:**
   - Full raw transaction data stored in `raw_data` JSONB field
   - Displayed data is filtered for admin dashboard
   - Student/barber emails only shown to admins

---

## Benefits

### For Platform Operators

✅ **Real-time Visibility:** See every transaction as it happens  
✅ **Fraud Detection:** Identify suspicious patterns immediately  
✅ **System Health:** Monitor if blockchain and Stripe are functioning  
✅ **User Support:** Quickly lookup transaction status for support tickets  
✅ **Reconciliation:** Verify internal balances match on-chain reality  
✅ **Analytics:** Understand platform usage in real-time  

### Technical Advantages

✅ **No Polling from Frontend:** WebSocket push > HTTP polling  
✅ **Scalable:** Database stores history, WebSocket for live updates  
✅ **Unified View:** Both Aptos and Stripe in one feed  
✅ **Searchable:** Full-text search across all transaction data  
✅ **Auditable:** Complete raw data stored for compliance  

---

## Future Enhancements

1. **Advanced Filtering:**
   - Date range picker
   - Amount range slider
   - Status filters
   - User search (by email or address)

2. **Export Functionality:**
   - Export to CSV
   - Generate PDF reports
   - Email alerts for large transactions

3. **Alerts & Notifications:**
   - Slack/Discord webhooks for failed transactions
   - Email alerts for transactions > $1000
   - SMS alerts for emergency situations

4. **Analytics Dashboard:**
   - Real-time charts (transactions/hour, volume/day)
   - Heatmap of transaction times
   - Platform comparison (Aptos vs Stripe volume)

5. **Transaction Details Modal:**
   - Click transaction → Full details popup
   - View raw blockchain data
   - Link to Aptos Explorer
   - Link to Stripe Dashboard

---

## Troubleshooting

### Aptos Monitor Not Starting

**Symptom:** No Aptos transactions appearing

**Solution:**
1. Check `APTOS_PLATFORM_ADDRESS` is set in `.env`
2. Verify backend logs for: `🔍 Aptos blockchain monitor started`
3. If not started, check: `⚠️ Aptos monitor not started - APTOS_PLATFORM_ADDRESS not configured`

### Stripe Events Not Appearing

**Symptom:** No Stripe payments showing up

**Solution:**
1. Verify webhook is configured in Stripe Dashboard
2. Check webhook secret matches `STRIPE_WEBHOOK_SECRET`
3. Test webhook with Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3001/api/webhooks/stripe
   ```

### WebSocket Not Connecting

**Symptom:** Dashboard shows "🔴 Disconnected"

**Solution:**
1. Verify backend is running on port 3001
2. Check browser console for Socket.IO errors
3. Ensure CORS allows `http://localhost:3000`

### No Transactions Showing

**Symptom:** Feed is empty

**Solution:**
1. Check database has data:
   ```sql
   SELECT COUNT(*) FROM admin_transaction_feed;
   ```
2. Generate test transaction:
   - Send APT to platform address
   - Create a test Stripe payment
3. Check API endpoint directly:
   ```bash
   curl http://localhost:3001/api/admin/live-feed
   ```

---

## Summary

The Live Transaction Monitoring System provides **complete visibility** into all financial activity on CampusCuts, combining:

- **Aptos blockchain transactions** (deposits, withdrawals, proofs)
- **Stripe payment events** (payments, refunds, payouts)

Into a **unified, real-time dashboard** powered by WebSocket for instant updates.

Perfect for:
- Monitoring platform health
- Debugging payment issues
- Supporting users
- Detecting fraud
- Ensuring compliance

**All transactions involving the platform wallet are captured, stored, and broadcast to admins in real-time.** 🚀

