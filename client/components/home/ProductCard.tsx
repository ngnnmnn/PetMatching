'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, PackageCheck, ShoppingCart, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function getDiscountPercent(product: Product) {
  if (!product.salePrice || product.salePrice >= product.originalPrice) {
    return null;
  }

  return Math.round(((product.originalPrice - product.salePrice) / product.originalPrice) * 100);
}

export default function ProductCard({ product, featured = false }: { product: Product; featured?: boolean }) {
  const router = useRouter();
  const displayPrice = product.salePrice ?? product.originalPrice;
  const discount = getDiscountPercent(product);
  const speciesLabel = product.targetSpecies === 'DOG' ? 'Cho chó' : product.targetSpecies === 'CAT' ? 'Cho mèo' : 'Mọi thú cưng';

  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const isWishlisted = isInWishlist(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    addToCart(product, 1);
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
    <article className="group overflow-hidden rounded-lg border border-[var(--border-color)] bg-white shadow-[0_8px_24px_rgba(26,26,26,0.04)] transition hover:-translate-y-1 hover:border-[#DED8D0] hover:shadow-[0_18px_40px_rgba(26,26,26,0.10)]">
      <div className="relative aspect-square overflow-hidden bg-[#F3F0EA]">
        <Link href={`/home/product/${product.id}`} className="block h-full w-full">
          <img
            src={product.imageUrl || '/placeholder.svg'}
            alt={product.name}
            loading="lazy"
            className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
              product.stock === 0 ? 'grayscale opacity-60' : ''
            }`}
          />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/28 to-transparent opacity-0 transition group-hover:opacity-100" />
        </Link>
        {product.stock === 0 ? (
          <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-1 text-xs font-extrabold text-white shadow-sm z-10 animate-fadeIn">
            Tạm hết hàng
          </span>
        ) : discount ? (
          <span className="absolute left-2 top-2 rounded-md bg-[var(--primary-color)] px-2 py-1 text-xs font-extrabold text-white shadow-sm">
            -{discount}%
          </span>
        ) : null}
        {featured && (
          <span className="absolute right-2 top-2 rounded-md bg-[#F59E0B] px-2 py-1 text-xs font-extrabold text-white shadow-sm">
            Hot
          </span>
        )}
        <button
          type="button"
          aria-label="Thêm vào yêu thích"
          onClick={handleAddToWishlist}
          className={`absolute bottom-2 right-2 inline-flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition ${
            isWishlisted
              ? 'text-red-500 hover:text-red-600'
              : 'text-[var(--text-main)] hover:text-[var(--primary-color)]'
          }`}
        >
          <Heart className={`size-4 ${isWishlisted ? 'fill-red-500' : ''}`} />
        </button>
      </div>

      <div className="space-y-3 p-3.5">
        <Link href={`/home/product/${product.id}`} className="block group-hover:opacity-90">
          <div className="min-h-[3.875rem]">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-bold uppercase tracking-[0.08em] text-[#0F766E]">{product.brand || 'PetMatch'}</p>
              {product.unit && <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">{product.unit}</span>}
            </div>
            <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-[var(--text-main)] transition duration-200 group-hover:text-[var(--primary-color)]">{product.name}</h3>
          </div>
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
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

        <div className="flex min-h-10 flex-wrap items-end gap-x-2 gap-y-1">
          <span className="text-base font-extrabold text-[var(--primary-color)]">{formatCurrency(displayPrice)}</span>
          {product.salePrice && product.salePrice < product.originalPrice && (
            <span className="text-xs text-[var(--text-muted)] line-through">{formatCurrency(product.originalPrice)}</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className={`mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-4 ${
            product.stock === 0
              ? 'bg-gray-400 cursor-not-allowed opacity-80'
              : 'bg-[var(--primary-color)] hover:bg-[#cf5017] focus-visible:ring-[rgba(228,93,28,0.18)]'
          }`}
        >
          {product.stock === 0 ? (
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
