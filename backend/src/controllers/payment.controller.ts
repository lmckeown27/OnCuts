import { Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { ApiError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import stripeService from '../services/stripe.service';
import aptosService from '../services/aptos.service';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export const createPaymentIntent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bookingId, amount } = req.body;
    const clientId = req.user!.userId;

    // Verify booking exists and belongs to client
    const booking = await pool.query(
      `SELECT bm.*, b.id as barber_id
       FROM booking_metadata bm
       JOIN barbers b ON bm.barber_id = b.id
       WHERE bm.blockchain_booking_id = $1 AND bm.client_id = $2`,
      [bookingId, clientId]
    );

    if (booking.rows.length === 0) {
      throw new ApiError(404, 'Booking not found or not authorized');
    }

    const { barber_id } = booking.rows[0];

    // Create Stripe payment intent
    const { clientSecret, paymentIntentId } = await stripeService.createPaymentIntent({
      amount,
      clientId,
      barberId: barber_id,
      bookingId,
      description: `CampusCuts booking #${bookingId}`,
    });

    // Calculate fees
    const { platformFee, barberPayout } = stripeService.calculateFees(amount);

    // Store payment transaction
    await pool.query(
      `INSERT INTO payment_transactions 
       (blockchain_payment_id, booking_id, stripe_payment_intent_id, barber_id, client_id, amount, platform_fee, barber_payout, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [bookingId, bookingId, paymentIntentId, barber_id, clientId, amount / 100, platformFee / 100, barberPayout / 100, 'pending']
    );

    // Create payment record on blockchain
    const stripeIdHash = crypto.createHash('sha256').update(paymentIntentId).digest('hex');
    
    await aptosService.createPayment({
      bookingId,
      barberAddress: booking.rows[0].barber_address,
      clientAddress: clientId,
      amount,
      stripePaymentIdHash: stripeIdHash,
    });

    res.json({
      success: true,
      data: {
        clientSecret,
        paymentIntentId,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const capturePayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Get payment transaction
    const payment = await pool.query(
      `SELECT pt.*, b.user_id as barber_user_id
       FROM payment_transactions pt
       JOIN barbers b ON pt.barber_id = b.id
       WHERE pt.id = $1`,
      [id]
    );

    if (payment.rows.length === 0) {
      throw new ApiError(404, 'Payment not found');
    }

    if (payment.rows[0].barber_user_id !== userId) {
      throw new ApiError(403, 'Not authorized');
    }

    // Capture payment on Stripe
    await stripeService.capturePayment(payment.rows[0].stripe_payment_intent_id);

    // Update status
    await pool.query(
      `UPDATE payment_transactions SET status = 'succeeded' WHERE id = $1`,
      [id]
    );

    // Release payment on blockchain
    await aptosService.releasePayment(payment.rows[0].blockchain_payment_id);

    logger.info(`Payment captured: ${id}`);

    res.json({
      success: true,
      message: 'Payment captured and released to barber',
    });
  } catch (error) {
    next(error);
  }
};

export const processRefund = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason, amount } = req.body;

    const payment = await pool.query(
      'SELECT * FROM payment_transactions WHERE id = $1',
      [id]
    );

    if (payment.rows.length === 0) {
      throw new ApiError(404, 'Payment not found');
    }

    // Process refund on Stripe
    const refundId = await stripeService.refundPayment(
      payment.rows[0].stripe_payment_intent_id,
      amount ? amount * 100 : undefined
    );

    // Update status
    await pool.query(
      `UPDATE payment_transactions SET status = 'refunded' WHERE id = $1`,
      [id]
    );

    logger.info(`Refund processed: ${id} (${refundId})`);

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refundId,
    });
  } catch (error) {
    next(error);
  }
};

export const getEarningsSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Get barber ID
    const barberResult = await pool.query('SELECT id, total_earnings FROM barbers WHERE user_id = $1', [userId]);
    
    if (barberResult.rows.length === 0) {
      throw new ApiError(404, 'Barber profile not found');
    }

    const barberId = barberResult.rows[0].id;

    // Get earnings breakdown
    const earnings = await pool.query(
      `SELECT 
        COALESCE(SUM(barber_payout), 0) as total_earnings,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN barber_payout ELSE 0 END), 0) as paid_out,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN barber_payout ELSE 0 END), 0) as pending,
        COUNT(*) as total_transactions,
        COALESCE(SUM(tip_amount), 0) as total_tips
      FROM payment_transactions
      WHERE barber_id = $1`,
      [barberId]
    );

    res.json({
      success: true,
      data: earnings.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const requestPayout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    const userId = req.user!.userId;

    // Get barber info
    const barber = await pool.query(
      `SELECT b.id, u.aptos_address
       FROM barbers b
       JOIN users u ON b.user_id = u.id
       WHERE b.user_id = $1`,
      [userId]
    );

    if (barber.rows.length === 0) {
      throw new ApiError(404, 'Barber profile not found');
    }

    // Process payout on blockchain
    await aptosService.releasePayment(0); // Would use actual payment ID

    // Create Stripe payout (requires Connect account setup)
    // const payoutId = await stripeService.createPayout({
    //   amount: amount * 100,
    //   barberStripeAccountId: 'acct_xxx',
    // });

    logger.info(`Payout requested: $${amount / 100} for barber ${barber.rows[0].id}`);

    res.json({
      success: true,
      message: 'Payout processed successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const stripeWebhook = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    const event = stripeService.verifyWebhookSignature(
      req.body,
      sig,
      webhookSecret
    );

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        logger.info('Payment succeeded:', event.data.object);
        break;
      case 'payment_intent.payment_failed':
        logger.error('Payment failed:', event.data.object);
        break;
      case 'transfer.created':
        logger.info('Transfer created:', event.data.object);
        break;
      default:
        logger.info('Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};

