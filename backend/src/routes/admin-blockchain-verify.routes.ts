/**
 * Admin Blockchain Verification Routes
 * 
 * Endpoints for admins to:
 * 1. Manually verify payment against blockchain
 * 2. Trigger reconciliation job
 * 3. View discrepancy logs
 * 4. Repair corrupted data
 * 
 * All endpoints require admin authentication
 */

import { Router, Request, Response } from 'express';
import { blockchainSyncService } from '../services/blockchain-sync.service';
import { blockchainReconciliationJob } from '../services/blockchain-reconciliation.job';
// NOTE: Prisma imports require hybrid schema to be deployed
// import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

// Mock Prisma client until hybrid schema is deployed
const prisma = {
  booking: {
    findUnique: async () => null,
  },
  blockchainSyncLog: {
    findMany: async () => [],
  },
  dataDiscrepancy: {
    findMany: async () => [],
    count: async () => 0,
    update: async () => ({}),
    groupBy: async () => [],
  },
  paymentCache: {
    findUnique: async () => null,
    count: async () => 0,
    groupBy: async () => [],
  },
} as any;

// ═══════════════════════════════════════════════════════════════
// VERIFICATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /admin/blockchain/verify-payment
 * Manually verify a payment against blockchain
 */
router.post('/verify-payment', async (req: Request, res: Response) => {
  try {
    const { paymentId, autoRepair } = req.body;
    
    if (!paymentId) {
      throw new ApiError(400, 'paymentId is required');
    }
    
    logger.info('Admin verifying payment against blockchain', {
      payment_id: paymentId,
      admin_id: req.user?.userId,
      auto_repair: autoRepair
    });
    
    // Verify
    const verification = await blockchainSyncService.verifyPaymentCache(paymentId);
    
    // Auto-repair if requested and discrepancies found
    let repairResult = null;
    if (autoRepair && !verification.matches) {
      repairResult = await blockchainSyncService.repairPaymentCache(paymentId);
    }
    
    res.json({
      success: true,
      verification: {
        matches: verification.matches,
        discrepancies: verification.discrepancies,
        blockchainState: verification.blockchainState,
        postgresState: verification.postgresState
      },
      repair: repairResult
    });
    
  } catch (error: any) {
    logger.error('Admin payment verification failed', {
      error: error.message,
      admin_id: req.user?.userId
    });
    throw error;
  }
});

/**
 * POST /admin/blockchain/repair-payment
 * Manually repair a payment from blockchain
 */
router.post('/repair-payment', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    
    if (!paymentId) {
      throw new ApiError(400, 'paymentId is required');
    }
    
    logger.warn('Admin manually repairing payment', {
      payment_id: paymentId,
      admin_id: req.user?.userId
    });
    
    const result = await blockchainSyncService.repairPaymentCache(paymentId);
    
    res.json({
      success: result.success,
      updated: result.updated,
      discrepancyDetected: result.discrepancyDetected,
      error: result.error
    });
    
  } catch (error: any) {
    logger.error('Admin payment repair failed', {
      error: error.message,
      admin_id: req.user?.userId
    });
    throw error;
  }
});

/**
 * POST /admin/blockchain/verify-booking
 * Verify entire booking (payment + barber earnings)
 */
router.post('/verify-booking', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;
    
    if (!bookingId) {
      throw new ApiError(400, 'bookingId is required');
    }
    
    // Get booking with payment cache
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        paymentCache: true,
        barber: {
          include: { user: true }
        }
      }
    });
    
    if (!booking) {
      throw new ApiError(404, 'Booking not found');
    }
    
    if (!booking.paymentCache) {
      throw new ApiError(404, 'Payment cache not found');
    }
    
    // Verify payment
    const paymentVerification = await blockchainSyncService.verifyPaymentCache(
      booking.paymentCache.blockchainPaymentId
    );
    
    res.json({
      success: true,
      booking: {
        id: booking.id,
        status: booking.bookingStatus,
        paymentStatus: booking.paymentStatus
      },
      verification: {
        payment: paymentVerification
      }
    });
    
  } catch (error: any) {
    logger.error('Admin booking verification failed', {
      error: error.message,
      admin_id: req.user?.userId
    });
    throw error;
  }
});

// ═══════════════════════════════════════════════════════════════
// RECONCILIATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /admin/blockchain/reconcile
 * Manually trigger reconciliation job
 */
router.post('/reconcile', async (req: Request, res: Response) => {
  try {
    logger.info('Admin triggered manual reconciliation', {
      admin_id: req.user?.userId
    });
    
    const result = await blockchainReconciliationJob.triggerManual();
    
    res.json({
      success: true,
      result: {
        recordsScanned: result.recordsScanned,
        recordsUpdated: result.recordsUpdated,
        discrepanciesFound: result.discrepanciesFound,
        errorsEncountered: result.errorsEncountered,
        duration: result.duration,
        details: result.details.slice(0, 20) // Limit response size
      }
    });
    
  } catch (error: any) {
    logger.error('Admin reconciliation trigger failed', {
      error: error.message,
      admin_id: req.user?.userId
    });
    throw error;
  }
});

/**
 * GET /admin/blockchain/reconciliation-status
 * Get current reconciliation job status
 */
router.get('/reconciliation-status', async (req: Request, res: Response) => {
  try {
    const status = blockchainReconciliationJob.getStatus();
    
    // Get last 10 sync logs
    const recentLogs = await prisma.blockchainSyncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10
    });
    
    res.json({
      success: true,
      status: {
        isRunning: status.isRunning,
        lastRunAt: status.lastRunAt
      },
      recentLogs
    });
    
  } catch (error: any) {
    logger.error('Failed to get reconciliation status', {
      error: error.message
    });
    throw error;
  }
});

// ═══════════════════════════════════════════════════════════════
// DISCREPANCY MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /admin/blockchain/discrepancies
 * List all data discrepancies
 */
router.get('/discrepancies', async (req: Request, res: Response) => {
  try {
    const { resolved, limit = 50 } = req.query;
    
    const discrepancies = await prisma.dataDiscrepancy.findMany({
      where: resolved !== undefined ? {
        resolved: resolved === 'true'
      } : undefined,
      orderBy: { detectedAt: 'desc' },
      take: parseInt(limit as string)
    });
    
    res.json({
      success: true,
      discrepancies
    });
    
  } catch (error: any) {
    logger.error('Failed to list discrepancies', {
      error: error.message
    });
    throw error;
  }
});

/**
 * POST /admin/blockchain/discrepancies/:id/resolve
 * Mark discrepancy as resolved
 */
router.post('/discrepancies/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;
    
    const discrepancy = await prisma.dataDiscrepancy.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user?.userId,
        resolutionAction: resolution
      }
    });
    
    res.json({
      success: true,
      discrepancy
    });
    
  } catch (error: any) {
    logger.error('Failed to resolve discrepancy', {
      error: error.message,
      admin_id: req.user?.userId
    });
    throw error;
  }
});

// ═══════════════════════════════════════════════════════════════
// AUDIT & REPORTING
// ═══════════════════════════════════════════════════════════════

/**
 * GET /admin/blockchain/sync-health
 * Get overall sync health metrics
 */
router.get('/sync-health', async (req: Request, res: Response) => {
  try {
    // Count recent discrepancies
    const recentDiscrepancies = await prisma.dataDiscrepancy.count({
      where: {
        detectedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24h
        }
      }
    });
    
    // Count unresolved discrepancies
    const unresolvedCount = await prisma.dataDiscrepancy.count({
      where: { resolved: false }
    });
    
    // Get last successful sync
    const lastSuccessfulSync = await prisma.blockchainSyncLog.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' }
    });
    
    // Count payments by sync source
    const syncSources = await prisma.paymentCache.groupBy({
      by: ['syncSource'],
      _count: true
    });
    
    // Count repeated discrepancies (potential corruption)
    const repeatedDiscrepancies = await prisma.paymentCache.count({
      where: {
        discrepancyCount: { gte: 3 }
      }
    });
    
    res.json({
      success: true,
      health: {
        recentDiscrepancies24h: recentDiscrepancies,
        unresolvedDiscrepancies: unresolvedCount,
        repeatedDiscrepancies,
        lastSuccessfulSync: lastSuccessfulSync?.completedAt,
        syncSources,
        status: unresolvedCount === 0 && repeatedDiscrepancies === 0 ? 'healthy' : 'needs_attention'
      }
    });
    
  } catch (error: any) {
    logger.error('Failed to get sync health', {
      error: error.message
    });
    throw error;
  }
});

export default router;


