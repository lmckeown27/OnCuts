/**
 * Stripe Webhook Controller
 * 
 * Handles Stripe webhook events
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { logger } from '../utils/logger';
import mockDatabase from '../services/mock.database.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2023-10-16',
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    if (WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } else {
      // For development without webhook secret
      event = req.body as Stripe.Event;
      logger.warn('Stripe webhook secret not configured - skipping signature verification');
    }
  } catch (err: any) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      case 'transfer.failed':
        await handleTransferFailed(event.data.object as Stripe.Transfer);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error(`Error handling webhook event: ${error.message}`);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

/**
 * Handle successful payment
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  logger.info(`Payment succeeded: ${paymentIntent.id}`);

  const { bookingId, studentId, barberId } = paymentIntent.metadata;

  if (!bookingId) {
    logger.warn('No booking ID in payment intent metadata');
    return;
  }

  try {
    // Update booking status
    // In production: update database
    logger.info(`Booking ${bookingId} payment confirmed - Amount: $${paymentIntent.amount / 100}`);

    // TODO: Trigger blockchain escrow lock
    // await aptosService.lockFundsInEscrow(bookingId, paymentIntent.amount / 100);

    // TODO: Send confirmation email/notification
    // await emailService.sendBookingConfirmation(studentId, bookingId);

  } catch (error: any) {
    logger.error(`Error processing payment success: ${error.message}`);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  logger.error(`Payment failed: ${paymentIntent.id}`);

  const { bookingId, studentId } = paymentIntent.metadata;

  if (!bookingId) return;

  try {
    // Update booking status to failed
    logger.info(`Booking ${bookingId} payment failed`);

    // TODO: Send failure notification
    // await emailService.sendPaymentFailedNotification(studentId, bookingId);

  } catch (error: any) {
    logger.error(`Error processing payment failure: ${error.message}`);
  }
}

/**
 * Handle canceled payment
 */
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  logger.info(`Payment canceled: ${paymentIntent.id}`);

  const { bookingId } = paymentIntent.metadata;

  if (!bookingId) return;

  try {
    // Update booking status to canceled
    logger.info(`Booking ${bookingId} payment canceled`);

  } catch (error: any) {
    logger.error(`Error processing payment cancellation: ${error.message}`);
  }
}

/**
 * Handle refund
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  logger.info(`Charge refunded: ${charge.id} - Amount: $${charge.amount_refunded / 100}`);

  try {
    // Update booking status
    // Release funds from escrow back to student
    // TODO: Blockchain refund logic

  } catch (error: any) {
    logger.error(`Error processing refund: ${error.message}`);
  }
}

/**
 * Handle Connect account update
 */
async function handleAccountUpdated(account: Stripe.Account) {
  logger.info(`Connect account updated: ${account.id}`);

  const { userId } = account.metadata || {};

  if (!userId) return;

  try {
    const isOnboarded = account.charges_enabled && account.payouts_enabled;

    if (isOnboarded) {
      logger.info(`Barber ${userId} fully onboarded to Stripe Connect`);
      // TODO: Update database
      // await mockDatabase.updateUser(userId, { stripe_connect_onboarded: true });
    }

  } catch (error: any) {
    logger.error(`Error processing account update: ${error.message}`);
  }
}

/**
 * Handle transfer created
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  logger.info(`Transfer created: ${transfer.id} - Amount: $${transfer.amount / 100}`);

  try {
    // Log payout to barber
    const { bookingId } = transfer.metadata || {};
    if (bookingId) {
      logger.info(`Payout completed for booking: ${bookingId}`);
    }

  } catch (error: any) {
    logger.error(`Error processing transfer: ${error.message}`);
  }
}

/**
 * Handle transfer failed
 */
async function handleTransferFailed(transfer: Stripe.Transfer) {
  logger.error(`Transfer failed: ${transfer.id}`);

  try {
    // Notify barber of failed payout
    // TODO: Send notification

  } catch (error: any) {
    logger.error(`Error processing transfer failure: ${error.message}`);
  }
}

