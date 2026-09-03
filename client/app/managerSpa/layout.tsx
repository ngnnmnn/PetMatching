'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, useEffect, useState, Suspense } from 'react';
import {
  Calendar,
  LayoutDashboard,
  LogOut,
  Scissors,
  Users,
  Clock,
  FolderKanban,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import NotificationBell from '@/components/notifications/NotificationBell';

function SpaManagerNavigation() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'dashboard';

  const navGroups = [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Bảng điều khiển', id: 'dashboard', href: '/managerSpa', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Quản lý Spa',
      items: [
        { label: 'Lịch hẹn', id: 'bookings', href: '/managerSpa?tab=bookings', icon: Calendar },
        { label: 'Dịch vụ', id: 'services', href: '/managerSpa?tab=services', icon: Scissors },
        { label: 'Danh mục', id: 'categories', href: '/managerSpa?tab=categories', icon: FolderKanban },
        { label: 'Nhân viên', id: 'staffs', href: '/managerSpa?tab=staffs', icon: Users },
        { label: 'Đánh giá', id: 'feedbacks', href: '/managerSpa?tab=feedbacks', icon: Star },
      ],
    },
  ];

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <div className="grid gap-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-wider text-[#A3A299]">
              {group.label}
            </p>
            <div className="grid gap-1">
              {group.items.map((item) => {
                const active = currentTab === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-bold transition duration-200',
                      active
                        ? 'bg-[rgba(228,93,28,0.08)] text-[var(--primary-color)] shadow-[inset_3px_0_0_var(--primary-color)]'
                        : 'text-[#5C5B52] hover:bg-[#F5F4F0] hover:text-[var(--text-main)]',
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

export default function SpaManagerLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('accessToken');
    const stored = localStorage.getItem('user');
    const user = stored ? (JSON.parse(stored) as { role?: string; name?: string; email?: string }) : null;

    if (!token) {
      router.replace('/login');
      return;
    }

    if (user?.role !== 'SPA_MANAGER' && user?.role !== 'ADMIN') {
      router.replace('/home');
      return;
    }

    setCurrentUser(user);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-change'));
    router.replace('/login');
  };

  if (!mounted || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]">
        <div className="size-8 animate-spin rounded-full border-[3px] border-[var(--primary-color)] border-t-transparent" />
      </div>
    );
  }

  const initials = (currentUser?.name ?? 'S').slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[var(--text-main)]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[270px] border-r border-[#EFEAE2] bg-[#FFFFFF] lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center gap-3 border-b border-[#EFEAE2] px-5">
          <span className="flex size-11 items-center justify-center rounded-lg bg-[var(--primary-color)] text-white shadow-md">
            <Scissors className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-normal text-[var(--text-main)]">PetMatching Spa</p>
            <p className="mt-0.5 text-xs font-bold text-[var(--primary-color)]">Quản lý Spa</p>
          </div>
        </div>

        {/* Dynamic Navigation */}
        <Suspense fallback={<div className="flex-1 px-3 py-4 text-xs text-gray-400">Đang tải danh mục...</div>}>
          <SpaManagerNavigation />
        </Suspense>

        {/* Logout Bottom */}
        <div className="border-t border-[#EFEAE2] p-4">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#EFEAE2] bg-white px-3 text-sm font-black text-[#B42318] transition hover:border-[#FDA29B] hover:bg-[#FFF1F0]"
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-[270px]">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-[#EFEAE2] bg-white/95 backdrop-blur-sm">
          <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--primary-color)]">Bảng điều hành Spa</p>
              <h1 className="mt-1 truncate text-lg font-black tracking-normal text-[var(--text-main)]">
                Quản lý Spa
              </h1>
            </div>

            {/* Profile & Notifications Info */}
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-black text-[var(--text-main)]">{currentUser?.name}</p>
                <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">{currentUser?.email}</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--primary-color)] text-sm font-black text-white shadow-inner">
                {initials}
              </span>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                title="Đăng xuất"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-[#EFEAE2] bg-white text-[#5C5B52] transition hover:border-[#FDA29B] hover:bg-[#FFF1F0] hover:text-[#B42318]"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={
            <div className="flex h-64 items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-[3px] border-[var(--primary-color)] border-t-transparent" />
            </div>
          }>
            {children}
          </Suspense>
        </main>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Xác nhận đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Quản lý Spa không?"
        confirmText="Đăng xuất"
        cancelText="Hủy bỏ"
        isDanger={true}
      />
    </div>
  );
}
