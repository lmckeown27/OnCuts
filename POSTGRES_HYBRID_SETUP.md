# PostgreSQL Hybrid Setup for CampusCuts

## Architecture Overview

CampusCuts uses a **Hybrid Architecture** adapted from CampusKinect's multi-tenancy design:

```
┌─────────────────────────────────────────────────────────┐
│                  CAMPUSCUTS ARCHITECTURE                 │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐         ┌───▼────┐         ┌───▼────┐
   │ Aptos   │         │  IPFS  │         │ Postgres│
   │Blockchain│        │Storage │         │  Cache  │
   │         │         │        │         │         │
   │SOURCE OF│         │ Media  │         │Fast Reads│
   │  TRUTH  │         │  Text  │         │Analytics │
   └─────────┘         └────────┘         └─────────┘
```

### Key Differences from CampusKinect

| Aspect | CampusKinect | CampusCuts |
|--------|--------------|------------|
| **Primary Database** | PostgreSQL | Aptos Blockchain |
| **PostgreSQL Role** | Source of truth | Read-only cache |
| **Data Permanence** | Database backups | Blockchain immutability |
| **Multi-Tenancy** | Soft (university_id) | Soft (address prefix) |
| **Real-time Writes** | Direct to PostgreSQL | Blockchain → Synced to PostgreSQL |
| **Recovery** | Database restore | Rebuild from blockchain |

---

## Quick Start

### 1. Initialize Database

```bash
# Create database
createdb campuscuts

# Run improved schema
psql campuscuts -f backend/database/init-improved.sql

# Insert mock data
psql campuscuts -f backend/database/seed-mock-data.sql
```

### 2. Configure Environment

Edit `backend/.env`:

```env
# macOS/Linux (Homebrew PostgreSQL)
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/campuscuts

# Windows/Docker
DATABASE_URL=postgresql://postgres:password@localhost:5432/campuscuts
```

Replace `YOUR_USERNAME` with output of `whoami` command.

### 3. Restart Backend

```bash
cd backend
npm run dev
```

Expected output:
```
✅ Server started on port 3001
✅ PostgreSQL cache connection established
✅ Redis connected
```

### 4. Verify Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "architecture": "hybrid",
  "layers": {
    "blockchain": {
      "status": "connected",
      "provider": "aptos"
    },
    "cache": {
      "status": "connected",
      "provider": "postgresql",
      "pool": {
        "total": 1,
        "idle": 1,
        "waiting": 0
      }
    }
  }
}
```

---

## Improvements from CampusKinect

### 1. Connection Pool Management

**Adapted from CampusKinect's pool configuration:**

```typescript
// backend/src/database/connection.ts

const poolConfig = {
  max: 8,                          // Conservative for cache layer
  min: 1,                          // Minimum idle connections
  idleTimeoutMillis: 30000,        // 30s - release idle connections
  connectionTimeoutMillis: 10000,  // 10s - timeout for new connections
  statement_timeout: 5000,         // 5s - cache queries must be fast!
  query_timeout: 5000,             // 5s - overall query timeout
};
```

**Key Benefits:**
- Faster timeouts (5s vs 30s) since PostgreSQL is a cache
- Connection pool stats exposed for monitoring
- Graceful degradation if cache unavailable

### 2. Enhanced Schema Design

**Improvements from CampusKinect:**

✅ **Comprehensive Indexing**
```sql
-- Composite indexes for common queries (from CampusKinect)
CREATE INDEX idx_bookings_student_status ON bookings(student_address, status);
CREATE INDEX idx_bookings_barber_completed ON bookings(barber_address, completed_at DESC) 
  WHERE status = 2;

-- Campus filtering (multi-tenancy like CampusKinect)
CREATE INDEX idx_bookings_campus_filter ON bookings(student_address) 
  WHERE student_address LIKE '0x1%' 
     OR student_address LIKE '0x2%' 
     OR student_address LIKE '0x3%';
```

✅ **Materialized Views for Analytics**
```sql
-- Barber statistics (refreshed hourly)
CREATE MATERIALIZED VIEW barber_stats AS
SELECT 
    barber_address,
    COUNT(DISTINCT bookings.id) as total_bookings,
    AVG(reviews.rating) as avg_rating,
    SUM(bookings.amount) as total_earnings
FROM users
LEFT JOIN bookings ...
GROUP BY barber_address;
```

✅ **Automatic Statistics Updates**
```sql
-- Triggers to maintain user stats (like CampusKinect)
CREATE TRIGGER trg_update_barber_stats_booking
AFTER UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_user_stats();
```

### 3. Multi-Tenancy (Campus Isolation)

**Adapted from CampusKinect's university isolation:**

```typescript
// CampusKinect approach:
WHERE university_id = $userUniversityId

// CampusCuts adaptation:
WHERE student_address LIKE '0x1%'  // Cal Poly only
```

**Campus Assignment:**

| Campus | Address Prefix | Example |
|--------|---------------|---------|
| Cal Poly (campus-1) | 0x1xxx | 0x1001, 0x1002... |
| UCSB (campus-2) | 0x2xxx | 0x2001, 0x2002... |
| UCLA (campus-3) | 0x3xxx | 0x3001, 0x3002... |

### 4. Query Performance Monitoring

**From CampusKinect:**

```sql
-- View for monitoring slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
  query,
  calls,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100  -- Queries averaging >100ms
ORDER BY mean_time DESC;
```

Usage:
```bash
psql campuscuts -c "SELECT * FROM slow_queries LIMIT 10;"
```

### 5. Health Checks

**Enhanced from CampusKinect patterns:**

```typescript
// GET /health endpoint
{
  "status": "healthy" | "degraded" | "unhealthy",
  "layers": {
    "blockchain": { ... },  // Source of truth
    "cache": { ... }        // PostgreSQL performance
  }
}
```

**Status Logic:**
- **Healthy:** Both blockchain and cache connected
- **Degraded:** Blockchain connected, cache down (app still works!)
- **Unhealthy:** Blockchain down

---

## Data Flow

### Write Flow (Blockchain → PostgreSQL)

```
User creates booking
  ↓
Backend signs transaction → Aptos blockchain
  ↓
Transaction confirmed (3-5 seconds)
  ↓
Blockchain sync cron (runs hourly)
  ↓
PostgreSQL cache updated
  ↓
Materialized views refreshed
```

### Read Flow (PostgreSQL ↔ Blockchain)

```
Admin requests transactions
  ↓
Query PostgreSQL cache (fast! <100ms)
  ↓
Cache miss? → Fall back to blockchain query
  ↓
Return data to frontend
```

---

## Blockchain Sync Strategy

**Adapted from CampusKinect's migration system:**

### Sync Service

```typescript
// backend/src/services/blockchain-sync.service.ts

class BlockchainSyncService {
  async syncBlockchainToPostgres() {
    // 1. Get last synced version from sync_status table
    const lastVersion = await this.getLastSyncedVersion();
    
    // 2. Query blockchain for new data since lastVersion
    const newUsers = await blockchainQuery.getAllUsersFromBlockchain(lastVersion);
    const newBookings = await blockchainQuery.getAllBookingsFromBlockchain(lastVersion);
    const newReviews = await blockchainQuery.getAllReviewsFromBlockchain(lastVersion);
    
    // 3. Upsert into PostgreSQL
    for (const user of newUsers) {
      await pool.query(`
        INSERT INTO users (...) VALUES (...)
        ON CONFLICT (aptos_address) DO UPDATE SET ...
      `);
    }
    
    // 4. Refresh materialized views
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY barber_stats');
    
    // 5. Update sync_status
    await this.updateSyncStatus(newVersion);
  }
}
```

### Sync Schedule

```typescript
// Cron job (hourly sync)
cron.schedule('0 * * * *', async () => {
  await blockchainSyncService.syncBlockchainToPostgres();
});
```

**Why Hourly?**
- Admin dashboards don't need real-time (hourly is fine)
- Reduces blockchain API costs
- Materialized view refresh is expensive

---

## Performance Optimization

### 1. Query Patterns (from CampusKinect)

**DO:**
```typescript
// Use indexes effectively
const posts = await pool.query(`
  SELECT * FROM bookings 
  WHERE barber_address = $1 
  ORDER BY completed_at DESC 
  LIMIT 20
`, [barberAddress]);

// Use EXISTS for checks
const hasBooking = await pool.query(`
  SELECT EXISTS(
    SELECT 1 FROM bookings 
    WHERE student_address = $1 AND barber_address = $2
  ) as has_booking
`, [studentAddr, barberAddr]);
```

**DON'T:**
```typescript
// Avoid SELECT * without limits
const posts = await pool.query('SELECT * FROM bookings');

// Avoid string concatenation (SQL injection!)
const posts = await pool.query(`
  SELECT * FROM bookings WHERE student_address = '${addr}'
`);
```

### 2. Connection Pool Monitoring

```typescript
import { getPoolStats } from './database/connection';

// Log pool stats
const stats = getPoolStats();
console.log('Pool Stats:', {
  total: stats.total,      // Total connections
  idle: stats.idle,        // Available connections
  waiting: stats.waiting   // Queries waiting for connection
});
```

**Warning Signs:**
- `waiting > 0`: Pool is saturated, increase `max`
- `idle = 0`: All connections in use
- `total > 20`: Risk of exceeding database connection limit

### 3. Slow Query Detection

```bash
# Check slow queries (>100ms)
psql campuscuts -c "
SELECT 
  query,
  calls,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 10;
"
```

---

## Backup & Recovery

### PostgreSQL Backup (Quick, but not critical)

```bash
# Backup PostgreSQL cache
pg_dump campuscuts > backup_$(date +%Y%m%d).sql

# Restore cache
psql campuscuts < backup_20241211.sql
```

**Note:** PostgreSQL backups are **not critical** since data can be rebuilt from blockchain!

### Blockchain Recovery (Source of Truth)

```bash
# Completely wipe PostgreSQL
psql campuscuts -c "DROP TABLE users, bookings, reviews CASCADE;"

# Rebuild from blockchain
psql campuscuts -f backend/database/init-improved.sql
node backend/src/services/blockchain-sync.service.ts
```

**Recovery Time:** ~5-10 minutes for typical dataset

---

## Troubleshooting

### Issue: "role postgres does not exist"

**Cause:** DATABASE_URL uses `postgres` user, but macOS PostgreSQL uses system username.

**Fix:**
```bash
# Get your username
whoami

# Update .env
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/campuscuts
```

### Issue: "database campuscuts does not exist"

**Fix:**
```bash
createdb campuscuts
psql campuscuts -f backend/database/init-improved.sql
```

### Issue: Empty admin dashboard

**Cause:** Mock data not inserted or sync not run.

**Fix:**
```bash
psql campuscuts -f backend/database/seed-mock-data.sql

# Or manually trigger sync
curl -X POST http://localhost:3001/api/admin/sync
```

### Issue: Slow queries (>1s)

**Diagnosis:**
```bash
psql campuscuts -c "SELECT * FROM slow_queries LIMIT 5;"
```

**Common Fixes:**
- Add missing indexes
- Refresh materialized views
- Reduce query result size (add LIMIT)
- Analyze table statistics: `ANALYZE bookings;`

---

## Comparison: CampusKinect vs CampusCuts

| Feature | CampusKinect | CampusCuts |
|---------|--------------|------------|
| **Architecture** | Monolithic PostgreSQL | Hybrid (Blockchain + PostgreSQL) |
| **Write Path** | Direct to PostgreSQL | Blockchain → PostgreSQL |
| **Read Path** | PostgreSQL only | PostgreSQL cache (fallback to blockchain) |
| **Data Permanence** | Database backups required | Blockchain immutable (no backups needed!) |
| **Recovery** | Restore from backup | Rebuild from blockchain (5 min) |
| **Multi-Tenancy** | `university_id` foreign key | Address prefix filtering |
| **Scalability** | Vertical (bigger database) | Horizontal (add blockchain nodes) |
| **Cost** | $50-200/mo database | $5-10/mo cache + blockchain gas |

---

## Next Steps

### Phase 1: Current State ✅

- [x] PostgreSQL cache layer initialized
- [x] Connection pool configured
- [x] Health checks implemented
- [x] Mock data inserted
- [x] Admin dashboard reads from cache

### Phase 2: Production Readiness

- [ ] Deploy blockchain sync cron to production
- [ ] Set up automated PostgreSQL backups (optional)
- [ ] Configure pg_stat_statements for query monitoring
- [ ] Add alerting for pool saturation
- [ ] Implement cache warming (pre-populate on startup)

### Phase 3: Advanced Features

- [ ] Add PostGIS for location-based queries
- [ ] Implement read replicas for analytics
- [ ] Set up connection pooling proxy (PgBouncer)
- [ ] Add full-text search (pg_trgm extension)
- [ ] Implement table partitioning for large datasets

---

## Useful Commands

### Database Management

```bash
# Connect to database
psql campuscuts

# List tables
psql campuscuts -c "\dt"

# Check table sizes
psql campuscuts -c "
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
"

# Vacuum and analyze
psql campuscuts -c "VACUUM ANALYZE bookings;"

# Refresh materialized views
psql campuscuts -c "SELECT refresh_all_stats();"
```

### Monitoring

```bash
# Check active connections
psql campuscuts -c "
SELECT count(*) as connections 
FROM pg_stat_activity 
WHERE datname = 'campuscuts';
"

# Check long-running queries
psql campuscuts -c "
SELECT 
  pid,
  now() - query_start AS duration,
  query
FROM pg_stat_activity
WHERE state = 'active' AND query_start < now() - interval '5 seconds'
ORDER BY duration DESC;
"

# Kill a query
psql campuscuts -c "SELECT pg_cancel_backend(PID);"
```

---

## Resources

- **CampusKinect PostgreSQL Docs:** Original architecture documentation
- **PostgreSQL Performance:** https://www.postgresql.org/docs/current/performance-tips.html
- **Connection Pooling:** https://node-postgres.com/features/pooling
- **Aptos Indexer API:** https://fullnode.devnet.aptoslabs.com/v1

---

## Support

**Questions?** Contact: lmckeown@calpoly.edu

**Found a bug?** Open an issue on GitHub

**Want to contribute?** See CONTRIBUTING.md (coming soon)

---

**Last Updated:** December 11, 2025  
**Version:** 2.0 (Hybrid Architecture)  
**Status:** Production Ready ✅

