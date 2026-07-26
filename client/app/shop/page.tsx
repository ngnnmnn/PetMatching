'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Grid3X3 } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useProducts } from '@/hooks/useProducts';
import ProductFilterSidebar from '@/components/home/ProductFilterSidebar';
import ProductGrid from '@/components/home/ProductGrid';
import SearchFilterBar from '@/components/home/SearchFilterBar';
import Footer from '@/components/layout/Footer';
import { cn } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc';

const QUICK_CATEGORIES = [
  { name: 'Thức ăn cho Chó', category: 'DOG_FOOD', icon: '🐶', desc: 'Dinh dưỡng cân bằng' },
  { name: 'Thức ăn cho Mèo', category: 'CAT_FOOD', icon: '🐱', desc: 'Hương vị yêu thích' },
  { name: 'Đồ chơi thú cưng', category: 'TOY', icon: '⚽', desc: 'Giải trí vui nhộn' },
  { name: 'Phụ kiện làm đẹp', category: 'ACCESSORY', icon: '🎒', desc: 'Thời trang cao cấp' },
  { name: 'Lồng & Đệm nằm', category: 'CAGE_BED', icon: '🛏️', desc: 'Ấm áp êm ái' },
  { name: 'Dây dắt & Vòng cổ', category: 'LEASH_COLLAR', icon: '🎗️', desc: 'An toàn đi dạo' },
];

const ITEMS_PER_PAGE = 12; // 3 rows, 4 products per row

function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category');

  const { products, loading, error, filters, setFilters } = useProducts({ 
    limit: 100,
    category: undefined 
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Apply category from URL query parameters (useful when clicking quick categories from Homepage)
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategories([initialCategory]);
      // Scroll down gently to target products grid
      const gridEl = document.getElementById('shop-main-grid');
      if (gridEl) {
        gridEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [initialCategory]);

  const initialSearch = searchParams.get('search');
  // Synchronize URL search parameters to product filters
  useEffect(() => {
    if (initialSearch !== null) {
      setFilters((previous) => ({ ...previous, search: initialSearch || undefined, page: 1 }));
    }
  }, [initialSearch, setFilters]);

  // Reset page to 1 when filters or selectedCategories/Prices change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategories, selectedPrices, filters.search, filters.targetSpecies]);

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

  // Client-side category and price filtering on full loaded catalog
  const filteredProducts = products.filter((product) => {
    // 1. Category filter
    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(product.category);

    if (!matchesCategory) return false;

    // 2. Price filter
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

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div
      className="min-h-screen text-[var(--text-main)] flex flex-col justify-between animate-in fade-in duration-300"
      style={{
        backgroundColor: 'var(--bg-page)',
        fontFamily: 'Inter, Outfit, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div className="w-full">
        <AppHeader sectionLabel="Cửa hàng" />

        <main id="shop-main-grid" className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
          {/* Quick Categories Section */}
          <section className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {QUICK_CATEGORIES.map((cat, idx) => {
                const isActive = selectedCategories.includes(cat.category);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (isActive) {
                        setSelectedCategories([]);
                      } else {
                        setSelectedCategories([cat.category]);
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center p-5 rounded-2xl border-2 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer group shadow-2xs",
                      isActive
                        ? "border-[var(--primary-color)] bg-orange-50/30 shadow-xs"
                        : "border-[#EFEAE2]/80 bg-[#FAF9F7] hover:bg-white hover:border-[var(--primary-color)] hover:shadow-xs"
                    )}
                  >
                    <span className="text-3xl mb-2.5 filter drop-shadow-xs group-hover:scale-110 transition-transform duration-300">
                      {cat.icon}
                    </span>
                    <span className="text-xs font-black text-[var(--text-main)] text-center">
                      {cat.name}
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)] font-extrabold mt-1 text-center">
                      {cat.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-black text-[var(--text-main)]">
                  <Grid3X3 className="size-6 text-[#0F766E]" />
                  Cửa hàng phụ kiện
                </h1>
                {!loading && (
                  <p className="mt-1 text-sm text-[var(--text-muted)] font-bold">
                    Tìm thấy {filteredProducts.length} sản phẩm phù hợp
                  </p>
                )}
              </div>
            </div>

            {/* Sidebar + Products Grid */}
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
                <SearchFilterBar
                  onSearch={handleSearch}
                  onSortChange={handleSortChange}
                  sortBy={filters.sortBy ?? 'popular'}
                />

                {error && (
                  <div className="rounded-xl border border-red-100 bg-red-50 py-4 text-center text-sm font-medium text-red-600">
                    {error}
                  </div>
                )}

                <ProductGrid products={paginatedProducts} loading={loading} />

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center pt-8 border-t border-[var(--border-color)]">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => {
                              setCurrentPage((prev) => Math.max(prev - 1, 1));
                              document.getElementById('shop-main-grid')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={cn(
                              "cursor-pointer",
                              currentPage === 1 && "pointer-events-none opacity-40"
                            )}
                          />
                        </PaginationItem>

                        {Array.from({ length: totalPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                isActive={pageNum === currentPage}
                                onClick={() => {
                                  setCurrentPage(pageNum);
                                  document.getElementById('shop-main-grid')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="cursor-pointer font-bold"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => {
                              setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                              document.getElementById('shop-main-grid')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={cn(
                              "cursor-pointer",
                              currentPage === totalPages && "pointer-events-none opacity-40"
                            )}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)] text-[var(--text-muted)] font-black text-sm">
        Đang tải cửa hàng...
      </div>
    }>
      <ShopPageContent />
    </Suspense>
  );
}
