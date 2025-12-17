/**
 * Campus Manager API Routes
 * 
 * Handles Campus Manager role management and dashboard data
 * All routes require authentication
 */

import { Router, Request, Response, NextFunction } from 'express';
import { campusManagerService } from '../services/campus-manager.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/campus-manager/check/:barberId
 * Check if a barber is a Campus Manager
 */
router.get('/check/:barberId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.params;
    
    const isCampusManager = await campusManagerService.isCampusManager(barberId);
    
    res.json({
      success: true,
      data: { isCampusManager },
    });
  } catch (error) {
    logger.error('Error checking Campus Manager status:', error);
    next(error);
  }
});

/**
 * GET /api/campus-manager/campus/:campusId
 * Get Campus Manager for a specific campus
 */
router.get('/campus/:campusId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campusId } = req.params;
    
    const campusManager = await campusManagerService.getCampusManager(campusId);
    
    res.json({
      success: true,
      data: { campusManager },
    });
  } catch (error) {
    logger.error('Error fetching Campus Manager:', error);
    next(error);
  }
});

/**
 * POST /api/campus-manager/promote
 * Promote a barber to Campus Manager (Admin only)
 */
router.post('/promote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, campusId } = req.body;
    
    if (!barberId || !campusId) {
      return res.status(400).json({
        success: false,
        error: 'barberId and campusId are required',
      });
    }
    
    const result = await campusManagerService.promoteToCampusManager(barberId, campusId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
    
    res.json({
      success: true,
      message: 'Barber promoted to Campus Manager successfully',
    });
  } catch (error) {
    logger.error('Error promoting to Campus Manager:', error);
    next(error);
  }
});

/**
 * POST /api/campus-manager/revoke
 * Revoke Campus Manager role (Admin only)
 */
router.post('/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.body;
    
    if (!barberId) {
      return res.status(400).json({
        success: false,
        error: 'barberId is required',
      });
    }
    
    const success = await campusManagerService.revokeCampusManager(barberId);
    
    res.json({
      success,
      message: success 
        ? 'Campus Manager role revoked successfully' 
        : 'Failed to revoke Campus Manager role',
    });
  } catch (error) {
    logger.error('Error revoking Campus Manager:', error);
    next(error);
  }
});

/**
 * GET /api/campus-manager/permissions
 * Get Campus Manager permissions list
 */
router.get('/permissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = campusManagerService.getCampusManagerPermissions();
    
    res.json({
      success: true,
      data: { permissions },
    });
  } catch (error) {
    logger.error('Error fetching permissions:', error);
    next(error);
  }
});

/**
 * POST /api/campus-manager/verify-permission
 * Verify a Campus Manager has permission for an action
 */
router.post('/verify-permission', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { barberId, campusId, action } = req.body;
    
    if (!barberId || !campusId || !action) {
      return res.status(400).json({
        success: false,
        error: 'barberId, campusId, and action are required',
      });
    }
    
    const hasPermission = await campusManagerService.verifyPermission(
      barberId,
      campusId,
      action
    );
    
    res.json({
      success: true,
      data: { hasPermission },
    });
  } catch (error) {
    logger.error('Error verifying permission:', error);
    next(error);
  }
});

export default router;

