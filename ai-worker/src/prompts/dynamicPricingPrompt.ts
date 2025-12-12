/**
 * Dynamic Pricing Prompt Template
 * 
 * Evaluates barber performance and market conditions to generate pricing multipliers
 */

export interface DynamicPricingInput {
  barberId: string;
  recentReviews: Array<{
    text: string;
    rating: number;
    createdAt: string;
  }>;
  performanceLast60Days: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    lateArrivals: number;
    avgRating: number;
    reviewCount: number;
  };
  cancellationRate: number;
  latenessRate: number;
  repeatCustomerRate: number;
  campusMarketDemandIndex: number; // 0-2
  historicalQualityScore: number; // 0-100
  currentMultiplier?: number;
}

export interface DynamicPricingOutput {
  quality_score: number; // 0-100
  pricing_multiplier: number; // 0.8-1.5
  reasoning: string;
  flags: string[];
  sentiment_score: number; // -1 to 1
  demand_factor: number;
  quality_factor: number;
  campus_coefficient: number;
}

export function buildDynamicPricingPrompt(input: DynamicPricingInput): string {
  return `You are an economic agent evaluating service providers in a campus-based haircut marketplace.

Your task is to analyze the barber's performance data and determine:
1. An updated quality score (0-100)
2. A pricing multiplier (0.8-1.5) that reflects their value and market position
3. Clear reasoning for your assessment

BARBER PROFILE:
- Barber ID: ${input.barberId}
- Historical Quality Score: ${input.historicalQualityScore}/100
- Current Multiplier: ${input.currentMultiplier || 1.0}x

RECENT PERFORMANCE (Last 60 Days):
- Total Bookings: ${input.performanceLast60Days.totalBookings}
- Completed: ${input.performanceLast60Days.completedBookings}
- Cancelled: ${input.performanceLast60Days.cancelledBookings}
- Late Arrivals: ${input.performanceLast60Days.lateArrivals}
- Average Rating: ${input.performanceLast60Days.avgRating}/5.0
- Review Count: ${input.performanceLast60Days.reviewCount}

BEHAVIORAL METRICS:
- Cancellation Rate: ${(input.cancellationRate * 100).toFixed(1)}%
- Lateness Rate: ${(input.latenessRate * 100).toFixed(1)}%
- Repeat Customer Rate: ${(input.repeatCustomerRate * 100).toFixed(1)}%

MARKET CONDITIONS:
- Campus Demand Index: ${input.campusMarketDemandIndex.toFixed(2)} (0=low, 1=normal, 2=high)

RECENT REVIEWS:
${input.recentReviews.map((review, idx) => 
  `${idx + 1}. (${review.rating}/5) - "${review.text}" [${review.createdAt}]`
).join('\n')}

SCORING GUIDELINES:

Quality Score (0-100):
- 90-100: Exceptional (consistently 5-star, no issues, high repeat rate)
- 75-89: Very Good (mostly 5-star, minimal issues)
- 60-74: Good (4+ stars, acceptable performance)
- 40-59: Fair (3-4 stars, some concerns)
- 0-39: Poor (below 3 stars, significant issues)

Quality Score Factors:
- Recent review sentiment and ratings (40% weight)
- Completion and reliability (30% weight)
- Repeat customer rate (20% weight)
- Cancellation and lateness penalties (10% weight)

Pricing Multiplier (0.8-1.5):
- 1.3-1.5: Premium tier (top 10%, exceptional quality, high demand)
- 1.1-1.29: Above average (top 25%, strong performance)
- 0.95-1.09: Market rate (average performance)
- 0.8-0.94: Discount rate (below average, improvement needed)

Multiplier Calculation:
Base multiplier = 1.0
+ Quality factor: (-0.2 to +0.3) based on quality_score
+ Demand factor: (-0.1 to +0.2) based on campus_demand_index
+ Repeat customer bonus: (+0.0 to +0.1) if rate > 40%
- Reliability penalty: (-0.0 to -0.15) for cancellations/lateness

IMPORTANT CONSTRAINTS:
1. Final multiplier must be between 0.8 and 1.5
2. Quality score must be between 0 and 100
3. Changes should be gradual (±0.05 max per update unless major event)
4. Consider market demand - high demand allows higher multipliers
5. Flag any concerning patterns (fraud, quality drop, etc.)

REQUIRED FLAGS (if applicable):
- "QUALITY_DECLINE" - Quality dropped >10 points
- "HIGH_CANCELLATION" - Cancellation rate >15%
- "LATE_PATTERN" - Lateness rate >10%
- "POOR_REVIEWS" - Multiple recent 1-2 star reviews
- "FRAUD_RISK" - Suspicious patterns detected
- "TOP_PERFORMER" - Quality score >85 and repeat rate >50%

OUTPUT (JSON ONLY):
{
  "quality_score": <number 0-100>,
  "pricing_multiplier": <number 0.8-1.5>,
  "sentiment_score": <number -1 to 1, based on review analysis>,
  "demand_factor": <number showing demand contribution>,
  "quality_factor": <number showing quality contribution>,
  "campus_coefficient": <number showing campus market effect>,
  "reasoning": "<clear 2-3 sentence explanation>",
  "flags": [<array of applicable flags>]
}`;
}

export const SYSTEM_PROMPT = 'You are an economic pricing analyst for a marketplace platform. You evaluate service provider quality and determine fair, data-driven pricing multipliers. You always return valid JSON matching the specified schema.';

