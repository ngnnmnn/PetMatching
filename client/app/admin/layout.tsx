'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  FileWarning,
  LayoutDashboard,
  LogOut,
  MapPin,
  PawPrint,
  Package,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'Tổng quan',
    items: [
      { label: 'Bảng điều khiển', href: '/admin', icon: LayoutDashboard },
      { label: 'Thông tin hệ thống', href: '/admin/system-profile', icon: MapPin },
      { label: 'Người dùng & vai trò', href: '/admin/users', icon: UsersRound },
      { label: 'Báo cáo & khiếu nại', href: '/admin/reports', icon: FileWarning },
    ],
  },
  {
    label: 'Ghép đôi',
    items: [
      { label: 'Thú cưng', href: '/admin/pets', icon: PawPrint },
      { label: 'Xác minh thú cưng', href: '/admin/pet-verifications', icon: ClipboardCheck },
      { label: 'Quy tắc giống', href: '/admin/breed-rules', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Cửa hàng',
    items: [
      { label: 'Tổng quan cửa hàng', href: '/admin/store-overview', icon: ShoppingBag },
      { label: 'Sản phẩm', href: '/admin/store-products', icon: Package },
      { label: 'Đơn hàng', href: '/admin/store-orders', icon: Activity },
    ],
  },
  {
    label: 'Spa',
    items: [
      { label: 'Tổng quan Spa', href: '/admin/spa-overview', icon: LayoutDashboard },
      { label: 'Dịch vụ Spa', href: '/admin/spa-services', icon: Scissors },
      { label: 'Lịch nhân viên', href: '/admin/spa-staff-schedule', icon: CalendarDays },
      { label: 'Lịch đặt Spa', href: '/admin/spa-bookings', icon: Activity },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const stored = localStorage.getItem('user');
    const user = stored ? (JSON.parse(stored) as { role?: string }) : null;

    if (!token) {
      router.replace('/login');
      return;
    }

    if (user?.role !== 'ADMIN') {
      router.replace('/home');
      return;
    }

    setCurrentUser(user);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.replace('/login');
  };

  const initials = (currentUser?.name ?? 'A').slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-[#172033]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[292px] border-r border-[#D8E0EA] bg-[#FFFFFF] lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center gap-3 border-b border-[#E5EAF0] px-5">
          <span className="flex size-11 items-center justify-center rounded-lg bg-[#0F766E] text-white shadow-sm">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-black tracking-normal text-[#172033]">Quản trị PetMatch</p>
            <p className="mt-0.5 text-xs font-bold text-[#64748B]">Trung tâm điều hành</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="grid gap-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-wider text-[#8A97A8]">
                  {group.label}
                </p>
                <div className="grid gap-1">
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-bold transition',
                          active
                            ? 'bg-[#E7F3F1] text-[#0F766E] shadow-[inset_3px_0_0_#0F766E]'
                            : 'text-[#475569] hover:bg-[#F2F5F8] hover:text-[#172033]',
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

        <div className="border-t border-[#E5EAF0] p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-black text-[#B42318] transition hover:border-[#FDA29B] hover:bg-[#FFF1F0]"
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="lg:pl-[292px]">
        <header className="sticky top-0 z-30 border-b border-[#D8E0EA] bg-white/95 backdrop-blur">
          <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#0F766E]">Bảng quản trị</p>
              <h1 className="mt-1 truncate text-xl font-black tracking-normal text-[#172033]">
                Điều hành hệ thống
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-black text-[#172033]">{currentUser?.name ?? 'Quản trị viên'}</p>
                <p className="mt-0.5 text-xs font-bold text-[#64748B]">{currentUser?.email ?? 'Quản trị hệ thống'}</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-lg bg-[#172033] text-sm font-black text-white">
                {initials}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất"
                className="inline-flex size-10 items-center justify-center rounded-lg border border-[#D8E0EA] bg-white text-[#475569] transition hover:border-[#FDA29B] hover:bg-[#FFF1F0] hover:text-[#B42318]"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
