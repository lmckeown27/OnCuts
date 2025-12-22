# 🚀 Install IPFS - Quick Command Reference

Copy-paste these commands to get IPFS running!

---

## Step 1: Install Dependencies

```bash
cd ~/CampusCuts/backend
npm install ipfs-http-client --legacy-peer-deps
```

## Step 2: Add to `.env`

```bash
# Open .env file
nano ~/CampusCuts/backend/.env

# Add these lines at the end:
USE_IPFS=true
IPFS_NODE_URL=http://localhost:5001
PINATA_API_KEY=get_from_pinata_dashboard
PINATA_API_SECRET=get_from_pinata_dashboard
```

**Get Pinata keys:** https://app.pinata.cloud/keys

## Step 3: (Optional) Install IPFS Desktop

```bash
# macOS
brew install --cask ipfs

# Or download from:
# https://docs.ipfs.tech/install/ipfs-desktop/

# Start IPFS Desktop (or run daemon):
ipfs daemon
```

**Note:** You can skip this step - Pinata alone works fine!

## Step 4: Test Connection

```bash
cd ~/CampusCuts
npx ts-node backend/scripts/test-ipfs.ts
```

**Expected output:**
```
✅ IPFS is enabled
✅ Local IPFS Node: Connected (or skipped)
✅ Pinata API: Connected
🎉 All systems operational!
```

## Step 5: Restart Backend

```bash
# Development
cd ~/CampusCuts/backend
npm run dev

# Production
pm2 restart all
pm2 logs backend --lines 50
```

---

## ✅ Verify It's Working

### Check logs for IPFS messages:

```bash
pm2 logs backend | grep -i ipfs
```

Should see:
```
✅ Pinata API connected
Portfolio image uploaded to IPFS: bafybeig...
```

### Test upload:

```bash
curl -X POST http://localhost:3001/api/v1/upload/profile-picture \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/test.jpg"
```

Response should include `"ipfs": { "pinataCID": "bafybeig..." }`

---

## 🔧 Troubleshooting

### "IPFS is disabled"
```bash
# Check .env has:
USE_IPFS=true
```

### "Pinata credentials not configured"
```bash
# Get keys: https://app.pinata.cloud/keys
# Add to .env:
PINATA_API_KEY=...
PINATA_API_SECRET=...
```

### Test Pinata connection:
```bash
curl -X GET https://api.pinata.cloud/data/testAuthentication \
  -H "pinata_api_key: YOUR_KEY" \
  -H "pinata_secret_api_key: YOUR_SECRET"
```

Should return: `{"message":"Congratulations! You are communicating with the Pinata API!"}`

---

## 📖 Full Docs

- **Quick Start:** `backend/IPFS_QUICKSTART.md`
- **Full Guide:** `backend/IPFS_INTEGRATION_GUIDE.md`
- **API Keys:** `API_KEYS_GUIDE.md`
- **Summary:** `IPFS_IMPLEMENTATION_SUMMARY.md`

---

## 💡 Key Points

✅ IPFS is **optional** - backend works without it  
✅ Local IPFS node is **optional** - Pinata alone works  
✅ Files stored in **both** local storage AND IPFS  
✅ **Free tier** (1GB) perfect for testing  
✅ Takes **5 minutes** to set up  

---

**Questions?** Run: `npx ts-node backend/scripts/test-ipfs.ts`

