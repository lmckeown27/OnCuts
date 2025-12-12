/**
 * Market Demand Prompt Template
 * 
 * Analyzes campus-level market demand and provides demand index
 */

export interface MarketDemandInput {
  campusId: string;
  campusName: string;
  timeRange: {
    start: string;
    end: string;
  };
  supplyMetrics: {
    activeBarbers: number;
    totalCapacity: number; // bookings per week
    avgAvailability: number; // hours per week
    newBarbers: number;
  };
  demandMetrics: {
    activeCustomers: number;
    totalBookings: number;
    pendingBookings: number;
    searchVolume: number;
    avgWaitTime: number; // hours
    peakWaitTime: number;
  };
  bookingPatterns: {
    hourlyDistribution: Array<{ hour: number; count: number }>;
    dayOfWeekDistribution: Array<{ day: string; count: number }>;
    serviceTypeDistribution: Array<{ service: string; count: number }>;
  };
  cancellationData: {
    totalCancellations: number;
    customerCancellations: number;
    barberCancellations: number;
    cancellationRate: number;
  };
  pricing: {
    avgPrice: number;
    priceRange: { min: number; max: number };
    avgMultiplier: number;
  };
  growth: {
    weekOverWeekBookings: number; // percentage
    weekOverWeekRevenue: number;
    monthOverMonthActive: number;
  };
  competitorData?: {
    alternativeServices: number;
    marketShare: number; // percentage
  };
  seasonalFactors?: {
    isStartOfSemester: boolean;
    isExamPeriod: boolean;
    isBreakPeriod: boolean;
    specialEvents: string[];
  };
}

export interface MarketDemandOutput {
  demand_index: number; // 0-2 (0=low, 1=normal, 2=high)
  supply_demand_ratio: number;
  market_health: string; // 'undersupplied' | 'balanced' | 'oversupplied'
  booking_velocity: number; // bookings per active customer per week
  peak_hours: string[];
  peak_days: string[];
  trending_services: string[];
  capacity_utilization: number; // 0-1
  recommendations: string[];
  demand_drivers: string[];
  supply_constraints: string[];
  growth_forecast: string;
  urgent_actions: string[];
}

export function buildMarketDemandPrompt(input: MarketDemandInput): string {
  return `You are an AI market analyst specializing in supply-demand dynamics for service marketplaces.

Your task is to analyze this campus market and provide a comprehensive demand assessment with actionable recommendations.

CAMPUS: ${input.campusName} (ID: ${input.campusId})
TIME PERIOD: ${input.timeRange.start} to ${input.timeRange.end}

SUPPLY SIDE:
- Active Barbers: ${input.supplyMetrics.activeBarbers}
- Total Weekly Capacity: ${input.supplyMetrics.totalCapacity} bookings
- Avg Availability: ${input.supplyMetrics.avgAvailability} hours/week
- New Barbers This Period: ${input.supplyMetrics.newBarbers}

DEMAND SIDE:
- Active Customers: ${input.demandMetrics.activeCustomers}
- Total Bookings: ${input.demandMetrics.totalBookings}
- Pending Bookings: ${input.demandMetrics.pendingBookings}
- Search Volume: ${input.demandMetrics.searchVolume}
- Avg Wait Time: ${input.demandMetrics.avgWaitTime.toFixed(1)} hours
- Peak Wait Time: ${input.demandMetrics.peakWaitTime.toFixed(1)} hours

BOOKING PATTERNS:

Peak Hours (Hourly Distribution):
${input.bookingPatterns.hourlyDistribution
  .sort((a, b) => b.count - a.count)
  .slice(0, 5)
  .map((h, idx) => `${idx + 1}. ${h.hour}:00 - ${h.count} bookings`)
  .join('\n')}

Peak Days (Day Distribution):
${input.bookingPatterns.dayOfWeekDistribution
  .sort((a, b) => b.count - a.count)
  .map((d, idx) => `${idx + 1}. ${d.day} - ${d.count} bookings`)
  .join('\n')}

Service Distribution:
${input.bookingPatterns.serviceTypeDistribution
  .sort((a, b) => b.count - a.count)
  .map((s, idx) => `${idx + 1}. ${s.service} - ${s.count} bookings`)
  .join('\n')}

CANCELLATION DATA:
- Total Cancellations: ${input.cancellationData.totalCancellations}
- Customer Cancellations: ${input.cancellationData.customerCancellations}
- Barber Cancellations: ${input.cancellationData.barberCancellations}
- Cancellation Rate: ${(input.cancellationData.cancellationRate * 100).toFixed(1)}%

PRICING:
- Average Price: $${input.pricing.avgPrice.toFixed(2)}
- Price Range: $${input.pricing.priceRange.min} - $${input.pricing.priceRange.max}
- Average Multiplier: ${input.pricing.avgMultiplier.toFixed(2)}x

GROWTH TRENDS:
- Week-over-Week Bookings: ${input.growth.weekOverWeekBookings > 0 ? '+' : ''}${input.growth.weekOverWeekBookings.toFixed(1)}%
- Week-over-Week Revenue: ${input.growth.weekOverWeekRevenue > 0 ? '+' : ''}${input.growth.weekOverWeekRevenue.toFixed(1)}%
- Month-over-Month Active Users: ${input.growth.monthOverMonthActive > 0 ? '+' : ''}${input.growth.monthOverMonthActive.toFixed(1)}%

${input.competitorData ? `COMPETITIVE LANDSCAPE:
- Alternative Services Available: ${input.competitorData.alternativeServices}
- CampusCuts Market Share: ${input.competitorData.marketShare.toFixed(1)}%` : ''}

${input.seasonalFactors ? `SEASONAL CONTEXT:
- Start of Semester: ${input.seasonalFactors.isStartOfSemester ? 'Yes' : 'No'}
- Exam Period: ${input.seasonalFactors.isExamPeriod ? 'Yes' : 'No'}
- Break Period: ${input.seasonalFactors.isBreakPeriod ? 'Yes' : 'No'}
${input.seasonalFactors.specialEvents.length > 0 ? `- Special Events: ${input.seasonalFactors.specialEvents.join(', ')}` : ''}` : ''}

ANALYSIS REQUIREMENTS:

1. Demand Index (0-2)
   - 0.0-0.5: Very Low (severe oversupply, wait times <2hrs, low utilization)
   - 0.5-0.8: Low (oversupply, excess capacity)
   - 0.8-1.2: Normal (balanced market, healthy competition)
   - 1.2-1.5: High (undersupply, longer wait times, high utilization)
   - 1.5-2.0: Very High (severe undersupply, excessive wait times, capacity crisis)

   Calculate based on:
   - Supply/Demand Ratio
   - Capacity Utilization
   - Wait Times
   - Booking Velocity
   - Growth Trends
   - Pending Bookings

2. Supply-Demand Ratio
   = Total Capacity / Total Bookings
   - <0.8: Undersupplied (need more barbers)
   - 0.8-1.2: Balanced
   - >1.2: Oversupplied (excess capacity)

3. Market Health Assessment
   - "undersupplied": High demand, insufficient barbers, long wait times
   - "balanced": Healthy supply-demand equilibrium
   - "oversupplied": Low demand, too many barbers, low utilization

4. Booking Velocity
   = Total Bookings / Active Customers / Weeks

5. Capacity Utilization
   = Actual Bookings / Total Capacity

6. Recommendations
   - Specific actions for admins
   - Barber recruitment needs
   - Marketing initiatives
   - Pricing strategies
   - Capacity management

7. Demand Drivers
   - Factors increasing demand
   - Seasonal influences
   - Growth catalysts
   - Market opportunities

8. Supply Constraints
   - Barber availability issues
   - Capacity bottlenecks
   - Service gaps
   - Quality concerns

OUTPUT (JSON ONLY):
{
  "demand_index": <number 0-2>,
  "supply_demand_ratio": <number>,
  "market_health": "<undersupplied|balanced|oversupplied>",
  "booking_velocity": <number>,
  "peak_hours": [<array of peak hour strings like "18:00-20:00">],
  "peak_days": [<array of peak days like "Friday", "Saturday">],
  "trending_services": [<array of most popular services>],
  "capacity_utilization": <number 0-1>,
  "recommendations": [<array of specific actionable recommendations>],
  "demand_drivers": [<array of factors driving demand>],
  "supply_constraints": [<array of factors limiting supply>],
  "growth_forecast": "<short forecast description for next 2-4 weeks>",
  "urgent_actions": [<array of time-sensitive actions if any>]
}`;
}

export const SYSTEM_PROMPT = 'You are an AI market economics specialist analyzing supply and demand dynamics. You provide data-driven market assessments and strategic recommendations. You always return valid JSON.';

