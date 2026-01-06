/**
 * Secure Stripe Webhook Controller
 * 
 * Best practices implementation:
 * 1. Signature verification
 * 2. Idempotency protection (prevents duplicate processing)
 * 3. Post-webhook verification (re-check with Stripe API)
 * 4. Atomic database transactions
 * 5. Proper error handling
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { pool, query } from '../database/connection';
import { logger } from '../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * Check if event was already processed (idempotency)
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM stripe_webhook_events WHERE event_id = $1',
    [eventId]
  );
  return result.rows.length > 0;
}

/**
 * Mark event as processed
 */
async function markEventProcessed(
  eventId: string,
  eventType: string,
  payload: any,
  result: 'success' | 'failed' = 'success'
): Promise<void> {
  await query(
    `INSERT INTO stripe_webhook_events (event_id, event_type, payload, processing_result)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType, JSON.stringify(payload), result]
  );
}

/**
 * Post-webhook verification: Re-fetch PaymentIntent from Stripe
 * This is an extra safety check to ensure the payment is truly complete
 */
async function verifyPaymentIntentWithStripe(paymentIntentId: string): Promise<{
  verified: boolean;
  status: string;
  amountReceived: number;
  metadata: Record<string, string>;
}> {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      verified: paymentIntent.status === 'succeeded',
      status: paymentIntent.status,
      amountReceived: paymentIntent.amount_received,
      metadata: paymentIntent.metadata as Record<string, string>,
    };
  } catch (error: any) {
    logger.error(`Failed to verify PaymentIntent with Stripe: ${error.message}`);
    return {
      verified: false,
      status: 'error',
      amountReceived: 0,
      metadata: {},
    };
  }
}

/**
 * Main Webhook Handler
 */
export const handleStripeWebhookSecure = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  // 1. Verify signature
  if (!sig) {
    logger.error('Stripe webhook: Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  if (!WEBHOOK_SECRET) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    logger.info(`✅ Stripe webhook verified: ${event.type} (${event.id})`);
  } catch (err: any) {
    logger.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Invalid signature: ${err.message}` });
  }

  // 2. Idempotency check - prevent duplicate processing
  try {
    const alreadyProcessed = await isEventProcessed(event.id);
    if (alreadyProcessed) {
      logger.info(`⏭️ Event ${event.id} already processed, skipping`);
      return res.json({ received: true, skipped: true, reason: 'already_processed' });
    }
  } catch (err: any) {
    logger.error(`Failed to check idempotency: ${err.message}`);
    // Continue processing - better to potentially duplicate than to miss
  }

  // 3. Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, event.id);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, event.id);
        break;

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer, event.id);
        break;

      case 'transfer.updated':
        const transfer = event.data.object as Stripe.Transfer;
        if ((transfer as any).status === 'failed') {
          await handleTransferFailed(transfer, event.id);
        }
        break;

      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account, event.id);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
        await markEventProcessed(event.id, event.type, event.data.object, 'success');
    }

    res.json({ received: true, eventId: event.id });
  } catch (error: any) {
    logger.error(`Error handling webhook: ${error.message}`, { 
      eventId: event.id, 
      eventType: event.type 
    });
    
    // Mark as failed but still return 200 to prevent infinite retries
    await markEventProcessed(event.id, event.type, event.data.object, 'failed');
    
    res.status(200).json({ 
      received: true, 
      error: 'Processing error logged',
      eventId: event.id 
    });
  }
};

/**
 * Handle payment_intent.succeeded
 * This is the ONLY place where payment should be marked as complete
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  eventId: string
) {
  const { booking_id, consumer_id, barber_id, tip_amount_cents } = paymentIntent.metadata;
  const amountCents = paymentIntent.amount_received;

  logger.info(`💰 Processing payment success: ${paymentIntent.id}`, {
    bookingId: booking_id,
    amount: `$${amountCents / 100}`,
    consumerId: consumer_id,
    barberId: barber_id,
  });

  if (!booking_id) {
    logger.warn(`No booking_id in PaymentIntent metadata: ${paymentIntent.id}`);
    await markEventProcessed(eventId, 'payment_intent.succeeded', paymentIntent.metadata, 'success');
    return;
  }

  // POST-WEBHOOK VERIFICATION: Re-check with Stripe API
  const verification = await verifyPaymentIntentWithStripe(paymentIntent.id);
  
  if (!verification.verified) {
    logger.error(`❌ Post-webhook verification failed for ${paymentIntent.id}`, {
      status: verification.status,
    });
    await markEventProcessed(eventId, 'payment_intent.succeeded', paymentIntent.metadata, 'failed');
    return;
  }

  // Verify amount matches
  if (verification.amountReceived !== amountCents) {
    logger.error(`❌ Amount mismatch: expected ${amountCents}, got ${verification.amountReceived}`);
    await markEventProcessed(eventId, 'payment_intent.succeeded', paymentIntent.metadata, 'failed');
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Update booking to PAID status
    const updateBookingResult = await client.query(
      `UPDATE bookings 
       SET status = 'PAID',
           payment_intent_id = $1,
           paid_at = NOW(),
           tip_amount_cents = $2,
           "updatedAt" = NOW()
       WHERE id = $3
       RETURNING *`,
      [paymentIntent.id, parseInt(tip_amount_cents || '0'), booking_id]
    );

    if (updateBookingResult.rowCount === 0) {
      throw new Error(`Booking ${booking_id} not found`);
    }

    const booking = updateBookingResult.rows[0];
    logger.info(`✅ Booking ${booking_id} marked as PAID`);

    // 2. Create payment record for audit trail
    await client.query(
      `INSERT INTO payments (
        booking_id, 
        consumer_id, 
        barber_id,
        payment_intent_id,
        amount_cents,
        tip_amount_cents,
        currency,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (payment_intent_id) DO NOTHING`,
      [
        booking_id,
        consumer_id || booking.consumerId,
        barber_id || booking.barberId,
        paymentIntent.id,
        amountCents,
        parseInt(tip_amount_cents || '0'),
        paymentIntent.currency.toUpperCase(),
        'succeeded'
      ]
    );

    // 3. TODO: Trigger payout to barber via Stripe Connect
    // await initiateBarberPayout(booking, amountCents);

    // 4. Mark webhook event as processed
    await client.query(
      `INSERT INTO stripe_webhook_events (event_id, event_type, payload, processing_result)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, 'payment_intent.succeeded', JSON.stringify(paymentIntent.metadata), 'success']
    );

    await client.query('COMMIT');
    logger.info(`✅ Payment processing complete for booking ${booking_id}`);

  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error(`❌ Failed to process payment for booking ${booking_id}: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Handle payment_intent.payment_failed
 */
async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  eventId: string
) {
  const { booking_id } = paymentIntent.metadata;

  logger.error(`❌ Payment failed: ${paymentIntent.id}`, {
    bookingId: booking_id,
    reason: paymentIntent.last_payment_error?.message,
  });

  if (booking_id) {
    await query(
      `UPDATE bookings 
       SET status = 'PAYMENT_FAILED', "updatedAt" = NOW()
       WHERE id = $1`,
      [booking_id]
    );
  }

  await markEventProcessed(eventId, 'payment_intent.payment_failed', paymentIntent.metadata, 'success');
}

/**
 * Handle transfer.created (barber payout)
 */
async function handleTransferCreated(transfer: Stripe.Transfer, eventId: string) {
  logger.info(`💸 Transfer created: ${transfer.id} - $${transfer.amount / 100}`);
  await markEventProcessed(eventId, 'transfer.created', transfer.metadata || {}, 'success');
}

/**
 * Handle transfer.updated with failed status
 */
async function handleTransferFailed(transfer: Stripe.Transfer, eventId: string) {
  logger.error(`❌ Transfer failed: ${transfer.id}`);
  await markEventProcessed(eventId, 'transfer.updated', transfer.metadata || {}, 'success');
}

/**
 * Handle account.updated (Stripe Connect onboarding)
 */
async function handleAccountUpdated(account: Stripe.Account, eventId: string) {
  const isOnboarded = account.charges_enabled && account.payouts_enabled;
  
  logger.info(`Account updated: ${account.id}`, {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  });

  if (account.metadata?.userId) {
    await query(
      `UPDATE users 
       SET stripe_connect_onboarded = $1, "updatedAt" = NOW()
       WHERE id = $2`,
      [isOnboarded, account.metadata.userId]
    );
  }

  await markEventProcessed(eventId, 'account.updated', account.metadata || {}, 'success');
}

