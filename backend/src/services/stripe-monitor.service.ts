/**
 * Stripe Payment Monitor Service
 * 
 * Captures and broadcasts real-time Stripe payment events
 * Stores payment events for audit trail
 * Broadcasts to admin dashboard via WebSocket
 */

import { logger } from '../utils/logger';
import { pool } from '../database/connection';
import { io } from '../index'; // Socket.IO instance
import Stripe from 'stripe';

interface ParsedStripeEvent {
  event_id: string;
  event_type: string;
  payment_intent_id?: string;
  customer_id?: string;
  amount_cents?: number;
  amount_usd?: number;
  status: string;
  timestamp: Date;
  description: string;
  metadata: any;
  student_email?: string;
  barber_email?: string;
  booking_id?: string;
}

class StripeMonitorService {
  /**
   * Process and broadcast a Stripe webhook event
   */
  async processEvent(event: Stripe.Event) {
    try {
      const parsed = await this.parseEvent(event);

      if (!parsed) {
        return; // Not a relevant event
      }

      // Store in database
      await this.storeEvent(parsed, event);

      // Broadcast to admin dashboard
      this.broadcastEvent(parsed);

      logger.info(`✅ Processed Stripe event: ${event.type} (${event.id})`);
    } catch (error) {
      logger.error(`Failed to process Stripe event ${event.id}:`, error);
    }
  }

  /**
   * Parse Stripe event to extract relevant data
   */
  private async parseEvent(event: Stripe.Event): Promise<ParsedStripeEvent | null> {
    const parsed: ParsedStripeEvent = {
      event_id: event.id,
      event_type: event.type,
      status: 'unknown',
      timestamp: new Date(event.created * 1000),
      description: '',
      metadata: {},
    };

    switch (event.type) {
      // Payment Intent Created
      case 'payment_intent.created': {
        const pi = event.data.object as Stripe.PaymentIntent;
        parsed.payment_intent_id = pi.id;
        parsed.customer_id = pi.customer as string;
        parsed.amount_cents = pi.amount;
        parsed.amount_usd = pi.amount / 100;
        parsed.status = pi.status;
        parsed.description = `Payment created: $${(pi.amount / 100).toFixed(2)}`;
        parsed.metadata = pi.metadata;
        parsed.booking_id = pi.metadata.bookingId;
        
        // Fetch student and barber emails from metadata
        if (pi.metadata.studentEmail) parsed.student_email = pi.metadata.studentEmail;
        if (pi.metadata.barberEmail) parsed.barber_email = pi.metadata.barberEmail;
        break;
      }

      // Payment Succeeded
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        parsed.payment_intent_id = pi.id;
        parsed.customer_id = pi.customer as string;
        parsed.amount_cents = pi.amount;
        parsed.amount_usd = pi.amount / 100;
        parsed.status = 'succeeded';
        parsed.description = `Payment succeeded: $${(pi.amount / 100).toFixed(2)}`;
        parsed.metadata = pi.metadata;
        parsed.booking_id = pi.metadata.bookingId;
        
        if (pi.metadata.studentEmail) parsed.student_email = pi.metadata.studentEmail;
        if (pi.metadata.barberEmail) parsed.barber_email = pi.metadata.barberEmail;
        break;
      }

      // Payment Failed
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        parsed.payment_intent_id = pi.id;
        parsed.customer_id = pi.customer as string;
        parsed.amount_cents = pi.amount;
        parsed.amount_usd = pi.amount / 100;
        parsed.status = 'failed';
        parsed.description = `Payment failed: $${(pi.amount / 100).toFixed(2)}`;
        parsed.metadata = pi.metadata;
        parsed.booking_id = pi.metadata.bookingId;
        break;
      }

      // Charge Refunded
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        parsed.payment_intent_id = charge.payment_intent as string;
        parsed.customer_id = charge.customer as string;
        parsed.amount_cents = charge.amount_refunded;
        parsed.amount_usd = charge.amount_refunded / 100;
        parsed.status = 'refunded';
        parsed.description = `Refund issued: $${(charge.amount_refunded / 100).toFixed(2)}`;
        parsed.metadata = charge.metadata;
        break;
      }

      // Transfer to Barber (Connect)
      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        parsed.amount_cents = transfer.amount;
        parsed.amount_usd = transfer.amount / 100;
        parsed.status = 'created';
        parsed.description = `Transfer to barber: $${(transfer.amount / 100).toFixed(2)}`;
        parsed.metadata = transfer.metadata;
        parsed.booking_id = transfer.metadata.bookingId;
        parsed.barber_email = transfer.metadata.barberEmail;
        break;
      }

      // Transfer Paid (Note: 'transfer.paid' is not a valid Stripe event type)
      // Use 'transfer.created' instead for transfer events
      // case 'transfer.paid': {
      //   const transfer = event.data.object as Stripe.Transfer;
      //   parsed.amount_cents = transfer.amount;
      //   parsed.amount_usd = transfer.amount / 100;
      //   parsed.status = 'paid';
      //   parsed.description = `Transfer paid to barber: $${(transfer.amount / 100).toFixed(2)}`;
      //   parsed.metadata = transfer.metadata;
      //   parsed.booking_id = transfer.metadata.bookingId;
      //   parsed.barber_email = transfer.metadata.barberEmail;
      //   break;
      // }

      // Payout Created
      case 'payout.created': {
        const payout = event.data.object as Stripe.Payout;
        parsed.amount_cents = payout.amount;
        parsed.amount_usd = payout.amount / 100;
        parsed.status = payout.status;
        parsed.description = `Payout created: $${(payout.amount / 100).toFixed(2)}`;
        parsed.metadata = payout.metadata || {};
        break;
      }

      // Payout Paid
      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        parsed.amount_cents = payout.amount;
        parsed.amount_usd = payout.amount / 100;
        parsed.status = 'paid';
        parsed.description = `Payout completed: $${(payout.amount / 100).toFixed(2)}`;
        parsed.metadata = payout.metadata || {};
        break;
      }

      // Payout Failed
      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        parsed.amount_cents = payout.amount;
        parsed.amount_usd = payout.amount / 100;
        parsed.status = 'failed';
        parsed.description = `Payout failed: $${(payout.amount / 100).toFixed(2)}`;
        parsed.metadata = payout.metadata || {};
        break;
      }

      default:
        // Not a relevant event
        return null;
    }

    return parsed;
  }

  /**
   * Store Stripe event in database
   */
  private async storeEvent(parsed: ParsedStripeEvent, raw: Stripe.Event) {
    try {
      await pool.query(
        `INSERT INTO stripe_events (
          event_id, event_type, payment_intent_id, customer_id, 
          amount_cents, amount_usd, status, timestamp, 
          description, metadata, student_email, barber_email, 
          booking_id, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (event_id) DO NOTHING`,
        [
          parsed.event_id,
          parsed.event_type,
          parsed.payment_intent_id || null,
          parsed.customer_id || null,
          parsed.amount_cents || null,
          parsed.amount_usd || null,
          parsed.status,
          parsed.timestamp,
          parsed.description,
          JSON.stringify(parsed.metadata),
          parsed.student_email || null,
          parsed.barber_email || null,
          parsed.booking_id || null,
          JSON.stringify(raw),
        ]
      );
    } catch (error) {
      logger.error('Failed to store Stripe event:', error);
    }
  }

  /**
   * Broadcast event to admin dashboard via WebSocket
   */
  private broadcastEvent(parsed: ParsedStripeEvent) {
    try {
      io.to('admin-live-feed').emit('stripe-payment', {
        ...parsed,
        platform: 'stripe',
      });

      logger.debug(`📡 Broadcasted Stripe event to admin dashboard`);
    } catch (error) {
      logger.error('Failed to broadcast Stripe event:', error);
    }
  }

  /**
   * Get recent Stripe events for initial load
   */
  async getRecentEvents(limit: number = 50) {
    try {
      const result = await pool.query(
        `SELECT * FROM stripe_events 
         ORDER BY timestamp DESC 
         LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch recent Stripe events:', error);
      return [];
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_type = 'payment_intent.succeeded') as successful_payments,
          COUNT(*) FILTER (WHERE event_type = 'payment_intent.payment_failed') as failed_payments,
          COUNT(*) FILTER (WHERE event_type = 'charge.refunded') as refunds,
          COALESCE(SUM(amount_usd) FILTER (WHERE event_type = 'payment_intent.succeeded'), 0) as total_revenue,
          COALESCE(SUM(amount_usd) FILTER (WHERE event_type = 'charge.refunded'), 0) as total_refunded
        FROM stripe_events
        WHERE timestamp >= NOW() - INTERVAL '30 days'
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to fetch payment stats:', error);
      return null;
    }
  }
}

// Singleton instance
const stripeMonitorService = new StripeMonitorService();

export default stripeMonitorService;

