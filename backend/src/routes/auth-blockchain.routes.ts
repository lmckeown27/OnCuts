/**
 * Authentication Routes (Blockchain Version)
 * 
 * These routes use custodial signing + blockchain storage
 * NO PostgreSQL involved!
 */

import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import * as authController from '../controllers/auth-blockchain.controller';

const router = express.Router();

// Configure multer for image uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ═══════════════════════════════════════════════════════════
//  PUBLIC ROUTES (No authentication required)
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/auth-blockchain/signup
 * Create new user account (on-chain)
 * 
 * Body: { email, password, username, campus_domain, role }
 * Returns: { token, user }
 */
router.post('/signup', authController.signup);

/**
 * POST /api/auth-blockchain/login
 * Login existing user (load from blockchain)
 * 
 * Body: { email, password }
 * Returns: { token, user }
 */
router.post('/login', authController.login);

// ═══════════════════════════════════════════════════════════
//  PROTECTED ROUTES (Require authentication)
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/auth-blockchain/logout
 * Logout current user (clear session cache)
 * 
 * Returns: { success: true }
 */
router.post('/logout', authenticate, authController.logout);

/**
 * GET /api/auth-blockchain/me
 * Get current user (from blockchain)
 * 
 * Returns: { user }
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * PUT /api/auth-blockchain/profile
 * Update user profile (on-chain transaction)
 * 
 * Body: { username?, bio?, password }
 * Returns: { success: true }
 */
router.put('/profile', authenticate, authController.updateProfile);

/**
 * POST /api/auth-blockchain/profile/photo
 * Upload profile photo (IPFS + on-chain CID)
 * 
 * Body: multipart/form-data with 'photo' field
 * Returns: { photo_url, cid }
 */
router.post('/profile/photo', authenticate, upload.single('photo'), authController.uploadProfilePhoto);

export default router;

