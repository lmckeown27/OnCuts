/**
 * Onboarding Assessment Prompt Template
 * 
 * Evaluates new user applications for fraud risk and success likelihood
 */

export interface OnboardingAssessmentInput {
  userId: string;
  userType: 'barber' | 'customer';
  applicationData: {
    name: string;
    email: string;
    phone: string;
    campus: string;
    profilePhoto?: string;
  };
  barberSpecificData?: {
    experience: string;
    certifications: string[];
    specialties: string[];
    portfolioPhotos: string[];
    references: string;
    pricing: {
      haircut: number;
      beardTrim: number;
    };
  };
  verificationData: {
    emailVerified: boolean;
    phoneVerified: boolean;
    studentIdVerified: boolean;
    backgroundCheckStatus?: string;
  };
  deviceInfo: {
    ipAddress: string;
    deviceType: string;
    location: string;
  };
  externalSignals?: {
    emailDomainAge?: number;
    phonePreviouslyUsed?: boolean;
    similarAccounts?: number;
    socialMediaPresence?: boolean;
  };
}

export interface OnboardingAssessmentOutput {
  risk_score: number; // 0-100
  quality_prediction: number; // 0-100 (for barbers)
  success_likelihood: number; // 0-1
  approval_recommended: boolean;
  recommendations: string[];
  flags: string[];
  verification_requirements: string[];
  reasoning: string;
}

export function buildOnboardingAssessmentPrompt(input: OnboardingAssessmentInput): string {
  return `You are an AI onboarding specialist evaluating a new user application for a campus services marketplace.

Your task is to assess fraud risk, predict success likelihood, and recommend approval or additional verification.

USER APPLICATION:
- User ID: ${input.userId}
- Type: ${input.userType}
- Name: ${input.applicationData.name}
- Email: ${input.applicationData.email}
- Phone: ${input.applicationData.phone}
- Campus: ${input.applicationData.campus}
${input.applicationData.profilePhoto ? `- Profile Photo: Provided` : '- Profile Photo: Not provided'}

${input.barberSpecificData ? `BARBER QUALIFICATIONS:
- Experience: ${input.barberSpecificData.experience}
- Certifications: ${input.barberSpecificData.certifications.join(', ') || 'None'}
- Specialties: ${input.barberSpecificData.specialties.join(', ')}
- Portfolio Photos: ${input.barberSpecificData.portfolioPhotos.length} photos
- References: ${input.barberSpecificData.references}
- Pricing: Haircut $${input.barberSpecificData.pricing.haircut}, Beard $${input.barberSpecificData.pricing.beardTrim}` : ''}

VERIFICATION STATUS:
- Email Verified: ${input.verificationData.emailVerified ? '✓' : '✗'}
- Phone Verified: ${input.verificationData.phoneVerified ? '✓' : '✗'}
- Student ID Verified: ${input.verificationData.studentIdVerified ? '✓' : '✗'}
${input.verificationData.backgroundCheckStatus ? `- Background Check: ${input.verificationData.backgroundCheckStatus}` : ''}

DEVICE & LOCATION:
- IP Address: ${input.deviceInfo.ipAddress}
- Device: ${input.deviceInfo.deviceType}
- Location: ${input.deviceInfo.location}

${input.externalSignals ? `EXTERNAL SIGNALS:
${input.externalSignals.emailDomainAge ? `- Email Domain Age: ${input.externalSignals.emailDomainAge} days` : ''}
${input.externalSignals.phonePreviouslyUsed !== undefined ? `- Phone Previously Used: ${input.externalSignals.phonePreviouslyUsed ? 'Yes' : 'No'}` : ''}
${input.externalSignals.similarAccounts ? `- Similar Accounts: ${input.externalSignals.similarAccounts}` : ''}
${input.externalSignals.socialMediaPresence !== undefined ? `- Social Media Presence: ${input.externalSignals.socialMediaPresence ? 'Found' : 'Not found'}` : ''}` : ''}

EVALUATION CRITERIA:

1. Fraud Risk Assessment (0-100)
   - Email/phone reuse or suspicious patterns
   - Multiple accounts from same device/location
   - Temporary/disposable email services
   - Missing or inconsistent information
   - Verification failures

2. Quality Prediction (Barbers Only, 0-100)
   - Experience level and certifications
   - Portfolio quality
   - Professional presentation
   - Realistic pricing
   - Reference quality

3. Success Likelihood (0-1)
   - Complete profile
   - Campus verification
   - Device & location legitimacy
   - Clear value proposition (barbers)
   - Engagement with platform

RISK SCORING:
- 0-20: LOW - Legitimate user, standard onboarding
- 21-40: MEDIUM - Some concerns, enhanced verification
- 41-70: HIGH - Multiple red flags, strict verification
- 71-100: CRITICAL - Likely fraud, reject or investigate

QUALITY PREDICTION (Barbers):
- 80-100: Excellent - Professional, experienced, high success probability
- 60-79: Good - Solid qualifications, likely to succeed
- 40-59: Fair - Basic qualifications, monitor performance
- 20-39: Poor - Weak qualifications, high-risk onboarding
- 0-19: Unqualified - Reject application

COMMON FLAGS:
- "DISPOSABLE_EMAIL" - Using temporary email service
- "PHONE_REUSE" - Phone number associated with multiple accounts
- "NO_VERIFICATION" - Missing critical verifications
- "SUSPICIOUS_LOCATION" - Location doesn't match campus
- "INCOMPLETE_PROFILE" - Missing required information
- "LOW_QUALITY_PORTFOLIO" - Poor quality work samples
- "UNREALISTIC_PRICING" - Pricing far outside market range
- "MISSING_CERTIFICATIONS" - No credentials provided
- "MULTIPLE_ACCOUNTS" - Attempting duplicate account

VERIFICATION REQUIREMENTS:
- "enhanced_identity_verification" - Additional ID checks
- "manual_portfolio_review" - Human review of work samples
- "reference_check" - Contact provided references
- "background_check" - Criminal/fraud background check
- "video_interview" - Live interview with admin
- "probationary_period" - Limited access until proven

OUTPUT (JSON ONLY):
{
  "risk_score": <number 0-100>,
  "quality_prediction": <number 0-100 for barbers, null for customers>,
  "success_likelihood": <number 0-1>,
  "approval_recommended": <boolean>,
  "recommendations": [<array of specific recommendations>],
  "flags": [<array of concerns or issues>],
  "verification_requirements": [<array of additional checks needed>],
  "reasoning": "<comprehensive 3-5 sentence assessment>"
}`;
}

export const SYSTEM_PROMPT = 'You are an AI onboarding specialist with expertise in fraud prevention, quality assessment, and user screening. You evaluate new applications thoroughly and provide actionable recommendations. You always return valid JSON.';

