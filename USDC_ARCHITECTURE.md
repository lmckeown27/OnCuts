# CampusCuts USDC Payment Architecture

## Executive Summary

**Decision: Use USDC for all payments, APT only for gas fees**

This document explains why CampusCuts uses USDC (stablecoin) for payments instead of APT (native coin), and how the platform pays all gas fees on behalf of users.

---

## 🤔 The Problem with APT Payments

### APT is Too Volatile

| Scenario | Consumer Pays | APT Price | Barber Receives | Problem |
|----------|---------------|-----------|-----------------|---------|
| **Day 1** | $25 → 2.5 APT | $10/APT | 2.375 APT @ $10 = **$23.75** | ✅ Expected |
| **Day 3** | (same booking) | $8/APT | 2.375 APT @ $8 = **$19.00** | ❌ Lost $4.75! |
| **Day 7** | (same booking) | $15/APT | 2.375 APT @ $15 = **$35.63** | ⚠️  Unexpected gain |

**Result:**
- Barbers can't predict earnings
- Support tickets: "Why did my payout change?"
- Accounting nightmare (FX gains/losses)
- Regulatory issues (variable pricing)

### Real-World Impact

If CampusCuts processes 1000 bookings/month:
- **With APT:** Barbers experience 5-20% variance in payouts
- **With USDC:** Barbers get EXACTLY what they expect, every time

---

## ✅ The USDC Solution

### What is USDC?

**USDC (USD Coin)** is a stablecoin issued by Circle:
- ✅ Always worth $1.00 (±0.1%)
- ✅ Backed 1:1 by US dollars in bank accounts
- ✅ Regulated by NYDFS (New York Department of Financial Services)
- ✅ Available on 15+ blockchains including Aptos
- ✅ $30B+ market cap (industry standard)

### Why USDC is Perfect for Payments

```
CONSUMER EXPERIENCE:
"I paid $25 for a haircut"

BARBER EXPERIENCE:
"I earned $23.75 from that cut"

PLATFORM EXPERIENCE:
"We collected $1.25 platform fee"

RESULT: Everyone understands exactly what happened ✅
```

Compare with APT:
```
CONSUMER EXPERIENCE:
"I paid $25 (2.5 APT) for a haircut"

BARBER EXPERIENCE:
"I earned... 2.375 APT... which is now worth $19? Wait, what?"

PLATFORM EXPERIENCE:
"Our revenue this month is 125 APT... but what's that in USD?"

RESULT: Confusion, disputes, support tickets ❌
```

---

## 🏗️ How It Works

### Payment Flow (Step-by-Step)

#### 1️⃣ **Consumer Pays USD via Stripe**
```
Consumer enters credit card
Stripe charges $25.00
Funds go to CampusCuts bank account
```
**Time:** Instant  
**Fee:** 3% + $0.30 (Stripe fee, absorbed by platform)

#### 2️⃣ **Convert USD → USDC (Circle API)**
```javascript
// Backend calls Circle API
const conversion = await usdcService.convertUsdToUsdc(
  25.00, // USD
  platformWalletAddress // Aptos address
);

// Circle response:
// - Converts $25.00 → 25 USDC (1:1)
// - Sends 25 USDC to platform's Aptos wallet
```
**Time:** 1-5 minutes  
**Fee:** 0.5% (Circle fee, absorbed by platform)  
**Rate:** ALWAYS 1:1 (no slippage)

#### 3️⃣ **Lock USDC in Escrow (Smart Contract)**
```move
// usdc_escrow.move
public entry fun create_escrow(
    platform: &signer,
    booking_id: vector<u8>,
    amount_usdc: u64,  // 25_000000 (25.00 USDC)
    barber_address: address,
    consumer_address: address,
) {
    // Lock 25 USDC in escrow vault
    // Calculate: 95% barber, 5% platform
    // Status: "escrowed" (immutable)
}
```
**Time:** ~2 seconds (Aptos finality)  
**Gas Fee:** ~$0.0001 (paid by platform in APT)  
**On-chain:** Transparent, auditable, immutable

#### 4️⃣ **Service Happens (Off-Chain)**
```
Barber cuts hair → Consumer confirms → Booking complete
```

#### 5️⃣ **Release USDC from Escrow (Smart Contract)**
```move
public entry fun release_payment(
    platform: &signer,
    booking_id: vector<u8>,
) {
    // Atomic splits:
    // 23.75 USDC → Barber wallet (95%)
    // 1.25 USDC → Platform wallet (5%)
}
```
**Time:** ~2 seconds  
**Gas Fee:** ~$0.0001 (paid by platform in APT)  
**Result:** Instant, on-chain settlement

#### 6️⃣ **Convert USDC → USD (Circle API)**
```javascript
// Barber requests payout
const payout = await usdcService.convertUsdcToUsd(
  23.75, // USDC
  barberBankAccountId // Circle bank account ID
);

// Circle response:
// - Converts 23.75 USDC → $23.75 USD (1:1)
// - Deposits to barber's bank account via ACH
```
**Time:** 1-2 business days (bank ACH)  
**Fee:** 0.5% (Circle fee, absorbed by platform)  
**Rate:** ALWAYS 1:1 (no slippage)

#### 7️⃣ **Barber Receives USD**
```
Barber checks bank account:
"Deposit from CampusCuts: $23.75"
```

---

## ⛽ Gas Fee Architecture

### Why Platform Pays Gas (Not Users)

**User Experience:**
```
❌ BAD (user pays gas):
"Your haircut is $25... plus 0.0001 APT gas fee"
"Wait, how much is 0.0001 APT in USD?"
"Why do I need APT if I'm paying in USDC?"

✅ GOOD (platform pays gas):
"Your haircut is $25"
"That's it. Done."
```

### Gas Wallet Setup

CampusCuts maintains a **separate APT wallet** just for gas:

```
┌─────────────────────────────────────────────────────┐
│ PLATFORM WALLETS                                    │
├─────────────────────────────────────────────────────┤
│ 1. USDC Custodial Wallet (holds user USDC)         │
│    - Address: 0xabc...                              │
│    - Balance: 50,000 USDC                           │
│    - Purpose: Payment escrow                        │
│                                                     │
│ 2. Gas Wallet (holds APT for fees)                 │
│    - Address: 0xdef...                              │
│    - Balance: 100 APT (~$1000)                      │
│    - Purpose: Pay ALL transaction gas fees          │
└─────────────────────────────────────────────────────┘
```

### Gas Economics

**Gas costs on Aptos are EXTREMELY cheap:**

| Transaction Type | Gas (APT) | Gas (USD) |
|------------------|-----------|-----------|
| Create escrow | 0.00012 APT | ~$0.0012 |
| Release payment | 0.00015 APT | ~$0.0015 |
| Refund | 0.00010 APT | ~$0.0010 |

**At scale:**
- 1,000 bookings = ~$1.30 in gas fees
- 10,000 bookings = ~$13.00 in gas fees
- 100,000 bookings = ~$130.00 in gas fees

**Platform absorbs this cost** → Users pay $0 for blockchain benefits!

### Gas Wallet Monitoring

Admin dashboard shows real-time gas wallet status:

```
GAS WALLET STATUS

Address: 0xdef...789
Balance: 47.23 APT
Value: ~$472.30 USD
Transactions Remaining: ~472,300
Status: ✅ OK

─────────────────────────────────

ALERT LEVELS:
✅ OK: > 10 APT
⚠️  LOW: < 10 APT (refill soon)
🚨 CRITICAL: < 2 APT (immediate refill!)
```

**Auto-alerts** sent to admin when balance drops below thresholds.

---

## 💰 Economics Breakdown

### Example: $25 Haircut

```
┌─────────────────────────────────────────────────────┐
│ CONSUMER SIDE                                       │
├─────────────────────────────────────────────────────┤
│ Pays via Stripe:           $25.00                   │
│ Stripe fee (3%):          -$0.75                    │
│ → CampusCuts receives:     $24.25                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ USD → USDC CONVERSION (Circle)                      │
├─────────────────────────────────────────────────────┤
│ Amount:                    $24.25                   │
│ Circle fee (0.5%):        -$0.12                    │
│ → USDC on-chain:           24.13 USDC               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ESCROW ON BLOCKCHAIN                                │
├─────────────────────────────────────────────────────┤
│ Locked in escrow:          24.13 USDC               │
│ Gas fee (create):          $0.0012 (paid by platform)|
│ Status:                    Escrowed                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ESCROW RELEASE                                      │
├─────────────────────────────────────────────────────┤
│ Total:                     24.13 USDC               │
│ Barber (95%):              22.92 USDC               │
│ Platform (5%):             1.21 USDC                │
│ Gas fee (release):         $0.0015 (paid by platform)|
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ USDC → USD CONVERSION (Circle)                      │
├─────────────────────────────────────────────────────┤
│ Barber USDC:               22.92 USDC               │
│ Circle fee (0.5%):        -$0.11                    │
│ → Bank deposit:            $22.81                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ SUMMARY                                             │
├─────────────────────────────────────────────────────┤
│ Consumer paid:             $25.00                   │
│ Barber received:           $22.81 (91.2%)           │
│ Platform revenue:          $1.21 (4.8%)             │
│ Stripe fee:                $0.75 (3%)               │
│ Circle fees:               $0.23 (0.9%)             │
│ Gas fees:                  $0.0027 (0.01%)          │
│                                                     │
│ Barber vs traditional:     +80% earnings            │
│ (traditional: ~$12-15 for $25 service)              │
└─────────────────────────────────────────────────────┘
```

### Cost Comparison: USDC vs APT

| Cost Factor | USDC Approach | APT Approach |
|-------------|---------------|--------------|
| **Stripe fee** | $0.75 (3%) | $0.75 (3%) |
| **Blockchain gas** | $0.0027 (platform pays) | $0.0027 (platform pays) |
| **FX conversion** | $0.23 (0.9%) | $0.50-$1.25 (2-5%) |
| **FX volatility loss** | $0.00 (stable) | $0.25-$1.25 (1-5%) |
| **Support costs** | Low (predictable) | High (disputes) |
| **Total cost** | ~$1.00 (4%) | ~$2.50-$3.50 (10-14%) |

**USDC saves 6-10% per transaction vs APT**

---

## 🔐 Security

### Smart Contract Security
- ✅ **Move language** prevents reentrancy attacks
- ✅ **No integer overflow** (Move type system)
- ✅ **Atomic transactions** (all-or-nothing)
- ✅ **Immutable escrow** (can't be changed after creation)
- ✅ **Admin-only release** (only platform can trigger)

### Key Management
```
Gas Wallet:
- Private key in .env (NEVER commit to git)
- Separate from USDC custodial wallet
- Only backend has access
- Cannot be drained by users
- Production: AWS Secrets Manager

USDC Custodial Wallet:
- Encrypted private keys
- Multi-sig for large amounts (future)
- Regular security audits
- Insurance coverage (future)
```

### Circle Security
- ✅ **NYDFS regulated** (licensed money transmitter)
- ✅ **Bank-grade security** (SOC 2 certified)
- ✅ **1:1 reserves** (audited monthly by Grant Thornton)
- ✅ **FDIC insured** (up to $250k per account)

---

## 📊 API Reference

### USDC Service

```typescript
// Convert USD to USDC
const conversion = await usdcService.convertUsdToUsdc(
  25.00,                   // Amount in USD
  aptosWalletAddress,      // Destination Aptos address
  {
    bookingId: "uuid",
    userId: "uuid",
    description: "Booking payment"
  }
);

// Convert USDC to USD
const payout = await usdcService.convertUsdcToUsd(
  23.75,                   // Amount in USDC
  circleBankAccountId,     // Bank account ID
  aptosWalletAddress,      // Source Aptos address
  {
    barberId: "uuid",
    description: "Barber payout"
  }
);

// Check transfer status
const status = await usdcService.getTransferStatus(transferId);
```

### Gas Wallet Service

```typescript
// Get gas wallet status
const status = await gasWalletService.getGasWalletStatus();
/*
{
  address: "0x...",
  balance_apt: 47.23,
  balance_usd_estimate: 472.30,
  estimated_transactions_remaining: 472300,
  needs_refill: false
}
*/

// Check if refill needed
const check = await gasWalletService.checkBalanceStatus();
/*
{
  status: "ok" | "low" | "critical",
  balance_apt: 47.23,
  message: "✅ OK: Gas wallet has 47.23 APT."
}
*/

// Get refill instructions
const instructions = gasWalletService.getRefillInstructions();
/*
{
  method: "exchange_transfer",
  instructions: [
    "1. Log into your Coinbase account",
    "2. Navigate to Aptos (APT) wallet",
    ...
  ],
  address: "0x...",
  recommended_amount_apt: 100
}
*/
```

### Payment Service (Updated)

```typescript
// Process booking payment (USDC flow)
const result = await paymentService.processBookingPayment({
  bookingId: "uuid",
  customerId: "uuid",
  barberId: "uuid",
  barberAptosAddress: "0x...",
  consumerAptosAddress: "0x...",
  totalAmountCents: 2500,
  stripePaymentIntentId: "pi_..."
});
/*
{
  escrowTxHash: "0x...",
  usdcAmount: 25.0
}
*/

// Release booking funds (USDC flow)
const release = await paymentService.releaseBookingFunds({
  bookingId: "uuid",
  barberId: "uuid",
  barberAptosAddress: "0x...",
  amountCents: 2500
});
/*
{
  releaseTxHash: "0x..."
}
*/

// Request barber payout (USDC → USD)
const payout = await paymentService.requestBarberPayout({
  barberId: "uuid",
  barberAptosAddress: "0x...",
  circleBankAccountId: "circle_bank_...",
  amountUsdc: 23.75
});
/*
{
  payoutTransferId: "transfer_...",
  amountUsd: 23.75
}
*/
```

---

## 🚀 Deployment

### Environment Variables

```bash
# .env

# Circle API (USD ↔ USDC)
CIRCLE_API_KEY=your-circle-api-key
CIRCLE_API_URL=https://api-sandbox.circle.com  # or api.circle.com for prod
CIRCLE_WALLET_ID=your-circle-wallet-id

# Gas Wallet (APT for fees)
GAS_WALLET_PRIVATE_KEY=0x...your-gas-wallet-private-key
# If not set, uses APTOS_PLATFORM_PRIVATE_KEY

# Aptos
APTOS_PLATFORM_PRIVATE_KEY=0x...
APTOS_PLATFORM_ADDRESS=0x...
APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
APTOS_NETWORK=mainnet

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Smart Contract Deployment

```bash
# 1. Deploy USDC escrow contract
cd contracts
aptos move publish \
  --named-addresses campus_cuts=YOUR_ADDRESS \
  --profile mainnet

# 2. Initialize escrow registry
aptos move run \
  --function-id YOUR_ADDRESS::usdc_escrow::initialize \
  --profile mainnet

# 3. Verify deployment
aptos account list --account YOUR_ADDRESS
```

### Gas Wallet Setup

```bash
# 1. Generate gas wallet (or use existing)
aptos init --profile gas-wallet

# 2. Fund with APT
# Send 100 APT (~$1000) to gas wallet address
# Use Coinbase, Binance, or DEX

# 3. Verify balance
curl http://localhost:3001/api/admin/gas-wallet/status
```

---

## 📈 Monitoring

### Gas Wallet Alerts

Set up automated alerts when gas wallet balance drops:

```typescript
// backend/src/services/gas-wallet-monitor.service.ts

import gasWalletService from './gas-wallet.service';
import { sendAdminAlert } from './email.service';

// Run every hour
setInterval(async () => {
  const check = await gasWalletService.checkBalanceStatus();
  
  if (check.status === 'critical') {
    await sendAdminAlert({
      subject: '🚨 CRITICAL: Gas wallet balance extremely low',
      message: check.message,
      priority: 'high'
    });
  } else if (check.status === 'low') {
    await sendAdminAlert({
      subject: '⚠️  WARNING: Gas wallet balance low',
      message: check.message,
      priority: 'medium'
    });
  }
}, 3600000); // 1 hour
```

### Metrics to Track

```
USDC Metrics:
- Total USDC locked in escrow
- Total USDC released (lifetime)
- Total platform fees collected (USDC)
- Average escrow duration
- USDC → USD conversion success rate

Gas Metrics:
- APT balance in gas wallet
- Average gas per transaction
- Total gas spent (APT + USD)
- Gas alerts triggered
- Time since last refill

Payment Metrics:
- Booking payment success rate
- Average time: USD → USDC
- Average time: escrow creation
- Average time: USDC → USD payout
- Failed conversions (retry count)
```

---

## ✅ Summary

### Key Decisions

1. ✅ **Use USDC for all payments** (not APT)
   - Reason: Price stability, user trust, clean accounting

2. ✅ **Platform pays ALL gas fees in APT**
   - Reason: Better UX, costs ~$0.0001/tx (negligible)

3. ✅ **Separate gas wallet from USDC wallet**
   - Reason: Security, clean separation of concerns

4. ✅ **Use Circle for USD ↔ USDC**
   - Reason: Industry standard, 1:1 guarantee, regulated

### Benefits

✅ **For Barbers:**
- Predictable payouts (always $23.75 from $25 booking)
- No volatility risk
- Same-day on-chain settlement
- Clear earnings tracking

✅ **For Consumers:**
- Simple pricing (pay $25, that's it)
- Escrow protection
- No blockchain knowledge required
- Instant payment confirmation

✅ **For Platform:**
- Clean accounting
- Lower support costs
- Regulatory compliance
- Scalable architecture

### Trade-offs

❌ **USDC requires:**
- Circle API integration
- USD ↔ USDC conversion fees (0.5% each way)
- Bank account linking for payouts

✅ **But these are WORTH IT for:**
- Price stability
- User trust
- Professional operation
- Regulatory compliance

---

## 📚 Resources

- **Circle Documentation:** https://developers.circle.com/
- **Aptos Documentation:** https://aptos.dev/
- **USDC on Aptos:** https://www.circle.com/en/usdc/aptos
- **Move Language:** https://move-language.github.io/move/

---

**Built by CampusCuts Engineering Team**  
Last Updated: December 2025



