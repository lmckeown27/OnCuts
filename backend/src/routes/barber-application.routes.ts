import { Router } from 'express';
import {
  submitApplication,
  getMyApplication,
  getAllApplications,
  updateApplicationStatus
} from '../controllers/barber-application.controller';
import { authenticateToken, isAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   POST /api/v1/barber-applications
 * @desc    Submit a new barber application
 * @access  Private (authenticated users only)
 */
router.post('/', authenticateToken, submitApplication);

/**
 * @route   GET /api/v1/barber-applications/my-application
 * @desc    Get current user's application status
 * @access  Private (authenticated users only)
 */
router.get('/my-application', authenticateToken, getMyApplication);

/**
 * @route   GET /api/v1/barber-applications
 * @desc    Get all applications (admin/campus manager only)
 * @access  Private (admin only)
 */
router.get('/', authenticateToken, isAdmin, getAllApplications);

/**
 * @route   PATCH /api/v1/barber-applications/:id/status
 * @desc    Update application status (admin/campus manager only)
 * @access  Private (admin only)
 */
router.patch('/:id/status', authenticateToken, isAdmin, updateApplicationStatus);

export default router;

