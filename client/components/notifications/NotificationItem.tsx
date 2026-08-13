'use client';

import { CalendarDays, Heart, Info, Package, Trash2 } from 'lucide-react';
import { AppNotification } from '@/lib/api/notifications';
import { cn } from '@/lib/utils';

const categoryStyle = {
  MATCHING: { icon: Heart, className: 'bg-rose-50 text-rose-600' },
  ORDER: { icon: Package, className: 'bg-amber-50 text-amber-700' },
  APPOINTMENT: { icon: CalendarDays, className: 'bg-emerald-50 text-emerald-700' },
  SYSTEM: { icon: Info, className: 'bg-sky-50 text-sky-700' },
} as const;

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff >= 0 && diff < 60_000) return 'Vừa xong';
  if (diff >= 0 && diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff >= 0 && diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

export function NotificationItem({
  notification,
  onOpen,
  onDelete,
  compact = false,
}: {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  onDelete: (notification: AppNotification) => void;
  compact?: boolean;
}) {
  const config = categoryStyle[notification.category];
  const Icon = config.icon;

  return (
    <div className={cn('group relative flex gap-3 border-b border-border/70 transition hover:bg-muted/60', compact ? 'p-3' : 'p-4', !notification.isRead && 'bg-primary/[0.045]')}>
      <button type="button" onClick={() => onOpen(notification)} className="flex min-w-0 flex-1 gap-3 text-left">
        <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', config.className)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm leading-5 text-foreground', !notification.isRead ? 'font-extrabold' : 'font-semibold')}>
            {notification.title}
          </span>
          <span className={cn('mt-0.5 block text-muted-foreground', compact ? 'line-clamp-2 text-xs' : 'text-sm')}>
            {notification.content}
          </span>
          <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">
            {formatNotificationTime(notification.createdAt)}
          </span>
        </span>
        {!notification.isRead && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" />}
      </button>
      <button
        type="button"
        onClick={() => onDelete(notification)}
        aria-label="Xóa thông báo"
        className="absolute bottom-2 right-2 rounded-md p-1.5 text-muted-foreground opacity-100 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
