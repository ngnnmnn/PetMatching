'use client';

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Grid3X3, Sparkles, X, Loader2 } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useProducts } from '@/hooks/useProducts';
import ProductFilterSidebar from '@/components/home/ProductFilterSidebar';
import ProductGrid from '@/components/home/ProductGrid';
import { getProductLowestPrice, findRecommendedVariantForPet, isValidProductForRecommendation } from '@/components/home/ProductCard';
import SearchFilterBar from '@/components/home/SearchFilterBar';
import Footer from '@/components/layout/Footer';
import { productsApi } from '@/lib/api/products';
import { petsApi } from '@/lib/api/pets';
import { cn } from '@/lib/utils';
import { removeVietnameseTones } from '@/lib/hanoi-wards';
import { toast } from 'sonner';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating_desc' | 'discount_desc';

const ITEMS_PER_PAGE = 12; // 3 rows, 4 products per row

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

const getProductAvailability = (product: any) => {
  if (product.isActive === false) return 0;
  const activeVariants = product.variants?.filter((variant: any) => variant.isActive !== false);
  if (!activeVariants?.length) return product.variants?.length ? 0 : Number(product.stock || 0) > 0 ? 1 : 0;
  return activeVariants.reduce((stock: number, variant: any) => stock + Number(variant.stock || 0), 0) > 0 ? 1 : 0;
};

const getActivePrice = (product: any, pet: any) => {
  const variant = pet && findRecommendedVariantForPet(product, pet);
  return variant ? variant.salePrice ?? variant.sellingPrice : getProductLowestPrice(product);
};

const getDiscountPercent = (product: any) => {
  const lowest = getProductLowestPrice(product);
  return product.sellingPrice > 0 && lowest < product.sellingPrice
    ? Math.round(((product.sellingPrice - lowest) / product.sellingPrice) * 100)
    : 0;
};

/** Component giao diện chính trang Cửa hàng sản phẩm */
function ShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category');
  const initialSearch = searchParams.get('search') ?? '';

  const { products, loading, error, filters, setFilters } = useProducts({
    limit: 48,
    search: initialSearch || undefined,
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [customMinPrice, setCustomMinPrice] = useState<number | undefined>(undefined);
  const [customMaxPrice, setCustomMaxPrice] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(1);
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
      // Sử dụng petsApi.getMine() có tích hợp bộ nhớ đệm (TTL 5 phút)
      petsApi.getMine()
        .then((res) => {
          const nextPets = Array.isArray(res.data) ? res.data : [];
          setPets(nextPets);
          setSelectedPet((pet: any) =>
            pet && !nextPets.some(({ id }: any) => id === pet.id) ? null : pet,
          );
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

  useEffect(() => {
    const search = initialSearch || undefined;
    setSearchQuery(initialSearch);
    setFilters((previous) =>
      previous.search === search ? previous : { ...previous, search, page: 1 },
    );
  }, [initialSearch, setFilters]);

  // Reset page to 1 when filters or selectedCategories/selectedRating or custom min/max or selectedPet change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategories, selectedRating, customMinPrice, customMaxPrice, searchQuery, filters.targetSpecies, selectedPet]);

  /** Xử lý tìm kiếm từ khóa hỗ trợ cả có dấu và không dấu */
  const handleSearch = useCallback(
    (searchValue: string) => {
      setSearchQuery(searchValue);
      const search = searchValue.trim() || undefined;
      setFilters((previous) =>
        previous.search === search ? previous : { ...previous, search, page: 1 },
      );
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

  /** Đặt lại toàn bộ bộ lọc về trạng thái ban đầu */
  const handleClearAllFilters = useCallback(() => {
    setSelectedCategories([]);
    setSelectedRating(null);
    setCustomMinPrice(undefined);
    setCustomMaxPrice(undefined);
    setSelectedPet(null);
    setShowPetRow(false);
    setSearchQuery('');
    setCurrentPage(1);
    setFilters({ limit: 48, page: 1, sortBy: 'popular' });
    localStorage.removeItem('petmatch_shop_selected_pet');
    router.replace('/shop', { scroll: false });
  }, [router, setFilters]);

  // Kiểm tra xem có bộ lọc nào đang hoạt động hay không
  const hasActiveFilters = Boolean(
    (filters.targetSpecies && filters.targetSpecies !== 'ALL') ||
    selectedCategories.length > 0 ||
    selectedRating !== null ||
    customMinPrice !== undefined ||
    customMaxPrice !== undefined ||
    selectedPet !== null ||
    Boolean(searchQuery.trim())
  );

  useEffect(() => {
    window.addEventListener('shop-reset', handleClearAllFilters);
    return () => window.removeEventListener('shop-reset', handleClearAllFilters);
  }, [handleClearAllFilters]);

  // Client-side category, price, rating, search, and pet customization filtering on full loaded catalog
  const filteredProducts = useMemo(() => {
    const normalizedSearch = removeVietnameseTones(searchQuery.trim());
    const activePrices = new Map(products.map((product) => [product.id, getActivePrice(product, selectedPet)]));

    return products
      .filter((product) => {
      // 0. Tìm kiếm từ khóa không phân biệt có dấu / không dấu tiếng Việt
      if (normalizedSearch) {
        const normName = removeVietnameseTones(product.name || '');
        const normBrand = removeVietnameseTones(product.brand || '');
        const normDesc = removeVietnameseTones(product.description || '');
        if (!normName.includes(normalizedSearch) && !normBrand.includes(normalizedSearch) && !normDesc.includes(normalizedSearch)) {
          return false;
        }
      }

      // 1. Pet Customization Filter (species, weight, size, relevancy score)
      if (selectedPet) {
        // Kiểm tra độ tương thích tính điểm của sản phẩm với Thú cưng (Loại bỏ 100% sản phẩm rác như 'net', '1', '123', không có mô tả/thông số)
        if (!isValidProductForRecommendation(product, selectedPet)) {
          return false;
        }

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

      // 2. Category filter
      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(product.category);

      if (!matchesCategory) return false;

      // 3. Price filter: Lọc theo giá thực tế hiển thị trên thẻ (nếu có selectedPet thì lọc theo giá phân loại được gợi ý cho pet đó)
      const activePrice = activePrices.get(product.id) ?? 0;

      // Custom Min-Max Price filter (Kiểm tra xem giá phân loại hiển thị có nằm trong khoảng min-max người dùng chọn không)
      if (customMinPrice !== undefined && activePrice < customMinPrice) return false;
      if (customMaxPrice !== undefined && activePrice > customMaxPrice) return false;

      // 4. Rating filter: Lọc theo đánh giá tối thiểu của sản phẩm theo yêu cầu
      if (selectedRating !== null && selectedRating !== undefined) {
        const productRating = Number(product.rating || 0);
        if (productRating < selectedRating) return false;
      }

      return true;
      })
      .sort((a, b) => {
      // 1. Còn hàng / mở bán lên trước, hết hàng / tạm ngưng xuống cuối
      const availA = getProductAvailability(a);
      const availB = getProductAvailability(b);
      if (availB !== availA) return availB - availA;

      // 2. Nếu người dùng chọn tiêu chí sắp xếp cụ thể (tính theo giá thực tế hiển thị của sản phẩm)
      if (filters.sortBy === 'price_asc') {
        const pA = activePrices.get(a.id) ?? 0;
        const pB = activePrices.get(b.id) ?? 0;
        if (pA !== pB) return pA - pB;
      } else if (filters.sortBy === 'price_desc') {
        const pA = getProductLowestPrice(a);
        const pB = getProductLowestPrice(b);
        if (pA !== pB) return pB - pA;
      } else if (filters.sortBy === 'rating_desc') {
        // Sắp xếp theo đánh giá: rating sao cao hơn lên trước; cùng sao thì ai nhiều người đánh giá hơn lên trước
        const rateA = Number(a.rating || 0);
        const rateB = Number(b.rating || 0);
        if (rateB !== rateA) return rateB - rateA;
        const revA = Number(a.reviewCount || 0);
        const revB = Number(b.reviewCount || 0);
        if (revB !== revA) return revB - revA;
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      } else if (filters.sortBy === 'discount_desc') {
        // Sắp xếp theo giảm giá: hàng nào giảm giá nhiều hơn thì đẩy lên trên (% giảm giá cao hơn -> số tiền giảm)
        const discA = getDiscountPercent(a);
        const discB = getDiscountPercent(b);
        if (discB !== discA) return discB - discA;

        // Nếu cùng % giảm thì xét chênh lệch số tiền giảm nhiều hơn
        const diffA = (a.sellingPrice || 0) - getProductLowestPrice(a);
        const diffB = (b.sellingPrice || 0) - getProductLowestPrice(b);
        if (diffB !== diffA) return diffB - diffA;

        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      } else if (filters.sortBy === 'newest') {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (tB !== tA) return tB - tA;
      }

      // 3. Thứ tự hiển thị phân tầng theo yêu cầu:
      // Nổi bật -> Bán chạy -> Rating -> Các sản phẩm còn lại (nếu trùng xét tiếp mức thấp hơn)
      // Mức 1: Nổi bật (isFeatured)
      const featA = a.isFeatured ? 1 : 0;
      const featB = b.isFeatured ? 1 : 0;
      if (featB !== featA) return featB - featA;

      // Mức 2: Bán chạy (soldCount)
      const soldA = Number(a.soldCount || 0);
      const soldB = Number(b.soldCount || 0);
      if (soldB !== soldA) return soldB - soldA;

      // Mức 3: Rating & số lượt đánh giá
      const rateA = Number(a.rating || 0);
      const rateB = Number(b.rating || 0);
      if (rateB !== rateA) return rateB - rateA;

      const revA = Number(a.reviewCount || 0);
      const revB = Number(b.reviewCount || 0);
      if (revB !== revA) return revB - revA;

      // Mức 4: Các sản phẩm còn lại theo ngày tạo
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
      });
  }, [products, searchQuery, selectedPet, selectedCategories, customMinPrice, customMaxPrice, selectedRating, filters.sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-[#EFEAE2]">
              <div>
                <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-black text-[var(--text-main)]">
                  <Grid3X3 className="size-6 text-[#0F766E]" />
                  Cửa hàng
                </h1>
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
            {showPetRow && (
                <div className="animate-in fade-in slide-in-from-top-2 overflow-hidden border-b border-[#EFEAE2] dark:border-zinc-800">
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
                </div>
            )}

            {/* Sidebar + Products Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start mt-6">
              {/* Left Column: Filter Sidebar - Luôn hiển thị cố định */}
              <div className="lg:col-span-3">
                <ProductFilterSidebar
                  species={filters.targetSpecies ?? ''}
                  selectedCategories={selectedCategories}
                  selectedRating={selectedRating}
                  customMinPrice={customMinPrice}
                  customMaxPrice={customMaxPrice}
                  onSpeciesChange={handleSpeciesChange}
                  onCategoriesChange={setSelectedCategories}
                  onRatingChange={setSelectedRating}
                  onCustomPriceChange={(min, max) => {
                    setCustomMinPrice(min);
                    setCustomMaxPrice(max);
                    setCurrentPage(1);
                  }}
                  onClearAllFilters={handleClearAllFilters}
                  hasActiveFilters={hasActiveFilters}
                  dynamicCategories={dynamicSidebarCategories}
                />
              </div>

              {/* Right Column: Search + Grid */}
              <div className="space-y-6 lg:col-span-9 transition-all duration-300">
                <SearchFilterBar
                  value={searchQuery}
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
                  gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
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
