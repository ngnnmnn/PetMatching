'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Scissors,
  Search,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { BrandMark } from '@/components/auth/AuthShell';
import UserDropdown from '@/components/home/UserDropdown';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';

const MAIN_NAV = [
  { label: 'Khám phá', href: '/explore', icon: Search },
  { label: 'Yêu thích', href: '/favorites', icon: Heart },
  { label: 'Thú cưng', href: '/my-pets', icon: BadgeCheck },
  { label: 'Tin nhắn', href: '/messages', icon: MessageCircle },
];

type AppHeaderProps = {
  sectionLabel?: string;
};

export default function AppHeader({ sectionLabel = 'Cửa hàng' }: AppHeaderProps) {
  const pathname = usePathname();
  const storeActive = pathname === '/home' || pathname.startsWith('/home/');
  const { cartCount } = useCart();

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--border-color)] bg-card/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/home"
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

        <div className="hidden items-center rounded-lg border border-[var(--border-color)] bg-background p-1 md:flex">
          {MAIN_NAV.map((nav) => {
            const active = pathname === nav.href || pathname.startsWith(`${nav.href}/`);

            return (
              <Link
                key={nav.label}
                href={nav.href}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition hover:bg-card hover:text-foreground hover:shadow-sm',
                  active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground',
                )}
              >
                <nav.icon className="size-4" />
                {nav.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
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
              storeActive
                ? 'border-[rgba(228,93,28,0.18)] bg-primary/10 text-primary hover:bg-primary/15'
                : 'border-transparent text-muted-foreground hover:border-[var(--border-color)] hover:bg-background hover:text-foreground',
            )}
          >
            <Store className="size-4" />
            Cửa hàng
          </Link>
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
