import api from './api.service';
import { Conversation, Message, PaginatedResponse } from '../types';

interface CreateConversationData {
  other_user_id: string;
  booking_id?: string;
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

