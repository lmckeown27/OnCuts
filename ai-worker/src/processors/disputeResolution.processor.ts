/**
 * Dispute Resolution Processor
 */

import { Job, Worker } from 'bullmq';
import { logger } from '../utils/logger';
import { callAI } from '../utils/openai-client';
import { query } from '../db/connection';
import { redisConnection } from '../queues';
import { 
  buildDisputeResolutionPrompt, 
  DisputeResolutionInput, 
  DisputeResolutionOutput,
  SYSTEM_PROMPT 
} from '../prompts/disputeResolutionPrompt';

interface DisputeResolutionJobData {
  bookingId: string;
  disputeId: string;
  disputeReason: string;
  disputeDescription: string;
}

export async function resolveDisputeJob(job: Job<DisputeResolutionJobData>) {
  const startTime = Date.now();
  const { bookingId, disputeId, disputeReason, disputeDescription } = job.data;

  try {
    logger.info(`Analyzing dispute ${disputeId} for booking ${bookingId}`);

    // Fetch booking details
    const bookingQuery = await query(
      `SELECT b.*, u1.id as barber_id, u2.id as customer_id
       FROM bookings b
       JOIN users u1 ON b.barber_id = u1.id
       JOIN users u2 ON b.customer_id = u2.id
       WHERE b.id = $1`,
      [bookingId]
    );

    const booking = bookingQuery.rows[0];
    if (!booking) throw new Error('Booking not found');

    // Fetch barber history
    const barberHistoryQuery = await query(
      `SELECT 
        COUNT(*) as total_bookings,
        AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE 0 END) as avg_rating,
        COUNT(*) FILTER (WHERE has_dispute = true) as past_disputes,
        COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0) as completion_rate
       FROM bookings 
       WHERE barber_id = $1`,
      [booking.barber_id]
    );

    // Fetch customer history
    const customerHistoryQuery = await query(
      `SELECT 
        COUNT(*) as total_bookings,
        AVG(rating) as avg_rating,
        COUNT(*) FILTER (WHERE has_dispute = true) as past_disputes,
        EXTRACT(DAY FROM NOW() - MIN(created_at)) as account_age
       FROM bookings 
       WHERE customer_id = $1`,
      [booking.customer_id]
    );

    const barberHistory = barberHistoryQuery.rows[0];
    const customerHistory = customerHistoryQuery.rows[0];

    // Build prompt input
    const promptInput: DisputeResolutionInput = {
      bookingId,
      barberId: booking.barber_id,
      customerId: booking.customer_id,
      disputeReason,
      disputeDescription,
      evidence: {
        customerClaim: disputeDescription,
        bookingDetails: {
          serviceType: booking.service_type || 'Haircut',
          price: parseFloat(booking.price) || 35,
          scheduledTime: booking.scheduled_time,
          actualStartTime: booking.actual_start_time,
          actualEndTime: booking.actual_end_time,
        },
      },
      barberHistory: {
        totalBookings: parseInt(barberHistory.total_bookings) || 0,
        disputeRate: parseFloat(barberHistory.past_disputes) / (parseFloat(barberHistory.total_bookings) || 1),
        avgRating: parseFloat(barberHistory.avg_rating) || 0,
        completionRate: parseFloat(barberHistory.completion_rate) || 0,
        pastDisputes: parseInt(barberHistory.past_disputes) || 0,
      },
      customerHistory: {
        totalBookings: parseInt(customerHistory.total_bookings) || 0,
        disputeRate: parseFloat(customerHistory.past_disputes) / (parseFloat(customerHistory.total_bookings) || 1),
        avgRating: parseFloat(customerHistory.avg_rating) || 0,
        pastDisputes: parseInt(customerHistory.past_disputes) || 0,
        accountAge: parseInt(customerHistory.account_age) || 0,
      },
    };

    // Call AI
    const prompt = buildDisputeResolutionPrompt(promptInput);
    const aiResponse = await callAI<DisputeResolutionOutput>({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      jsonMode: true,
    });

    const result = aiResponse.parsed!;

    // Save recommendation
    await query(
      `INSERT INTO dispute_recommendations 
       (booking_id, barber_id, customer_id, at_fault, confidence, recommended_action, refund_percentage, reasoning, evidence_analyzed, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        bookingId,
        booking.barber_id,
        booking.customer_id,
        result.at_fault,
        result.confidence,
        result.recommended_action,
        result.refund_percentage,
        result.reasoning,
        JSON.stringify({ severity: result.severity, key_evidence: result.key_evidence }),
      ]
    );

    // Log event
    await query(
      `INSERT INTO ai_events_log 
       (event_type, event_data, processing_time_ms, status, ai_model, tokens_used, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'BOOKING_DISPUTED',
        JSON.stringify({ bookingId, disputeId, result }),
        Date.now() - startTime,
        'success',
        aiResponse.model,
        aiResponse.tokensUsed,
      ]
    );

    logger.info(`✅ Dispute ${disputeId} analyzed`, {
      atFault: result.at_fault,
      action: result.recommended_action,
      confidence: result.confidence,
    });

    return result;
  } catch (error: any) {
    logger.error(`❌ Dispute resolution failed for ${disputeId}:`, error);
    throw error;
  }
}

export const disputeResolutionWorker = new Worker(
  'dispute-resolution',
  resolveDisputeJob,
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
  }
);

