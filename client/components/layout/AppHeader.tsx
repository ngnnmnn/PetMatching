'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Heart,
  Inbox,
  MessageCircle,
  PawPrint,
  Scissors,
  Search,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { BrandMark } from '@/components/auth/AuthShell';
import UserDropdown from '@/components/home/UserDropdown';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';

const MotionLink = motion(Link);

// 4 trang chính của hệ thống được đưa lên thanh điều hướng chính (Top Navigation Bar)
const MAIN_NAV = [
  { label: 'Khám phá', href: '/explore', icon: Search },
  { label: 'Yêu cầu', href: '/requests', icon: Inbox },
  { label: 'Tin nhắn', href: '/messages', icon: MessageCircle },
  { label: 'Thú cưng của tôi', href: '/my-pets', icon: PawPrint },
];

type AppHeaderProps = {
  sectionLabel?: string;
};

export default function AppHeader({ sectionLabel = 'Ghép đôi' }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { cartCount } = useCart();
  const [searchVal, setSearchVal] = useState('');

  const isHome = pathname === '/home';
  const isShop = pathname === '/shop';
  const isProduct = pathname.startsWith('/home/product/');
  const isStoreSection = isHome || isShop || isProduct;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchVal.trim())}`);
    } else {
      router.push('/shop');
    }
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--border-color)] bg-card/95 shadow-sm backdrop-blur">
      <div className={cn(
        "mx-auto flex h-16 items-center justify-between gap-4 px-4 md:px-6",
        isStoreSection ? "max-w-[1440px]" : "max-w-7xl"
      )}>
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-md pr-2 text-foreground transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
        >
          <BrandMark size="sm" />
          <span className="hidden leading-tight sm:block">
            <span className="block text-lg font-extrabold tracking-normal">PetMatch</span>
            <span className="block text-[11px] font-bold uppercase text-primary">
              {sectionLabel}
            </span>
          </span>
        </Link>

        {/* 1. Màn HOME: Có 3 nút direct Cửa hàng, Spa, Ghép đôi ở giữa */}
        {isHome && (
          <div className="hidden md:flex items-center gap-2.5 bg-[#FAF9F6] p-1.5 rounded-2xl border border-[#EFEAE2] shadow-xs">
            <MotionLink
              layoutId="header-nav-shop"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              href="/shop"
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
            <MotionLink
              layoutId="header-nav-match"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              href="/pet-matching"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-[#E11D48] hover:bg-[#BE123C] text-white transition active:scale-95 shadow-xs border border-transparent"
            >
              <Heart className="size-4 text-white fill-white" />
              Ghép đôi
            </MotionLink>
          </div>
        )}

        {/* 2. Màn SHOP & PRODUCT DETAIL: Có thanh search ở giữa */}
        {(isShop || isProduct) && (
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md mx-auto relative hidden md:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm phụ kiện, thức ăn thú cưng..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-[#EFEAE2] bg-[#FAF9F7] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] transition"
            />
          </form>
        )}

        {/* 3. Màn khác: Giữ nguyên 4 tab cũ */}
        {!isStoreSection && (
          <div className="hidden items-center rounded-xl border border-[var(--border-color)] bg-background p-1 md:flex shadow-sm">
            {MAIN_NAV.map((nav) => {
              const active = pathname === nav.href || pathname.startsWith(`${nav.href}/`);

              return (
                <Link
                  key={nav.label}
                  href={nav.href}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs lg:text-sm font-extrabold transition-all duration-200',
                    active
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <nav.icon className="size-4" />
                  {nav.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Phần bên phải: Spa & Match (nếu ở Shop/Product) + Cart & Profile */}
        <div className="flex items-center gap-2.5">
          {(isShop || isProduct) && (
            <>
              <MotionLink
                layoutId="header-nav-spa"
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                href="/spa"
                className="hidden h-10 items-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] px-4 text-xs font-black text-white active:scale-95 transition sm:flex shadow-xs"
              >
                <Scissors className="size-4 text-white" />
                Spa
              </MotionLink>
              <MotionLink
                layoutId="header-nav-match"
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                href="/pet-matching"
                className="hidden h-10 items-center gap-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] px-4 text-xs font-black text-white active:scale-95 transition sm:flex shadow-xs"
              >
                <Heart className="size-4 text-white fill-white" />
                Ghép đôi
              </MotionLink>
            </>
          )}

          {!isStoreSection && (
            <>
              <Link
                href="/spa"
                className="hidden h-10 items-center gap-2 rounded-md border border-transparent px-3 text-sm font-semibold text-muted-foreground transition hover:border-[var(--border-color)] hover:bg-background hover:text-foreground sm:flex"
              >
                <Scissors className="size-4" />
                Spa
              </Link>
              <Link
                href="/home"
                className={cn(
                  'hidden h-10 items-center gap-2 rounded-md border px-3 text-sm font-extrabold shadow-sm transition sm:flex',
                  pathname === '/home' || pathname.startsWith('/home/')
                    ? 'border-[rgba(228,93,28,0.18)] bg-primary/10 text-primary hover:bg-primary/15'
                    : 'border-transparent text-muted-foreground hover:border-[var(--border-color)] hover:bg-background hover:text-foreground',
                )}
              >
                <Store className="size-4" />
                Cửa hàng
              </Link>
            </>
          )}

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
