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

// Platform fee percentage (15% to platform, 85% to barber)
const PLATFORM_FEE_PERCENTAGE = 0.15;

/**
 * Archive messages for a booking before deletion
 * This preserves message history for admin viewing
 */
async function archiveBookingMessages(bookingId: string, client: any): Promise<void> {
  try {
    await client.query(`
      INSERT INTO archived_booking_messages (
        booking_id, original_message_id, original_conversation_id,
        sender_id, sender_first_name, sender_last_name, sender_avatar, sender_role,
        content, message_type, created_at
      )
      SELECT 
        c.booking_id,
        m.id,
        m.conversation_id,
        m.sender_id,
        u.first_name,
        u.last_name,
        u."avatarUrl",
        u.role,
        m.content,
        m.message_type,
        m.created_at
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN users u ON m.sender_id = u.id
      WHERE c.booking_id = $1
    `, [bookingId]);
    logger.info(`Archived messages for booking ${bookingId}`);
  } catch (error: any) {
    logger.warn(`Could not archive messages for booking ${bookingId}: ${error.message}`);
  }
}

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
 * Initiate barber payout via Stripe Connect
 * Transfers 85% of payment (plus 100% of tip) to barber's connected account
 * 
 * NOTE: If destination charges were used (transfer_data.destination in payment intent),
 * Stripe automatically handles the split and this function will skip the manual transfer.
 */
async function initiateBarberPayout(
  client: any,
  booking: any,
  totalAmountCents: number,
  tipAmountCents: number,
  paymentIntentId: string
): Promise<void> {
  try {
    // First, check if this payment used destination charges (automatic split)
    // If so, the transfer already happened automatically and we shouldn't do it again
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.transfer_data?.destination) {
      // Destination charges were used - Stripe already transferred funds to barber
      logger.info(`✅ Destination charges used for booking ${booking.id} - automatic split to ${paymentIntent.transfer_data.destination}, skipping manual transfer`);
      
      // Still record the payout info for our records
      const serviceAmountCents = totalAmountCents - tipAmountCents;
      const platformFeeCents = paymentIntent.application_fee_amount || Math.round(serviceAmountCents * PLATFORM_FEE_PERCENTAGE);
      const barberEarnings = totalAmountCents - platformFeeCents;
      
      await client.query(
        `UPDATE payments 
         SET platform_fee_cents = $1,
             barber_earnings_cents = $2,
             transfer_status = 'completed',
             transferred_at = NOW()
         WHERE payment_intent_id = $3`,
        [platformFeeCents, barberEarnings, paymentIntentId]
      );
      
      return;
    }

    // Get barber's Stripe Connect account ID for manual transfer
    const barberResult = await client.query(
      `SELECT u.stripe_account_id, u.first_name, u.last_name, u.email
       FROM users u
       JOIN barbers b ON b."userId" = u.id
       WHERE b.id = $1`,
      [booking.barberId]
    );

    if (barberResult.rows.length === 0) {
      logger.warn(`No barber found for booking ${booking.id}`);
      return;
    }

    const barber = barberResult.rows[0];
    const stripeAccountId = barber.stripe_account_id;

    if (!stripeAccountId) {
      logger.warn(`Barber ${barber.email} has not connected Stripe account - payout skipped for booking ${booking.id}`);
      // Store the pending payout for later when barber connects their account
      await client.query(
        `INSERT INTO pending_payouts (booking_id, barber_id, amount_cents, tip_cents, payment_intent_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
         ON CONFLICT (booking_id) DO NOTHING`,
        [booking.id, booking.barberId, totalAmountCents, tipAmountCents, paymentIntentId]
      );
      logger.info(`Created pending payout record for booking ${booking.id}`);
      return;
    }

    // Calculate barber's earnings: 85% of service + 100% of tip
    const serviceAmountCents = totalAmountCents - tipAmountCents;
    const platformFeeCents = Math.round(serviceAmountCents * PLATFORM_FEE_PERCENTAGE);
    const barberServiceEarnings = serviceAmountCents - platformFeeCents;
    const barberTotalEarnings = barberServiceEarnings + tipAmountCents;

    if (barberTotalEarnings <= 0) {
      logger.warn(`Barber earnings are $0 or negative for booking ${booking.id} - skipping payout`);
      return;
    }

    // Create transfer to barber's connected account
    const transfer = await stripe.transfers.create({
      amount: barberTotalEarnings,
      currency: 'usd',
      destination: stripeAccountId,
      transfer_group: `booking_${booking.id}`,
      metadata: {
        booking_id: booking.id.toString(),
        payment_intent_id: paymentIntentId,
        service_amount_cents: serviceAmountCents.toString(),
        tip_amount_cents: tipAmountCents.toString(),
        platform_fee_cents: platformFeeCents.toString(),
        barber_email: barber.email,
      },
    });

    logger.info(`💸 Transfer created: ${transfer.id} - $${barberTotalEarnings / 100} to ${barber.email}`);

    // Update payment record with transfer info
    await client.query(
      `UPDATE payments 
       SET stripe_transfer_id = $1,
           platform_fee_cents = $2,
           barber_earnings_cents = $3,
           transfer_status = 'completed',
           transferred_at = NOW()
       WHERE payment_intent_id = $4`,
      [transfer.id, platformFeeCents, barberTotalEarnings, paymentIntentId]
    );

    logger.info(`✅ Barber payout complete for booking ${booking.id}: $${barberTotalEarnings / 100} (service: $${barberServiceEarnings / 100}, tip: $${tipAmountCents / 100})`);

  } catch (error: any) {
    // Log error but don't fail the entire transaction - we can retry payouts
    logger.error(`❌ Failed to create barber payout for booking ${booking.id}: ${error.message}`);
    
    // Store failed payout for retry
    try {
      await client.query(
        `INSERT INTO pending_payouts (booking_id, barber_id, amount_cents, tip_cents, payment_intent_id, status, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, 'failed', $6, NOW())
         ON CONFLICT (booking_id) DO UPDATE SET status = 'failed', error_message = $6, updated_at = NOW()`,
        [booking.id, booking.barberId, totalAmountCents, tipAmountCents, paymentIntentId, error.message]
      );
    } catch (insertError: any) {
      logger.error(`Failed to record pending payout: ${insertError.message}`);
    }
  }
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

    // 1. Update booking to COMPLETED status (with payment info)
    const updateBookingResult = await client.query(
      `UPDATE bookings 
       SET status = 'COMPLETED',
           payment_intent_id = $1,
           paid_at = NOW(),
           "paidAt" = NOW(),
           tip_amount_cents = $2,
           "tipAmountCents" = $2,
           "totalPaidCents" = $3,
           "updatedAt" = NOW()
       WHERE id = $4
       RETURNING *`,
      [paymentIntent.id, parseInt(tip_amount_cents || '0'), amountCents, booking_id]
    );

    if (updateBookingResult.rowCount === 0) {
      throw new Error(`Booking ${booking_id} not found`);
    }

    const booking = updateBookingResult.rows[0];
    logger.info(`✅ Booking ${booking_id} marked as COMPLETED (paid)`);

    // Archive messages for admin viewing, then delete the conversation
    try {
      await archiveBookingMessages(booking_id, client);
      await client.query(
        `DELETE FROM messages 
         WHERE conversation_id IN (SELECT id FROM conversations WHERE booking_id = $1)`,
        [booking_id]
      );
      await client.query(
        `DELETE FROM conversations WHERE booking_id = $1`,
        [booking_id]
      );
      logger.info(`Archived and deleted conversation for paid booking ${booking_id}`);
    } catch (convError: any) {
      // Conversation may already be deleted - that's fine
      logger.debug(`No conversation to delete for booking ${booking_id}`);
    }

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

    // 3. Trigger payout to barber via Stripe Connect
    const tipAmountCents = parseInt(tip_amount_cents || '0');
    await initiateBarberPayout(client, booking, amountCents, tipAmountCents, paymentIntent.id);

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

