'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
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

const MotionLink = motion.create(Link);

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

        {/* Điều hướng chính thống nhất trên mọi màn hình dành cho người dùng. */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-[#EFEAE2] bg-[#FAF9F6] p-1.5 shadow-xs md:flex">
            <MotionLink
              layoutId="header-nav-shop"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              href="/shop"
              onClick={() => {
                localStorage.removeItem('petmatch_shop_selected_pet');
                window.dispatchEvent(new Event('shop-reset'));
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-[#0F766E] hover:bg-[#115E59] text-white transition active:scale-95 shadow-xs border border-transparent"
            >
              <Store className="size-4 text-white" />
              Cửa hàng
            </MotionLink>
            <MotionLink
              layoutId="header-nav-spa"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              href="/spa"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-[#16A34A] hover:bg-[#15803D] text-white transition active:scale-95 shadow-xs border border-transparent"
            >
              <Scissors className="size-4 text-white" />
              Spa & Làm đẹp
            </MotionLink>
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
                  className={`group flex items-center gap-2 rounded-xl border border-transparent px-5 py-2.5 text-xs font-black text-white shadow-xs transition active:scale-95 ${
                    isMatchingSection
                      ? 'bg-[#BE123C] ring-2 ring-[#FDA4AF]/60'
                      : 'bg-[#E11D48] hover:bg-[#BE123C]'
                  }`}
                >
                  <Heart className="size-4 fill-white text-white" />
                  Ghép đôi
                  <ChevronDown className={`size-3.5 transition-transform ${matchingMenuOpen ? 'rotate-180' : ''}`} />
                </button>

              {matchingMenuOpen && (
                <div className="absolute left-1/2 top-full z-50 w-60 -translate-x-1/2 pt-2" role="menu">
                  <div className="animate-in fade-in-0 zoom-in-95 rounded-xl border border-[#FBCFE8] bg-white p-2 shadow-xl duration-150">
                    {MATCHING_NAV.map(({ label, href, icon: Icon }) => {
                      const active = pathname === href || pathname.startsWith(`${href}/`);

                      return (
                      <Link
                        key={href}
                        href={href}
                        role="menuitem"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMatchingMenuOpen(false)}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 font-bold outline-none transition-colors ${
                          active
                            ? 'bg-[#FFF1F2] text-[#BE123C]'
                            : 'text-[var(--text-main)] focus:bg-[#FFF1F2] focus:text-[#BE123C]'
                        }`}
                      >
                        <span className={`flex size-8 items-center justify-center rounded-lg ${active ? 'bg-[#E11D48] text-white' : 'bg-[#FFF1F2] text-[#E11D48]'}`}>
                          <Icon className="size-4" />
                        </span>
                        {label}
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
