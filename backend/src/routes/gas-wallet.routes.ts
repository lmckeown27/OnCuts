/**
 * Gas Wallet Routes
 * Admin-only routes for gas management and top-up requests
 */

import express from 'express';
import { authenticate } from '../middleware/auth';
import rateLimit from 'express-rate-limit';
import {
  getGasEstimate,
  createTopUpRequest,
  listTopUpRequests,
  confirmTopUpRequest,
  getTopUpRequest,
  manualMarkCompleted,
  getGasWalletHealth,
} from '../controllers/gas-wallet.controller';

const router = express.Router();

// Rate limiter for top-up request creation (prevent spam)
const topUpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many top-up requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /api/gas/estimate
 * Get current gas estimate and wallet status
 * Auth: Admin only
 */
router.get('/estimate', authenticate, getGasEstimate);

/**
 * POST /api/gas/topup-request
 * Create a new top-up request
 * Auth: Admin only
 * Rate limited: 5 requests per 15 minutes
 * 
 * Body:
 *   - idempotencyKey (optional): string - prevents duplicate requests
 *   - requestedAmountAPT (optional): number - if not provided, auto-calculated
 */
router.post('/topup-request', authenticate, topUpRequestLimiter, createTopUpRequest);

/**
 * GET /api/gas/topup-requests
 * List all top-up requests with pagination
 * Auth: Admin only
 * 
 * Query params:
 *   - status (optional): 'pending' | 'approved' | 'completed' | 'failed' | 'cancelled'
 *   - limit (optional): number (default 50)
 *   - offset (optional): number (default 0)
 */
router.get('/topup-requests', authenticate, listTopUpRequests);

/**
 * GET /api/gas/topup-request/:id
 * Get single top-up request details
 * Auth: Admin only
 */
router.get('/topup-request/:id', authenticate, getTopUpRequest);

/**
 * POST /api/gas/topup-request/:id/confirm
 * Confirm admin wallet transfer by providing transaction hash
 * Auth: Admin only
 * 
 * Body:
 *   - txHash: string - Aptos transaction hash
 *   - fromAddress: string - Admin wallet address that sent the transfer
 */
router.post('/topup-request/:id/confirm', authenticate, confirmTopUpRequest);

/**
 * POST /api/admin/gas/topup-request/:id/mark-completed
 * Manual override to mark request as completed (for reconciliation)
 * Auth: Admin only
 * 
 * Body:
 *   - verifiedAmountOctas: number - Amount that was actually received
 *   - note: string - Reason for manual completion
 */
router.post('/topup-request/:id/mark-completed', authenticate, manualMarkCompleted);

/**
 * GET /api/gas/health
 * Get gas wallet health status
 * Auth: Admin only
 */
router.get('/health', authenticate, getGasWalletHealth);

export default router;

