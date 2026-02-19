/**
 * Admin Routes
 * 
 * Admin-only operations for platform management
 */

import express from 'express';
import { authenticate } from '../middleware/auth';
import * as adminController from '../controllers/admin.controller';

const router = express.Router();

// All routes require authentication and admin role
// Role check is done in controllers

// Platform Fees
router.get('/fees', authenticate, adminController.getPlatformFees);
router.post('/fees/withdraw', authenticate, adminController.withdrawPlatformFees);

// Reconciliation
router.post('/reconciliation/run', authenticate, adminController.runReconciliation);
router.get('/reconciliation/reports', authenticate, adminController.getReconciliationReports);

// Withdrawal Batches
router.get('/withdrawals/batches', authenticate, adminController.getWithdrawalBatches);
router.post('/withdrawals/process-batch', authenticate, adminController.processBatch);

// User Management
router.get('/users/:userId/balance', authenticate, adminController.getUserBalance);
router.post('/users/:userId/credit', authenticate, adminController.issueCredit);

// Audit Logs
router.get('/audit-logs', authenticate, adminController.getAuditLogs);

// Treasury Stats
router.get('/treasury', authenticate, adminController.getTreasuryStats);

// Platform Stats (total users, bookings, etc.)
router.get('/stats', authenticate, adminController.getPlatformStats);

export default router;

