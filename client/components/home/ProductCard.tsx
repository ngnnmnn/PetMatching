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
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setIsHovered(true);
    }, 180);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setIsHovered(false);
    }, 120);
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
      className="group relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white shadow-[0_8px_24px_rgba(26,26,26,0.04)] transition hover:-translate-y-1 hover:border-[#DED8D0] hover:shadow-[0_18px_40px_rgba(26,26,26,0.10)] flex flex-col h-full justify-between"
    >
      <div>
        <div className="relative aspect-square overflow-hidden bg-[#F3F0EA]">
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
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-[#F59E0B] text-[#F59E0B]" />
              <span className="font-semibold text-[var(--text-main)]">{product.rating.toFixed(1)}</span>
              <span>({product.reviewCount})</span>
            </span>
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

      {/* Hover Quick Info Card Overlay Popover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0 z-30 flex flex-col justify-between rounded-2xl border-2 border-orange-400 bg-white/98 backdrop-blur-md p-4 shadow-2xl overflow-y-auto scrollbar-none"
            onClick={() => router.push(productDetailUrl)}
          >
            <div className="space-y-2.5">
              {/* Header inside hover popup */}
              <div className="flex items-start justify-between gap-2 border-b pb-2 border-gray-100">
                <div className="pr-1">
                  <span className="text-[10px] font-black uppercase text-[#0F766E] tracking-wider block">
                    {product.brand || 'PetMatch'}
                  </span>
                  <h4 className="text-xs font-black text-[var(--text-main)] line-clamp-2 leading-tight">
                    {product.name}
                  </h4>
                </div>
                <span className="shrink-0 text-[10px] font-extrabold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">
                  {speciesLabel}
                </span>
              </div>

              {/* Pet recommendation highlight inside hover popup */}
              {isMatchedByPetWeight && selectedPet && (
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-[10px] font-black text-emerald-700">
                  <Sparkles className="size-3.5 text-emerald-600 fill-emerald-600/20 shrink-0 animate-pulse" />
                  <span>Đề xuất cho {selectedPet.name} ({selectedPet.weight}kg)</span>
                </div>
              )}

              {/* Price & Stock */}
              <div className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[9px] text-gray-400 font-bold block">Giá bán</span>
                  <span className="font-black text-orange-600 text-xs sm:text-sm">{formatCurrency(displayPrice)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-gray-400 font-bold block">Tình trạng</span>
                  <span className={cn("font-bold text-[10px] px-2 py-0.5 rounded-md", currentStock > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                    {currentStock > 0 ? `Còn ${currentStock} SP` : 'Hết hàng'}
                  </span>
                </div>
              </div>

              {/* Description snippet */}
              {product.description && (
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Mô tả sản phẩm:</span>
                  <p className="text-[10px] text-gray-600 leading-snug line-clamp-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Specifications if present */}
              {(() => {
                const specs = getParsedSpecs(product.specifications);
                if (specs.length > 0) {
                  return (
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Thông số kỹ thuật:</span>
                      <div className="grid grid-cols-2 gap-1 text-[9px] bg-amber-50/50 p-1.5 rounded-xl border border-amber-100">
                        {specs.slice(0, 4).map((s, idx) => (
                          <div key={idx} className="truncate">
                            <span className="font-bold text-gray-500">{s.key}: </span>
                            <span className="font-extrabold text-gray-800">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Direct link action at bottom of hover overlay */}
            <div className="pt-2">
              <Link
                href={productDetailUrl}
                className="w-full py-2 px-3 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Xem chi tiết sản phẩm</span>
                <Eye className="size-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

