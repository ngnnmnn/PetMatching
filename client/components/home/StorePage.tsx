'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Grid3X3 } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useProducts } from '@/hooks/useProducts';
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


          <FeaturedSection products={featuredProducts} loading={featuredLoading} />

          {/* Tất cả sản phẩm Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-2xl sm:text-3xl font-black text-[var(--text-main)]">
                  <Grid3X3 className="size-6 text-[#0F766E]" />
                  Tất cả sản phẩm
                </h2>
                {!loading && <p className="mt-1 text-sm text-[var(--text-muted)]">{meta.total} sản phẩm phù hợp</p>}
              </div>
            </div>

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

            <ProductGrid products={products} loading={loading} />
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
