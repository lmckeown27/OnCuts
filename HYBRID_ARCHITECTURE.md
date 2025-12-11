## Hybrid Architecture: Blockchain + PostgreSQL Cache

**Why Hybrid? 50-70% Cost Savings!**

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    USER WRITES                          │
│         (Signup, Booking, Review, Payment)              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Backend API         │
         │  (Node.js/Express)    │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  Aptos Blockchain     │ ◄── SOURCE OF TRUTH
         │  (Smart Contracts)    │
         └───────────┬───────────┘
                     │
                     │ Hourly Sync
                     ▼
         ┌───────────────────────┐
         │   PostgreSQL          │ ◄── CACHE LAYER
         │   (Fast Queries)      │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Backend API         │
         │   (Reads from cache)  │
         └───────────┬───────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    USER READS                           │
│    (Dashboard, Analytics, Pricing, Admin Panel)         │
└─────────────────────────────────────────────────────────┘
```

---

### Data Flow

#### **Writes (Always to Blockchain)**
```
User Action → Backend API → Aptos Blockchain → Confirmed
                                    ↓
                            (Hourly Sync)
                                    ↓
                              PostgreSQL Cache
```

#### **Reads (Cache-First Strategy)**
```
User Query → Backend API → Check PostgreSQL Cache
                                    ↓
                            90% Cache Hit (Fast!)
                                    ↓
                            Return Cached Data

                           10% Cache Miss
                                    ↓
                           Query Blockchain
                                    ↓
                           Update Cache
                                    ↓
                           Return Data
```

---

### Cost Comparison

#### **Option A: Pure Blockchain (No PostgreSQL)**
```
Monthly Costs:
├─ Blockchain gas (many reads):      $30-75/month
├─ Blockchain indexer (The Graph):   $100-500/month
├─ IPFS storage:                     $20/month
├─ Backend hosting:                  $15/month
└─ Redis:                            $10/month
────────────────────────────────────────────────
TOTAL:                               $175-620/month
```

#### **Option B: Hybrid (PostgreSQL Cache)** ✅ CHOSEN
```
Monthly Costs:
├─ Blockchain gas (writes only):     $10-25/month  ← 50% less!
├─ PostgreSQL cache:                 $20-50/month
├─ IPFS storage:                     $20/month
├─ Backend hosting:                  $15/month
└─ Redis:                            $10/month
────────────────────────────────────────────────
TOTAL:                               $75-140/month

SAVINGS:                             $100-480/month (57-77% cheaper!)
```

---

### Why Hybrid is Cheaper

#### **1. Reduced Blockchain Reads**
```
Pure Blockchain:
- Every query hits blockchain
- Admin dashboard: 50 queries × $0.003 = $0.15 per load
- 1,000 loads/month = $150

Hybrid (90% cache hit):
- 90% queries hit PostgreSQL (free)
- Admin dashboard: 5 queries × $0.003 = $0.015 per load
- 1,000 loads/month = $15

SAVINGS: $135/month (90% reduction)
```

#### **2. No Expensive Indexer Services**
```
Pure Blockchain needs indexer for:
- Complex queries (JOIN, GROUP BY)
- Fast analytics (<100ms response)
- Historical data aggregation

The Graph Pricing:
├─ Free: 100k queries/month (rate limited)
├─ Growth: $100/month (1M queries)
└─ Scale: $500/month (10M queries)

PostgreSQL:
├─ Render: $20/month (1 GB RAM, 10 GB storage)
├─ Railway: $20/month (1 GB RAM, 10 GB storage)
└─ DigitalOcean: $15/month (1 GB RAM, 10 GB storage)

SAVINGS: $80-480/month
```

#### **3. Fast Complex Queries**
```
Blockchain Query (No Cache):
- Admin dashboard: 2-5 seconds
- Pricing calculation: 1-3 seconds
- Analytics report: 5-10 seconds

PostgreSQL Cache:
- Admin dashboard: 50-200ms
- Pricing calculation: 20-50ms
- Analytics report: 100-500ms

RESULT: 10-50x faster queries!
```

---

### Sync Strategy

#### **Hourly Sync (Every :00)**
```typescript
// Runs every hour
cron.schedule('0 * * * *', async () => {
  await blockchainSyncService.syncAll();
});
```

**What Gets Synced:**
- ✅ Users (new signups, profile updates)
- ✅ Bookings (new, completed, cancelled)
- ✅ Reviews (new ratings, comments)

**Sync Process:**
1. Query blockchain for latest data
2. Compare with PostgreSQL cache
3. Insert new records
4. Update changed records
5. Log sync status

**Sync Duration:** ~30-60 seconds for 1,000 records

---

### Cache Staleness

#### **How Stale is the Cache?**
```
Worst Case: 59 minutes 59 seconds old
Average Case: 30 minutes old
Best Case: Real-time (for critical queries)
```

#### **Critical Data (Real-Time)**
For time-sensitive operations, query blockchain directly:
- ✅ Booking confirmation (must be real-time)
- ✅ Payment verification (must be real-time)
- ✅ Balance checks before withdrawal

#### **Non-Critical Data (Cached)**
Can tolerate 30-60 minute staleness:
- ✅ Admin dashboards
- ✅ Pricing calculations
- ✅ Analytics reports
- ✅ Barber statistics

---

### Database Schema

#### **PostgreSQL Tables (Cache)**
```sql
users           -- User profiles (synced from blockchain)
bookings        -- Booking records (synced from blockchain)
reviews         -- Reviews and ratings (synced from blockchain)
sync_status     -- Tracks last sync time per table
```

#### **Important Notes:**
- ⚠️ PostgreSQL is READ-ONLY (except for sync service)
- ⚠️ All writes go to blockchain first
- ⚠️ PostgreSQL can be wiped and rebuilt from blockchain
- ⚠️ Blockchain is ALWAYS the source of truth

---

### Monitoring Sync Health

#### **Sync Status Endpoint**
```bash
GET /api/admin/sync-status

Response:
{
  "isSyncing": false,
  "lastSyncTime": "2025-12-11T08:00:00.000Z",
  "nextSyncIn": 1800000, // 30 minutes
  "tables": {
    "users": {
      "lastSync": "2025-12-11T08:00:00.000Z",
      "recordsSynced": 1250,
      "syncDurationMs": 15000
    },
    "bookings": {
      "lastSync": "2025-12-11T08:00:00.000Z",
      "recordsSynced": 5430,
      "syncDurationMs": 32000
    },
    "reviews": {
      "lastSync": "2025-12-11T08:00:00.000Z",
      "recordsSynced": 3200,
      "syncDurationMs": 18000
    }
  }
}
```

---

### Disaster Recovery

#### **If PostgreSQL Cache is Lost:**
```bash
# Rebuild entire cache from blockchain
npm run sync:full

# Takes ~5-10 minutes for 10,000 records
# No data loss (blockchain is source of truth)
```

#### **If Blockchain is Unavailable:**
```
- Reads: Continue using PostgreSQL cache (stale but functional)
- Writes: Queue in Redis, retry when blockchain is back
- User Experience: Minimal disruption
```

---

### Development Setup

#### **1. Start PostgreSQL**
```bash
docker-compose up postgres -d
```

#### **2. Run Migrations**
```bash
# PostgreSQL will auto-run init.sql on first start
# Or manually:
psql -U postgres -d campuscuts -f backend/database/init.sql
```

#### **3. Initial Sync**
```bash
# Sync all data from blockchain
npm run sync:blockchain
```

#### **4. Start Backend**
```bash
cd backend
npm run dev
```

Sync will run automatically every hour at :00.

---

### Production Deployment

#### **PostgreSQL Hosting Options**

**Render.com (Recommended)**
```
Starter:  $7/month  (256 MB RAM, 1 GB storage)
Standard: $20/month (1 GB RAM, 10 GB storage)  ← MVP
Pro:      $50/month (4 GB RAM, 50 GB storage)  ← Scale
```

**Railway.dev**
```
Hobby:     $5/month  (Shared resources)
Developer: $20/month (1 GB RAM, 10 GB storage)  ← MVP
Team:      $50/month (4 GB RAM, 50 GB storage)  ← Scale
```

**DigitalOcean Managed**
```
Basic:        $15/month (1 GB RAM, 10 GB storage)  ← MVP
Professional: $50/month (4 GB RAM, 50 GB storage)  ← Scale
```

---

### FAQ

#### **Q: Why not just use blockchain for everything?**
**A:** Cost! Blockchain indexers ($100-500/mo) are 5-25x more expensive than PostgreSQL ($20/mo).

#### **Q: What if the cache is stale?**
**A:** For critical operations (payments, bookings), we query blockchain directly. For analytics, 30-60 min staleness is acceptable.

#### **Q: Can I delete PostgreSQL and go pure blockchain?**
**A:** Yes! But expect:
- 50-70% higher costs (need indexer services)
- Slower queries (2-5 seconds vs 50-200ms)
- More complex development (no SQL JOIN)

#### **Q: Is this truly decentralized?**
**A:** Yes! Blockchain is the source of truth. PostgreSQL is just a cache. Even if PostgreSQL is hacked/deleted, we can rebuild from blockchain.

#### **Q: What about data consistency?**
**A:** Blockchain is ALWAYS consistent. PostgreSQL may lag up to 1 hour. For real-time data, query blockchain directly.

---

### Summary

**Hybrid Architecture Benefits:**
- ✅ 50-70% cost savings vs pure blockchain
- ✅ 10-50x faster queries
- ✅ Blockchain remains source of truth
- ✅ Easy disaster recovery
- ✅ Scales to millions of users
- ✅ Best of both worlds!

**Trade-offs:**
- ⚠️ Cache staleness (30-60 minutes)
- ⚠️ Additional complexity (sync service)
- ⚠️ Database hosting cost ($20-50/mo)

**Verdict:** Hybrid is the smart choice for cost-conscious startups! 🚀

