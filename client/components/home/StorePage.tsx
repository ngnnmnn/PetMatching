'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  Heart,
  Search,
  Scissors,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import { BrandMark } from '@/components/auth/AuthShell';
import { useProducts } from '@/hooks/useProducts';
import CategoryTabs from './CategoryTabs';
import FeaturedSection from './FeaturedSection';
import ProductGrid from './ProductGrid';
import SearchFilterBar from './SearchFilterBar';
import UserDropdown from './UserDropdown';

type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc';

export default function StorePage() {
  const { products, featuredProducts, loading, featuredLoading, error, meta, filters, setFilters } = useProducts();

  const handleCategoryChange = useCallback(
    (category: string | undefined) => {
      setFilters((previous) => ({ ...previous, category, page: 1 }));
    },
    [setFilters],
  );

  const handleSearch = useCallback(
    (searchValue: string) => {
      setFilters((previous) => ({ ...previous, search: searchValue || undefined, page: 1 }));
    },
    [setFilters],
  );

  const handleSpeciesChange = useCallback(
    (targetSpecies: string) => {
      setFilters((previous) => ({ ...previous, targetSpecies: targetSpecies || undefined, page: 1 }));
    },
    [setFilters],
  );

  const handleSortChange = useCallback(
    (sortBy: string) => {
      setFilters((previous) => ({ ...previous, sortBy: sortBy as SortKey, page: 1 }));
    },
    [setFilters],
  );

  return (
    <div
      className="min-h-screen text-[var(--text-main)]"
      style={{
        backgroundColor: 'var(--bg-page)',
        fontFamily: 'Inter, Outfit, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <nav className="sticky top-0 z-40 border-b border-[#ECE7DE] bg-white/90 shadow-[0_10px_30px_rgba(26,26,26,0.05)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/home"
            className="flex min-w-0 items-center gap-3 rounded-md pr-2 text-[var(--text-main)] transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
          >
            <BrandMark size="sm" />
            <span className="hidden leading-tight sm:block">
              <span className="block text-lg font-extrabold tracking-normal">PetMatch</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0F766E]">Store</span>
            </span>
          </Link>

          <div className="hidden items-center rounded-lg border border-[#EFEAE2] bg-[#FBFAF7] p-1 md:flex">
            {[
              { label: 'Khám phá', href: '/explore', icon: Search },
              { label: 'Yêu thích', href: '/favorites', icon: Heart },
              { label: 'Thú cưng', href: '/my-pets', icon: BadgeCheck },
            ].map((nav) => (
              <Link
                key={nav.label}
                href={nav.href}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--text-main)] hover:shadow-sm"
              >
                <nav.icon className="size-4" />
                {nav.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/spa"
              className="hidden h-10 items-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-semibold text-[var(--text-muted)] transition hover:border-[#EFEAE2] hover:bg-[#FBFAF7] hover:text-[var(--text-main)] sm:flex"
            >
              <Scissors className="size-4" />
              Spa
            </Link>
            <span className="hidden h-10 items-center gap-1.5 rounded-md border border-[rgba(228,93,28,0.18)] bg-[var(--bg-demo-box)] px-3 text-sm font-extrabold text-[var(--primary-color)] shadow-[0_10px_20px_rgba(228,93,28,0.10)] sm:flex">
              <Store className="size-4" />
              Cửa hàng
            </span>
            <button
              type="button"
              className="relative inline-flex size-10 items-center justify-center rounded-md border border-[#EFEAE2] bg-white text-[var(--text-main)] shadow-sm transition hover:border-[rgba(228,93,28,0.28)] hover:text-[var(--primary-color)]"
              aria-label="Giỏ hàng"
            >
              <ShoppingCart className="size-5" />
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--primary-color)] text-[10px] font-bold text-white shadow-sm">
                0
              </span>
            </button>
            <UserDropdown />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
        <section className="relative overflow-hidden rounded-lg bg-[#12312F] text-white shadow-[0_24px_70px_rgba(18,49,47,0.18)]">
          <div
            className="absolute inset-y-0 right-0 hidden w-1/2 bg-cover bg-center opacity-35 md:block"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1601758064224-c3c47ca4eb0e?w=1200&h=700&fit=crop')",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#12312F_0%,#12312F_46%,rgba(18,49,47,0.74)_72%,rgba(18,49,47,0.34)_100%)]" />

          <div className="relative grid gap-8 px-5 py-7 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:py-9">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-md bg-white/12 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#B9F4D7]">
                <Store className="size-3.5" />
                PetMatch Store
              </span>
              <h1 className="mt-4 max-w-xl text-3xl font-extrabold leading-tight tracking-normal sm:text-4xl">
                Cửa hàng thú cưng cho từng thói quen nhỏ mỗi ngày
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/78 sm:text-base">
                Lọc nhanh theo loài, danh mục và giá để chọn thức ăn, phụ kiện, đồ chơi, chăm sóc sức khỏe sản phẩm trong Shop.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { icon: BadgeCheck, label: `${meta.total || 16}+ sản phẩm` },
                  { icon: Truck, label: 'Giao nhanh nội thành' },
                  { icon: ShieldCheck, label: 'Thương hiệu chọn lọc' },
                ].map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-2 rounded-md bg-white/12 px-3 py-2 text-sm font-semibold text-white">
                    <item.icon className="size-4 text-[#B9F4D7]" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-end justify-start md:justify-end">
              <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/16 bg-white/12 p-4 backdrop-blur">
                  <p className="text-3xl font-extrabold">{featuredProducts.length || 4}</p>
                  <p className="mt-1 text-sm text-white/75">sản phẩm nổi bật</p>
                </div>
                <div className="rounded-lg border border-white/16 bg-white/12 p-4 backdrop-blur">
                  <p className="text-3xl font-extrabold">4.7</p>
                  <p className="mt-1 text-sm text-white/75">điểm yêu thích</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-main)]">Tìm đúng món cho bé</h2>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="flex items-center gap-2 rounded-md bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115E59]">
              <Sparkles className="size-4" />
              Tư vấn AI
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold text-[var(--text-main)] transition hover:bg-white"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <ShoppingCart className="size-4" />
              Giỏ hàng
              <span className="flex size-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-[10px] font-bold text-white">
                0
              </span>
            </button>
          </div>
        </section>

        <SearchFilterBar
          onSearch={handleSearch}
          onSpeciesChange={handleSpeciesChange}
          onSortChange={handleSortChange}
          species={filters.targetSpecies ?? ''}
          sortBy={filters.sortBy ?? 'popular'}
        />

        <CategoryTabs active={filters.category} onChange={handleCategoryChange} />

        <FeaturedSection products={featuredProducts} loading={featuredLoading} />

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 py-4 text-center text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <ProductGrid products={products} loading={loading} total={meta.total} />
      </main>
    </div>
  );
}
