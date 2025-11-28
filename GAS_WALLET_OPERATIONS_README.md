# Gas Wallet Management System - Operations Guide

**Production-Grade Aptos Gas Top-Up Flow for CampusCuts**

Version: 1.0  
Status: Production Ready  
Author: CampusCuts Engineering Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Configuration](#setup--configuration)
4. [API Reference](#api-reference)
5. [Admin Workflow](#admin-workflow)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Troubleshooting](#troubleshooting)
8. [Security](#security)
9. [Emergency Procedures](#emergency-procedures)
10. [Testing Guide](#testing-guide)

---

## Overview

### What is the Gas Wallet System?

The Gas Wallet Management System automatically monitors the platform's Aptos gas reserves and facilitates admin-approved top-ups to ensure continuous on-chain operations.

**Key Features:**
- ✅ Automated gas estimation (24h lookahead)
- ✅ Configurable safety buffers (default 20%)
- ✅ Admin wallet connection (Petra/Pontem)
- ✅ On-chain transaction verification
- ✅ Complete audit trail
- ✅ Idempotent API requests
- ✅ Real-time monitoring

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  GAS WALLET FLOW                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. ESTIMATION (Cron - every 30 min)                         │
│     ↓                                                         │
│     Backend estimates gas needs for next 24h                 │
│     Formula: (pending_writes × avg_gas) × (1 + buffer)       │
│     ↓                                                         │
│     If needed > threshold → Create top-up request            │
│                                                               │
│  2. ADMIN APPROVAL (Manual Transfer)                         │
│     ↓                                                         │
│     Admin views transfer instructions (Petra/CLI)            │
│     ↓                                                         │
│     Admin completes transfer in wallet or CLI                │
│     (admin_wallet → platform_gas_wallet)                     │
│     ↓                                                         │
│     Admin submits tx_hash + from_address to backend          │
│                                                               │
│  3. VERIFICATION (Backend Watcher)                           │
│     ↓                                                         │
│     Backend polls Aptos blockchain for confirmation          │
│     ↓                                                         │
│     Verifies: amount, recipient, success status              │
│     ↓                                                         │
│     Marks request: completed/failed                          │
│     ↓                                                         │
│     Updates gas wallet cached balance                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Setup & Configuration

### 1. Database Setup

Run the migration to create required tables:

```bash
cd backend
psql -U postgres -d campuscuts -f src/database/migrations/003_gas_wallet_management.sql
```

**Tables Created:**
- `gas_wallets` - Platform gas wallets
- `gas_top_up_requests` - Top-up requests
- `gas_wallet_audit_logs` - Audit trail
- `gas_estimation_config` - Configuration parameters

### 2. Environment Variables

Add to `backend/.env`:

```bash
# Gas Wallet Configuration
APTOS_PLATFORM_ADDRESS=0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa
APTOS_PLATFORM_PRIVATE_KEY=0x...your_private_key_here

# Gas Monitor Cron Schedule (default: every 30 minutes)
GAS_MONITOR_CRON_SCHEDULE=*/30 * * * *

# Aptos Network
APTOS_NETWORK=devnet  # or mainnet
APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
```

Add to `web-app/.env`:

```bash
# Aptos Network for Wallet Adapter
VITE_APTOS_NETWORK=devnet  # or mainnet
```

### 3. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

Packages used:
- `decimal.js` - Precise APT/octas math
- `node-cron` - Scheduled gas monitoring
- `uuid` - Idempotency keys

**Frontend:**
```bash
cd web-app
npm install
```

Packages added:
- `decimal.js` - Precise APT/octas conversions

### 4. Configuration Parameters

All configurable parameters are in the `gas_estimation_config` table:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `default_avg_gas_apt_per_write` | 0.0003 APT | Average gas per on-chain write |
| `estimation_horizon_hours` | 24 | How far ahead to estimate |
| `safety_buffer_percentage` | 20% | Safety margin added to estimates |
| `min_balance_alert_threshold_apt` | 0.5 APT | Alert when balance falls below |
| `critical_balance_threshold_apt` | 0.1 APT | Critical alert threshold |
| `auto_create_topup_threshold_apt` | 0.1 APT | Auto-create request when need > this |
| `tx_verification_timeout_minutes` | 10 | How long to wait for tx confirmation |
| `min_confirmations` | 1 | Required blockchain confirmations |

**To update configuration:**
```sql
UPDATE gas_estimation_config 
SET safety_buffer_percentage = 25.0
WHERE is_active = true;
```

---

## API Reference

### Base URL
```
http://localhost:3001/api/gas
```

### Authentication
All endpoints require admin authentication. Include JWT token in `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

---

### GET /api/gas/estimate

Get current gas estimate and wallet status.

**Response:**
```json
{
  "success": true,
  "data": {
    "gasWalletAddress": "0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa",
    "currentBalanceAPT": 1.234567,
    "estimatedNeededAPT": 0.5,
    "amountNeededAPT": 0.15,
    "estimatedCoverageDays": 2.5,
    "timestamp": "2025-11-28T10:30:00Z",
    "metadata": {
      "pendingWrites": 150,
      "avgGasPerWrite": 0.0003,
      "safetyBufferPct": 20,
      "estimationHorizon": "24h"
    }
  }
}
```

---

### POST /api/gas/topup-request

Create a new top-up request.

**Request Body:**
```json
{
  "requestedAmountAPT": 0.5,
  "idempotencyKey": "topup-1701177600-abc123"
}
```

**Parameters:**
- `requestedAmountAPT` (optional) - Amount to request. If not provided, auto-calculated from estimate.
- `idempotencyKey` (optional but recommended) - Prevents duplicate requests.

**Rate Limit:** 5 requests per 15 minutes

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "requested_amount_apt": 0.5,
    "requested_amount_octas": 50000000,
    "status": "pending",
    "reason": "Admin-requested top-up: 0.500000 APT...",
    "gasWalletAddress": "0x50c7bf...",
    "created_at": "2025-11-28T10:30:00Z"
  }
}
```

---

### GET /api/gas/topup-requests

List top-up requests with pagination.

**Query Parameters:**
- `status` (optional) - Filter by status: `pending`, `approved`, `completed`, `failed`, `cancelled`
- `limit` (optional, default 50) - Number of results
- `offset` (optional, default 0) - Pagination offset

**Example:**
```
GET /api/gas/topup-requests?status=pending&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "gas_wallet_address": "0x50c7bf...",
      "requested_amount_apt": 0.5,
      "status": "pending",
      "reason": "Auto-generated...",
      "created_at": "2025-11-28T10:30:00Z",
      "wallet_name": "Platform Main Gas Wallet (Devnet)",
      "admin_email": null
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

---

### GET /api/gas/topup-request/:id

Get single top-up request details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "gas_wallet_address": "0x50c7bf...",
    "requested_amount_apt": 0.5,
    "requested_amount_octas": 50000000,
    "status": "completed",
    "verification_status": "verified",
    "approved_tx_hash": "0xabc123...",
    "verified_amount_octas": 50000000,
    "admin_address_requested_from": "0x789def...",
    "created_at": "2025-11-28T10:30:00Z",
    "approved_at": "2025-11-28T10:35:00Z",
    "completed_at": "2025-11-28T10:36:00Z"
  }
}
```

---

### POST /api/gas/topup-request/:id/confirm

Confirm admin wallet transfer with transaction hash.

**Request Body:**
```json
{
  "txHash": "0xabc123def456...",
  "fromAddress": "0x789def123abc..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction submitted. Verification in progress.",
  "data": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "txHash": "0xabc123...",
    "status": "approved",
    "verificationStatus": "pending"
  }
}
```

---

### POST /api/gas/topup-request/:id/mark-completed

Manual override to mark request as completed (for reconciliation).

**Request Body:**
```json
{
  "verifiedAmountOctas": 50000000,
  "note": "Manual completion after off-chain bank transfer verified"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Request manually marked as completed"
}
```

---

### GET /api/gas/health

Get gas wallet health status.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "address": "0x50c7bf...",
      "descriptive_name": "Platform Main Gas Wallet (Devnet)",
      "current_balance_apt": 1.234567,
      "min_balance_threshold_apt": 0.5,
      "last_checked_at": "2025-11-28T10:30:00Z",
      "health_status": "healthy",
      "pending_top_ups": 0,
      "total_topped_up_apt": 5.5
    }
  ]
}
```

---

## Admin Workflow

### Step-by-Step: Approving a Top-Up Request

**1. Access Admin Dashboard**
```
http://localhost:3000/admin
→ Click ⛽ Gas Wallet tab
```

**2. Review Gas Status**
- Check current balance
- View estimated coverage (days)
- Review pending top-up requests

**3. Create or Review Request**
- If auto-created, you'll see pending request
- OR click "Create Top-Up Request" to create manually
- Enter custom amount or leave empty for auto-calculation

**4. Get Transfer Instructions**
- Click "Transfer APT" on pending request
- Review transfer details:
  - **Amount:** Exact APT to transfer
  - **Destination:** Platform gas wallet address
  - **Amount in octas:** For CLI usage

**5. Complete Transfer (Choose Method)**

**Option A: Petra Wallet (Recommended)**
- Open Petra wallet extension
- Click "Send"
- Paste destination address (provided in UI)
- Enter exact amount shown
- Confirm transaction
- Copy transaction hash from Petra

**Option B: Aptos CLI**
- Copy the provided CLI command
- Run in terminal:
  ```bash
  aptos account transfer \
    --account YOUR_WALLET \
    --receiver-account 0x50c7bf... \
    --amount 50000000
  ```
- Copy transaction hash from output

**6. Submit for Verification**
- Paste transaction hash in form
- Enter your wallet address (sender)
- Click "Submit for Verification"
- Backend watcher polls Aptos blockchain
- Wait ~10-60 seconds for confirmation
- Request status updates to "completed"
- Gas balance automatically refreshed

---

## Monitoring & Alerts

### Automated Monitoring

The system runs a cron job every 30 minutes to:
1. Check gas wallet balance
2. Estimate gas needs for next 24 hours
3. Auto-create top-up request if needed
4. Log events to audit trail

**Cron schedule configured in:** `GAS_MONITOR_CRON_SCHEDULE` env var

### Health Status Indicators

| Status | Coverage | Color | Action Required |
|--------|----------|-------|-----------------|
| **Critical** | < 1 day | Red | Immediate top-up needed |
| **Low** | 1-3 days | Yellow | Schedule top-up soon |
| **Healthy** | > 3 days | Green | No action needed |

### Alert Triggers

**Auto-alerts (logged + future email/Slack):**
- Balance falls below `min_balance_threshold_apt` (0.5 APT)
- Coverage drops below 1 day
- Top-up request created automatically
- Top-up verification fails
- Top-up verification times out

**To implement email alerts:**
```typescript
// In gas-estimator.service.ts
private async sendTopUpAlert(requestId: string, amount: number, reason: string) {
  await emailService.send({
    to: process.env.ADMIN_EMAIL,
    subject: `CampusCuts: Gas Top-Up Required (${amount.toFixed(4)} APT)`,
    body: `Request ID: ${requestId}\nAmount: ${amount.toFixed(6)} APT\nReason: ${reason}`,
  });
}
```

### Audit Logs

All events are logged to `gas_wallet_audit_logs`:

**Event Types:**
- `balance_checked` - Balance refreshed from blockchain
- `top_up_requested` - Request created (auto or manual)
- `top_up_approved` - Admin signed transaction
- `top_up_completed` - Verification succeeded
- `top_up_failed` - Verification failed
- `manual_completion` - Admin manually marked completed
- `alert_sent` - Alert notification sent

**Query audit logs:**
```sql
SELECT 
  event_type,
  actor_type,
  data,
  created_at
FROM gas_wallet_audit_logs
WHERE gas_wallet_id = (SELECT id FROM gas_wallets WHERE is_active = true)
ORDER BY created_at DESC
LIMIT 50;
```

---

## Troubleshooting

### Issue: "Aptos monitor not started"

**Cause:** `APTOS_PLATFORM_ADDRESS` not configured.

**Fix:**
```bash
# Add to backend/.env
APTOS_PLATFORM_ADDRESS=0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa
```

Restart backend:
```bash
cd backend
npm run dev
```

---

### Issue: "Transaction verification timed out"

**Cause:** Transaction not confirmed on blockchain within 10 minutes.

**Possible Reasons:**
1. Transaction not submitted (wallet rejected)
2. Insufficient gas for transaction
3. Network congestion

**Fix:**
1. Check tx hash on Aptos Explorer: https://explorer.aptoslabs.com/txn/{tx_hash}?network=devnet
2. If transaction exists and succeeded, use manual override:
   ```bash
   curl -X POST http://localhost:3001/api/gas/topup-request/{id}/mark-completed \
     -H "Authorization: Bearer {token}" \
     -d '{"verifiedAmountOctas": 50000000, "note": "Manual verification after timeout"}'
   ```
3. If transaction failed, create new request

---

### Issue: "Amount mismatch - verified amount != requested amount"

**Cause:** Admin sent different amount than requested.

**Fix:**
1. Check verification logs:
   ```sql
   SELECT verified_amount_octas, requested_amount_octas, error_message 
   FROM gas_top_up_requests 
   WHERE id = '{request_id}';
   ```
2. If amount is sufficient (verified >= requested), use manual override
3. If amount is insufficient, create supplemental request for difference

---

### Issue: "Wallet won't connect"

**Causes & Fixes:**
1. **Wallet not installed**
   - Install Petra: https://petra.app/
   - Or Pontem: https://pontem.network/

2. **Wrong network selected**
   - Open wallet → Settings → Network
   - Switch to Devnet (for testing) or Mainnet (for production)

3. **Wallet locked**
   - Unlock wallet extension
   - Refresh page

4. **CORS issues**
   - Ensure `http://localhost:3000` is in backend's `allowedOrigins`

---

## Security

### Private Key Management

**⚠️ CRITICAL: Never commit private keys to Git!**

**Development:**
- Store in `backend/.env` (git-ignored)
- Use test/dev wallets only

**Production:**
- Use AWS Secrets Manager, HashiCorp Vault, or Google Secret Manager
- Rotate keys quarterly
- Use multisig for large amounts

**Recommended: KMS/HSM Integration**
```typescript
// Example: AWS KMS integration
import { KMS } from 'aws-sdk';

const kms = new KMS();

async function signWithKMS(payload: Buffer): Promise<Signature> {
  const result = await kms.sign({
    KeyId: process.env.AWS_KMS_KEY_ID,
    Message: payload,
    SigningAlgorithm: 'ECDSA_SHA_256',
  }).promise();

  return parseSignature(result.Signature);
}
```

### Multisig for Large Transfers

For production, consider requiring multiple admin approvals:

**Implementation:**
1. Create Aptos multisig account (3-of-5 threshold)
2. Modify frontend to collect multiple signatures
3. Submit batch signature transaction

**Benefits:**
- No single point of failure
- Protection against compromised admin wallet
- Audit trail of who approved each top-up

### Rate Limiting

**API Protection:**
- Top-up request creation: 5 requests per 15 minutes
- General API: 100 requests per 15 minutes

**Frontend Protection:**
- Disable buttons after submission
- Prevent multiple concurrent signatures

### Audit Requirements

**What to log:**
- All top-up requests (auto + manual)
- Wallet connections (admin address)
- Transaction signatures (tx hash)
- Verification results (success/fail)
- Manual overrides (who, when, why)
- Configuration changes

**Retention:**
- Audit logs: 7 years minimum
- Transaction hashes: Permanent (blockchain)
- Request metadata: 5 years minimum

---

## Emergency Procedures

### Emergency: Gas Wallet Depleted

**Symptoms:**
- Coverage < 1 day
- Critical balance warnings
- On-chain transactions failing

**Immediate Actions:**
1. Create urgent top-up request:
   ```bash
   curl -X POST http://localhost:3001/api/gas/topup-request \
     -H "Authorization: Bearer {admin_token}" \
     -d '{"requestedAmountAPT": 5.0}'
   ```

2. Contact all admin wallet holders
3. First available admin: connect wallet and approve
4. Monitor verification in real-time

**If admin wallets unavailable:**
1. Use emergency backup wallet (if configured)
2. Manual transfer via Aptos CLI:
   ```bash
   aptos account transfer \
     --account {emergency_wallet} \
     --receiver-account 0x50c7bf0be7f5a56f8312ae8a49ec638d0d7b2bc68e061b867ed86d2af82a21aa \
     --amount 500000000
   ```
3. Mark request completed manually with tx hash

---

### Emergency: Verification Service Down

**Symptoms:**
- All top-up requests stuck in "approved" status
- Verification timeout errors

**Diagnosis:**
```bash
# Check backend logs
cd backend
npm run dev
# Look for "Failed to verify transaction" errors
```

**Fix:**
1. Restart backend service
2. Check Aptos node URL connectivity:
   ```bash
   curl https://fullnode.devnet.aptoslabs.com/v1
   ```
3. If node is down, switch to backup:
   ```bash
   # In backend/.env
   APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1  # Backup URL
   ```
4. Manually verify pending requests:
   ```sql
   SELECT id, approved_tx_hash FROM gas_top_up_requests WHERE status = 'approved';
   ```
   For each, check tx on explorer and mark completed if valid

---

## Testing Guide

### Unit Tests

**Run tests:**
```bash
cd backend
npm test
```

**Test Coverage:**
- Gas estimation formula
- APT ↔ octas conversion
- Idempotency key handling
- Request state transitions
- Verification logic

**Example Test:**
```typescript
describe('GasEstimatorService', () => {
  it('should calculate correct amount needed', async () => {
    const estimate = await gasEstimatorService.estimateGas();
    
    expect(estimate.amountNeededAPT).toBeGreaterThanOrEqual(0);
    expect(estimate.estimatedNeededAPT).toBeGreaterThan(estimate.currentBalanceAPT);
  });

  it('should apply safety buffer correctly', async () => {
    const estimate = await gasEstimatorService.estimateGas();
    const baseEstimate = estimate.metadata.pendingWrites * estimate.metadata.avgGasPerWrite;
    const expectedWithBuffer = baseEstimate * (1 + estimate.metadata.safetyBufferPct / 100);
    
    expect(estimate.estimatedNeededAPT).toBeCloseTo(expectedWithBuffer, 6);
  });
});
```

### Integration Tests

**Test against Aptos Devnet:**

1. Fund test admin wallet:
   ```bash
   aptos account fund-with-faucet --account {test_admin_address} --amount 1000000000
   ```

2. Run integration test:
   ```typescript
   describe('Top-Up Flow (Integration)', () => {
     it('should complete full top-up cycle', async () => {
       // 1. Create request
       const request = await gasWalletService.createTopUpRequest(0.5);
       expect(request.status).toBe('pending');

       // 2. Simulate admin approval
       const txHash = await simulateAdminTransfer(request);
       
       // 3. Confirm with backend
       await gasWalletService.confirmTopUpRequest(request.id, txHash, testAdminAddress);
       
       // 4. Wait for verification
       await sleep(60000); // 1 minute
       
       // 5. Check completion
       const updated = await gasWalletService.getTopUpRequest(request.id);
       expect(updated.status).toBe('completed');
       expect(updated.verification_status).toBe('verified');
     });
   });
   ```

### Manual Testing Checklist

**Pre-Deployment:**
- [ ] Verify database migration runs successfully
- [ ] Confirm gas wallet seeded with correct address
- [ ] Test gas estimation endpoint
- [ ] Create top-up request (auto-calculated amount)
- [ ] Create top-up request (custom amount)
- [ ] Test idempotency (duplicate request with same key)
- [ ] Connect Petra wallet
- [ ] Connect Pontem wallet
- [ ] Sign and submit transaction
- [ ] Verify transaction on Aptos Explorer
- [ ] Confirm request marked "completed"
- [ ] Check audit logs populated
- [ ] Test manual override endpoint
- [ ] Verify cron job starts on server boot
- [ ] Test rate limiting (6+ requests in 15 min)

---

## Recommended Gas Wallet Policy

### Threshold Recommendations

**For Devnet (Testing):**
- Min Balance: 0.5 APT
- Top-Up Trigger: 0.1 APT needed
- Safety Buffer: 20%

**For Mainnet (Production):**
- Min Balance: 5 APT (~$50 at $10/APT)
- Top-Up Trigger: 1 APT needed
- Safety Buffer: 30%

### Top-Up Amount Recommendations

**Conservative:**
- Top up to cover 7 days of estimated usage

**Balanced:**
- Top up to cover 3-5 days of estimated usage

**Aggressive (cost-optimize):**
- Top up only exact amount needed for next 24h
- (Requires daily monitoring)

### Multi-Wallet Strategy

For high-availability production:
1. **Primary Gas Wallet** - Daily operations
2. **Emergency Gas Wallet** - Backup (separate admin control)
3. **Treasury Wallet** - Long-term APT holdings

---

## Metrics & Monitoring

### Prometheus Metrics (Implementation Guide)

**Install prom-client:**
```bash
npm install prom-client
```

**Define metrics:**
```typescript
import { Registry, Gauge, Counter } from 'prom-client';

const register = new Registry();

const gasWalletBalance = new Gauge({
  name: 'gas_wallet_balance_apt',
  help: 'Current gas wallet balance in APT',
  registers: [register],
});

const topUpRequestsCreated = new Counter({
  name: 'gas_topup_requests_created_total',
  help: 'Total top-up requests created',
  registers: [register],
});

const topUpRequestsCompleted = new Counter({
  name: 'gas_topup_requests_completed_total',
  help: 'Total top-up requests completed',
  registers: [register],
});

const topUpRequestsFailed = new Counter({
  name: 'gas_topup_requests_failed_total',
  help: 'Total top-up requests failed',
  registers: [register],
});

// Update metrics
gasWalletBalance.set(currentBalance);
topUpRequestsCreated.inc();
```

**Expose metrics endpoint:**
```typescript
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Grafana Dashboard

**Sample queries:**
```promql
# Current balance
gas_wallet_balance_apt

# Top-up rate (requests per hour)
rate(gas_topup_requests_created_total[1h])

# Success rate
sum(rate(gas_topup_requests_completed_total[1h])) / 
sum(rate(gas_topup_requests_created_total[1h]))
```

---

## Summary

The Gas Wallet Management System provides a production-ready solution for maintaining Aptos gas reserves with:
- Automated monitoring and estimation
- Secure admin approval workflow
- On-chain verification
- Complete audit trail
- Real-time status updates

For support or questions, contact the CampusCuts engineering team.

**Version:** 1.0  
**Last Updated:** 2025-11-28  
**Maintainer:** CampusCuts Engineering

