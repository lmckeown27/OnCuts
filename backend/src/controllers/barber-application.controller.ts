import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';

interface BarberApplicationBody {
  yearsExperience: string;
  hasLicense: boolean;
  licenseNumber?: string;
  specialties: string[];
  hasOwnTools: boolean;
  availableHours: string;
  whyBeBarber: string;
  portfolioDescription?: string;
  socialMedia?: string;
  additionalNotes?: string;
}

/**
 * Submit a new barber application
 * POST /api/v1/barber-applications
 */
export const submitApplication = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    const {
      yearsExperience,
      hasLicense,
      licenseNumber,
      specialties,
      hasOwnTools,
      availableHours,
      whyBeBarber,
      portfolioDescription,
      socialMedia,
      additionalNotes
    }: BarberApplicationBody = req.body;

    // Validate required fields
    if (!yearsExperience || !specialties || specialties.length === 0 || !availableHours || !whyBeBarber) {
      throw new ApiError(400, 'Missing required fields: yearsExperience, specialties, availableHours, and whyBeBarber are required');
    }

    // Get user's campus ID
    const userResult = await pool.query(
      'SELECT "campusId", role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const user = userResult.rows[0];

    // Check if user is already a barber
    if (user.role === 'BARBER') {
      throw new ApiError(400, 'You are already a barber on this platform');
    }

    // Check for existing pending application
    const existingApplication = await pool.query(
      `SELECT id, status FROM barber_applications 
       WHERE user_id = $1 AND status IN ('pending', 'under_review', 'interview_scheduled')`,
      [userId]
    );

    if (existingApplication.rows.length > 0) {
      const existing = existingApplication.rows[0];
      throw new ApiError(400, `You already have a ${existing.status.replace('_', ' ')} application. Please wait for it to be processed.`);
    }

    // Insert the application
    const result = await pool.query(
      `INSERT INTO barber_applications (
        user_id, campus_id, years_experience, has_license, license_number,
        specialties, has_own_tools, available_hours, why_be_barber,
        portfolio_description, social_media, additional_notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
      RETURNING id, status, created_at`,
      [
        userId,
        user.campusId,
        yearsExperience,
        hasLicense || false,
        licenseNumber || null,
        specialties,
        hasOwnTools || false,
        availableHours,
        whyBeBarber,
        portfolioDescription || null,
        socialMedia || null,
        additionalNotes || null
      ]
    );

    const application = result.rows[0];

    logger.info(`New barber application submitted: ${application.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully! Our campus manager will review it within 2-3 business days.',
      data: {
        applicationId: application.id,
        status: application.status,
        submittedAt: application.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's application status
 * GET /api/v1/barber-applications/my-application
 */
export const getMyApplication = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    const result = await pool.query(
      `SELECT id, status, years_experience, specialties, available_hours,
              created_at, reviewed_at, interview_scheduled_at
       FROM barber_applications 
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No application found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all applications (admin/campus manager only)
 * GET /api/v1/barber-applications
 */
export const getAllApplications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, campusId, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        ba.id,
        ba.user_id,
        ba.status,
        ba.years_experience,
        ba.has_license,
        ba.license_number,
        ba.specialties,
        ba.has_own_tools,
        ba.available_hours,
        ba.why_be_barber,
        ba.social_media,
        ba.additional_notes,
        ba.created_at,
        ba.reviewed_at,
        ba.interview_scheduled_at,
        u.email,
        u.first_name,
        u.last_name,
        c.name as campus_name
      FROM barber_applications ba
      JOIN users u ON ba.user_id = u.id
      LEFT JOIN campuses c ON ba.campus_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND ba.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (campusId) {
      query += ` AND ba.campus_id = $${paramIndex}`;
      params.push(campusId);
      paramIndex++;
    }

    query += ` ORDER BY ba.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM barber_applications ba WHERE 1=1`;
    const countParams: any[] = [];
    let countIndex = 1;

    if (status) {
      countQuery += ` AND ba.status = $${countIndex}`;
      countParams.push(status);
      countIndex++;
    }

    if (campusId) {
      countQuery += ` AND ba.campus_id = $${countIndex}`;
      countParams.push(campusId);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        applications: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update application status (admin/campus manager only)
 * PATCH /api/v1/barber-applications/:id/status
 */
export const updateApplicationStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes, interviewScheduledAt } = req.body;
    const reviewerId = req.user?.userId;

    const validStatuses = ['pending', 'under_review', 'interview_scheduled', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Check if application exists
    const existing = await pool.query(
      'SELECT id, user_id, status FROM barber_applications WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      throw new ApiError(404, 'Application not found');
    }

    // Update the application
    const result = await pool.query(
      `UPDATE barber_applications 
       SET status = $1, 
           reviewed_by = $2, 
           reviewed_at = NOW(),
           review_notes = COALESCE($3, review_notes),
           interview_scheduled_at = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, reviewerId, reviewNotes || null, interviewScheduledAt || null, id]
    );

    const updatedApplication = result.rows[0];

    // If approved, update user role to BARBER
    if (status === 'approved') {
      await pool.query(
        `UPDATE users SET role = 'BARBER', "updatedAt" = NOW() WHERE id = $1`,
        [updatedApplication.user_id]
      );

      // Get the full application data including specialties
      const fullApp = await pool.query(
        'SELECT specialties FROM barber_applications WHERE id = $1',
        [id]
      );
      const specialties = fullApp.rows[0]?.specialties || [];

      // Create barber profile with specialties
      await pool.query(
        `INSERT INTO barbers ("userId", specialties, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT ("userId") DO UPDATE SET 
           specialties = EXCLUDED.specialties,
           "isActive" = true,
           "updatedAt" = NOW()`,
        [
          updatedApplication.user_id,
          JSON.stringify(specialties)
        ]
      );

      logger.info(`User ${updatedApplication.user_id} promoted to BARBER after application ${id} approved`);
    }

    logger.info(`Barber application ${id} status updated to ${status} by ${reviewerId}`);

    res.json({
      success: true,
      message: `Application ${status === 'approved' ? 'approved! User has been promoted to barber.' : 'updated successfully.'}`,
      data: updatedApplication
    });
  } catch (error) {
    next(error);
  }
};

