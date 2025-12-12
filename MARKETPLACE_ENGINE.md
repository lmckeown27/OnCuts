# Capitalistic Marketplace Engine - CampusCuts

## Overview

The Marketplace Engine is a comprehensive, fully capitalistic system that determines barber visibility, pricing power, and ranking based on measurable performance metrics. It implements dynamic pricing, market calibration, and surge detection to create a competitive, merit-based marketplace.

---

## System Architecture

### Core Components

1. **Barber Quality Score (BQS)** - Performance-based scoring system
2. **Dynamic Pricing Engine** - BQS-based price bounds enforcement
3. **Market Calibration** - City/school-specific tuning
4. **Ranking Algorithm** - Feed ordering for users
5. **Surge Pricing** - Demand-driven price multipliers
6. **Cron Jobs** - Automated nightly updates and monitoring
7. **Admin Controls** - Dashboard for system management

---

## 1. Barber Quality Score (BQS)

### Formula

```
BQS = 0.45 × R + 0.25 × D + 0.15 × P + 0.15 × L
```

### Components

#### R = ReviewScoreWeighted
- **Formula**: `avg_rating × log(1 + total_reviews)`
- **Purpose**: Rewards high ratings with volume validation
- **Normalization**: Scaled to 0-100 (max assumes 5★ × log(1000))

#### D = DemandScore
- **Formula**: `(slots_booked / slots_available) × 100`
- **Purpose**: Measures booking efficiency
- **Range**: 0-100

#### P = PriceJustificationScore
- **Formula**: `100 × (repeat_bookings_at_price / total_bookings_at_price)`
- **Purpose**: Validates pricing choices (do customers return?)
- **Range**: 0-100

#### L = LoyaltyScore
- **Formula**: `(repeat_customers / total_customers) × 100`
- **Purpose**: Measures customer retention
- **Range**: 0-100

### Implementation

**Service**: `backend/src/services/bqs-calculation.service.ts`

**Key Methods**:
- `calculateBQSForBarber(barberId)` - Compute BQS for a single barber
- `recomputeAllBQS()` - Nightly batch recomputation
- `updateBarberStats(barberId)` - Refresh stats after new bookings/reviews

**Database**:
- BQS stored in `barbers.bqs`
- Component scores stored separately (`review_score_weighted`, `demand_score`, `price_justification_score`, `loyalty_score`)
- Last updated timestamp: `barbers.bqs_last_updated`

---

## 2. Dynamic Pricing Engine

### Pricing Multipliers

Earned through BQS performance:

| BQS Range | Multiplier | Premium Access |
|-----------|------------|----------------|
| < 60      | 1.0×       | None           |
| 60-80     | 1.1×       | +10%           |
| 80-90     | 1.25×      | +25%           |
| 90-100    | 1.5×       | +50%           |

### Price Bounds

```
min_price = market.base_price
max_price = market.premium_price_ceiling × multiplier
```

**Server-side enforcement**: Barbers cannot set prices outside their allowed range.

### Example

**Market**: UCLA
- Base Price: $25
- Premium Ceiling: $75

**Barber A (BQS: 85)**
- Multiplier: 1.25×
- Allowed Range: $25 - $93.75

**Barber B (BQS: 55)**
- Multiplier: 1.0×
- Allowed Range: $25 - $75

### Implementation

**Service**: `backend/src/services/dynamic-pricing.service.ts`

**Key Methods**:
- `validatePrice(barberId, price)` - Check if price is within bounds
- `setBarberPrice(barberId, price)` - Update price with validation
- `updateBarberPricingBounds(barberId)` - Recalculate bounds after BQS change
- `updateAllPricingBounds()` - Nightly batch update

**API Endpoints**:
- `POST /api/marketplace/barbers/:id/update_price` - Set barber price
- `GET /api/marketplace/barbers/:id/pricing-info` - Get pricing details

---

## 3. Market Calibration

### Market Factors

Each market has configurable factors:

#### Demand Normalization Factor (0.8-1.3)
- Adjusts demand calculations for market size
- Small markets (SLO): 0.8
- Large markets (LA): 1.3

#### Review Weight Adjustment (0.9-1.2)
- Increases review importance in small markets
- Small markets (SLO): 1.2 (reviews matter more)
- Large markets (LA): 0.9 (reviews matter less)

#### Competition Intensity Score (0.7-1.5)
- Amplifies BQS differences in competitive markets
- Small markets (SLO): 0.7 (compressed scores)
- Large markets (LA): 1.5 (dramatic differences)

### Market Size Examples

#### Small Market: Cal Poly SLO
```json
{
  "base_price": 20.00,
  "average_price": 30.00,
  "premium_price_ceiling": 50.00,
  "demand_normalization_factor": 0.8,
  "review_weight_adjustment": 1.2,
  "competition_intensity_score": 0.7
}
```

#### Large Market: UCLA
```json
{
  "base_price": 25.00,
  "average_price": 40.00,
  "premium_price_ceiling": 75.00,
  "demand_normalization_factor": 1.3,
  "review_weight_adjustment": 0.9,
  "competition_intensity_score": 1.5
}
```

### Implementation

**Service**: `backend/src/services/market-calibration.service.ts`

**Key Methods**:
- `getMarketFactors(marketId)` - Retrieve factors
- `calibrateBQS(rawBQS, marketFactors)` - Apply calibration
- `updateMarketConfig(marketId, config)` - Admin control
- `updateMarketFactors(marketId, factors)` - Admin control

---

## 4. Ranking Algorithm

### Formula

```
RankScore = 0.5 × BQS + 0.3 × AvailabilityFit + 0.2 × Proximity
```

### Components

#### BQS (50% weight)
- Primary ranking factor
- Reflects overall barber quality

#### AvailabilityFit (30% weight)
- How many slots are available
- Normalized to 0-100 (max 40 slots/week)

#### Proximity (20% weight)
- Same campus: 100
- Different campus: 30
- No campus specified: 50

### Implementation

**Service**: `backend/src/services/ranking-algorithm.service.ts`

**Key Methods**:
- `getRankedBarbers(criteria)` - Get sorted barber list
- `saveRankingHistory(rankings)` - Track rankings over time
- `getBarberMarketRank(barberId)` - Get specific barber's rank

**API Endpoints**:
- `GET /api/marketplace/barbers/ranked?market_id=X&time=Y&zip=Z` - User feed

---

## 5. Surge Pricing

### Detection Logic

```
demand_supply_ratio = active_users_requesting / active_barbers_available
```

### Multipliers

| Ratio Range | Surge Multiplier | Impact |
|-------------|------------------|--------|
| ≤ 2.0       | 1.0×             | None   |
| 2.0-3.0     | 1.2×             | +20%   |
| 3.0-4.0     | 1.3×             | +30%   |
| ≥ 4.0       | 1.4×             | +40%   |

**Applied to**: `max_price` only (not `base_price`)

**Duration**: 30-minute windows

### Implementation

**Service**: `backend/src/services/surge-pricing.service.ts`

**Key Methods**:
- `detectSurge(marketId)` - Check current surge status
- `getCurrentSurgeMultiplier(marketId)` - Get active multiplier
- `checkAllMarketsSurge()` - Batch check (every 15 min)

**Database**: `surge_events` table tracks active surges

**API Endpoints**:
- `GET /api/marketplace/markets/:id/surge-status` - Current surge status

---

## 6. Cron Jobs

### Schedule

#### Nightly (2am)

**Sequence**:
1. `recompute_bqs()` - Recalculate all BQS scores
2. `update_prices()` - Update pricing bounds based on new BQS
3. `refresh_rankings()` - Save ranking history

**Duration**: ~5-10 seconds for 100 barbers

#### Every 15 Minutes

**Job**: `surge_detection()`
- Check demand/supply ratios
- Create surge events if triggered
- End expired surges

### Implementation

**Service**: `backend/src/services/marketplace-cron.service.ts`

**Key Features**:
- Logs all executions to `cron_history` table
- Manual triggers available via API
- Error isolation (failed jobs don't crash server)

**API Endpoints**:
- `POST /api/marketplace/cron/recompute_bqs` - Manual trigger
- `POST /api/marketplace/cron/update_prices` - Manual trigger
- `POST /api/marketplace/cron/refresh_rankings` - Manual trigger
- `POST /api/marketplace/cron/surge_detection` - Manual trigger
- `GET /api/marketplace/admin/cron-history` - View execution log

### Starting Cron Jobs

Automatically started on server boot in `backend/src/index.ts`:

```typescript
marketplaceCronService.startAllJobs();
```

---

## 7. Admin Controls

### Dashboard

**Route**: `/admin/marketplace`

**Features**:
- View all markets with active barber counts
- Edit market pricing configs (base, average, premium ceiling)
- Adjust market factors (demand, review weight, competition)
- Manually trigger cron jobs
- View cron execution history
- Real-time status monitoring

### API Endpoints

#### Market Management
- `GET /api/marketplace/admin/markets` - List all markets
- `POST /api/marketplace/admin/markets/update` - Update market config/factors

#### Monitoring
- `GET /api/marketplace/admin/cron-history?limit=N` - View job history

#### Manual Controls
- `POST /api/marketplace/cron/recompute_bqs`
- `POST /api/marketplace/cron/update_prices`
- `POST /api/marketplace/cron/refresh_rankings`
- `POST /api/marketplace/cron/surge_detection`

---

## Database Schema

### New Tables

#### `markets`
```sql
- market_id (UUID PK)
- name, city, state
- base_price, average_price, premium_price_ceiling
```

#### `market_factors`
```sql
- market_id (UUID FK)
- demand_normalization_factor
- review_weight_adjustment
- competition_intensity_score
```

#### `barber_rank_history`
```sql
- barber_id (UUID FK)
- bqs, rank_score, market_rank
- timestamp
```

#### `surge_events`
```sql
- market_id (UUID FK)
- time_block
- demand_supply_ratio
- surge_multiplier
- is_active
```

#### `cron_history`
```sql
- job_name
- executed_at
- status (success/failed/running)
- duration_ms
- records_processed
```

### Extended Tables

#### `barbers` (new columns)
```sql
- market_id (UUID FK)
- bqs, bqs_last_updated
- review_score_weighted
- demand_score
- price_justification_score
- loyalty_score
- pricing_multiplier
- min_allowed_price, max_allowed_price
- slots_available_weekly, slots_booked_weekly
- repeat_customers, total_customers
```

#### `bookings` (new columns)
```sql
- price_charged
- completed
- is_repeat_customer
```

---

## Running the System

### 1. Database Migration

```bash
cd backend
# Run the migration
psql $DATABASE_URL -f migrations/004_capitalistic_marketplace.sql
```

### 2. Seed Markets

The migration automatically creates 5 markets:
- Cal Poly SLO
- UCSB
- UCLA
- USC
- UC Berkeley

### 3. Assign Barbers to Markets

```sql
UPDATE barbers SET market_id = '11111111-1111-1111-1111-111111111111' WHERE ...;
```

### 4. Start Server

```bash
npm run dev
```

Cron jobs start automatically.

### 5. Access Admin Dashboard

Navigate to: `http://localhost:3000/admin/marketplace`

---

## API Usage Examples

### Get Ranked Barbers (User Feed)

```bash
curl "http://localhost:3001/api/marketplace/barbers/ranked?market_id=11111111-1111-1111-1111-111111111111"
```

**Response**:
```json
{
  "marketId": "11111111-1111-1111-1111-111111111111",
  "count": 15,
  "barbers": [
    {
      "barberId": "...",
      "name": "John Doe",
      "bqs": 87.5,
      "rankScore": 85.3,
      "currentPrice": 35.00,
      "avgRating": 4.8,
      "reviewCount": 127
    }
  ]
}
```

### Update Barber Price

```bash
curl -X POST http://localhost:3001/api/marketplace/barbers/abc-123/update_price \
  -H "Content-Type: application/json" \
  -d '{"price": 45.00}'
```

**Response** (if price is valid):
```json
{
  "success": true,
  "message": "Price updated successfully",
  "price": 45.00
}
```

**Response** (if price exceeds bounds):
```json
{
  "error": "Price $85.00 exceeds maximum allowed price of $75.00 (BQS-based limit)",
  "bounds": {
    "minPrice": 25.00,
    "maxPrice": 75.00,
    "multiplier": 1.0
  }
}
```

### Get Barber BQS Breakdown

```bash
curl http://localhost:3001/api/marketplace/barbers/abc-123/bqs
```

**Response**:
```json
{
  "barberId": "abc-123",
  "bqs": 87.5,
  "reviewScoreWeighted": 92.3,
  "demandScore": 85.0,
  "priceJustificationScore": 78.5,
  "loyaltyScore": 88.2
}
```

### Trigger Manual BQS Recomputation

```bash
curl -X POST http://localhost:3001/api/marketplace/cron/recompute_bqs
```

### Update Market Config (Admin)

```bash
curl -X POST http://localhost:3001/api/marketplace/admin/markets/update \
  -H "Content-Type: application/json" \
  -d '{
    "market_id": "11111111-1111-1111-1111-111111111111",
    "config": {
      "basePrice": 22.00,
      "premiumPriceCeiling": 55.00
    },
    "factors": {
      "competitionIntensityScore": 0.8
    }
  }'
```

---

## Testing

### 1. Assign Test Barber to Market

```sql
UPDATE barbers 
SET market_id = '11111111-1111-1111-1111-111111111111',
    slots_available_weekly = 20
WHERE barber_id = 'test-barber-id';
```

### 2. Create Test Reviews

```sql
INSERT INTO reviews (barber_id, user_id, rating, timestamp)
VALUES 
  ('test-barber-id', 'user-1', 5, NOW()),
  ('test-barber-id', 'user-2', 5, NOW()),
  ('test-barber-id', 'user-3', 4, NOW());
```

### 3. Create Test Bookings

```sql
INSERT INTO bookings (barber_id, user_id, price_charged, completed, is_repeat_customer)
VALUES
  ('test-barber-id', 'user-1', 30.00, true, false),
  ('test-barber-id', 'user-1', 32.00, true, true),
  ('test-barber-id', 'user-2', 30.00, true, false);
```

### 4. Update Stats

```bash
curl -X POST http://localhost:3001/api/marketplace/cron/recompute_bqs
```

### 5. Check BQS

```bash
curl http://localhost:3001/api/marketplace/barbers/test-barber-id/bqs
```

---

## Monitoring

### Cron History

View recent job executions:

```bash
curl http://localhost:3001/api/marketplace/admin/cron-history?limit=20
```

### Barber Market Rank

Check a barber's position in their market:

```bash
curl http://localhost:3001/api/marketplace/barbers/abc-123/market-rank
```

**Response**:
```json
{
  "rank": 5,
  "totalBarbers": 20,
  "percentile": 80
}
```

### Surge Status

Check if surge pricing is active:

```bash
curl http://localhost:3001/api/marketplace/markets/abc-123/surge-status
```

**Response**:
```json
{
  "marketId": "abc-123",
  "isActive": true,
  "surgeMultiplier": 1.3,
  "demandSupplyRatio": 3.5,
  "activeUsersRequesting": 35,
  "activeBarbersAvailable": 10
}
```

---

## Configuration

### Environment Variables

No additional variables required. Uses existing:
- `DATABASE_URL` - PostgreSQL connection
- `NODE_ENV` - Environment mode

### Cron Schedule Customization

Edit `backend/src/services/marketplace-cron.service.ts`:

```typescript
// Current: 2am daily
const nightlyJob = cron.schedule('0 2 * * *', async () => { ... });

// Change to 3am:
const nightlyJob = cron.schedule('0 3 * * *', async () => { ... });

// Current: Every 15 minutes
const surgeJob = cron.schedule('*/15 * * * *', async () => { ... });

// Change to every 10 minutes:
const surgeJob = cron.schedule('*/10 * * * *', async () => { ... });
```

---

## Troubleshooting

### BQS Not Updating

**Check**:
1. Barber has `market_id` assigned
2. Stats are populated (`review_count`, `avg_rating`, etc.)
3. Cron job ran successfully (check `cron_history`)

**Fix**:
```bash
# Manual trigger
curl -X POST http://localhost:3001/api/marketplace/cron/recompute_bqs

# Check history
curl http://localhost:3001/api/marketplace/admin/cron-history?limit=5
```

### Pricing Validation Failing

**Check**:
1. Barber's BQS is calculated
2. Pricing bounds are set (`min_allowed_price`, `max_allowed_price`)

**Fix**:
```bash
# Trigger pricing update
curl -X POST http://localhost:3001/api/marketplace/cron/update_prices
```

### Rankings Not Appearing

**Check**:
1. Barbers have `bqs > 0`
2. Barbers are in the requested `market_id`
3. Barbers are `is_active = true`

**Fix**:
```sql
SELECT barber_id, name, bqs, is_active, market_id 
FROM barbers 
WHERE market_id = 'target-market-id';
```

---

## Future Enhancements

### Potential Additions

1. **Time-of-Day Multipliers** - Peak hours (6pm-9pm) get 1.1-1.2× pricing
2. **Seasonal Adjustments** - Higher prices before prom, homecoming, etc.
3. **Barber Promotions** - Temporary price reductions to boost demand
4. **A/B Price Testing** - Automated experimentation with pricing
5. **Machine Learning BQS** - Predict future BQS from trends
6. **Regional Competition Mapping** - Cross-market barber migration suggestions
7. **Customer Lifetime Value** - Weight repeat customers more in BQS
8. **Booking Velocity Score** - Reward barbers who fill slots quickly

---

## Support

For issues or questions:
- Review cron history: `/api/marketplace/admin/cron-history`
- Check barber BQS: `/api/marketplace/barbers/:id/bqs`
- View pricing bounds: `/api/marketplace/barbers/:id/pricing-info`
- Admin dashboard: `/admin/marketplace`

---

## Summary

The Marketplace Engine is a **fully implemented, production-ready** capitalistic system that:

✅ Computes performance-based BQS scores  
✅ Enforces dynamic pricing bounds  
✅ Calibrates for market size differences  
✅ Ranks barbers algorithmically  
✅ Detects and applies surge pricing  
✅ Runs automated cron jobs  
✅ Provides comprehensive admin controls  

**All code is deterministic, server-side enforced, and impossible for users to manipulate locally.**

**The system is now live and operational.**

