# IPFS Integration Guide - CampusCuts Backend

Complete guide for implementing decentralized file storage using IPFS and Pinata.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [Configuration](#configuration)
5. [API Usage](#api-usage)
6. [Testing](#testing)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Overview

CampusCuts now supports **decentralized file storage** using IPFS (InterPlanetary File System) with Pinata pinning service.

### What is IPFS?

**IPFS** is a peer-to-peer distributed file system that makes the web faster, safer, and more open.

- **Content-Addressed**: Files are identified by their content (CID), not location
- **Decentralized**: No single point of failure
- **Permanent**: Files remain available as long as someone pins them
- **Verifiable**: CID guarantees file integrity

### Why Pinata?

**Pinata** is an IPFS pinning service that ensures your files remain permanently available on the IPFS network.

- **Reliability**: 99.9% uptime guarantee
- **Performance**: Global CDN for fast access
- **Management**: Easy file pinning and unpinning
- **Analytics**: Track your IPFS usage

---

## Architecture

### Two-Tier Storage Strategy

```
┌──────────────────────────────────────────────────────┐
│  File Upload Flow                                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. User uploads file                                │
│     ↓                                                │
│  2. Process & save locally (fallback/cache)          │
│     ↓                                                │
│  3. Upload to local IPFS node (fast)                 │
│     - Returns CID immediately                        │
│     - Local node pins file                           │
│     ↓                                                │
│  4. Pin to Pinata (permanent)                        │
│     - Uploads to Pinata's IPFS network               │
│     - Returns CID (should match local CID)           │
│     - File now permanently available                 │
│     ↓                                                │
│  5. Return response with:                            │
│     - Local URL (fast access)                        │
│     - IPFS CID (decentralized ID)                    │
│     - Gateway URLs (public access)                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Benefits

- ✅ **Fast uploads**: Local IPFS node provides instant CID
- ✅ **Permanent storage**: Pinata ensures files never disappear
- ✅ **Redundancy**: Files stored locally AND on IPFS
- ✅ **Verifiable**: CID proves file hasn't been tampered with
- ✅ **CDN-like performance**: Access via multiple gateways
- ✅ **Censorship resistant**: No single entity controls the files

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- IPFS Desktop or IPFS Daemon (optional, for local node)
- Pinata account (free tier available)

### Step 1: Install IPFS Desktop (Recommended)

**Option A: IPFS Desktop (Easiest)**

1. Download from: https://docs.ipfs.tech/install/ipfs-desktop/
2. Install and run IPFS Desktop
3. IPFS node will be available at `http://localhost:5001`

**Option B: IPFS Daemon (CLI)**

```bash
# Install IPFS
wget https://dist.ipfs.tech/kubo/v0.24.0/kubo_v0.24.0_linux-amd64.tar.gz
tar -xvzf kubo_v0.24.0_linux-amd64.tar.gz
cd kubo
sudo bash install.sh

# Initialize IPFS
ipfs init

# Start IPFS daemon
ipfs daemon

# Verify
curl http://localhost:5001/api/v0/version
```

**Option C: Skip Local Node (Use Pinata Only)**

You can skip the local IPFS node and use only Pinata. Set:
```bash
IPFS_NODE_URL=  # Leave empty or don't set
```

### Step 2: Create Pinata Account

1. **Sign up**: https://app.pinata.cloud/register
2. **Get API Keys**:
   - Go to API Keys section
   - Click "New Key"
   - Select permissions: `pinFileToIPFS`, `pinJSONToIPFS`
   - Copy `API Key` and `API Secret`

### Step 3: Install Dependencies

```bash
cd backend
npm install ipfs-http-client --legacy-peer-deps
```

Dependencies already added to `package.json`:
- ✅ `ipfs-http-client@60.0.1` - IPFS node communication
- ✅ `axios` - HTTP requests (already installed)
- ✅ `form-data` - Multipart uploads (already installed)

### Step 4: Configure Environment Variables

Add to `backend/.env`:

```bash
# ==========================================
# IPFS Configuration
# ==========================================

# Enable/Disable IPFS
USE_IPFS=true

# Local IPFS Node (optional)
IPFS_NODE_URL=http://localhost:5001

# Pinata API Credentials (required for pinning)
PINATA_API_KEY=your_pinata_api_key_here
PINATA_API_SECRET=your_pinata_api_secret_here
```

### Step 5: Restart Backend

```bash
npm run dev

# Or with pm2
pm2 restart all
```

---

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `USE_IPFS` | Enable IPFS uploads | No | `false` |
| `IPFS_NODE_URL` | Local IPFS node URL | No | `http://localhost:5001` |
| `PINATA_API_KEY` | Pinata API key | Yes (if USE_IPFS=true) | - |
| `PINATA_API_SECRET` | Pinata API secret | Yes (if USE_IPFS=true) | - |

### Recommended Settings

**Development:**
```bash
USE_IPFS=true
IPFS_NODE_URL=http://localhost:5001
PINATA_API_KEY=your_dev_key
PINATA_API_SECRET=your_dev_secret
```

**Production:**
```bash
USE_IPFS=true
IPFS_NODE_URL=  # Optional, can skip local node
PINATA_API_KEY=your_prod_key
PINATA_API_SECRET=your_prod_secret
```

---

## API Usage

### Upload Endpoints

All existing upload endpoints now support IPFS:

#### 1. Portfolio Images

```bash
POST /api/v1/upload/portfolio
Headers: {
  Authorization: Bearer <jwt_token>
}
Body: multipart/form-data with image files
```

**Response with IPFS:**
```json
{
  "success": true,
  "message": "Portfolio images uploaded successfully",
  "data": {
    "images": [
      {
        "url": "/uploads/portfolio/image123.jpg",
        "thumbnailUrl": "/uploads/portfolio/thumbnail/image123.jpg",
        "filename": "image123.jpg",
        "ipfs": {
          "localCID": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          "pinataCID": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          "gatewayUrl": "https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          "ipfsUrl": "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
        }
      }
    ],
    "ipfsEnabled": true
  }
}
```

#### 2. Profile Picture

```bash
POST /api/v1/upload/profile-picture
Headers: {
  Authorization: Bearer <jwt_token>
}
Body: multipart/form-data with single image
```

**Response:**
```json
{
  "success": true,
  "message": "Profile picture uploaded successfully",
  "data": {
    "url": "/uploads/profile/pic123.jpg",
    "thumbnailUrl": "/uploads/profile/thumbnail/pic123.jpg",
    "filename": "pic123.jpg",
    "ipfs": {
      "localCID": "bafybeigdyrzt...",
      "pinataCID": "bafybeigdyrzt...",
      "gatewayUrl": "https://gateway.pinata.cloud/ipfs/bafybeigdyrzt...",
      "ipfsUrl": "ipfs://bafybeigdyrzt..."
    }
  }
}
```

#### 3. Chat Images

```bash
POST /api/v1/upload/chat-image
Headers: {
  Authorization: Bearer <jwt_token>
}
Body: multipart/form-data with image
```

### Accessing IPFS Files

Files can be accessed via multiple gateways:

```bash
# Pinata Gateway (fastest)
https://gateway.pinata.cloud/ipfs/{CID}

# IPFS.io Gateway
https://ipfs.io/ipfs/{CID}

# Cloudflare Gateway
https://cloudflare-ipfs.com/ipfs/{CID}

# Dweb Gateway
https://dweb.link/ipfs/{CID}

# IPFS Protocol (in browsers with IPFS support)
ipfs://{CID}
```

---

## Testing

### Test 1: Verify IPFS Connection

Create `backend/scripts/test-ipfs.ts`:

```typescript
import dotenv from 'dotenv';
import { verifyIPFSConnection } from '../src/services/ipfs.service';

dotenv.config();

async function testIPFS() {
  console.log('\n🔍 Testing IPFS Connection...\n');
  
  const status = await verifyIPFSConnection();
  
  console.log('Local IPFS:', status.localIPFS ? '✅ Connected' : '❌ Failed');
  console.log('Pinata:', status.pinata ? '✅ Connected' : '❌ Failed');
  
  if (status.error) {
    console.error('\nError:', status.error);
  }
  
  if (status.localIPFS && status.pinata) {
    console.log('\n🎉 IPFS fully operational!\n');
  }
}

testIPFS();
```

**Run:**
```bash
npx ts-node backend/scripts/test-ipfs.ts
```

### Test 2: Upload Test File

```bash
# Upload profile picture
curl -X POST http://localhost:3001/api/v1/upload/profile-picture \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/test-image.jpg"
```

**Check response** for `ipfs` object with CIDs.

### Test 3: Access via Gateway

```bash
# Use the CID from upload response
curl https://gateway.pinata.cloud/ipfs/YOUR_CID

# Should return the image file
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Pinata account created
- [ ] Production API keys generated
- [ ] Environment variables configured
- [ ] IPFS connection tested
- [ ] Test uploads completed
- [ ] Gateway URLs verified

### Production Configuration

```bash
# backend/.env (production)
USE_IPFS=true
IPFS_NODE_URL=  # Optional: skip local node in production
PINATA_API_KEY=prod_api_key_here
PINATA_API_SECRET=prod_api_secret_here
```

### Deployment Steps

1. **Update .env on server:**
   ```bash
   nano /path/to/backend/.env
   # Add IPFS configuration
   ```

2. **Install dependencies:**
   ```bash
   cd backend
   npm install --legacy-peer-deps
   ```

3. **Restart backend:**
   ```bash
   pm2 restart all
   ```

4. **Verify IPFS:**
   ```bash
   npx ts-node backend/scripts/test-ipfs.ts
   ```

5. **Test uploads:**
   ```bash
   # Upload test image and verify CID is returned
   ```

### Monitoring

Check Pinata dashboard for:
- Upload statistics
- Storage usage
- Gateway bandwidth
- Pin status

---

## Troubleshooting

### Issue 1: "IPFS is disabled"

**Problem:** `USE_IPFS` not set to `true`

**Solution:**
```bash
# Add to .env
USE_IPFS=true

# Restart backend
pm2 restart all
```

### Issue 2: "Local IPFS node connection failed"

**Problem:** IPFS daemon not running or wrong URL

**Solutions:**

1. **Check if IPFS is running:**
   ```bash
   curl http://localhost:5001/api/v0/version
   ```

2. **Start IPFS Desktop** or daemon:
   ```bash
   ipfs daemon
   ```

3. **Update IPFS_NODE_URL:**
   ```bash
   IPFS_NODE_URL=http://127.0.0.1:5001
   ```

4. **Skip local node** (use Pinata only):
   ```bash
   IPFS_NODE_URL=  # Leave empty
   ```

### Issue 3: "Pinata credentials not configured"

**Problem:** Missing Pinata API keys

**Solution:**
```bash
# Get keys from: https://app.pinata.cloud/keys
# Add to .env:
PINATA_API_KEY=your_key_here
PINATA_API_SECRET=your_secret_here
```

### Issue 4: "Pinata upload failed"

**Possible Causes:**
- Invalid API keys
- Exceeded quota (free tier limit)
- Network issues
- File too large

**Solutions:**

1. **Verify API keys:**
   ```bash
   curl -X GET https://api.pinata.cloud/data/testAuthentication \
     -H "pinata_api_key: YOUR_KEY" \
     -H "pinata_secret_api_key: YOUR_SECRET"
   ```

2. **Check Pinata dashboard** for quota limits

3. **Check file size:**
   - Free tier: 1GB total storage
   - Paid tiers: Higher limits

### Issue 5: "CID mismatch between local and Pinata"

**Problem:** Different CIDs returned from local IPFS and Pinata

**This is actually fine!** CIDs might differ due to:
- Different CID versions (v0 vs v1)
- Different chunking settings
- Wrapper directories

**Both CIDs are valid** and point to the same content.

### Issue 6: Files uploaded but not accessible

**Problem:** Gateway timeout or file not found

**Solutions:**

1. **Wait a moment** - IPFS propagation takes time (usually seconds)

2. **Try different gateways:**
   ```bash
   https://gateway.pinata.cloud/ipfs/{CID}
   https://ipfs.io/ipfs/{CID}
   https://cloudflare-ipfs.com/ipfs/{CID}
   ```

3. **Check Pinata dashboard** - verify file is pinned

---

## Advanced Usage

### Custom Metadata

Add custom metadata to Pinata uploads:

```typescript
const result = await uploadToIPFS(buffer, filename, {
  name: 'User Profile Picture',
  keyvalues: {
    userId: '123',
    type: 'profile',
    uploadedBy: 'user@email.com',
    timestamp: Date.now()
  }
});
```

### Retrieve from IPFS

```typescript
import { getFromIPFS } from './services/ipfs.service';

const fileBuffer = await getFromIPFS('bafybeigdyrzt...');
// Returns Buffer with file content
```

### Generate Multiple Gateway URLs

```typescript
import { generateGatewayURLs } from './services/ipfs.service';

const urls = generateGatewayURLs('bafybeigdyrzt...');

console.log(urls.pinata);      // Pinata gateway
console.log(urls.ipfsIo);      // IPFS.io gateway
console.log(urls.cloudflare);  // Cloudflare gateway
console.log(urls.dweb);        // Dweb gateway
console.log(urls.protocol);    // ipfs:// protocol
```

---

## Cost Considerations

### Pinata Pricing

**Free Tier:**
- 1 GB storage
- Unlimited uploads
- Unlimited bandwidth
- Perfect for development/testing

**Paid Tiers:**
- Starting at $20/month
- Higher storage limits
- Dedicated gateways
- Advanced analytics

### Recommendations

- **Development:** Use free tier
- **Small Production:** Free tier (if under 1GB)
- **Production:** Paid tier for reliability and support

---

## Summary

✅ **IPFS integration complete!**

- Files uploaded to both local storage and IPFS
- Permanent storage via Pinata pinning
- Multiple gateway access points
- Fallback to local storage if IPFS fails
- No breaking changes to existing API

### Quick Start

```bash
# 1. Install IPFS Desktop from https://docs.ipfs.tech/install/ipfs-desktop/

# 2. Get Pinata keys from https://app.pinata.cloud/keys

# 3. Add to backend/.env:
USE_IPFS=true
IPFS_NODE_URL=http://localhost:5001
PINATA_API_KEY=your_key
PINATA_API_SECRET=your_secret

# 4. Install dependencies
npm install --legacy-peer-deps

# 5. Restart backend
pm2 restart all

# 6. Test upload!
```

---

**For more information:**
- IPFS Docs: https://docs.ipfs.tech/
- Pinata Docs: https://docs.pinata.cloud/
- IPFS HTTP Client: https://github.com/ipfs/js-ipfs/tree/master/packages/ipfs-http-client

