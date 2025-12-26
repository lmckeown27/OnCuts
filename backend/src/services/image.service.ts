/**
 * Image Processing Service for CampusCuts
 * Transferred from CampusKinect with CampusCuts adaptations
 * 
 * Handles:
 * - Barber portfolio image processing
 * - Profile picture processing
 * - Image optimization and compression
 * - Thumbnail generation
 * - Image validation
 */

import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
    files: 8, // Maximum 8 files for barber portfolio
  },
});

// Process and save image options
interface ProcessImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

interface ProcessedImageResult {
  original: string;
  thumbnail: string;
  path: string;
  thumbnailPath: string;
}

/**
 * Process and save image with optimization
 */
export const processAndSaveImage = async (
  buffer: Buffer,
  filename: string,
  options: ProcessImageOptions = {}
): Promise<ProcessedImageResult> => {
  try {
    const { width = 1200, height = 900, quality = 85, format = 'jpeg' } = options;

    // Process image with sharp - maintain aspect ratio
    let processedImage = sharp(buffer)
      .resize(width, height, {
        fit: 'inside', // Maintains aspect ratio
        withoutEnlargement: true,
      })
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
      });

    if (format === 'png') {
      processedImage = processedImage.png();
    } else if (format === 'webp') {
      processedImage = processedImage.webp({ quality });
    }

    // Generate unique filename
    const uniqueFilename = `${uuidv4()}-${Date.now()}.${format}`;
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    const fullPath = path.join(uploadPath, uniqueFilename);

    // Ensure upload directory exists
    await fs.mkdir(uploadPath, { recursive: true });

    // Save processed image
    await processedImage.toFile(fullPath);

    // Generate thumbnail
    const thumbnailFilename = `thumb-${uniqueFilename}`;
    const thumbnailPath = path.join(uploadPath, thumbnailFilename);

    await sharp(buffer)
      .resize(300, 300, {
        fit: 'cover',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 70 })
      .toFile(thumbnailPath);

    return {
      original: uniqueFilename,
      thumbnail: thumbnailFilename,
      path: fullPath,
      thumbnailPath: thumbnailPath,
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error('Failed to process image');
  }
};

/**
 * Process barber portfolio image (larger dimensions)
 */
export const processPortfolioImage = async (
  buffer: Buffer
): Promise<ProcessedImageResult> => {
  return processAndSaveImage(buffer, 'portfolio', {
    width: 1200,
    height: 1200,
    quality: 90,
    format: 'jpeg',
  });
};

/**
 * Process profile picture (square, smaller)
 */
export const processProfilePicture = async (
  buffer: Buffer
): Promise<ProcessedImageResult> => {
  return processAndSaveImage(buffer, 'profile', {
    width: 600,
    height: 600,
    quality: 85,
    format: 'jpeg',
  });
};

/**
 * Upload single image middleware
 */
export const uploadSingleImage = upload.single('image');

/**
 * Upload multiple images middleware (for portfolio)
 */
export const uploadMultipleImages = upload.array('images', 8);

/**
 * Delete image file
 */
export const deleteImageFile = async (filename: string): Promise<boolean> => {
  try {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    const imagePath = path.join(uploadPath, filename);
    const thumbnailPath = path.join(uploadPath, `thumb-${filename}`);

    // Delete original image
    try {
      await fs.unlink(imagePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error deleting original image:', error);
      }
    }

    // Delete thumbnail
    try {
      await fs.unlink(thumbnailPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error deleting thumbnail:', error);
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting image files:', error);
    return false;
  }
};

/**
 * Get image metadata
 */
export const getImageInfo = async (
  buffer: Buffer
): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
} | null> => {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
      hasAlpha: metadata.hasAlpha || false,
    };
  } catch (error) {
    console.error('Error getting image info:', error);
    return null;
  }
};

/**
 * Validate image dimensions
 */
export const validateImageDimensions = (
  width: number,
  height: number,
  minWidth: number = 200,
  minHeight: number = 200,
  maxWidth: number = 4000,
  maxHeight: number = 4000
): boolean => {
  if (width < minWidth || height < minHeight) {
    throw new Error(`Image too small. Minimum: ${minWidth}x${minHeight}px`);
  }

  if (width > maxWidth || height > maxHeight) {
    throw new Error(`Image too large. Maximum: ${maxWidth}x${maxHeight}px`);
  }

  return true;
};

/**
 * Generate image URL
 * Uses relative URLs for production (works with Nginx proxy)
 * Falls back to localhost for development
 */
export const generateImageUrl = (filename: string, type: 'original' | 'thumbnail' = 'original'): string => {
  const prefix = type === 'thumbnail' ? 'thumb-' : '';
  
  // In production, use relative URL so it works with HTTPS through Nginx
  if (process.env.NODE_ENV === 'production' || process.env.BASE_URL) {
    const baseUrl = process.env.BASE_URL || '';
    return `${baseUrl}/uploads/${prefix}${filename}`;
  }
  
  // Development fallback
  return `http://localhost:3001/uploads/${prefix}${filename}`;
};

/**
 * Clean up orphaned images (older than 24 hours)
 */
export const cleanupOrphanedImages = async (): Promise<void> => {
  try {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    const files = await fs.readdir(uploadPath);

    for (const file of files) {
      if (file.startsWith('thumb-')) continue; // Skip thumbnails

      const filePath = path.join(uploadPath, file);
      const stats = await fs.stat(filePath);

      // Delete files older than 24 hours
      const hoursSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceModified > 24) {
        await deleteImageFile(file);
        console.log(`Deleted orphaned image: ${file}`);
      }
    }

    console.log('Image cleanup completed');
  } catch (error) {
    console.error('Image cleanup error:', error);
  }
};

export default {
  upload,
  uploadSingleImage,
  uploadMultipleImages,
  processAndSaveImage,
  processPortfolioImage,
  processProfilePicture,
  deleteImageFile,
  getImageInfo,
  validateImageDimensions,
  generateImageUrl,
  cleanupOrphanedImages,
};

