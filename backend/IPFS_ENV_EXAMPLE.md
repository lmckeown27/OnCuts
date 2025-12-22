# IPFS Environment Configuration

Add these variables to your `backend/.env` file:

## Required Configuration

```bash
# ==========================================
# IPFS Configuration
# ==========================================

# Enable/Disable IPFS uploads
USE_IPFS=true

# Pinata Pinning Service (REQUIRED for permanent storage)
# Get keys from: https://app.pinata.cloud/keys
PINATA_API_KEY=your_pinata_api_key_here
PINATA_API_SECRET=your_pinata_api_secret_here
```

## Optional: Local IPFS Node

Choose ONE of these options:

### Option 1: Local IPFS Node (Recommended for Development)

```bash
# Run IPFS Desktop or `ipfs daemon` locally
IPFS_NODE_URL=http://localhost:5001
```

**Setup:**
1. Install IPFS Desktop: https://docs.ipfs.tech/install/ipfs-desktop/
2. Start IPFS Desktop (node runs on http://localhost:5001)
3. Add above to `.env`

### Option 2: Pinata IPFS Gateway

```bash
# Use Pinata's dedicated IPFS gateway (paid plans)
IPFS_NODE_URL=https://api.pinata.cloud:443
```

### Option 3: Infura IPFS Gateway

```bash
# Use Infura's IPFS gateway (free tier available)
IPFS_NODE_URL=https://ipfs.infura.io:5001
```

### Option 4: Skip Local Node (Use Pinata Only)

```bash
# Leave IPFS_NODE_URL unset or empty
# Uploads go directly to Pinata (slower but simpler)
```

## How It Works

```
User uploads file
      ↓
[Optional] Upload to local IPFS node → Fast CID generation
      ↓
Pin to Pinata → Permanent storage
      ↓
Return both CIDs + gateway URLs
```

**Benefits:**
- ✅ Local node: Fast uploads, redundancy
- ✅ Pinata: Permanent storage, distributed
- ✅ Fallback: If local fails, Pinata still works

## Complete Example

```bash
# backend/.env

# Enable IPFS
USE_IPFS=true

# Local IPFS node (optional)
IPFS_NODE_URL=http://localhost:5001

# Pinata (required)
PINATA_API_KEY=abc123def456...
PINATA_API_SECRET=xyz789uvw012...
```

## Test Configuration

```bash
# Run test script
npx ts-node backend/scripts/test-ipfs.ts

# Expected output:
# ✅ IPFS is enabled
# ✅ Local IPFS Node: Connected (or skipped)
# ✅ Pinata API: Connected
# 🎉 All systems operational!
```

## Troubleshooting

### "Local IPFS node connection failed"

**This is OK!** Pinata will still work.

**To fix (optional):**
1. Install IPFS Desktop: https://docs.ipfs.tech/install/ipfs-desktop/
2. Start IPFS Desktop
3. Or use Infura gateway: `IPFS_NODE_URL=https://ipfs.infura.io:5001`

### "Pinata credentials not configured"

**Solution:**
1. Sign up: https://app.pinata.cloud/register
2. Go to API Keys → New Key
3. Enable: `pinFileToIPFS`, `pinJSONToIPFS`
4. Copy API Key and Secret to `.env`

### "IPFS is disabled"

**Solution:**
```bash
# Add to .env
USE_IPFS=true

# Restart backend
pm2 restart all
```

## Advanced: URL Parsing

The service automatically parses `IPFS_NODE_URL` to extract:
- **Host:** `localhost` or `ipfs.infura.io`
- **Port:** `5001`, `443`, etc.
- **Protocol:** `http` or `https`

Examples:
```bash
http://localhost:5001 → host: localhost, port: 5001, protocol: http
https://ipfs.infura.io:5001 → host: ipfs.infura.io, port: 5001, protocol: https
https://api.pinata.cloud:443 → host: api.pinata.cloud, port: 443, protocol: https
```

No need to configure separately!

