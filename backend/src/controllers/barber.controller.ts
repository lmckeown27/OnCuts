import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { uploadToS3 } from '../services/s3.service';
import { logger } from '../utils/logger';
import { getSocketIO } from '../index';
import { USER_PRIMARY_WALLET_SQL_U } from '../utils/user-wallet-address';
import { assertNoMessagingBlockBetween, isUgcModerationSchemaReady } from '../services/ugc-moderation.service';
import {
  CLIENT_CANCEL_REFUND_HOUR_PRESETS,
} from '../services/booking-cancellation.service';
import { normalizePricingEntries, enrichPricingWithDurations } from '../utils/service-duration.utils';
import {
  BOOKING_SLOT_INTERVAL_PRESETS,
  SAME_DAY_BOOKING_BUFFER_MINUTES,
  bookingStatusBlocksScheduleSql,
  generateBookableStartSlots,
  getDayNameFromDateString,
  getIntervalsForDay,
  resolveBookingSlotIntervalMinutes,
  weeklyScheduleHasOpenHours,
  type WeeklySchedule,
} from '../services/barber-availability.service';
import {
  barberServiceLocationLabelSelectSql,
  barberServiceLocationSourceSelectSql,
} from '../services/barber-location-schema.service';
import {
  barberProviderTypeExpr,
  barberProviderTypeSelectSql,
} from '../services/barber-provider-schema.service';
import {
  normalizeProviderType,
  providerTypeSlugFromCategoryOrType,
} from '../utils/service-provider.mapper';
import {
  inferServiceProviderType,
  serviceDurationColumnsExist,
  serviceProviderTypeColumnExist,
  serviceSelectSql,
} from '../services/service-schema.service';
import { filterRowsEligibleForConsumerBrowse } from '../services/connect-consumer-eligibility.service';
import {
  getFeeBurden,
  isCommissionFreeEligible,
  isPlatformCommissionEnabled,
  parseCommissionIncentiveMode,
  parseIncentiveExpiresAt,
} from '../utils/platform-commission';

/** Marketplace hide flag + schedule / slot-interval aliases for web (snake) and iOS (camel). */
function withHiddenFlags<T extends Record<string, unknown>>(barber: T) {
  const isHidden = barber.is_hidden === true || barber.isHidden === true;
  const allowHiddenDirectBooking =
    barber.allow_hidden_direct_booking === true ||
    barber.allowHiddenDirectBooking === true;
  const weekly = barber.weekly_schedule ?? barber.weeklySchedule;
  const slotInterval = resolveBookingSlotIntervalMinutes(
    barber.booking_slot_interval_minutes ?? barber.bookingSlotIntervalMinutes
  );
  return {
    ...barber,
    is_hidden: isHidden,
    isHidden,
    allow_hidden_direct_booking: allowHiddenDirectBooking,
    allowHiddenDirectBooking,
    weekly_schedule: weekly,
    weeklySchedule: weekly,
    booking_slot_interval_minutes: slotInterval,
    bookingSlotIntervalMinutes: slotInterval,
  };
}

export const getAllBarbers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campusId, minRating, maxPrice, specialty, lat, lng, maxDistance, includeHidden, constrainListByDistance, providerType, category } = req.query;
    const labelSelect = await barberServiceLocationLabelSelectSql();
    const sourceSelect = await barberServiceLocationSourceSelectSql();
    const providerTypeSelect = await barberProviderTypeSelectSql();
    
    // Parse user location for distance-based sorting
    const userLat = lat ? parseFloat(lat as string) : null;
    const userLng = lng ? parseFloat(lng as string) : null;
    const hasUserLocation = userLat !== null && userLng !== null && 
                            !isNaN(userLat) && !isNaN(userLng);
    
    // Maximum distance filter in km (default: 8km / ~5 miles)
    const rawMax =
      maxDistance !== undefined && maxDistance !== null && String(maxDistance).trim() !== ''
        ? parseFloat(String(maxDistance))
        : NaN;
    const maxDistanceKm =
      Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 8;

    const constrainByDistance =
      constrainListByDistance === 'true' || constrainListByDistance === '1';

    // Build dynamic query for barbers from PostgreSQL
    // Column names match Prisma schema: avgRating, totalReviews, totalBookings, isActive
    // If user location provided, calculate distance using Haversine formula
    let query = `
      SELECT 
        b.id,
        b."userId" as user_id,
        b.bio,
        b.specialties,
        b.pricing,
        b."avgRating" as average_rating,
        b."totalReviews" as total_reviews,
        b."totalBookings" as total_bookings,
        b."isActive" as is_active,
        b.is_hidden,
        b."createdAt" as created_at,
        b."weeklySchedule" as weekly_schedule,
        b.service_latitude,
        b.service_longitude,
        b.service_radius_km${labelSelect}${sourceSelect}${providerTypeSelect},
        u.email,
        u.first_name,
        u.last_name,
        u."displayName" as display_name,
        u."avatarUrl" as profile_picture_url,
        u."instagramHandle" as instagram_handle,
        u."campusId" as campus_id,
        u.latitude as user_latitude,
        u.longitude as user_longitude,
        u.stripe_account_id,
        u.stripe_payouts_enabled,
        (SELECT COUNT(*)::int FROM bookings bk
         WHERE bk."barberId" = b.id AND bk."reviewRating" = 5) AS five_star_review_count
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    // Add distance from search point to each barber's public service pin
    if (hasUserLocation) {
      query += `,
        (6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians($${paramIndex})) * 
            cos(radians(b.service_latitude)) * 
            cos(radians(b.service_longitude) - radians($${paramIndex + 1})) + 
            sin(radians($${paramIndex})) * 
            sin(radians(b.service_latitude))
          ))
        )) as distance_km
      `;
      params.push(userLat, userLng);
      paramIndex += 2;
    }

    // Build WHERE clause - admin requests can include hidden barbers
    // When includeHidden=true (CM view), show ALL barbers including those without Stripe / is_hidden
    // When includeHidden=false (consumer view), only show active, listed barbers with Stripe setup
    const shouldIncludeHidden = includeHidden === 'true';
    
    // Filter by user role = 'BARBER' or 'CAMPUS_MANAGER' to exclude demoted users
    // Campus managers are still barbers who can accept bookings
    // is_hidden is marketplace visibility only; isActive is demotion / account liveness
    query += `
      FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN') ${shouldIncludeHidden ? '' : 'AND b."isActive" = true AND b.is_hidden = false AND u.stripe_account_id IS NOT NULL AND u.stripe_payouts_enabled = true AND u.stripe_charges_enabled = true AND (u."isBanned" IS NOT TRUE)'}
    `;

    if (constrainByDistance && hasUserLocation) {
      query += ` AND b.service_latitude IS NOT NULL AND b.service_longitude IS NOT NULL`;
    }

    // Handle campusId - can be UUID or slug (admin/legacy; consumer radius browse omits this)
    let resolvedCampusId = campusId as string | undefined;
    if (campusId) {
      // Check if it's a UUID (simple regex check)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campusId as string);
      
      if (!isUUID) {
        // It's a slug - look up the campus by name/slug
        const campusResult = await pool.query(
          `SELECT id FROM campuses 
           WHERE LOWER(REPLACE(name, ' ', '-')) LIKE LOWER($1) 
              OR LOWER(name) LIKE LOWER($2)
           LIMIT 1`,
          [`%${campusId}%`, `%${(campusId as string).replace(/-/g, ' ')}%`]
        );
        
        if (campusResult.rows.length > 0) {
          resolvedCampusId = campusResult.rows[0].id;
          logger.info(`Resolved campus slug "${campusId}" to UUID: ${resolvedCampusId}`);
        } else {
          logger.warn(`Campus slug "${campusId}" not found in database`);
          resolvedCampusId = undefined; // Don't filter by campus if not found
        }
      }
      
      if (resolvedCampusId) {
        // Include barbers assigned on the barber row OR only on the user row (legacy / incomplete profiles)
        query += ` AND (b."campusId" = $${paramIndex} OR u."campusId" = $${paramIndex})`;
        params.push(resolvedCampusId);
        paramIndex++;
      }
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

    if (providerType) {
      const providerTypeExpr = await barberProviderTypeExpr();
      const slug = normalizeProviderType(String(providerType));
      query += ` AND LOWER(${providerTypeExpr}) = LOWER($${paramIndex})`;
      params.push(slug);
      paramIndex++;
    } else if (category) {
      const slug = providerTypeSlugFromCategoryOrType(String(category));
      if (slug) {
        const providerTypeExpr = await barberProviderTypeExpr();
        query += ` AND LOWER(${providerTypeExpr}) = LOWER($${paramIndex})`;
        params.push(slug);
        paramIndex++;
      }
    }

    const viewerUserId = req.user?.userId;
    if (viewerUserId && !shouldIncludeHidden && (await isUgcModerationSchemaReady())) {
      query += ` AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_user_id = $${paramIndex}::uuid AND ub.blocked_user_id = u.id)
           OR (ub.blocker_user_id = u.id AND ub.blocked_user_id = $${paramIndex}::uuid)
      )`;
      params.push(viewerUserId);
      paramIndex++;
    }

    // Consumer view: sort by accumulated 5-star reviews (most first).
    // Campus manager view: keep distance/rating ordering for operational use.
    if (shouldIncludeHidden) {
      if (hasUserLocation) {
        query += ` ORDER BY distance_km ASC NULLS LAST, b."avgRating" DESC NULLS LAST`;
      } else {
        query += ` ORDER BY b."avgRating" DESC NULLS LAST`;
      }
    } else {
      if (hasUserLocation && constrainByDistance) {
        query += ` ORDER BY distance_km ASC NULLS LAST, five_star_review_count DESC NULLS LAST, b."avgRating" DESC NULLS LAST, b."createdAt" ASC`;
      } else {
        query += ` ORDER BY five_star_review_count DESC NULLS LAST, b."avgRating" DESC NULLS LAST, b."createdAt" ASC`;
      }
    }

    const result = await pool.query(query, params);
    
    // Filter by max distance when consumer browse explicitly constrains by distance.
    let filteredRows = result.rows;
    let showingClosestFallback = false;
    
    const shouldApplyDistanceFilter = hasUserLocation && constrainByDistance;

    if (shouldApplyDistanceFilter) {
      const nearbyRows = result.rows.filter(row => {
        if (row.distance_km === null || row.distance_km === undefined) {
          return false;
        }
        return row.distance_km <= maxDistanceKm;
      });

      if (
        nearbyRows.length === 0 &&
        result.rows.length > 0 &&
        !constrainByDistance
      ) {
        filteredRows = result.rows;
        showingClosestFallback = true;
      } else {
        filteredRows = nearbyRows;
      }
    }

    if (!shouldIncludeHidden && filteredRows.length > 0) {
      filteredRows = await filterRowsEligibleForConsumerBrowse(filteredRows);
    }
    
    // Get services/pricing for each barber
    const barbers = await Promise.all(filteredRows.map(async (barber) => {
      // Get fallback pricing from barber_services table
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
      
      // Get barber's assigned service locations
      const locationsResult = await pool.query(
        `SELECT 
          sl.id,
          sl.name,
          sl.description,
          bsl.is_primary
        FROM barber_service_locations bsl
        JOIN service_locations sl ON bsl.location_id = sl.id
        WHERE bsl.barber_id = $1 AND sl.status = 'approved' AND sl.is_active = true
        ORDER BY bsl.is_primary DESC, sl.name ASC`,
        [barber.id]
      );
      
      // Get review stats from bookings (average and count of submitted reviews only)
      const reviewStatsResult = await pool.query(
        `SELECT 
          AVG("reviewRating")::numeric(3,2) as average_rating,
          COUNT(*) as review_count
        FROM bookings 
        WHERE "barberId" = $1 AND "reviewRating" IS NOT NULL`,
        [barber.id]
      );
      const averageRating = parseFloat(reviewStatsResult.rows[0]?.average_rating || '0');
      const reviewCount = parseInt(reviewStatsResult.rows[0]?.review_count || '0', 10);
      
      // Use barber.pricing (from barbers table JSONB) if available, otherwise fall back to barber_services
      const customPricing = barber.pricing || [];
      const servicePricing = servicesResult.rows.map(s => ({
        ...s,
        price: s.price / 100 // Convert cents to dollars for frontend
      }));
      
      // Filter out services that have been deleted (is_active = false in services table)
      let filteredPricing = customPricing.length > 0 ? customPricing : servicePricing;
      const activeServicesResult = await pool.query(
        `SELECT LOWER(name) as name FROM services WHERE is_active = true`
      );
      const activeServiceNames = new Set(activeServicesResult.rows.map(s => s.name.toLowerCase()));
      
      if (filteredPricing.length > 0) {
        filteredPricing = filteredPricing.filter((p: any) => 
          activeServiceNames.has(p.name?.toLowerCase())
        );
      }
      
      // Also filter specialties to remove deleted services
      const filteredSpecialties = Array.isArray(barber.specialties) 
        ? barber.specialties.filter((s: string) => activeServiceNames.has(s?.toLowerCase()))
        : [];
      
      return {
        ...barber,
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`,
        // Include distance if calculated (rounded to 1 decimal)
        distance_km: barber.distance_km !== null ? Math.round(barber.distance_km * 10) / 10 : null,
        // Convert km to miles for US users
        distance_miles: barber.distance_km !== null ? Math.round(barber.distance_km * 0.621371 * 10) / 10 : null,
        pricing: enrichPricingWithDurations(filteredPricing),
        specialties: filteredSpecialties,
        portfolio_images: portfolioResult.rows,
        service_locations: locationsResult.rows,
        average_rating: averageRating,
        review_count: reviewCount,
        five_star_review_count: parseInt(barber.five_star_review_count || '0', 10),
        // Stripe status - fully set up (visible to consumers) vs not
        has_stripe_setup: !!barber.stripe_account_id && barber.stripe_payouts_enabled === true,
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

    const defaultProviderTypes = [
      { provider_type: 'barber', label: 'Barber' },
      { provider_type: 'beauty', label: 'Beauty' },
    ];
    let providerTypes = defaultProviderTypes;
    try {
      const providerTypesResult = await pool.query(
        `SELECT provider_type, label FROM provider_types ORDER BY label ASC`
      );
      if (providerTypesResult.rows.length > 0) {
        providerTypes = providerTypesResult.rows;
      }
    } catch (err) {
      logger.warn(
        'provider_types lookup failed (run migration 040_provider_types.sql); using Barber/Beauty fallback',
        err
      );
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
      meta: {
        sorted_by: shouldIncludeHidden
          ? (hasUserLocation ? 'distance' : 'rating')
          : 'five_star_reviews',
        user_location_provided: hasUserLocation,
        max_distance_km: shouldApplyDistanceFilter && !showingClosestFallback ? maxDistanceKm : null,
        max_distance_miles: shouldApplyDistanceFilter && !showingClosestFallback ? Math.round(maxDistanceKm * 0.621371 * 10) / 10 : null,
        total_before_distance_filter: shouldApplyDistanceFilter ? result.rows.length : filteredBarbers.length,
        showing_closest_fallback: showingClosestFallback,
        constrain_list_by_distance: constrainByDistance,
        provider_types: providerTypes,
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

    const labelSelect = await barberServiceLocationLabelSelectSql();
    const sourceSelect = await barberServiceLocationSourceSelectSql();
    const providerTypeSelect = await barberProviderTypeSelectSql();

    const barberResult = await pool.query(
      `SELECT 
        b.id,
        b."userId" as user_id,
        b.bio,
        b.specialties,
        b.pricing,
        b."avgRating" as average_rating,
        b."totalReviews" as total_reviews,
        b."totalBookings" as total_bookings,
        b."isActive" as is_active,
        b.is_hidden,
        b.client_cancel_refund_hours,
        b.booking_slot_interval_minutes,
        b."createdAt" as created_at,
        b."weeklySchedule" as weekly_schedule,
        u.email,
        u.first_name,
        u.last_name,
        u."displayName" as display_name,
        u."avatarUrl" as profile_picture_url,
        u."instagramHandle" as instagram_handle,
        u."campusId" as campus_id,
        b.service_latitude,
        b.service_longitude,
        b.service_radius_km${labelSelect}${sourceSelect}${providerTypeSelect}
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

    // Filter out services that have been deleted (is_active = false in services table)
    let servicePricing = servicesResult.rows.map(s => ({
      ...s,
      price: s.price / 100
    }));
    if (servicePricing.length > 0) {
      const activeServicesResult = await pool.query(
        `SELECT LOWER(name) as name FROM services WHERE is_active = true`
      );
      const activeServiceNames = new Set(activeServicesResult.rows.map(s => s.name.toLowerCase()));
      servicePricing = servicePricing.filter((p: any) => 
        activeServiceNames.has(p.name?.toLowerCase())
      );
    }

    res.json({
      success: true,
      data: withHiddenFlags({
        ...barber,
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`,
        pricing: enrichPricingWithDurations(servicePricing),
      }),
    });
  } catch (error) {
    logger.error('Error in getMyBarberProfile:', error);
    next(error);
  }
};

/**
 * Get barber by user ID
 * Auto-creates a barber record if the user is a barber but doesn't have one yet
 */
export const getBarberByUserId = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const labelSelect = await barberServiceLocationLabelSelectSql();
    const sourceSelect = await barberServiceLocationSourceSelectSql();
    const providerTypeSelect = await barberProviderTypeSelectSql();

    let barberResult;
    try {
      barberResult = await pool.query(
        `SELECT 
          b.id,
          b."userId" as user_id,
          b.bio,
          b.specialties,
          b.pricing,
          b."avgRating" as average_rating,
          b."totalReviews" as total_reviews,
          b."totalBookings" as total_bookings,
          b."isActive" as is_active,
          b.is_hidden,
          b.client_cancel_refund_hours,
          b.booking_slot_interval_minutes,
          b.reapply_allowed_at,
          b."createdAt" as created_at,
          b."weeklySchedule" as weekly_schedule,
          b.commission_free_bookings_remaining,
          b.commission_incentive_mode,
          b.commission_incentive_expires_at,
          b.service_latitude,
          b.service_longitude,
          b.service_radius_km${labelSelect}${sourceSelect}${providerTypeSelect},
          u.email,
          u.first_name,
          u.last_name,
          u."displayName" as display_name,
          u."avatarUrl" as profile_picture_url,
          u."instagramHandle" as instagram_handle,
          u."campusId" as campus_id,
          u.role as user_type,
          u."isBanned" as user_is_banned,
          c.timezone as campus_timezone
        FROM barbers b
        JOIN users u ON b."userId" = u.id
        LEFT JOIN campuses c ON u."campusId" = c.id
        WHERE b."userId" = $1`,
        [userId]
      );
    } catch (selectErr: any) {
      if (selectErr?.code !== '42703') throw selectErr;
      barberResult = await pool.query(
        `SELECT 
          b.id,
          b."userId" as user_id,
          b.bio,
          b.specialties,
          b.pricing,
          b."avgRating" as average_rating,
          b."totalReviews" as total_reviews,
          b."totalBookings" as total_bookings,
          b."isActive" as is_active,
          false as is_hidden,
          1 as client_cancel_refund_hours,
          15 as booking_slot_interval_minutes,
          NULL::timestamptz as reapply_allowed_at,
          b."createdAt" as created_at,
          b."weeklySchedule" as weekly_schedule,
          b.commission_free_bookings_remaining,
          'count'::varchar as commission_incentive_mode,
          NULL::timestamptz as commission_incentive_expires_at,
          b.service_latitude,
          b.service_longitude,
          b.service_radius_km${labelSelect}${sourceSelect}${providerTypeSelect},
          u.email,
          u.first_name,
          u.last_name,
          u."displayName" as display_name,
          u."avatarUrl" as profile_picture_url,
          u."instagramHandle" as instagram_handle,
          u."campusId" as campus_id,
          u.role as user_type,
          u."isBanned" as user_is_banned,
          c.timezone as campus_timezone
        FROM barbers b
        JOIN users u ON b."userId" = u.id
        LEFT JOIN campuses c ON u."campusId" = c.id
        WHERE b."userId" = $1`,
        [userId]
      );
    }

    // If no barber record exists, auto-create for users who already have operator role.
    // New operators must go through application approval (which inserts the row).
    // This upsert remains so existing BARBER accounts without a row keep working.
    if (barberResult.rows.length === 0) {
      // Check if user exists and is a barber
      const userResult = await pool.query(
        `SELECT id, first_name, last_name, email, "displayName" as display_name, 
                "avatarUrl" as profile_picture_url, "instagramHandle" as instagram_handle, 
                "campusId" as campus_id, role as user_type, "isBanned" as user_is_banned
         FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const user = userResult.rows[0];
      if (user.user_is_banned === true) {
        return res.status(404).json({
          success: false,
          message: 'User is not a barber',
        });
      }

      // Only auto-create if user is a barber (legacy CAMPUS_MANAGER DB role included)
      const userRole = (user.user_type || '').toUpperCase();
      logger.info(`Auto-create role check: user_type=${user.user_type}, normalized=${userRole}, campus_id=${user.campus_id}`);
      
      if (userRole !== 'BARBER' && userRole !== 'CAMPUS_MANAGER') {
        logger.warn(`User ${userId} has role ${userRole}, not allowed to auto-create barber profile`);
        return res.status(404).json({
          success: false,
          message: 'User is not a barber',
        });
      }

      // Auto-create barber record with defaults
      // Using only columns that are guaranteed to exist in the barbers table
      logger.info(`Auto-creating barber record for user ${userId}`);
      
      const defaultSchedule = {
        sunday: { enabled: false, intervals: [] },
        monday: { enabled: true, intervals: [{ id: 'default-1', start: '09:00', end: '17:00' }] },
        tuesday: { enabled: true, intervals: [{ id: 'default-2', start: '09:00', end: '17:00' }] },
        wednesday: { enabled: true, intervals: [{ id: 'default-3', start: '09:00', end: '17:00' }] },
        thursday: { enabled: true, intervals: [{ id: 'default-4', start: '09:00', end: '17:00' }] },
        friday: { enabled: true, intervals: [{ id: 'default-5', start: '09:00', end: '17:00' }] },
        saturday: { enabled: false, intervals: [] },
      };
      
      // Use upsert pattern - explicitly generate UUID for id since table lacks default
      // Include ALL required NOT NULL columns from barbers table schema
      // No campus org tag; public pin is set later via device/manual location
      const createResult = await pool.query(
        `INSERT INTO barbers (
           id, "userId", "campusId", specialties, "isActive", "weeklySchedule",
           "currentMinPriceUsdCents", "currentMaxPriceUsdCents",
           "totalBookings", "completedBookings", "cancelledBookings", "totalReviews",
           "pricingMultiplier", "isCampusManager", "isOnboarded",
           service_latitude, service_longitude, service_location_source, service_location_updated_at,
           "createdAt", "updatedAt"
         )
         VALUES (
           gen_random_uuid(), $1, NULL, ARRAY[]::text[], true, $2,
           0, 0,
           0, 0, 0, 0,
           1.00, false, false,
           NULL, NULL, NULL, NULL,
           NOW(), NOW()
         )
         ON CONFLICT ("userId") DO UPDATE SET 
           "isActive" = true,
           "weeklySchedule" = COALESCE(barbers."weeklySchedule", EXCLUDED."weeklySchedule"),
           "updatedAt" = NOW()
         RETURNING id, "userId" as user_id, bio, specialties, 
                   "isActive" as is_active, "createdAt" as created_at, "weeklySchedule" as weekly_schedule`,
        [
          userId,
          JSON.stringify(defaultSchedule),
        ]
      );

      const barber = createResult.rows[0];
      
      return res.json({
        success: true,
        data: withHiddenFlags({
          ...barber,
          bio: barber.bio || '',
          average_rating: 0,
          total_reviews: 0,
          total_bookings: 0,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          display_name: user.display_name,
          profile_picture_url: user.profile_picture_url,
          instagram_handle: user.instagram_handle,
          campus_id: user.campus_id,
          name: user.display_name || `${user.first_name} ${user.last_name}`,
        }),
      });
    }

    const barber = barberResult.rows[0];
    if (barber.user_is_banned === true) {
      return res.status(404).json({
        success: false,
        message: 'User is not a barber',
      });
    }
    delete barber.user_is_banned;
    const reapplyAllowed = barber.reapply_allowed_at != null;
    delete barber.reapply_allowed_at;

    const pricing = Array.isArray(barber.pricing) ? barber.pricing : [];

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    const storedFreeRemaining =
      Math.max(0, parseInt(String(barber.commission_free_bookings_remaining ?? '0'), 10) || 0);
    const commissionIncentiveMode = parseCommissionIncentiveMode(barber.commission_incentive_mode);
    const storedExpiresAt = parseIncentiveExpiresAt(barber.commission_incentive_expires_at);
    // When platform commission is off, or Client Burden Service Fee is on, the operator
    // is not paying commission — hide per-operator commissionless UI.
    const platformCommissionEnabled = await isPlatformCommissionEnabled();
    const feeBurden = await getFeeBurden();
    const operatorCommissionOn = platformCommissionEnabled && feeBurden !== 'client';
    const commissionIncentiveActive =
      operatorCommissionOn &&
      isCommissionFreeEligible({
        incentiveMode: commissionIncentiveMode,
        incentiveExpiresAt: storedExpiresAt,
        commissionFreeBookingsRemaining: storedFreeRemaining,
      });
    const commissionFreeBookingsRemaining = operatorCommissionOn ? storedFreeRemaining : 0;
    const commissionIncentiveExpiresAt = operatorCommissionOn
      ? storedExpiresAt?.toISOString() ?? null
      : null;
    res.json({
      success: true,
      data: withHiddenFlags({
        ...barber,
        reapply_allowed: reapplyAllowed,
        platformCommissionEnabled,
        commissionFreeBookingsRemaining,
        commissionIncentiveMode,
        commissionIncentiveExpiresAt,
        commissionIncentiveActive,
        pricing: enrichPricingWithDurations(pricing),
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`,
      }),
    });
  } catch (error) {
    logger.error('Error in getBarberByUserId:', error);
    next(error);
  }
};

export const getBarberById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const providerTypeSelect = await barberProviderTypeSelectSql();

    // Get barber from PostgreSQL
    // Column names match Prisma schema
    const barberResult = await pool.query(
      `SELECT 
        b.id,
        b."userId" as user_id,
        b.bio,
        b.specialties,
        b.pricing,
        b."avgRating" as average_rating,
        b."totalReviews" as total_reviews,
        b."totalBookings" as total_bookings,
        b."isActive" as is_active,
        b.is_hidden,
        b.allow_hidden_direct_booking,
        b."createdAt" as created_at,
        b."weeklySchedule" as weekly_schedule,
        u."instagramHandle" as instagram_handle,
        u.email,
        u.first_name,
        u.last_name,
        u."displayName" as display_name,
        u."avatarUrl" as profile_picture_url,
        u."campusId" as campus_id,
        u."isBanned" as user_is_banned${providerTypeSelect}
      FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE b.id = $1`,
      [id]
    );

    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    const barber = barberResult.rows[0];
    if (barber.user_is_banned === true) {
      throw new ApiError(404, 'Barber not found');
    }
    delete barber.user_is_banned;

    const viewerId = req.user?.userId;
    const viewerRole = String(req.user?.role || '').toLowerCase();
    const isOwner = viewerId && String(viewerId) === String(barber.user_id);
    const isStaff = viewerRole === 'admin' || viewerRole === 'campus_manager';
    // Hidden profiles stay off discovery. Owners/staff always load them.
    // Consumers may load via booking link when allow_hidden_direct_booking is on.
    const allowHiddenDirect =
      barber.allow_hidden_direct_booking === true ||
      barber.allowHiddenDirectBooking === true;
    if (barber.is_hidden === true && !allowHiddenDirect && !isOwner && !isStaff) {
      throw new ApiError(404, 'Barber not found');
    }
    if (viewerId) {
      await assertNoMessagingBlockBetween(String(viewerId), String(barber.user_id));
    }

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

    // Get reviews from bookings table (reviews are stored as reviewRating and reviewComment on bookings)
    const reviewsResult = await pool.query(
      `SELECT 
        b.id,
        b."reviewRating" as rating,
        b."reviewComment" as review_text,
        b."reviewedAt" as created_at,
        u.first_name,
        u.last_name,
        u."avatarUrl" as profile_picture_url,
        COALESCE(c.service_name, b."serviceType"::text) as service_name
      FROM bookings b
      JOIN users u ON b."consumerId" = u.id
      LEFT JOIN conversations c ON b.id = c.booking_id
      WHERE b."barberId" = $1 AND b."reviewRating" IS NOT NULL
      ORDER BY b."reviewedAt" DESC
      LIMIT 10`,
      [id]
    );

    // Get review stats from bookings (average and count of submitted reviews only)
    const reviewStatsResult = await pool.query(
      `SELECT 
        AVG("reviewRating")::numeric(3,2) as average_rating,
        COUNT(*) as review_count
      FROM bookings 
      WHERE "barberId" = $1 AND "reviewRating" IS NOT NULL`,
      [id]
    );
    const averageRating = parseFloat(reviewStatsResult.rows[0]?.average_rating || '0');
    const reviewCount = parseInt(reviewStatsResult.rows[0]?.review_count || '0', 10);

    // Get barber's assigned service locations
    const locationsResult = await pool.query(
      `SELECT 
        sl.id,
        sl.name,
        sl.description,
        bsl.is_primary
      FROM barber_service_locations bsl
      JOIN service_locations sl ON bsl.location_id = sl.id
      WHERE bsl.barber_id = $1 AND sl.status = 'approved' AND sl.is_active = true
      ORDER BY bsl.is_primary DESC, sl.name ASC`,
      [id]
    );

    // Use barber.pricing (from barbers table JSONB) if available, otherwise fall back to barber_services table
    const customPricing = barber.pricing || [];
    const servicePricing = servicesResult.rows.map(s => ({
      ...s,
      price: s.price / 100 // Convert cents to dollars
    }));

    // Filter out services that have been deleted (is_active = false in services table)
    let filteredPricing = customPricing.length > 0 ? customPricing : servicePricing;
    const activeServicesResult = await pool.query(
      `SELECT LOWER(name) as name FROM services WHERE is_active = true`
    );
    const activeServiceNames = new Set(activeServicesResult.rows.map(s => s.name.toLowerCase()));
    
    if (filteredPricing.length > 0) {
      filteredPricing = filteredPricing.filter((p: any) => 
        activeServiceNames.has(p.name?.toLowerCase())
      );
    }
    
    // Also filter specialties to remove deleted services
    const filteredSpecialties = Array.isArray(barber.specialties) 
      ? barber.specialties.filter((s: string) => activeServiceNames.has(s?.toLowerCase()))
      : [];

    res.json({
      success: true,
      data: withHiddenFlags({
        ...barber,
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`,
        pricing: enrichPricingWithDurations(filteredPricing),
        specialties: filteredSpecialties,
        portfolio_images: portfolioResult.rows,
        reviews: reviewsResult.rows,
        service_locations: locationsResult.rows,
        average_rating: averageRating,
        review_count: reviewCount,
      }),
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
    const existing = await pool.query('SELECT id FROM barbers WHERE "userId" = $1', [userId]);
    
    if (existing.rows.length > 0) {
      throw new ApiError(400, 'Barber profile already exists');
    }

    // Get user details
    const userResult = await pool.query(
      `SELECT ${USER_PRIMARY_WALLET_SQL_U} AS primary_wallet, u.campus_id FROM users u WHERE u.id = $1`,
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
    const {
      bio,
      instagram_handle,
      display_name,
      specialties,
      yearsExperience,
      weekly_schedule: weeklyScheduleBody,
      weeklySchedule,
      is_active,
      is_hidden: isHiddenBody,
      isHidden,
      pricing,
      client_cancel_refund_hours: clientCancelRefundHoursBody,
      booking_slot_interval_minutes: bookingSlotIntervalMinutesBody,
      bookingSlotIntervalMinutes,
    } = req.body;
    const userId = req.user!.userId;
    // Marketplace visibility (do not overload isActive — that flag is for demotion)
    let is_hidden =
      isHiddenBody !== undefined
        ? isHiddenBody
        : isHidden !== undefined
          ? isHidden
          : undefined;
    // Legacy clients sent is_active for hide; map to is_hidden without flipping isActive
    if (is_hidden === undefined && is_active !== undefined) {
      is_hidden = !Boolean(is_active);
    }

    let client_cancel_refund_hours: number | undefined;
    if (clientCancelRefundHoursBody !== undefined) {
      const parsed = parseInt(String(clientCancelRefundHoursBody), 10);
      if (
        !CLIENT_CANCEL_REFUND_HOUR_PRESETS.includes(
          parsed as (typeof CLIENT_CANCEL_REFUND_HOUR_PRESETS)[number]
        )
      ) {
        throw new ApiError(
          400,
          `client_cancel_refund_hours must be one of: ${CLIENT_CANCEL_REFUND_HOUR_PRESETS.join(', ')}`
        );
      }
      client_cancel_refund_hours = parsed;
    }

    const bookingSlotIntervalRaw =
      bookingSlotIntervalMinutesBody !== undefined
        ? bookingSlotIntervalMinutesBody
        : bookingSlotIntervalMinutes;
    let booking_slot_interval_minutes: number | undefined;
    if (bookingSlotIntervalRaw !== undefined) {
      const parsed = parseInt(String(bookingSlotIntervalRaw), 10);
      if (
        !BOOKING_SLOT_INTERVAL_PRESETS.includes(
          parsed as (typeof BOOKING_SLOT_INTERVAL_PRESETS)[number]
        )
      ) {
        throw new ApiError(
          400,
          `booking_slot_interval_minutes must be one of: ${BOOKING_SLOT_INTERVAL_PRESETS.join(', ')}`
        );
      }
      booking_slot_interval_minutes = parsed;
    }

    // Verify ownership
    const ownership = await pool.query('SELECT id FROM barbers WHERE id = $1 AND "userId" = $2', [id, userId]);
    
    if (ownership.rows.length === 0) {
      throw new ApiError(403, 'Not authorized to update this profile');
    }

    // Restrict specialties/pricing to services for this provider's type (barber | beauty)
    let specialtiesInput = specialties;
    let pricingInput = pricing;
    if (specialties !== undefined || pricing !== undefined) {
      const providerTypeExpr = await barberProviderTypeExpr();
      const typeResult = await pool.query(
        `SELECT LOWER(${providerTypeExpr}) AS provider_type FROM barbers b WHERE b.id = $1`,
        [id]
      );
      const providerKind =
        String(typeResult.rows[0]?.provider_type || 'barber').toLowerCase() === 'beauty'
          ? 'beauty'
          : 'barber';

      const hasDurationCols = await serviceDurationColumnsExist();
      const hasProviderTypeCol = await serviceProviderTypeColumnExist();
      const catalogResult = await pool.query(
        `SELECT ${serviceSelectSql(hasDurationCols, hasProviderTypeCol)}
         FROM services
         WHERE is_active = true`
      );
      const allowedNames = new Set(
        catalogResult.rows
          .filter(
            (row: Record<string, unknown>) =>
              inferServiceProviderType(row.slug, row.name, row.provider_type) === providerKind
          )
          .map((row: Record<string, unknown>) => String(row.name).toLowerCase())
      );

      if (specialties !== undefined && Array.isArray(specialties)) {
        specialtiesInput = specialties.filter(
          (name: unknown) => allowedNames.has(String(name).toLowerCase())
        );
      }
      if (pricing !== undefined && Array.isArray(pricing)) {
        pricingInput = pricing.filter((entry: { name?: string }) =>
          allowedNames.has(String(entry?.name || '').toLowerCase())
        );
      }
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
    if (specialtiesInput !== undefined) {
      barberUpdateFields.push(`specialties = $${paramIndex}`);
      barberValues.push(specialtiesInput);
      paramIndex++;
    }
    if (yearsExperience !== undefined) {
      barberUpdateFields.push(`"yearsExperience" = $${paramIndex}`);
      barberValues.push(yearsExperience);
      paramIndex++;
    }
    const incomingSchedule =
      weeklyScheduleBody !== undefined ? weeklyScheduleBody : weeklySchedule;
    let weekly_schedule = incomingSchedule;
    if (weekly_schedule !== undefined) {
      const otherProfileFields =
        bio !== undefined ||
        specialtiesInput !== undefined ||
        yearsExperience !== undefined ||
        is_hidden !== undefined ||
        pricingInput !== undefined ||
        display_name !== undefined ||
        instagram_handle !== undefined ||
        client_cancel_refund_hours !== undefined ||
        booking_slot_interval_minutes !== undefined;
      if (
        otherProfileFields &&
        !weeklyScheduleHasOpenHours(weekly_schedule)
      ) {
        const existingHours = await pool.query(
          `SELECT "weeklySchedule" AS weekly_schedule FROM barbers WHERE id = $1`,
          [id]
        );
        if (weeklyScheduleHasOpenHours(existingHours.rows[0]?.weekly_schedule)) {
          logger.warn(
            'Ignoring blank weekly_schedule on bundled profile update so availability is not wiped',
            { barberId: id, userId }
          );
          weekly_schedule = undefined;
        }
      }
    }
    if (weekly_schedule !== undefined) {
      barberUpdateFields.push(`"weeklySchedule" = $${paramIndex}`);
      barberValues.push(JSON.stringify(weekly_schedule));
      paramIndex++;
    }
    if (is_hidden !== undefined) {
      barberUpdateFields.push(`is_hidden = $${paramIndex}`);
      barberValues.push(Boolean(is_hidden));
      paramIndex++;
    }
    if (client_cancel_refund_hours !== undefined) {
      barberUpdateFields.push(`client_cancel_refund_hours = $${paramIndex}`);
      barberValues.push(client_cancel_refund_hours);
      paramIndex++;
    }
    if (booking_slot_interval_minutes !== undefined) {
      barberUpdateFields.push(`booking_slot_interval_minutes = $${paramIndex}`);
      barberValues.push(booking_slot_interval_minutes);
      paramIndex++;
    }

    let normalizedPricing: ReturnType<typeof normalizePricingEntries> | undefined;
    if (pricingInput !== undefined) {
      try {
        normalizedPricing = normalizePricingEntries(pricingInput);
        barberUpdateFields.push(`pricing = $${paramIndex}`);
        barberValues.push(JSON.stringify(normalizedPricing));
      } catch (pricingError: any) {
        throw new ApiError(400, pricingError.message || 'Invalid pricing data');
      }
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

      if (normalizedPricing) {
        for (const entry of normalizedPricing) {
          await pool.query(
            `UPDATE bookings b
             SET "durationMinutes" = $1, "updatedAt" = NOW()
             FROM conversations c
             WHERE c.booking_id = b.id
               AND b."barberId" = $2
               AND b.status = 'PENDING'
               AND LOWER(COALESCE(c.service_name, '')) = LOWER($3)`,
            [entry.duration_minutes, id, entry.name]
          );
        }
      }
      
      // Emit WebSocket event if weekly_schedule was updated
      if (weekly_schedule !== undefined) {
        try {
          const io = getSocketIO();
          if (io) {
            io.to(`user-${userId}`).emit('availability-update', {
              barberId: id
            });
            logger.info(`Emitted availability-update to user-${userId} from updateBarberProfile`);
          }
        } catch (wsError: any) {
          logger.error(`Error emitting availability-update: ${wsError.message}`);
        }
      }
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
        b.pricing,
        b."avgRating" as average_rating,
        b."totalReviews" as total_reviews,
        b."totalBookings" as total_bookings,
        b."isActive" as is_active,
        b.is_hidden,
        b.client_cancel_refund_hours,
        b.booking_slot_interval_minutes,
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
    const savedPricing = Array.isArray(barber.pricing) ? barber.pricing : [];

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.json({
      success: true,
      data: withHiddenFlags({
        ...barber,
        pricing: enrichPricingWithDurations(savedPricing),
        name: barber.display_name || `${barber.first_name} ${barber.last_name}`.trim(),
      }),
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

    // Emit WebSocket event for real-time updates
    try {
      const io = getSocketIO();
      if (io) {
        io.to(`user-${userId}`).emit('availability-update', {
          barberId: id
        });
        logger.info(`Emitted availability-update to user-${userId}`);
      }
    } catch (wsError: any) {
      logger.error(`Error emitting availability-update: ${wsError.message}`);
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
    const { date, excludeBookingId, durationMinutes: durationMinutesRaw } = req.query;
    const appointmentDurationMinutes = Math.max(
      15,
      Math.min(240, parseInt(String(durationMinutesRaw || '60'), 10) || 60)
    );

    // Get barber's weekly schedule and campus timezone
    const barberResult = await pool.query(
      `SELECT b."weeklySchedule" as weekly_schedule,
              b.booking_slot_interval_minutes,
              COALESCE(c.timezone, 'America/Los_Angeles') as campus_timezone,
              u."isBanned" as user_is_banned,
              u.id as barber_user_id
       FROM barbers b
       LEFT JOIN users u ON b."userId" = u.id
       LEFT JOIN campuses c ON u."campusId" = c.id
       WHERE b.id = $1`,
      [id]
    );

    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    if (barberResult.rows[0].user_is_banned === true) {
      throw new ApiError(404, 'Barber not found');
    }

    const viewerAvail = req.user?.userId;
    if (viewerAvail && barberResult.rows[0].barber_user_id) {
      await assertNoMessagingBlockBetween(String(viewerAvail), String(barberResult.rows[0].barber_user_id));
    }

    const weeklySchedule: WeeklySchedule = barberResult.rows[0].weekly_schedule || {};
    const campusTimezone: string = barberResult.rows[0].campus_timezone;
    const slotIncrementMinutes = resolveBookingSlotIntervalMinutes(
      barberResult.rows[0].booking_slot_interval_minutes
    );
    
    // If a specific date is provided, return available slots for that date
    if (date && typeof date === 'string') {
      const dayName = getDayNameFromDateString(date);
      
      console.log(`[Availability] Date: ${date}, Parsed day: ${dayName}, weeklySchedule keys:`, Object.keys(weeklySchedule));
      
      const daySchedule = weeklySchedule[dayName];
      
      console.log(`[Availability] Day schedule for ${dayName}:`, JSON.stringify(daySchedule));
      
      if (!daySchedule || !daySchedule.enabled) {
        console.log(`[Availability] Day ${dayName} is not available - enabled: ${daySchedule?.enabled}`);
        // Prevent caching
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.json({
          success: true,
          data: {
            date,
            dayOfWeek: dayName,
            available: false,
            intervals: [],
            slots: [],
            appointmentDurationMinutes,
          }
        });
      }

      const intervals = getIntervalsForDay(weeklySchedule, dayName);

      // If no intervals defined, day is effectively unavailable
      if (intervals.length === 0) {
        console.log(`[Availability] No intervals for ${dayName}, returning unavailable`);
        // Prevent caching
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.json({
          success: true,
          data: {
            date,
            dayOfWeek: dayName,
            available: false,
            intervals: [],
            slots: []
          }
        });
      }

      // Get booked slots for this date
      // Convert UTC stored times to Pacific time for proper comparison
      // Each appointment blocks 1 hour (60 minutes) from start time
      const bookingsParams: string[] = [id, date as string];
      let excludeBookingClause = '';
      if (excludeBookingId && typeof excludeBookingId === 'string') {
        excludeBookingClause = ' AND id != $3';
        bookingsParams.push(excludeBookingId);
      }

      const bookingsResult = await pool.query(
        `SELECT 
          TO_CHAR("requestedAt" AT TIME ZONE 'America/Los_Angeles', 'HH24:MI') as start_time,
          TO_CHAR("requestedAt" AT TIME ZONE 'America/Los_Angeles' + (COALESCE("durationMinutes", 60) * INTERVAL '1 minute'), 'HH24:MI') as end_time
        FROM bookings 
        WHERE "barberId" = $1 
          AND DATE("requestedAt" AT TIME ZONE 'America/Los_Angeles') = $2
          AND ${bookingStatusBlocksScheduleSql('status')}${excludeBookingClause}
        ORDER BY "requestedAt"`,
        bookingsParams
      );

      // Get time blocks for this specific date (one-time blocks that don't affect weekly schedule)
      const timeBlocksResult = await pool.query(
        `SELECT 
          TO_CHAR(start_time, 'HH24:MI') as start_time,
          TO_CHAR(end_time, 'HH24:MI') as end_time
        FROM barber_time_blocks 
        WHERE barber_id = $1 
          AND block_date = $2
        ORDER BY start_time`,
        [id, date]
      );

      // Google Calendar integration disabled
      // const googleCalendarSlots: Array<{ start: string; end: string }> = [];
      // try {
      //   const googleCalendarService = require('../services/google-calendar.service');
      //   const isConnected = await googleCalendarService.isCalendarConnected(id);
      //   ...
      // } catch (error) {
      //   console.log('[Availability] Google Calendar check failed, continuing without:', error);
      // }

      // Combine booked slots with time blocks (Google Calendar busy times disabled)
      const bookedSlots = [
        ...bookingsResult.rows.map(row => ({
          start: row.start_time,
          end: row.end_time
        })),
        ...timeBlocksResult.rows.map(row => ({
          start: row.start_time,
          end: row.end_time
        })),
        // ...googleCalendarSlots
      ];

      console.log(`[Availability] Found ${bookingsResult.rows.length} booked, ${timeBlocksResult.rows.length} time blocks for ${date}:`, bookedSlots);

      // Check if the selected date is today (to filter out past times)
      // Use the campus timezone for accurate local time
      const campusTime = new Date().toLocaleString('en-US', { timeZone: campusTimezone });
      const campusNow = new Date(campusTime);
      const todayStr = `${campusNow.getFullYear()}-${String(campusNow.getMonth() + 1).padStart(2, '0')}-${String(campusNow.getDate()).padStart(2, '0')}`;
      const isToday = date === todayStr;
      
      // Get current time in campus timezone for filtering past slots
      const currentHour = campusNow.getHours();
      const currentMinute = campusNow.getMinutes();
      const currentTimeMinutes = isToday ? (currentHour * 60 + currentMinute + SAME_DAY_BOOKING_BUFFER_MINUTES) : 0;

      const slots = generateBookableStartSlots(
        intervals,
        bookedSlots,
        appointmentDurationMinutes,
        slotIncrementMinutes,
        currentTimeMinutes
      );
      
      console.log(`[Availability] Generated ${slots.length} bookable slots for ${appointmentDurationMinutes} min appointments (${slotIncrementMinutes} min interval)`);

      // Prevent caching of availability data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.json({
        success: true,
        data: {
          date,
          dayOfWeek: dayName,
          available: true,
          intervals,
          bookedSlots,
          slots,
          appointmentDurationMinutes,
          bookingSlotIntervalMinutes: slotIncrementMinutes,
          booking_slot_interval_minutes: slotIncrementMinutes,
        }
      });
    }

    // Return the full weekly schedule
    // Also get legacy availability_templates for backwards compatibility
    const templatesResult = await pool.query(
      'SELECT * FROM availability_templates WHERE barber_id = $1 AND is_active = TRUE ORDER BY day_of_week, start_time',
      [id]
    );

    // Prevent caching of weekly availability data to ensure fresh data on login
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      data: {
        weeklySchedule,
        bookingSlotIntervalMinutes: slotIncrementMinutes,
        booking_slot_interval_minutes: slotIncrementMinutes,
        legacyTemplates: templatesResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getBarberEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const ownership = await pool.query('SELECT "userId" as user_id FROM barbers WHERE id = $1', [id]);
    
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

    const ownership = await pool.query('SELECT "userId" as user_id FROM barbers WHERE id = $1', [id]);
    
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

/**
 * Remove barber (demote to consumer) - Admin only
 * This doesn't delete the user, just changes their role from 'barber' to 'consumer'
 */
export const removeBarber = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // barber ID
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Get the barber's details including their campus
    const barberResult = await pool.query(
      `SELECT b.id, b."userId", u."campusId", u.email, u.first_name, u.last_name
       FROM barbers b
       JOIN users u ON b."userId" = u.id
       WHERE b.id = $1`,
      [id]
    );

    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    const barber = barberResult.rows[0];
    const barberCampusId = barber.campusId;
    const barberUserId = barber.userId;

    // Check if requester is admin (from database)
    const adminCheck = await pool.query(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    );
    const isAdmin = adminCheck.rows[0]?.role === 'ADMIN';

    if (!isAdmin) {
      throw new ApiError(403, 'Not authorized to remove barbers from this campus');
    }

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update user role from 'BARBER' to 'CONSUMER' (database uses uppercase enum values)
      await client.query(
        `UPDATE users SET role = 'CONSUMER', "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
        [barberUserId]
      );

      // Deactivate the barber profile (keep it for records, but mark inactive)
      try {
        await client.query(
          `UPDATE barbers
           SET "isActive" = false,
               reapply_allowed_at = NULL,
               "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [id]
        );
      } catch (deactivateErr: any) {
        if (deactivateErr?.code !== '42703') throw deactivateErr;
        await client.query(
          `UPDATE barbers SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
          [id]
        );
      }

      // Delete CM-barber direct conversations (conversations without a booking_id)
      // First delete messages, then the conversations
      await client.query(
        `DELETE FROM messages 
         WHERE conversation_id IN (
           SELECT id FROM conversations 
           WHERE booking_id IS NULL 
             AND (user1_id = $1 OR user2_id = $1)
         )`,
        [barberUserId]
      );
      
      await client.query(
        `DELETE FROM conversations 
         WHERE booking_id IS NULL 
           AND (user1_id = $1 OR user2_id = $1)`,
        [barberUserId]
      );

      await client.query('COMMIT');

      logger.info(`Barber ${id} (user ${barberUserId}) demoted to consumer by ${userId}`);

      res.json({
        success: true,
        message: `Barber ${barber.first_name} ${barber.last_name} has been removed and demoted to consumer`,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

// =====================================================
// TIME BLOCKS - One-time date-specific availability blocks
// =====================================================

/**
 * Get barber's time blocks (optionally filtered by date range)
 */
export const getTimeBlocks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const userId = req.user!.userId;

    // Verify the user owns this barber profile
    const barberResult = await pool.query(
      'SELECT "userId" FROM barbers WHERE id = $1',
      [id]
    );

    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    if (barberResult.rows[0].userId !== userId) {
      throw new ApiError(403, 'Not authorized to view this barber\'s time blocks');
    }

    // Build query with optional date filters
    // Use TO_CHAR to ensure consistent date/time string formats
    let query = `
      SELECT id, 
        TO_CHAR(block_date, 'YYYY-MM-DD') as block_date, 
        TO_CHAR(start_time, 'HH24:MI') as start_time, 
        TO_CHAR(end_time, 'HH24:MI') as end_time, 
        reason, 
        created_at
      FROM barber_time_blocks
      WHERE barber_id = $1
    `;
    const params: any[] = [id];

    // Filter to only future blocks by default, or use provided date range
    if (startDate) {
      params.push(startDate);
      query += ` AND block_date >= $${params.length}`;
    } else {
      // Default: only show today and future blocks
      query += ` AND block_date >= CURRENT_DATE`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND block_date <= $${params.length}`;
    }

    query += ` ORDER BY block_date, start_time`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        blockDate: row.block_date,
        startTime: row.start_time,
        endTime: row.end_time,
        reason: row.reason,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new time block for a specific date
 */
export const createTimeBlock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { blockDate, startTime, endTime, reason } = req.body;
    const userId = req.user!.userId;

    // Verify the user owns this barber profile
    const barberResult = await pool.query(
      'SELECT "userId" FROM barbers WHERE id = $1',
      [id]
    );

    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    if (barberResult.rows[0].userId !== userId) {
      throw new ApiError(403, 'Not authorized to create time blocks for this barber');
    }

    // Validate that blockDate is not in the past
    // Compare date strings directly to avoid timezone issues
    // blockDate is in YYYY-MM-DD format from frontend
    const todayUTC = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
    
    // Allow today and future dates (blockDate >= todayUTC would be too strict for timezone differences)
    // Instead, allow dates from yesterday UTC onwards to account for timezone differences
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayUTC = yesterdayDate.toISOString().split('T')[0];
    
    if (blockDate < yesterdayUTC) {
      throw new ApiError(400, 'Cannot create time blocks for past dates');
    }

    // Validate end time is after start time
    if (startTime >= endTime) {
      throw new ApiError(400, 'End time must be after start time');
    }

    // Check for overlapping blocks on the same date
    const overlapResult = await pool.query(
      `SELECT id FROM barber_time_blocks
       WHERE barber_id = $1 
         AND block_date = $2
         AND (
           (start_time < $4 AND end_time > $3) -- Overlaps
         )`,
      [id, blockDate, startTime, endTime]
    );

    if (overlapResult.rows.length > 0) {
      throw new ApiError(400, 'This time block overlaps with an existing block');
    }

    // Insert the new time block
    const insertResult = await pool.query(
      `INSERT INTO barber_time_blocks (barber_id, block_date, start_time, end_time, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, 
         TO_CHAR(block_date, 'YYYY-MM-DD') as block_date, 
         TO_CHAR(start_time, 'HH24:MI') as start_time, 
         TO_CHAR(end_time, 'HH24:MI') as end_time, 
         reason, 
         created_at`,
      [id, blockDate, startTime, endTime, reason || null]
    );

    const newBlock = insertResult.rows[0];

    logger.info(`Barber ${id} created time block on ${blockDate} from ${startTime} to ${endTime}`);

    // Emit WebSocket event for real-time updates
    try {
      const io = getSocketIO();
      if (io) {
        io.to(`user-${userId}`).emit('time-block-update', {
          barberId: id,
          action: 'created',
          timeBlock: {
            id: newBlock.id,
            blockDate: newBlock.block_date,
            startTime: newBlock.start_time,
            endTime: newBlock.end_time
          }
        });
        logger.info(`Emitted time-block-update (created) to user-${userId}`);
      }
    } catch (wsError: any) {
      logger.error(`Error emitting time-block-update: ${wsError.message}`);
    }

    res.status(201).json({
      success: true,
      data: {
        id: newBlock.id,
        blockDate: newBlock.block_date,
        startTime: newBlock.start_time,
        endTime: newBlock.end_time,
        reason: newBlock.reason,
        createdAt: newBlock.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a time block
 */
export const deleteTimeBlock = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, blockId } = req.params;
    const userId = req.user!.userId;

    // Verify the user owns this barber profile
    const barberResult = await pool.query(
      'SELECT "userId" FROM barbers WHERE id = $1',
      [id]
    );

    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber not found');
    }

    if (barberResult.rows[0].userId !== userId) {
      throw new ApiError(403, 'Not authorized to delete time blocks for this barber');
    }

    // Delete the time block
    const deleteResult = await pool.query(
      'DELETE FROM barber_time_blocks WHERE id = $1 AND barber_id = $2 RETURNING id',
      [blockId, id]
    );

    if (deleteResult.rows.length === 0) {
      throw new ApiError(404, 'Time block not found');
    }

    logger.info(`Barber ${id} deleted time block ${blockId}`);

    // Emit WebSocket event for real-time updates
    try {
      const io = getSocketIO();
      if (io) {
        io.to(`user-${userId}`).emit('time-block-update', {
          barberId: id,
          action: 'deleted',
          blockId: blockId
        });
        logger.info(`Emitted time-block-update (deleted) to user-${userId}`);
      }
    } catch (wsError: any) {
      logger.error(`Error emitting time-block-update: ${wsError.message}`);
    }

    res.json({
      success: true,
      message: 'Time block deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

