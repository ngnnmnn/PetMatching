'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Heart,
  MessageCircle,
  PawPrint,
  Scissors,
  Search,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { BrandMark } from '@/components/auth/AuthShell';
import UserDropdown from '@/components/home/UserDropdown';
import { useCart } from '@/context/CartContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import { cn } from '@/lib/utils';

const MATCHING_NAV = [
  { label: 'Khám phá', href: '/explore', icon: Search },
  { label: 'Tin nhắn', href: '/messages', icon: MessageCircle },
  { label: 'Thú cưng của tôi', href: '/my-pets', icon: PawPrint },
];

// 4 trang chính của hệ thống được đưa lên thanh điều hướng chính (Top Navigation Bar)
type AppHeaderProps = {
  sectionLabel?: string;
};

export default function AppHeader({ sectionLabel = 'Trang chủ' }: AppHeaderProps) {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const [isManagerOrStaff, setIsManagerOrStaff] = useState(false);
  const [matchingMenuOpen, setMatchingMenuOpen] = useState(false);
  const isMatchingSection = MATCHING_NAV.some(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  const isShopSection = pathname === '/shop' || pathname.startsWith('/shop/') || pathname.startsWith('/product/');
  const isSpaSection = pathname === '/spa' || pathname.startsWith('/spa/');

  useEffect(() => {
    const checkUserRole = () => {
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          const role = user?.role;
          if (role === 'ADMIN' || role === 'STORE_MANAGER' || role === 'SPA_MANAGER' || role === 'SPA_STAFF') {
            setIsManagerOrStaff(true);
            return;
          }
        } catch (e) {
          console.error('Failed to parse user in AppHeader', e);
        }
      }
      setIsManagerOrStaff(false);
    };

    checkUserRole();
    window.addEventListener('auth-change', checkUserRole);
    return () => window.removeEventListener('auth-change', checkUserRole);
  }, []);

  if (isManagerOrStaff) {
    return null;
  }

  return (
    <nav aria-label={`Điều hướng ${sectionLabel}`} className="sticky top-0 z-40 border-b border-[var(--border-color)] bg-card/95 shadow-sm backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        {/* Brand Logo */}
        <Link
          href="/home"
          className="flex min-w-0 items-center gap-3 rounded-md pr-2 text-foreground transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
        >
          <BrandMark size="sm" />
          <span className="hidden leading-tight sm:block">
            <span className="block text-lg font-extrabold tracking-normal">PetMatch</span>
            <span className="block text-[11px] font-bold uppercase text-primary">
              Trang chủ
            </span>
          </span>
        </Link>

        {/* Điều hướng chính với thiết kế Clean Modern Capsule: chỉ highlight phân hệ đang truy cập */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1.5 shadow-xs backdrop-blur-md md:flex">
            <Link
              href="/shop"
              onClick={() => {
                localStorage.removeItem('petmatch_shop_selected_pet');
                window.dispatchEvent(new Event('shop-reset'));
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-[13.5px] font-bold transition-all active:scale-95',
                isShopSection
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/25 ring-2 ring-teal-300/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/80 hover:shadow-xs'
              )}
            >
              <Store className={cn('size-4', isShopSection ? 'text-white' : 'text-teal-600')} />
              Cửa hàng
            </Link>
            <Link
              href="/spa"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-[13.5px] font-bold transition-all active:scale-95',
                isSpaSection
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-300/40'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/80 hover:shadow-xs'
              )}
            >
              <Scissors className={cn('size-4', isSpaSection ? 'text-white' : 'text-emerald-600')} />
              Spa & Làm đẹp
            </Link>
            <div
              className="relative"
              onMouseEnter={() => setMatchingMenuOpen(true)}
              onMouseLeave={() => setMatchingMenuOpen(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setMatchingMenuOpen(false);
                }
              }}
            >
                <button
                  type="button"
                  aria-label="Mở điều hướng Ghép đôi"
                  aria-haspopup="menu"
                  aria-expanded={matchingMenuOpen}
                  onClick={() => setMatchingMenuOpen((open) => !open)}
                  onFocus={() => setMatchingMenuOpen(true)}
                  className={cn(
                    'group flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-bold transition-all active:scale-95',
                    isMatchingSection
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25 ring-2 ring-rose-300/40'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/80 hover:shadow-xs'
                  )}
                >
                  <Heart className={cn('size-4 transition-transform group-hover:scale-110', isMatchingSection ? 'fill-white text-white' : 'fill-rose-500 text-rose-500')} />
                  Ghép đôi
                  <ChevronDown className={cn('size-3.5 transition-transform', matchingMenuOpen ? 'rotate-180' : '', isMatchingSection ? 'text-white' : 'text-muted-foreground')} />
                </button>

              {matchingMenuOpen && (
                <div className="absolute left-1/2 top-full z-50 w-52 -translate-x-1/2 pt-2" role="menu">
                  <div className="animate-in fade-in-0 zoom-in-95 rounded-2xl border border-rose-100/80 bg-card p-1.5 shadow-2xl duration-150 backdrop-blur-md">
                    {MATCHING_NAV.map(({ label, href, icon: Icon }) => {
                      const active = pathname === href || pathname.startsWith(`${href}/`);

                      return (
                      <Link
                        key={href}
                        href={href}
                        role="menuitem"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMatchingMenuOpen(false)}
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-bold outline-none transition-all',
                          active
                            ? 'bg-rose-50 text-rose-700 font-extrabold shadow-xs'
                            : 'text-foreground hover:bg-muted/60 focus:bg-muted/60'
                        )}
                      >
                        <span className={cn('flex size-7.5 items-center justify-center rounded-lg shrink-0', active ? 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-xs' : 'bg-rose-50 text-rose-600')}>
                          <Icon className="size-4" />
                        </span>
                        <span className="truncate">{label}</span>
                      </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
        </div>

        {/* Tiện ích tài khoản */}
        <div className="flex items-center gap-2.5">
          <NotificationBell />
          <Link
            href="/cart"
            className="relative inline-flex size-10 items-center justify-center rounded-md border border-[var(--border-color)] bg-card text-foreground shadow-sm transition hover:border-primary hover:text-primary"
            aria-label="Giỏ hàng"
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm animate-in zoom-in-50 duration-200">
                {cartCount}
              </span>
            )}
          </Link>
          <UserDropdown />
        </div>
      </div>

    </nav>
  );
}
