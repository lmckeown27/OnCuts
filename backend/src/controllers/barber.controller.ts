import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import aptosService from '../services/aptos.service';
import { uploadToS3 } from '../services/s3.service';
import { logger } from '../utils/logger';
import mockDatabase from '../services/mock.database.service';

export const getAllBarbers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campusId, minRating, maxPrice, specialty, instantBook } = req.query;

    // Use mock database (PostgreSQL not required for MVP)
    const filter: any = {
      is_active: true,
    };

    if (campusId) {
      filter.campus_id = campusId;
    }

    const barbers = await mockDatabase.findBarbersByFilter(filter);
    
    // Apply additional filters in-memory
    let filteredBarbers = barbers;

    if (minRating) {
      filteredBarbers = filteredBarbers.filter(b => b.average_rating >= Number(minRating));
    }

    if (maxPrice) {
      filteredBarbers = filteredBarbers.filter(b => {
        const minPrice = Math.min(...(b.pricing || []).map(p => p.price));
        return minPrice <= Number(maxPrice);
      });
    }

    if (instantBook === 'true') {
      filteredBarbers = filteredBarbers.filter(b => b.instant_book_enabled === true);
    }

    if (specialty) {
      filteredBarbers = filteredBarbers.filter(b => 
        b.specialties.some(s => s.toLowerCase().includes(String(specialty).toLowerCase()))
      );
    }

    // Sort by rating
    filteredBarbers.sort((a, b) => b.average_rating - a.average_rating);

    res.json({
      success: true,
      data: filteredBarbers,
      pagination: {
        page: 1,
        limit: filteredBarbers.length,
        total: filteredBarbers.length,
        total_pages: 1,
      },
    });
  } catch (error) {
    logger.error('Error in getAllBarbers:', error);
    next(error);
  }
};

export const getBarberById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Use mock database
    const barber = await mockDatabase.findBarberById(id);

    if (!barber) {
      throw new ApiError(404, 'Barber not found');
    }

    // Get reviews for this barber
    const reviews = await mockDatabase.findReviewsByBarber(id);

    // Optionally get on-chain rating (if Aptos address exists)
    let aptosRating = null;
    if (barber.aptos_address) {
      try {
        aptosRating = await aptosService.getBarberRating(barber.aptos_address);
      } catch (error) {
        logger.warn('Failed to fetch Aptos rating:', error);
      }
    }

    res.json({
      success: true,
      data: {
        ...barber,
        blockchain_rating: aptosRating,
      },
    });
  } catch (error) {
    logger.error('Error in getBarberById:', error);
    next(error);
  }
};

export const createBarberProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bio, pricing, specialties, yearsExperience, instantBook } = req.body;
    const userId = req.user!.userId;

    // Check if barber profile already exists
    const existing = await pool.query('SELECT id FROM barbers WHERE user_id = $1', [userId]);
    
    if (existing.rows.length > 0) {
      throw new ApiError(400, 'Barber profile already exists');
    }

    // Get user details
    const userResult = await pool.query(
      'SELECT aptos_address, campus_id FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    // Create barber profile in database
    const result = await pool.query(
      `INSERT INTO barbers (user_id, bio, pricing, instant_book, years_experience)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, bio, JSON.stringify(pricing), instantBook || false, yearsExperience]
    );

    const barber = result.rows[0];

    // Register on Aptos blockchain
    const bioHash = Buffer.from(bio).toString('base64');
    const pricingHash = Buffer.from(JSON.stringify(pricing)).toString('base64');

    await aptosService.registerBarber({
      barberAddress: user.aptos_address,
      campusId: user.campus_id,
      specialties,
      instantBookEnabled: instantBook || false,
      bioHash,
      pricingHash,
    });

    logger.info(`Barber profile created: ${barber.id}`);

    res.status(201).json({
      success: true,
      data: barber,
      message: 'Barber profile created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const updateBarberProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { bio, pricing, instantBook, yearsExperience } = req.body;
    const userId = req.user!.userId;

    // Verify ownership
    const ownership = await pool.query('SELECT id FROM barbers WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (ownership.rows.length === 0) {
      throw new ApiError(403, 'Not authorized to update this profile');
    }

    // Update profile
    const result = await pool.query(
      `UPDATE barbers 
       SET bio = COALESCE($1, bio),
           pricing = COALESCE($2, pricing),
           instant_book = COALESCE($3, instant_book),
           years_experience = COALESCE($4, years_experience)
       WHERE id = $5
       RETURNING *`,
      [bio, pricing ? JSON.stringify(pricing) : null, instantBook, yearsExperience, id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Profile updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBarberProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const ownership = await pool.query('SELECT id FROM barbers WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (ownership.rows.length === 0) {
      throw new ApiError(403, 'Not authorized');
    }

    await pool.query('DELETE FROM barbers WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Barber profile deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getBarberPortfolio = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM portfolio_images WHERE barber_id = $1 ORDER BY order_index',
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const addPortfolioImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { caption } = req.body;
    const userId = req.user!.userId;

    if (!req.file) {
      throw new ApiError(400, 'Image file required');
    }

    // Verify ownership
    const ownership = await pool.query('SELECT id FROM barbers WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (ownership.rows.length === 0) {
      throw new ApiError(403, 'Not authorized');
    }

    // Upload to S3
    const imageUrl = await uploadToS3(req.file, 'portfolio');

    // Get max order index
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(order_index), -1) as max_order FROM portfolio_images WHERE barber_id = $1',
      [id]
    );

    const nextOrder = maxOrder.rows[0].max_order + 1;

    // Save to database
    const result = await pool.query(
      `INSERT INTO portfolio_images (barber_id, image_url, caption, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, imageUrl, caption, nextOrder]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const deletePortfolioImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { barberId, imageId } = req.params;
    const userId = req.user!.userId;

    const ownership = await pool.query('SELECT id FROM barbers WHERE id = $1 AND user_id = $2', [barberId, userId]);
    
    if (ownership.rows.length === 0) {
      throw new ApiError(403, 'Not authorized');
    }

    await pool.query('DELETE FROM portfolio_images WHERE id = $1 AND barber_id = $2', [imageId, barberId]);

    res.json({
      success: true,
      message: 'Portfolio image deleted',
    });
  } catch (error) {
    next(error);
  }
};

export const updateAvailability = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { schedule } = req.body;
    const userId = req.user!.userId;

    const ownership = await pool.query('SELECT id FROM barbers WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (ownership.rows.length === 0) {
      throw new ApiError(403, 'Not authorized');
    }

    // Delete existing availability
    await pool.query('DELETE FROM availability_templates WHERE barber_id = $1', [id]);

    // Insert new schedule
    for (const slot of schedule) {
      await pool.query(
        `INSERT INTO availability_templates (barber_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [id, slot.dayOfWeek, slot.startTime, slot.endTime]
      );
    }

    res.json({
      success: true,
      message: 'Availability updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getBarberAvailability = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM availability_templates WHERE barber_id = $1 AND is_active = TRUE ORDER BY day_of_week, start_time',
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const getBarberEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const ownership = await pool.query('SELECT user_id, total_earnings FROM barbers WHERE id = $1', [id]);
    
    if (ownership.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    if (ownership.rows[0].user_id !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    // Get detailed earnings from payment transactions
    const earnings = await pool.query(
      `SELECT 
        SUM(barber_payout) as total_earned,
        SUM(CASE WHEN status = 'succeeded' THEN barber_payout ELSE 0 END) as paid_out,
        SUM(CASE WHEN status = 'pending' THEN barber_payout ELSE 0 END) as pending,
        COUNT(*) as total_transactions
      FROM payment_transactions
      WHERE barber_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: earnings.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const getBarberAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const ownership = await pool.query('SELECT user_id FROM barbers WHERE id = $1', [id]);
    
    if (ownership.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    if (ownership.rows[0].user_id !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    // Aggregate analytics data
    const analytics = await pool.query(
      `SELECT 
        COUNT(DISTINCT bm.client_id) as unique_clients,
        COUNT(*) as total_bookings,
        AVG(pt.amount) as avg_booking_value,
        SUM(pt.barber_payout) as lifetime_earnings
      FROM booking_metadata bm
      LEFT JOIN payment_transactions pt ON bm.blockchain_booking_id = pt.booking_id
      WHERE bm.barber_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: analytics.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

