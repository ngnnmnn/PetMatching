'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid3X3, Sparkles, X, Loader2, Star, ShoppingCart, Heart, Filter } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/context/CartContext';
import ProductFilterSidebar from '@/components/home/ProductFilterSidebar';
import ProductGrid from '@/components/home/ProductGrid';
import SearchFilterBar from '@/components/home/SearchFilterBar';
import Footer from '@/components/layout/Footer';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

// Filter out test/system products (e.g. vouchers, shipping fees, debug products, gibberish keyboard mashes)
const isTestOrSystemProduct = (product: any) => {
  const nameLower = product.name.toLowerCase();
  const brandLower = (product.brand || '').toLowerCase();
  const descLower = (product.description || '').toLowerCase();

  const hasKeyword = (
    nameLower.includes('test') ||
    nameLower.includes('freeship') ||
    nameLower.includes('voucher') ||
    nameLower.includes('coupon') ||
    nameLower.includes('phí ship') ||
    nameLower.includes('phí vận chuyển') ||
    nameLower.includes('thử nghiệm') ||
    nameLower.includes('thu nghiem') ||
    nameLower.includes('nháp') ||
    nameLower.includes('nhap') ||
    nameLower.includes('demo') ||
    nameLower.includes('excel') ||
    brandLower.includes('test') ||
    brandLower.includes('demo') ||
    descLower.includes('test') ||
    descLower.includes('thử nghiệm') ||
    descLower.includes('demo')
  );

  if (hasKeyword) return true;

  const isGibberish = (str: string): boolean => {
    const s = str.toLowerCase();
    const mashes = [
      'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl', 'jklm',
      'ádf', 'sdf', 'dfg', 'fgh', 'ghj', 'hjk', 'jkl',
      'qwer', 'wert', 'erty', 'rtyu', 'tyui', 'yuio', 'uiop',
      'zxcv', 'xcvb', 'cvbn', 'vbnm',
      'abcde', 'bcdef', 'cdefg', 'defgh', 'efghi', 'fghij',
      'xyz', 'qwe', 'asd', 'zxc', 'abc', '123', '456', '789'
    ];
    if (mashes.some(m => s.includes(m))) return true;
    const clean = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (mashes.some(m => clean.includes(m))) return true;
    if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(clean)) return true;
    const words = clean.split(/[^a-z0-9]+/);
    for (const w of words) {
      if (w.length > 2 && !/[aeiouy0-9]/.test(w)) {
        return true;
      }
    }
    return false;
  };

  return isGibberish(product.name) || (product.brand && isGibberish(product.brand));
};

// Standard sizing weight range mappings (S, M, L, XL, XXL, XXXL) for pet accessories/clothes
const SIZE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  s: { min: 0, max: 4 },
  m: { min: 4, max: 8 },
  l: { min: 8, max: 15 },
  xl: { min: 15, max: 30 },
  xxl: { min: 30, max: 100 },
  xxxl: { min: 45, max: 150 },
};

// Filter out products with size specs that don't match the pet's weight
const isSizeCompatible = (product: any, petWeight: number) => {
  if (petWeight <= 0) return true;

  let sizeStr = '';

  // 1. Check specifications JSON
  if (product.specifications && typeof product.specifications === 'object') {
    const specs = product.specifications as Record<string, any>;
    const sizeKey = Object.keys(specs).find(k => {
      const kl = k.toLowerCase();
      return kl === 'size' || kl === 'kích thước' || kl === 'kích cỡ';
    });
    if (sizeKey && typeof specs[sizeKey] === 'string') {
      sizeStr = specs[sizeKey].trim().toLowerCase();
    }
  }

  // 2. Check product name or description
  if (!sizeStr) {
    const nameLower = product.name.toLowerCase();
    const sizeRegex = /\b(?:size|cỡ|kích\s*thước|kích\s*cỡ)\s+([sml]|xl|xxl|xxxl)\b/i;
    const match = nameLower.match(sizeRegex);
    if (match) {
      sizeStr = match[1].toLowerCase();
    } else {
      // Look for standalone size codes separated by space/dash/parentheses, e.g. " - S", "(S)"
      const nameParts = nameLower.split(/[-()]/);
      for (const part of nameParts) {
        const trimmed = part.trim();
        if (/^(s|m|l|xl|xxl|xxxl)$/i.test(trimmed)) {
          sizeStr = trimmed.toLowerCase();
          break;
        }
      }
    }
  }

  if (sizeStr) {
    const cleanSize = sizeStr.replace(/^(size|cỡ)\s+/i, '').trim();
    const range = SIZE_WEIGHT_RANGES[cleanSize];
    if (range) {
      return petWeight >= range.min && petWeight <= range.max;
    }
  }

  return true;
};

// Filter out products with weight constraints that don't fit the pet's weight
const isWeightCompatible = (product: any, petWeight: number) => {
  const text = `${product.name} ${product.description || ''}`.toLowerCase();
  
  // 1. Check max weight limits: e.g. "dưới 5kg", "tối đa 4kg", "<3kg", "3kg trở xuống"
  const underRegexes = [
    /dưới\s*(\d+(?:\.\d+)?)\s*kg/g,
    /tối\s*đa\s*(\d+(?:\.\d+)?)\s*kg/g,
    /<\s*(\d+(?:\.\d+)?)\s*kg/g,
    /(\d+(?:\.\d+)?)\s*kg\s*trở\s*xuống/g
  ];
  
  for (const regex of underRegexes) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const maxWeight = parseFloat(match[1]);
      if (!isNaN(maxWeight) && petWeight > maxWeight) {
        return false;
      }
    }
  }

  // 2. Check weight range limits: e.g. "1 - 3kg", "3-5 kg"
  const rangeRegex = /(\d+(?:\.\d+)?)\s*[-to]\s*(\d+(?:\.\d+)?)\s*kg/g;
  let rangeMatch;
  while ((rangeMatch = rangeRegex.exec(text)) !== null) {
    const minWeight = parseFloat(rangeMatch[1]);
    const maxWeight = parseFloat(rangeMatch[2]);
    if (!isNaN(minWeight) && !isNaN(maxWeight)) {
      if (petWeight > maxWeight || petWeight < minWeight) {
        return false;
      }
    }
  }

  return true;
};

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
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  // Pet customization state
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [showPetRow, setShowPetRow] = useState(false);

  // Product Preview Sidebar state
  const [activePreviewProduct, setActivePreviewProduct] = useState<any | null>(null);
  const [previewVariant, setPreviewVariant] = useState<any | null>(null);
  const { addToCart } = useCart();

  // Load user pets list
  const loadUserPets = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      api.get('/pets/my')
        .then((res) => {
          if (res.data) {
            setPets(res.data);
          }
        })
        .catch((err) => {
          console.error('Failed to load pets in shop', err);
        });
    }
  }, []);

  useEffect(() => {
    loadUserPets();
  }, [loadUserPets]);

  // Restore selected pet filter on mount (persists across product details navigation)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPet = localStorage.getItem('petmatch_shop_selected_pet');
      if (storedPet) {
        try {
          const pet = JSON.parse(storedPet);
          setSelectedPet(pet);
          setFilters((prev) => ({ ...prev, targetSpecies: pet.species }));
          setShowPetRow(false); // Collapsed on mount by default
        } catch (e) {
          console.error('Failed to parse stored pet filter:', e);
        }
      }
    }
  }, [setFilters]);

  // Save/remove selected pet filter in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedPet) {
        localStorage.setItem('petmatch_shop_selected_pet', JSON.stringify(selectedPet));
      } else {
        localStorage.removeItem('petmatch_shop_selected_pet');
      }
    }
  }, [selectedPet]);

  // Handle query parameter petId
  const queryPetId = searchParams.get('petId');
  useEffect(() => {
    if (queryPetId && pets.length > 0) {
      const foundPet = pets.find((p) => p.id === queryPetId);
      if (foundPet) {
        setSelectedPet(foundPet);
        setFilters((prev) => ({ ...prev, targetSpecies: foundPet.species }));
      }
    }
  }, [queryPetId, pets, setFilters]);

  // Preview Variant matching logic based on selected pet weight
  useEffect(() => {
    if (activePreviewProduct) {
      if (activePreviewProduct.variants && activePreviewProduct.variants.length > 0) {
        if (selectedPet && selectedPet.weight > 0) {
          const w = selectedPet.weight;
          const matched = activePreviewProduct.variants.find((v: any) => {
            const nameLower = v.name.toLowerCase();
            for (const [sizeKey, range] of Object.entries(SIZE_WEIGHT_RANGES)) {
              if (w >= range.min && w <= range.max) {
                const regex = new RegExp(`\\b(${sizeKey})\\b`, 'i');
                if (regex.test(nameLower)) return true;
              }
            }
            return false;
          });
          setPreviewVariant(matched || activePreviewProduct.variants[0]);
        } else {
          setPreviewVariant(activePreviewProduct.variants[0]);
        }
      } else {
        setPreviewVariant(null);
      }
    } else {
      setPreviewVariant(null);
    }
  }, [activePreviewProduct, selectedPet]);

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

  // Reset page to 1 when filters or selectedCategories/Prices or selectedPet change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategories, selectedPrices, filters.search, filters.targetSpecies, selectedPet]);

  const handleSearch = useCallback(
    (searchValue: string) => {
      setFilters((previous) => ({ ...previous, search: searchValue || undefined, page: 1 }));
    },
    [setFilters],
  );

  const handleSpeciesChange = useCallback(
    (targetSpecies: string) => {
      setFilters((previous) => ({ ...previous, targetSpecies: targetSpecies || undefined, page: 1 }));
      // Clear pet filter if user manually changes targetSpecies sidebar filter
      if (selectedPet && targetSpecies !== selectedPet.species) {
        setSelectedPet(null);
      }
    },
    [setFilters, selectedPet],
  );

  const handleSortChange = useCallback(
    (sortBy: string) => {
      setFilters((previous) => ({ ...previous, sortBy: sortBy as SortKey, page: 1 }));
    },
    [setFilters],
  );

  // Client-side category, price, and pet customization filtering on full loaded catalog
  const filteredProducts = products.filter((product) => {
    // 1. Filter out test/system products
    if (isTestOrSystemProduct(product)) return false;

    // 2. Pet Customization Filter (species, weight, size)
    if (selectedPet) {
      // Check target species (double check client-side)
      if (product.targetSpecies !== 'ALL' && product.targetSpecies !== selectedPet.species) {
        return false;
      }
      
      const petWeight = selectedPet.weight || 0;
      if (petWeight > 0) {
        if (!isWeightCompatible(product, petWeight)) return false;
        if (!isSizeCompatible(product, petWeight)) return false;
      }
    }

    // 3. Category filter
    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(product.category);

    if (!matchesCategory) return false;

    // 4. Price filter
    const matchesPrice =
      selectedPrices.length === 0 ||
      selectedPrices.some((range) => {
        const price = product.salePrice ?? product.sellingPrice;
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
      className="min-h-screen text-[var(--text-main)] flex flex-col justify-between animate-in fade-in duration-300 relative"
      style={{
        backgroundColor: 'var(--bg-page)',
        fontFamily: 'Inter, Outfit, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div className="w-full">
        <AppHeader sectionLabel="Cửa hàng" />

        <main
          id="shop-main-grid"
          className={cn(
            "mx-auto space-y-8 px-4 py-8 sm:px-6 transition-all duration-300",
            activePreviewProduct ? "max-w-[1600px]" : "max-w-7xl"
          )}
        >
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-[#EFEAE2]">
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

              {/* Custom Pet Filter Button */}
              <div className="flex items-center gap-2">
                {selectedPet && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-4 py-2 rounded-2xl shadow-2xs">
                    <span className="text-xs font-black text-orange-700 flex items-center gap-1.5 animate-pulse">
                      <Sparkles className="size-3.5 fill-orange-600/10 text-orange-600" />
                      Phù hợp cho {selectedPet.name} ({selectedPet.weight}kg)
                    </span>
                    <button
                      onClick={() => {
                        setSelectedPet(null);
                        setFilters((prev) => ({ ...prev, targetSpecies: undefined }));
                        if (searchParams.get('petId')) {
                          router.push('/shop');
                        }
                      }}
                      className="text-orange-400 hover:text-orange-600 cursor-pointer p-0.5 rounded-full hover:bg-orange-100/50 transition"
                      title="Hủy lọc theo pet"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}

                {/* Toggle Filter Button */}
                <button
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-2xl text-xs font-black transition active:scale-95 cursor-pointer border shadow-sm",
                    isFilterOpen
                      ? "bg-slate-100 border-slate-200 text-[var(--text-main)] hover:bg-slate-200"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-slate-50"
                  )}
                >
                  <Filter className="size-3.5 text-gray-500" />
                  {isFilterOpen ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
                </button>

                <button
                  onClick={() => {
                    try {
                      if (showPetRow) {
                        setSelectedPet(null);
                        setFilters((prev) => ({ ...prev, targetSpecies: undefined }));
                        if (searchParams.get('petId')) {
                          router.push('/shop');
                        }
                      } else {
                        loadUserPets();
                      }
                      setShowPetRow((prev) => !prev);
                    } catch (err: any) {
                      toast.error('Có lỗi xảy ra: ' + err.message);
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-2xl text-xs font-black transition active:scale-95 cursor-pointer shadow-md hover:shadow-lg",
                    showPetRow
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                      : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-orange-500/10"
                  )}
                >
                  <Sparkles className={cn("size-4", showPetRow ? "text-orange-500" : "text-white")} />
                  {showPetRow ? 'Đóng tùy chỉnh' : 'Tùy chỉnh theo thú cưng'}
                </button>
              </div>
            </div>

            {/* Slide-down Pet List Row directly below button */}
            <AnimatePresence>
              {showPetRow && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-[#EFEAE2] dark:border-zinc-800"
                >
                  <div className="py-4 space-y-2.5">
                    <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block">
                      Chọn thú cưng của bạn để nhận đề xuất kích cỡ:
                    </span>
                    
                    {pets.length === 0 ? (
                      <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs font-bold text-[var(--text-muted)]">
                        <span>🐶🐱</span>
                        <span>Bạn chưa có hồ sơ thú cưng hoặc chưa đăng nhập.</span>
                        <button
                          onClick={() => {
                            router.push('/login');
                          }}
                          className="ml-auto px-3.5 py-1.5 rounded-xl bg-orange-500 text-white text-[11px] font-black transition cursor-pointer"
                        >
                          Đăng nhập
                        </button>
                        <button
                          onClick={() => {
                            router.push('/my-pets/new');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[var(--text-main)] text-[11px] font-black transition cursor-pointer"
                        >
                          Tạo hồ sơ
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-2.5 scrollbar-thin">
                        {pets.map((pet) => {
                          const isSelected = selectedPet?.id === pet.id;
                          return (
                            <button
                              key={pet.id}
                              onClick={() => {
                                setSelectedPet(pet);
                                setFilters((prev) => ({ ...prev, targetSpecies: pet.species }));
                                setSelectedCategories([]); // Clear category filter to show all matches
                              }}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-2xl border transition text-left cursor-pointer shrink-0 min-w-[200px] group",
                                isSelected
                                  ? "border-orange-500 bg-orange-50/50 dark:bg-zinc-800/30 shadow-xs"
                                  : "border-[#EFEAE2] dark:border-zinc-800 hover:border-orange-300 bg-white dark:bg-zinc-900"
                              )}
                            >
                              <div className="size-10 rounded-full overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                {pet.avatarUrl || pet.gallery?.[0] ? (
                                  <img
                                    src={pet.avatarUrl || pet.gallery[0]}
                                    alt={pet.name}
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <span className="text-lg">{pet.species === 'DOG' ? '🐶' : '🐱'}</span>
                                )}
                              </div>
                              <div className="space-y-0.5">
                                <h4 className="text-xs font-black text-[var(--text-main)] group-hover:text-orange-600 transition">
                                  {pet.name}
                                </h4>
                                <p className="text-[10px] font-bold text-[var(--text-muted)]">
                                  {pet.breed} · {pet.weight}kg
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sidebar + Products Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start mt-6">
              {/* Left Column: Filter Sidebar */}
              {isFilterOpen && (
                <div className="lg:col-span-3">
                  <ProductFilterSidebar
                    species={filters.targetSpecies ?? ''}
                    selectedCategories={selectedCategories}
                    selectedPrices={selectedPrices}
                    onSpeciesChange={handleSpeciesChange}
                    onCategoriesChange={setSelectedCategories}
                    onPricesChange={setSelectedPrices}
                  />
                </div>
              )}

              {/* Right Column: Search + Grid */}
              <div
                className={cn(
                  "space-y-6 transition-all duration-300",
                  isFilterOpen
                    ? activePreviewProduct
                      ? "lg:col-span-5"
                      : "lg:col-span-9"
                    : activePreviewProduct
                    ? "lg:col-span-8"
                    : "lg:col-span-12"
                )}
              >
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

                <ProductGrid
                  products={paginatedProducts}
                  loading={loading}
                  selectedPet={selectedPet}
                  onPreviewClick={(prod) => {
                    setActivePreviewProduct(prod);
                  }}
                  isPreviewOpen={!!activePreviewProduct}
                  gridClassName={
                    activePreviewProduct
                      ? isFilterOpen
                        ? "grid grid-cols-1 sm:grid-cols-2 gap-6"
                        : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"
                      : isFilterOpen
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                      : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                  }
                />

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

              {/* Product Preview Sidebar (Right Column) */}
              {activePreviewProduct && (
                <div className="hidden lg:block lg:col-span-4 space-y-6 bg-white dark:bg-zinc-900 border-2 border-orange-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl animate-in slide-in-from-right duration-350 sticky top-28 self-start animate-fadeIn max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-thin">
                  <div className="flex items-center justify-between border-b pb-3 border-[#EFEAE2] dark:border-zinc-800">
                    <h3 className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5">
                      <Sparkles className="size-4 text-orange-500 fill-orange-500/10 animate-pulse" />
                      Chi tiết sản phẩm nhanh
                    </h3>
                    <button
                      onClick={() => setActivePreviewProduct(null)}
                      className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 cursor-pointer transition"
                    >
                      <X className="size-4.5" />
                    </button>
                  </div>

                  {/* Two Column Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Left Column: Image and matched size badge */}
                    <div className="space-y-4">
                      <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-50 border border-gray-100 shadow-2xs">
                        <img
                          src={previewVariant?.imageUrl || activePreviewProduct.imageUrl || '/placeholder.svg'}
                          alt={activePreviewProduct.name}
                          className="size-full object-cover"
                        />
                        
                        {/* Badge matched weight */}
                        {(() => {
                          const isPreviewMatched = !!(
                            selectedPet &&
                            selectedPet.weight > 0 &&
                            previewVariant &&
                            activePreviewProduct?.variants?.length > 0 &&
                            (() => {
                              const w = selectedPet.weight;
                              const nameLower = previewVariant.name.toLowerCase();
                              for (const [sizeKey, range] of Object.entries(SIZE_WEIGHT_RANGES)) {
                                if (w >= range.min && w <= range.max) {
                                  const regex = new RegExp(`\\b(${sizeKey})\\b`, 'i');
                                  if (regex.test(nameLower)) return true;
                                }
                              }
                              return false;
                            })()
                          );

                          if (isPreviewMatched) {
                            return (
                              <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-[10px] font-black text-white px-2.5 py-1.5 shadow-md">
                                <Sparkles className="size-3 fill-white/20 animate-pulse" />
                                Phù hợp cho {selectedPet.name}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {activePreviewProduct.description && (
                        <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
                          <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                            Mô tả sản phẩm:
                          </span>
                          <p className="text-xs text-[var(--text-main)] leading-relaxed line-clamp-4">
                            {activePreviewProduct.description}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Info details and cart operations */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#0F766E]">
                          {activePreviewProduct.brand || 'PetMatch'}
                        </p>
                        <h4 className="text-lg font-black text-[var(--text-main)] leading-6 mt-1">
                          {activePreviewProduct.name}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 text-xs border-b pb-3 border-[#EFEAE2] dark:border-zinc-800">
                        <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                          <Star className="size-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                          <span className="font-semibold text-[var(--text-main)]">
                            {activePreviewProduct.rating.toFixed(1)}
                          </span>
                          <span>({activePreviewProduct.reviewCount} đánh giá)</span>
                        </span>
                        {activePreviewProduct.unit && (
                          <span className="text-[var(--text-muted)] font-bold">
                            Đơn vị: {activePreviewProduct.unit}
                          </span>
                        )}
                      </div>

                      {/* Variant Selector */}
                      {activePreviewProduct.variants && activePreviewProduct.variants.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider block">
                            Chọn kích cỡ / phân loại:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {activePreviewProduct.variants.map((v: any) => {
                              const isSelected = previewVariant?.id === v.id;
                              
                              // Check if this specific chip is matched by pet weight
                              const isChipMatched = selectedPet && selectedPet.weight > 0 && (() => {
                                const w = selectedPet.weight;
                                const nameLower = v.name.toLowerCase();
                                for (const [sizeKey, range] of Object.entries(SIZE_WEIGHT_RANGES)) {
                                  if (w >= range.min && w <= range.max) {
                                    const regex = new RegExp(`\\b(${sizeKey})\\b`, 'i');
                                    if (regex.test(nameLower)) return true;
                                  }
                                }
                                return false;
                              })();

                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => setPreviewVariant(v)}
                                  className={cn(
                                    "px-3 py-1.5 text-xs font-black rounded-xl border transition cursor-pointer flex items-center gap-1.5",
                                    isSelected
                                      ? "border-[var(--primary-color)] bg-[var(--primary-color)]/10 text-[var(--primary-color)] shadow-xs"
                                      : isChipMatched
                                      ? "border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                      : "border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-600"
                                  )}
                                >
                                  {isChipMatched && <Sparkles className="size-3 fill-current animate-pulse" />}
                                  {v.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Price and Stock */}
                      <div className="bg-orange-50/20 dark:bg-zinc-950/40 p-4 rounded-2xl border border-orange-100/50 dark:border-zinc-800/80 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[var(--text-muted)] mb-1">Giá bán:</span>
                          <span className="text-xl font-black text-[var(--primary-color)]">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
                              previewVariant ? (previewVariant.salePrice ?? previewVariant.sellingPrice) : (activePreviewProduct.salePrice ?? activePreviewProduct.sellingPrice)
                            )}
                          </span>
                          {(() => {
                            const currentItem = previewVariant || activePreviewProduct;
                            if (currentItem.salePrice && currentItem.salePrice < currentItem.sellingPrice) {
                              return (
                                <span className="text-xs text-[var(--text-muted)] line-through mt-0.5">
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(currentItem.sellingPrice)}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-[var(--text-muted)] block mb-1">Tình trạng:</span>
                          <span className="text-xs font-black text-[var(--text-main)] bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 px-3 py-1.5 rounded-xl">
                            Còn {previewVariant !== null && previewVariant !== undefined ? previewVariant.stock : activePreviewProduct.stock} sản phẩm
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 space-y-3">
                        <button
                          onClick={() => {
                            const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
                            if (!token) {
                              toast.error('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
                              router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
                              return;
                            }
                            addToCart(activePreviewProduct, 1, false, previewVariant?.id);
                            toast.success(`Đã thêm sản phẩm "${activePreviewProduct.name}${previewVariant ? ` (${previewVariant.name})` : ''}" vào giỏ hàng!`);
                          }}
                          disabled={activePreviewProduct.stock === 0 || (previewVariant && previewVariant.stock === 0)}
                          className={cn(
                            "w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-black text-white transition active:scale-95 cursor-pointer shadow-md",
                            (activePreviewProduct.stock === 0 || (previewVariant && previewVariant.stock === 0))
                              ? "bg-gray-400 cursor-not-allowed opacity-80"
                              : "bg-[var(--primary-color)] hover:bg-[#cf5017] shadow-orange-500/10"
                          )}
                        >
                          <ShoppingCart className="size-4" />
                          Thêm vào giỏ hàng
                        </button>

                        <button
                          onClick={() => {
                            router.push(`/home/product/${activePreviewProduct.id}${previewVariant ? `?variantId=${previewVariant.id}` : ''}`);
                          }}
                          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-black border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 text-[var(--text-main)] transition cursor-pointer"
                        >
                          Xem chi tiết sản phẩm đầy đủ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
