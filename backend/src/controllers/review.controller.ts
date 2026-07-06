import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const submitReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bookingId, rating, reviewText } = req.body;
    const clientId = req.user!.userId;

    const booking = await pool.query(
      `SELECT b.* FROM bookings b
       WHERE b.id = $1 AND b."consumerId" = $2`,
      [bookingId, clientId]
    );

    if (booking.rows.length === 0) {
      throw new ApiError(404, 'Booking not found or not authorized');
    }

    const row = booking.rows[0];
    if (row.reviewRating != null) {
      throw new ApiError(400, 'Booking already reviewed');
    }

    await pool.query(
      `UPDATE bookings
       SET "reviewRating" = $1,
           "reviewComment" = $2,
           "reviewedAt" = CURRENT_TIMESTAMP,
           "updatedAt" = NOW()
       WHERE id = $3`,
      [rating, reviewText || null, bookingId]
    );

    await updateBarberAverageRating(row.barberId);

    logger.info(`Review submitted for booking ${bookingId}`);

    res.status(201).json({
      success: true,
      data: { bookingId, rating, reviewText },
      message: 'Review submitted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getBarberReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { barberId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT b.id AS booking_id,
              b."reviewRating" AS rating,
              b."reviewComment" AS review_text,
              b."reviewedAt" AS created_at,
              u.first_name AS client_first_name,
              u.last_name AS client_last_name
       FROM bookings b
       JOIN users u ON b."consumerId" = u.id
       WHERE b."barberId" = $1 AND b."reviewRating" IS NOT NULL
       ORDER BY b."reviewedAt" DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [barberId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM bookings
       WHERE "barberId" = $1 AND "reviewRating" IS NOT NULL`,
      [barberId]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getReviewById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT b.id AS booking_id,
              b."reviewRating" AS rating,
              b."reviewComment" AS review_text,
              b."reviewedAt" AS created_at,
              u.first_name AS client_first_name,
              u.last_name AS client_last_name
       FROM bookings b
       JOIN users u ON b."consumerId" = u.id
       WHERE b.id = $1 AND b."reviewRating" IS NOT NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Review not found');
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const markReviewHelpful = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      message: 'Review marked as helpful',
    });
  } catch (error) {
    next(error);
  }
};

async function updateBarberAverageRating(barberId: string): Promise<void> {
  const result = await pool.query(
    `SELECT AVG("reviewRating")::numeric(3,2) AS avg_rating,
            COUNT(*) AS review_count
     FROM bookings
     WHERE "barberId" = $1 AND "reviewRating" IS NOT NULL`,
    [barberId]
  );

  await pool.query(
    'UPDATE barbers SET average_rating = $1, total_reviews = $2 WHERE id = $3',
    [result.rows[0].avg_rating || 0, result.rows[0].review_count || 0, barberId]
  );
}
