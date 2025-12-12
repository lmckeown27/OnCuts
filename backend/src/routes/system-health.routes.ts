/**
 * System Health Routes
 */

import { Router } from 'express';
import {
  getSystemHealth,
  getDatabaseStatus,
} from '../controllers/system-health.controller';

const router = Router();

// System health endpoints
router.get('/health', getSystemHealth);
router.get('/database-status', getDatabaseStatus);

export default router;

