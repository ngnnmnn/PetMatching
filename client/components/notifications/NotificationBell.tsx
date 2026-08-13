'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppNotification, notificationsApi } from '@/lib/api/notifications';
import { NotificationItem } from './NotificationItem';

export default function NotificationBell() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(async () => {
    if (!localStorage.getItem('accessToken')) return;
    try {
      const response = await notificationsApi.getUnreadCount();
      setUnreadCount(response.data.count);
    } catch {
      // The shared interceptor handles expired sessions.
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.getList({ limit: 8 });
      setNotifications(response.data.data);
      setUnreadCount(response.data.unreadCount);
    } catch {
      toast.error('Không thể tải danh sách thông báo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const syncAuth = () => {
      const hasToken = Boolean(localStorage.getItem('accessToken'));
      setAuthenticated(hasToken);
      if (hasToken) void refreshCount();
      else {
        setUnreadCount(0);
        setNotifications([]);
      }
    };
    syncAuth();
    window.addEventListener('auth-change', syncAuth);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshCount();
    }, 30_000);
    return () => {
      window.removeEventListener('auth-change', syncAuth);
      window.clearInterval(timer);
    };
  }, [refreshCount]);

  const handleOpen = async (notification: AppNotification) => {
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
    setOpen(false);
    if (notification.targetUrl) router.push(notification.targetUrl);
    else toast.info('Đối tượng liên quan không còn tồn tại.');
  };

  const handleDelete = async (notification: AppNotification) => {
    try {
      await notificationsApi.remove(notification.id);
      setNotifications((items) => items.filter((item) => item.id !== notification.id));
      if (!notification.isRead) setUnreadCount((count) => Math.max(0, count - 1));
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

  if (!authenticated) return null;

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) void loadNotifications(); }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`} className="relative inline-flex size-10 items-center justify-center rounded-md border border-[var(--border-color)] bg-card text-foreground shadow-sm transition hover:border-primary hover:text-primary">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-1rem))] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div>
            <h2 className="font-extrabold">Thông báo</h2>
            <p className="text-xs text-muted-foreground">{unreadCount} thông báo chưa đọc</p>
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllAsRead} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              <CheckCheck className="size-4" /> Tất cả đã đọc
            </button>
          )}
        </div>
        <ScrollArea className="h-[min(28rem,65vh)]">
          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>
          ) : notifications.length ? notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onOpen={handleOpen} onDelete={handleDelete} compact />
          )) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Bell className="size-7 opacity-40" /><p className="text-sm font-semibold">Chưa có thông báo</p>
            </div>
          )}
        </ScrollArea>
        <button type="button" onClick={() => { setOpen(false); router.push('/notifications'); }} className="w-full border-t p-3 text-sm font-extrabold text-primary transition hover:bg-muted">
          Xem tất cả thông báo
        </button>
      </PopoverContent>
    </Popover>
  );
}
