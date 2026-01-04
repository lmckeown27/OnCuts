import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendBarberApplicationNotification } from '../services/email.service';

interface BarberApplicationBody {
  campusId: string;
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
      campusId,
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
    if (!campusId || !yearsExperience || !specialties || specialties.length === 0 || !availableHours || !whyBeBarber) {
      throw new ApiError(400, 'Missing required fields: campusId, yearsExperience, specialties, availableHours, and whyBeBarber are required');
    }

    // Verify the campus exists
    const campusCheck = await pool.query('SELECT id, name FROM campuses WHERE id = $1', [campusId]);
    if (campusCheck.rows.length === 0) {
      throw new ApiError(400, 'Invalid campus selected');
    }

    // Get user's role
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const user = userResult.rows[0];
    // Use the campus selected in the application form
    user.campusId = campusId;

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

    // Get applicant details and campus manager info for email notification
    try {
      const applicantInfo = await pool.query(
        `SELECT u.first_name, u.last_name, u.email, c.name as campus_name
         FROM users u
         LEFT JOIN campuses c ON u."campusId" = c.id
         WHERE u.id = $1`,
        [userId]
      );

      const applicant = applicantInfo.rows[0];

      // Find campus manager(s) for this campus
      const campusManagers = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.email
         FROM users u
         JOIN barbers b ON u.id = b."userId"
         WHERE b."campusId" = $1 AND b."isCampusManager" = true AND u.role = 'CAMPUS_MANAGER'`,
        [user.campusId]
      );

      // Send email to each campus manager
      for (const manager of campusManagers.rows) {
        const managerName = `${manager.first_name} ${manager.last_name}`.trim();
        
        await sendBarberApplicationNotification(
          manager.email,
          managerName,
          {
            applicantName: `${applicant.first_name} ${applicant.last_name}`.trim(),
            applicantEmail: applicant.email,
            campusName: applicant.campus_name || 'Unknown Campus',
            yearsExperience,
            hasLicense: hasLicense || false,
            licenseNumber: licenseNumber || undefined,
            specialties,
            hasOwnTools: hasOwnTools || false,
            availableHours,
            whyBeBarber,
            portfolioDescription: portfolioDescription || undefined,
            socialMedia: socialMedia || undefined,
            additionalNotes: additionalNotes || undefined,
            applicationId: application.id,
            submittedAt: new Date(application.created_at).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })
          }
        );
        
        logger.info(`Barber application notification sent to campus manager: ${manager.email}`);
      }

      if (campusManagers.rows.length === 0) {
        logger.warn(`No campus manager found for campus ${user.campusId} to notify about application ${application.id}`);
      }
    } catch (emailError: any) {
      // Don't fail the application submission if email fails
      logger.error(`Failed to send barber application notification email:`, emailError.message);
    }

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
      // Note: Must include ALL required NOT NULL columns from barbers table
      await pool.query(
        `INSERT INTO barbers (
           id, "userId", "campusId", specialties, "isActive", "weeklySchedule",
           "currentMinPriceUsdCents", "currentMaxPriceUsdCents",
           "totalBookings", "completedBookings", "cancelledBookings", "totalReviews",
           "pricingMultiplier", "isCampusManager", "isOnboarded",
           "createdAt", "updatedAt"
         )
         VALUES (
           gen_random_uuid(), $1, $2, $3, true, '{}',
           0, 0,
           0, 0, 0, 0,
           1.00, false, false,
           NOW(), NOW()
         )
         ON CONFLICT ("userId") DO UPDATE SET 
           specialties = EXCLUDED.specialties,
           "isActive" = true,
           "campusId" = EXCLUDED."campusId",
           "updatedAt" = NOW()`,
        [
          updatedApplication.user_id,
          updatedApplication.campus_id,
          specialties  // Pass array directly, pg driver handles TEXT[] conversion
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

