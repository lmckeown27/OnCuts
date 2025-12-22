# Fix IPFS Installation - Remove v60 and Install v56

## The Issue

The old `ipfs-http-client@60.0.1` is still installed in `node_modules`, even though `package.json` now specifies `v56.0.3`.

## Commands to Fix

Run these **exact commands** on your EC2 server:

```bash
# Navigate to backend
cd ~/CampusCuts/backend

# Remove the problematic package
rm -rf node_modules/ipfs-http-client

# Clear npm cache
npm cache clean --force

# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Verify correct version installed
npm list ipfs-http-client
# Should show: ipfs-http-client@56.0.3
```

## If Above Doesn't Work

Try this **nuclear option**:

```bash
cd ~/CampusCuts/backend

# Remove everything
rm -rf node_modules package-lock.json

# Install specific version explicitly
npm install ipfs-http-client@56.0.3 --save --legacy-peer-deps

# Then install rest of dependencies
npm install --legacy-peer-deps

# Verify version
npm list ipfs-http-client
```

## Test After Install

```bash
# Should work now!
npx ts-node scripts/test-ipfs.ts

# Build
npm run build

# Restart
pm2 restart all
```

## Expected Output After Install

```bash
$ npm list ipfs-http-client
backend@1.0.0 /home/ubuntu/CampusCuts/backend
└── ipfs-http-client@56.0.3
```

## Why This Happens

`npm install` doesn't automatically remove packages when you downgrade versions. The old v60 files remain in `node_modules` until explicitly removed.

**Solution:** Remove `node_modules` and reinstall fresh.

