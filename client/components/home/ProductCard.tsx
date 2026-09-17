'use client';

import Link from 'next/link';
import { PackageCheck, Star } from 'lucide-react';
import { Product } from '@/types';
import { cn } from '@/lib/utils';

/**
 * Định dạng số tiền theo chuẩn tiền tệ Việt Nam (VNĐ)
 */
function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Tính toán phần trăm giảm giá dựa trên giá bán gốc và giá khuyến mãi
 */
function getDiscountPercent(item: { sellingPrice: number; salePrice?: number | null }) {
  if (!item.salePrice || item.salePrice >= item.sellingPrice) {
    return null;
  }
  return Math.round(((item.sellingPrice - item.salePrice) / item.sellingPrice) * 100);
}

/**
 * Lấy mức giá thấp nhất của một sản phẩm:
 * Tìm giá nhỏ nhất trong các phân loại đang mở bán (isActive !== false),
 * hoặc giá của sản phẩm gốc nếu không có phân loại.
 */
export function getProductLowestPrice(product: any): number {
  if (!product) return 0;

  const candidatePrices: number[] = [];

  // Lấy giá từ các phân loại sản phẩm đang hoạt động
  if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
    const activeVariants = product.variants.filter((v: any) => v.isActive !== false);
    for (const v of activeVariants) {
      const p = v.salePrice ?? v.sellingPrice;
      if (typeof p === 'number' && p > 0) {
        candidatePrices.push(p);
      }
    }
  }

  // Lấy giá của sản phẩm gốc
  const basePrice = product.salePrice ?? product.sellingPrice;
  if (typeof basePrice === 'number' && basePrice > 0) {
    if (candidatePrices.length === 0) {
      candidatePrices.push(basePrice);
    }
  }

  if (candidatePrices.length > 0) {
    return Math.min(...candidatePrices);
  }

  return 0;
}

/** Ngưỡng điểm tương thích tối thiểu để một sản phẩm được xuất hiện trong danh sách Gợi ý theo Pet */
export const MIN_PET_MATCH_SCORE = 30;

/**
 * Thuật toán tính điểm độ tương thích (Relevancy Match Score) giữa Sản phẩm và Thú cưng được chọn.
 * Loại bỏ 100% các sản phẩm rác, thiếu thông tin (như 'net', '1', '123', không mô tả/thông số).
 */
export function computePetMatchScore(product: any, pet: any): number {
  if (!product || !product.name || !pet) return 0;
  if (product.isActive === false) return 0;

  const trimmedName = String(product.name).trim();
  const lowerName = trimmedName.toLowerCase();
  const lowerDesc = String(product.description || '').toLowerCase();
  const fullText = `${lowerName} ${lowerDesc}`;

  // 1. Kiểm tra loại sản phẩm và loài thú cưng (Target Species Match)
  let score = 0;
  if (product.targetSpecies === pet.species) {
    score += 30; // Chuyên dùng riêng cho loài này -> +30 điểm
  } else if (product.targetSpecies === 'ALL') {
    score += 10; // Dùng chung -> +10 điểm
  } else {
    return 0; // Khác loài hoàn toàn -> 0 điểm
  }

  // 2. Kiểm tra từ khóa Giống loài (Breed Match - Ví dụ: Poodle, Corgi, Mèo Anh)
  if (pet.breed) {
    const breedLower = String(pet.breed).toLowerCase().trim();
    if (breedLower.length > 2 && fullText.includes(breedLower)) {
      score += 50;
    }
  }

  // 3. Kiểm tra thông số Kích cỡ / Cân nặng / Phân loại (Size & Weight Match)
  const petWeight = Number(pet.weight || 0);
  let hasSizeMatch = false;

  if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
    const activeVariants = product.variants.filter((v: any) => v.isActive !== false);
    for (const v of activeVariants) {
      const vName = String(v.name || '').toLowerCase();
      if (petWeight < 5) {
        if (vName.includes('size s') || vName.includes('500g') || vName.includes('200g') || vName.includes('1kg') || vName.includes('nhỏ')) {
          hasSizeMatch = true;
          break;
        }
      } else if (petWeight >= 5 && petWeight <= 12) {
        if (vName.includes('size m') || vName.includes('1.5kg') || vName.includes('2kg') || vName.includes('vừa')) {
          hasSizeMatch = true;
          break;
        }
      } else {
        if (vName.includes('size l') || vName.includes('3kg') || vName.includes('4kg') || vName.includes('5kg') || vName.includes('10kg') || vName.includes('lớn')) {
          hasSizeMatch = true;
          break;
        }
      }
    }
  }

  if (hasSizeMatch) {
    score += 35;
  } else if (petWeight > 0) {
    const hasSpecs = product.specifications && typeof product.specifications === 'object' && Object.keys(product.specifications).length > 0;
    const hasSizeKeywords = /\b(size|cỡ|kích thước|kg|gram|g|bao|hộp|gói)\b/i.test(fullText);
    if (hasSpecs || hasSizeKeywords) {
      score += 20;
    }
  }

  // 4. Đánh giá chất lượng dữ liệu sản phẩm (Chặn sản phẩm không mô tả/tên vô nghĩa)
  if (trimmedName.length < 3 || /^\d+$/.test(trimmedName)) {
    return 0; // Tên quá ngắn hoặc toàn số -> 0 điểm
  }

  if (product.brand && product.brand.trim() && product.brand !== 'PetMatch') {
    score += 10;
  }
  if (lowerDesc.length > 15) {
    score += 10;
  }

  return score;
}

/**
 * Kiểm tra xem sản phẩm có phải là sản phẩm chuẩn hợp lệ hay không.
 */
export function isValidProductForRecommendation(product: any, pet?: any): boolean {
  if (!product || !product.name) return false;
  if (product.isActive === false) return false;

  if (pet) {
    const score = computePetMatchScore(product, pet);
    return score >= MIN_PET_MATCH_SCORE;
  }

  const trimmedName = String(product.name).trim();
  if (trimmedName.length < 3 || /^\d+$/.test(trimmedName)) return false;

  return true;
}

/**
 * Tự động tìm kiếm phân loại (Variant) phù hợp nhất của sản phẩm dựa trên cân nặng và thể trạng của thú cưng được chọn
 */
export function findRecommendedVariantForPet(product: any, pet: any): any | null {
  if (!product || !product.variants || !Array.isArray(product.variants) || product.variants.length === 0) {
    return null;
  }
  const activeVariants = product.variants.filter((v: any) => v.isActive !== false);
  if (activeVariants.length === 0) return null;

  if (!pet || pet.weight === undefined || pet.weight === null) {
    return activeVariants[0];
  }

  const w = Number(pet.weight);

  const matched = activeVariants.find((v: any) => {
    const nameLower = (v.name || '').toLowerCase();
    if (w < 5) {
      return (
        nameLower.includes('size s') ||
        nameLower.includes('500g') ||
        nameLower.includes('200g') ||
        nameLower.includes('1kg') ||
        nameLower.includes('nhỏ') ||
        (!nameLower.includes('size m') && !nameLower.includes('size l') && !nameLower.includes('3kg') && !nameLower.includes('5kg'))
      );
    } else if (w >= 5 && w <= 12) {
      return (
        nameLower.includes('size m') ||
        nameLower.includes('1.5kg') ||
        nameLower.includes('2kg') ||
        nameLower.includes('vừa') ||
        (!nameLower.includes('size s') && !nameLower.includes('size l'))
      );
    } else {
      return (
        nameLower.includes('size l') ||
        nameLower.includes('3kg') ||
        nameLower.includes('4kg') ||
        nameLower.includes('5kg') ||
        nameLower.includes('10kg') ||
        nameLower.includes('lớn') ||
        (!nameLower.includes('size s') && !nameLower.includes('size m') && !nameLower.includes('500g'))
      );
    }
  });

  return matched || activeVariants[0];
}

/**
 * Component thẻ sản phẩm tại trang chủ cửa hàng:
 * - Chỉ hiển thị ảnh đầu tiên của sản phẩm
 * - Hiển thị giá thấp nhất hoặc giá phân loại được gợi ý cho thú cưng
 * - Gắn badge phân loại đề xuất phù hợp với thể trạng thú cưng
 */
export default function ProductCard({
  product,
  selectedPet,
  selectedPrices,
}: {
  product: Product;
  selectedPet?: any;
  selectedPrices?: string[];
}) {
  const hasVariants = Boolean(product.variants && product.variants.length > 0);

  // Tự động tìm phân loại (Variant) được hệ thống đề xuất cho thú cưng đang chọn
  const recommendedVariant = selectedPet ? findRecommendedVariantForPet(product, selectedPet) : null;

  // Luôn luôn hiển thị ảnh đại diện đầu tiên của sản phẩm ở danh sách ngoài store
  const productImage = product.imageUrl || product.images?.[0] || '/placeholder.svg';

  // Lấy giá thấp nhất của sản phẩm hoặc giá của phân loại được gợi ý cho pet
  const lowestPrice = getProductLowestPrice(product);
  const activePrice = recommendedVariant ? (recommendedVariant.salePrice ?? recommendedVariant.sellingPrice) : lowestPrice;
  const displayPriceLabel = formatCurrency(activePrice);

  // Xác định xem sản phẩm có được giảm giá so với giá niêm yết không
  const originalSellingPrice = product.sellingPrice;
  const hasDiscount = typeof originalSellingPrice === 'number' && lowestPrice < originalSellingPrice;

  // Tính phần trăm giảm giá thực tế của sản phẩm
  const discountPercent = typeof originalSellingPrice === 'number' && originalSellingPrice > 0 && lowestPrice < originalSellingPrice
    ? Math.round(((originalSellingPrice - lowestPrice) / originalSellingPrice) * 100)
    : (getDiscountPercent(product) || 0);

  const discount = discountPercent > 0 ? discountPercent : getDiscountPercent(product);
  const speciesLabel = product.targetSpecies === 'DOG' ? 'Cho chó' : product.targetSpecies === 'CAT' ? 'Cho mèo' : 'Mọi thú cưng';

  const effectiveTotalStock = hasVariants
    ? product.variants!.reduce((sum: number, v: any) => sum + Number(v.stock || 0), 0)
    : (product.stock ?? 0);
  const isOutOfStock = effectiveTotalStock === 0;

  // Đường dẫn chi tiết kèm mã phân loại đề xuất và mã thú cưng
  const productDetailUrl = recommendedVariant
    ? `/product/${product.id}?variantId=${recommendedVariant.id}${selectedPet?.id ? `&petId=${selectedPet.id}` : ''}`
    : `/product/${product.id}`;

  return (
    <article
      className="group relative rounded-2xl border border-[var(--border-color)] bg-white shadow-[0_8px_24px_rgba(26,26,26,0.04)] transition hover:-translate-y-1 hover:border-[#DED8D0] hover:shadow-[0_18px_40px_rgba(26,26,26,0.10)] flex flex-col h-full justify-between overflow-hidden"
    >
      <Link href={productDetailUrl} className="flex flex-col h-full justify-between">
        <div>
          <div className="relative aspect-square overflow-hidden bg-[#F3F0EA]">
            <img
              src={productImage}
              alt={product.name}
              loading="lazy"
              className={cn(
                "h-full w-full object-cover transition duration-300 group-hover:scale-105",
                (isOutOfStock || product.isActive === false) && "grayscale opacity-60"
              )}
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />

            {/* Khu vực hiển thị huy hiệu: Nổi bật, Trạng thái mở bán, Bán chạy hoặc Khuyến mãi */}
            <div className="absolute left-2.5 top-2.5 z-10 flex flex-col items-start gap-1.5 pointer-events-none">
              {/* Badge Gợi ý cho Thú cưng kèm tên phân loại cụ thể */}
              {selectedPet && recommendedVariant && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-black px-2.5 py-1 text-[10px] shadow-md border border-orange-300/50 animate-fadeIn">
                  🐾 Gợi ý cho {selectedPet.name}: {recommendedVariant.name}
                </span>
              )}

              {/* Huy hiệu Sản phẩm nổi bật */}
              {product.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 text-amber-950 font-black px-2.5 py-1 text-[10px] shadow-md border border-amber-300 animate-fadeIn">
                  ⭐ Nổi bật
                </span>
              )}

              {/* Trạng thái kinh doanh hoặc khuyến mãi */}
              {product.isActive === false ? (
                <span className="rounded-lg bg-stone-700 px-2.5 py-1 text-[10px] font-black text-white shadow-sm animate-fadeIn">
                  Tạm ngưng bán
                </span>
              ) : isOutOfStock ? (
                <span className="rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm animate-fadeIn">
                  Hết hàng
                </span>
              ) : (product.soldCount && product.soldCount >= 5) ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-red-500 px-2.5 py-1 text-[10px] font-black text-white shadow-md">
                  🔥 Bán chạy
                </span>
              ) : null}
            </div>

            {/* Low Stock Badge */}
            {effectiveTotalStock > 0 && effectiveTotalStock <= 5 && (
              <span className="absolute top-2.5 right-2.5 rounded-lg bg-amber-600 px-2 py-0.5 text-[9px] font-black text-white shadow-xs z-10 animate-pulse">
                ⚡ Chỉ còn {effectiveTotalStock}
              </span>
            )}
          </div>

          <div className="space-y-2.5 p-4">
            <div className="min-h-[3.25rem]">
              <p className="truncate text-xs font-bold uppercase tracking-[0.08em] text-[#0F766E]">
                {product.brand || 'PetMatch'}
              </p>
              <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-[var(--text-main)] transition duration-200 group-hover:text-[var(--primary-color)]">
                {product.name}
              </h3>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] pt-0.5">
              <div className="flex items-center gap-2">
                {product.reviewCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                    <span className="font-semibold text-[var(--text-main)]">{product.rating.toFixed(1)}</span>
                    <span>({product.reviewCount})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <Star className="size-3.5 text-gray-300 fill-gray-100" />
                    <span className="font-medium text-[11px]">Mới</span>
                  </span>
                )}
                {typeof product.soldCount === 'number' && product.soldCount > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Đã bán {product.soldCount >= 1000 ? `${(product.soldCount / 1000).toFixed(1)}k` : product.soldCount}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF8F5] px-2 py-1 font-semibold text-[#0F766E]">
                <PackageCheck className="size-3.5" />
                {speciesLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 pt-0">
          <div className="flex flex-col gap-1">
            {selectedPet && recommendedVariant && (
              <span className="text-[10px] font-extrabold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70 w-fit">
                Giá phân loại đề xuất ({recommendedVariant.name})
              </span>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-base font-extrabold text-[var(--primary-color)]">{displayPriceLabel}</span>
              {hasDiscount && discountPercent > 0 && !recommendedVariant && (
                <>
                  <span className="text-xs text-[var(--text-muted)] line-through">
                    {formatCurrency(originalSellingPrice)}
                  </span>
                  <span className="inline-flex items-center rounded bg-red-100/80 px-1.5 py-0.5 text-[10px] font-black text-[#EE4D2D]">
                    -{discountPercent}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
