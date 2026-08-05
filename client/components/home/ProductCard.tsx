import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, PackageCheck, ShoppingCart, Star, X, Sparkles } from 'lucide-react';
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

export default function ProductCard({
  product,
  featured = false,
  selectedPet,
  onPreviewClick,
}: {
  product: Product;
  featured?: boolean;
  selectedPet?: any;
  onPreviewClick?: (product: Product) => void;
}) {
  const router = useRouter();
  const [selectedVariant, setSelectedVariant] = useState<any>(null);

  const handlePreviewIfProvided = (e: React.MouseEvent) => {
    if (onPreviewClick && selectedPet && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      e.preventDefault();
      onPreviewClick(product);
    }
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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    
    // Add either the selected variant or the parent product
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
    <article className="group overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white shadow-[0_8px_24px_rgba(26,26,26,0.04)] transition hover:-translate-y-1 hover:border-[#DED8D0] hover:shadow-[0_18px_40px_rgba(26,26,26,0.10)] flex flex-col h-full justify-between">
      <div>
        <div className="relative aspect-square overflow-hidden bg-[#F3F0EA]">
          <Link href={`/home/product/${product.id}${selectedVariant ? `?variantId=${selectedVariant.id}` : ''}`} onClick={handlePreviewIfProvided} className="block h-full w-full">
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
              "absolute bottom-2.5 right-2.5 inline-flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition cursor-pointer",
              isWishlisted ? "text-red-500 hover:text-red-600" : "text-[var(--text-main)] hover:text-[var(--primary-color)]"
            )}
          >
            <Heart className={cn("size-4", isWishlisted && "fill-red-500")} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <Link href={`/home/product/${product.id}${selectedVariant ? `?variantId=${selectedVariant.id}` : ''}`} onClick={handlePreviewIfProvided} className="block group-hover:opacity-90">
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
    </article>
  );
}
