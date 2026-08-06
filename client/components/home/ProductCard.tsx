'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, PackageCheck, ShoppingCart, Star, X, Sparkles, Eye, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function getDiscountPercent(item: { sellingPrice: number; salePrice?: number | null }) {
  if (!item.salePrice || item.salePrice >= item.sellingPrice) {
    return null;
  }
  return Math.round(((item.sellingPrice - item.salePrice) / item.sellingPrice) * 100);
}

const SIZE_WEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  s: { min: 0, max: 4 },
  m: { min: 4, max: 8 },
  l: { min: 8, max: 15 },
  xl: { min: 15, max: 30 },
  xxl: { min: 30, max: 100 },
  xxxl: { min: 45, max: 150 },
};

const getParsedSpecs = (specifications: any): Array<{ key: string; value: string }> => {
  if (!specifications) return [];
  try {
    const obj = typeof specifications === 'string' ? JSON.parse(specifications) : specifications;
    if (typeof obj === 'object' && obj !== null) {
      return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
    }
  } catch (e) {
    // Ignore parse error
  }
  return [];
};

export default function ProductCard({
  product,
  featured = false,
  selectedPet,
}: {
  product: Product;
  featured?: boolean;
  selectedPet?: any;
  onPreviewClick?: (product: Product) => void;
}) {
  const router = useRouter();
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const isWishlisted = isInWishlist(product.id);

  // Initialize/Update pre-selected variant based on pet weight
  useEffect(() => {
    if (product.variants && product.variants.length > 0) {
      if (selectedPet && selectedPet.weight > 0) {
        const w = selectedPet.weight;
        const matched = product.variants.find((v: any) => {
          const nameLower = v.name.toLowerCase();
          for (const [sizeKey, range] of Object.entries(SIZE_WEIGHT_RANGES)) {
            if (w >= range.min && w <= range.max) {
              const regex = new RegExp(`\\b(${sizeKey})\\b`, 'i');
              if (regex.test(nameLower)) {
                return true;
              }
            }
          }
          return false;
        });
        setSelectedVariant(matched || product.variants[0]);
      } else {
        setSelectedVariant(product.variants[0]);
      }
    } else {
      setSelectedVariant(null);
    }
  }, [product.variants, selectedPet]);

  const hasVariants = product.variants && product.variants.length > 0;
  
  // Calculate if the active variant is a direct recommendation match for the pet's weight
  const isMatchedByPetWeight = !!(
    selectedPet &&
    selectedPet.weight > 0 &&
    selectedVariant &&
    hasVariants &&
    (() => {
      const w = selectedPet.weight;
      const nameLower = selectedVariant.name.toLowerCase();
      for (const [sizeKey, range] of Object.entries(SIZE_WEIGHT_RANGES)) {
        if (w >= range.min && w <= range.max) {
          const regex = new RegExp(`\\b(${sizeKey})\\b`, 'i');
          if (regex.test(nameLower)) return true;
        }
      }
      return false;
    })()
  );

  const displayPrice = selectedVariant ? (selectedVariant.salePrice ?? selectedVariant.sellingPrice) : (product.salePrice ?? product.sellingPrice);
  const discount = getDiscountPercent(selectedVariant || product);
  const speciesLabel = product.targetSpecies === 'DOG' ? 'Cho chó' : product.targetSpecies === 'CAT' ? 'Cho mèo' : 'Mọi thú cưng';
  const productImage = selectedVariant?.imageUrl || product.imageUrl || '/placeholder.svg';
  const currentStock = selectedVariant !== null ? selectedVariant.stock : product.stock;
  const productDetailUrl = `/home/product/${product.id}${selectedVariant ? `?variantId=${selectedVariant.id}` : ''}`;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    
    addToCart(product, 1, false, selectedVariant?.id);
    toast.success(`Đã thêm sản phẩm "${product.name}${selectedVariant ? ` (${selectedVariant.name})` : ''}" vào giỏ hàng!`);
  };

  const handleAddToWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để lưu sản phẩm yêu thích.');
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    toggleWishlist(product);
  };

  return (
    <article
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative rounded-2xl border border-[var(--border-color)] bg-white shadow-[0_8px_24px_rgba(26,26,26,0.04)] transition hover:-translate-y-1 hover:border-[#DED8D0] hover:shadow-[0_18px_40px_rgba(26,26,26,0.10)] flex flex-col h-full justify-between z-10 hover:z-50"
    >
      <div>
        <div className="relative aspect-square overflow-hidden bg-[#F3F0EA] rounded-t-2xl">
          <Link href={productDetailUrl} className="block h-full w-full">
            <img
              src={productImage}
              alt={product.name}
              loading="lazy"
              className={cn(
                "h-full w-full object-cover transition duration-300 group-hover:scale-105",
                (product.stock === 0 || currentStock === 0) && "grayscale opacity-60"
              )}
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/28 to-transparent opacity-0 transition group-hover:opacity-100" />
          </Link>
          
          {/* Stock status or discount badge */}
          {(product.stock === 0 || currentStock === 0) ? (
            <span className="absolute left-2.5 top-2.5 rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm z-10 animate-fadeIn">
              Hết hàng
            </span>
          ) : discount ? (
            <span className="absolute left-2.5 top-2.5 rounded-lg bg-[var(--primary-color)] px-2.5 py-1 text-[10px] font-black text-white shadow-sm z-10">
              -{discount}%
            </span>
          ) : null}

          {/* Recommend badge */}
          {isMatchedByPetWeight && (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-[10px] font-black text-white px-2.5 py-1 shadow-md z-10 animate-pulse">
              <Sparkles className="size-3 fill-white/20" />
              Gợi ý: {selectedVariant.name.replace(/size\s+/i, 'Size ')}
            </span>
          )}

          {featured && (
            <span className="absolute right-2.5 top-2.5 rounded-lg bg-[#F59E0B] px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
              Hot
            </span>
          )}

          <button
            type="button"
            aria-label="Thêm vào yêu thích"
            onClick={handleAddToWishlist}
            className={cn(
              "absolute bottom-2.5 right-2.5 inline-flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition cursor-pointer z-10",
              isWishlisted ? "text-red-500 hover:text-red-600" : "text-[var(--text-main)] hover:text-[var(--primary-color)]"
            )}
          >
            <Heart className={cn("size-4", isWishlisted && "fill-red-500")} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <Link href={productDetailUrl} className="block group-hover:opacity-90">
            <div className="min-h-[3.875rem]">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold uppercase tracking-[0.08em] text-[#0F766E]">{product.brand || 'PetMatch'}</p>
                {product.unit && <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">{product.unit}</span>}
              </div>
              <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-[var(--text-main)] transition duration-200 group-hover:text-[var(--primary-color)]">{product.name}</h3>
            </div>
          </Link>

          {/* Variants Selector Quick Chips */}
          {hasVariants && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {product.variants?.map((v: any) => {
                const isSelected = selectedVariant?.id === v.id;
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

                const displayName = v.name
                  .replace(/size\s+/i, '')
                  .replace(/màu\s+/i, '')
                  .trim();

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedVariant(v);
                    }}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-black rounded-lg border transition cursor-pointer flex items-center gap-1",
                      isSelected
                        ? "border-[var(--primary-color)] bg-[var(--primary-color)]/10 text-[var(--primary-color)]"
                        : isChipMatched
                        ? "border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                        : "border-gray-200 bg-slate-50 hover:bg-slate-100 text-gray-600"
                    )}
                  >
                    {isChipMatched && <Sparkles className="size-2.5 fill-current" />}
                    {displayName}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] pt-1">
            {product.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                <span className="font-semibold text-[var(--text-main)]">{product.rating.toFixed(1)}</span>
                <span>({product.reviewCount})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-400">
                <Star className="size-3.5 text-gray-300 fill-gray-100" />
                <span className="font-medium text-[11px]">Chưa có đánh giá</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF8F5] px-2 py-1 font-semibold text-[#0F766E]">
              <PackageCheck className="size-3.5" />
              {speciesLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 pt-0 space-y-3">
        <div className="flex min-h-10 flex-wrap items-end gap-x-2 gap-y-1">
          <span className="text-base font-extrabold text-[var(--primary-color)]">{formatCurrency(displayPrice)}</span>
          {discount && (
            <span className="text-xs text-[var(--text-muted)] line-through">
              {formatCurrency(selectedVariant ? selectedVariant.sellingPrice : product.sellingPrice)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={product.stock === 0 || currentStock === 0}
          className={cn(
            "mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-4 cursor-pointer",
            (product.stock === 0 || currentStock === 0)
              ? "bg-gray-400 cursor-not-allowed opacity-80"
              : "bg-[var(--primary-color)] hover:bg-[#cf5017] focus-visible:ring-[rgba(228,93,28,0.18)]"
          )}
        >
          {(product.stock === 0 || currentStock === 0) ? (
            <>
              <X className="size-4" />
              Tạm hết hàng
            </>
          ) : (
            <>
              <ShoppingCart className="size-4" />
              Thêm vào giỏ
            </>
          )}
        </button>
      </div>

      {/* Super Rich & Large Hover Quick Info Popover Card (2x-3x Large Floating Popover) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="hidden lg:block absolute -top-4 left-1/2 -translate-x-1/2 w-[480px] sm:w-[560px] md:w-[600px] z-50 rounded-3xl border-2 border-orange-400 bg-white p-6 shadow-[0_25px_70px_rgba(0,0,0,0.25)] backdrop-blur-2xl cursor-pointer max-h-[80vh] overflow-y-auto scrollbar-thin"
            onClick={(e) => {
              e.stopPropagation();
              router.push(productDetailUrl);
            }}
          >
            <div className="space-y-4 text-left">
              {/* Header: 2 Columns (Image Preview + Primary Info) */}
              <div className="grid grid-cols-12 gap-4 items-start pb-4 border-b border-gray-100">
                {/* Image Preview Thumbnail Column */}
                <div className="col-span-4 relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shadow-xs">
                  <img
                    src={productImage}
                    alt={product.name}
                    className="size-full object-cover"
                  />
                  {discount && (
                    <span className="absolute top-2 left-2 bg-orange-600 text-white font-black text-[10px] px-2 py-0.5 rounded-lg shadow-sm">
                      -{discount}%
                    </span>
                  )}
                  {featured && (
                    <span className="absolute top-2 right-2 bg-amber-500 text-white font-black text-[10px] px-2 py-0.5 rounded-lg shadow-sm">
                      HOT
                    </span>
                  )}
                </div>

                {/* Info Column */}
                <div className="col-span-8 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase text-[#0F766E] tracking-wider">
                      {product.brand || 'PetMatch'}
                    </span>
                    <span className="shrink-0 text-[10px] font-extrabold bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full border border-orange-200">
                      {speciesLabel}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-[var(--text-main)] leading-snug line-clamp-2">
                    {product.name}
                  </h3>

                  {/* Rating & Review Count */}
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    {product.reviewCount > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-4 fill-[#F59E0B] text-[#F59E0B]" />
                        <span className="font-extrabold text-[var(--text-main)]">{product.rating.toFixed(1)}</span>
                        <span>({product.reviewCount} đánh giá)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <Star className="size-4 text-gray-300 fill-gray-100" />
                        <span className="font-bold text-gray-400">Chưa có đánh giá nào</span>
                      </span>
                    )}
                    {product.unit && (
                      <span className="font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">
                        {product.unit}
                      </span>
                    )}
                  </div>

                  {/* Price Section */}
                  <div className="flex items-baseline gap-2.5 pt-1">
                    <span className="text-2xl font-black text-orange-600">
                      {formatCurrency(displayPrice)}
                    </span>
                    {discount && (
                      <span className="text-xs text-gray-400 line-through font-semibold">
                        {formatCurrency(selectedVariant ? selectedVariant.sellingPrice : product.sellingPrice)}
                      </span>
                    )}
                    {discount && selectedVariant && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Tiết kiệm {formatCurrency((selectedVariant.sellingPrice || product.sellingPrice) - displayPrice)}
                      </span>
                    )}
                  </div>

                  {/* Stock Level Badge */}
                  <div>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-xl border shadow-2xs",
                      currentStock > 0
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    )}>
                      <span className={cn("size-2 rounded-full", currentStock > 0 ? "bg-emerald-500" : "bg-red-500")} />
                      {currentStock > 0 ? `Tồn kho sẵn sàng: Còn ${currentStock} sản phẩm` : 'Hiện đang tạm hết hàng'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pet Customization Recommendation Banner */}
              {isMatchedByPetWeight && selectedPet && (
                <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-3 rounded-2xl text-xs font-black text-emerald-800 shadow-2xs">
                  <div className="size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="size-4 fill-white/20 animate-pulse" />
                  </div>
                  <div>
                    <p className="font-black text-emerald-800">
                      Được thiết kế & gợi ý phù hợp cho {selectedPet.name} ({selectedPet.weight}kg)
                    </p>
                    <p className="text-[11px] font-bold text-emerald-600/90 mt-0.5">
                      Kích cỡ và thông số sản phẩm khớp với tiêu chuẩn cho {selectedPet.breed || 'thú cưng của bạn'}.
                    </p>
                  </div>
                </div>
              )}

              {/* Specifications Grid Table */}
              {(() => {
                const specs = getParsedSpecs(product.specifications);
                if (specs.length > 0) {
                  return (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider block">
                        Thông số kỹ thuật sản phẩm:
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-xs bg-amber-50/40 p-3 rounded-2xl border border-amber-100">
                        {specs.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between border-b border-amber-200/50 pb-1 last:border-0">
                            <span className="font-bold text-gray-500">{s.key}:</span>
                            <span className="font-black text-gray-800 truncate pl-2">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Variants Breakdown Chips / List */}
              {hasVariants && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider block">
                    Danh sách phân loại / kích cỡ ({product.variants?.length}):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {product.variants?.map((v: any) => {
                      const isSelected = selectedVariant?.id === v.id;
                      return (
                        <div
                          key={v.id}
                          className={cn(
                            "px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-2",
                            isSelected
                              ? "border-orange-500 bg-orange-50 text-orange-700 shadow-2xs"
                              : "border-gray-200 bg-gray-50 text-gray-600"
                          )}
                        >
                          <span className="font-black">{v.name}</span>
                          <span className="text-[10px] text-gray-400">|</span>
                          <span className="font-extrabold text-orange-600">{formatCurrency(v.salePrice ?? v.sellingPrice)}</span>
                          <span className="text-[10px] text-gray-400">({v.stock} kho)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description Snippet */}
              {product.description && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider block">
                    Mô tả chi tiết:
                  </span>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-4 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-100 font-medium">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-2 grid grid-cols-2 gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={product.stock === 0 || currentStock === 0}
                  className={cn(
                    "py-3 px-4 rounded-2xl text-xs font-black text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer",
                    (product.stock === 0 || currentStock === 0)
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-orange-500 hover:bg-orange-600"
                  )}
                >
                  <ShoppingCart className="size-4" />
                  <span>Thêm vào giỏ hàng</span>
                </button>

                <Link
                  href={productDetailUrl}
                  className="py-3 px-4 rounded-2xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <span>Trang sản phẩm đầy đủ</span>
                  <Eye className="size-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

