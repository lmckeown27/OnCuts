import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getUserProfile,
  updateUserProfile,
  updateMyProfile,
  uploadProfilePhoto,
  getNotificationPreferences,
  updateNotificationPreferences,
  changePassword,
  setInitialPassword,
  deleteAccount
} from '../controllers/user.controller';
import {
  updateUserLocation,
  getUserLocation
} from '../controllers/user-location.controller';

const router = express.Router();

// Location tracking (requires authentication)
router.get('/location', authenticate, getUserLocation);
router.put('/location', authenticate, updateUserLocation);

// Must be before `/:id` so "me" is not captured as an id
router.put('/me/set-initial-password', authenticate, setInitialPassword);
router.put('/me', authenticate, updateMyProfile);

// Profile management (auth temporarily disabled for demo)
router.get('/:id', getUserProfile);
router.put('/:id', updateUserProfile);
router.post('/:id/profile-photo', uploadProfilePhoto);

// Notification preferences
router.get('/:id/notification-preferences', getNotificationPreferences);
router.put('/:id/notification-preferences', updateNotificationPreferences);

// Security
router.put('/:id/change-password', changePassword);
router.delete('/:id', authenticate, deleteAccount);

export default router;

