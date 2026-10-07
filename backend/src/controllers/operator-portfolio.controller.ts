import { Response, NextFunction } from 'express';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { uploadToS3 } from '../services/s3.service';
import { logger } from '../utils/logger';

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const VIDEO_MAX_BYTES = 80 * 1024 * 1024;
const MAX_IMAGES_PER_BOOKING = 4;
const MAX_VIDEOS_PER_BOOKING = 1;

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

function parseSpecialties(raw: unknown, required: boolean): string[] {
  let value = raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new ApiError(400, 'specialties must be a JSON array of service ids');
    }
  }
  if (value == null || value === '') {
    if (required) throw new ApiError(400, 'Select at least one specialty');
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'specialties must be a JSON array of service ids');
  }
  const specialties = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (required && specialties.length < 1) {
    throw new ApiError(400, 'Select at least one specialty');
  }
  return specialties.slice(0, 20);
}

function parseBookingId(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = raw.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, 'booking_id must be a booking id');
  }
  return value;
}

export const listOperatorPortfolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const ownership = await pool.query(
      'SELECT id FROM barbers WHERE id = $1 AND "userId" = $2',
      [id, userId]
    );
    if (ownership.rows.length === 0) {
      throw new ApiError(403, 'Not authorized to manage this portfolio');
    }

    const result = await pool.query(
      `SELECT id, provider_id, media_type, media_url, thumbnail_url, caption, sort_order, created_at,
              specialties, booking_id
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
    const bookingId = parseBookingId(req.body?.booking_id ?? req.body?.bookingId);
    const specialties = parseSpecialties(req.body?.specialties, Boolean(bookingId));

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

    const ext = fileExtension(req.file, kind);
    const key = `operator-portfolio/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const uploaded = await uploadToS3(req.file.buffer, key, req.file.mimetype);
    if (!uploaded.success || !uploaded.url) {
      throw new ApiError(500, 'Failed to upload portfolio file');
    }

    const client = await pool.connect();
    let inserted;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [id]);
      const ownership = await client.query(
        'SELECT id FROM barbers WHERE id = $1 AND "userId" = $2',
        [id, userId]
      );
      if (ownership.rows.length === 0) {
        throw new ApiError(403, 'Not authorized to manage this portfolio');
      }

      if (bookingId) {
        const counts = await client.query(
          `SELECT media_type, COUNT(*)::int AS total
           FROM operator_portfolio_items
           WHERE provider_id = $1 AND booking_id = $2
           GROUP BY media_type`,
          [id, bookingId]
        );
        const imageCount = counts.rows.find((row) => row.media_type === 'image')?.total ?? 0;
        const videoCount = counts.rows.find((row) => row.media_type === 'video')?.total ?? 0;
        if (kind === 'image' && imageCount >= MAX_IMAGES_PER_BOOKING) {
          throw new ApiError(400, 'This booking already has 4 portfolio photos');
        }
        if (kind === 'video' && videoCount >= MAX_VIDEOS_PER_BOOKING) {
          throw new ApiError(400, 'This booking already has a portfolio video');
        }
      }

      const maxOrder = await client.query(
        'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM operator_portfolio_items WHERE provider_id = $1',
        [id]
      );
      const sortOrder = Number(maxOrder.rows[0]?.max_order ?? -1) + 1;

      inserted = await client.query(
        `INSERT INTO operator_portfolio_items
           (provider_id, media_type, media_url, caption, sort_order, specialties, booking_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, provider_id, media_type, media_url, thumbnail_url, caption, sort_order, created_at,
                   specialties, booking_id`,
        [id, kind, uploaded.url, caption || null, sortOrder, specialties, bookingId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    logger.info('Added operator portfolio item', { providerId: id, userId, mediaType: kind, bookingId });
    res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const deleteOperatorPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, itemId } = req.params;
    const userId = req.user!.userId;
    const ownership = await pool.query(
      'SELECT id FROM barbers WHERE id = $1 AND "userId" = $2',
      [id, userId]
    );
    if (ownership.rows.length === 0) {
      throw new ApiError(403, 'Not authorized to manage this portfolio');
    }

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
