/**
 * Market Demand Processor
 */

import { Job, Worker } from 'bullmq';
import { logger } from '../utils/logger';
import { callAIMini } from '../utils/openai-client';
import { query } from '../db/connection';
import { redisConnection } from '../queues';
import { 
  buildMarketDemandPrompt, 
  MarketDemandInput, 
  MarketDemandOutput,
  SYSTEM_PROMPT 
} from '../prompts/marketDemandPrompt';

interface MarketDemandJobData {
  campusId: string;
  campusName: string;
}

export async function calculateMarketDemandJob(job: Job<MarketDemandJobData>) {
  const startTime = Date.now();
  const { campusId, campusName } = job.data;

  try {
    logger.info(`Calculating market demand for campus ${campusName}`);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = new Date();

    // Fetch supply metrics
    const supplyQuery = await query(
      `SELECT 
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'barber' AND u.is_active = true) as active_barbers,
        COUNT(*) FILTER (WHERE u.role = 'barber' AND u.created_at >= $2) as new_barbers
       FROM users u
       WHERE u.campus = $1`,
      [campusId, weekStart]
    );

    // Fetch demand metrics
    const demandQuery = await query(
      `SELECT 
        COUNT(*) as total_bookings,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_bookings,
        AVG(EXTRACT(EPOCH FROM (actual_start_time - scheduled_time)) / 3600) as avg_wait_hours
       FROM bookings 
       WHERE campus_id = $1 AND created_at >= $2`,
      [campusId, weekStart]
    );

    const supply = supplyQuery.rows[0];
    const demand = demandQuery.rows[0];

    // Build input
    const promptInput: MarketDemandInput = {
      campusId,
      campusName,
      timeRange: {
        start: weekStart.toISOString(),
        end: weekEnd.toISOString(),
      },
      supplyMetrics: {
        activeBarbers: parseInt(supply.active_barbers) || 0,
        totalCapacity: (parseInt(supply.active_barbers) || 0) * 40, // Assume 40 bookings/week per barber
        avgAvailability: 40,
        newBarbers: parseInt(supply.new_barbers) || 0,
      },
      demandMetrics: {
        activeCustomers: 0, // Would fetch from users table
        totalBookings: parseInt(demand.total_bookings) || 0,
        pendingBookings: parseInt(demand.pending_bookings) || 0,
        searchVolume: 0,
        avgWaitTime: parseFloat(demand.avg_wait_hours) || 0,
        peakWaitTime: 0,
      },
      bookingPatterns: {
        hourlyDistribution: [],
        dayOfWeekDistribution: [],
        serviceTypeDistribution: [],
      },
      cancellationData: {
        totalCancellations: 0,
        customerCancellations: 0,
        barberCancellations: 0,
        cancellationRate: 0,
      },
      pricing: {
        avgPrice: 35,
        priceRange: { min: 25, max: 50 },
        avgMultiplier: 1.0,
      },
      growth: {
        weekOverWeekBookings: 0,
        weekOverWeekRevenue: 0,
        monthOverMonthActive: 0,
      },
    };

    // Call AI (using mini model for cost efficiency)
    const prompt = buildMarketDemandPrompt(promptInput);
    const aiResponse = await callAIMini<MarketDemandOutput>({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      jsonMode: true,
    });

    const result = aiResponse.parsed!;

    // Save market stats
    await query(
      `INSERT INTO market_stats 
       (campus_id, demand_index, active_barbers, active_customers, booking_velocity, supply_demand_ratio, insights, week_start, week_end, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (campus_id, week_start) 
       DO UPDATE SET demand_index = $2, booking_velocity = $5, supply_demand_ratio = $6, insights = $7`,
      [
        campusId,
        result.demand_index,
        promptInput.supplyMetrics.activeBarbers,
        promptInput.demandMetrics.activeCustomers,
        result.booking_velocity,
        result.supply_demand_ratio,
        result.growth_forecast,
        weekStart,
        weekEnd,
      ]
    );

    // Log event
    await query(
      `INSERT INTO ai_events_log 
       (event_type, event_data, processing_time_ms, status, ai_model, tokens_used, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'MARKET_DEMAND_UPDATE',
        JSON.stringify({ campusId, result }),
        Date.now() - startTime,
        'success',
        aiResponse.model,
        aiResponse.tokensUsed,
      ]
    );

    logger.info(`✅ Market demand calculated for ${campusName}`, {
      demandIndex: result.demand_index,
      marketHealth: result.market_health,
    });

    return result;
  } catch (error: any) {
    logger.error(`❌ Market demand calculation failed for ${campusName}:`, error);
    throw error;
  }
}

export const marketDemandWorker = new Worker(
  'market-demand',
  calculateMarketDemandJob,
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
  }
);

