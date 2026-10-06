import { Response, NextFunction } from 'express';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { uploadToS3 } from '../services/s3.service';
import { logger } from '../utils/logger';

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const VIDEO_MAX_BYTES = 80 * 1024 * 1024;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

function mediaKind(file: Express.Multer.File): 'image' | 'video' | null {
  if (IMAGE_TYPES.has(file.mimetype)) return 'image';
  if (VIDEO_TYPES.has(file.mimetype)) return 'video';
  return null;
}

function fileExtension(file: Express.Multer.File, kind: 'image' | 'video'): string {
  const raw = path.extname(file.originalname || '').toLowerCase();
  if (kind === 'image') {
    if (raw === '.jpeg' || raw === '.jpg') return '.jpg';
    if (raw === '.png' || raw === '.webp' || raw === '.gif') return raw;
    if (file.mimetype === 'image/png') return '.png';
    if (file.mimetype === 'image/webp') return '.webp';
    if (file.mimetype === 'image/gif') return '.gif';
    return '.jpg';
  }
  if (raw === '.webm') return '.webm';
  if (raw === '.mov') return '.mov';
  return '.mp4';
}

async function assertOperatorOwnsProvider(providerId: string, userId: string): Promise<void> {
  const ownership = await pool.query(
    'SELECT id FROM barbers WHERE id = $1 AND "userId" = $2',
    [providerId, userId]
  );
  if (ownership.rows.length === 0) {
    throw new ApiError(403, 'Not authorized to manage this portfolio');
  }
}

export const listOperatorPortfolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    await assertOperatorOwnsProvider(id, userId);

    const result = await pool.query(
      `SELECT id, provider_id, media_type, media_url, thumbnail_url, caption, sort_order, created_at
       FROM operator_portfolio_items
       WHERE provider_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

export const addOperatorPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';

    if (!req.file) {
      throw new ApiError(400, 'A photo or video file is required');
    }

    const kind = mediaKind(req.file);
    if (!kind) {
      throw new ApiError(400, 'Upload a photo (JPEG, PNG, WebP, GIF) or a video (MP4, WebM, MOV)');
    }

    const maxBytes = kind === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (req.file.size > maxBytes) {
      throw new ApiError(400, kind === 'image' ? 'Photos must be 8 MB or smaller' : 'Videos must be 80 MB or smaller');
    }

    await assertOperatorOwnsProvider(id, userId);

    const ext = fileExtension(req.file, kind);
    const key = `operator-portfolio/${id}/${Date.now()}${ext}`;
    const uploaded = await uploadToS3(req.file.buffer, key, req.file.mimetype);
    if (!uploaded.success || !uploaded.url) {
      throw new ApiError(500, 'Failed to upload portfolio file');
    }

    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM operator_portfolio_items WHERE provider_id = $1',
      [id]
    );
    const sortOrder = Number(maxOrder.rows[0]?.max_order ?? -1) + 1;

    const inserted = await pool.query(
      `INSERT INTO operator_portfolio_items
         (provider_id, media_type, media_url, caption, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, provider_id, media_type, media_url, thumbnail_url, caption, sort_order, created_at`,
      [id, kind, uploaded.url, caption || null, sortOrder]
    );

    logger.info('Added operator portfolio item', { providerId: id, userId, mediaType: kind });
    res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const deleteOperatorPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, itemId } = req.params;
    const userId = req.user!.userId;
    await assertOperatorOwnsProvider(id, userId);

    const deleted = await pool.query(
      'DELETE FROM operator_portfolio_items WHERE id = $1 AND provider_id = $2 RETURNING id',
      [itemId, id]
    );
    if (deleted.rows.length === 0) {
      throw new ApiError(404, 'Portfolio item not found');
    }

    res.json({ success: true, data: { id: itemId } });
  } catch (error) {
    next(error);
  }
};
