/**
 * Internal API Server
 * 
 * Exposes AI-generated data to the main backend
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { query } from '../db/connection';
import { logger } from '../utils/logger';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'ai-worker' });
});

// GET /barber/:id/pricing
// Returns current pricing multiplier for a barber
app.get('/barber/:id/pricing', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        multiplier, 
        base_multiplier,
        campus_coefficient,
        demand_factor,
        quality_factor,
        reasoning,
        expires_at,
        created_at
       FROM barber_pricing_multipliers
       WHERE barber_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No pricing data found',
        defaultMultiplier: 1.0 
      });
    }

    res.json({
      barberId: id,
      multiplier: parseFloat(result.rows[0].multiplier),
      breakdown: {
        base: parseFloat(result.rows[0].base_multiplier),
        campusCoefficient: parseFloat(result.rows[0].campus_coefficient),
        demandFactor: parseFloat(result.rows[0].demand_factor),
        qualityFactor: parseFloat(result.rows[0].quality_factor),
      },
      reasoning: result.rows[0].reasoning,
      expiresAt: result.rows[0].expires_at,
      updatedAt: result.rows[0].created_at,
    });
  } catch (error) {
    logger.error('Error fetching barber pricing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /barber/:id/quality-score
// Returns current quality score for a barber
app.get('/barber/:id/quality-score', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        quality_score,
        sentiment_score,
        reasoning,
        factors,
        created_at
       FROM barber_quality_scores
       WHERE barber_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No quality score found',
        defaultScore: 50 
      });
    }

    res.json({
      barberId: id,
      qualityScore: parseFloat(result.rows[0].quality_score),
      sentimentScore: parseFloat(result.rows[0].sentiment_score),
      reasoning: result.rows[0].reasoning,
      factors: result.rows[0].factors,
      updatedAt: result.rows[0].created_at,
    });
  } catch (error) {
    logger.error('Error fetching quality score:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /barber/:id/history
// Returns historical pricing and quality trends
app.get('/barber/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 30 } = req.query;

    const pricingResult = await query(
      `SELECT multiplier, created_at
       FROM barber_pricing_multipliers
       WHERE barber_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, limit]
    );

    const qualityResult = await query(
      `SELECT quality_score, created_at
       FROM barber_quality_scores
       WHERE barber_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, limit]
    );

    res.json({
      barberId: id,
      pricing: pricingResult.rows.map(r => ({
        multiplier: parseFloat(r.multiplier),
        date: r.created_at,
      })),
      quality: qualityResult.rows.map(r => ({
        score: parseFloat(r.quality_score),
        date: r.created_at,
      })),
    });
  } catch (error) {
    logger.error('Error fetching barber history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/market-summary
// Returns current market summary across all campuses
app.get('/admin/market-summary', async (req: Request, res: Response) => {
  try {
    const marketStats = await query(
      `SELECT 
        campus_id,
        demand_index,
        active_barbers,
        active_customers,
        booking_velocity,
        supply_demand_ratio,
        insights,
        week_start,
        created_at
       FROM market_stats
       WHERE week_start = (SELECT MAX(week_start) FROM market_stats)
       ORDER BY demand_index DESC`
    );

    const fraudAlerts = await query(
      `SELECT COUNT(*) as count, risk_level
       FROM fraud_flags
       WHERE status = 'PENDING' AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY risk_level`
    );

    const disputes = await query(
      `SELECT COUNT(*) as count
       FROM dispute_recommendations
       WHERE created_at >= NOW() - INTERVAL '7 days' AND admin_decision IS NULL`
    );

    res.json({
      campuses: marketStats.rows.map((row: any) => ({
        campusId: row.campus_id,
        demandIndex: parseFloat(row.demand_index),
        activeBarbers: parseInt(row.active_barbers),
        activeCustomers: parseInt(row.active_customers),
        bookingVelocity: parseFloat(row.booking_velocity),
        supplyDemandRatio: parseFloat(row.supply_demand_ratio),
        insights: row.insights,
        weekStart: row.week_start,
      })),
      fraudAlerts: fraudAlerts.rows.reduce((acc: any, row: any) => {
        acc[row.risk_level] = parseInt(row.count);
        return acc;
      }, {}),
      pendingDisputes: parseInt(disputes.rows[0]?.count) || 0,
      lastUpdated: marketStats.rows[0]?.created_at,
    });
  } catch (error) {
    logger.error('Error fetching market summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/fraud-flags
// Returns recent fraud flags
app.get('/admin/fraud-flags', async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING', limit = 50 } = req.query;

    const result = await query(
      `SELECT 
        id,
        user_id,
        risk_score,
        risk_level,
        fraud_indicators,
        pattern_type,
        confidence,
        recommended_action,
        status,
        created_at
       FROM fraud_flags
       WHERE status = $1
       ORDER BY risk_score DESC, created_at DESC
       LIMIT $2`,
      [status, limit]
    );

    res.json({
      flags: result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        riskScore: parseFloat(row.risk_score),
        riskLevel: row.risk_level,
        fraudIndicators: row.fraud_indicators,
        patternType: row.pattern_type,
        confidence: parseFloat(row.confidence),
        recommendedAction: row.recommended_action,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    logger.error('Error fetching fraud flags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/disputes
// Returns dispute recommendations
app.get('/admin/disputes', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;

    const result = await query(
      `SELECT 
        id,
        booking_id,
        barber_id,
        customer_id,
        at_fault,
        confidence,
        recommended_action,
        refund_percentage,
        reasoning,
        evidence_analyzed,
        admin_decision,
        created_at
       FROM dispute_recommendations
       WHERE admin_decision IS NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      disputes: result.rows.map((row: any) => ({
        id: row.id,
        bookingId: row.booking_id,
        barberId: row.barber_id,
        customerId: row.customer_id,
        atFault: row.at_fault,
        confidence: parseFloat(row.confidence),
        recommendedAction: row.recommended_action,
        refundPercentage: parseFloat(row.refund_percentage),
        reasoning: row.reasoning,
        evidenceAnalyzed: row.evidence_analyzed,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    logger.error('Error fetching disputes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ai/events
// Returns recent AI processing events (for debugging)
app.get('/ai/events', async (req: Request, res: Response) => {
  try {
    const { limit = 100, eventType } = req.query;

    let queryText = `SELECT * FROM ai_events_log `;
    const params: any[] = [limit];

    if (eventType) {
      queryText += `WHERE event_type = $2 `;
      params.push(eventType);
    }

    queryText += `ORDER BY created_at DESC LIMIT $1`;

    const result = await query(queryText, params);

    res.json({
      events: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    logger.error('Error fetching AI events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export function startServer() {
  app.listen(PORT, () => {
    logger.info(`🚀 AI Worker API listening on port ${PORT}`);
  });
}

export default app;

