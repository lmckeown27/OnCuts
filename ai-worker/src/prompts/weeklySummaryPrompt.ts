/**
 * Weekly Summary Prompt Template
 * 
 * Generates comprehensive weekly admin summaries with insights and recommendations
 */

export interface WeeklySummaryInput {
  weekStart: string;
  weekEnd: string;
  platformMetrics: {
    totalRevenue: number;
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    newUsers: number;
    newBarbers: number;
    newCustomers: number;
    activeBarbers: number;
    activeCustomers: number;
  };
  topPerformingBarbers: Array<{
    id: string;
    name: string;
    bookings: number;
    revenue: number;
    rating: number;
    qualityScore: number;
  }>;
  underperformingBarbers: Array<{
    id: string;
    name: string;
    bookings: number;
    rating: number;
    qualityScore: number;
    issues: string[];
  }>;
  campusBreakdown: Array<{
    campus: string;
    bookings: number;
    revenue: number;
    demandIndex: number;
    growth: number; // percentage
  }>;
  fraudAlerts: Array<{
    userId: string;
    riskScore: number;
    type: string;
  }>;
  disputes: Array<{
    id: string;
    status: string;
    severity: string;
  }>;
  pricingChanges: Array<{
    barberId: string;
    oldMultiplier: number;
    newMultiplier: number;
    reason: string;
  }>;
  anomalies: Array<{
    type: string;
    description: string;
    impact: string;
  }>;
  previousWeekComparison: {
    revenueChange: number; // percentage
    bookingChange: number;
    userGrowth: number;
  };
}

export interface WeeklySummaryOutput {
  executive_summary: string;
  key_metrics: {
    revenue_trend: string;
    booking_trend: string;
    user_growth_trend: string;
    health_score: number; // 0-100
  };
  top_insights: string[];
  concerns: string[];
  opportunities: string[];
  recommended_actions: string[];
  market_predictions: {
    next_week_demand: string;
    trending_services: string[];
    at_risk_campuses: string[];
    growth_campuses: string[];
  };
  barber_highlights: {
    rising_stars: string[];
    needs_support: string[];
    pricing_adjustments_needed: string[];
  };
  risk_summary: {
    fraud_level: string;
    dispute_level: string;
    system_health: string;
  };
}

export function buildWeeklySummaryPrompt(input: WeeklySummaryInput): string {
  return `You are an AI business analyst generating a comprehensive weekly summary for a campus services marketplace platform.

Your task is to analyze platform performance, identify trends, highlight concerns, and provide actionable recommendations for administrators.

WEEK: ${input.weekStart} to ${input.weekEnd}

PLATFORM METRICS:
- Total Revenue: $${input.platformMetrics.totalRevenue.toLocaleString()}
- Total Bookings: ${input.platformMetrics.totalBookings}
- Completed: ${input.platformMetrics.completedBookings}
- Cancelled: ${input.platformMetrics.cancelledBookings}
- Completion Rate: ${((input.platformMetrics.completedBookings / input.platformMetrics.totalBookings) * 100).toFixed(1)}%

USER GROWTH:
- New Users: ${input.platformMetrics.newUsers}
- New Barbers: ${input.platformMetrics.newBarbers}
- New Customers: ${input.platformMetrics.newCustomers}
- Active Barbers: ${input.platformMetrics.activeBarbers}
- Active Customers: ${input.platformMetrics.activeCustomers}

WEEK-OVER-WEEK COMPARISON:
- Revenue Change: ${input.previousWeekComparison.revenueChange > 0 ? '+' : ''}${input.previousWeekComparison.revenueChange.toFixed(1)}%
- Booking Change: ${input.previousWeekComparison.bookingChange > 0 ? '+' : ''}${input.previousWeekComparison.bookingChange.toFixed(1)}%
- User Growth: ${input.previousWeekComparison.userGrowth > 0 ? '+' : ''}${input.previousWeekComparison.userGrowth.toFixed(1)}%

TOP PERFORMING BARBERS (Top 5):
${input.topPerformingBarbers.slice(0, 5).map((barber, idx) => 
  `${idx + 1}. ${barber.name} (ID: ${barber.id})
   - ${barber.bookings} bookings, $${barber.revenue.toFixed(2)} revenue
   - Rating: ${barber.rating}/5.0, Quality Score: ${barber.qualityScore}/100`
).join('\n')}

UNDERPERFORMING BARBERS (Needs Attention):
${input.underperformingBarbers.length > 0 ? input.underperformingBarbers.map((barber, idx) => 
  `${idx + 1}. ${barber.name} (ID: ${barber.id})
   - ${barber.bookings} bookings, Rating: ${barber.rating}/5.0
   - Issues: ${barber.issues.join(', ')}`
).join('\n') : 'None flagged'}

CAMPUS BREAKDOWN:
${input.campusBreakdown.map(campus => 
  `- ${campus.campus}: ${campus.bookings} bookings, $${campus.revenue.toFixed(2)} (${campus.growth > 0 ? '+' : ''}${campus.growth.toFixed(1)}% growth)
   Demand Index: ${campus.demandIndex.toFixed(2)}`
).join('\n')}

FRAUD & SECURITY:
- Fraud Alerts: ${input.fraudAlerts.length}
${input.fraudAlerts.length > 0 ? `- Highest Risk: ${input.fraudAlerts[0].type} (User ${input.fraudAlerts[0].userId}, Score: ${input.fraudAlerts[0].riskScore})` : ''}

DISPUTES:
- Total Disputes: ${input.disputes.length}
${input.disputes.length > 0 ? `- Breakdown: ${input.disputes.filter(d => d.severity === 'serious').length} serious, ${input.disputes.filter(d => d.severity === 'moderate').length} moderate, ${input.disputes.filter(d => d.severity === 'minor').length} minor` : ''}

PRICING CHANGES:
- Barbers with Pricing Adjustments: ${input.pricingChanges.length}
${input.pricingChanges.slice(0, 3).map(change => 
  `  - Barber ${change.barberId}: ${change.oldMultiplier}x → ${change.newMultiplier}x (${change.reason})`
).join('\n')}

ANOMALIES DETECTED:
${input.anomalies.length > 0 ? input.anomalies.map((anomaly, idx) => 
  `${idx + 1}. ${anomaly.type}: ${anomaly.description} (Impact: ${anomaly.impact})`
).join('\n') : 'No significant anomalies'}

ANALYSIS REQUIREMENTS:

1. Executive Summary
   - 2-3 paragraph high-level overview
   - Highlight the single most important insight
   - Overall platform health assessment

2. Key Metrics Analysis
   - Revenue trend (growing/stable/declining)
   - Booking trend and patterns
   - User growth quality and sustainability
   - Platform health score (0-100)

3. Top Insights (3-5 insights)
   - Most important discoveries
   - Emerging patterns
   - Notable achievements
   - Data-driven observations

4. Concerns (If any)
   - Issues requiring immediate attention
   - Declining metrics
   - Risk factors
   - Quality problems

5. Opportunities
   - Growth opportunities
   - Market expansion potential
   - Optimization possibilities
   - New features/services

6. Recommended Actions
   - Specific, actionable items
   - Prioritized by impact
   - Include success metrics
   - Assign urgency level

7. Market Predictions
   - Next week demand forecast
   - Trending services
   - Campus-specific predictions
   - Seasonal factors

8. Barber Management
   - Rising stars to promote
   - Barbers needing support/training
   - Pricing adjustments needed
   - Performance interventions

9. Risk Summary
   - Fraud risk level
   - Dispute management status
   - System health indicators
   - Mitigation needs

OUTPUT (JSON ONLY):
{
  "executive_summary": "<comprehensive 2-3 paragraph overview>",
  "key_metrics": {
    "revenue_trend": "<growing|stable|declining with context>",
    "booking_trend": "<analysis of booking patterns>",
    "user_growth_trend": "<analysis of user growth>",
    "health_score": <number 0-100>
  },
  "top_insights": [<array of 3-5 key insights>],
  "concerns": [<array of issues needing attention>],
  "opportunities": [<array of growth opportunities>],
  "recommended_actions": [<array of specific, actionable recommendations>],
  "market_predictions": {
    "next_week_demand": "<forecast description>",
    "trending_services": [<array of trending services>],
    "at_risk_campuses": [<array of campuses with declining metrics>],
    "growth_campuses": [<array of campuses with strong growth>]
  },
  "barber_highlights": {
    "rising_stars": [<array of high-potential barbers>],
    "needs_support": [<array of barbers needing help>],
    "pricing_adjustments_needed": [<array of barbers needing price changes>]
  },
  "risk_summary": {
    "fraud_level": "<low|medium|high with details>",
    "dispute_level": "<low|medium|high with details>",
    "system_health": "<excellent|good|fair|poor with details>"
  }
}`;
}

export const SYSTEM_PROMPT = 'You are an AI business intelligence analyst specializing in marketplace analytics and executive reporting. You provide comprehensive, actionable insights with strategic recommendations. You always return valid JSON.';

