/**
 * Booking Service V2
 * 
 * Escrow-based booking flow
 */

import api from './api.service';

export interface BookingV2 {
  id: string;
  consumer_id: string;
  barber_id: string;
  service_id?: string;
  price_cents: number;
  tip_cents?: number;
  requested_slot: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'disputed';
  created_at: string;
  completed_at?: string;
  cancelled_at?: string;
  // Joined data
  consumer_first_name?: string;
  consumer_last_name?: string;
  barber_first_name?: string;
  barber_last_name?: string;
  escrow_status?: 'held' | 'released' | 'refunded' | 'expired';
  escrow_amount?: number;
  escrow_expires_at?: string;
}

export interface EscrowDetails {
  id: string;
  status: 'held' | 'released' | 'refunded' | 'expired';
  amount_cents: number;
  expires_hours: number;
}

export interface CreateBookingResponse {
  booking: BookingV2;
  escrow: EscrowDetails;
}

export interface CompleteBookingResponse {
  booking_id: string;
  status: string;
  net_to_barber_dollars: number;
  platform_fee_dollars: number;
  tip_dollars: number;
}

export interface CancelBookingResponse {
  booking_id: string;
  status: string;
  refund_amount_dollars: number;
}

class BookingV2Service {
  /**
   * Create booking (creates escrow hold)
   */
  async createBooking(params: {
    barberId: string;
    serviceId?: string;
    priceCents: number;
    requestedSlot: string;
    locationDetails?: string;
    specialRequests?: string;
  }): Promise<CreateBookingResponse> {
    const response = await api.post('/v2/bookings', params);
    return response.data;
  }

  /**
   * Get bookings for current user
   */
  async getBookings(status?: string): Promise<BookingV2[]> {
    const response = await api.get('/v2/bookings', {
      params: status ? { status } : {},
    });
    return response.data;
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string): Promise<BookingV2> {
    const response = await api.get(`/v2/bookings/${bookingId}`);
    return response.data;
  }

  /**
   * Complete booking (release escrow to barber)
   */
  async completeBooking(
    bookingId: string,
    tipCents?: number
  ): Promise<CompleteBookingResponse> {
    const response = await api.post(`/v2/bookings/${bookingId}/complete`, {
      tipCents,
    });
    return response.data;
  }

  /**
   * Cancel booking (refund escrow to consumer)
   */
  async cancelBooking(
    bookingId: string,
    reason: string
  ): Promise<CancelBookingResponse> {
    const response = await api.post(`/v2/bookings/${bookingId}/cancel`, {
      reason,
    });
    return response.data;
  }
}

export default new BookingV2Service();

