import api from '@/lib/axios';

export type NotificationCategory = 'MATCHING' | 'ORDER' | 'APPOINTMENT' | 'SYSTEM';

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  eventType: string;
  title: string;
  content: string;
  targetUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  data: AppNotification[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  unreadCount: number;
};

export const notificationsApi = {
  getList: (params?: { category?: NotificationCategory; page?: number; limit?: number }) =>
    api.get<NotificationsResponse>('/notifications', { params }),
  getUnreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch<AppNotification>(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch<{ updatedCount: number }>('/notifications/read-all'),
  remove: (id: string) => api.delete<{ deleted: true }>(`/notifications/${id}`),
};
