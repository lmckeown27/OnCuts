/**
 * Fraud Detection Prompt Template
 * 
 * Analyzes user behavior patterns to detect fraudulent activity
 */

export interface FraudDetectionInput {
  userId: string;
  userType: 'barber' | 'customer';
  accountAge: number; // days
  behaviorData: {
    totalBookings: number;
    cancelledBookings: number;
    disputedBookings: number;
    accountChanges: number; // payment method changes, address changes, etc.
    loginLocations: string[]; // unique locations
    deviceCount: number;
  };
  financialData: {
    totalSpent?: number; // for customers
    totalEarned?: number; // for barbers
    withdrawalCount?: number;
    chargebacks: number;
    refundRequests: number;
  };
  reviewPatterns?: {
    reviewsGiven: number;
    reviewsReceived: number;
    suspiciousReviews: number;
    averageReviewLength: number;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
    suspicious: boolean;
  }>;
  similarAccounts?: Array<{
    userId: string;
    similarity: number; // 0-1
    sharedAttributes: string[];
  }>;
}

export interface FraudDetectionOutput {
  risk_score: number; // 0-100
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fraud_indicators: string[];
  pattern_type: string;
  confidence: number; // 0-1
  recommended_action: string;
  detailed_reasoning: string;
  similar_fraud_cases: number;
}

export function buildFraudDetectionPrompt(input: FraudDetectionInput): string {
  return `You are a fraud detection specialist analyzing user behavior on a campus services marketplace.

Your task is to evaluate this user's activity and determine fraud risk.

USER PROFILE:
- User ID: ${input.userId}
- Type: ${input.userType}
- Account Age: ${input.accountAge} days

BEHAVIORAL DATA:
- Total Bookings: ${input.behaviorData.totalBookings}
- Cancelled Bookings: ${input.behaviorData.cancelledBookings}
- Disputed Bookings: ${input.behaviorData.disputedBookings}
- Account Changes: ${input.behaviorData.accountChanges}
- Unique Login Locations: ${input.behaviorData.loginLocations.length}
- Device Count: ${input.behaviorData.deviceCount}
${input.behaviorData.loginLocations.length > 0 ? `- Locations: ${input.behaviorData.loginLocations.join(', ')}` : ''}

FINANCIAL DATA:
${input.financialData.totalSpent !== undefined ? `- Total Spent: $${input.financialData.totalSpent}` : ''}
${input.financialData.totalEarned !== undefined ? `- Total Earned: $${input.financialData.totalEarned}` : ''}
${input.financialData.withdrawalCount !== undefined ? `- Withdrawals: ${input.financialData.withdrawalCount}` : ''}
- Chargebacks: ${input.financialData.chargebacks}
- Refund Requests: ${input.financialData.refundRequests}

${input.reviewPatterns ? `REVIEW PATTERNS:
- Reviews Given: ${input.reviewPatterns.reviewsGiven}
- Reviews Received: ${input.reviewPatterns.reviewsReceived}
- Suspicious Reviews: ${input.reviewPatterns.suspiciousReviews}
- Avg Review Length: ${input.reviewPatterns.averageReviewLength} chars` : ''}

RECENT ACTIVITY:
${input.recentActivity.map((activity, idx) => 
  `${idx + 1}. ${activity.type}: ${activity.description} [${activity.timestamp}]${activity.suspicious ? ' ⚠️ FLAGGED' : ''}`
).join('\n')}

${input.similarAccounts && input.similarAccounts.length > 0 ? `SIMILAR ACCOUNTS DETECTED:
${input.similarAccounts.map((acc, idx) => 
  `${idx + 1}. User ${acc.userId} (${(acc.similarity * 100).toFixed(0)}% similar) - Shared: ${acc.sharedAttributes.join(', ')}`
).join('\n')}` : ''}

FRAUD INDICATORS TO EVALUATE:

1. Account Velocity
   - New account with high activity
   - Rapid booking/cancellation cycles
   - Multiple accounts from same device/location

2. Financial Red Flags
   - High chargeback rate (>5% is critical)
   - Unusual withdrawal patterns
   - Immediate cash-out behavior

3. Behavioral Anomalies
   - Multiple account changes
   - Login from many locations
   - Cancellation rate >25%
   - High dispute rate

4. Review Manipulation
   - Fake/suspicious reviews
   - Review pattern matches known fraud
   - Reciprocal review rings

5. Multi-Account Fraud
   - Similar devices, IPs, payment methods
   - Coordinated activity timing
   - Shared personal information

RISK SCORING:
- 0-25: LOW - Normal user behavior
- 26-50: MEDIUM - Some suspicious indicators, monitor
- 51-75: HIGH - Multiple fraud indicators, restrict account
- 76-100: CRITICAL - Clear fraud pattern, immediate action needed

RECOMMENDED ACTIONS:
- LOW: Continue monitoring
- MEDIUM: Enhanced verification required
- HIGH: Temporary restrictions, manual review
- CRITICAL: Suspend account, fraud investigation

PATTERN TYPES:
- "CHARGEBACK_FRAUD" - Excessive chargebacks
- "MULTI_ACCOUNT" - Operating multiple accounts
- "CANCELLATION_ABUSE" - Booking manipulation
- "REVIEW_FRAUD" - Fake review activity
- "PAYMENT_FRAUD" - Stolen payment methods
- "COLLUSION" - Coordinated fraudulent activity
- "IDENTITY_THEFT" - Stolen identity indicators

OUTPUT (JSON ONLY):
{
  "risk_score": <number 0-100>,
  "risk_level": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "fraud_indicators": [<array of specific indicators found>],
  "pattern_type": "<primary fraud pattern detected>",
  "confidence": <number 0-1>,
  "recommended_action": "<specific action to take>",
  "detailed_reasoning": "<comprehensive explanation of findings>",
  "similar_fraud_cases": <estimated count of similar patterns in dataset>
}`;
}

export const SYSTEM_PROMPT = 'You are a fraud detection AI specialist with expertise in marketplace fraud patterns, multi-account detection, and behavioral analysis. You provide detailed, actionable fraud risk assessments. You always return valid JSON.';

