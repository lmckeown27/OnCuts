/**
 * Fraud Detection Processor
 */

import { Job, Worker } from 'bullmq';
import { logger } from '../utils/logger';
import { callAI } from '../utils/openai-client';
import { query } from '../db/connection';
import { redisConnection } from '../queues';
import { 
  buildFraudDetectionPrompt, 
  FraudDetectionInput, 
  FraudDetectionOutput,
  SYSTEM_PROMPT 
} from '../prompts/fraudDetectionPrompt';

interface FraudDetectionJobData {
  userId: string;
  userType: 'barber' | 'customer';
  triggerReason: string;
}

export async function detectFraudJob(job: Job<FraudDetectionJobData>) {
  const startTime = Date.now();
  const { userId, userType, triggerReason } = job.data;

  try {
    logger.info(`Running fraud detection for user ${userId}`);

    // Fetch user data
    const userQuery = await query(
      `SELECT created_at FROM users WHERE id = $1`,
      [userId]
    );
    const accountAge = Math.floor((Date.now() - new Date(userQuery.rows[0].created_at).getTime()) / (1000 * 60 * 60 * 24));

    // Fetch behavioral data
    const behaviorQuery = await query(
      `SELECT 
        COUNT(*) as total_bookings,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
        COUNT(*) FILTER (WHERE has_dispute = true) as disputed_bookings
       FROM bookings 
       WHERE ${userType === 'barber' ? 'barber_id' : 'customer_id'} = $1`,
      [userId]
    );

    // Build prompt input
    const promptInput: FraudDetectionInput = {
      userId,
      userType,
      accountAge,
      behaviorData: {
        totalBookings: parseInt(behaviorQuery.rows[0]?.total_bookings) || 0,
        cancelledBookings: parseInt(behaviorQuery.rows[0]?.cancelled_bookings) || 0,
        disputedBookings: parseInt(behaviorQuery.rows[0]?.disputed_bookings) || 0,
        accountChanges: 0, // Would fetch from audit log
        loginLocations: [], // Would fetch from session data
        deviceCount: 1,
      },
      financialData: {
        chargebacks: 0,
        refundRequests: 0,
      },
      recentActivity: [{ type: triggerReason, description: 'Triggered fraud check', timestamp: new Date().toISOString(), suspicious: true }],
    };

    // Call AI
    const prompt = buildFraudDetectionPrompt(promptInput);
    const aiResponse = await callAI<FraudDetectionOutput>({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      jsonMode: true,
    });

    const result = aiResponse.parsed!;

    // Save fraud flag if risk is medium or higher
    if (result.risk_score >= 26) {
      await query(
        `INSERT INTO fraud_flags 
         (user_id, risk_score, risk_level, fraud_indicators, pattern_type, confidence, recommended_action, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW())`,
        [
          userId,
          result.risk_score,
          result.risk_level,
          JSON.stringify(result.fraud_indicators),
          result.pattern_type,
          result.confidence,
          result.recommended_action,
        ]
      );

      logger.warn(`🚨 Fraud detected for user ${userId}`, {
        riskScore: result.risk_score,
        riskLevel: result.risk_level,
      });
    }

    // Log event
    await query(
      `INSERT INTO ai_events_log 
       (event_type, event_data, processing_time_ms, status, ai_model, tokens_used, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'FRAUD_DETECTION',
        JSON.stringify({ userId, result }),
        Date.now() - startTime,
        'success',
        aiResponse.model,
        aiResponse.tokensUsed,
      ]
    );

    return result;
  } catch (error: any) {
    logger.error(`❌ Fraud detection failed for user ${userId}:`, error);
    throw error;
  }
}

export const fraudDetectionWorker = new Worker(
  'fraud-detection',
  detectFraudJob,
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
  }
);

