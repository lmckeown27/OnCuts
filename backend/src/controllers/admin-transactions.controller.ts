/**
 * Admin Transactions Controller
 * 
 * Provides transaction history for admin dashboard
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import blockchainQueryService from '../services/blockchain-query.service';
import aptosMonitorService from '../services/aptos-monitor.service';

/**
 * GET /api/admin/transactions
 * Get recent transactions (with optional campus filter)
 */
export const getRecentTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { campus, limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string), 100);

    // Get recent transactions from Aptos monitor
    const transactions = await aptosMonitorService.getRecentTransactions(limitNum);

    // Transform to frontend format
    const formattedTransactions = transactions.map((tx: any) => ({
      id: tx.tx_hash || tx.version,
      type: mapTxType(tx.tx_type),
      timestamp: tx.timestamp,
      amount: tx.amount_usd,
      from: tx.sender,
      to: tx.recipient,
      status: tx.success ? 'confirmed' : 'failed',
      description: tx.description,
      txHash: tx.tx_hash,
    }));

    // Filter by campus if provided (TODO: implement campus filtering)
    const filtered = campus
      ? formattedTransactions // Would filter by campus in production
      : formattedTransactions;

    logger.info('Admin fetched transactions', {
      count: filtered.length,
      campus: campus || 'all',
    });

    res.json({
      success: true,
      transactions: filtered,
      count: filtered.length,
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

/**
 * Map transaction type to frontend display type
 */
function mapTxType(txType: string): 'booking' | 'payment' | 'completion' | 'withdrawal' | 'deposit' {
  if (txType === 'batch_withdrawal') return 'withdrawal';
  if (txType === 'onchain_proof') return 'completion';
  if (txType === 'deposit') return 'deposit';
  if (txType === 'withdrawal') return 'withdrawal';
  return 'payment';
}

