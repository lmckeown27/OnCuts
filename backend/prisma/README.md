# CampusCuts PostgreSQL Database Layer

**Production-Ready Database Architecture for Decentralized Marketplace**

This directory contains the complete PostgreSQL schema, migrations, seed data, and scaling strategy for CampusCuts.

---

## 📁 Directory Structure

```
prisma/
├── schema.prisma                    # Prisma ORM schema (single source of truth)
├── migrations/
│   ├── 001_init_core_schema.sql    # Core tables, indexes, triggers
│   └── 002_reputation_and_intelligence.sql  # Reputation, AI, admin tables
├── seed.sql                         # Example data (Cal Poly SLO campus)
├── example_queries.sql              # Production-ready query patterns
├── SCALING_NOTES.md                 # Horizontal scaling strategy
└── README.md                        # This file
```

---

## 🚀 Quick Start

### 1. Prerequisites

- **PostgreSQL 15+** (local or cloud)
- **Node.js 18+** & npm/yarn
- **Prisma CLI**: `npm install -g prisma`

### 2. Setup Local Database

```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb campuscuts

# Set environment variable
echo "DATABASE_URL=postgresql://localhost:5432/campuscuts" >> backend/.env
```

### 3. Run Migrations

```bash
cd backend

# Apply SQL migrations manually
psql campuscuts < prisma/migrations/001_init_core_schema.sql
psql campuscuts < prisma/migrations/002_reputation_and_intelligence.sql

# OR use Prisma Migrate (introspect existing schema)
npx prisma db pull
npx prisma generate
```

### 4. Load Seed Data

```bash
psql campuscuts < prisma/seed.sql
```

### 5. Verify Setup

```bash
# Check tables
psql campuscuts -c "\dt"

# Check barbers
psql campuscuts -c "SELECT display_name, bqs_score FROM barbers b JOIN users u ON b.user_id = u.id;"

# Start backend
cd backend
npm run dev
```

---

## 🏗️ Architecture Overview

### Core Principles

1. **PostgreSQL = Coordination Layer** (NOT source of truth)
2. **Blockchain = Source of Truth** (payments, reputation)
3. **Database is Disposable** (can rebuild from blockchain)
4. **Wallet-First Identity** (no passwords, Aptos addresses)
5. **Campus-Scoped** (multi-tenancy, not global)

### Entity Relationship Diagram

```
┌─────────┐
│ Campus  │──┬─────────────┐
└─────────┘  │             │
             │             ▼
             │      ┌──────────┐
             │      │  User    │
             │      └────┬─────┘
             │           │
             │           ▼
             │      ┌──────────┐
             ├─────▶│  Barber  │◀────┐
             │      └─────┬────┘     │
             │            │          │
             │            ▼          │
             │      ┌────────────┐   │
             ├─────▶│ Location   │   │
             │      └──────┬─────┘   │
             │             │         │
             │             ▼         │
             │      ┌────────────┐   │
             │      │Availability│   │
             │      └──────┬─────┘   │
             │             │         │
             │             ▼         │
             │      ┌──────────┐     │
             └─────▶│ Booking  │─────┘
                    └─────┬────┘
                          │
                          ▼
                    ┌──────────┐
                    │  Review  │
                    └──────────┘
```

### Key Tables

| Table | Purpose | Source of Truth |
|-------|---------|----------------|
| `campuses` | Market configuration | Postgres |
| `users` | Wallet-first identity | Aptos + Postgres |
| `barbers` | Barber profiles + cached reputation | Aptos (authoritative) |
| `locations` | Crowd-sourced, AI-enriched locations | Postgres |
| `availability` | Barber time slots | Postgres |
| `bookings` | Service bookings | Aptos (txn hash anchored) |
| `reviews` | Ratings & comments | Aptos + Postgres |
| `barber_rankings` | Capitalistic rankings | Computed |
| `ai_annotations` | AI enrichment (advisory) | Postgres |

---

## 🎯 Core Features Implemented

### 1. Location Ingestion System
- ✅ Crowd-sourced location submissions
- ✅ AI normalization (GPT-4 Turbo)
- ✅ Fuzzy matching with trigrams
- ✅ Automatic alias creation
- ✅ Confidence scoring
- ✅ Usage-based promotion
- ✅ No hardcoded campus locations

### 2. Capitalistic Marketplace Engine
- ✅ Barber Quality Score (BQS) formula
- ✅ Dynamic pricing multipliers (1.0x - 1.5x)
- ✅ Market-size calibration
- ✅ Ranking algorithm (0.5*BQS + 0.3*Availability + 0.2*Proximity)
- ✅ Surge pricing detection
- ✅ Nightly recomputation cron jobs

### 3. Reputation System
- ✅ Blockchain-derived reputation caching
- ✅ Historical snapshots
- ✅ Component breakdown (reviews, demand, price justification, loyalty)
- ✅ Automated recalculation

### 4. AI Intelligence Layer
- ✅ Polymorphic AI annotations
- ✅ Location normalization
- ✅ Sentiment analysis
- ✅ Fraud detection
- ✅ Dispute resolution assistance
- ✅ Non-authoritative (advisory only)

### 5. Admin & Moderation
- ✅ User blocking/banning
- ✅ Internal notes
- ✅ Fraud flag system
- ✅ Dispute management
- ✅ Market statistics

---

## 📊 Sample Queries

### Fetch Ranked Barbers for Discovery Feed

```sql
SELECT 
  b.id,
  u.display_name,
  b.avg_rating,
  b.bqs_score,
  b.current_min_price_usd_cents,
  b.current_max_price_usd_cents,
  br.rank_score
FROM barbers b
INNER JOIN users u ON b.user_id = u.id
LEFT JOIN barber_rankings br ON b.id = br.barber_id
WHERE 
  b.campus_id = $1
  AND b.is_active = true
ORDER BY br.rank_score DESC NULLS LAST
LIMIT 20;
```

### Resolve Location with Fuzzy Matching

```sql
SELECT * FROM resolve_location(
  '00000000-0000-0000-0000-000000000001',  -- campus_id
  'yak hall'                                 -- user input
);
```

### Lock Availability Slot (Atomic)

```sql
UPDATE availability
SET 
  status = 'LOCKED',
  locked_at = NOW(),
  locked_by = $1,
  lock_expires_at = NOW() + INTERVAL '10 minutes'
WHERE 
  id = $2
  AND status = 'OPEN'
RETURNING *;
```

**More examples:** See `example_queries.sql`

---

## 🔒 Security Model

### Row-Level Security (RLS)

```sql
-- Barbers can only see their own bookings
CREATE POLICY barbers_own_bookings ON bookings
  FOR SELECT
  USING (
    barber_id IN (
      SELECT id FROM barbers WHERE user_id = current_setting('app.user_id')::uuid
    )
  );
```

### Application-Level Guards

```typescript
// NestJS guard example
@Injectable()
export class BarberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Only barbers can access this route
    return user && user.role === 'BARBER';
  }
}
```

### Data Encryption
- **At Rest:** TDE (Transparent Data Encryption)
- **In Transit:** SSL/TLS only
- **Application:** Encrypt PII fields

---

## 📈 Performance & Scaling

### Current Capacity (Single DB)
- **Campuses:** 10-20
- **Barbers:** 500-1,000
- **Bookings:** 10K-50K/month
- **Response Time:** < 100ms (p95)

### Scaling Milestones

| Users | Strategy | Estimated Cost |
|-------|----------|----------------|
| < 10K | Single PostgreSQL | $0-$50/mo |
| 10K-100K | Read Replicas + Redis | $100-$300/mo |
| 100K-500K | Campus Sharding | $500-$2K/mo |
| 500K+ | Geographic Sharding + CDN | $2K-$10K/mo |

**See:** `SCALING_NOTES.md` for detailed strategies

### Critical Indexes

```sql
-- Barber discovery (hot path)
CREATE INDEX idx_barbers_campus_active ON barbers(campus_id, is_active)
  WHERE is_active = true;

-- Location fuzzy matching
CREATE INDEX idx_locations_normalized_trgm ON locations 
  USING gin(normalized_name gin_trgm_ops);

-- Availability locking
CREATE INDEX idx_availability_lock ON availability(locked_by, lock_expires_at) 
  WHERE locked_by IS NOT NULL;
```

---

## 🧪 Testing

### Load Seed Data for Testing

```bash
psql campuscuts < prisma/seed.sql
```

**Includes:**
- 1 campus (Cal Poly SLO)
- 4 barbers (various BQS scores)
- 8 locations (with aliases)
- 10+ availability slots
- 1 completed booking with review
- AI annotations examples

### Run Example Queries

```bash
# Test barber rankings
psql campuscuts -f prisma/example_queries.sql

# Test location resolution
psql campuscuts -c "SELECT * FROM resolve_location('00000000-0000-0000-0000-000000000001', 'yak');"
```

---

## 🔄 Blockchain Sync

### Rebuild from Blockchain

```typescript
async rebuildFromBlockchain(campusId: string) {
  // 1. Clear PostgreSQL cache
  await prisma.booking.deleteMany({ where: { /* campus */ } });
  await prisma.review.deleteMany({ where: { /* campus */ } });
  
  // 2. Fetch from Aptos indexer
  const bookings = await aptosIndexer.getAllBookings(campusId);
  const reviews = await aptosIndexer.getAllReviews(campusId);
  
  // 3. Re-insert into Postgres
  await prisma.booking.createMany({ data: bookings });
  await prisma.review.createMany({ data: reviews });
  
  // 4. Recompute derived fields
  await this.recomputeAllBQS(campusId);
}
```

### Hourly Sync Cron Job

```typescript
@Cron('0 * * * *')  // Every hour
async syncFromBlockchain() {
  const lastSync = await this.getLastSyncTime();
  const newEvents = await aptosIndexer.getEventsSince(lastSync);
  
  for (const event of newEvents) {
    await this.processBlockchainEvent(event);
  }
  
  await this.updateLastSyncTime(Date.now());
}
```

---

## 🛠️ Maintenance Tasks

### Daily Tasks

```bash
# Cleanup expired availability locks
psql campuscuts -c "SELECT cleanup_expired_locks();"

# Refresh materialized views
psql campuscuts -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campus_stats;"
```

### Weekly Tasks

```bash
# Recompute all BQS scores
npm run cron:recompute-bqs

# Archive old bookings (> 6 months)
npm run maintenance:archive-bookings
```

### Monthly Tasks

```bash
# Database vacuum
psql campuscuts -c "VACUUM ANALYZE;"

# Reindex critical tables
psql campuscuts -c "REINDEX TABLE bookings;"
psql campuscuts -c "REINDEX TABLE barbers;"
```

---

## 📚 Additional Resources

- **Prisma Docs:** https://www.prisma.io/docs
- **PostgreSQL Performance:** https://www.postgresql.org/docs/current/performance-tips.html
- **Aptos Indexer:** https://aptos.dev/indexer
- **BullMQ (Cron Jobs):** https://docs.bullmq.io

---

## 🤝 Contributing

### Schema Changes

1. Update `schema.prisma`
2. Generate migration: `npx prisma migrate dev --name your_change`
3. Test with seed data
4. Update `example_queries.sql`
5. Document in this README

### Adding New Campus

```sql
INSERT INTO campuses (slug, name, city, state, timezone)
VALUES ('stanford', 'Stanford University', 'Palo Alto', 'CA', 'America/Los_Angeles');

-- Add market factors
INSERT INTO market_factors (campus_id, demand_normalization_factor, competition_intensity_score)
VALUES ((SELECT id FROM campuses WHERE slug = 'stanford'), 1.20, 0.95);
```

---

## 📝 License

Proprietary - CampusCuts Platform

---

## 💬 Support

For questions or issues:
- Backend Team: `backend@campuscuts.com`
- Database Team: `dba@campuscuts.com`

---

**Built with ❤️ for the CampusCuts community**

