/**
 * AI Routes
 * 
 * API endpoints for accessing AI-generated data
 */

import { Router } from 'express';
import {
  getBarberPricing,
  getBarberQuality,
  getBarberHistory,
  calculateBookingPrice,
  getMarketSummary,
  getFraudFlags,
  getDisputes,
  getAdminDashboard,
  getBarberAnalytics,
} from '../controllers/ai.controller';

const router = Router();

// Barber AI data
router.get('/barber/:barberId/pricing', getBarberPricing);
router.get('/barber/:barberId/quality', getBarberQuality);
router.get('/barber/:barberId/history', getBarberHistory);
router.get('/barber/:barberId/analytics', getBarberAnalytics);

// Booking price calculation
router.post('/booking/calculate-price', calculateBookingPrice);

// Admin AI data
router.get('/admin/market-summary', getMarketSummary);
router.get('/admin/fraud-flags', getFraudFlags);
router.get('/admin/disputes', getDisputes);
router.get('/admin/dashboard', getAdminDashboard);

export default router;

