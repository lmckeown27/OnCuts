# IPFS Integration - Quick Start

Get decentralized file storage running in 5 minutes!

---

## Step 1: Install Dependencies

```bash
cd backend
npm install ipfs-http-client --legacy-peer-deps
```

## Step 2: Get Pinata API Keys

1. Go to https://app.pinata.cloud/register
2. Create account (free)
3. Navigate to **API Keys** → **New Key**
4. Enable permissions: `pinFileToIPFS`, `pinJSONToIPFS`
5. Copy **API Key** and **API Secret**

## Step 3: Configure Environment

Add to `backend/.env`:

```bash
# Enable IPFS
USE_IPFS=true

# Pinata credentials (required)
PINATA_API_KEY=your_pinata_api_key_here
PINATA_API_SECRET=your_pinata_api_secret_here

# Local IPFS node (optional)
IPFS_NODE_URL=http://localhost:5001
```

## Step 4: (Optional) Install IPFS Desktop

For faster uploads, install local IPFS node:

1. Download from: https://docs.ipfs.tech/install/ipfs-desktop/
2. Install and run IPFS Desktop
3. Node will automatically run on `http://localhost:5001`

**OR skip this step** - Pinata alone works fine!

## Step 5: Test IPFS

```bash
# Test connection
npx ts-node backend/scripts/test-ipfs.ts

# Should see:
# ✅ Local IPFS Node: Connected (or skipped)
# ✅ Pinata API: Connected
# 🎉 All systems operational!
```

## Step 6: Restart Backend

```bash
# Development
npm run dev

# Production
pm2 restart all
```

---

## ✅ Done! IPFS is Active

Now when users upload images, they're stored on:
- ✅ Local server (fast access)
- ✅ Local IPFS node (if running)
- ✅ Pinata IPFS (permanent, distributed)

---

## Test Upload

```bash
# Upload a test image
curl -X POST http://localhost:3001/api/v1/upload/profile-picture \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/test.jpg"
```

**Response will include:**
```json
{
  "success": true,
  "data": {
    "url": "/uploads/profile/pic123.jpg",
    "ipfs": {
      "localCID": "bafybeigdyrzt...",
      "pinataCID": "bafybeigdyrzt...",
      "gatewayUrl": "https://gateway.pinata.cloud/ipfs/bafybeigdyrzt...",
      "ipfsUrl": "ipfs://bafybeigdyrzt..."
    }
  }
}
```

---

## Access Files

Your IPFS files are accessible via multiple gateways:

```bash
# Pinata gateway (fastest)
https://gateway.pinata.cloud/ipfs/{CID}

# IPFS.io gateway
https://ipfs.io/ipfs/{CID}

# Cloudflare gateway
https://cloudflare-ipfs.com/ipfs/{CID}

# Brave browser (native IPFS support)
ipfs://{CID}
```

---

## Troubleshooting

### "IPFS is disabled"
```bash
# Fix: Add to .env
USE_IPFS=true
```

### "Pinata credentials not configured"
```bash
# Fix: Check your .env has:
PINATA_API_KEY=...
PINATA_API_SECRET=...
```

### "Local IPFS node connection failed"
**This is OK!** Uploads will still work via Pinata.

To fix (optional):
1. Install IPFS Desktop
2. Or run `ipfs daemon`
3. Or leave it - Pinata works alone

---

## Next Steps

- 📖 Full documentation: `backend/IPFS_INTEGRATION_GUIDE.md`
- 🧪 Test script: `backend/scripts/test-ipfs.ts`
- 🔑 API keys guide: `API_KEYS_GUIDE.md`

---

**Need help?** Check the full guide or test with `npx ts-node backend/scripts/test-ipfs.ts`

