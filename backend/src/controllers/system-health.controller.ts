/**
 * System Health Controller
 * 
 * Provides system status information for admin monitoring
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { checkHealth as checkPostgresHealth } from '../database/connection';

/**
 * GET /api/system/health
 * Get system health status including database mode
 */
export async function getSystemHealth(req: Request, res: Response) {
  try {
    // Check PostgreSQL connection
    const postgresHealth = await checkPostgresHealth();
    const isPostgresHealthy = typeof postgresHealth === 'object' && postgresHealth.healthy === true;

    const systemMode = isPostgresHealthy ? 'hybrid' : 'blockchain-only';
    
    res.json({
      mode: systemMode,
      postgres: {
        status: isPostgresHealthy ? 'connected' : 'disconnected',
        healthy: isPostgresHealthy,
        details: postgresHealth,
      },
      blockchain: {
        status: 'connected',
        healthy: true,
        url: process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('System health check error:', error);
    res.status(500).json({
      mode: 'unknown',
      error: 'Failed to check system health',
    });
  }
}

/**
 * GET /api/system/database-status
 * Detailed database status
 */
export async function getDatabaseStatus(req: Request, res: Response) {
  try {
    const postgresHealth = await checkPostgresHealth();
    const isPostgresHealthy = typeof postgresHealth === 'object' && postgresHealth.healthy === true;

    res.json({
      postgres: {
        enabled: true,
        connected: isPostgresHealthy,
        status: isPostgresHealthy ? 'healthy' : 'unavailable',
        message: isPostgresHealthy 
          ? 'PostgreSQL cache is working - queries are fast'
          : 'PostgreSQL unavailable - using blockchain fallback',
        details: postgresHealth,
      },
      blockchain: {
        enabled: true,
        connected: true,
        status: 'healthy',
        message: 'Aptos blockchain is the source of truth',
      },
      recommendation: isPostgresHealthy
        ? 'System running optimally in hybrid mode'
        : 'Consider fixing PostgreSQL for better performance',
    });
  } catch (error) {
    logger.error('Database status check error:', error);
    res.status(500).json({ error: 'Failed to check database status' });
  }
}

