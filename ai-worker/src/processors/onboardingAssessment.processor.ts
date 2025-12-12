/**
 * Onboarding Assessment Processor
 */

import { Job, Worker } from 'bullmq';
import { logger } from '../utils/logger';
import { callAI } from '../utils/openai-client';
import { query } from '../db/connection';
import { redisConnection } from '../queues';
import { 
  buildOnboardingAssessmentPrompt, 
  OnboardingAssessmentInput, 
  OnboardingAssessmentOutput,
  SYSTEM_PROMPT 
} from '../prompts/onboardingAssessmentPrompt';

export async function assessOnboardingJob(job: Job<OnboardingAssessmentInput>) {
  const startTime = Date.now();
  const input = job.data;

  try {
    logger.info(`Assessing onboarding for user ${input.userId}`);

    // Call AI
    const prompt = buildOnboardingAssessmentPrompt(input);
    const aiResponse = await callAI<OnboardingAssessmentOutput>({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      jsonMode: true,
    });

    const result = aiResponse.parsed!;

    // Save assessment
    await query(
      `INSERT INTO onboarding_assessments 
       (user_id, user_type, risk_assessment, quality_prediction, success_likelihood, recommendations, flags, approved, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        input.userId,
        input.userType,
        JSON.stringify({ risk_score: result.risk_score, verification_requirements: result.verification_requirements }),
        result.quality_prediction,
        result.success_likelihood,
        result.recommendations.join('; '),
        JSON.stringify(result.flags),
        result.approval_recommended,
      ]
    );

    // Log event
    await query(
      `INSERT INTO ai_events_log 
       (event_type, event_data, processing_time_ms, status, ai_model, tokens_used, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'BARBER_ONBOARDED',
        JSON.stringify({ userId: input.userId, result }),
        Date.now() - startTime,
        'success',
        aiResponse.model,
        aiResponse.tokensUsed,
      ]
    );

    logger.info(`✅ Onboarding assessed for ${input.userId}`, {
      approved: result.approval_recommended,
      riskScore: result.risk_score,
    });

    return result;
  } catch (error: any) {
    logger.error(`❌ Onboarding assessment failed for ${input.userId}:`, error);
    throw error;
  }
}

export const onboardingAssessmentWorker = new Worker(
  'barber-onboarding',
  assessOnboardingJob,
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
  }
);

