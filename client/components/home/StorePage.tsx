'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Grid3X3 } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useProducts } from '@/hooks/useProducts';
import ProductFilterSidebar from './ProductFilterSidebar';
import FeaturedSection from './FeaturedSection';
import ProductGrid from './ProductGrid';
import SearchFilterBar from './SearchFilterBar';
import Hero from './Hero';
import Footer from '@/components/layout/Footer';

type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc';

export default function StorePage() {
  const router = useRouter();
  // Fetch up to 100 products to cover the entire catalog for precise client-side category and price range filtering
  const { products, featuredProducts, loading, featuredLoading, error, meta, filters, setFilters } = useProducts({ 
    limit: 100,
    category: undefined 
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);

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

  // Apply client-side category and price range filtering on fetched products list
  const filteredProducts = products.filter((product) => {
    // 1. Category check
    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(product.category);

    if (!matchesCategory) return false;

    // 2. Price range check
    const matchesPrice =
      selectedPrices.length === 0 ||
      selectedPrices.some((range) => {
        const price = product.salePrice ?? product.originalPrice;
        if (range === 'under_100k') return price < 100000;
        if (range === '100k_500k') return price >= 100000 && price <= 500000;
        if (range === '500k_1m') return price >= 500000 && price <= 1000000;
        if (range === 'over_1m') return price > 1000000;
        return false;
      });

    return matchesPrice;
  });

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
                {!loading && (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {filteredProducts.length} sản phẩm phù hợp
                  </p>
                )}
              </div>
            </div>

            {/* Sidebar + Products Grid layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 items-start">
              {/* Left Column: Filter Sidebar */}
              <div className="lg:col-span-1">
                <ProductFilterSidebar
                  species={filters.targetSpecies ?? ''}
                  selectedCategories={selectedCategories}
                  selectedPrices={selectedPrices}
                  onSpeciesChange={handleSpeciesChange}
                  onCategoriesChange={setSelectedCategories}
                  onPricesChange={setSelectedPrices}
                />
              </div>

              {/* Right Column: Search + Grid */}
              <div className="lg:col-span-3 space-y-6">
                <div id="search-filter-section" className="scroll-mt-6">
                  <SearchFilterBar
                    onSearch={handleSearch}
                    onSortChange={handleSortChange}
                    sortBy={filters.sortBy ?? 'popular'}
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-100 bg-red-50 py-4 text-center text-sm font-medium text-red-600">
                    {error}
                  </div>
                )}

                <ProductGrid products={filteredProducts} loading={loading} />
              </div>
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
