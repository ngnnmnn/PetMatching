'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid3X3, Sparkles, X, Loader2, Filter } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useProducts } from '@/hooks/useProducts';
import ProductFilterSidebar from '@/components/home/ProductFilterSidebar';
import ProductGrid from '@/components/home/ProductGrid';
import SearchFilterBar from '@/components/home/SearchFilterBar';
import Footer from '@/components/layout/Footer';
import api from '@/lib/axios';
import { productsApi } from '@/lib/api/products';
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

/** Kiểm tra sản phẩm thử nghiệm hoặc rác hệ thống để ẩn khỏi danh sách hiển thị */
const isTestOrSystemProduct = (product: any) => {
  const nameLower = product.name.toLowerCase();

  const hasKeyword = (
    nameLower.includes('test demo') ||
    nameLower.includes('freeship') ||
    nameLower.includes('voucher test') ||
    nameLower.includes('phí ship') ||
    nameLower.includes('phí vận chuyển') ||
    nameLower.includes('sản phẩm thử nghiệm')
  );

  if (hasKeyword) return true;

  const isGibberish = (str: string): boolean => {
    const s = str.toLowerCase();
    const mashes = [
      'asdfgh', 'sdfghj', 'dfghjk', 'fghjkl',
      'qwerty', 'wertyu', 'ertyui', 'rtyuio',
      'zxcvbn'
    ];
    if (mashes.some(m => s.includes(m))) return true;
    return false;
  };

  return isGibberish(product.name);
};

// Bảng ánh xạ khoảng cân nặng tiêu chuẩn theo size sản phẩm
const SIZE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  s: { min: 0, max: 4 },
  m: { min: 4, max: 8 },
  l: { min: 8, max: 15 },
  xl: { min: 15, max: 30 },
  xxl: { min: 30, max: 100 },
  xxxl: { min: 45, max: 150 },
};

/** Kiểm tra xem kích thước sản phẩm có phù hợp với cân nặng của thú cưng hay không */
const isSizeCompatible = (product: any, petWeight: number) => {
  if (petWeight <= 0) return true;

  let sizeStr = '';

  // 1. Kiểm tra thông số kỹ thuật JSON
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

  // 2. Kiểm tra tên hoặc mô tả sản phẩm
  if (!sizeStr) {
    const nameLower = product.name.toLowerCase();
    const sizeRegex = /\b(?:size|cỡ|kích\s*thước|kích\s*cỡ)\s+([sml]|xl|xxl|xxxl)\b/i;
    const match = nameLower.match(sizeRegex);
    if (match) {
      sizeStr = match[1].toLowerCase();
    } else {
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

/** Kiểm tra sản phẩm có giới hạn cân nặng phù hợp với thú cưng hay không */
const isWeightCompatible = (product: any, petWeight: number) => {
  const text = `${product.name} ${product.description || ''}`.toLowerCase();
  
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

/** Component giao diện chính trang Cửa hàng sản phẩm */
function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category');

  const { products, loading, error, filters, setFilters } = useProducts({ 
    limit: 48,
    category: undefined 
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [dbCategories, setDbCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  // Pet customization state
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [showPetRow, setShowPetRow] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingPets, setIsLoadingPets] = useState(false);

  /** Tải danh sách toàn bộ các danh mục sản phẩm động từ CSDL */
  useEffect(() => {
    productsApi.getCategories()
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setDbCategories(res.data);
        }
      })
      .catch((err) => console.error('Lỗi khi tải danh mục sản phẩm từ CSDL', err));
  }, []);

  /** Tải danh sách hồ sơ thú cưng của người dùng đã đăng nhập */
  const loadUserPets = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    setIsLoggedIn(!!token);
    if (token) {
      setIsLoadingPets(true);
      api.get('/pets/my')
        .then((res) => {
          if (res.data) {
            setPets(Array.isArray(res.data) ? res.data : []);
          }
        })
        .catch((err) => {
          console.error('Failed to load pets in shop', err);
        })
        .finally(() => {
          setIsLoadingPets(false);
        });
    } else {
      setPets([]);
      setIsLoadingPets(false);
    }
  }, []);

  useEffect(() => {
    loadUserPets();
  }, [loadUserPets]);

  // Listen to auth changes (e.g. logout/login) to clear or update pet filter
  useEffect(() => {
    const handleAuthChange = () => {
      const token = localStorage.getItem('accessToken');
      setIsLoggedIn(!!token);
      if (!token) {
        setSelectedPet(null);
        localStorage.removeItem('petmatch_shop_selected_pet');
        setPets([]);
      } else {
        loadUserPets();
      }
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, [loadUserPets]);

  // Restore selected pet filter on mount (only if user is logged in)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        localStorage.removeItem('petmatch_shop_selected_pet');
        setSelectedPet(null);
        return;
      }
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

  // Validate selectedPet against user's current pets or login state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        if (selectedPet) {
          setSelectedPet(null);
          localStorage.removeItem('petmatch_shop_selected_pet');
        }
      } else if (pets.length > 0 && selectedPet) {
        const belongsToUser = pets.some((p) => p.id === selectedPet.id);
        if (!belongsToUser) {
          setSelectedPet(null);
          localStorage.removeItem('petmatch_shop_selected_pet');
        }
      }
    }
  }, [pets, selectedPet]);

  // Save/remove selected pet filter in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (selectedPet && token) {
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

  const resetShop = useCallback(() => {
    setSelectedCategories([]);
    setSelectedPrices([]);
    setSelectedPet(null);
    setShowPetRow(false);
    setCurrentPage(1);
    setFilters({ limit: 48, page: 1, sortBy: 'popular' });
    setFilterResetKey((key) => key + 1);
    localStorage.removeItem('petmatch_shop_selected_pet');
    router.replace('/shop', { scroll: false });
  }, [router, setFilters]);

  useEffect(() => {
    window.addEventListener('shop-reset', resetShop);
    return () => window.removeEventListener('shop-reset', resetShop);
  }, [resetShop]);

  /** Kiểm tra khả năng mở bán và tồn kho thực tế của sản phẩm (khớp theo khoảng giá nếu có) */
  const getProductAvailability = (p: any): number => {
    if (p.isActive === false) return 0;
    if (p.variants && p.variants.length > 0) {
      // Nếu đang lọc theo khoảng giá, kiểm tra xem có phân loại nào VỪA CÒN HÀNG VỪA KHỚP GIÁ không
      if (selectedPrices && selectedPrices.length > 0) {
        const hasInStockMatchingVariant = p.variants.some((v: any) => {
          if (v.isActive === false || Number(v.stock || 0) <= 0) return false;
          const price = v.salePrice ?? v.sellingPrice;
          return selectedPrices.some((range) => {
            if (range === 'under_100k') return price < 100000;
            if (range === '100k_500k') return price >= 100000 && price <= 500000;
            if (range === '500k_1m') return price >= 500000 && price <= 1000000;
            if (range === 'over_1m') return price > 1000000;
            return false;
          });
        });
        if (hasInStockMatchingVariant) return 1;
        return 0; // Phân loại khớp giá đã HẾT HÀNG -> Đẩy xuống cuối!
      }

      const activeVars = p.variants.filter((v: any) => v.isActive !== false);
      if (activeVars.length === 0) return 0;
      const totalStock = activeVars.reduce((sum: number, v: any) => sum + Number(v.stock || 0), 0);
      return totalStock > 0 ? 1 : 0;
    }
    return Number(p.stock || 0) > 0 ? 1 : 0;
  };

  // Client-side category, price, and pet customization filtering on full loaded catalog
  const filteredProducts = products
    .filter((product) => {
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

    // 4. Price filter based on min effective price of product or its active variants
    const getEffectiveProductPrice = (p: any) => {
      if (p.variants && p.variants.length > 0) {
        const activeVars = p.variants.filter((v: any) => v.isActive !== false);
        const vars = activeVars.length > 0 ? activeVars : p.variants;
        const prices = vars.map((v: any) => v.salePrice ?? v.sellingPrice).filter((pr: number) => pr > 0);
        if (prices.length > 0) {
          return Math.min(...prices);
        }
      }
      return p.salePrice ?? (p.sellingPrice || 0);
    };

    const matchesPrice =
      selectedPrices.length === 0 ||
      selectedPrices.some((range) => {
        const price = getEffectiveProductPrice(product);
        if (range === 'under_100k') return price < 100000;
        if (range === '100k_500k') return price >= 100000 && price <= 500000;
        if (range === '500k_1m') return price >= 500000 && price <= 1000000;
        if (range === 'over_1m') return price > 1000000;
        return false;
      });

    return matchesPrice;
  })
  .sort((a, b) => {
    // Đẩy các sản phẩm hết hàng hoặc tạm ngưng bán xuống CUỐI DANH SÁCH
    const availA = getProductAvailability(a);
    const availB = getProductAvailability(b);
    return availB - availA;
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Map icons cho từng danh mục dựa trên tên/slug
  const getCategoryIcon = (slugOrName: string) => {
    const s = slugOrName.toLowerCase();
    if (s.includes('cho') || s.includes('dog')) return '🐶';
    if (s.includes('meo') || s.includes('cat')) return '🐱';
    if (s.includes('choi') || s.includes('toy')) return '⚽';
    if (s.includes('kien') || s.includes('accessory')) return '🎒';
    if (s.includes('chuong') || s.includes('dem') || s.includes('bed') || s.includes('cage')) return '🛏️';
    if (s.includes('day') || s.includes('co') || s.includes('leash')) return '🎗️';
    if (s.includes('grooming') || s.includes('tam') || s.includes('ve sinh')) return '🪮';
    if (s.includes('thuoc') || s.includes('y te') || s.includes('suc khoe')) return '💊';
    return '🐾';
  };

  const dynamicQuickCategories = dbCategories.length > 0
    ? dbCategories.map((cat) => ({
        name: cat.name,
        category: cat.slug || cat.name,
        icon: getCategoryIcon(cat.slug || cat.name),
        desc: 'Sản phẩm chất lượng',
      }))
    : QUICK_CATEGORIES;

  const dynamicSidebarCategories = dbCategories.length > 0
    ? dbCategories.map((cat) => ({
        value: cat.slug || cat.name,
        label: cat.name,
      }))
    : undefined;

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
          className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 transition-all duration-300"
        >
          {/* Quick Categories Section - Single Row Horizontal Scroll */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scroll-smooth">
              {dynamicQuickCategories.map((cat, idx) => {
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
                      "flex flex-col items-center justify-center p-4 min-w-[140px] sm:min-w-[160px] rounded-2xl border-2 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer group shadow-2xs shrink-0 select-none",
                      isActive
                        ? "border-[var(--primary-color)] bg-orange-50/40 shadow-xs"
                        : "border-[#EFEAE2]/80 bg-[#FAF9F7] hover:bg-white hover:border-[var(--primary-color)] hover:shadow-xs"
                    )}
                  >
                    <span className="text-2xl mb-1.5 filter drop-shadow-xs group-hover:scale-110 transition-transform duration-300">
                      {cat.icon}
                    </span>
                    <span className="text-xs font-black text-[var(--text-main)] text-center whitespace-nowrap">
                      {cat.name}
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)] font-extrabold mt-0.5 text-center whitespace-nowrap">
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
                    
                    {isLoadingPets ? (
                      <div className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs font-bold text-[var(--text-muted)]">
                        <Loader2 className="size-4 animate-spin text-orange-500" />
                        <span>Đang tải danh sách thú cưng của bạn...</span>
                      </div>
                    ) : !isLoggedIn ? (
                      <div className="flex items-center gap-3 bg-amber-50/60 dark:bg-zinc-950 p-4 rounded-2xl border border-amber-200/70 dark:border-zinc-800 text-xs font-bold text-amber-900 dark:text-amber-200">
                        <span>🐶🐱</span>
                        <span>Bạn chưa đăng nhập. Vui lòng đăng nhập để chọn thú cưng và nhận gợi ý phù hợp.</span>
                        <button
                          onClick={() => {
                            router.push('/login');
                          }}
                          className="ml-auto px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-black transition cursor-pointer shadow-xs shrink-0"
                        >
                          Đăng nhập
                        </button>
                      </div>
                    ) : pets.length === 0 ? (
                      <div className="flex items-center gap-3 bg-orange-50/50 dark:bg-zinc-950 p-4 rounded-2xl border border-orange-200/60 dark:border-zinc-800 text-xs font-bold text-orange-900 dark:text-orange-200">
                        <span>🐶🐱</span>
                        <span>Tài khoản của bạn chưa có hồ sơ thú cưng nào. Hãy tạo hồ sơ để nhận đề xuất sản phẩm & kích cỡ phù hợp!</span>
                        <button
                          onClick={() => {
                            router.push('/my-pets/new');
                          }}
                          className="ml-auto px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-black transition cursor-pointer shadow-xs shrink-0"
                        >
                          + Tạo hồ sơ thú cưng
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
                    dynamicCategories={dynamicSidebarCategories}
                  />
                </div>
              )}

              {/* Right Column: Search + Grid */}
              <div
                className={cn(
                  "space-y-6 transition-all duration-300",
                  isFilterOpen ? "lg:col-span-9" : "lg:col-span-12"
                )}
              >
                <SearchFilterBar
                  key={filterResetKey}
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
                  selectedPrices={selectedPrices}
                  gridClassName={
                    isFilterOpen
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
