'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/context/CartContext';
import CategoryTabs from './CategoryTabs';
import FeaturedSection from './FeaturedSection';
import ProductGrid from './ProductGrid';
import SearchFilterBar from './SearchFilterBar';
import Hero from './Hero';
import Footer from '@/components/layout/Footer';

type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc';

export default function StorePage() {
  const router = useRouter();
  const { products, featuredProducts, loading, featuredLoading, error, meta, filters, setFilters } = useProducts();
  const { cartCount } = useCart();

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
      className="min-h-screen text-[var(--text-main)] flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--bg-page)',
        fontFamily: 'Inter, Outfit, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div className="w-full">
        <AppHeader sectionLabel="Store" />

        <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
          <Hero />

          <section className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-[var(--text-main)]">Tìm đúng món cho bé</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex items-center gap-2 rounded-md bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115E59] cursor-pointer"
              >
                <Sparkles className="size-4" />
                Tư vấn AI
              </button>
              <button
                type="button"
                onClick={() => router.push('/cart')}
                className="flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold text-[var(--text-main)] transition hover:bg-white cursor-pointer"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <ShoppingCart className="size-4" />
                Giỏ hàng
                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--primary-color)] text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              </button>
            </div>
          </section>

          <FeaturedSection products={featuredProducts} loading={featuredLoading} />

          <div id="search-filter-section" className="scroll-mt-6 space-y-8">
            <SearchFilterBar
              onSearch={handleSearch}
              onSpeciesChange={handleSpeciesChange}
              onSortChange={handleSortChange}
              species={filters.targetSpecies ?? ''}
              sortBy={filters.sortBy ?? 'popular'}
            />

            <CategoryTabs active={filters.category} onChange={handleCategoryChange} />
          </div>

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 py-4 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <ProductGrid products={products} loading={loading} total={meta.total} />
        </main>
      </div>
      <Footer />
    </div>
  );
}
