# Dynamic Pricing Engine - Implementation Roadmap

## 📋 **Overview**

This document outlines the complete implementation plan for CampusCuts' **market-aware dynamic pricing engine** that automatically adjusts barber prices based on:
- Individual performance scores (quality, reliability, demand)
- Market size normalization (MSI)
- Supply/demand dynamics (MDI)

---

## 🎯 **Goals**

1. **Fair pricing** that rewards high-performing barbers
2. **Market normalization** so barbers across different campus sizes compete fairly
3. **Transparency** - barbers understand why their prices change
4. **Shock protection** - prices don't change too rapidly
5. **New barber support** - new barbers start at base price

---

## 📊 **Current Status**

### ✅ **COMPLETED**
- [x] Database schema design (schema-dynamic-pricing.sql)
- [x] 8 new tables created
- [x] Helper functions & views
- [x] Triggers for timestamps
- [x] Audit logging setup

### 🚧 **IN PROGRESS**
- [ ] Phase 2: Metrics Collection & Scoring Engine
- [ ] Phase 3: Price Calculation Service
- [ ] Phase 4: APIs & Cron Jobs
- [ ] Phase 5: Frontend Dashboards
- [ ] Phase 6: Monitoring & Simulation

---

## 🗂️ **Database Schema (COMPLETED)**

### **Tables Created:**

1. **pricing_config** - Centralized configuration
   - Weights for quality/reliability/demand
   - Price multiplier bounds
   - Smoothing parameters
   - New barber policies
   - Shock protection settings

2. **campus_market_metrics** - Market-level data
   - MSI (Market Size Index)
   - MDI (Market Demand Index)
   - Active barber counts
   - Bookings per barber

3. **services** - Service catalog & base prices
   - Default prices per service type
   - Price bounds (min/max)

4. **barber_metrics** - Raw aggregated data
   - Daily booking counts
   - Ratings, repeat rates
   - On-time percentage
   - No-show/cancel rates

5. **barber_scores** - Computed performance
   - Quality score (0-100)
   - Reliability score (0-100)
   - Demand score (0-100)
   - Performance score (weighted)
   - Effective score (market-adjusted)

6. **barber_prices** - Final prices
   - Price per barber per service
   - Breakdown JSON for transparency
   - Previous price tracking
   - Shock cap indicators

7. **price_recompute_log** - Job tracking
   - When/who triggered recompute
   - How many barbers processed
   - Errors and performance metrics

8. **price_anomalies** - Monitoring
   - Large price changes
   - Shock cap hits
   - Low data quality warnings

### **Key Features:**
- ✅ Constraint checks (weights sum to 1.0, price bounds valid)
- ✅ Indexes for query performance
- ✅ JSONB fields for flexible breakdowns
- ✅ Audit trails for config changes
- ✅ Helper functions for common operations
- ✅ Views for reporting

---

## 📐 **Phase 2: Metrics Collection & Scoring**

### **Components to Build:**

#### 2.1 **Metrics Aggregation Service**
```typescript
// backend/src/services/pricing/metrics-aggregator.service.ts
class MetricsAggregatorService {
  // Aggregate raw booking data into barber_metrics
  async aggregateBarberMetrics(barberId: string, startDate: Date, endDate: Date)
  
  // Calculate for all barbers (daily cron)
  async aggregateDailyMetricsForAllBarbers()
  
  // Quality metrics
  private calculateAverageRating(barberId: string, period: DateRange)
  private calculateRepeatRate(barberId: string, period: DateRange)
  
  // Reliability metrics
  private calculateOnTimePct(barberId: string, period: DateRange)
  private calculateNoShowPct(barberId: string, period: DateRange)
  private calculateCanceledPct(barberId: string, period: DateRange)
}
```

#### 2.2 **Scoring Engine Service**
```typescript
// backend/src/services/pricing/scoring-engine.service.ts
class ScoringEngineService {
  // Individual scores (0-100)
  calculateQualityScore(metrics: BarberMetric): number
  calculateReliabilityScore(metrics: BarberMetric): number
  calculateDemandScore(metrics: BarberMetric, campusId: string): number
  
  // Weighted performance score
  calculatePerformanceScore(quality: number, reliability: number, demand: number): number
  
  // Market-adjusted score
  calculateEffectiveScore(performanceScore: number, msi: number): number
  
  // Handle new barbers
  applyNewBarberPolicy(score: number, barberId: string): number
}
```

#### 2.3 **Market Metrics Service**
```typescript
// backend/src/services/pricing/market-metrics.service.ts
class MarketMetricsService {
  // Calculate MSI (Market Size Index) for campus
  calculateMSI(campusId: string): Promise<number>
  
  // Calculate MDI (Market Demand Index) for campus
  calculateMDI(campusId: string): Promise<number>
  
  // Smooth with exponential moving average
  private applyEMASmoothing(current: number, previous: number, alpha: number): number
  
  // Update all campuses
  async updateAllCampusMetrics()
}
```

**Deliverables:**
- [ ] metrics-aggregator.service.ts
- [ ] scoring-engine.service.ts
- [ ] market-metrics.service.ts
- [ ] Unit tests for each service
- [ ] Integration test with sample data

**Acceptance Criteria:**
- Metrics aggregate correctly from bookings
- Scores are in 0-100 range
- Weights from config are applied
- New barbers get base score
- MSI/MDI smooth over time

---

## 💰 **Phase 3: Price Calculation**

### **Components to Build:**

#### 3.1 **Price Calculator Service**
```typescript
// backend/src/services/pricing/price-calculator.service.ts
class PriceCalculatorService {
  // Main pricing formula
  calculateFinalPrice(
    barber: Barber,
    service: Service,
    effectiveScore: number,
    mdi: number,
    campus: Campus
  ): PriceResult
  
  // Components
  private calculateBasePrice(service: Service, campus: Campus): number
  private calculatePriceMultiplier(effectiveScore: number): number
  private calculateMarketAdjustment(mdi: number): number
  
  // Bounds & protection
  private clampToMinMax(price: number, min: number, max: number): number
  private applyShockProtection(
    newPrice: number, 
    oldPrice: number, 
    maxChangePct: number
  ): PriceResult
  
  // Transparency
  private buildPriceBreakdown(components: PriceComponents): PriceBreakdown
}
```

**Deliverables:**
- [ ] price-calculator.service.ts
- [ ] Price formula unit tests
- [ ] Shock protection tests
- [ ] Clamping tests
- [ ] Breakdown generation tests

**Acceptance Criteria:**
- Prices stay within min/max bounds
- Shock protection caps daily changes
- Breakdown JSON is complete
- New barbers get base price
- Math uses precise decimal.js

---

## 🔄 **Phase 4: Orchestration & APIs**

### **Components to Build:**

#### 4.1 **Pricing Orchestrator**
```typescript
// backend/src/services/pricing/pricing-orchestrator.service.ts
class PricingOrchestratorService {
  // Full recompute pipeline
  async recomputeAll(options: RecomputeOptions): Promise<RecomputeResult>
  
  // Single barber
  async recomputeBarber(barberId: string): Promise<void>
  
  // Single campus
  async recomputeCampus(campusId: string): Promise<void>
  
  // Pipeline steps
  private async step1_aggregateMetrics()
  private async step2_updateMarketMetrics()
  private async step3_computeScores()
  private async step4_calculatePrices()
  private async step5_detectAnomalies()
  private async step6_logResults()
}
```

#### 4.2 **Cron Job Service**
```typescript
// backend/src/services/pricing/pricing-cron.service.ts
class PricingCronService {
  // Daily recompute (configurable schedule)
  @Cron('0 2 * * *') // 2 AM daily
  async dailyPriceRecompute()
  
  // Hourly metrics aggregation
  @Cron('0 * * * *')
  async hourlyMetricsAggregation()
  
  // Weekly market metrics update
  @Cron('0 3 * * 0') // 3 AM Sunday
  async weeklyMarketUpdate()
}
```

#### 4.3 **REST APIs**
```typescript
// backend/src/controllers/pricing.controller.ts
class PricingController {
  // GET /api/pricing/estimate?barberId=&serviceId=
  async getPriceEstimate(req, res)
  
  // GET /api/pricing/barber/:barberId/score
  async getBarberScore(req, res)
  
  // GET /api/pricing/barber/:barberId/history
  async getBarberPriceHistory(req, res)
  
  // GET /api/pricing/campus/:campusId/metrics
  async getCampusMetrics(req, res) // Admin only
  
  // POST /api/pricing/recompute
  async triggerRecompute(req, res) // Admin only
  
  // GET /api/pricing/anomalies
  async getAnomalies(req, res) // Admin only
  
  // GET /api/pricing/config
  async getConfig(req, res)
  
  // PUT /api/pricing/config
  async updateConfig(req, res) // Admin only
}
```

**Deliverables:**
- [ ] pricing-orchestrator.service.ts
- [ ] pricing-cron.service.ts
- [ ] pricing.controller.ts
- [ ] pricing.routes.ts
- [ ] API integration tests
- [ ] OpenAPI/Swagger spec

**Acceptance Criteria:**
- Cron runs on schedule
- APIs return correct data
- Admin-only endpoints protected
- Recompute is idempotent
- Errors are logged

---

## 🎨 **Phase 5: Frontend Dashboards**

### **Components to Build:**

#### 5.1 **Barber Dashboard**
```typescript
// web-app/src/components/pricing/BarberPricingDashboard.tsx
export function BarberPricingDashboard({ barberId }) {
  // Current performance score
  // Price breakdown per service
  // Score history chart (30 days)
  // Price history chart (30 days)
  // "How to improve" actionable tips
  // Comparison to campus average
}
```

**Features:**
- Performance score gauge (0-100)
- Quality/Reliability/Demand breakdown
- Price per service with trend arrows
- Historical charts (Recharts or Chart.js)
- Actionable tips based on weakest metric
- MSI/MDI explanation tooltips

#### 5.2 **Admin Campus Dashboard**
```typescript
// web-app/src/pages/admin/CampusPricingDashboard.tsx
export function CampusPricingDashboard({ campusId }) {
  // MSI & MDI display
  // Barber score distribution histogram
  // Top/bottom performers table
  // Price change summary
  // Anomalies list
  // Config editor
  // Trigger recompute button
}
```

**Features:**
- Campus health metrics
- Barber leaderboard
- Score distribution chart
- Anomaly alerts
- Config form with validation
- Recompute button with confirmation
- Job status display

#### 5.3 **Consumer Price Tooltip**
```typescript
// web-app/src/components/BarberCard.tsx
<BarberCard barber={barber}>
  <div className="price">
    ${price}
    <InfoIcon onClick={showBreakdown} />
  </div>
</BarberCard>

// Modal/tooltip showing:
// - Performance score
// - Market factors
// - "This barber has high ratings and reliability"
```

**Deliverables:**
- [ ] BarberPricingDashboard.tsx
- [ ] CampusPricingDashboard.tsx
- [ ] PriceBreakdownTooltip.tsx
- [ ] ScoreHistoryChart.tsx
- [ ] PriceHistoryChart.tsx
- [ ] pricing.service.ts (frontend)
- [ ] Component tests

**Acceptance Criteria:**
- Barber sees current price & score
- Charts render correctly
- Admin can update config
- Recompute triggers successfully
- Tooltips explain pricing

---

## 📈 **Phase 6: Monitoring & Simulation**

### **Components to Build:**

#### 6.1 **Metrics & Monitoring**
```typescript
// backend/src/services/pricing/pricing-metrics.service.ts
class PricingMetricsService {
  // Prometheus metrics
  private priceRecomputeCounter: Counter
  private averagePerformanceScoreGauge: Gauge
  private priceAnomaliesCounter: Counter
  private msiGauge: Gauge
  private mdiGauge: Gauge
  
  // Emit metrics
  recordRecompute(result: RecomputeResult)
  recordAnomaly(anomaly: PriceAnomaly)
  updateCampusMetrics(campus: Campus)
}
```

#### 6.2 **Simulation Script**
```typescript
// scripts/simulate-pricing.ts
async function simulateMarket() {
  // Generate N barbers across 3 campuses
  // Assign random performance metrics
  // Run pricing engine
  // Output CSV with results
  // Generate charts
}

// Usage: npm run simulate:pricing -- --barbers=100 --days=30
```

#### 6.3 **Testing Suite**
```typescript
// Unit tests
- metrics-aggregator.spec.ts
- scoring-engine.spec.ts
- market-metrics.spec.ts
- price-calculator.spec.ts

// Integration tests
- pricing-pipeline.spec.ts
- pricing-apis.spec.ts

// Simulation tests
- sample-data.seed.ts
- pricing-simulation.spec.ts
```

**Deliverables:**
- [ ] pricing-metrics.service.ts
- [ ] Prometheus metrics endpoint
- [ ] Grafana dashboard config
- [ ] simulate-pricing.ts script
- [ ] Sample data generators
- [ ] Complete test suite
- [ ] Performance benchmarks

**Acceptance Criteria:**
- Metrics exported at /metrics
- Grafana dashboard displays data
- Simulation runs successfully
- All tests pass
- Performance acceptable (<5s for full recompute)

---

## 🗓️ **Implementation Timeline**

### **Week 1: Foundation**
- ✅ Database schema (DONE)
- [ ] Metrics aggregator
- [ ] Scoring engine
- [ ] Unit tests

### **Week 2: Pricing Core**
- [ ] Market metrics service
- [ ] Price calculator
- [ ] Shock protection
- [ ] Integration tests

### **Week 3: Orchestration**
- [ ] Pricing orchestrator
- [ ] Cron jobs
- [ ] REST APIs
- [ ] OpenAPI spec

### **Week 4: Frontend**
- [ ] Barber dashboard
- [ ] Admin dashboard
- [ ] Price tooltips
- [ ] Component tests

### **Week 5: Polish & Deploy**
- [ ] Monitoring & metrics
- [ ] Simulation script
- [ ] Documentation
- [ ] Performance testing
- [ ] Production deployment

---

## 🧪 **Testing Strategy**

### **Unit Tests (Jest)**
- Individual function testing
- Edge cases (0 bookings, new barber, etc.)
- Math precision (decimal.js)
- Config validation

### **Integration Tests**
- Full pipeline with sample data
- API endpoint testing
- Cron job execution
- Database transactions

### **Simulation Tests**
- 3 campuses (SLO, UCSB, UCLA)
- 100 barbers with varying metrics
- 30-day evolution
- Price distribution analysis

### **Acceptance Tests**
- Higher rated barbers → higher prices
- New barbers → base price
- Shock protection → max 30% change
- MSI affects scores correctly
- MDI adjusts prices

---

## 📊 **Success Metrics**

### **Technical**
- [ ] All tests passing (100% critical path)
- [ ] API response time < 200ms
- [ ] Full recompute < 5 seconds (100 barbers)
- [ ] Zero price calculation errors
- [ ] Cron jobs run reliably

### **Business**
- [ ] Price spread reflects performance (correlation > 0.7)
- [ ] New barbers start at base price
- [ ] No barber sees >30% daily change
- [ ] Campus differences normalized (MSI working)
- [ ] Barbers understand their scores

---

## 🚀 **Deployment Plan**

### **Development**
1. Run migrations on dev database
2. Seed with sample data
3. Run simulation
4. Validate results

### **Staging**
1. Deploy backend + cron
2. Run initial recompute
3. Deploy frontend dashboards
4. UAT with barbers

### **Production**
1. Gradual rollout (1 campus at a time)
2. Monitor anomalies
3. Collect feedback
4. Tune config weights
5. Full rollout

---

## 📚 **Documentation Deliverables**

- [x] This roadmap document
- [ ] Database schema documentation
- [ ] API documentation (OpenAPI)
- [ ] Barber guide: "Understanding Your Price"
- [ ] Admin guide: "Managing Pricing Config"
- [ ] Operations runbook
- [ ] Simulation guide
- [ ] Troubleshooting guide

---

## ⚠️ **Known Risks & Mitigations**

| Risk | Impact | Mitigation |
|------|--------|------------|
| Price shock upsets barbers | High | 30% cap, gradual rollout, clear communication |
| Low data quality (new markets) | Medium | New barber policy, minimum booking threshold |
| Performance at scale | Medium | Incremental recompute, caching, indexes |
| Config changes break pricing | High | Validation, audit trail, rollback capability |
| MSI/MDI calculation errors | High | Extensive testing, bounds checking |

---

## 📞 **Next Steps**

1. **Review this roadmap** - Confirm approach
2. **Start Phase 2** - Build metrics & scoring
3. **Create sample data** - For testing
4. **Set up dev environment** - PostgreSQL, Redis
5. **Begin implementation** - One phase at a time

---

**Questions? Concerns? Adjustments needed?**

Let's discuss before proceeding to Phase 2!

