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

    const { chain } = req.body;

    const batch = await withdrawalBatchService.processBatch(chain || 'aptos', 1);

    if (!batch) {
      res.json({
        success: true,
        message: 'No withdrawals queued for batching',
      });
      return;
    }

    res.json({
      success: true,
      data: batch,
      message: 'Batch processed successfully',
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

/**
 * Get all services
 * GET /api/admin/services
 */
export const getServices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Allow admin and campus managers
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN' && userRole !== 'CAMPUS_MANAGER') {
      throw new ApiError(403, 'Admin or Campus Manager access required');
    }

    const includeInactive = req.query.includeInactive === 'true';
    
    let query = `
      SELECT id, slug, name, description, 
             default_base_price_cents, 
             default_min_price_cents, 
             default_max_price_cents,
             is_active, created_at, updated_at
      FROM services
    `;
    
    if (!includeInactive) {
      query += ' WHERE is_active = true';
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        basePriceCents: row.default_base_price_cents,
        minPriceCents: row.default_min_price_cents,
        maxPriceCents: row.default_max_price_cents,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
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
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN' && userRole !== 'CAMPUS_MANAGER') {
      throw new ApiError(403, 'Admin or Campus Manager access required');
    }

    const { name, description, basePriceCents, minPriceCents, maxPriceCents } = req.body;

    if (!name || !basePriceCents) {
      throw new ApiError(400, 'Name and base price are required');
    }

    // Generate slug from name
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Validate price bounds
    const baseCents = parseInt(basePriceCents);
    const minCents = minPriceCents ? parseInt(minPriceCents) : Math.round(baseCents * 0.8);
    const maxCents = maxPriceCents ? parseInt(maxPriceCents) : Math.round(baseCents * 1.5);

    if (minCents > baseCents || baseCents > maxCents) {
      throw new ApiError(400, 'Invalid price bounds: min <= base <= max');
    }

    const result = await pool.query(
      `INSERT INTO services (slug, name, description, default_base_price_cents, default_min_price_cents, default_max_price_cents)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [slug, name, description || null, baseCents, minCents, maxCents]
    );

    const row = result.rows[0];

    // Audit log
    await auditService.log({
      actor_user_id: req.user!.userId,
      action: 'service_created',
      object_type: 'service',
      object_id: row.id.toString(),
      details: { name, slug, basePriceCents: baseCents },
    });

    logger.info('Service created', { id: row.id, name, slug, by: req.user!.userId });

    res.status(201).json({
      success: true,
      data: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        basePriceCents: row.default_base_price_cents,
        minPriceCents: row.default_min_price_cents,
        maxPriceCents: row.default_max_price_cents,
        isActive: row.is_active,
      },
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
    const userRole = req.user!.role?.toUpperCase();
    if (userRole !== 'ADMIN' && userRole !== 'CAMPUS_MANAGER') {
      throw new ApiError(403, 'Admin or Campus Manager access required');
    }

    const { id } = req.params;
    const { name, description, basePriceCents, minPriceCents, maxPriceCents, isActive } = req.body;

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
      data: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        basePriceCents: row.default_base_price_cents,
        minPriceCents: row.default_min_price_cents,
        maxPriceCents: row.default_max_price_cents,
        isActive: row.is_active,
      },
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
    if (userRole !== 'ADMIN' && userRole !== 'CAMPUS_MANAGER') {
      throw new ApiError(403, 'Admin or Campus Manager access required');
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

    // Get total barbers count
    const barbersResult = await pool.query('SELECT COUNT(*) FROM barbers WHERE "isActive" = true');
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

