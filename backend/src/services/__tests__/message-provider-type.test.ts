/**
 * Messaging API — provider type on conversation booking payloads.
 */

import {
  bookingProviderTypeFields,
  formatInboxConversation,
  resolveMessagingProviderType,
} from '../message.service';

describe('resolveMessagingProviderType', () => {
  it('returns "barber" for a barber provider', () => {
    expect(resolveMessagingProviderType('barber')).toBe('barber');
  });

  it('returns "beauty" for a beauty provider', () => {
    expect(resolveMessagingProviderType('beauty')).toBe('beauty');
  });

  it('returns "barber" when provider_type is null or missing', () => {
    expect(resolveMessagingProviderType(null)).toBe('barber');
    expect(resolveMessagingProviderType(undefined)).toBe('barber');
  });
});

describe('bookingProviderTypeFields', () => {
  it('includes both compatibility keys', () => {
    expect(bookingProviderTypeFields('beauty')).toEqual({
      providerType: 'beauty',
      provider_type: 'beauty',
    });
    expect(bookingProviderTypeFields(null)).toEqual({
      providerType: 'barber',
      provider_type: 'barber',
    });
  });
});

describe('formatInboxConversation (conversation-list booking)', () => {
  const baseRow = {
    conversation_id: 1,
    booking_id: 'booking-1',
    conversation_created: new Date().toISOString(),
    last_message_at: null,
    other_user_id: 'user-2',
    other_user_first_name: 'Ada',
    other_user_last_name: 'Lovelace',
    other_user_profile_picture: null,
    other_user_type: 'BARBER',
    barber_id: 'barber-1',
    barber_display_name: 'Ada Lovelace',
    barber_specialties: null,
    barber_rating: null,
    conv_service_name: 'Haircut',
    conv_service_price: '30',
    conv_scheduled_time: null,
    conv_location: 'Campus',
    conv_notes: null,
    conv_booking_status: 'pending',
    conv_barber_name: 'Ada Lovelace',
    conv_consumer_name: 'Client',
    booking_id_ref: 'booking-1',
    booking_barber_id: 'barber-1',
    booking_service_type: 'Haircut',
    booking_price_cents: 3000,
    booking_scheduled_time: null,
    linked_booking_status: 'PENDING',
    last_message: null,
    last_message_sender_id: null,
    last_message_time: null,
    unread_count: 0,
  };

  it('includes providerType/provider_type "barber" for barber providers', () => {
    const conv = formatInboxConversation({
      ...baseRow,
      barber_provider_type: 'barber',
    });
    expect(conv.booking).toMatchObject({
      providerType: 'barber',
      provider_type: 'barber',
    });
  });

  it('includes providerType/provider_type "beauty" for beauty providers', () => {
    const conv = formatInboxConversation({
      ...baseRow,
      barber_provider_type: 'beauty',
    });
    expect(conv.booking).toMatchObject({
      providerType: 'beauty',
      provider_type: 'beauty',
    });
  });

  it('defaults missing provider_type to "barber"', () => {
    const conv = formatInboxConversation({
      ...baseRow,
      barber_provider_type: null,
    });
    expect(conv.booking).toMatchObject({
      providerType: 'barber',
      provider_type: 'barber',
    });
  });
});

describe('thread endpoint booking provider fields', () => {
  /** Same shape as getConversationMessages booking object construction. */
  function formatThreadBooking(row: {
    conv_service_name?: string | null;
    booking_id_ref?: string | null;
    booking_barber_id?: string | null;
    barber_provider_type?: string | null;
  }) {
    if (!(row.conv_service_name || row.booking_id_ref)) return null;
    return {
      id: row.booking_id_ref || null,
      barberId: row.booking_barber_id || null,
      ...bookingProviderTypeFields(row.barber_provider_type),
    };
  }

  it('includes both fields for barber, beauty, and null on the thread booking', () => {
    expect(formatThreadBooking({ booking_id_ref: 'b1', barber_provider_type: 'barber' })).toMatchObject({
      providerType: 'barber',
      provider_type: 'barber',
    });
    expect(formatThreadBooking({ booking_id_ref: 'b1', barber_provider_type: 'beauty' })).toMatchObject({
      providerType: 'beauty',
      provider_type: 'beauty',
    });
    expect(formatThreadBooking({ booking_id_ref: 'b1', barber_provider_type: null })).toMatchObject({
      providerType: 'barber',
      provider_type: 'barber',
    });
  });
});
