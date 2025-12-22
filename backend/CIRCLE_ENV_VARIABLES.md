# Circle Environment Variables Guide

Complete reference for Circle USDC configuration in CampusCuts backend.

---

## Required Environment Variables

Add these to `backend/.env`:

```bash
# ==========================================
# Circle USDC Configuration
# ==========================================

# Circle API Keys (Required)
CIRCLE_TEST_API_KEY=TEST_API_KEY:your_test_api_key_here
# CIRCLE_API_KEY=your_production_api_key_here

# Circle API URL (Required)
CIRCLE_API_URL=https://api-sandbox.circle.com

# Circle Wallet Set ID (Required after first-time setup)
CIRCLE_WALLET_SET_ID=your_wallet_set_id_here

# Blockchain for USDC Wallets (Optional)
CIRCLE_BLOCKCHAIN=MATIC-AMOY

# Token ID for transfers (Optional)
CIRCLE_TOKEN_ID=usdc-testnet
```

---

## Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CIRCLE_TEST_API_KEY` | ✅ For sandbox | Sandbox API key | `TEST_API_KEY:abc123...` |
| `CIRCLE_API_KEY` | ✅ For production | Production API key | `live_abc123...` |
| `CIRCLE_API_URL` | ✅ Yes | API endpoint | `https://api-sandbox.circle.com` |
| `CIRCLE_WALLET_SET_ID` | ✅ Yes | Wallet set ID | `abc123-def456-...` |
| `CIRCLE_BLOCKCHAIN` | ⚪ Optional | Target blockchain | `MATIC-AMOY` |
| `CIRCLE_TOKEN_ID` | ⚪ Optional | USDC token ID | `usdc-testnet` |

---

## How to Get API Keys

### Sandbox (Testing)

1. **Sign up:** https://app-sandbox.circle.com/signup
2. **Go to:** API Keys section
3. **Click:** "Create New Key"
4. **Copy** the key (starts with `TEST_API_KEY:`)
5. **Paste** into `.env` as `CIRCLE_TEST_API_KEY`

### Production

1. **Sign up:** https://app.circle.com/signup
2. **Complete KYB** (Know Your Business) verification
3. **Link bank account** for settlements
4. **Go to:** API Keys section
5. **Create production key**
6. **Paste** into `.env` as `CIRCLE_API_KEY`

---

## How to Get Wallet Set ID

### One-Time Setup

Create a wallet set (container for all user wallets):

```bash
# Method 1: Using the service directly
cd backend
node -e "
const usdcService = require('./dist/services/usdc.service').default;
usdcService.createWalletSet('CampusCuts Main').then(id => {
  console.log('Wallet Set ID:', id);
  console.log('Add this to .env:');
  console.log('CIRCLE_WALLET_SET_ID=' + id);
});
"

# Method 2: Via Circle Dashboard
# 1. Log in to Circle dashboard
# 2. Go to Wallets → Wallet Sets
# 3. Click "Create Wallet Set"
# 4. Name: "CampusCuts Main"
# 5. Copy the wallet set ID
```

Save the ID to `.env`:
```bash
CIRCLE_WALLET_SET_ID=abc123-def456-ghi789
```

---

## Blockchain Options

### Testnet (Development)

| Network | Value | USDC Support | Gas Costs |
|---------|-------|--------------|-----------|
| **Polygon Amoy** | `MATIC-AMOY` | ✅ Yes | Very Low |
| **Ethereum Sepolia** | `ETH-SEPOLIA` | ✅ Yes | Medium |

**Recommended:** `MATIC-AMOY` (Polygon testnet) - Lowest gas fees

### Mainnet (Production)

| Network | Value | USDC Support | Gas Costs |
|---------|-------|--------------|-----------|
| **Polygon** | `MATIC` | ✅ Yes | $0.01-0.10 |
| **Ethereum** | `ETH` | ✅ Yes | $5-50 |
| **Avalanche** | `AVAX` | ✅ Yes | $0.10-1.00 |
| **Arbitrum** | `ARB` | ✅ Yes | $0.10-1.00 |

**Recommended:** `MATIC` (Polygon mainnet) - Best balance of cost and speed

---

## Complete Example Configurations

### Development (Sandbox)

```bash
# backend/.env

# Circle USDC (Sandbox)
CIRCLE_TEST_API_KEY=TEST_API_KEY:abc123def456ghi789jkl012mno345pqr678
CIRCLE_API_URL=https://api-sandbox.circle.com
CIRCLE_WALLET_SET_ID=b8627ae8-732b-4d25-b947-1df8f4007a29
CIRCLE_BLOCKCHAIN=MATIC-AMOY
CIRCLE_TOKEN_ID=usdc-testnet
```

### Production

```bash
# backend/.env

# Circle USDC (Production)
CIRCLE_API_KEY=live_abc123def456ghi789jkl012mno345pqr678
CIRCLE_API_URL=https://api.circle.com
CIRCLE_WALLET_SET_ID=a7526be7-621a-3c24-a836-0ce7f3006b28
CIRCLE_BLOCKCHAIN=MATIC
CIRCLE_TOKEN_ID=usdc-mainnet
```

---

## Testing Your Configuration

### Test 1: Check Configuration

```bash
cd backend
npm run dev

# Look for in logs:
# ✅ Circle API configured (TEST mode)
# or
# ✅ Circle API configured (PRODUCTION mode)
```

### Test 2: Create Test Wallet

```bash
# Via Node REPL
node
> const usdcService = require('./dist/services/usdc.service').default
> usdcService.ensureUserWallet('test-user-123').then(console.log)

# Expected output:
# {
#   walletId: '...',
#   address: '0x...',
#   blockchain: 'MATIC-AMOY'
# }
```

### Test 3: Check Database

```bash
psql $DATABASE_URL

SELECT circle_wallet_id, circle_wallet_address 
FROM users 
WHERE id = 'test-user-123';

# Should show wallet ID and address
```

---

## Environment Detection Logic

The system automatically detects which environment to use:

```typescript
// Priority order:
1. CIRCLE_TEST_API_KEY  → Sandbox mode
2. CIRCLE_API_KEY       → Production mode
3. Neither set          → Error (Circle disabled)
```

### Validation

On startup, the service validates:

```
✅ API key format is correct
✅ API URL matches key type (test key → sandbox URL)
⚠️  Warns if production key with sandbox URL
⚠️  Warns if test key with production URL
```

---

## Migration Checklist: Sandbox → Production

When ready to go live:

- [ ] Complete Circle KYB verification
- [ ] Get production API keys
- [ ] Create production wallet set
- [ ] Update environment variables:
  ```bash
  CIRCLE_API_KEY=live_...  # Add production key
  CIRCLE_API_URL=https://api.circle.com
  CIRCLE_WALLET_SET_ID=new_prod_wallet_set_id
  CIRCLE_BLOCKCHAIN=MATIC
  CIRCLE_TOKEN_ID=usdc-mainnet
  # Comment out or remove CIRCLE_TEST_API_KEY
  ```
- [ ] Update Circle webhook URL in dashboard
- [ ] Test with small amounts first ($1-10 USDC)
- [ ] Monitor first 100 transactions closely
- [ ] Set up balance alerts
- [ ] Configure automatic monitoring

---

## Troubleshooting

### Error: "Circle API key is required"

**Cause:** No API key configured

**Fix:**
```bash
# Add to .env
CIRCLE_TEST_API_KEY=TEST_API_KEY:your_key_here
```

### Error: "Wallet set not found"

**Cause:** `CIRCLE_WALLET_SET_ID` not set or invalid

**Fix:**
```bash
# Create wallet set (see "How to Get Wallet Set ID" above)
# Then add to .env:
CIRCLE_WALLET_SET_ID=your_wallet_set_id
```

### Error: "Invalid API credentials"

**Cause:** Wrong API key or typo

**Fix:**
1. Verify key copied correctly (no spaces)
2. Check key is for correct environment
3. Regenerate key if needed

### Warning: "Production API key with sandbox URL"

**Cause:** Configuration mismatch

**Fix:**
```bash
# If testing, use test key:
CIRCLE_TEST_API_KEY=TEST_API_KEY:...
CIRCLE_API_URL=https://api-sandbox.circle.com

# If production, use production key:
CIRCLE_API_KEY=live_...
CIRCLE_API_URL=https://api.circle.com
```

### Error: "Insufficient funds" (Production)

**Cause:** Circle wallet not funded

**Fix:**
1. Log in to Circle dashboard
2. Go to Wallets
3. Select your wallet
4. Click "Add Funds"
5. Transfer from linked bank account
6. Wait for ACH settlement (1-2 business days)

---

## Security Best Practices

### 1. API Key Management

- ✅ Store in `.env` only, never in code
- ✅ Add `.env` to `.gitignore`
- ✅ Use different keys per environment
- ✅ Rotate keys every 90 days
- ✅ Immediately revoke if exposed

### 2. Access Control

```bash
# Set proper file permissions
chmod 600 backend/.env

# Restrict who can access production keys
# Only DevOps/senior engineers
```

### 3. Monitoring

- Set up alerts for:
  - Failed transactions
  - Low wallet balance
  - Unusual transfer patterns
  - API errors
  - Webhook failures

---

## Resources

- **Circle Developers:** https://developers.circle.com/
- **API Reference:** https://developers.circle.com/w3s/reference
- **Sandbox Dashboard:** https://app-sandbox.circle.com/
- **Production Dashboard:** https://app.circle.com/
- **Support:** support@circle.com

---

**Your Circle environment is ready!**

Add the variables to `.env`, run the migration, and restart your backend to enable USDC transfers! 🎉

