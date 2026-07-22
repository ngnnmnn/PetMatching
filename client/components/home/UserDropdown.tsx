'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, MessageCircle, Package, Scissors, ShieldCheck, User } from 'lucide-react';
import { User as UserType } from '@/types';

const MENU_ITEMS = [
  { icon: User, label: 'Hồ sơ cá nhân', href: '/profile' },
  { icon: Package, label: 'Đơn hàng của tôi', href: '/orders' },
  { icon: MessageCircle, label: 'Tin nhắn & Ghép đôi', href: '/messages' },
  { icon: Scissors, label: 'Lịch hẹn Spa', href: '/spa/book' },
];

export default function UserDropdown() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = () => {
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          setUser(JSON.parse(stored) as UserType);
        } catch (e) {
          console.error('Failed to parse user from localStorage', e);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    checkUser();

    window.addEventListener('auth-change', checkUser);
    return () => {
      window.removeEventListener('auth-change', checkUser);
    };
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
        className="flex h-10 items-center justify-center rounded-md border border-[var(--primary-color)] bg-primary px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-primary/95 focus-visible:outline-none"
      >
        Đăng nhập
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-1.5 rounded-md border border-[#EFEAE2] bg-white px-1.5 shadow-sm transition hover:border-[rgba(228,93,28,0.28)]"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="size-8 rounded-full object-cover ring-2 ring-[var(--primary-color)]"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-[var(--primary-color)] text-sm font-bold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <ChevronDown className={`size-4 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-[var(--border-color)] bg-white shadow-xl">
          <div className="border-b border-[var(--border-color)] px-4 py-3">
            <p className="text-sm font-bold text-[var(--text-main)]">{user.name}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{user.email}</p>
          </div>

          <div className="py-1">
            {user.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => {
                  router.push('/admin');
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-[#0F766E] transition hover:bg-[#E8F4F2]"
              >
                <ShieldCheck className="size-4" />
                Admin console
              </button>
            )}
            {(user.role === 'STORE_MANAGER' || user.role === 'SPA_MANAGER') && (
              <button
                type="button"
                onClick={() => {
                  router.push('/manager');
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-[#E45D1C] transition hover:bg-[#FFF5F0]"
              >
                <ShieldCheck className="size-4" />
                Manager console
              </button>
            )}
            {user.role === 'SPA_STAFF' && (
              <button
                type="button"
                onClick={() => {
                  router.push('/spa/staff');
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-[#6D28D9] transition hover:bg-[#F3E8FF]"
              >
                <Scissors className="size-4 text-[#6D28D9]" />
                Trang nhân viên Spa
              </button>
            )}
            {MENU_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  router.push(item.href);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--text-main)] transition hover:bg-[var(--bg-page)]"
              >
                <item.icon className="size-4 text-[var(--text-muted)]" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--border-color)] py-1">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
                window.dispatchEvent(new Event('auth-change'));
                router.push('/login');
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-500 transition hover:bg-red-50"
            >
              <LogOut className="size-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
