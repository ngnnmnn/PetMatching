'use client';

import { useState, useEffect } from 'react';
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
  Sparkles,
  Store,
  Loader2,
  ShoppingBag,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/auth/AuthShell';
import UserDropdown from '@/components/home/UserDropdown';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { productsApi } from '@/lib/api/products';
import { Product } from '@/types';

const MotionLink = motion.create(Link);

// 4 trang chính của hệ thống được đưa lên thanh điều hướng chính (Top Navigation Bar)
const MAIN_NAV = [
  { label: 'Khám phá', href: '/explore', icon: Search },
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
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isManagerOrStaff, setIsManagerOrStaff] = useState(false);

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

  // Reset activeIndex when suggestions change
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  // Debounced fetch search suggestions
  useEffect(() => {
    if (!searchVal.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await productsApi.getList({
          search: searchVal.trim(),
          limit: 5,
        });
        if (res.data && res.data.data) {
          setSuggestions(res.data.data);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error('Failed to fetch search suggestions', err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [searchVal]);

  // Click outside to close suggestions list
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-form-container')) {
        setShowSuggestions(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isHome = pathname === '/home';
  const isShop = pathname === '/shop';
  const isProduct = pathname.startsWith('/home/product/');
  const isCart = pathname === '/cart';
  const isCheckout = pathname === '/checkout';
  const isOrders = pathname.startsWith('/orders');
  const isStoreSection = isHome || isShop || isProduct || isCart || isCheckout || isOrders;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (searchVal.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchVal.trim())}`);
    } else {
      router.push('/shop');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prevIndex) =>
        prevIndex < suggestions.length - 1 ? prevIndex + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        const selectedProduct = suggestions[activeIndex];
        setShowSuggestions(false);
        setSearchVal('');
        router.push(`/home/product/${selectedProduct.id}`);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  if (isManagerOrStaff) {
    return null;
  }

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
              href="/explore"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-[#E11D48] hover:bg-[#BE123C] text-white transition active:scale-95 shadow-xs border border-transparent"
            >
              <Heart className="size-4 text-white fill-white" />
              Ghép đôi
            </MotionLink>
          </div>
        )}

        {/* 2. Màn SHOP & PRODUCT DETAIL: Có thanh search ở giữa */}
        {(isShop || isProduct) && (
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xl mx-auto relative hidden md:block search-form-container">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm phụ kiện, thức ăn thú cưng..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-10 py-2.5 text-xs font-semibold rounded-xl border border-[var(--primary-color)] bg-white focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] transition"
            />

            {searchVal && (
              <button
                type="button"
                onClick={() => {
                  setSearchVal('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition"
              >
                <X className="size-4" />
              </button>
            )}

            {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 max-h-80 overflow-y-auto rounded-xl border border-[#EFEAE2] bg-white p-2 shadow-xl animate-in slide-in-from-top-2 duration-200">
                {loadingSuggestions && (
                  <div className="flex items-center justify-center p-4 text-xs font-bold text-[var(--text-muted)] gap-2">
                    <Loader2 className="size-4 animate-spin text-[var(--primary-color)]" />
                    Đang tìm kiếm...
                  </div>
                )}

                {!loadingSuggestions && suggestions.length === 0 && (
                  <div className="p-4 text-center text-xs font-bold text-[var(--text-muted)]">
                    Không tìm thấy sản phẩm nào
                  </div>
                )}

                {!loadingSuggestions && suggestions.map((product, index) => {
                  const price = product.salePrice ?? product.sellingPrice;
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        setShowSuggestions(false);
                        setSearchVal('');
                        router.push(`/home/product/${product.id}`);
                      }}
                      className={cn(
                        "flex items-center gap-3 p-2.5 hover:bg-[#FAF9F6] transition cursor-pointer text-left border-b border-[#EFEAE2]/60 last:border-b-0 first:rounded-t-lg last:rounded-b-lg",
                        isActive && "bg-orange-50/70 border-l-2 border-[var(--primary-color)] pl-2"
                      )}
                    >
                      <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <ShoppingBag className="size-5 text-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-xs font-bold text-[var(--text-main)]">
                          {product.name}
                        </h4>
                        <p className="truncate text-[10px] font-semibold text-[var(--text-muted)] mt-0.5">
                          {product.brand || 'Thương hiệu khác'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-[var(--primary-color)]">
                          {formatCurrency(price)}
                        </span>
                        {product.salePrice && (
                          <span className="block text-[10px] font-semibold text-[var(--text-muted)] line-through">
                            {formatCurrency(product.sellingPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

        {/* Phần bên phải: Spa & Match (nếu ở Shop/Product/Cart/Checkout/Orders) + Cart & Profile */}
        <div className="flex items-center gap-2.5">
          {(isShop || isProduct || isCart || isCheckout || isOrders) && (
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
                href="/explore"
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
            href="/my-pets/recommendations"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-orange-500 bg-white px-3.5 text-xs font-black text-orange-600 shadow-sm transition hover:bg-orange-50/30 active:scale-95"
            title="Đề xuất chăm sóc & Sức khỏe"
          >
            <Sparkles className="size-4 text-orange-500 fill-orange-500/10" />
            <span>Góc sức khỏe</span>
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
