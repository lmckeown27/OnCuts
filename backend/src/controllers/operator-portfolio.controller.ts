import { Response, NextFunction } from 'express';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { PoolClient } from 'pg';
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

function wantsCover(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === '1';
}

const PORTFOLIO_ITEM_COLUMNS = `id, provider_id, media_type, media_url, thumbnail_url, caption, sort_order, created_at,
              specialties, booking_id, is_cover`;

async function promoteLatestPhotoCover(client: PoolClient, providerId: string, specialtyId: string) {
  if (!specialtyId) return;
  const existing = await client.query(
    `SELECT id
     FROM operator_portfolio_items
     WHERE provider_id = $1
       AND media_type = 'image'
       AND is_cover = true
       AND specialties[1] = $2
     LIMIT 1`,
    [providerId, specialtyId]
  );
  if (existing.rows.length > 0) return;
  await client.query(
    `UPDATE operator_portfolio_items
     SET is_cover = true
     WHERE id = (
       SELECT id
       FROM operator_portfolio_items
       WHERE provider_id = $1
         AND media_type = 'image'
         AND specialties[1] = $2
       ORDER BY created_at DESC, sort_order DESC
       LIMIT 1
     )`,
    [providerId, specialtyId]
  );
}

async function clearSiblingCovers(
  client: PoolClient,
  providerId: string,
  specialtyId: string,
  exceptId: string | null
) {
  await client.query(
    `UPDATE operator_portfolio_items
     SET is_cover = false
     WHERE provider_id = $1
       AND is_cover = true
       AND specialties && ARRAY[$2]::text[]
       AND ($3::uuid IS NULL OR id <> $3)`,
    [providerId, specialtyId, exceptId]
  );
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

    await pool.query(
      `UPDATE operator_portfolio_items AS item
       SET is_cover = true
       WHERE item.provider_id = $1
         AND item.id IN (
           SELECT ranked.id
           FROM (
             SELECT id,
                    specialties[1] AS specialty_id,
                    ROW_NUMBER() OVER (
                      PARTITION BY specialties[1]
                      ORDER BY created_at DESC, sort_order DESC
                    ) AS rn
             FROM operator_portfolio_items
             WHERE provider_id = $1
               AND media_type = 'image'
               AND specialties[1] IS NOT NULL
           ) AS ranked
           WHERE ranked.rn = 1
             AND NOT EXISTS (
               SELECT 1
               FROM operator_portfolio_items AS cover
               WHERE cover.provider_id = $1
                 AND cover.media_type = 'image'
                 AND cover.is_cover = true
                 AND cover.specialties[1] = ranked.specialty_id
             )
         )`,
      [id]
    );

    const result = await pool.query(
      `SELECT ${PORTFOLIO_ITEM_COLUMNS}
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

export const listPublicOperatorPortfolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const visible = await pool.query(
      `SELECT id
       FROM barbers
       WHERE id = $1
         AND "isActive" = true
         AND COALESCE(is_hidden, false) = false`,
      [id]
    );
    if (visible.rows.length === 0) {
      throw new ApiError(404, 'Portfolio not found');
    }

    const result = await pool.query(
      `SELECT ${PORTFOLIO_ITEM_COLUMNS}
       FROM operator_portfolio_items
       WHERE provider_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    let specialtyIds: string[] = [];
    try {
      const order = await pool.query(
        'SELECT specialty_ids FROM operator_portfolio_section_orders WHERE provider_id = $1',
        [id]
      );
      specialtyIds = Array.isArray(order.rows[0]?.specialty_ids) ? order.rows[0].specialty_ids : [];
    } catch (error: unknown) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
      if (code !== '42P01') throw error;
    }

    res.json({ success: true, data: { items: result.rows, specialtyIds } });
  } catch (error) {
    next(error);
  }
};

const PORTFOLIO_SECTION_IDS_BY_NAME: Record<string, string[]> = {
  'buzz cut': ['buzz-cut'],
  'line up': ['lineup', 'line-up'],
  'beard trim': ['beard-trim'],
  haircut: ['haircut'],
  taper: ['taper'],
  'hot shave': ['hot-shave'],
  'kids cut': ['kids-cut'],
  fade: ['fade'],
  mullet: ['mullet'],
  'design/art': ['design', 'design-art', 'designart'],
  'afro textures': ['afro', 'afro-textures'],
  'color treatment': ['color', 'color-treatment'],
  perm: ['perm'],
  braids: ['braids'],
  makeup: ['makeup'],
  nails: ['nails'],
  lashes: ['lashes'],
  tanning: ['tanning'],
};

function portfolioSpecialtySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function portfolioKeysForSpecialtyName(name: string, catalogSlugs: string[]): string[] {
  const lower = name.trim().toLowerCase();
  const keys = new Set<string>([lower, portfolioSpecialtySlug(name), ...(PORTFOLIO_SECTION_IDS_BY_NAME[lower] || [])]);
  catalogSlugs.forEach((slug) => {
    if (slug.trim()) keys.add(slug.trim().toLowerCase());
  });
  keys.delete('');
  return [...keys];
}

/** Drop portfolio photos and the saved section when an operator stops offering a service. */
export async function removePortfolioSectionsForDroppedSpecialties(
  providerId: string,
  previousNames: string[],
  nextNames: string[]
): Promise<void> {
  const stillOffered = new Set(nextNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
  const removed = previousNames.map((name) => name.trim()).filter((name) => name && !stillOffered.has(name.toLowerCase()));
  if (removed.length === 0) return;

  let catalog: { slug: string; name: string }[] = [];
  try {
    const services = await pool.query('SELECT slug, name FROM services');
    catalog = services.rows.map((row) => ({
      slug: String(row.slug || ''),
      name: String(row.name || ''),
    }));
  } catch (error) {
    logger.warn('Could not read the service catalog while removing a portfolio section', error);
  }

  const keys = new Set<string>();
  for (const name of removed) {
    const slugs = catalog
      .filter((service) => service.name.trim().toLowerCase() === name.toLowerCase())
      .map((service) => service.slug);
    portfolioKeysForSpecialtyName(name, slugs).forEach((key) => keys.add(key));
  }
  const specialtyKeys = [...keys];
  if (specialtyKeys.length === 0) return;

  await pool.query(
    `DELETE FROM operator_portfolio_items
     WHERE provider_id = $1
       AND EXISTS (
         SELECT 1
         FROM unnest(COALESCE(specialties, ARRAY[]::text[])) AS specialty
         WHERE LOWER(specialty) = ANY($2::text[])
       )`,
    [providerId, specialtyKeys]
  );

  try {
    await pool.query(
      `UPDATE operator_portfolio_section_orders
       SET specialty_ids = ARRAY(
         SELECT entry.specialty_id
         FROM unnest(specialty_ids) WITH ORDINALITY AS entry(specialty_id, ord)
         WHERE NOT (LOWER(entry.specialty_id) = ANY($2::text[]))
         ORDER BY entry.ord
       )
       WHERE provider_id = $1`,
      [providerId, specialtyKeys]
    );
  } catch (error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
    if (code !== '42P01') throw error;
  }
}

function parseSectionOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new ApiError(400, 'specialtyIds must be an array');
  }
  const ids = raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.length <= 80);
  return ids.slice(0, 40);
}

async function assertPortfolioOwner(providerId: string, userId: string) {
  const ownership = await pool.query(
    'SELECT id FROM barbers WHERE id = $1 AND "userId" = $2',
    [providerId, userId]
  );
  if (ownership.rows.length === 0) {
    throw new ApiError(403, 'Not authorized to manage this portfolio');
  }
}

export const getOperatorPortfolioSectionOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await assertPortfolioOwner(id, req.user!.userId);
    const result = await pool.query(
      'SELECT specialty_ids FROM operator_portfolio_section_orders WHERE provider_id = $1',
      [id]
    );
    const specialtyIds = Array.isArray(result.rows[0]?.specialty_ids) ? result.rows[0].specialty_ids : [];
    res.json({ success: true, data: { specialtyIds } });
  } catch (error) {
    next(error);
  }
};

export const saveOperatorPortfolioSectionOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await assertPortfolioOwner(id, req.user!.userId);
    const specialtyIds = parseSectionOrder(req.body?.specialtyIds ?? req.body?.specialty_ids);
    const result = await pool.query(
      `INSERT INTO operator_portfolio_section_orders (provider_id, specialty_ids)
       VALUES ($1, $2)
       ON CONFLICT (provider_id) DO UPDATE SET specialty_ids = EXCLUDED.specialty_ids
       RETURNING specialty_ids`,
      [id, specialtyIds]
    );
    res.json({ success: true, data: { specialtyIds: result.rows[0]?.specialty_ids || specialtyIds } });
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
    const isCover = wantsCover(req.body?.is_cover ?? req.body?.isCover);

    if (!req.file) {
      throw new ApiError(400, 'A photo or video file is required');
    }

    const kind = mediaKind(req.file);
    if (!kind) {
      throw new ApiError(400, 'Upload a photo (JPEG, PNG, WebP, GIF) or a video (MP4, WebM, MOV)');
    }
    if (isCover && kind !== 'image') {
      throw new ApiError(400, 'A cover must be a photo');
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

      let coverFlag = isCover;
      if (coverFlag && specialties[0]) {
        await clearSiblingCovers(client, id, specialties[0], null);
      } else if (!coverFlag && kind === 'image' && specialties[0]) {
        const existingCover = await client.query(
          `SELECT id
           FROM operator_portfolio_items
           WHERE provider_id = $1
             AND media_type = 'image'
             AND is_cover = true
             AND specialties[1] = $2
           LIMIT 1`,
          [id, specialties[0]]
        );
        coverFlag = existingCover.rows.length === 0;
      }

      inserted = await client.query(
        `INSERT INTO operator_portfolio_items
           (provider_id, media_type, media_url, caption, sort_order, specialties, booking_id, is_cover)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${PORTFOLIO_ITEM_COLUMNS}`,
        [id, kind, uploaded.url, caption || null, sortOrder, specialties, bookingId, coverFlag]
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

export const updateOperatorPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, itemId } = req.params;
    const userId = req.user!.userId;
    const specialties = parseSpecialties(req.body?.specialties, true);
    const coverWasSent = req.body?.is_cover !== undefined || req.body?.isCover !== undefined;
    const client = await pool.connect();
    let updated;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [id]);
      const ownership = await client.query(
        `SELECT i.media_type, i.is_cover, i.specialties
         FROM barbers b
         JOIN operator_portfolio_items i ON i.provider_id = b.id
         WHERE b.id = $1 AND b."userId" = $2 AND i.id = $3`,
        [id, userId, itemId]
      );
      if (ownership.rows.length === 0) {
        const provider = await client.query(
          'SELECT id FROM barbers WHERE id = $1 AND "userId" = $2',
          [id, userId]
        );
        if (provider.rows.length === 0) {
          throw new ApiError(403, 'Not authorized to manage this portfolio');
        }
        throw new ApiError(404, 'Portfolio item not found');
      }
      const isCover = coverWasSent ? wantsCover(req.body?.is_cover ?? req.body?.isCover) : Boolean(ownership.rows[0].is_cover);
      if (isCover && ownership.rows[0].media_type !== 'image') {
        throw new ApiError(400, 'A cover must be a photo');
      }
      if (isCover && specialties[0]) {
        await clearSiblingCovers(client, id, specialties[0], itemId);
      }
      updated = await client.query(
        `UPDATE operator_portfolio_items
         SET specialties = $1, is_cover = $2
         WHERE id = $3 AND provider_id = $4
         RETURNING ${PORTFOLIO_ITEM_COLUMNS}`,
        [specialties, isCover, itemId, id]
      );
      const previousSpecialty = Array.isArray(ownership.rows[0].specialties) ? ownership.rows[0].specialties[0] : null;
      if (specialties[0]) await promoteLatestPhotoCover(client, id, specialties[0]);
      if (previousSpecialty && previousSpecialty !== specialties[0]) {
        await promoteLatestPhotoCover(client, id, previousSpecialty);
      }
      updated = await client.query(
        `SELECT ${PORTFOLIO_ITEM_COLUMNS}
         FROM operator_portfolio_items
         WHERE id = $1 AND provider_id = $2`,
        [itemId, id]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    if (updated.rows.length === 0) {
      throw new ApiError(404, 'Portfolio item not found');
    }

    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    next(error);
  }
};

export const deleteOperatorPortfolioItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, itemId } = req.params;
    const userId = req.user!.userId;
    const client = await pool.connect();
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

      const deleted = await client.query(
        `DELETE FROM operator_portfolio_items
         WHERE id = $1 AND provider_id = $2
         RETURNING specialties, media_type`,
        [itemId, id]
      );
      if (deleted.rows.length === 0) {
        throw new ApiError(404, 'Portfolio item not found');
      }
      const specialtyId = Array.isArray(deleted.rows[0].specialties) ? deleted.rows[0].specialties[0] : null;
      if (deleted.rows[0].media_type === 'image' && specialtyId) {
        await promoteLatestPhotoCover(client, id, specialtyId);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ success: true, data: { id: itemId } });
  } catch (error) {
    next(error);
  }
};
