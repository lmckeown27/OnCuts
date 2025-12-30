import api from './api.service';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    unreadCount: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

class NotificationService {
  async getNotifications(page = 1, limit = 20): Promise<NotificationsResponse['data']> {
    const response = await api.get<NotificationsResponse>('/notifications', { page, limit });
    return response.data;
  }

  async markAsRead(notificationId: string): Promise<void> {
    await api.put(`/notifications/${notificationId}/read`, {});
  }

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all', {});
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await api.delete(`/notifications/${notificationId}`);
  }
}

export default new NotificationService();

