/**
 * Weekly Summary Processor
 */

import { Job, Worker } from 'bullmq';
import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';
import { callAI } from '../utils/openai-client';
import { query } from '../db/connection';
import { redisConnection } from '../queues';
import { 
  buildWeeklySummaryPrompt, 
  WeeklySummaryInput, 
  WeeklySummaryOutput,
  SYSTEM_PROMPT 
} from '../prompts/weeklySummaryPrompt';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export async function generateWeeklySummaryJob(job: Job) {
  const startTime = Date.now();

  try {
    logger.info('Generating weekly summary');

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = new Date();

    // Fetch platform metrics
    const metricsQuery = await query(
      `SELECT 
        COALESCE(SUM(price), 0) as total_revenue,
        COUNT(*) as total_bookings,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings
       FROM bookings 
       WHERE created_at >= $1 AND created_at < $2`,
      [weekStart, weekEnd]
    );

    const userGrowthQuery = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) as new_users,
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2 AND role = 'barber') as new_barbers,
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2 AND role = 'customer') as new_customers,
        COUNT(*) FILTER (WHERE role = 'barber' AND is_active = true) as active_barbers,
        COUNT(*) FILTER (WHERE role = 'customer' AND is_active = true) as active_customers
       FROM users`,
      [weekStart, weekEnd]
    );

    // Fetch top performing barbers
    const topBarbersQuery = await query(
      `SELECT 
        u.id, u.name,
        COUNT(b.*) as bookings,
        SUM(b.price) as revenue,
        AVG(r.rating) as rating,
        (SELECT quality_score FROM barber_quality_scores WHERE barber_id = u.id ORDER BY created_at DESC LIMIT 1) as quality_score
       FROM users u
       JOIN bookings b ON u.id = b.barber_id
       LEFT JOIN reviews r ON b.id = r.booking_id
       WHERE b.created_at >= $1 AND b.created_at < $2
       GROUP BY u.id, u.name
       ORDER BY revenue DESC
       LIMIT 5`,
      [weekStart, weekEnd]
    );

    // Build input
    const promptInput: WeeklySummaryInput = {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      platformMetrics: {
        totalRevenue: parseFloat(metricsQuery.rows[0]?.total_revenue) || 0,
        totalBookings: parseInt(metricsQuery.rows[0]?.total_bookings) || 0,
        completedBookings: parseInt(metricsQuery.rows[0]?.completed_bookings) || 0,
        cancelledBookings: parseInt(metricsQuery.rows[0]?.cancelled_bookings) || 0,
        newUsers: parseInt(userGrowthQuery.rows[0]?.new_users) || 0,
        newBarbers: parseInt(userGrowthQuery.rows[0]?.new_barbers) || 0,
        newCustomers: parseInt(userGrowthQuery.rows[0]?.new_customers) || 0,
        activeBarbers: parseInt(userGrowthQuery.rows[0]?.active_barbers) || 0,
        activeCustomers: parseInt(userGrowthQuery.rows[0]?.active_customers) || 0,
      },
      topPerformingBarbers: topBarbersQuery.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        bookings: parseInt(row.bookings),
        revenue: parseFloat(row.revenue),
        rating: parseFloat(row.rating) || 0,
        qualityScore: parseFloat(row.quality_score) || 0,
      })),
      underperformingBarbers: [],
      campusBreakdown: [],
      fraudAlerts: [],
      disputes: [],
      pricingChanges: [],
      anomalies: [],
      previousWeekComparison: {
        revenueChange: 0,
        bookingChange: 0,
        userGrowth: 0,
      },
    };

    // Call AI
    const prompt = buildWeeklySummaryPrompt(promptInput);
    const aiResponse = await callAI<WeeklySummaryOutput>({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      jsonMode: true,
      maxTokens: 3000,
    });

    const result = aiResponse.parsed!;

    // Save summary
    await query(
      `INSERT INTO weekly_admin_summaries 
       (week_start, week_end, total_revenue, total_bookings, new_users, fraud_alerts, dispute_count,
        top_performing_barbers, market_trends, recommendations, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        weekStart,
        weekEnd,
        promptInput.platformMetrics.totalRevenue,
        promptInput.platformMetrics.totalBookings,
        promptInput.platformMetrics.newUsers,
        0,
        0,
        JSON.stringify(result.barber_highlights),
        JSON.stringify(result.market_predictions),
        result.recommended_actions.join('; '),
      ]
    );

    // Send email
    if (process.env.SENDGRID_API_KEY && process.env.ADMIN_EMAIL) {
      const emailHtml = `
        <h1>CampusCuts Weekly Summary</h1>
        <h2>${promptInput.weekStart} to ${promptInput.weekEnd}</h2>
        
        <h3>Executive Summary</h3>
        <p>${result.executive_summary}</p>
        
        <h3>Key Metrics</h3>
        <ul>
          <li>Revenue Trend: ${result.key_metrics.revenue_trend}</li>
          <li>Booking Trend: ${result.key_metrics.booking_trend}</li>
          <li>Platform Health Score: ${result.key_metrics.health_score}/100</li>
        </ul>
        
        <h3>Top Insights</h3>
        <ul>${result.top_insights.map(i => `<li>${i}</li>`).join('')}</ul>
        
        <h3>Recommended Actions</h3>
        <ol>${result.recommended_actions.map(a => `<li>${a}</li>`).join('')}</ol>
      `;

      await sgMail.send({
        to: process.env.ADMIN_EMAIL,
        from: process.env.ADMIN_EMAIL,
        subject: `CampusCuts Weekly Summary - ${promptInput.weekStart}`,
        html: emailHtml,
      });

      await query(
        `UPDATE weekly_admin_summaries 
         SET email_sent = true, email_sent_at = NOW() 
         WHERE week_start = $1`,
        [weekStart]
      );
    }

    // Log event
    await query(
      `INSERT INTO ai_events_log 
       (event_type, event_data, processing_time_ms, status, ai_model, tokens_used, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'WEEKLY_SUMMARY',
        JSON.stringify({ weekStart, result }),
        Date.now() - startTime,
        'success',
        aiResponse.model,
        aiResponse.tokensUsed,
      ]
    );

    logger.info(`✅ Weekly summary generated and emailed`);

    return result;
  } catch (error: any) {
    logger.error(`❌ Weekly summary generation failed:`, error);
    throw error;
  }
}

export const weeklySummaryWorker = new Worker(
  'weekly-summary',
  generateWeeklySummaryJob,
  {
    connection: redisConnection,
    concurrency: 1, // Only one summary at a time
  }
);

