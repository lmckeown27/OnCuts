/**
 * Admin Controller
 * 
 * Admin-only operations:
 * - Platform fee withdrawal
 * - Reconciliation reports
 * - User balance management
 * - Batch monitoring
 * - Audit log access
 */

import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Development mode check
const isDevelopment = process.env.NODE_ENV === 'development';
import paymentServiceV2 from '../services/payment-v2.service';
import reconciliationService from '../services/reconciliation.service';
import withdrawalBatchService from '../services/withdrawal-batch.service';
import auditService from '../services/audit.service';
import transactionService from '../services/transaction.service';
import { logger } from '../utils/logger';
import {
  getPlatformFeePercent,
  setPlatformFeePercent,
} from '../utils/platform-commission';
import { applyAffiliationCleanupForBannedUser } from '../services/user-ban-affiliation.service';
import {
  assertCampusMetricsAccess,
  countCampusConsumers,
  getAccessibleCampusScope,
} from '../services/campus-metrics-access.service';
import {
  serviceDurationColumnsExist,
  serviceProviderTypeColumnExist,
  serviceSelectSql,
  inferServiceProviderType,
  DEFAULT_MIN_DURATION_MINUTES,
  DEFAULT_MAX_DURATION_MINUTES,
} from '../services/service-schema.service';
import {
  barberIdsNearCampusSubquery,
  barberNearCampusByPinSql,
  servicePinDistanceToCampusSql,
} from '../utils/admin-campus-proximity';
import { coarsenPublicLocationLabel } from '../services/geocode.service';

/**
 * Withdraw platform fees
 * POST /api/admin/fees/withdraw
 */
export const withdrawPlatformFees = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.userId;
    const { amountCents, destinationType, destinationId } = req.body;

    // Verify admin role
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    // 1. Get total available fees
    const feesResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM platform_fees
       WHERE NOT withdrawn`
    );

    const totalFees = parseInt(feesResult.rows[0].total);

    if (amountCents > totalFees) {
      throw new ApiError(400, `Insufficient fees. Requested: $${amountCents / 100}, Available: $${totalFees / 100}`);
    }

    // 2. Mark fees as withdrawn (up to the amount)
    const withdrawnFees = await pool.query(
      `UPDATE platform_fees
       SET withdrawn = true,
           withdrawal_date = NOW(),
           withdrawal_tx_hash = $1
       WHERE id IN (
         SELECT id FROM platform_fees
         WHERE NOT withdrawn
         ORDER BY collected_at ASC
         LIMIT (
           SELECT COUNT(*)
           FROM platform_fees
           WHERE NOT withdrawn
           AND (SELECT SUM(amount) FROM platform_fees WHERE NOT withdrawn ORDER BY collected_at ASC) >= $2
         )
       )
       RETURNING *`,
      [`ADMIN_WITHDRAWAL_${Date.now()}`, amountCents]
    );

    // 3. Create withdrawal transaction
    // Note: This would trigger actual bank/on-chain withdrawal
    // For now, just log it

    // 4. Audit log
    await auditService.log({
      actor_user_id: adminId,
      action: 'platform_fees_withdrawn',
      object_type: 'platform_fees',
      object_id: 'bulk_withdrawal',
      details: {
        amount_cents: amountCents,
        fee_count: withdrawnFees.rows.length,
        destination_type: destinationType,
        destination_id: destinationId,
      },
    });

    logger.info('Platform fees withdrawn', {
      admin_id: adminId,
      amount_dollars: amountCents / 100,
      fee_count: withdrawnFees.rows.length,
    });

    res.json({
      success: true,
      data: {
        amount_withdrawn_dollars: amountCents / 100,
        fees_withdrawn_count: withdrawnFees.rows.length,
        remaining_fees_dollars: (totalFees - amountCents) / 100,
      },
      message: 'Platform fees withdrawn successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get platform fees summary
 * GET /api/admin/fees
 */
export const getPlatformFees = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    // Development mode: Return mock data
    if (isDevelopment) {
      return res.json({
        success: true,
        data: {
          available_fees_dollars: 87.50,
          withdrawn_fees_dollars: 312.75,
          available_count: 35,
          withdrawn_count: 125,
        },
      });
    }

    const result = await pool.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE NOT withdrawn), 0) as available_fees_cents,
        COALESCE(SUM(amount) FILTER (WHERE withdrawn), 0) as withdrawn_fees_cents,
        COUNT(*) FILTER (WHERE NOT withdrawn) as available_count,
        COUNT(*) FILTER (WHERE withdrawn) as withdrawn_count
      FROM platform_fees
    `);

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        available_fees_dollars: parseInt(stats.available_fees_cents) / 100,
        withdrawn_fees_dollars: parseInt(stats.withdrawn_fees_cents) / 100,
        available_count: parseInt(stats.available_count),
        withdrawn_count: parseInt(stats.withdrawn_count),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/platform-settings
 * Global platform commission percent (Admin-editable).
 */
export const getPlatformSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    const platformFeePercent = await getPlatformFeePercent();
    res.json({
      success: true,
      data: { platformFeePercent },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/platform-settings
 * Body: { platformFeePercent: number } — 0–100, one decimal place.
 */
export const updatePlatformSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    const raw = req.body?.platformFeePercent;
    if (!Object.prototype.hasOwnProperty.call(req.body ?? {}, 'platformFeePercent')) {
      throw new ApiError(400, 'platformFeePercent is required');
    }

    const percent = typeof raw === 'number' ? raw : parseFloat(String(raw));
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new ApiError(400, 'platformFeePercent must be a number between 0 and 100');
    }

    const platformFeePercent = await setPlatformFeePercent(percent, req.user!.userId);
    logger.info('admin_update_platform_settings', {
      adminId: req.user!.userId,
      platformFeePercent,
    });

    res.json({
      success: true,
      data: { platformFeePercent },
      message: 'Platform commission updated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Run reconciliation
 * POST /api/admin/reconciliation/run
 */
export const runReconciliation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    const { date } = req.body;
    const targetDate = date ? new Date(date) : new Date();

    const report = await reconciliationService.runDailyReconciliation(targetDate);

    res.json({
      success: true,
      data: report,
      message: report.status === 'completed' 
        ? 'Reconciliation completed successfully - no discrepancies'
        : 'Reconciliation completed with discrepancies - review required',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get reconciliation reports
 * GET /api/admin/reconciliation/reports
 */
export const getReconciliationReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    // Development mode: Return mock data
    if (isDevelopment) {
      return res.json({
        success: true,
        data: [
          {
            id: 1,
            date: new Date(Date.now() - 86400000).toISOString(),
            status: 'completed',
            total_discrepancy_dollars: 0,
            discrepancy_count: 0,
          },
          {
            id: 2,
            date: new Date(Date.now() - 172800000).toISOString(),
            status: 'discrepancies',
            total_discrepancy_dollars: 5.25,
            discrepancy_count: 2,
          },
        ],
      });
    }

    const limit = parseInt(req.query.limit as string) || 30;
    const reports = await reconciliationService.getRecentReports(limit);

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get withdrawal batch stats
 * GET /api/admin/withdrawals/batches
 */
export const getWithdrawalBatches = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    // Development mode: Return mock data
    if (isDevelopment) {
      return res.json({
        success: true,
        data: {
          queued_count: 12,
          queued_total_dollars: 456.75,
          processing_count: 1,
          completed_today: 5,
        },
      });
    }

    const stats = await withdrawalBatchService.getStats();

    res.json({
      success: true,
      data: {
        queued_count: stats.queued_count,
        queued_total_dollars: stats.queued_total_cents / 100,
        processing_count: stats.processing_count,
        completed_today: stats.completed_today,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually trigger batch processing
 * POST /api/admin/withdrawals/process-batch
 */
export const processBatch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    res.status(501).json({
      success: false,
      message: 'On-chain batch withdrawals are disabled. Platform uses Stripe Connect only.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user balance (admin)
 * GET /api/admin/users/:userId/balance
 */
export const getUserBalance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    const { userId } = req.params;

    const balance = await transactionService.getUserBalance(userId);

    res.json({
      success: true,
      data: {
        user_id: userId,
        available_dollars: balance.available_amount / 100,
        pending_dollars: balance.pending_amount / 100,
        total_dollars: balance.total_balance / 100,
        available_cents: balance.available_amount,
        pending_cents: balance.pending_amount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Issue promotional credit
 * POST /api/admin/users/:userId/credit
 */
export const issueCredit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    const adminId = req.user!.userId;
    const { userId } = req.params;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Invalid amount');
    }

    const amountCents = Math.round(amount * 100);

    await paymentServiceV2.issuePromotionalCredit({
      userId,
      amountCents,
      description,
      adminId,
    });

    res.json({
      success: true,
      message: 'Promotional credit issued successfully',
      data: {
        user_id: userId,
        amount_dollars: amount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs
 * GET /api/admin/audit-logs
 */
export const getAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    // Development mode: Return mock data
    if (isDevelopment) {
      return res.json({
        success: true,
        data: {
          logs: [
            {
              id: 1,
              action: 'escrow_released',
              actor_user_id: 'user-123',
              object_type: 'booking',
              object_id: 'booking-456',
              created_at: new Date().toISOString(),
              details: { amount: 3000, barber_id: 'barber-789' },
            },
            {
              id: 2,
              action: 'withdrawal_queued',
              actor_user_id: 'user-456',
              object_type: 'withdrawal',
              object_id: 'withdrawal-789',
              created_at: new Date(Date.now() - 300000).toISOString(),
              details: { amount: 5000, type: 'onchain' },
            },
          ],
          total: 2,
        },
      });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await auditService.getRecentLogs(limit, offset);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get platform treasury stats
 * GET /api/admin/treasury
 */
export const getTreasuryStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    // Development mode: Return mock data
    if (isDevelopment) {
      return res.json({
        success: true,
        data: {
          total_user_balances_dollars: 1250.00,
          total_escrow_dollars: 450.00,
          total_fees_dollars: 87.50,
        },
      });
    }

    const result = await pool.query(`
      SELECT * FROM platform_treasury
    `);

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        total_user_balances_dollars: (stats.total_user_balances_cents || 0) / 100,
        total_escrow_dollars: (stats.total_escrow_cents || 0) / 100,
        total_fees_dollars: (stats.total_fees_cents || 0) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════════
// SERVICES MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function mapServiceRow(row: Record<string, unknown>) {
  const providerType = inferServiceProviderType(row.slug, row.name, row.provider_type);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    basePriceCents: row.default_base_price_cents,
    minPriceCents: row.default_min_price_cents,
    maxPriceCents: row.default_max_price_cents,
    minDurationMinutes: row.default_min_duration_minutes ?? DEFAULT_MIN_DURATION_MINUTES,
    maxDurationMinutes: row.default_max_duration_minutes ?? DEFAULT_MAX_DURATION_MINUTES,
    providerType,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeServiceProviderType(raw: unknown): 'barber' | 'beauty' {
  const value = String(raw ?? 'barber').trim().toLowerCase();
  if (value === 'beauty') return 'beauty';
  if (value === 'barber' || value === '') return 'barber';
  throw new ApiError(400, 'providerType must be "barber" or "beauty"');
}

function validateServiceBounds(params: {
  basePriceCents: number;
  minPriceCents: number;
  maxPriceCents: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
}) {
  const { basePriceCents, minPriceCents, maxPriceCents, minDurationMinutes, maxDurationMinutes } = params;

  if (minPriceCents > basePriceCents || basePriceCents > maxPriceCents) {
    throw new ApiError(400, 'Invalid price bounds: min <= base <= max');
  }
  if (minDurationMinutes > maxDurationMinutes) {
    throw new ApiError(400, 'Invalid duration bounds: min <= max');
  }
  if (minDurationMinutes < 1 || maxDurationMinutes > 480) {
    throw new ApiError(400, 'Duration bounds must be between 1 and 480 minutes');
  }
}

/**
 * Get all services
 * GET /api/admin/services
 */
export const getServices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const hasDurationColumns = await serviceDurationColumnsExist();
    const hasProviderTypeColumn = await serviceProviderTypeColumnExist();

    // Any authenticated user can read active services
    // Only admins can see inactive services
    const userRole = req.user!.role?.toUpperCase();
    const isAdmin = userRole === 'ADMIN';
    
    // Only allow includeInactive for admins
    const includeInactive = isAdmin && req.query.includeInactive === 'true';
    const providerTypeFilterRaw = req.query.providerType;
    const providerTypeFilter =
      typeof providerTypeFilterRaw === 'string' && providerTypeFilterRaw.trim()
        ? normalizeServiceProviderType(providerTypeFilterRaw)
        : null;
    
    let query = `
      SELECT ${serviceSelectSql(hasDurationColumns, hasProviderTypeColumn)}
      FROM services
    `;
    
    if (!includeInactive) {
      query += ' WHERE is_active = true';
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query);
    let data = result.rows.map((row) => mapServiceRow(row));

    // Filter after map so name/slug inference tags Beauty even if DB defaulted to barber
    if (providerTypeFilter) {
      data = data.filter((s) => s.providerType === providerTypeFilter);
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new service
 * POST /api/admin/services
 */
export const createService = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const hasDurationColumns = await serviceDurationColumnsExist();
    const hasProviderTypeColumn = await serviceProviderTypeColumnExist();

    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    const {
      name,
      description,
      basePriceCents,
      minPriceCents,
      maxPriceCents,
      minDurationMinutes,
      maxDurationMinutes,
      providerType,
    } = req.body;

    if (!name || !basePriceCents) {
      throw new ApiError(400, 'Name and base price are required');
    }

    const providerTypeValue = normalizeServiceProviderType(providerType);

    // Generate slug from name
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const baseCents = parseInt(basePriceCents);
    const minCents = minPriceCents ? parseInt(minPriceCents) : Math.round(baseCents * 0.8);
    const maxCents = maxPriceCents ? parseInt(maxPriceCents) : Math.round(baseCents * 1.5);
    const minDuration = minDurationMinutes ? parseInt(minDurationMinutes) : DEFAULT_MIN_DURATION_MINUTES;
    const maxDuration = maxDurationMinutes ? parseInt(maxDurationMinutes) : DEFAULT_MAX_DURATION_MINUTES;

    validateServiceBounds({
      basePriceCents: baseCents,
      minPriceCents: minCents,
      maxPriceCents: maxCents,
      minDurationMinutes: minDuration,
      maxDurationMinutes: maxDuration,
    });

    let result;
    if (hasDurationColumns && hasProviderTypeColumn) {
      result = await pool.query(
        `INSERT INTO services (
           slug, name, description,
           default_base_price_cents, default_min_price_cents, default_max_price_cents,
           default_min_duration_minutes, default_max_duration_minutes,
           provider_type
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [slug, name, description || null, baseCents, minCents, maxCents, minDuration, maxDuration, providerTypeValue]
      );
    } else if (hasDurationColumns) {
      result = await pool.query(
        `INSERT INTO services (
           slug, name, description,
           default_base_price_cents, default_min_price_cents, default_max_price_cents,
           default_min_duration_minutes, default_max_duration_minutes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [slug, name, description || null, baseCents, minCents, maxCents, minDuration, maxDuration]
      );
    } else if (hasProviderTypeColumn) {
      result = await pool.query(
        `INSERT INTO services (
           slug, name, description,
           default_base_price_cents, default_min_price_cents, default_max_price_cents,
           provider_type
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [slug, name, description || null, baseCents, minCents, maxCents, providerTypeValue]
      );
    } else {
      result = await pool.query(
        `INSERT INTO services (slug, name, description, default_base_price_cents, default_min_price_cents, default_max_price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [slug, name, description || null, baseCents, minCents, maxCents]
      );
    }

    const row = result.rows[0];

    // Audit log
    await auditService.log({
      actor_user_id: req.user!.userId,
      action: 'service_created',
      object_type: 'service',
      object_id: row.id.toString(),
      details: { name, slug, basePriceCents: baseCents, providerType: providerTypeValue },
    });

    logger.info('Service created', { id: row.id, name, slug, providerType: providerTypeValue, by: req.user!.userId });

    res.status(201).json({
      success: true,
      data: mapServiceRow(row),
      message: 'Service created successfully',
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      return next(new ApiError(400, 'A service with this name already exists'));
    }
    next(error);
  }
};

/**
 * Update a service
 * PUT /api/admin/services/:id
 */
export const updateService = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const hasDurationColumns = await serviceDurationColumnsExist();
    const hasProviderTypeColumn = await serviceProviderTypeColumnExist();

    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    const { id } = req.params;
    const {
      name,
      description,
      basePriceCents,
      minPriceCents,
      maxPriceCents,
      minDurationMinutes,
      maxDurationMinutes,
      providerType,
      isActive,
    } = req.body;

    const existingResult = await pool.query(`SELECT * FROM services WHERE id = $1`, [id]);
    if (existingResult.rows.length === 0) {
      throw new ApiError(404, 'Service not found');
    }
    const existing = existingResult.rows[0];

    const nextBase = basePriceCents !== undefined ? parseInt(basePriceCents) : existing.default_base_price_cents;
    const nextMinPrice = minPriceCents !== undefined ? parseInt(minPriceCents) : existing.default_min_price_cents;
    const nextMaxPrice = maxPriceCents !== undefined ? parseInt(maxPriceCents) : existing.default_max_price_cents;
    const nextMinDuration =
      minDurationMinutes !== undefined
        ? parseInt(minDurationMinutes)
        : existing.default_min_duration_minutes ?? DEFAULT_MIN_DURATION_MINUTES;
    const nextMaxDuration =
      maxDurationMinutes !== undefined
        ? parseInt(maxDurationMinutes)
        : existing.default_max_duration_minutes ?? DEFAULT_MAX_DURATION_MINUTES;

    validateServiceBounds({
      basePriceCents: nextBase,
      minPriceCents: nextMinPrice,
      maxPriceCents: nextMaxPrice,
      minDurationMinutes: nextMinDuration,
      maxDurationMinutes: nextMaxDuration,
    });

    if ((minDurationMinutes !== undefined || maxDurationMinutes !== undefined) && !hasDurationColumns) {
      throw new ApiError(
        503,
        'Duration bounds are not available until migration 033 is applied as the services table owner (postgres superuser)'
      );
    }

    if (providerType !== undefined && !hasProviderTypeColumn) {
      throw new ApiError(
        503,
        'providerType is not available until migration 047_services_provider_type.sql is applied'
      );
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
      // Also update slug
      const slug = name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      updates.push(`slug = $${paramIndex++}`);
      values.push(slug);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (basePriceCents !== undefined) {
      updates.push(`default_base_price_cents = $${paramIndex++}`);
      values.push(parseInt(basePriceCents));
    }
    if (minPriceCents !== undefined) {
      updates.push(`default_min_price_cents = $${paramIndex++}`);
      values.push(parseInt(minPriceCents));
    }
    if (maxPriceCents !== undefined) {
      updates.push(`default_max_price_cents = $${paramIndex++}`);
      values.push(parseInt(maxPriceCents));
    }
    if (minDurationMinutes !== undefined && hasDurationColumns) {
      updates.push(`default_min_duration_minutes = $${paramIndex++}`);
      values.push(parseInt(minDurationMinutes));
    }
    if (maxDurationMinutes !== undefined && hasDurationColumns) {
      updates.push(`default_max_duration_minutes = $${paramIndex++}`);
      values.push(parseInt(maxDurationMinutes));
    }
    if (providerType !== undefined && hasProviderTypeColumn) {
      updates.push(`provider_type = $${paramIndex++}`);
      values.push(normalizeServiceProviderType(providerType));
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      throw new ApiError(400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE services SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, 'Service not found');
    }

    const row = result.rows[0];

    // Audit log
    await auditService.log({
      actor_user_id: req.user!.userId,
      action: 'service_updated',
      object_type: 'service',
      object_id: id,
      details: req.body,
    });

    res.json({
      success: true,
      data: mapServiceRow(row),
      message: 'Service updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete (deactivate) a service
 * DELETE /api/admin/services/:id
 */
export const deleteService = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    const { id } = req.params;
    const hardDelete = req.query.hard === 'true';

    if (hardDelete) {
      // Only admin can hard delete
      if (userRole !== 'ADMIN') {
        throw new ApiError(403, 'Only admins can permanently delete services');
      }
      
      await pool.query('DELETE FROM services WHERE id = $1', [id]);
      
      await auditService.log({
        actor_user_id: req.user!.userId,
        action: 'service_deleted_hard',
        object_type: 'service',
        object_id: id,
        details: {},
      });
    } else {
      // Soft delete - just deactivate
      const result = await pool.query(
        'UPDATE services SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        throw new ApiError(404, 'Service not found');
      }

      await auditService.log({
        actor_user_id: req.user!.userId,
        action: 'service_deactivated',
        object_type: 'service',
        object_id: id,
        details: { name: result.rows[0].name },
      });
    }

    logger.info('Service deleted', { id, hard: hardDelete, by: req.user!.userId });

    res.json({
      success: true,
      message: hardDelete ? 'Service permanently deleted' : 'Service deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get platform stats (total users, etc.)
 * GET /api/admin/stats
 */
export const getPlatformStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify admin role (handle both uppercase from DB and lowercase from frontend)
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    // Get total users count
    const usersResult = await pool.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(usersResult.rows[0].count);

    // Get total bookings count
    const bookingsResult = await pool.query('SELECT COUNT(*) FROM bookings');
    const totalBookings = parseInt(bookingsResult.rows[0].count);

    // Get total barbers count (only users who are still barbers, not demoted)
    const barbersResult = await pool.query(`
      SELECT COUNT(*) FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE b."isActive" = true AND u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')
    `);
    const totalBarbers = parseInt(barbersResult.rows[0].count);

    // Get total campuses count
    const campusesResult = await pool.query('SELECT COUNT(*) FROM campuses');
    const totalCampuses = parseInt(campusesResult.rows[0].count);

    res.json({
      success: true,
      data: {
        total_users: totalUsers,
        total_bookings: totalBookings,
        total_barbers: totalBarbers,
        total_campuses: totalCampuses,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all campuses
 * GET /api/admin/campuses
 */
export const getAllCampuses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scope = await getAccessibleCampusScope(req);

    const result = scope.isAdmin
      ? await pool.query(`
          SELECT id, name, slug, city, state
          FROM campuses
          WHERE "isActive" = TRUE
          ORDER BY name
        `)
      : await pool.query(
          `SELECT id, name, slug, city, state
           FROM campuses
           WHERE "isActive" = TRUE AND id = ANY($1::uuid[])
           ORDER BY name`,
          [scope.campusIds]
        );

    res.json({
      success: true,
      campuses: result.rows.map(row => ({
        id: String(row.id),
        name: row.name || '',
        slug: row.slug || '',
        city: row.city || '',
        state: row.state || '',
      })),
    });
  } catch (error: any) {
    logger.error('Failed to fetch campuses:', { 
      message: error.message, 
      code: error.code,
      detail: error.detail,
      stack: error.stack 
    });
    next(error);
  }
};

/**
 * Get campus performance metrics
 * GET /api/admin/campuses/:campusId/performance
 */
export const getCampusPerformance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campusId } = req.params;
    await assertCampusMetricsAccess(req, campusId);

    // Operators near this campus by public service pin (not users.campusId)
    const nearCampus = barberNearCampusByPinSql('b', '$1');
    const nearCampusIds = barberIdsNearCampusSubquery('$1');

    // Get barber counts - use simpler query
    const barbersResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE b."isActive" = true) as active
      FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')
        AND ${nearCampus}
    `, [campusId]);

    const totalConsumers = await countCampusConsumers(campusId);

    // Get booking counts - simpler approach without complex joins
    // Valid BookingStatus enum values: PENDING, ACCEPTED, PAID, IN_PROGRESS, COMPLETED, DISPUTED, CANCELLED, REFUNDED
    const bookingsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) as completed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
      FROM bookings
      WHERE "barberId" IN (${nearCampusIds})
    `, [campusId]);

    // Get total revenue, platform fees, and transaction count for Stripe fee calculation
    // Calculate barber earnings as totalPaidCents - platformFeeUsdCents to include tips
    // Also break out card vs cash payments
    // NOTE: Platform fees only apply to CARD payments - cash payments generate no platform revenue
    const revenueResult = await pool.query(`
      SELECT 
        COALESCE(SUM("totalPaidCents"), 0) as total_revenue,
        COALESCE(SUM("platformFeeUsdCents") FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL), 0) as total_platform_fees,
        COALESCE(SUM("totalPaidCents") - SUM("platformFeeUsdCents"), 0) as total_barber_earnings,
        COALESCE(SUM("tipAmountCents"), 0) as total_tips,
        COUNT(*) as completed_transaction_count,
        COALESCE(SUM("totalPaidCents") FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL), 0) as card_revenue,
        COUNT(*) FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL) as card_count,
        COALESCE(SUM("totalPaidCents") FILTER (WHERE LOWER("paymentMethod") = 'cash'), 0) as cash_revenue,
        COUNT(*) FILTER (WHERE LOWER("paymentMethod") = 'cash') as cash_count
      FROM bookings
      WHERE status IN ('COMPLETED', 'PAID')
      AND "barberId" IN (${nearCampusIds})
    `, [campusId]);

    // Get average rating and review count
    const ratingsResult = await pool.query(`
      SELECT 
        COALESCE(AVG("reviewRating"), 0) as avg_rating,
        COUNT("reviewRating") as total_reviews
      FROM bookings
      WHERE "reviewRating" IS NOT NULL
      AND "barberId" IN (${nearCampusIds})
    `, [campusId]);

    // Get average bookings per day (last 30 days)
    const avgDailyBookingsResult = await pool.query(`
      SELECT COALESCE(AVG(daily_count), 0) as avg_daily
      FROM (
        SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as daily_count
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        AND "createdAt" >= NOW() - INTERVAL '30 days'
        AND "barberId" IN (${nearCampusIds})
        GROUP BY DATE_TRUNC('day', "createdAt")
      ) daily_counts
    `, [campusId]);

    // Get average bookings per week (last 12 weeks)
    const avgWeeklyBookingsResult = await pool.query(`
      SELECT COALESCE(AVG(weekly_count), 0) as avg_weekly
      FROM (
        SELECT DATE_TRUNC('week', "createdAt") as week, COUNT(*) as weekly_count
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        AND "createdAt" >= NOW() - INTERVAL '12 weeks'
        AND "barberId" IN (${nearCampusIds})
        GROUP BY DATE_TRUNC('week', "createdAt")
      ) weekly_counts
    `, [campusId]);

    // Get average bookings per month (last 12 months)
    const avgMonthlyBookingsResult = await pool.query(`
      SELECT COALESCE(AVG(monthly_count), 0) as avg_monthly
      FROM (
        SELECT DATE_TRUNC('month', "createdAt") as month, COUNT(*) as monthly_count
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        AND "createdAt" >= NOW() - INTERVAL '12 months'
        AND "barberId" IN (${nearCampusIds})
        GROUP BY DATE_TRUNC('month', "createdAt")
      ) monthly_counts
    `, [campusId]);

    // Get average revenue per day (last 30 days)
    const avgDailyRevenueResult = await pool.query(`
      SELECT COALESCE(AVG(daily_revenue), 0) as avg_daily
      FROM (
        SELECT DATE_TRUNC('day', "createdAt") as day, SUM("totalPaidCents") as daily_revenue
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        AND "createdAt" >= NOW() - INTERVAL '30 days'
        AND "barberId" IN (${nearCampusIds})
        GROUP BY DATE_TRUNC('day', "createdAt")
      ) daily_revenues
    `, [campusId]);

    // Get average revenue per week (last 12 weeks)
    const avgWeeklyRevenueResult = await pool.query(`
      SELECT COALESCE(AVG(weekly_revenue), 0) as avg_weekly
      FROM (
        SELECT DATE_TRUNC('week', "createdAt") as week, SUM("totalPaidCents") as weekly_revenue
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        AND "createdAt" >= NOW() - INTERVAL '12 weeks'
        AND "barberId" IN (${nearCampusIds})
        GROUP BY DATE_TRUNC('week', "createdAt")
      ) weekly_revenues
    `, [campusId]);

    // Get average revenue per month (last 12 months)
    const avgMonthlyRevenueResult = await pool.query(`
      SELECT COALESCE(AVG(monthly_revenue), 0) as avg_monthly
      FROM (
        SELECT DATE_TRUNC('month', "createdAt") as month, SUM("totalPaidCents") as monthly_revenue
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        AND "createdAt" >= NOW() - INTERVAL '12 months'
        AND "barberId" IN (${nearCampusIds})
        GROUP BY DATE_TRUNC('month', "createdAt")
      ) monthly_revenues
    `, [campusId]);

    // Calculate average cost per appointment
    const completedBookings = parseInt(bookingsResult.rows[0]?.completed || '0');
    const totalRevenue = parseInt(revenueResult.rows[0]?.total_revenue || '0');
    const averageCostPerAppointment = completedBookings > 0 ? Math.round(totalRevenue / completedBookings) : 0;

    const totalPlatformFees = parseInt(revenueResult.rows[0]?.total_platform_fees || '0');
    const totalBarberEarnings = parseInt(revenueResult.rows[0]?.total_barber_earnings || '0');
    const totalTips = parseInt(revenueResult.rows[0]?.total_tips || '0');
    const completedTransactionCount = parseInt(revenueResult.rows[0]?.completed_transaction_count || '0');
    
    // Card vs Cash breakdown
    const cardRevenue = parseInt(revenueResult.rows[0]?.card_revenue || '0');
    const cardCount = parseInt(revenueResult.rows[0]?.card_count || '0');
    const cashRevenue = parseInt(revenueResult.rows[0]?.cash_revenue || '0');
    const cashCount = parseInt(revenueResult.rows[0]?.cash_count || '0');
    
    // === STRIPE PROCESSING FEES (per transaction) ===
    const stripePercentageFee = Math.round(cardRevenue * 0.029); // 2.9% of card gross
    const stripeFixedFee = cardCount * 30; // $0.30 per card transaction in cents
    const stripeProcessingFees = stripePercentageFee + stripeFixedFee;
    
    // === STRIPE CONNECT FEES (monthly platform fees) ===
    // 1. Active Account Billing: $2.00 per active connected account per month
    // Stripe charges for all barbers with connected accounts (active barbers on platform)
    const activeBarbers = parseInt(barbersResult.rows[0]?.active || '0');
    const activeAccountBilling = activeBarbers * 200; // $2.00 per active account in cents
    
    // 2. Account Volume Billing: 0.25% of total volume
    const volumeBilling = Math.round(cardRevenue * 0.0025);
    
    // 3. Payout Fees: $0.25 + 0.25% per payout (estimate weekly payouts per active barber)
    const payoutCountResult = await pool.query(`
      SELECT COUNT(*) as estimated_payouts
      FROM (
        SELECT DISTINCT "barberId", DATE_TRUNC('week', "createdAt") as payout_week
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
          AND (LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL)
          AND "barberId" IN (${nearCampusIds})
      ) as barber_weeks
    `, [campusId]);
    const estimatedPayouts = parseInt(payoutCountResult.rows[0]?.estimated_payouts || '0');
    const payoutFixedFee = estimatedPayouts * 25; // $0.25 per payout in cents
    const payoutPercentageFee = Math.round(cardRevenue * 0.0025); // 0.25% of payout volume
    const payoutFees = payoutFixedFee + payoutPercentageFee;
    
    // Total Connect fees
    const stripeConnectFees = activeAccountBilling + volumeBilling + payoutFees;
    
    // Total Stripe fees (processing + connect)
    const estimatedStripeFees = stripeProcessingFees + stripeConnectFees;
    
    // Net platform revenue = gross platform fees - ALL Stripe fees
    const netPlatformRevenue = Math.max(0, totalPlatformFees - estimatedStripeFees);

    res.json({
      totalBarbers: parseInt(barbersResult.rows[0]?.total || '0'),
      activeBarbers,
      totalConsumers,
      totalBookings: parseInt(bookingsResult.rows[0]?.total || '0'),
      completedBookings,
      cancelledBookings: parseInt(bookingsResult.rows[0]?.cancelled || '0'),
      totalRevenue, // Total money in circulation (what customers paid)
      totalPlatformFees, // Platform's gross cut (15%)
      totalBarberEarnings, // What barbers earned (85% + tips)
      totalTips, // Total tips collected
      // Stripe fee breakdown
      stripeProcessingFees, // 2.9% + $0.30 per transaction
      stripeConnectFees, // Active accounts + volume + payouts
      activeConnectAccounts: activeBarbers, // Number of barbers with Stripe accounts
      estimatedPayouts, // Number of payouts made
      activeAccountBilling, // $2/account monthly fee
      volumeBilling, // 0.25% volume fee
      payoutFees, // $0.25 + 0.25% per payout
      estimatedStripeFees, // Total Stripe fees
      netPlatformRevenue, // Platform's actual take after ALL Stripe fees
      completedTransactionCount, // Number of completed transactions
      // Card vs Cash breakdown
      cardRevenue,
      cardCount,
      cashRevenue,
      cashCount,
      averageRating: parseFloat(ratingsResult.rows[0]?.avg_rating || '0'),
      totalReviews: parseInt(ratingsResult.rows[0]?.total_reviews || '0'),
      // New average metrics
      averageBookingsPerDay: parseFloat(avgDailyBookingsResult.rows[0]?.avg_daily || '0'),
      averageBookingsPerWeek: parseFloat(avgWeeklyBookingsResult.rows[0]?.avg_weekly || '0'),
      averageBookingsPerMonth: parseFloat(avgMonthlyBookingsResult.rows[0]?.avg_monthly || '0'),
      averageRevenuePerDay: parseInt(avgDailyRevenueResult.rows[0]?.avg_daily || '0'),
      averageRevenuePerWeek: parseInt(avgWeeklyRevenueResult.rows[0]?.avg_weekly || '0'),
      averageRevenuePerMonth: parseInt(avgMonthlyRevenueResult.rows[0]?.avg_monthly || '0'),
      averageCostPerAppointment,
      // AWS Cost Estimates (in cents for consistency)
      ...calculateAwsCosts(completedBookings, activeBarbers),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get time-series metrics for a campus
 * GET /api/admin/campuses/:campusId/metrics?period=daily|weekly|monthly
 */
export const getCampusMetrics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campusId } = req.params;
    const period = (req.query.period as string) || 'daily';
    await assertCampusMetricsAccess(req, campusId);

    // Determine date truncation and range based on period
    let dateTrunc: string;
    let interval: string | null;
    let startDate: string | null = null;

    // Get current date info for MTD, QTD, YTD calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    switch (period) {
      case '1w':
        dateTrunc = 'day';
        interval = '7 days';
        break;
      case '4w':
        dateTrunc = 'day';
        interval = '28 days';
        break;
      case '1y':
        dateTrunc = 'week';
        interval = '1 year';
        break;
      case 'mtd':
        dateTrunc = 'day';
        interval = null;
        startDate = startOfMonth.toISOString();
        break;
      case 'qtd':
        dateTrunc = 'day';
        interval = null;
        startDate = startOfQuarter.toISOString();
        break;
      case 'ytd':
        dateTrunc = 'week';
        interval = null;
        startDate = startOfYear.toISOString();
        break;
      case 'all':
        dateTrunc = 'month';
        interval = null;
        break;
      // Legacy support
      case 'daily':
        dateTrunc = 'day';
        interval = '30 days';
        break;
      case 'weekly':
        dateTrunc = 'week';
        interval = '12 weeks';
        break;
      case 'monthly':
        dateTrunc = 'month';
        interval = '12 months';
        break;
      case 'alltime':
        dateTrunc = 'month';
        interval = null;
        break;
      default:
        dateTrunc = 'day';
        interval = '28 days'; // Default to 4 weeks
    }

    // Get campus timezone and barber IDs (operators near campus by service pin)
    const campusResult = await pool.query(`
      SELECT c.timezone,
             (
               SELECT COALESCE(array_agg(b.id), ARRAY[]::uuid[])
               FROM barbers b
               WHERE ${barberNearCampusByPinSql('b', '$1')}
             ) as barber_ids
      FROM campuses c
      WHERE c.id = $1::uuid
    `, [campusId]);

    if (campusResult.rows.length === 0) {
      throw new ApiError(404, 'Campus not found');
    }

    const campusTimezone = campusResult.rows[0].timezone || 'America/Los_Angeles';
    const barberIds = (campusResult.rows[0].barber_ids || []).filter((id: string | null) => id !== null);

    if (barberIds.length === 0) {
      // No barbers, return empty data
      return res.json({
        period,
        data: [],
      });
    }

    // Get bookings and revenue grouped by period
    // Use paidAt for accurate revenue tracking (when payment was actually made)
    // Convert to campus timezone for accurate local date grouping
    let metricsResult;
    if (interval) {
      // Time interval based query (1w, 4w, 1y, etc.)
      metricsResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "paidAt" AT TIME ZONE $4) as period_start,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) as bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE status IN ('COMPLETED', 'PAID')), 0) as revenue
        FROM bookings
        WHERE "barberId" = ANY($2::uuid[])
          AND "paidAt" IS NOT NULL
          AND "paidAt" >= NOW() - $3::interval
        GROUP BY DATE_TRUNC($1, "paidAt" AT TIME ZONE $4)
        ORDER BY period_start ASC
      `, [dateTrunc, barberIds, interval, campusTimezone]);
    } else if (startDate) {
      // Fixed start date query (MTD, QTD, YTD)
      metricsResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "paidAt" AT TIME ZONE $4) as period_start,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) as bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE status IN ('COMPLETED', 'PAID')), 0) as revenue
        FROM bookings
        WHERE "barberId" = ANY($2::uuid[])
          AND "paidAt" IS NOT NULL
          AND "paidAt" >= $3::timestamp
        GROUP BY DATE_TRUNC($1, "paidAt" AT TIME ZONE $4)
        ORDER BY period_start ASC
      `, [dateTrunc, barberIds, startDate, campusTimezone]);
    } else {
      // All time query - no time filter
      metricsResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "paidAt" AT TIME ZONE $3) as period_start,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) as bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE status IN ('COMPLETED', 'PAID')), 0) as revenue
        FROM bookings
        WHERE "barberId" = ANY($2::uuid[])
          AND "paidAt" IS NOT NULL
        GROUP BY DATE_TRUNC($1, "paidAt" AT TIME ZONE $3)
        ORDER BY period_start ASC
      `, [dateTrunc, barberIds, campusTimezone]);
    }

    // Get user signups for this campus (consumers who signed up with this campus)
    let usersResult;
    if (interval) {
      usersResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "createdAt" AT TIME ZONE $4) as period_start,
          COUNT(*) as users
        FROM users
        WHERE role = 'CONSUMER'
          AND "campusId" = $2::uuid
          AND "createdAt" >= NOW() - $3::interval
        GROUP BY DATE_TRUNC($1, "createdAt" AT TIME ZONE $4)
        ORDER BY period_start ASC
      `, [dateTrunc, campusId, interval, campusTimezone]);
    } else if (startDate) {
      usersResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "createdAt" AT TIME ZONE $4) as period_start,
          COUNT(*) as users
        FROM users
        WHERE role = 'CONSUMER'
          AND "campusId" = $2::uuid
          AND "createdAt" >= $3::timestamp
        GROUP BY DATE_TRUNC($1, "createdAt" AT TIME ZONE $4)
        ORDER BY period_start ASC
      `, [dateTrunc, campusId, startDate, campusTimezone]);
    } else {
      usersResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "createdAt" AT TIME ZONE $3) as period_start,
          COUNT(*) as users
        FROM users
        WHERE role = 'CONSUMER'
          AND "campusId" = $2::uuid
        GROUP BY DATE_TRUNC($1, "createdAt" AT TIME ZONE $3)
        ORDER BY period_start ASC
      `, [dateTrunc, campusId, campusTimezone]);
    }

    // Create maps for easier merging
    const bookingsMap = new Map(metricsResult.rows.map(row => [
      row.period_start?.toISOString(),
      { bookings: parseInt(row.bookings || '0'), revenue: parseInt(row.revenue || '0') }
    ]));
    const usersMap = new Map(usersResult.rows.map(row => [
      row.period_start?.toISOString(),
      parseInt(row.users || '0')
    ]));

    // Get all unique dates from both queries
    const allDates = new Set<string>([
      ...bookingsMap.keys(),
      ...usersMap.keys(),
    ].filter(Boolean));

    // Merge all data
    const data = Array.from(allDates)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map(dateKey => ({
        date: dateKey,
        bookings: bookingsMap.get(dateKey)?.bookings || 0,
        revenue: bookingsMap.get(dateKey)?.revenue || 0,
        users: usersMap.get(dateKey) || 0,
      }));

    // Get total users count for the period
    const totalUsersResult = await pool.query(
      interval 
        ? `SELECT COUNT(*) as total FROM users WHERE role = 'CONSUMER' AND "campusId" = $1::uuid AND "createdAt" >= NOW() - $2::interval`
        : startDate
        ? `SELECT COUNT(*) as total FROM users WHERE role = 'CONSUMER' AND "campusId" = $1::uuid AND "createdAt" >= $2::timestamp`
        : `SELECT COUNT(*) as total FROM users WHERE role = 'CONSUMER' AND "campusId" = $1::uuid`,
      interval ? [campusId, interval] : startDate ? [campusId, startDate] : [campusId]
    );

    res.json({
      period,
      data,
      totalUsers: parseInt(totalUsersResult.rows[0].total || '0'),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get aggregate performance across ALL campuses
 * GET /api/admin/campuses/aggregate/performance
 */
export const getAggregatePerformance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify admin role
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    // Get total barber counts
    const barbersResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE b."isActive" = true) as active
      FROM barbers b
      JOIN users u ON b."userId" = u.id
      WHERE u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')
    `);

    // Get total booking counts
    const bookingsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) as completed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
      FROM bookings
    `);

    // Get total revenue, platform fees, and transaction count
    // Calculate barber earnings as totalPaidCents - platformFeeUsdCents to include tips
    // Also break out card vs cash payments
    // NOTE: Platform fees only apply to CARD payments - cash payments generate no platform revenue
    const revenueResult = await pool.query(`
      SELECT 
        COALESCE(SUM("totalPaidCents"), 0) as total_revenue,
        COALESCE(SUM("platformFeeUsdCents") FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL), 0) as total_platform_fees,
        COALESCE(SUM("totalPaidCents") - SUM("platformFeeUsdCents"), 0) as total_barber_earnings,
        COALESCE(SUM("tipAmountCents"), 0) as total_tips,
        COUNT(*) as completed_transaction_count,
        COALESCE(SUM("totalPaidCents") FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL), 0) as card_revenue,
        COUNT(*) FILTER (WHERE LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL) as card_count,
        COALESCE(SUM("totalPaidCents") FILTER (WHERE LOWER("paymentMethod") = 'cash'), 0) as cash_revenue,
        COUNT(*) FILTER (WHERE LOWER("paymentMethod") = 'cash') as cash_count
      FROM bookings
      WHERE status IN ('COMPLETED', 'PAID')
    `);

    // Get average rating and review count
    const ratingsResult = await pool.query(`
      SELECT 
        COALESCE(AVG("reviewRating"), 0) as avg_rating,
        COUNT("reviewRating") as total_reviews
      FROM bookings
      WHERE "reviewRating" IS NOT NULL
    `);

    // Get average bookings per day (last 30 days)
    const avgDailyBookingsResult = await pool.query(`
      SELECT COALESCE(AVG(daily_count), 0) as avg_daily
      FROM (
        SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as daily_count
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        AND "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', "createdAt")
      ) daily_counts
    `);

    // Get average bookings per week (last 12 weeks)
    const avgWeeklyBookingsResult = await pool.query(`
      SELECT COALESCE(AVG(weekly_count), 0) as avg_weekly
      FROM (
        SELECT DATE_TRUNC('week', "createdAt") as week, COUNT(*) as weekly_count
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        AND "createdAt" >= NOW() - INTERVAL '12 weeks'
        GROUP BY DATE_TRUNC('week', "createdAt")
      ) weekly_counts
    `);

    // Get average bookings per month (last 12 months)
    const avgMonthlyBookingsResult = await pool.query(`
      SELECT COALESCE(AVG(monthly_count), 0) as avg_monthly
      FROM (
        SELECT DATE_TRUNC('month', "createdAt") as month, COUNT(*) as monthly_count
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        AND "createdAt" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
      ) monthly_counts
    `);

    // Calculate Stripe fees (2.9% + $0.30 per transaction)
    const totalRevenue = parseInt(revenueResult.rows[0].total_revenue || '0');
    const totalPlatformFees = parseInt(revenueResult.rows[0].total_platform_fees || '0');
    const totalBarberEarnings = parseInt(revenueResult.rows[0].total_barber_earnings || '0');
    const totalTips = parseInt(revenueResult.rows[0].total_tips || '0');
    const completedTransactionCount = parseInt(revenueResult.rows[0].completed_transaction_count || '0');
    
    // Card vs Cash breakdown
    const cardRevenue = parseInt(revenueResult.rows[0].card_revenue || '0');
    const cardCount = parseInt(revenueResult.rows[0].card_count || '0');
    const cashRevenue = parseInt(revenueResult.rows[0].cash_revenue || '0');
    const cashCount = parseInt(revenueResult.rows[0].cash_count || '0');
    
    // === STRIPE PROCESSING FEES (per transaction) ===
    // Stripe fees are calculated on CARD revenue only (cash doesn't have Stripe fees)
    const stripePercentageFee = Math.round(cardRevenue * 0.029); // 2.9% of card gross
    const stripeFixedFee = cardCount * 30; // $0.30 per card transaction in cents
    const stripeProcessingFees = stripePercentageFee + stripeFixedFee;
    
    // === STRIPE CONNECT FEES (monthly platform fees) ===
    // These are charged monthly for using Stripe Connect with Express accounts
    
    // 1. Active Account Billing: $2.00 per active connected account per month
    // Stripe charges for all barbers with connected accounts (active barbers on platform)
    const activeBarbers = parseInt(barbersResult.rows[0].active || '0');
    const activeAccountBilling = activeBarbers * 200; // $2.00 per active account in cents
    
    // 2. Account Volume Billing: 0.25% of total volume processed through connected accounts
    const volumeBilling = Math.round(cardRevenue * 0.0025); // 0.25% of card volume
    
    // 3. Payout Fees: $0.25 + 0.25% per payout
    // Estimate payouts: assume barbers receive payouts weekly if they had activity
    // Count distinct barber-weeks with completed transactions
    const payoutCountResult = await pool.query(`
      SELECT COUNT(*) as estimated_payouts
      FROM (
        SELECT DISTINCT "barberId", DATE_TRUNC('week', "createdAt") as payout_week
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
          AND (LOWER("paymentMethod") = 'card' OR "paymentMethod" IS NULL)
      ) as barber_weeks
    `);
    const estimatedPayouts = parseInt(payoutCountResult.rows[0]?.estimated_payouts || '0');
    const payoutFixedFee = estimatedPayouts * 25; // $0.25 per payout in cents
    const payoutPercentageFee = Math.round(cardRevenue * 0.0025); // 0.25% of payout volume
    const payoutFees = payoutFixedFee + payoutPercentageFee;
    
    // Total Connect fees
    const stripeConnectFees = activeAccountBilling + volumeBilling + payoutFees;
    
    // Total Stripe fees (processing + connect)
    const estimatedStripeFees = stripeProcessingFees + stripeConnectFees;
    
    // Net platform revenue = gross platform fees - ALL Stripe fees
    const netPlatformRevenue = Math.max(0, totalPlatformFees - estimatedStripeFees);

    const completedBookings = parseInt(bookingsResult.rows[0].completed || '0');
    const avgCostPerAppointment = completedBookings > 0 
      ? Math.round(totalRevenue / completedBookings)
      : 0;

    res.json({
      success: true,
      totalBarbers: parseInt(barbersResult.rows[0].total || '0'),
      activeBarbers: parseInt(barbersResult.rows[0].active || '0'),
      totalBookings: parseInt(bookingsResult.rows[0].total || '0'),
      completedBookings,
      cancelledBookings: parseInt(bookingsResult.rows[0].cancelled || '0'),
      totalRevenue,
      totalPlatformFees,
      totalBarberEarnings, // Now includes tips (totalPaid - platformFee)
      totalTips,
      // Stripe fee breakdown
      stripeProcessingFees, // 2.9% + $0.30 per transaction
      stripeConnectFees, // Active accounts + volume + payouts
      activeConnectAccounts: activeBarbers, // Number of barbers with Stripe accounts
      estimatedPayouts, // Number of payouts made
      activeAccountBilling, // $2/account monthly fee
      volumeBilling, // 0.25% volume fee
      payoutFees, // $0.25 + 0.25% per payout
      estimatedStripeFees, // Total Stripe fees
      netPlatformRevenue,
      completedTransactionCount,
      // Card vs Cash breakdown
      cardRevenue,
      cardCount,
      cashRevenue,
      cashCount,
      averageRating: parseFloat(ratingsResult.rows[0].avg_rating || '0'),
      totalReviews: parseInt(ratingsResult.rows[0].total_reviews || '0'),
      averageBookingsPerDay: parseFloat(avgDailyBookingsResult.rows[0].avg_daily || '0'),
      averageBookingsPerWeek: parseFloat(avgWeeklyBookingsResult.rows[0].avg_weekly || '0'),
      averageBookingsPerMonth: parseFloat(avgMonthlyBookingsResult.rows[0].avg_monthly || '0'),
      averageRevenuePerDay: parseFloat(avgDailyBookingsResult.rows[0].avg_daily || '0') * avgCostPerAppointment,
      averageRevenuePerWeek: parseFloat(avgWeeklyBookingsResult.rows[0].avg_weekly || '0') * avgCostPerAppointment,
      averageRevenuePerMonth: parseFloat(avgMonthlyBookingsResult.rows[0].avg_monthly || '0') * avgCostPerAppointment,
      averageCostPerAppointment: avgCostPerAppointment,
      // AWS Cost Estimates (in cents for consistency)
      ...calculateAwsCosts(completedBookings, activeBarbers),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate estimated AWS costs based on platform activity
 * Returns costs in cents for consistency with other financial fields
 */
function calculateAwsCosts(completedBookings: number, activeBarbers: number) {
  // Fixed monthly costs (in cents)
  const awsEc2Cost = 7242; // $72.42 - EC2 instance
  const awsVpcCost = 672; // $6.72 - VPC networking
  const awsRoute53Cost = 253; // $2.53 - DNS
  const awsFixedCosts = awsEc2Cost + awsVpcCost + awsRoute53Cost; // $81.67
  
  // Variable costs based on activity (estimated)
  // Data transfer: ~$0.09/GB, estimate 5MB per booking (images, API calls)
  const estimatedDataGb = (completedBookings * 5) / 1024; // Convert MB to GB
  const awsDataTransferCost = Math.round(estimatedDataGb * 9); // $0.09/GB in cents
  
  // S3 storage: ~$0.023/GB, estimate 2MB per barber profile
  const estimatedStorageGb = (activeBarbers * 2) / 1024;
  const awsS3StorageCost = Math.round(estimatedStorageGb * 2.3); // $0.023/GB in cents
  
  // S3 requests: ~$0.0004/1000 requests, estimate 50 requests per booking
  const estimatedRequests = completedBookings * 50;
  const awsS3RequestsCost = Math.round((estimatedRequests / 1000) * 0.04); // in cents
  
  const awsVariableCosts = awsDataTransferCost + awsS3StorageCost + awsS3RequestsCost;
  const awsTotalCost = awsFixedCosts + awsVariableCosts;
  
  return {
    awsEc2Cost,
    awsVpcCost,
    awsRoute53Cost,
    awsFixedCosts,
    awsDataTransferCost,
    awsS3StorageCost,
    awsS3RequestsCost,
    awsVariableCosts,
    awsTotalCost,
  };
}

/**
 * Get aggregate metrics across ALL campuses
 * GET /api/admin/campuses/aggregate/metrics
 */
export const getAggregateMetrics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || 'daily';

    // Verify admin role
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    // Determine date truncation and range based on period
    let dateTrunc: string;
    let interval: string | null;
    let startDate: string | null = null;

    // Get current date info for MTD, QTD, YTD calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    switch (period) {
      case '1w':
        dateTrunc = 'day';
        interval = '7 days';
        break;
      case '4w':
        dateTrunc = 'day';
        interval = '28 days';
        break;
      case '1y':
        dateTrunc = 'week';
        interval = '1 year';
        break;
      case 'mtd':
        dateTrunc = 'day';
        interval = null;
        startDate = startOfMonth.toISOString();
        break;
      case 'qtd':
        dateTrunc = 'day';
        interval = null;
        startDate = startOfQuarter.toISOString();
        break;
      case 'ytd':
        dateTrunc = 'week';
        interval = null;
        startDate = startOfYear.toISOString();
        break;
      case 'all':
        dateTrunc = 'month';
        interval = null;
        break;
      // Legacy support
      case 'daily':
        dateTrunc = 'day';
        interval = '30 days';
        break;
      case 'weekly':
        dateTrunc = 'week';
        interval = '12 weeks';
        break;
      case 'monthly':
        dateTrunc = 'month';
        interval = '12 months';
        break;
      case 'alltime':
        dateTrunc = 'month';
        interval = null;
        break;
      default:
        dateTrunc = 'day';
        interval = '28 days'; // Default to 4 weeks
    }

    // Get bookings and revenue grouped by period across all campuses
    // Use Pacific Time (America/Los_Angeles) since admins are based at Cal Poly SLO
    const aggregateTimezone = 'America/Los_Angeles';
    let metricsResult;
    let usersResult;
    
    if (interval) {
      // Time interval based query (1w, 4w, 1y, etc.)
      metricsResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "paidAt" AT TIME ZONE $3) as period_start,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) as bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE status IN ('COMPLETED', 'PAID')), 0) as revenue
        FROM bookings
        WHERE "paidAt" IS NOT NULL
          AND "paidAt" >= NOW() - $2::interval
        GROUP BY DATE_TRUNC($1, "paidAt" AT TIME ZONE $3)
        ORDER BY period_start ASC
      `, [dateTrunc, interval, aggregateTimezone]);
      
      // Get user signups in same period
      usersResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "createdAt" AT TIME ZONE $3) as period_start,
          COUNT(*) as users
        FROM users
        WHERE role = 'CONSUMER'
          AND "createdAt" >= NOW() - $2::interval
        GROUP BY DATE_TRUNC($1, "createdAt" AT TIME ZONE $3)
        ORDER BY period_start ASC
      `, [dateTrunc, interval, aggregateTimezone]);
    } else if (startDate) {
      // Fixed start date query (MTD, QTD, YTD)
      metricsResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "paidAt" AT TIME ZONE $3) as period_start,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) as bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE status IN ('COMPLETED', 'PAID')), 0) as revenue
        FROM bookings
        WHERE "paidAt" IS NOT NULL
          AND "paidAt" >= $2::timestamp
        GROUP BY DATE_TRUNC($1, "paidAt" AT TIME ZONE $3)
        ORDER BY period_start ASC
      `, [dateTrunc, startDate, aggregateTimezone]);
      
      // Get user signups in same period
      usersResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "createdAt" AT TIME ZONE $3) as period_start,
          COUNT(*) as users
        FROM users
        WHERE role = 'CONSUMER'
          AND "createdAt" >= $2::timestamp
        GROUP BY DATE_TRUNC($1, "createdAt" AT TIME ZONE $3)
        ORDER BY period_start ASC
      `, [dateTrunc, startDate, aggregateTimezone]);
    } else {
      // All time - no date filter
      metricsResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "paidAt" AT TIME ZONE $2) as period_start,
          COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'PAID')) as bookings,
          COALESCE(SUM("totalPaidCents") FILTER (WHERE status IN ('COMPLETED', 'PAID')), 0) as revenue
        FROM bookings
        WHERE "paidAt" IS NOT NULL
        GROUP BY DATE_TRUNC($1, "paidAt" AT TIME ZONE $2)
        ORDER BY period_start ASC
      `, [dateTrunc, aggregateTimezone]);
      
      // Get all user signups
      usersResult = await pool.query(`
        SELECT 
          DATE_TRUNC($1, "createdAt" AT TIME ZONE $2) as period_start,
          COUNT(*) as users
        FROM users
        WHERE role = 'CONSUMER'
        GROUP BY DATE_TRUNC($1, "createdAt" AT TIME ZONE $2)
        ORDER BY period_start ASC
      `, [dateTrunc, aggregateTimezone]);
    }

    // Create maps for both data sources
    const bookingsMap = new Map<string, { bookings: number; revenue: number }>();
    metricsResult.rows.forEach(row => {
      const key = row.period_start?.toISOString() || '';
      bookingsMap.set(key, {
        bookings: parseInt(row.bookings || '0'),
        revenue: parseInt(row.revenue || '0'),
      });
    });

    const usersMap = new Map<string, number>();
    usersResult.rows.forEach(row => {
      usersMap.set(row.period_start?.toISOString() || '', parseInt(row.users || '0'));
    });

    // Get all unique dates from both queries
    const allDates = new Set<string>([
      ...bookingsMap.keys(),
      ...usersMap.keys(),
    ]);

    // Format the response, merging all dates with bookings/revenue/users
    const data = Array.from(allDates)
      .filter(d => d) // Remove empty strings
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map(dateKey => ({
        date: dateKey,
        bookings: bookingsMap.get(dateKey)?.bookings || 0,
        revenue: bookingsMap.get(dateKey)?.revenue || 0,
        users: usersMap.get(dateKey) || 0,
      }));

    // Get total users count to match the Total Users display (handles NULL createdAt)
    const totalUsersResult = await pool.query(
      interval 
        ? `SELECT COUNT(*) as total FROM users WHERE role = 'CONSUMER' AND "createdAt" >= NOW() - $1::interval`
        : startDate
        ? `SELECT COUNT(*) as total FROM users WHERE role = 'CONSUMER' AND "createdAt" >= $1::timestamp`
        : `SELECT COUNT(*) as total FROM users WHERE role = 'CONSUMER'`,
      interval ? [interval] : startDate ? [startDate] : []
    );

    res.json({
      period,
      data,
      totalUsers: parseInt(totalUsersResult.rows[0].total || '0'),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get barbers for a campus (operators whose public service pin is near the campus)
 * GET /api/admin/campuses/:campusId/barbers
 */
export const getCampusBarbers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { campusId } = req.params;

    await assertCampusMetricsAccess(req, campusId);

    const nearCampus = barberNearCampusByPinSql('b', '$1');
    const distSql = servicePinDistanceToCampusSql('b', 'c');

    // Get barbers near this campus by service pin
    // Include legacy CAMPUS_MANAGER DB role as barbers
    // Include stripe fields to check Stripe setup status
    // Include booking stats (completed bookings count and total volume)
    const result = await pool.query(`
      SELECT 
        u.id,
        b.id as barber_record_id,
        u.first_name,
        u.last_name,
        u.email,
        u."avatarUrl" as profile_image_url,
        b."isActive" as is_active,
        c.id as campus_id,
        c.name as campus_name,
        b.service_location_label,
        b.service_latitude,
        b.service_longitude,
        b.commission_free_bookings_remaining,
        b.kickback_percent,
        u.role,
        u.stripe_account_id,
        u.stripe_payouts_enabled,
        u."isBanned" as is_banned,
        COALESCE(stats.completed_bookings, 0) as completed_bookings,
        COALESCE(stats.total_volume_cents, 0) as total_volume_cents
      FROM users u
      JOIN barbers b ON b."userId" = u.id
      JOIN campuses c ON c.id = $1::uuid
      LEFT JOIN (
        SELECT 
          "barberId",
          COUNT(*) as completed_bookings,
          SUM("totalPaidCents") as total_volume_cents
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        GROUP BY "barberId"
      ) stats ON stats."barberId" = b.id
      WHERE u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')
        AND ${nearCampus}
      ORDER BY ${distSql} ASC NULLS LAST, u.first_name, u.last_name
    `, [campusId]);

    res.json({
      success: true,
      barbers: result.rows.map(row => ({
        id: row.id.toString(),
        barberRecordId: row.barber_record_id?.toString(),
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        profileImageUrl: row.profile_image_url,
        isActive: row.is_active,
        campusId: row.campus_id?.toString(),
        campusName: row.campus_name,
        serviceLocationLabel: row.service_location_label
          ? coarsenPublicLocationLabel(String(row.service_location_label))
          : null,
        hasServiceLocation: row.service_latitude != null && row.service_longitude != null,
        hasStripeSetup: !!row.stripe_account_id && row.stripe_payouts_enabled === true,
        isBanned: row.is_banned === true,
        commissionFreeBookingsRemaining:
          parseInt(String(row.commission_free_bookings_remaining ?? '0'), 10) || 0,
        kickbackPercent: parseFloat(String(row.kickback_percent ?? '0')) || 0,
        completedBookings: parseInt(row.completed_bookings) || 0,
        totalVolumeCents: parseInt(row.total_volume_cents) || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a barber's bookings with messages
 * GET /api/admin/barbers/:barberRecordId/bookings
 */
export const getBarberBookings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { barberRecordId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Verify admin role
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    // Validate barberRecordId
    if (!barberRecordId || barberRecordId === 'undefined' || barberRecordId === 'null') {
      // Return empty bookings instead of error for missing barberRecordId
      return res.json({
        bookings: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(barberRecordId)) {
      console.error(`Invalid barberRecordId format: ${barberRecordId}`);
      return res.json({
        bookings: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }

    // Get bookings for this barber with consumer info and review data
    const result = await pool.query(`
      SELECT 
        b.id,
        b."serviceType" as service_type,
        b."priceUsdCents" as price_cents,
        b."tipAmountCents" as tip_cents,
        b."totalPaidCents" as total_paid_cents,
        b.status,
        b."paymentMethod" as payment_method,
        b."requestedAt" as scheduled_time,
        b."createdAt" as created_at,
        b."paidAt" as paid_at,
        r.rating as review_rating,
        r.comment as review_text,
        u.id as consumer_id,
        u.first_name as consumer_first_name,
        u.last_name as consumer_last_name,
        u.email as consumer_email,
        u."avatarUrl" as consumer_avatar,
        0 as message_count
      FROM bookings b
      JOIN users u ON b."consumerId" = u.id
      LEFT JOIN reviews r ON r."bookingId" = b.id
      WHERE b."barberId" = $1::uuid
      ORDER BY b."createdAt" DESC
      LIMIT $2 OFFSET $3
    `, [barberRecordId, limit, offset]);

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM bookings
      WHERE "barberId" = $1::uuid
    `, [barberRecordId]);

    res.json({
      bookings: result.rows,
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

/**
 * Get bookings for a specific user (consumer)
 * GET /api/admin/users/:userId/bookings
 */
export const getUserBookings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Verify admin role
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    // Validate userId
    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.json({
        bookings: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error(`Invalid userId format: ${userId}`);
      return res.json({
        bookings: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }

    // Get bookings for this consumer with barber info and review data
    const result = await pool.query(`
      SELECT 
        bk.id,
        bk."serviceType" as service_type,
        bk."priceUsdCents" as price_cents,
        bk."tipAmountCents" as tip_cents,
        bk."totalPaidCents" as total_paid_cents,
        bk.status,
        bk."paymentMethod" as payment_method,
        bk."requestedAt" as scheduled_time,
        bk."createdAt" as created_at,
        bk."paidAt" as paid_at,
        r.rating as review_rating,
        r.comment as review_text,
        b.id as barber_record_id,
        u.id as barber_user_id,
        u.first_name as barber_first_name,
        u.last_name as barber_last_name,
        u.email as barber_email,
        u."avatarUrl" as barber_avatar
      FROM bookings bk
      JOIN barbers b ON bk."barberId" = b.id
      JOIN users u ON b."userId" = u.id
      LEFT JOIN reviews r ON r."bookingId" = bk.id
      WHERE bk."consumerId" = $1::uuid
      ORDER BY bk."createdAt" DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM bookings
      WHERE "consumerId" = $1::uuid
    `, [userId]);

    res.json({
      bookings: result.rows,
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

/**
 * Get messages for a specific booking
 * GET /api/admin/bookings/:bookingId/messages
 * 
 * Checks both live conversations and archived messages (for completed bookings)
 */
export const getBookingMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bookingId } = req.params;

    // Verify admin role
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    // First check live conversations
    const conversationResult = await pool.query(`
      SELECT id as conversation_id
      FROM conversations
      WHERE booking_id = $1
    `, [bookingId]);

    if (conversationResult.rows.length > 0) {
      // Get live messages from the conversation
      const conversationId = conversationResult.rows[0].conversation_id;
      const messagesResult = await pool.query(`
        SELECT 
          m.id,
          m.content,
          m.sender_id,
          m.message_type,
          m.created_at,
          m.is_read,
          u.first_name as sender_first_name,
          u.last_name as sender_last_name,
          u."avatarUrl" as sender_avatar,
          u.role as sender_role
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at ASC
      `, [conversationId]);

      return res.json({
        bookingId,
        conversationId,
        source: 'live',
        messages: messagesResult.rows,
      });
    }

    // No live conversation - check archived messages (for completed/paid bookings)
    try {
      const archivedResult = await pool.query(`
        SELECT 
          id,
          content,
          sender_id,
          message_type,
          created_at,
          true as is_read,
          sender_first_name,
          sender_last_name,
          sender_avatar,
          sender_role
        FROM archived_booking_messages
        WHERE booking_id = $1
        ORDER BY created_at ASC
      `, [bookingId]);

      return res.json({
        bookingId,
        conversationId: null,
        source: 'archived',
        messages: archivedResult.rows,
      });
    } catch (archiveError: any) {
      // Archive table might not exist yet
      logger.warn(`Could not query archived messages: ${archiveError.message}`);
      return res.json({ bookingId, messages: [] });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get consumers and platform admins (for role management). Does not require a barber profile.
 * GET /api/admin/users?campusId=xxx
 */
export const getAllUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify admin role
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = (page - 1) * limit;
    const campusId = req.query.campusId as string | undefined;

    // Consumers (+ platform ADMIN accounts so they can be assigned/revoked without a barber profile)
    let whereClause = `WHERE u.role IN ('CONSUMER', 'ADMIN')`;
    const params: (string | number)[] = [limit, offset];
    
    if (campusId && campusId !== 'undefined' && campusId !== '') {
      // Campus filter applies to consumers; platform admins always included
      whereClause = `WHERE (
        (u.role = 'CONSUMER' AND COALESCE(pc.primary_campus_id, u."campusId") = $3::uuid)
        OR u.role = 'ADMIN'
      )`;
      params.push(campusId);
    }

    // Get consumers/admins with primary campus (booking-based) and global customer number
    const result = await pool.query(`
      WITH numbered_consumers AS (
        SELECT 
          id,
          ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as customer_number
        FROM users
        WHERE role = 'CONSUMER'
      ),
      -- Calculate primary campus for each consumer based on booking history
      consumer_booking_campuses AS (
        SELECT 
          bk."consumerId",
          bu."campusId" as barber_campus_id,
          COUNT(*) as booking_count
        FROM bookings bk
        JOIN barbers b ON bk."barberId" = b.id
        JOIN users bu ON b."userId" = bu.id
        WHERE bk.status IN ('COMPLETED', 'PAID', 'ACCEPTED', 'IN_PROGRESS')
        GROUP BY bk."consumerId", bu."campusId"
      ),
      -- Get the primary campus (most booked) for each consumer
      primary_campus AS (
        SELECT DISTINCT ON ("consumerId")
          "consumerId",
          barber_campus_id as primary_campus_id
        FROM consumer_booking_campuses
        ORDER BY "consumerId", booking_count DESC
      )
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u."avatarUrl" as avatar_url,
        u."createdAt" as created_at,
        true as is_active,
        -- Use primary campus (booking-based) if available, otherwise signup campus
        COALESCE(pc_campus.name, c.name) as campus_name,
        nc.customer_number
      FROM users u
      LEFT JOIN campuses c ON u."campusId" = c.id
      LEFT JOIN primary_campus pc ON u.id = pc."consumerId"
      LEFT JOIN campuses pc_campus ON pc.primary_campus_id = pc_campus.id
      LEFT JOIN numbered_consumers nc ON u.id = nc.id
      ${whereClause}
      ORDER BY CASE WHEN u.role = 'ADMIN' THEN 0 ELSE 1 END, u."createdAt" DESC
      LIMIT $1 OFFSET $2
    `, params);

    // Get total count (same role + campus filter)
    let countParams: string[] = [];
    let countQuery: string;
    
    if (campusId && campusId !== 'undefined' && campusId !== '') {
      countQuery = `
        WITH consumer_booking_campuses AS (
          SELECT 
            bk."consumerId",
            bu."campusId" as barber_campus_id,
            COUNT(*) as booking_count
          FROM bookings bk
          JOIN barbers b ON bk."barberId" = b.id
          JOIN users bu ON b."userId" = bu.id
          WHERE bk.status IN ('COMPLETED', 'PAID', 'ACCEPTED', 'IN_PROGRESS')
          GROUP BY bk."consumerId", bu."campusId"
        ),
        primary_campus AS (
          SELECT DISTINCT ON ("consumerId")
            "consumerId",
            barber_campus_id as primary_campus_id
          FROM consumer_booking_campuses
          ORDER BY "consumerId", booking_count DESC
        )
        SELECT COUNT(*) as total 
        FROM users u
        LEFT JOIN primary_campus pc ON u.id = pc."consumerId"
        WHERE (
          (u.role = 'CONSUMER' AND COALESCE(pc.primary_campus_id, u."campusId") = $1::uuid)
          OR u.role = 'ADMIN'
        )
      `;
      countParams.push(campusId);
    } else {
      countQuery = `SELECT COUNT(*) as total FROM users u WHERE u.role IN ('CONSUMER', 'ADMIN')`;
    }
    
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      users: result.rows,
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

/**
 * Get all barbers across all campuses
 * GET /api/admin/barbers
 */
export const getAllBarbers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify admin role
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    // Nearest campus by public service pin (admin geo org — not users.campusId)
    const nearestDist = servicePinDistanceToCampusSql('b', 'nc');
    const result = await pool.query(`
      SELECT 
        u.id,
        b.id as barber_record_id,
        u.first_name,
        u.last_name,
        u.email,
        u."avatarUrl" as profile_image_url,
        b."isActive" as is_active,
        nearest.id as campus_id,
        nearest.name as campus_name,
        b.service_location_label,
        b.service_latitude,
        b.service_longitude,
        b.commission_free_bookings_remaining,
        b.kickback_percent,
        u.role,
        u.stripe_account_id,
        u.stripe_payouts_enabled,
        u."isBanned" as is_banned,
        u."createdAt" as created_at,
        COALESCE(stats.completed_bookings, 0) as completed_bookings,
        COALESCE(stats.total_volume_cents, 0) as total_volume_cents
      FROM users u
      JOIN barbers b ON b."userId" = u.id
      LEFT JOIN LATERAL (
        SELECT nc.id, nc.name
        FROM campuses nc
        WHERE nc.latitude IS NOT NULL
          AND nc.longitude IS NOT NULL
          AND b.service_latitude IS NOT NULL
          AND b.service_longitude IS NOT NULL
          AND ${nearestDist} <= 8
        ORDER BY ${nearestDist} ASC
        LIMIT 1
      ) nearest ON true
      LEFT JOIN (
        SELECT 
          "barberId",
          COUNT(*) as completed_bookings,
          SUM("totalPaidCents") as total_volume_cents
        FROM bookings
        WHERE status IN ('COMPLETED', 'PAID')
        GROUP BY "barberId"
      ) stats ON stats."barberId" = b.id
      WHERE u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')
      ORDER BY nearest.name NULLS LAST, u.first_name, u.last_name
    `);

    res.json({
      success: true,
      barbers: result.rows.map(row => ({
        id: row.id.toString(),
        barberRecordId: row.barber_record_id?.toString(),
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        profileImageUrl: row.profile_image_url,
        isActive: row.is_active,
        campusId: row.campus_id?.toString() || null,
        campusName: row.campus_name || null,
        serviceLocationLabel: row.service_location_label
          ? coarsenPublicLocationLabel(String(row.service_location_label))
          : null,
        hasServiceLocation: row.service_latitude != null && row.service_longitude != null,
        hasStripeSetup: !!row.stripe_account_id && row.stripe_payouts_enabled === true,
        hasStripeAccountOnly: !!row.stripe_account_id && row.stripe_payouts_enabled !== true,
        isBanned: row.is_banned === true,
        createdAt: row.created_at,
        commissionFreeBookingsRemaining:
          parseInt(String(row.commission_free_bookings_remaining ?? '0'), 10) || 0,
        kickbackPercent: parseFloat(String(row.kickback_percent ?? '0')) || 0,
        completedBookings: parseInt(row.completed_bookings) || 0,
        totalVolumeCents: parseInt(row.total_volume_cents) || 0,
      })),
      total: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/barbers/:barberRecordId/commission
 * Set commission-free booking quota + platform-funded kickback percent
 * (global platform fee rate is Admin-set via /platform-settings; kickback only
 * pays out on commissionless bookings).
 */
export const updateBarberCommission = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    const { barberRecordId } = req.params;
    const { commissionFreeBookingsRemaining, kickbackPercent } = req.body ?? {};

    if (!barberRecordId) {
      throw new ApiError(400, 'barberRecordId is required');
    }

    if (!Object.prototype.hasOwnProperty.call(req.body ?? {}, 'commissionFreeBookingsRemaining')) {
      throw new ApiError(400, 'commissionFreeBookingsRemaining is required');
    }

    const remaining = typeof commissionFreeBookingsRemaining === 'number'
      ? commissionFreeBookingsRemaining
      : parseInt(String(commissionFreeBookingsRemaining), 10);
    if (!Number.isInteger(remaining) || remaining < 0 || remaining > 10000) {
      throw new ApiError(400, 'commissionFreeBookingsRemaining must be an integer between 0 and 10000');
    }

    let kickback = 0;
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'kickbackPercent')) {
      kickback =
        typeof kickbackPercent === 'number'
          ? kickbackPercent
          : parseFloat(String(kickbackPercent));
      if (!Number.isFinite(kickback) || kickback < 0 || kickback > 100) {
        throw new ApiError(400, 'kickbackPercent must be a number between 0 and 100');
      }
      // Store one decimal place max for admin clarity
      kickback = Math.round(kickback * 100) / 100;
    } else {
      const current = await pool.query(
        `SELECT kickback_percent FROM barbers WHERE id = $1::uuid`,
        [barberRecordId]
      );
      kickback = current.rows[0]?.kickback_percent != null
        ? parseFloat(String(current.rows[0].kickback_percent)) || 0
        : 0;
    }

    const existing = await pool.query(
      `SELECT id, commission_free_bookings_remaining, kickback_percent
       FROM barbers WHERE id = $1::uuid`,
      [barberRecordId]
    );
    if (existing.rows.length === 0) {
      throw new ApiError(404, 'Service provider not found');
    }

    const result = await pool.query(
      `UPDATE barbers
       SET commission_free_bookings_remaining = $1,
           kickback_percent = $2,
           "updatedAt" = NOW()
       WHERE id = $3::uuid
       RETURNING id, commission_free_bookings_remaining, kickback_percent`,
      [remaining, kickback, barberRecordId]
    );

    const row = result.rows[0];
    logger.info('admin_update_barber_commission', {
      barberRecordId,
      adminId: req.user!.userId,
      commissionFreeBookingsRemaining: row.commission_free_bookings_remaining,
      kickbackPercent: row.kickback_percent,
    });

    res.json({
      success: true,
      data: {
        barberRecordId: row.id.toString(),
        commissionFreeBookingsRemaining:
          parseInt(String(row.commission_free_bookings_remaining ?? '0'), 10) || 0,
        kickbackPercent: parseFloat(String(row.kickback_percent ?? '0')) || 0,
      },
      message: 'Payment settings updated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/barbers/commission/bulk
 * Apply commission-free quota and/or kickback % to all providers or a selected set.
 */
export const bulkUpdateBarberCommission = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    const {
      scope,
      barberRecordIds,
      commissionFreeBookingsRemaining,
      kickbackPercent,
    } = req.body ?? {};

    if (scope !== 'all' && scope !== 'selected') {
      throw new ApiError(400, 'scope must be "all" or "selected"');
    }

    const hasFree = Object.prototype.hasOwnProperty.call(
      req.body ?? {},
      'commissionFreeBookingsRemaining'
    );
    const hasKickback = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'kickbackPercent');
    if (!hasFree && !hasKickback) {
      throw new ApiError(
        400,
        'Provide commissionFreeBookingsRemaining and/or kickbackPercent'
      );
    }

    let remaining: number | null = null;
    if (hasFree) {
      remaining =
        typeof commissionFreeBookingsRemaining === 'number'
          ? commissionFreeBookingsRemaining
          : parseInt(String(commissionFreeBookingsRemaining), 10);
      if (!Number.isInteger(remaining) || remaining! < 0 || remaining! > 10000) {
        throw new ApiError(
          400,
          'commissionFreeBookingsRemaining must be an integer between 0 and 10000'
        );
      }
    }

    let kickback: number | null = null;
    if (hasKickback) {
      kickback =
        typeof kickbackPercent === 'number'
          ? kickbackPercent
          : parseFloat(String(kickbackPercent));
      if (!Number.isFinite(kickback) || kickback! < 0 || kickback! > 100) {
        throw new ApiError(400, 'kickbackPercent must be a number between 0 and 100');
      }
      kickback = Math.round(kickback! * 100) / 100;
    }

    let ids: string[] = [];
    if (scope === 'selected') {
      if (!Array.isArray(barberRecordIds) || barberRecordIds.length === 0) {
        throw new ApiError(400, 'barberRecordIds must be a non-empty array when scope is selected');
      }
      ids = barberRecordIds
        .map((id: unknown) => String(id))
        .filter((id: string) => /^[0-9a-f-]{36}$/i.test(id));
      if (ids.length === 0) {
        throw new ApiError(400, 'No valid barberRecordIds provided');
      }
    }

    const setClauses: string[] = ['"updatedAt" = NOW()'];
    const params: unknown[] = [];
    if (remaining !== null) {
      params.push(remaining);
      setClauses.push(`commission_free_bookings_remaining = $${params.length}`);
    }
    if (kickback !== null) {
      params.push(kickback);
      setClauses.push(`kickback_percent = $${params.length}`);
    }

    let result;
    if (scope === 'all') {
      result = await pool.query(
        `UPDATE barbers
         SET ${setClauses.join(', ')}
         RETURNING id`,
        params
      );
    } else {
      params.push(ids);
      result = await pool.query(
        `UPDATE barbers
         SET ${setClauses.join(', ')}
         WHERE id = ANY($${params.length}::uuid[])
         RETURNING id`,
        params
      );
    }

    const updatedCount = result.rowCount ?? 0;
    logger.info('admin_bulk_update_barber_commission', {
      adminId: req.user!.userId,
      scope,
      updatedCount,
      commissionFreeBookingsRemaining: remaining,
      kickbackPercent: kickback,
    });

    res.json({
      success: true,
      data: {
        updatedCount,
        scope,
        commissionFreeBookingsRemaining: remaining,
        kickbackPercent: kickback,
      },
      message: `Updated payment settings for ${updatedCount} operator${updatedCount === 1 ? '' : 's'}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:userId/ban
 * Platform ban — blocks sign-in (same flag as UGC moderation ban).
 */
export const banUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }
    const { userId } = req.params;
    const check = await pool.query(
      `SELECT id, "isBanned", role FROM users WHERE id = $1::uuid`,
      [userId]
    );
    if (check.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }
    if (check.rows[0].isBanned === true) {
      res.json({ success: true, data: { ok: true, wasBanned: true }, message: 'User was already banned' });
      return;
    }
    await pool.query(`UPDATE users SET "isBanned" = true, "updatedAt" = NOW() WHERE id = $1::uuid`, [
      userId,
    ]);
    try {
      await applyAffiliationCleanupForBannedUser(userId);
    } catch (cleanupErr) {
      logger.warn('admin_ban_affiliation_cleanup_failed', {
        userId,
        err: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
      });
    }
    logger.info('admin_ban_user', { userId, adminId: req.user!.userId });
    res.json({ success: true, data: { ok: true, wasBanned: false }, message: 'User banned' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/users/:userId/unban
 * Clears platform ban (login / app access) set via moderation or otherwise.
 */
export const unbanUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }
    const { userId } = req.params;
    const check = await pool.query(
      `SELECT id, "isBanned" FROM users WHERE id = $1::uuid`,
      [userId]
    );
    if (check.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }
    if (check.rows[0].isBanned !== true) {
      res.json({ success: true, data: { ok: true, wasBanned: false }, message: 'User was not banned' });
      return;
    }
    await pool.query(`UPDATE users SET "isBanned" = false, "updatedAt" = NOW() WHERE id = $1::uuid`, [userId]);
    logger.info('admin_unban_user', { userId, adminId: req.user!.userId });
    res.json({ success: true, data: { ok: true, wasBanned: true }, message: 'User unbanned' });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/users/:userId/role
 * Assign or revoke platform ADMIN. Does not require a barber profile.
 * Allowed transitions: CONSUMER ↔ ADMIN only (operators stay on barber flows).
 */
export const updateUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const actorRole = req.user!.role?.toUpperCase();
    if (actorRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }

    const { userId } = req.params;
    const rawRole = typeof req.body?.role === 'string' ? req.body.role.trim().toUpperCase() : '';
    if (rawRole !== 'ADMIN' && rawRole !== 'CONSUMER') {
      throw new ApiError(400, 'role must be ADMIN or CONSUMER');
    }

    if (userId === req.user!.userId) {
      throw new ApiError(400, 'You cannot change your own role');
    }

    const check = await pool.query(
      `SELECT id, role, email FROM users WHERE id = $1::uuid`,
      [userId]
    );
    if (check.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const currentRole = String(check.rows[0].role || '').toUpperCase();
    if (currentRole !== 'CONSUMER' && currentRole !== 'ADMIN') {
      throw new ApiError(
        400,
        `Only CONSUMER or ADMIN accounts can be updated here (current role: ${currentRole})`
      );
    }

    if (currentRole === rawRole) {
      res.json({
        success: true,
        data: { id: userId, role: rawRole },
        message: `User is already ${rawRole}`,
      });
      return;
    }

    await pool.query(
      `UPDATE users SET role = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2::uuid`,
      [rawRole, userId]
    );

    logger.info('admin_update_user_role', {
      userId,
      email: check.rows[0].email,
      from: currentRole,
      to: rawRole,
      adminId: req.user!.userId,
    });

    res.json({
      success: true,
      data: { id: userId, role: rawRole },
      message: rawRole === 'ADMIN' ? 'User promoted to ADMIN' : 'Admin access revoked',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/moderation/banned-users
 * Users with platform ban (isBanned).
 */
export const listBannedUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN') {
      throw new ApiError(403, 'Admin access required');
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '200'), 10) || 200, 1), 500);
    const rawCat =
      typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : 'all';
    const categoryFilter = ['all', 'service_provider', 'consumer', 'admin', 'other'].includes(rawCat)
      ? rawCat
      : 'all';

    let categoryWhere = '';
    if (categoryFilter === 'service_provider') {
      categoryWhere = ` AND (
          EXISTS (SELECT 1 FROM barbers b2 WHERE b2."userId" = u.id)
          OR u.role IN ('BARBER', 'CAMPUS_MANAGER')
        )`;
    } else if (categoryFilter === 'consumer') {
      categoryWhere = ` AND u.role = 'CONSUMER'
          AND NOT EXISTS (SELECT 1 FROM barbers b2 WHERE b2."userId" = u.id)`;
    } else if (categoryFilter === 'admin') {
      categoryWhere = ` AND u.role = 'ADMIN'`;
    } else if (categoryFilter === 'other') {
      categoryWhere = ` AND u.role NOT IN ('CONSUMER', 'BARBER', 'CAMPUS_MANAGER', 'ADMIN')`;
    }

    const result = await pool.query(
      `SELECT u.id,
              u.first_name,
              u.last_name,
              u.email,
              u.role,
              c.name AS campus_name,
              u."updatedAt" AS updated_at,
              CASE
                WHEN u.role = 'ADMIN' THEN 'admin'
                WHEN EXISTS (SELECT 1 FROM barbers b2 WHERE b2."userId" = u.id)
                     OR u.role IN ('BARBER', 'CAMPUS_MANAGER') THEN 'service_provider'
                WHEN u.role = 'CONSUMER' THEN 'consumer'
                ELSE 'other'
              END AS account_category,
              EXISTS (SELECT 1 FROM barbers b2 WHERE b2."userId" = u.id) AS has_barber_profile,
              (
                SELECT b3."isActive"
                FROM barbers b3
                WHERE b3."userId" = u.id
                ORDER BY CASE WHEN b3."isActive" THEN 0 ELSE 1 END, b3."createdAt" DESC NULLS LAST
                LIMIT 1
              ) AS barber_is_active,
              (
                SELECT COUNT(*)::int
                FROM ugc_content_reports r
                WHERE r.reported_user_id = u.id AND r.status = 'open'
              ) AS open_report_count
       FROM users u
       LEFT JOIN campuses c ON c.id = u."campusId"
       WHERE u."isBanned" = true
       ${categoryWhere}
       ORDER BY
         CASE
           WHEN EXISTS (SELECT 1 FROM ugc_content_reports r2 WHERE r2.reported_user_id = u.id AND r2.status = 'open')
             THEN 0 ELSE 1
         END,
         u."updatedAt" DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    res.json({
      success: true,
      data: {
        users: result.rows.map((row) => ({
          id: String(row.id),
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          role: row.role,
          campus_name: row.campus_name ?? null,
          updated_at: row.updated_at,
          account_category: row.account_category,
          has_barber_profile: row.has_barber_profile === true,
          barber_is_active:
            row.barber_is_active === null || row.barber_is_active === undefined
              ? null
              : row.barber_is_active === true,
          open_report_count: parseInt(String(row.open_report_count ?? 0), 10) || 0,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/moderation/reports
 * List UGC reports (App Store safety workflow).
 */
export const listUgcReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }
    const raw = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'open';
    const allowed = ['open', 'dismissed', 'resolved', 'all'];
    const statusFilter = allowed.includes(raw) ? raw : 'open';
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 500);

    let sql = `SELECT r.*,
              ru.email AS reporter_email,
              ru.first_name AS reporter_first_name,
              ru.last_name AS reporter_last_name,
              du.email AS reported_email,
              du.first_name AS reported_first_name,
              du.last_name AS reported_last_name,
              LEFT(COALESCE(m.content, lm.content, ''), 500) AS message_preview,
              CASE
                WHEN m.id IS NOT NULL THEN COALESCE(m.is_deleted, false)
                WHEN lm.id IS NOT NULL THEN COALESCE(lm.is_deleted, false)
                ELSE false
              END AS message_is_deleted,
              (r.message_id IS NULL AND lm.id IS NOT NULL) AS message_context_is_inferred,
              COALESCE(r.message_id, lm.id) AS moderation_target_message_id
       FROM ugc_content_reports r
       JOIN users ru ON ru.id = r.reporter_user_id
       JOIN users du ON du.id = r.reported_user_id
       LEFT JOIN messages m ON m.id = r.message_id
       LEFT JOIN LATERAL (
         SELECT msg.id, msg.content, msg.is_deleted
         FROM messages msg
         WHERE r.message_id IS NULL
           AND r.conversation_id IS NOT NULL
           AND msg.conversation_id = r.conversation_id
           AND msg.sender_id = r.reported_user_id
           AND msg.is_deleted = false
         ORDER BY msg.created_at DESC
         LIMIT 1
       ) lm ON TRUE`;
    const params: unknown[] = [];
    if (statusFilter !== 'all') {
      sql += ` WHERE r.status = $1`;
      params.push(statusFilter);
    }
    const order = statusFilter === 'open' ? 'ASC' : 'DESC';
    sql += ` ORDER BY r.created_at ${order} LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(sql, params);
    res.json({ success: true, data: { reports: result.rows } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/moderation/reports/:reportId/resolve
 * body: { action: 'dismiss' | 'remove_message' | 'ban_reported_user' | 'remove_message_and_ban', notes?: string }
 */
export const resolveUgcReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }
    const { reportId } = req.params;
    const { action, notes } = req.body as { action?: string; notes?: string };
    const allowed = ['dismiss', 'remove_message', 'ban_reported_user', 'remove_message_and_ban'];
    if (!action || !allowed.includes(action)) {
      throw new ApiError(400, `action must be one of: ${allowed.join(', ')}`);
    }
    const rep = await pool.query(`SELECT * FROM ugc_content_reports WHERE id = $1::uuid`, [reportId]);
    if (rep.rows.length === 0) {
      throw new ApiError(404, 'Report not found');
    }
    const row = rep.rows[0];
    if (row.status !== 'open') {
      throw new ApiError(400, 'Report is already closed');
    }

    const removeMsg =
      action === 'remove_message' || action === 'remove_message_and_ban';
    const banUser =
      action === 'ban_reported_user' || action === 'remove_message_and_ban';

    if (removeMsg) {
      let targetMessageId: number | null = row.message_id != null ? parseInt(String(row.message_id), 10) : null;
      if (
        targetMessageId == null &&
        row.conversation_id != null &&
        row.reported_user_id != null
      ) {
        const pick = await pool.query(
          `SELECT id FROM messages
           WHERE conversation_id = $1 AND sender_id = $2::uuid AND is_deleted = false
           ORDER BY created_at DESC
           LIMIT 1`,
          [row.conversation_id, row.reported_user_id]
        );
        if (pick.rows.length > 0) {
          targetMessageId = parseInt(String(pick.rows[0].id), 10);
        }
      }
      if (targetMessageId != null) {
        await pool.query(`UPDATE messages SET is_deleted = true WHERE id = $1`, [targetMessageId]);
        if (row.message_id == null) {
          await pool.query(`UPDATE ugc_content_reports SET message_id = $1 WHERE id = $2::uuid`, [
            targetMessageId,
            reportId,
          ]);
        }
      }
    }
    if (banUser) {
      await pool.query(`UPDATE users SET "isBanned" = true, "updatedAt" = NOW() WHERE id = $1`, [
        row.reported_user_id,
      ]);
      try {
        await applyAffiliationCleanupForBannedUser(row.reported_user_id);
      } catch (cleanupErr: unknown) {
        logger.error('ban_affiliation_cleanup_failed', {
          bannedUserId: row.reported_user_id,
          err: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
        });
      }
    }

    const newStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
    await pool.query(
      `UPDATE ugc_content_reports
       SET status = $1,
           resolved_at = NOW(),
           resolver_admin_id = $2::uuid,
           resolution_notes = $3
       WHERE id = $4::uuid`,
      [newStatus, req.user!.userId, notes?.trim() || null, reportId]
    );

    res.json({ success: true, data: { ok: true }, message: 'Report updated' });
  } catch (error) {
    next(error);
  }
};

