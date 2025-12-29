import api from './api.service';
import type { Conversation, Message, PaginatedResponse } from '../types';

// Booking context for CampusCuts booking-centric conversations
interface BookingContext {
  bookingId?: string;
  serviceName?: string;
  servicePrice?: number;
  scheduledTime?: string;
  location?: string;
  locationDetails?: string;
  notes?: string;
  barberName?: string;
  consumerName?: string;
  barberProfilePicture?: string;
  consumerProfilePicture?: string;
}

interface CreateConversationData {
  other_user_id: string;
  booking_id?: string;
  // Booking context fields
  service_name?: string;
  service_price?: number;
  scheduled_time?: string;
  location?: string;
  location_details?: string;
  notes?: string;
  barber_name?: string;
  consumer_name?: string;
  barber_profile_picture?: string;
  consumer_profile_picture?: string;
}

class MessageService {
  async getConversations(page = 1, limit = 20): Promise<PaginatedResponse<Conversation>> {
    return await api.get<PaginatedResponse<Conversation>>('/messages/conversations', { page, limit });
  }

  async getConversationById(id: string): Promise<Conversation> {
    return await api.get<Conversation>(`/messages/conversations/${id}`);
  }

  async createConversation(data: CreateConversationData): Promise<Conversation> {
    return await api.post<Conversation>('/messages/conversations', data);
  }

  /**
   * Start a BOOKING-CENTRIC conversation with full service context
   * This is the primary way to create conversations in CampusCuts
   */
  async startBookingConversation(
    otherUserId: string, 
    bookingContext: BookingContext
  ): Promise<Conversation> {
    const data: CreateConversationData = {
      other_user_id: otherUserId,
      booking_id: bookingContext.bookingId,
      service_name: bookingContext.serviceName,
      service_price: bookingContext.servicePrice,
      scheduled_time: bookingContext.scheduledTime,
      location: bookingContext.location,
      location_details: bookingContext.locationDetails,
      notes: bookingContext.notes,
      barber_name: bookingContext.barberName,
      consumer_name: bookingContext.consumerName,
      barber_profile_picture: bookingContext.barberProfilePicture,
      consumer_profile_picture: bookingContext.consumerProfilePicture,
    };
    return await api.post<Conversation>('/messages/conversations', data);
  }

  async getMessages(conversationId: string, page = 1, limit = 50): Promise<PaginatedResponse<Message>> {
    return await api.get<PaginatedResponse<Message>>(`/messages/conversations/${conversationId}/messages`, { 
      page, 
      limit 
    });
  }

  async sendMessage(conversationId: string, content: string, messageType: 'text' | 'image' = 'text', mediaUrl?: string): Promise<Message> {
    return await api.post<Message>(`/messages/conversations/${conversationId}/messages`, {
      content,
      message_type: messageType,
      media_url: mediaUrl,
    });
  }

  async markConversationAsRead(conversationId: string): Promise<void> {
    await api.put(`/messages/conversations/${conversationId}/read`, {});
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/messages/conversations/${conversationId}`);
  }

  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ count: number }>('/messages/unread-count');
    return response.count;
  }

  async uploadChatImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.upload<{ url: string }>('/upload/chat-image', formData);
    return response.url;
  }
}

export default new MessageService();

