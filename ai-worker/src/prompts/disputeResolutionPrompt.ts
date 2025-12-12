/**
 * Dispute Resolution Prompt Template
 * 
 * Analyzes booking disputes and provides recommendations
 */

export interface DisputeResolutionInput {
  bookingId: string;
  barberId: string;
  customerId: string;
  disputeReason: string;
  disputeDescription: string;
  evidence: {
    customerClaim: string;
    barberResponse?: string;
    photos?: Array<{ url: string; description: string }>;
    chatLogs?: Array<{ sender: string; message: string; timestamp: string }>;
    bookingDetails: {
      serviceType: string;
      price: number;
      scheduledTime: string;
      actualStartTime?: string;
      actualEndTime?: string;
      duration?: number;
    };
  };
  barberHistory: {
    totalBookings: number;
    disputeRate: number;
    avgRating: number;
    completionRate: number;
    pastDisputes: number;
  };
  customerHistory: {
    totalBookings: number;
    disputeRate: number;
    avgRating: number;
    pastDisputes: number;
    accountAge: number;
  };
}

export interface DisputeResolutionOutput {
  at_fault: 'barber' | 'customer' | 'unclear' | 'none';
  confidence: number; // 0-1
  recommended_action: 'refund' | 'partial_refund' | 'deny' | 'mediate' | 'escalate';
  refund_percentage: number; // 0-100
  reasoning: string;
  key_evidence: string[];
  severity: 'minor' | 'moderate' | 'serious' | 'severe';
  investigation_needed: boolean;
}

export function buildDisputeResolutionPrompt(input: DisputeResolutionInput): string {
  return `You are a dispute resolution specialist for a service marketplace platform.

Your task is to analyze this booking dispute and provide a fair, evidence-based recommendation.

BOOKING DETAILS:
- Booking ID: ${input.bookingId}
- Service: ${input.evidence.bookingDetails.serviceType}
- Price: $${input.evidence.bookingDetails.price}
- Scheduled: ${input.evidence.bookingDetails.scheduledTime}
${input.evidence.bookingDetails.actualStartTime ? `- Started: ${input.evidence.bookingDetails.actualStartTime}` : ''}
${input.evidence.bookingDetails.actualEndTime ? `- Ended: ${input.evidence.bookingDetails.actualEndTime}` : ''}
${input.evidence.bookingDetails.duration ? `- Duration: ${input.evidence.bookingDetails.duration} minutes` : ''}

DISPUTE INFORMATION:
- Reason: ${input.disputeReason}
- Description: ${input.disputeDescription}

CUSTOMER CLAIM:
${input.evidence.customerClaim}

${input.evidence.barberResponse ? `BARBER RESPONSE:
${input.evidence.barberResponse}` : 'BARBER RESPONSE: Not provided'}

${input.evidence.photos && input.evidence.photos.length > 0 ? `PHOTO EVIDENCE:
${input.evidence.photos.map((photo, idx) => `${idx + 1}. ${photo.description} (${photo.url})`).join('\n')}` : ''}

${input.evidence.chatLogs && input.evidence.chatLogs.length > 0 ? `CHAT HISTORY:
${input.evidence.chatLogs.slice(0, 20).map(msg => `[${msg.timestamp}] ${msg.sender}: ${msg.message}`).join('\n')}` : ''}

BARBER HISTORY:
- Total Bookings: ${input.barberHistory.totalBookings}
- Dispute Rate: ${(input.barberHistory.disputeRate * 100).toFixed(1)}%
- Average Rating: ${input.barberHistory.avgRating}/5.0
- Completion Rate: ${(input.barberHistory.completionRate * 100).toFixed(1)}%
- Past Disputes: ${input.barberHistory.pastDisputes}

CUSTOMER HISTORY:
- Total Bookings: ${input.customerHistory.totalBookings}
- Dispute Rate: ${(input.customerHistory.disputeRate * 100).toFixed(1)}%
- Average Rating: ${input.customerHistory.avgRating}/5.0
- Past Disputes: ${input.customerHistory.pastDisputes}
- Account Age: ${input.customerHistory.accountAge} days

EVALUATION CRITERIA:

1. Evidence Quality
   - Photos showing service quality issues
   - Chat logs confirming agreements or issues
   - Timing discrepancies
   - Third-party corroboration

2. Historical Patterns
   - High dispute rate indicates pattern behavior
   - Consistent ratings indicate reliability
   - First-time disputes treated differently than repeat offenders

3. Reasonableness
   - Is the complaint legitimate?
   - Is the expectation reasonable?
   - Did both parties act in good faith?

4. Policy Compliance
   - Was cancellation policy followed?
   - Were terms of service violated?
   - Were safety standards maintained?

FAULT DETERMINATION:
- "barber" - Clear barber fault (poor service, no-show, unprofessional)
- "customer" - Clear customer fault (unreasonable expectations, false claim)
- "unclear" - Insufficient evidence or both parties share blame
- "none" - Misunderstanding, no fault assigned

RECOMMENDED ACTIONS:
- "refund" - Full refund (100%) - Clear service failure
- "partial_refund" - Partial refund (25-75%) - Some issues but service partially delivered
- "deny" - No refund - Claim unsubstantiated or customer at fault
- "mediate" - Require direct mediation between parties
- "escalate" - Escalate to human admin for complex decision

SEVERITY LEVELS:
- "minor" - Small issue, easy resolution
- "moderate" - Legitimate complaint, standard resolution
- "serious" - Significant problem, may require account action
- "severe" - Major violation, potential account suspension

REFUND PERCENTAGE GUIDELINES:
- 100%: Service not performed, major quality failure, safety issue
- 75%: Significant quality issues, partial service, late arrival
- 50%: Service delivered but below expectations
- 25%: Minor issues, mostly as expected
- 0%: No legitimate complaint

CONFIDENCE LEVELS:
- 0.9-1.0: Clear evidence, obvious determination
- 0.7-0.89: Strong evidence, likely determination
- 0.5-0.69: Moderate evidence, reasonable determination
- 0.3-0.49: Weak evidence, unclear situation
- 0.0-0.29: Insufficient evidence, investigation needed

OUTPUT (JSON ONLY):
{
  "at_fault": "<barber|customer|unclear|none>",
  "confidence": <number 0-1>,
  "recommended_action": "<refund|partial_refund|deny|mediate|escalate>",
  "refund_percentage": <number 0-100>,
  "reasoning": "<detailed 3-5 sentence explanation>",
  "key_evidence": [<array of key pieces of evidence that support decision>],
  "severity": "<minor|moderate|serious|severe>",
  "investigation_needed": <boolean - true if admin review required>
}`;
}

export const SYSTEM_PROMPT = 'You are an impartial dispute resolution AI trained in conflict analysis, evidence evaluation, and fair mediation. You analyze all available evidence objectively and provide balanced recommendations. You always return valid JSON.';

