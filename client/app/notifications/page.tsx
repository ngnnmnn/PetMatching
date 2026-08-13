'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AppHeader from '@/components/layout/AppHeader';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import {
  AppNotification,
  NotificationCategory,
  notificationsApi,
} from '@/lib/api/notifications';
import { cn } from '@/lib/utils';

const FILTERS: Array<{ value?: NotificationCategory; label: string }> = [
  { label: 'Tất cả' },
  { value: 'MATCHING', label: 'Ghép đôi' },
  { value: 'ORDER', label: 'Đơn hàng' },
  { value: 'APPOINTMENT', label: 'Lịch Spa' },
  { value: 'SYSTEM', label: 'Hệ thống' },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [category, setCategory] = useState<NotificationCategory>();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.getList({ category, page, limit: 20 });
      setNotifications(response.data.data);
      setUnreadCount(response.data.unreadCount);
      setTotalPages(response.data.meta.totalPages);
    } catch {
      toast.error('Không thể tải danh sách thông báo.');
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openNotification = async (notification: AppNotification) => {
    if (!notification.isRead) {
      try {
        await notificationsApi.markAsRead(notification.id);
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        toast.error('Không thể đánh dấu thông báo đã đọc.');
        return;
      }
    }
    if (notification.targetUrl) router.push(notification.targetUrl);
    else toast.info('Đối tượng liên quan không còn tồn tại.');
  };

  const deleteNotification = async (notification: AppNotification) => {
    try {
      await notificationsApi.remove(notification.id);
      if (!notification.isRead) setUnreadCount((count) => Math.max(0, count - 1));
      await load();
    } catch {
      toast.error('Không thể xóa thông báo.');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      toast.error('Không thể đánh dấu tất cả đã đọc.');
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
      <AppHeader sectionLabel="Thông báo" />
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-black">Thông báo</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{unreadCount} thông báo chưa đọc</p>
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllAsRead} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-extrabold text-primary shadow-sm transition hover:bg-muted">
              <CheckCheck className="size-4" /> Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => (
            <button key={filter.label} type="button" onClick={() => { setCategory(filter.value); setPage(1); }} className={cn('whitespace-nowrap rounded-full border px-4 py-2 text-xs font-extrabold transition', category === filter.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:border-primary hover:text-primary')}>
              {filter.label}
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {loading ? (
            <div className="flex h-56 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
          ) : notifications.length ? (
            notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} onOpen={openNotification} onDelete={deleteNotification} />)
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-3 text-muted-foreground">
              <span className="flex size-14 items-center justify-center rounded-full bg-muted"><Bell className="size-7 opacity-50" /></span>
              <p className="font-bold">Chưa có thông báo</p>
            </div>
          )}
        </section>

        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border bg-card px-4 py-2 text-sm font-bold disabled:opacity-40">Trước</button>
            <span className="text-sm font-semibold text-muted-foreground">Trang {page}/{totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border bg-card px-4 py-2 text-sm font-bold disabled:opacity-40">Sau</button>
          </div>
        )}
      </div>
    </main>
  );
}
