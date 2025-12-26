import { Router } from 'express';
import {
  submitApplication,
  getMyApplication,
  getAllApplications,
  updateApplicationStatus
} from '../controllers/barber-application.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   POST /api/v1/barber-applications
 * @desc    Submit a new barber application
 * @access  Private (authenticated users only)
 */
router.post('/', authenticate, submitApplication);

/**
 * @route   GET /api/v1/barber-applications/my-application
 * @desc    Get current user's application status
 * @access  Private (authenticated users only)
 */
router.get('/my-application', authenticate, getMyApplication);

/**
 * @route   GET /api/v1/barber-applications
 * @desc    Get all applications (admin/campus manager only)
 * @access  Private (admin only)
 */
router.get('/', authenticate, requireAdmin, getAllApplications);

/**
 * @route   PATCH /api/v1/barber-applications/:id/status
 * @desc    Update application status (admin/campus manager only)
 * @access  Private (admin only)
 */
router.patch('/:id/status', authenticate, requireAdmin, updateApplicationStatus);

export default router;

