/**
 * Review Processing Processor
 * 
 * Processes new reviews and updates barber quality scores and pricing multipliers
 */

import { Job, Worker } from 'bullmq';
import { logger } from '../utils/logger';
import { callAI } from '../utils/openai-client';
import { query } from '../db/connection';
import { redisConnection } from '../queues';
import { 
  buildDynamicPricingPrompt, 
  DynamicPricingInput, 
  DynamicPricingOutput,
  SYSTEM_PROMPT 
} from '../prompts/dynamicPricingPrompt';

interface ReviewProcessingJobData {
  reviewId: string;
  barberId: string;
  customerId: string;
  rating: number;
  reviewText: string;
  bookingId: string;
  createdAt: string;
}

export async function processReviewJob(job: Job<ReviewProcessingJobData>) {
  const startTime = Date.now();
  const { reviewId, barberId, rating, reviewText, createdAt } = job.data;

  try {
    logger.info(`Processing review ${reviewId} for barber ${barberId}`);

    // 1. Fetch barber's performance data (last 60 days)
    const performanceQuery = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days') as total_bookings,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '60 days') as completed_bookings,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND created_at >= NOW() - INTERVAL '60 days') as cancelled_bookings,
        COUNT(*) FILTER (WHERE is_late = true AND created_at >= NOW() - INTERVAL '60 days') as late_arrivals
      FROM bookings 
      WHERE barber_id = $1`,
      [barberId]
    );

    // 2. Fetch recent reviews (last 20)
    const reviewsQuery = await query(
      `SELECT rating, review_text, created_at 
       FROM reviews 
       WHERE barber_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [barberId]
    );

    // 3. Calculate metrics
    const performance = performanceQuery.rows[0];
    const totalBookings = parseInt(performance.total_bookings) || 0;
    const completedBookings = parseInt(performance.completed_bookings) || 0;
    const cancelledBookings = parseInt(performance.cancelled_bookings) || 0;
    const lateArrivals = parseInt(performance.late_arrivals) || 0;

    const recentReviews = reviewsQuery.rows.map((r: any) => ({
      text: r.review_text,
      rating: parseFloat(r.rating),
      createdAt: r.created_at,
    }));

    // Calculate avg rating
    const avgRating = recentReviews.length > 0
      ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
      : 0;

    // Calculate behavioral metrics
    const cancellationRate = totalBookings > 0 ? cancelledBookings / totalBookings : 0;
    const latenessRate = totalBookings > 0 ? lateArrivals / totalBookings : 0;

    // Get repeat customer rate
    const repeatQuery = await query(
      `SELECT 
        COUNT(DISTINCT customer_id) as unique_customers,
        COUNT(*) as total_bookings
       FROM bookings 
       WHERE barber_id = $1 AND created_at >= NOW() - INTERVAL '60 days'`,
      [barberId]
    );
    const uniqueCustomers = parseInt(repeatQuery.rows[0]?.unique_customers) || 1;
    const repeatCustomerRate = totalBookings > 0 
      ? 1 - (uniqueCustomers / totalBookings) 
      : 0;

    // Get campus demand index (from market_stats)
    const campusQuery = await query(
      `SELECT demand_index 
       FROM market_stats 
       WHERE campus_id = (SELECT campus FROM users WHERE id = $1)
       ORDER BY created_at DESC 
       LIMIT 1`,
      [barberId]
    );
    const campusMarketDemandIndex = parseFloat(campusQuery.rows[0]?.demand_index) || 1.0;

    // Get current quality score
    const currentScoreQuery = await query(
      `SELECT quality_score 
       FROM barber_quality_scores 
       WHERE barber_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [barberId]
    );
    const historicalQualityScore = parseFloat(currentScoreQuery.rows[0]?.quality_score) || 50;

    // Get current multiplier
    const currentMultiplierQuery = await query(
      `SELECT multiplier 
       FROM barber_pricing_multipliers 
       WHERE barber_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [barberId]
    );
    const currentMultiplier = parseFloat(currentMultiplierQuery.rows[0]?.multiplier) || 1.0;

    // 4. Build prompt input
    const promptInput: DynamicPricingInput = {
      barberId,
      recentReviews,
      performanceLast60Days: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        lateArrivals,
        avgRating,
        reviewCount: recentReviews.length,
      },
      cancellationRate,
      latenessRate,
      repeatCustomerRate,
      campusMarketDemandIndex,
      historicalQualityScore,
      currentMultiplier,
    };

    // 5. Call AI
    const prompt = buildDynamicPricingPrompt(promptInput);
    const aiResponse = await callAI<DynamicPricingOutput>({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      jsonMode: true,
    });

    const result = aiResponse.parsed!;

    // 6. Save quality score
    await query(
      `INSERT INTO barber_quality_scores 
       (barber_id, quality_score, sentiment_score, reasoning, factors, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        barberId,
        result.quality_score,
        result.sentiment_score,
        result.reasoning,
        JSON.stringify({
          demand_factor: result.demand_factor,
          quality_factor: result.quality_factor,
          campus_coefficient: result.campus_coefficient,
          flags: result.flags,
        }),
      ]
    );

    // 7. Save pricing multiplier
    await query(
      `INSERT INTO barber_pricing_multipliers 
       (barber_id, multiplier, base_multiplier, campus_coefficient, demand_factor, quality_factor, reasoning, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days', NOW())`,
      [
        barberId,
        result.pricing_multiplier,
        1.0,
        result.campus_coefficient,
        result.demand_factor,
        result.quality_factor,
        result.reasoning,
      ]
    );

    // 8. Log AI event
    await query(
      `INSERT INTO ai_events_log 
       (event_type, event_data, processing_time_ms, status, ai_model, tokens_used, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'NEW_REVIEW_CREATED',
        JSON.stringify({ reviewId, barberId, result }),
        Date.now() - startTime,
        'success',
        aiResponse.model,
        aiResponse.tokensUsed,
      ]
    );

    // 9. Check for concerning flags
    if (result.flags.includes('QUALITY_DECLINE') || result.flags.includes('FRAUD_RISK')) {
      logger.warn(`⚠️ Quality concern for barber ${barberId}:`, result.flags);
      // Could trigger admin notification here
    }

    logger.info(`✅ Review processed for barber ${barberId}`, {
      qualityScore: result.quality_score,
      multiplier: result.pricing_multiplier,
      flags: result.flags,
    });

    return result;
  } catch (error: any) {
    logger.error(`❌ Failed to process review ${reviewId}:`, error);
    
    // Log failure
    await query(
      `INSERT INTO ai_events_log 
       (event_type, event_data, processing_time_ms, status, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        'NEW_REVIEW_CREATED',
        JSON.stringify({ reviewId, barberId }),
        Date.now() - startTime,
        'failure',
        error.message,
      ]
    );

    throw error;
  }
}

// Create worker
export const reviewProcessingWorker = new Worker(
  'review-processing',
  processReviewJob,
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
  }
);

reviewProcessingWorker.on('completed', (job) => {
  logger.info(`Review processing job ${job.id} completed`);
});

reviewProcessingWorker.on('failed', (job, err) => {
  logger.error(`Review processing job ${job?.id} failed:`, err);
});

