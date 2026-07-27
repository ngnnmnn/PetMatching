'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, useEffect, useState, Suspense } from 'react';
import {
  Calendar,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import ConfirmDialog from '@/components/ui/ConfirmDialog';

function ManagerNavigation() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'dashboard';
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const u = JSON.parse(stored);
      setRole(u.role || '');
    }
  }, []);

  const navGroups = role === 'SPA_MANAGER' ? [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Bảng điều khiển', id: 'dashboard', href: '/manager', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Quản lý Spa',
      items: [
        { label: 'Lịch hẹn', id: 'bookings', href: '/manager?tab=bookings', icon: Calendar },
        { label: 'Dịch vụ', id: 'services', href: '/manager?tab=services', icon: Scissors },
        { label: 'Khung giờ', id: 'slots', href: '/manager?tab=slots', icon: Clock },
        { label: 'Nhân viên', id: 'staffs', href: '/manager?tab=staffs', icon: Users },
      ],
    },
  ] : [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Bảng điều khiển', id: 'dashboard', href: '/manager', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Cửa hàng',
      items: [
        { label: 'Sản phẩm', id: 'products', href: '/manager?tab=products', icon: ShoppingBag },
        { label: 'Đơn hàng', id: 'orders', href: '/manager?tab=orders', icon: Package },
        { label: 'Khách hàng', id: 'customers', href: '/manager?tab=customers', icon: Users },
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

export default function ManagerLayout({ children }: { children: ReactNode }) {
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

    if (user?.role !== 'STORE_MANAGER' && user?.role !== 'SPA_MANAGER') {
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

  const initials = (currentUser?.name ?? 'M').slice(0, 1).toUpperCase();
  const roleName = currentUser?.role === 'SPA_MANAGER' ? 'Quản lý Spa' : 'Quản lý Cửa hàng';

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[var(--text-main)]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[270px] border-r border-[#EFEAE2] bg-[#FFFFFF] lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center gap-3 border-b border-[#EFEAE2] px-5">
          <span className="flex size-11 items-center justify-center rounded-lg bg-[var(--primary-color)] text-white shadow-md">
            <Store className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black tracking-normal text-[var(--text-main)]">PetMatching Manager</p>
            <p className="mt-0.5 text-xs font-bold text-[var(--primary-color)]">{roleName}</p>
          </div>
        </div>

        {/* Dynamic Navigation */}
        <Suspense fallback={<div className="flex-1 px-3 py-4 text-xs text-gray-400">Đang tải danh mục...</div>}>
          <ManagerNavigation />
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
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--primary-color)]">Bảng điều hành</p>
              <h1 className="mt-1 truncate text-lg font-black tracking-normal text-[var(--text-main)]">
                {roleName}
              </h1>
            </div>

            {/* Profile Info */}
            <div className="flex items-center gap-3">
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
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản quản lý không?"
        confirmText="Đăng xuất"
        cancelText="Hủy bỏ"
        isDanger={true}
      />
    </div>
  );
}
