import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import aptosService from '../services/aptos.service';
import { uploadToS3 } from '../services/s3.service';
import { logger } from '../utils/logger';

export const getAllBarbers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campusId, minRating, maxPrice, specialty } = req.query;

    // Build dynamic query for barbers from PostgreSQL
    // Column names match Prisma schema: avgRating, totalReviews, totalBookings, isActive
    let query = `
      SELECT 
        b.id,
        b."userId" as user_id,
        b.bio,
        b.specialties,
        b."avgRating" as average_rating,
        b."totalReviews" as total_reviews,
        b."totalBookings" as total_bookings,
        b."isActive" as is_active,
        b."createdAt" as created_at,
        b."weeklySchedule" as weekly_schedule,
        u.email,
        u.first_name,
        u.last_name,
        u."displayName" as display_name,
        u."avatarUrl" as profile_picture_url,
        u."instagramHandle" as instagram_handle,
        u."campusId" as campus_id
      FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE b."isActive" = true
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (campusId) {
      query += ` AND b."campusId" = $${paramIndex}`;
      params.push(campusId);
      paramIndex++;
    }

    if (minRating) {
      query += ` AND b."avgRating" >= $${paramIndex}`;
      params.push(Number(minRating));
      paramIndex++;
    }

    if (specialty) {
      query += ` AND $${paramIndex} = ANY(b.specialties)`;
      params.push(String(specialty));
      paramIndex++;
    }

    query += ` ORDER BY b."avgRating" DESC NULLS LAST`;

    const result = await pool.query(query, params);
    
    // Get services/pricing for each barber
    const barbers = await Promise.all(result.rows.map(async (barber) => {
      const servicesResult = await pool.query(
        `SELECT id, name, description, "priceUsdCents" as price, "durationMinutes" as duration_minutes
         FROM barber_services 
         WHERE "barberId" = $1 AND "isActive" = true`,
        [barber.id]
      );
      
      // Get portfolio images
      const portfolioResult = await pool.query(
        `SELECT id, "imageUrl" as image_url, caption, "orderIndex" as order_index
         FROM portfolio_images 
         WHERE "barberId" = $1 
         ORDER BY "orderIndex"`,
        [barber.id]
      );
      
      return {
        ...barber,
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`,
        pricing: servicesResult.rows.map(s => ({
          ...s,
          price: s.price / 100 // Convert cents to dollars for frontend
        })),
        portfolio_images: portfolioResult.rows,
      };
    }));

    // Apply maxPrice filter in-memory (since it requires pricing data)
    let filteredBarbers = barbers;
    if (maxPrice) {
      filteredBarbers = barbers.filter(b => {
        if (!b.pricing || b.pricing.length === 0) return true;
        const minPrice = Math.min(...b.pricing.map((p: any) => p.price));
        return minPrice <= Number(maxPrice);
      });
    }

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

/**
 * Get current user's barber profile (for authenticated barbers)
 */
export const getMyBarberProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const barberResult = await pool.query(
      `SELECT 
        b.id,
        b."userId" as user_id,
        b.bio,
        b.specialties,
        b."avgRating" as average_rating,
        b."totalReviews" as total_reviews,
        b."totalBookings" as total_bookings,
        b."isActive" as is_active,
        b."createdAt" as created_at,
        b."weeklySchedule" as weekly_schedule,
        u.email,
        u.first_name,
        u.last_name,
        u."displayName" as display_name,
        u."avatarUrl" as profile_picture_url,
        u."instagramHandle" as instagram_handle,
        u."campusId" as campus_id
      FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE b."userId" = $1`,
      [userId]
    );

    if (barberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No barber profile found for this user',
      });
    }

    const barber = barberResult.rows[0];

    // Get services/pricing
    const servicesResult = await pool.query(
      `SELECT id, name, description, "priceUsdCents" as price, "durationMinutes" as duration_minutes
       FROM barber_services 
       WHERE "barberId" = $1 AND "isActive" = true`,
      [barber.id]
    );

    res.json({
      success: true,
      data: {
        ...barber,
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`,
        pricing: servicesResult.rows.map(s => ({
          ...s,
          price: s.price / 100
        })),
      },
    });
  } catch (error) {
    logger.error('Error in getMyBarberProfile:', error);
    next(error);
  }
};

/**
 * Get barber by user ID
 */
export const getBarberByUserId = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const barberResult = await pool.query(
      `SELECT 
        b.id,
        b."userId" as user_id,
        b.bio,
        b.specialties,
        b."avgRating" as average_rating,
        b."totalReviews" as total_reviews,
        b."totalBookings" as total_bookings,
        b."isActive" as is_active,
        b."createdAt" as created_at,
        b."weeklySchedule" as weekly_schedule,
        u.email,
        u.first_name,
        u.last_name,
        u."displayName" as display_name,
        u."avatarUrl" as profile_picture_url,
        u."instagramHandle" as instagram_handle,
        u."campusId" as campus_id
      FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE b."userId" = $1`,
      [userId]
    );

    if (barberResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Barber not found for this user',
      });
    }

    const barber = barberResult.rows[0];

    res.json({
      success: true,
      data: {
        ...barber,
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`,
      },
    });
  } catch (error) {
    logger.error('Error in getBarberByUserId:', error);
    next(error);
  }
};

export const getBarberById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get barber from PostgreSQL
    // Column names match Prisma schema
    const barberResult = await pool.query(
      `SELECT 
        b.id,
        b."userId" as user_id,
        b.bio,
        b.specialties,
        b."avgRating" as average_rating,
        b."totalReviews" as total_reviews,
        b."totalBookings" as total_bookings,
        b."isActive" as is_active,
        b."createdAt" as created_at,
        b."weeklySchedule" as weekly_schedule,
        u.email,
        u.first_name,
        u.last_name,
        u."displayName" as display_name,
        u."avatarUrl" as profile_picture_url,
        u."campusId" as campus_id,
        u."isVerified" as is_verified
      FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE b.id = $1`,
      [id]
    );

    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    const barber = barberResult.rows[0];

    // Get services/pricing
    const servicesResult = await pool.query(
      `SELECT id, name, description, "priceUsdCents" as price, "durationMinutes" as duration_minutes
       FROM barber_services 
       WHERE "barberId" = $1 AND "isActive" = true`,
      [id]
    );

    // Get portfolio images
    const portfolioResult = await pool.query(
      `SELECT id, "imageUrl" as image_url, caption, "orderIndex" as order_index
       FROM portfolio_images 
       WHERE "barberId" = $1 
       ORDER BY "orderIndex"`,
      [id]
    );

    // Get reviews
    const reviewsResult = await pool.query(
      `SELECT 
        r.id,
        r.rating,
        r.comment as review_text,
        r."createdAt" as created_at,
        u.first_name,
        u.last_name,
        u."avatarUrl" as profile_picture_url
      FROM reviews r
      JOIN users u ON r."consumerId" = u.id
      WHERE r."barberId" = $1
      ORDER BY r."createdAt" DESC
      LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...barber,
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`,
        pricing: servicesResult.rows.map(s => ({
          ...s,
          price: s.price / 100 // Convert cents to dollars
        })),
        portfolio_images: portfolioResult.rows,
        reviews: reviewsResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error in getBarberById:', error);
    next(error);
  }
};

export const createBarberProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bio, pricing, specialties, yearsExperience } = req.body;
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
      `INSERT INTO barbers (user_id, bio, pricing, years_experience)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, bio, JSON.stringify(pricing), yearsExperience]
    );

    const barber = result.rows[0];

    // Register on Aptos blockchain
    const bioHash = Buffer.from(bio).toString('base64');
    const pricingHash = Buffer.from(JSON.stringify(pricing)).toString('base64');

    await aptosService.registerBarber({
      barberAddress: user.aptos_address,
      campusId: user.campus_id,
      specialties,
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
    const { bio, instagram_handle, display_name, specialties, yearsExperience, weekly_schedule } = req.body;
    const userId = req.user!.userId;

    // Verify ownership
    const ownership = await pool.query('SELECT id FROM barbers WHERE id = $1 AND "userId" = $2', [id, userId]);
    
    if (ownership.rows.length === 0) {
      throw new ApiError(403, 'Not authorized to update this profile');
    }

    // Build dynamic update query for barbers table
    const barberUpdateFields: string[] = [];
    const barberValues: any[] = [];
    let paramIndex = 1;

    if (bio !== undefined) {
      barberUpdateFields.push(`bio = $${paramIndex}`);
      barberValues.push(bio);
      paramIndex++;
    }
    if (specialties !== undefined) {
      barberUpdateFields.push(`specialties = $${paramIndex}`);
      barberValues.push(specialties);
      paramIndex++;
    }
    if (yearsExperience !== undefined) {
      barberUpdateFields.push(`"yearsExperience" = $${paramIndex}`);
      barberValues.push(yearsExperience);
      paramIndex++;
    }
    if (weekly_schedule !== undefined) {
      barberUpdateFields.push(`"weeklySchedule" = $${paramIndex}`);
      barberValues.push(JSON.stringify(weekly_schedule));
      paramIndex++;
    }

    // Update barbers table if there are fields to update
    if (barberUpdateFields.length > 0) {
      barberUpdateFields.push(`"updatedAt" = NOW()`);
      barberValues.push(id);

      await pool.query(
        `UPDATE barbers 
         SET ${barberUpdateFields.join(', ')}
         WHERE id = $${paramIndex}`,
        barberValues
      );
    }

    // Update user profile fields (display_name, instagram_handle) on users table
    const userUpdateFields: string[] = [];
    const userValues: any[] = [];
    let userParamIndex = 1;

    if (display_name !== undefined) {
      userUpdateFields.push(`"displayName" = $${userParamIndex}`);
      userValues.push(display_name);
      userParamIndex++;
    }
    if (instagram_handle !== undefined) {
      userUpdateFields.push(`"instagramHandle" = $${userParamIndex}`);
      userValues.push(instagram_handle);
      userParamIndex++;
    }

    if (userUpdateFields.length > 0) {
      userUpdateFields.push(`"updatedAt" = NOW()`);
      userValues.push(userId);

      await pool.query(
        `UPDATE users SET ${userUpdateFields.join(', ')} WHERE id = $${userParamIndex}`,
        userValues
      );
    }

    // Fetch updated barber profile
    const result = await pool.query(
      `SELECT 
        b.id,
        b."userId" as user_id,
        b.bio,
        b.specialties,
        b."avgRating" as average_rating,
        b."totalReviews" as total_reviews,
        b."totalBookings" as total_bookings,
        b."isActive" as is_active,
        u.first_name,
        u.last_name,
        u."displayName" as display_name,
        u."avatarUrl" as profile_picture_url,
        u."instagramHandle" as instagram_handle
      FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE b.id = $1`,
      [id]
    );

    const barber = result.rows[0];

    res.json({
      success: true,
      data: {
        ...barber,
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`.trim(),
      },
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
    const file = req.file as Express.Multer.File;
    const s3Result = await uploadToS3(file.buffer, `portfolio/${id}/${Date.now()}.webp`);

    if (!s3Result.success || !s3Result.url) {
      throw new ApiError(500, 'Failed to upload image');
    }

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
      [id, s3Result.url, caption, nextOrder]
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

