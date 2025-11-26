/**
 * Upload Routes for CampusCuts
 * Handles image uploads for barber portfolios and profile pictures
 */

import express from 'express';
import imageService from '../services/image.service';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/upload/portfolio
 * Upload barber portfolio images (multiple)
 */
router.post(
  '/portfolio',
  authenticateToken,
  imageService.uploadMultipleImages,
  async (req, res, next) => {
    try {
      const userId = (req as any).user.id;
      const files = (req as any).files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'No images provided' },
        });
      }

      const processedImages = [];

      for (const file of files) {
        const result = await imageService.processPortfolioImage(file.buffer);
        processedImages.push({
          url: imageService.generateImageUrl(result.original),
          thumbnailUrl: imageService.generateImageUrl(result.thumbnail, 'thumbnail'),
          filename: result.original,
        });
      }

      res.json({
        success: true,
        message: 'Portfolio images uploaded successfully',
        data: { images: processedImages },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/upload/profile-picture
 * Upload profile picture (single)
 */
router.post(
  '/profile-picture',
  authenticateToken,
  imageService.uploadSingleImage,
  async (req, res, next) => {
    try {
      const userId = (req as any).user.id;
      const file = (req as any).file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No image provided' },
        });
      }

      const result = await imageService.processProfilePicture(file.buffer);

      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        data: {
          url: imageService.generateImageUrl(result.original),
          thumbnailUrl: imageService.generateImageUrl(result.thumbnail, 'thumbnail'),
          filename: result.original,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/upload/chat-image
 * Upload image in chat conversation
 */
router.post(
  '/chat-image',
  authenticateToken,
  imageService.uploadSingleImage,
  async (req, res, next) => {
    try {
      const userId = (req as any).user.id;
      const file = (req as any).file;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No image provided' },
        });
      }

      const result = await imageService.processAndSaveImage(file.buffer, 'chat', {
        width: 800,
        height: 800,
        quality: 80,
      });

      res.json({
        success: true,
        message: 'Chat image uploaded successfully',
        data: {
          url: imageService.generateImageUrl(result.original),
          filename: result.original,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

