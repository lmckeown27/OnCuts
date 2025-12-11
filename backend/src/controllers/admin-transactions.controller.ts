/**
 * Admin Transactions Controller
 * 
 * Provides transaction history for admin dashboard
 * NOW QUERIES POSTGRESQL CACHE for fast performance!
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import blockchainQueryService from '../services/blockchain-query.service';
import { pool } from '../database/connection';

/**
 * GET /api/admin/transactions
 * Get recent transactions from PostgreSQL cache (with campus filter)
 */
export const getRecentTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { campus, limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string), 100);

    // Map campus ID to student address prefix
    // campus-1 (Cal Poly) = 0x1xxx
    // campus-2 (UCSB) = 0x2xxx
    // campus-3 (UCLA) = 0x3xxx
    const campusPrefix = campus === 'campus-1' ? '0x1%' :
                        campus === 'campus-2' ? '0x2%' :
                        campus === 'campus-3' ? '0x3%' : null;

    // Query PostgreSQL for recent bookings
    let query = `
      SELECT 
        b.blockchain_id as id,
        b.student_address as "from",
        b.barber_address as "to",
        b.amount,
        b.status,
        b.created_at,
        b.completed_at,
        b.cancelled_at,
        us.full_name as student_name,
        ub.full_name as barber_name
      FROM bookings b
      LEFT JOIN users us ON b.student_address = us.aptos_address
      LEFT JOIN users ub ON b.barber_address = ub.aptos_address
    `;

    const params: any[] = [];

    // Add campus filter if provided
    if (campusPrefix) {
      query += ` WHERE b.student_address LIKE $1`;
      params.push(campusPrefix);
    }

    query += ` ORDER BY COALESCE(b.completed_at, b.cancelled_at, b.created_at) DESC LIMIT $${params.length + 1}`;
    params.push(limitNum);

    const result = await pool.query(query, params);

    // Transform to frontend format
    const formattedTransactions = result.rows.map((booking: any) => ({
      id: `booking-${booking.id}`,
      type: booking.status === 2 ? 'completion' : 
            booking.status === 1 ? 'booking' :
            booking.status === 3 ? 'booking' : 'booking',
      timestamp: booking.completed_at || booking.cancelled_at || booking.created_at,
      amount: (booking.amount / 100).toFixed(2), // Convert cents to dollars
      from: booking.from,
      to: booking.to,
      status: booking.status === 2 ? 'completed' :
              booking.status === 1 ? 'confirmed' :
              booking.status === 3 ? 'cancelled' : 'pending',
      description: `${booking.student_name || 'Student'} → ${booking.barber_name || 'Barber'}`,
      txHash: `0x${booking.id.toString().padStart(64, '0')}`,
    }));

    logger.info('Admin fetched transactions', {
      count: formattedTransactions.length,
      campus: campus || 'all',
    });

    res.json({
      success: true,
      transactions: formattedTransactions,
      count: formattedTransactions.length,
      campus: campus || null,
    });
  } catch (error) {
    logger.error('Failed to fetch admin transactions:', error);
    next(error);
  }
};

/**
 * GET /api/admin/transactions/stats
 * Get transaction statistics
 */
export const getTransactionStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { campus, period = '24h' } = req.query;

    // Get platform stats from blockchain
    const stats = await blockchainQueryService.getPlatformStats();

    res.json({
      success: true,
      stats: {
        total_transactions: stats.totalBookings,
        total_volume_apt: 0, // TODO: Calculate from blockchain
        avg_transaction_value: 0,
        transactions_last_24h: 0, // TODO: Calculate from blockchain
      },
      period,
      campus: campus || null,
    });
  } catch (error) {
    logger.error('Failed to fetch transaction stats:', error);
    next(error);
  }
};


