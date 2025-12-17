# CampusCuts PostgreSQL Scaling Strategy

## Executive Summary

This document outlines the production-ready scaling strategy for CampusCuts' PostgreSQL layer.

**Key Principles:**
- PostgreSQL is a **coordination + intelligence layer**, NOT source of truth
- Blockchain (Aptos) remains authoritative for payments and reputation
- Database can be wiped and rebuilt from blockchain at any time
- All cached data is disposable and recomputable

---

## 1. Current Architecture (MVP → 10K Users)

### Single PostgreSQL Instance
```
┌─────────────────┐
│   Node.js API   │
│   (NestJS)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   (Single DB)   │
└─────────────────┘
```

**Capacity:**
- 10-20 campuses
- 500-1000 barbers
- 10K-50K bookings/month
- Connection pool: 8-20 connections

**Hosting Options:**
- **Development:** Local PostgreSQL 15+
- **Production:** Supabase (free tier → $25/mo), Railway, Render

**Estimated Cost:** $0-$50/month

---

## 2. Growth Phase (10K → 100K Users)

### Read Replicas + Connection Pooling

```
┌─────────────────┐
│   Node.js API   │
│  (Load Balanced)│
└────┬───────┬────┘
     │       │
     ▼       ▼
┌────────┐ ┌────────┐
│ Primary│ │Replica │  (Read-heavy queries)
│  (RW)  │ │  (RO)  │  - Barber discovery
└────────┘ └────────┘  - Rankings
                       - Market stats
```

**When to Scale:**
- API response time > 500ms for read queries
- Connection pool saturation (>80% utilization)
- > 100 campuses
- > 5,000 barbers
- > 200K bookings/month

**Implementation:**
```typescript
// Prisma read replica configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,  // Primary
    },
  },
});

const prismaReadonly = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_URL,  // Replica
    },
  },
});

// Usage
export class BarberService {
  // Writes → Primary
  async createBarber(data) {
    return prisma.barber.create({ data });
  }
  
  // Reads → Replica
  async findRankedBarbers(campusId) {
    return prismaReadonly.barber.findMany({
      where: { campusId, isActive: true },
      orderBy: { bqsScore: 'desc' },
    });
  }
}
```

**Query Routing Rules:**
- **Primary DB (Writes):**
  - Bookings, reviews, availability updates
  - User profile changes
  - Location submissions
  
- **Replica DB (Reads):**
  - Barber discovery/search
  - Rankings computation
  - Market stats
  - AI annotation queries

**Estimated Cost:** $100-$300/month

---

## 3. Campus-Based Sharding (100K+ Users)

### Horizontal Partitioning by Campus

```
┌─────────────────┐
│  Routing Layer  │  (campusId → shard)
│   (API Gateway) │
└────┬───┬───┬────┘
     │   │   │
     ▼   ▼   ▼
┌────────┬────────┬────────┐
│Shard 1 │Shard 2 │Shard 3 │
│ CA     │ NY     │ TX     │
│campuses│campuses│campuses│
└────────┴────────┴────────┘
```

**Sharding Strategy:**

**Option A: Geographic Sharding**
- Shard by state or region
- Keeps related campuses together
- Simpler cross-campus analytics

**Option B: Campus ID Sharding**
- Hash(campus_id) % num_shards
- Better load distribution
- More complex cross-shard queries

**Implementation (Campus ID Sharding):**

```typescript
// Shard router
class ShardRouter {
  private shards: Map<number, PrismaClient>;
  
  constructor(shardConfigs: ShardConfig[]) {
    this.shards = new Map();
    shardConfigs.forEach((config, index) => {
      this.shards.set(index, new PrismaClient({
        datasources: { db: { url: config.databaseUrl } },
      }));
    });
  }
  
  getShardForCampus(campusId: string): PrismaClient {
    const hash = this.hashCampusId(campusId);
    const shardIndex = hash % this.shards.size;
    return this.shards.get(shardIndex)!;
  }
  
  private hashCampusId(campusId: string): number {
    // Simple hash function (use better in production)
    return campusId.split('').reduce((acc, char) => 
      acc + char.charCodeAt(0), 0
    );
  }
}

// Usage in service
export class BarberService {
  constructor(private shardRouter: ShardRouter) {}
  
  async findBarbersByCampus(campusId: string) {
    const shard = this.shardRouter.getShardForCampus(campusId);
    return shard.barber.findMany({
      where: { campusId },
    });
  }
}
```

**Shard Schema:**
Each shard contains:
- `campuses` (filtered by shard)
- `users` (scoped to shard's campuses)
- `barbers`
- `locations`
- `availability`
- `bookings`
- `reviews`

**Global Tables (Shared):**
- `ai_models_config`
- `platform_admin_users`
- `global_market_stats`

**Cross-Shard Queries:**
Avoid when possible. If needed:
```typescript
async getTopBarbersGlobal(limit: number) {
  const results = await Promise.all(
    Array.from(this.shards.values()).map(shard =>
      shard.barber.findMany({
        orderBy: { bqsScore: 'desc' },
        take: limit,
      })
    )
  );
  
  // Merge and re-sort
  return results
    .flat()
    .sort((a, b) => b.bqsScore - a.bqsScore)
    .slice(0, limit);
}
```

**When to Shard:**
- > 500 campuses
- > 50,000 barbers
- > 10M bookings
- Single DB performance plateaus despite optimization

**Estimated Cost:** $500-$2,000/month (3-5 shards)

---

## 4. Index Optimization Strategy

### Critical Indexes (Already in Schema)

**Hot Path Queries:**
```sql
-- Barber discovery (most frequent query)
CREATE INDEX idx_barbers_campus_active ON barbers(campus_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_barbers_bqs ON barbers(bqs_score DESC NULLS LAST)
  WHERE is_active = true;

-- Location fuzzy matching
CREATE INDEX idx_locations_normalized_trgm ON locations 
  USING gin(normalized_name gin_trgm_ops);

-- Availability locking
CREATE INDEX idx_availability_lock ON availability(locked_by, lock_expires_at) 
  WHERE locked_by IS NOT NULL;

-- Booking status queries
CREATE INDEX idx_bookings_barber_status ON bookings(barber_id, status);
CREATE INDEX idx_bookings_consumer_status ON bookings(consumer_id, status);
```

### Partial Indexes (Save Space)
```sql
-- Only index active barbers
CREATE INDEX idx_active_barbers_campus ON barbers(campus_id, bqs_score DESC)
  WHERE is_active = true AND is_onboarded = true;

-- Only index future availability
CREATE INDEX idx_future_availability ON availability(start_time)
  WHERE start_time > NOW() AND status = 'OPEN';

-- Only index pending bookings
CREATE INDEX idx_pending_bookings ON bookings(barber_id, requested_at)
  WHERE status = 'PENDING';
```

### Covering Indexes (Index-Only Scans)
```sql
-- Barber discovery (covers all needed columns)
CREATE INDEX idx_barbers_discovery ON barbers(
  campus_id, is_active, bqs_score, avg_rating
) INCLUDE (
  current_min_price_usd_cents, 
  current_max_price_usd_cents,
  total_reviews
) WHERE is_active = true;
```

---

## 5. Caching Strategy

### Redis Layer (L1 Cache)

```
┌─────────────────┐
│   Node.js API   │
└────┬───────┬────┘
     │       │
     ▼       ▼
┌────────┐ ┌────────┐
│ Redis  │ │Postgres│
│ (L1)   │ │ (L2)   │
└────────┘ └────────┘
```

**What to Cache:**
```typescript
// Cache barber rankings (recomputed hourly)
const cacheKey = `barbers:ranked:${campusId}`;
const ttl = 3600; // 1 hour

const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const barbers = await prisma.barber.findMany(/* ... */);
await redis.setex(cacheKey, ttl, JSON.stringify(barbers));
return barbers;
```

**Cache Invalidation:**
- **Time-based:** Rankings, market stats (1 hour TTL)
- **Event-based:** User profiles, barber status (invalidate on update)
- **Never cache:** Availability locks, booking statuses

**Redis Data Structures:**
```typescript
// Sorted sets for rankings
await redis.zadd(
  `campus:${campusId}:barbers:ranked`,
  bqsScore,
  barberId
);

// Hashes for barber profiles
await redis.hset(
  `barber:${barberId}:profile`,
  { displayName, avgRating, totalReviews }
);

// Lists for recent activity
await redis.lpush(
  `campus:${campusId}:recent_bookings`,
  JSON.stringify(booking)
);
await redis.ltrim(`campus:${campusId}:recent_bookings`, 0, 99);
```

**Estimated Cost:** $20-$100/month (Redis Cloud, Upstash)

---

## 6. Materialized Views (Precomputed Aggregates)

### Campus Dashboard Statistics

```sql
-- Materialized view (refreshed hourly)
CREATE MATERIALIZED VIEW mv_campus_stats AS
SELECT 
  c.id as campus_id,
  c.name,
  COUNT(DISTINCT b.id) FILTER (WHERE b.is_active) as active_barbers,
  AVG(b.avg_rating) FILTER (WHERE b.total_reviews > 0) as avg_rating,
  COUNT(bk.id) FILTER (WHERE bk.created_at > NOW() - INTERVAL '7 days') as bookings_7d,
  SUM(bk.platform_fee_usd_cents) FILTER (
    WHERE bk.status = 'COMPLETED' AND bk.completed_at > NOW() - INTERVAL '7 days'
  ) as revenue_7d
FROM campuses c
LEFT JOIN barbers b ON c.id = b.campus_id
LEFT JOIN bookings bk ON b.id = bk.barber_id
GROUP BY c.id, c.name;

-- Refresh index
CREATE UNIQUE INDEX ON mv_campus_stats(campus_id);

-- Refresh policy (run via cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campus_stats;
```

**Refresh Strategy:**
```typescript
// Cron job (runs every hour)
@Cron('0 * * * *')
async refreshMaterializedViews() {
  await this.db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campus_stats');
  await this.db.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_barber_rankings');
}
```

---

## 7. Backup & Disaster Recovery

### Backup Strategy

**Daily Snapshots:**
```bash
# Automated via Supabase/Railway
# Or manual:
pg_dump \
  --format=custom \
  --compress=9 \
  --exclude-table=cron_history \
  --exclude-table=ai_events_log \
  campuscuts > backup_$(date +%Y%m%d).dump
```

**Point-in-Time Recovery (PITR):**
- Enable WAL archiving
- Retain WAL files for 7 days
- Restore to any point in last week

**Blockchain Reconstruction:**
Since PostgreSQL is a cache, you can rebuild from blockchain:

```typescript
async rebuildFromBlockchain(campusId: string) {
  // 1. Clear all tables
  await prisma.$transaction([
    prisma.review.deleteMany({ where: { /* campus filter */ } }),
    prisma.booking.deleteMany({ where: { /* campus filter */ } }),
    prisma.barber.deleteMany({ where: { campusId } }),
    // ...
  ]);
  
  // 2. Fetch from Aptos indexer
  const users = await aptosIndexer.getAllUsers(campusId);
  const bookings = await aptosIndexer.getAllBookings(campusId);
  const reviews = await aptosIndexer.getAllReviews(campusId);
  
  // 3. Reinsert into PostgreSQL
  await prisma.user.createMany({ data: users });
  await prisma.booking.createMany({ data: bookings });
  await prisma.review.createMany({ data: reviews });
  
  // 4. Recompute derived fields
  await this.recomputeAllBQS(campusId);
  await this.recomputeRankings(campusId);
}
```

---

## 8. Performance Monitoring

### Key Metrics to Track

**PostgreSQL:**
```sql
-- Slow queries (> 500ms)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 500
ORDER BY total_time DESC
LIMIT 20;

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey';

-- Table bloat
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Application Metrics:**
- Query latency (p50, p95, p99)
- Connection pool utilization
- Cache hit rate
- Booking throughput
- BQS computation time

**Tools:**
- **APM:** DataDog, New Relic, Sentry
- **PG Monitoring:** pgHero, PgAnalyze
- **Logs:** Structured logging with Winston/Pino

---

## 9. Cost Optimization

### Estimated Monthly Costs by Scale

| Users | Campuses | Barbers | Bookings/mo | DB Cost | Redis | Total |
|-------|----------|---------|-------------|---------|-------|-------|
| 1K    | 5        | 50      | 1K          | $0      | $0    | $0    |
| 10K   | 20       | 500     | 10K         | $25     | $10   | $35   |
| 50K   | 100      | 2,500   | 50K         | $100    | $30   | $130  |
| 100K  | 200      | 5,000   | 100K        | $300    | $50   | $350  |
| 500K  | 500      | 25,000  | 500K        | $1,500  | $200  | $1,700|

**Cost Reduction Strategies:**
1. **Aggressive TTL on cached data** (reduce DB queries)
2. **Partition old bookings** (archive completed bookings > 6 months)
3. **Compress JSONB fields** (AI annotations, rankings breakdown)
4. **Use read replicas** for analytics (cheaper than scaling primary)

---

## 10. Schema Evolution & Migrations

### Migration Strategy

**Blue-Green Migrations:**
```bash
# 1. Deploy new schema alongside old
CREATE TABLE bookings_v2 AS TABLE bookings;
ALTER TABLE bookings_v2 ADD COLUMN new_field;

# 2. Dual-write to both tables
# (Application writes to both)

# 3. Backfill old data
INSERT INTO bookings_v2 SELECT *, NULL FROM bookings;

# 4. Switch atomically
BEGIN;
ALTER TABLE bookings RENAME TO bookings_old;
ALTER TABLE bookings_v2 RENAME TO bookings;
COMMIT;

# 5. Drop old table after verification
DROP TABLE bookings_old;
```

**Backward-Compatible Changes Only:**
- ✅ Add nullable columns
- ✅ Add indexes
- ✅ Add new tables
- ❌ Drop columns (mark deprecated, drop later)
- ❌ Change column types (create new column, migrate)

---

## 11. Security Considerations

### Row-Level Security (RLS)

```sql
-- Enable RLS on sensitive tables
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Barbers can only see their own bookings
CREATE POLICY barbers_own_bookings ON bookings
  FOR SELECT
  USING (
    barber_id IN (
      SELECT id FROM barbers WHERE user_id = current_setting('app.user_id')::uuid
    )
  );

-- Policy: Consumers can only see their own bookings
CREATE POLICY consumers_own_bookings ON bookings
  FOR SELECT
  USING (consumer_id = current_setting('app.user_id')::uuid);

-- Policy: Admins can see all
CREATE POLICY admins_all_bookings ON bookings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = current_setting('app.user_id')::uuid 
      AND role = 'ADMIN'
    )
  );
```

**Application-Level Security:**
```typescript
// Set user context for RLS
async withUserContext<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.user_id = ${userId}`;
    return fn();
  });
}
```

### Encryption
- **At Rest:** Enable PostgreSQL TDE (Transparent Data Encryption)
- **In Transit:** Enforce SSL/TLS connections only
- **Application-Level:** Encrypt PII fields (phone numbers, addresses)

---

## 12. Future Considerations

### PostGIS Integration (Location-Based Features)
```sql
-- Add geospatial extension
CREATE EXTENSION postgis;

-- Add coordinates to locations
ALTER TABLE locations ADD COLUMN coordinates GEOGRAPHY(POINT);

-- Proximity-based search
SELECT 
  l.name,
  ST_Distance(
    l.coordinates, 
    ST_MakePoint(-120.6596, 35.3050)::geography  -- Consumer location
  ) / 1609.34 as distance_miles
FROM locations l
WHERE ST_DWithin(
  l.coordinates,
  ST_MakePoint(-120.6596, 35.3050)::geography,
  5 * 1609.34  -- 5 miles
)
ORDER BY distance_miles;
```

### TimescaleDB (Time-Series Data)
```sql
-- Convert bookings to hypertable for time-series optimization
SELECT create_hypertable('bookings', 'created_at', chunk_time_interval => INTERVAL '1 month');

-- Automatic data retention
SELECT add_retention_policy('bookings', INTERVAL '2 years');
```

---

## Summary

CampusCuts PostgreSQL architecture is designed for **horizontal scalability** and **graceful degradation**.

**Key Takeaways:**
1. Start simple (single DB)
2. Add read replicas at 10K+ users
3. Shard by campus at 100K+ users
4. Always prioritize blockchain as source of truth
5. PostgreSQL is disposable and rebuildable

**Next Steps:**
1. Implement Prisma schema
2. Run migrations
3. Load seed data
4. Deploy to Supabase/Railway
5. Monitor and optimize based on real traffic

