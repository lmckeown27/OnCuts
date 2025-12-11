/**
 * Admin Transactions Routes
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as adminTransactionsController from '../controllers/admin-transactions.controller';

const router = Router();

/**
 * @route   GET /api/admin/transactions
 * @desc    Get recent transactions (with optional campus filter)
 * @access  Admin only
 */
router.get(
  '/',
  authenticate,
  adminTransactionsController.getRecentTransactions
);

/**
 * @route   GET /api/admin/transactions/stats
 * @desc    Get transaction statistics
 * @access  Admin only
 */
router.get(
  '/stats',
  authenticate,
  adminTransactionsController.getTransactionStats
);

export default router;

