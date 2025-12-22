# Circle USDC Configuration Guide

Complete guide for setting up Circle API for USD ↔ USDC conversions in CampusCuts.

---

## Overview

**Circle** provides the infrastructure to convert fiat USD to USDC stablecoin and back.

### How CampusCuts Uses Circle

```
┌─────────────────────────────────────────────────────────┐
│  Payment Flow with Circle USDC                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Student pays $25 via Stripe                         │
│     ↓                                                   │
│  2. Stripe deposits $25 to CampusCuts bank             │
│     ↓                                                   │
│  3. Circle converts $25 → 25 USDC (1:1)                │
│     ↓                                                   │
│  4. Circle sends 25 USDC to Aptos wallet               │
│     ↓                                                   │
│  5. Smart contract creates escrow with 25 USDC         │
│     ↓                                                   │
│  6. After service, escrow releases 23.75 USDC to barber│
│     ↓                                                   │
│  7. Circle converts 23.75 USDC → $23.75 USD            │
│     ↓                                                   │
│  8. Circle deposits $23.75 to barber's bank account    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why Circle?

- ✅ **1:1 conversion** - No slippage (25 USD = 25 USDC always)
- ✅ **Instant settlement** - On-chain in 1-5 minutes
- ✅ **Regulatory compliant** - Licensed money transmitter
- ✅ **Industry standard** - Used by Coinbase, Stripe, etc.
- ✅ **Free tier** - Up to $100k/month transaction volume

---

## Step 1: Create Circle Account

### For Testing (Sandbox)

1. **Sign up:** https://app-sandbox.circle.com/signup
2. **Verify email** and complete profile
3. **Navigate to:** API Keys section

### For Production

1. **Sign up:** https://app.circle.com/signup
2. **Complete KYB** (Know Your Business) verification
3. **Link bank account** for settlements
4. **Navigate to:** API Keys section

---

## Step 2: Get API Keys

### Sandbox (Testing)

```bash
# 1. Go to: https://app-sandbox.circle.com/api-keys
# 2. Click "Create New Key"
# 3. Name: "CampusCuts Development"
# 4. Environment: Sandbox
# 5. Copy the key (starts with TEST_API_KEY:)
```

**Example Key:**
```
TEST_API_KEY:abc123def456ghi789jkl012mno345pqr678stu901vwx234
```

### Production

```bash
# 1. Go to: https://app.circle.com/api-keys
# 2. Click "Create New Key"
# 3. Name: "CampusCuts Production"
# 4. Environment: Production
# 5. Copy the key
# 6. Store securely (cannot be retrieved again!)
```

---

## Step 3: Create Circle Wallet

### What is a Circle Wallet?

A **Circle Wallet** is your platform's master wallet that holds USD funds. Circle converts these funds to USDC when you request transfers.

### Create Wallet (Sandbox)

1. **Go to:** https://app-sandbox.circle.com/wallets
2. **Click:** "Create Wallet"
3. **Name:** "CampusCuts Master Wallet"
4. **Copy** the Wallet ID (e.g., `1000123456`)

### Create Wallet (Production)

1. **Go to:** https://app.circle.com/wallets
2. **Link your bank account** (for funding the wallet)
3. **Create Wallet**
4. **Fund wallet** with USD (this becomes your USDC liquidity)

---

## Step 4: Configure Backend

### Add to `backend/.env`

```bash
# ==========================================
# Circle USDC Configuration
# ==========================================

# For Testing/Development (Sandbox)
CIRCLE_TEST_API_KEY=TEST_API_KEY:your_test_key_here
CIRCLE_API_URL=https://api-sandbox.circle.com
CIRCLE_WALLET_ID=your_test_wallet_id

# For Production (uncomment when ready)
# CIRCLE_API_KEY=your_production_api_key_here
# CIRCLE_API_URL=https://api.circle.com
# CIRCLE_WALLET_ID=your_production_wallet_id
```

### Example Configuration

```bash
# Testing Configuration
CIRCLE_TEST_API_KEY=TEST_API_KEY:abc123def456ghi789jkl012mno345
CIRCLE_API_URL=https://api-sandbox.circle.com
CIRCLE_WALLET_ID=1000123456
```

---

## Step 5: Test Circle Integration

### Test Script

Create `backend/scripts/test-circle.ts`:

```typescript
import dotenv from 'dotenv';
dotenv.config();

import usdcService from '../src/services/usdc.service';

async function testCircle() {
  console.log('🔍 Testing Circle USDC Integration...\n');

  try {
    // Test 1: Convert $10 USD to USDC
    console.log('Test 1: USD → USDC conversion');
    const result = await usdcService.convertUsdToUsdc(
      10.00,
      process.env.APTOS_PLATFORM_ADDRESS || '',
      {
        description: 'Test conversion',
      }
    );

    console.log('✅ Conversion successful!');
    console.log('Transfer ID:', result.transferId);
    console.log('Amount USDC:', result.amountUsdc);
    console.log('Status:', result.status);

    // Test 2: Check transfer status
    console.log('\nTest 2: Check transfer status');
    const status = await usdcService.getTransferStatus(result.transferId);
    console.log('✅ Status retrieved!');
    console.log('Status:', status.status);
    console.log('Amount:', status.amount, status.currency);

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

testCircle();
```

### Run Test

```bash
cd backend
npx ts-node scripts/test-circle.ts
```

**Expected Output:**
```
🔍 Testing Circle USDC Integration...

Test 1: USD → USDC conversion
✅ Conversion successful!
Transfer ID: abc123-def456-ghi789
Amount USDC: 10
Status: pending

Test 2: Check transfer status
✅ Status retrieved!
Status: complete
Amount: 10 USD
```

---

## Step 6: Fund Your Circle Wallet

### Sandbox (Testing)

Sandbox wallets come pre-funded with test money. No action needed!

### Production

1. **Go to:** https://app.circle.com/wallets
2. **Select** your wallet
3. **Click:** "Add Funds"
4. **Transfer USD** from your linked bank account
5. **Wait** for ACH settlement (1-2 business days)

**Recommended Starting Balance:**
- **Small volume (<100 bookings/month):** $10,000
- **Medium volume (100-500 bookings/month):** $50,000
- **High volume (>500 bookings/month):** $100,000+

---

## How the Service Works

### Code Overview

The `usdc.service.ts` provides these functions:

#### 1. Convert USD to USDC

```typescript
// After Stripe payment succeeds
const result = await usdcService.convertUsdToUsdc(
  25.00,  // Amount in USD
  aptosWalletAddress,  // Destination Aptos wallet
  {
    bookingId: '123',
    userId: '456',
    description: 'Haircut booking payment'
  }
);

// Returns:
// {
//   transferId: 'abc-123',
//   amountUsdc: 25.00,
//   amountUsd: 25.00,
//   status: 'pending',
//   destinationAddress: '0x...'
// }
```

#### 2. Convert USDC to USD

```typescript
// When barber requests payout
const result = await usdcService.convertUsdcToUsd(
  23.75,  // Amount in USDC
  barberBankAccountId,  // Circle bank account ID
  barberAptosWalletAddress,  // Source Aptos wallet
  {
    barberId: '789',
    bookingId: '123',
    description: 'Barber payout'
  }
);

// Circle converts USDC → USD and deposits to barber's bank
```

#### 3. Check Transfer Status

```typescript
const status = await usdcService.getTransferStatus(transferId);

console.log(status);
// {
//   status: 'complete',
//   amount: 25.00,
//   currency: 'USD'
// }
```

#### 4. Link Barber Bank Account

```typescript
const { circleBankAccountId } = await usdcService.linkBankAccount(
  barberUserId,
  {
    accountNumber: '123456789',
    routingNumber: '021000021',
    accountType: 'checking',
    billingDetails: {
      name: 'John Barber',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US'
    }
  }
);

// Store circleBankAccountId in user's profile for future payouts
```

---

## Configuration Priority

The service checks for API keys in this order:

1. **`CIRCLE_TEST_API_KEY`** (sandbox/testing)
2. **`CIRCLE_API_KEY`** (production)

This allows you to:
- ✅ Use test keys in development
- ✅ Switch to production keys without code changes
- ✅ Keep both configured (test takes priority)

---

## Environment Variables Summary

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CIRCLE_TEST_API_KEY` | For testing | Sandbox API key | `TEST_API_KEY:abc123...` |
| `CIRCLE_API_KEY` | For production | Production API key | `your_prod_key` |
| `CIRCLE_API_URL` | Yes | API endpoint | `https://api-sandbox.circle.com` |
| `CIRCLE_WALLET_ID` | Yes | Master wallet ID | `1000123456` |
| `APTOS_PLATFORM_ADDRESS` | Yes | Aptos wallet address | `0x123abc...` |

---

## Troubleshooting

### Error: "CIRCLE_TEST_API_KEY or CIRCLE_API_KEY not configured"

**Solution:**
```bash
# Add to backend/.env
CIRCLE_TEST_API_KEY=TEST_API_KEY:your_key_here
```

### Error: "Invalid API key"

**Solution:**
1. Verify key copied correctly (no spaces)
2. Check key is for correct environment (sandbox vs production)
3. Regenerate key if needed

### Error: "Insufficient wallet balance"

**Solution (Sandbox):**
- Sandbox wallets are pre-funded - contact Circle support

**Solution (Production):**
1. Go to Circle dashboard
2. Add funds to your wallet from linked bank account
3. Wait for ACH settlement (1-2 business days)

### Error: "Transfer failed"

**Possible causes:**
- Invalid Aptos address
- Wallet balance too low
- Network issues

**Check status:**
```typescript
const status = await usdcService.getTransferStatus(transferId);
console.log(status);
```

---

## Cost Analysis

### Circle Fees

**Sandbox:** FREE (unlimited test transactions)

**Production:**
- **Volume < $100k/month:** FREE
- **Volume $100k-$1M/month:** 0.5% per transaction
- **Volume > $1M/month:** Custom pricing

### Example Costs

| Monthly Volume | Transactions | Circle Fees |
|----------------|--------------|-------------|
| $10,000 | 400 bookings @ $25 | $0 (free tier) |
| $50,000 | 2,000 bookings @ $25 | $0 (free tier) |
| $100,000 | 4,000 bookings @ $25 | $0 (free tier) |
| $150,000 | 6,000 bookings @ $25 | $250 (0.5% of $50k overage) |

---

## Security Best Practices

1. **Store API keys in `.env` only** - Never commit to git
2. **Use different keys** for development and production
3. **Rotate keys** every 90 days
4. **Monitor wallet balance** - Set up low balance alerts
5. **Separate wallets** - Use different wallets for different purposes
6. **Enable 2FA** on Circle account
7. **Audit transactions** regularly for anomalies

---

## Next Steps

After configuring Circle:

1. ✅ **Test in sandbox** with test API keys
2. ✅ **Integrate with Stripe** payment flow
3. ✅ **Test end-to-end** booking → payment → escrow → payout
4. ✅ **Apply for production** Circle account
5. ✅ **Complete KYB** verification
6. ✅ **Link production bank** account
7. ✅ **Fund production wallet**
8. ✅ **Switch to production** API keys
9. ✅ **Monitor transactions** in Circle dashboard

---

## Resources

- **Circle Developers:** https://developers.circle.com/
- **API Reference:** https://developers.circle.com/reference
- **Sandbox Dashboard:** https://app-sandbox.circle.com/
- **Production Dashboard:** https://app.circle.com/
- **Support:** support@circle.com

---

**Your Circle USDC integration is ready!** 🎉

Add your `CIRCLE_TEST_API_KEY` to `.env` and start testing USD ↔ USDC conversions!

