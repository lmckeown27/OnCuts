/**
 * Gas Wallet Controller
 * 
 * Handles gas estimation, top-up requests, and admin approval flow
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import gasEstimatorService from '../services/gas-estimator.service';
import gasTopUpVerifierService from '../services/gas-topup-verifier.service';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';

/**
 * GET /api/gas/estimate
 * Get current gas estimate and wallet status
 */
export const getGasEstimate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const estimate = await gasEstimatorService.estimateGas();

    res.json({
      success: true,
      data: estimate,
    });
  } catch (error) {
    logger.error('Failed to get gas estimate:', error);
    next(error);
  }
};

/**
 * POST /api/gas/topup-request
 * Create a new top-up request (admin auth required)
 * 
 * Body: { idempotencyKey?: string, requestedAmountAPT?: number }
 */
export const createTopUpRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { idempotencyKey, requestedAmountAPT } = req.body;
    const userId = (req as any).user?.id; // From auth middleware

    // Check for existing request with same idempotency key
    if (idempotencyKey) {
      const existing = await pool.query(
        'SELECT id, requested_amount_apt, status FROM gas_top_up_requests WHERE idempotency_key = $1',
        [idempotencyKey]
      );

      if (existing.rows.length > 0) {
        return res.json({
          success: true,
          data: existing.rows[0],
          message: 'Request already exists (idempotent)',
        });
      }
    }

    // Get gas wallet
    const walletResult = await pool.query(
      'SELECT * FROM gas_wallets WHERE is_active = true LIMIT 1'
    );

    if (walletResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active gas wallet found',
      });
    }

    const wallet = walletResult.rows[0];

    // Get or calculate requested amount
    let amountAPT: number;
    if (requestedAmountAPT) {
      amountAPT = requestedAmountAPT;
    } else {
      // Auto-calculate based on estimate
      const estimate = await gasEstimatorService.estimateGas();
      amountAPT = estimate.amountNeededAPT;
    }

    // Validate amount
    if (amountAPT <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount: must be greater than 0',
      });
    }

    // Round to 6 decimal places
    amountAPT = new Decimal(amountAPT).toDecimalPlaces(6, Decimal.ROUND_UP).toNumber();

    // Convert to octas
    const amountOctas = new Decimal(amountAPT)
      .times(100_000_000)
      .toDecimalPlaces(0, Decimal.ROUND_UP)
      .toNumber();

    // Get fresh estimate for metadata
    const estimate = await gasEstimatorService.estimateGas();

    const reason = `Admin-requested top-up: ${amountAPT.toFixed(6)} APT. Current balance: ${estimate.currentBalanceAPT.toFixed(6)} APT. Estimated coverage: ${estimate.estimatedCoverageDays.toFixed(1)} days.`;

    // Create request
    const result = await pool.query(
      `INSERT INTO gas_top_up_requests (
        gas_wallet_id,
        gas_wallet_address,
        requested_amount_apt,
        requested_amount_octas,
        status,
        reason,
        estimated_coverage_days,
        verification_status,
        idempotency_key,
        admin_user_id,
        audit_metadata
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, 'pending', $7, $8, $9)
      RETURNING id, requested_amount_apt, requested_amount_octas, status, reason, created_at`,
      [
        wallet.id,
        wallet.address,
        amountAPT,
        amountOctas,
        reason,
        estimate.estimatedCoverageDays,
        idempotencyKey || null,
        userId || null,
        JSON.stringify({ estimate }),
      ]
    );

    const request = result.rows[0];

    logger.info('Created top-up request:', {
      requestId: request.id,
      amount: amountAPT,
      userId,
    });

    res.status(201).json({
      success: true,
      data: {
        ...request,
        gasWalletAddress: wallet.address,
      },
    });
  } catch (error) {
    logger.error('Failed to create top-up request:', error);
    next(error);
  }
};

/**
 * GET /api/gas/topup-requests
 * List top-up requests with pagination (admin auth required)
 * 
 * Query: ?status=pending&limit=10&offset=0
 */
export const listTopUpRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        r.*,
        w.descriptive_name as wallet_name,
        u.email as admin_email
      FROM gas_top_up_requests r
      JOIN gas_wallets w ON r.gas_wallet_id = w.id
      LEFT JOIN users u ON r.admin_user_id = u.id
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` WHERE r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: result.rowCount,
      },
    });
  } catch (error) {
    logger.error('Failed to list top-up requests:', error);
    next(error);
  }
};

/**
 * POST /api/gas/topup-request/:id/confirm
 * Confirm admin wallet transfer with transaction hash
 * 
 * Body: { txHash: string, fromAddress: string }
 */
export const confirmTopUpRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { txHash, fromAddress } = req.body;
    const userId = (req as any).user?.id;

    if (!txHash || !fromAddress) {
      return res.status(400).json({
        success: false,
        error: 'txHash and fromAddress are required',
      });
    }

    // Get request
    const result = await pool.query(
      'SELECT * FROM gas_top_up_requests WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Top-up request not found',
      });
    }

    const request = result.rows[0];

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Request is in ${request.status} status, cannot confirm`,
      });
    }

    // Update request with tx hash
    await pool.query(
      `UPDATE gas_top_up_requests 
       SET status = 'approved',
           approved_tx_hash = $1,
           admin_address_requested_from = $2,
           admin_user_id = $3,
           audit_metadata = audit_metadata || $4::jsonb
       WHERE id = $5`,
      [
        txHash,
        fromAddress,
        userId || null,
        JSON.stringify({
          approvedAt: new Date().toISOString(),
          approvedBy: fromAddress,
        }),
        id,
      ]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO gas_wallet_audit_logs (
        gas_wallet_id,
        top_up_request_id,
        event_type,
        actor_type,
        actor_user_id,
        actor_wallet_address,
        data
      ) 
      SELECT gas_wallet_id, $1, 'top_up_approved', 'admin', $2, $3, $4
      FROM gas_top_up_requests
      WHERE id = $1`,
      [id, userId || null, fromAddress, JSON.stringify({ txHash })]
    );

    logger.info('Top-up request approved:', {
      requestId: id,
      txHash,
      fromAddress,
    });

    // Start async verification (don't await)
    gasTopUpVerifierService.watchTopUpRequest(id).catch((error) => {
      logger.error(`Verification watcher failed for request ${id}:`, error);
    });

    res.json({
      success: true,
      message: 'Transaction submitted. Verification in progress.',
      data: {
        requestId: id,
        txHash,
        status: 'approved',
        verificationStatus: 'pending',
      },
    });
  } catch (error) {
    logger.error('Failed to confirm top-up request:', error);
    next(error);
  }
};

/**
 * GET /api/gas/topup-request/:id
 * Get single top-up request details
 */
export const getTopUpRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        r.*,
        w.descriptive_name as wallet_name,
        u.email as admin_email
      FROM gas_top_up_requests r
      JOIN gas_wallets w ON r.gas_wallet_id = w.id
      LEFT JOIN users u ON r.admin_user_id = u.id
      WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Top-up request not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Failed to get top-up request:', error);
    next(error);
  }
};

/**
 * POST /api/admin/gas/topup-request/:id/mark-completed
 * Manual override to mark request as completed (admin only, for reconciliation)
 * 
 * Body: { verifiedAmountOctas: number, note: string }
 */
export const manualMarkCompleted = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { verifiedAmountOctas, note } = req.body;
    const userId = (req as any).user?.id;
    const userEmail = (req as any).user?.email;

    if (!verifiedAmountOctas || !note) {
      return res.status(400).json({
        success: false,
        error: 'verifiedAmountOctas and note are required',
      });
    }

    // Get request
    const result = await pool.query(
      'SELECT * FROM gas_top_up_requests WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Top-up request not found',
      });
    }

    // Update to completed with manual override flag
    await pool.query(
      `UPDATE gas_top_up_requests 
       SET status = 'completed',
           verification_status = 'verified',
           verified_amount_octas = $1,
           verified_at = NOW(),
           audit_metadata = audit_metadata || $2::jsonb
       WHERE id = $3`,
      [
        verifiedAmountOctas,
        JSON.stringify({
          manualOverride: true,
          manuallyCompletedBy: userEmail,
          manuallyCompletedAt: new Date().toISOString(),
          note,
        }),
        id,
      ]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO gas_wallet_audit_logs (
        gas_wallet_id,
        top_up_request_id,
        event_type,
        actor_type,
        actor_user_id,
        data
      ) 
      SELECT gas_wallet_id, $1, 'manual_completion', 'admin', $2, $3
      FROM gas_top_up_requests
      WHERE id = $1`,
      [id, userId || null, JSON.stringify({ verifiedAmountOctas, note })]
    );

    logger.warn('Top-up request manually marked as completed:', {
      requestId: id,
      by: userEmail,
      amount: verifiedAmountOctas,
      note,
    });

    res.json({
      success: true,
      message: 'Request manually marked as completed',
    });
  } catch (error) {
    logger.error('Failed to manually mark request completed:', error);
    next(error);
  }
};

/**
 * GET /api/gas/health
 * Get gas wallet health status
 */
export const getGasWalletHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await pool.query('SELECT * FROM gas_wallet_health');

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Failed to get gas wallet health:', error);
    next(error);
  }
};

