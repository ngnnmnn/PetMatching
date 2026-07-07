'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  PackageCheck,
  Store,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import AppHeader from '@/components/layout/AppHeader';
import { productsApi } from '@/lib/api/products';
import { Product, ProductCategory } from '@/types';
import ProductCard from '@/components/home/ProductCard';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  DOG_FOOD: 'Thức ăn cho chó',
  CAT_FOOD: 'Thức ăn cho mèo',
  TOY: 'Đồ chơi thú cưng',
  ACCESSORY: 'Phụ kiện thú cưng',
  GROOMING: 'Chăm sóc & Vệ sinh',
  CAGE_BED: 'Chuồng & Nệm ngủ',
  LEASH_COLLAR: 'Vòng cổ & Dây dắt',
  MEDICAL: 'Y tế & Thuốc',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeImage, setActiveImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const isWishlisted = product ? isInWishlist(product.id) : false;

  // Load product detail and related products
  useEffect(() => {
    if (!productId) return;

    const fetchProductData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await productsApi.getById(productId);
        const data = response.data;
        setProduct(data);
        setActiveImage(data.imageUrl || '/placeholder.svg');

        // Fetch related products (same category)
        setRelatedLoading(true);
        try {
          const relatedResponse = await productsApi.getList({
            category: data.category,
            limit: 5,
          });
          // Filter out current product
          const filtered = (relatedResponse.data.data || []).filter(
            (p) => p.id !== data.id
          );
          setRelatedProducts(filtered.slice(0, 4));
        } catch (err) {
          console.error('Failed to load related products', err);
        } finally {
          setRelatedLoading(false);
        }

      } catch (err) {
        console.error(err);
        setError('Không tìm thấy sản phẩm hoặc xảy ra lỗi kết nối.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
  }, [productId]);

  const handleIncrement = () => {
    if (product?.stock && quantity >= product.stock) {
      toast.warning(`Chỉ còn lại ${product.stock} sản phẩm trong kho`);
      return;
    }
    setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handleAddToCart = () => {
    if (!product) return;
    setIsAddingToCart(true);

    // Simulate adding to cart action
    setTimeout(() => {
      setIsAddingToCart(false);
      addToCart(product, quantity, false);
      toast.success(`Đã thêm ${quantity} sản phẩm "${product.name}" vào giỏ hàng!`, {
        action: {
          label: 'Xem giỏ hàng',
          onClick: () => router.push('/cart'),
        },
      });
    }, 800);
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    toggleWishlist(product);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
        <AppHeader sectionLabel="Store" />
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--primary-color)]" />
          <p className="text-sm font-semibold text-[var(--text-muted)]">Đang tải chi tiết sản phẩm...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
        <AppHeader sectionLabel="Store" />
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
          <div className="rounded-lg border border-red-100 bg-red-50 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-red-600">Lỗi tải trang</h2>
            <p className="mt-2 text-sm text-red-500">{error || 'Sản phẩm không tồn tại.'}</p>
            <div className="mt-6">
              <Link
                href="/home"
                className="inline-flex items-center gap-2 rounded-md bg-[#0F766E] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#115E59]"
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại cửa hàng
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const discount = product.salePrice && product.originalPrice
    ? Math.round(((product.originalPrice - product.salePrice) / product.originalPrice) * 100)
    : null;

  const displayPrice = product.salePrice ?? product.originalPrice;
  const hasDiscount = !!product.salePrice && product.salePrice < product.originalPrice;
  const speciesLabel =
    product.targetSpecies === 'DOG'
      ? 'Cho chó'
      : product.targetSpecies === 'CAT'
      ? 'Cho mèo'
      : 'Mọi thú cưng';

  // Gather all images (main imageUrl + list of images)
  const allImages = Array.from(new Set([product.imageUrl, ...(product.images || [])])).filter(
    (img): img is string => !!img
  );

  return (
    <div
      className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] font-sans"
      style={{
        fontFamily: 'Inter, Outfit, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <AppHeader sectionLabel="Store" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {/* Breadcrumb & Navigation */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <nav className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
            <Link href="/home" className="hover:text-[var(--primary-color)] flex items-center gap-1 transition">
              <Store className="h-3 w-3" /> Cửa hàng
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="hover:text-[var(--primary-color)] transition">
              {CATEGORY_LABELS[product.category] || product.category}
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="truncate max-w-[200px] text-[var(--text-main)] font-bold">
              {product.name}
            </span>
          </nav>

          <Link
            href="/home"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0F766E] transition hover:text-[#115E59]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại cửa hàng
          </Link>
        </div>

        {/* Product Details Section */}
        <div className="grid gap-8 rounded-2xl border border-[var(--border-color)] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] sm:p-6 lg:grid-cols-12 lg:p-8">
          
          {/* Gallery (Left Col: 5 spans on large screens) */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            {/* Main Image Frame */}
            <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border-color)] bg-[#F8F7F4]">
              <img
                src={activeImage}
                alt={product.name}
                className="h-full w-full object-cover transition-all duration-300"
              />
              {discount && (
                <span className="absolute left-3 top-3 rounded-md bg-[var(--primary-color)] px-2.5 py-1 text-xs font-black text-white shadow-md">
                  -{discount}%
                </span>
              )}
            </div>

            {/* Thumbnails list */}
            {allImages.length > 1 && (
              <div className="flex flex-wrap gap-2.5">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`relative size-16 overflow-hidden rounded-lg border-2 bg-white transition hover:opacity-90 ${
                      activeImage === img ? 'border-[var(--primary-color)]' : 'border-[var(--border-color)]'
                    }`}
                  >
                    <img src={img} alt={`thumbnail-${idx}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details (Right Col: 7 spans on large screens) */}
          <div className="flex flex-col justify-between space-y-6 lg:col-span-7">
            <div>
              {/* Brand and category labels */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0F766E]">
                  {product.brand || 'Thương hiệu chọn lọc'}
                </p>
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF8F5] px-3 py-1 text-xs font-bold text-[#0F766E]">
                    <PackageCheck className="h-3.5 w-3.5" />
                    {speciesLabel}
                  </span>
                  {product.unit && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-[var(--text-muted)]">
                      Đơn vị: {product.unit}
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              <h1 className="mt-3 text-2xl font-black leading-tight text-[var(--text-main)] sm:text-3xl">
                {product.name}
              </h1>

              {/* Rating summary */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-[#F59E0B]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4.5 w-4.5 ${
                        i < Math.floor(product.rating)
                          ? 'fill-[#F59E0B]'
                          : i < product.rating
                          ? 'fill-[#F59E0B]/50'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-1.5 font-extrabold text-[var(--text-main)]">
                    {product.rating.toFixed(1)}
                  </span>
                </div>
                <span className="h-4 w-px bg-gray-200" />
                <span className="font-semibold text-[var(--text-muted)]">
                  {product.reviewCount} Đánh giá
                </span>
                <span className="h-4 w-px bg-gray-200" />
                <span className="font-semibold text-[var(--text-muted)]">
                  {product.stock === null || product.stock === undefined ? (
                    <span className="text-[#0F766E]">Còn hàng</span>
                  ) : product.stock > 0 ? (
                    <span>Còn {product.stock} sản phẩm</span>
                  ) : (
                    <span className="text-red-500 font-extrabold">Hết hàng</span>
                  )}
                </span>
              </div>

              {/* Divider */}
              <div className="my-5 border-t border-[var(--border-color)]" />

              {/* Price section */}
              <div className="rounded-xl bg-[#FAF9F5] p-4.5">
                <p className="text-xs font-bold text-[var(--text-muted)] mb-1">Giá bán ưu đãi</p>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-black text-[var(--primary-color)]">
                    {formatCurrency(displayPrice)}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-sm text-[var(--text-muted)] line-through">
                        {formatCurrency(product.originalPrice)}
                      </span>
                      <span className="inline-block rounded-md bg-[var(--primary-color)]/10 px-2 py-0.5 text-xs font-black text-[var(--primary-color)]">
                        Tiết kiệm {Math.round(100 - (displayPrice / product.originalPrice) * 100)}%
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Short / Detailed Description */}
              {product.description && (
                <div className="mt-5 space-y-2">
                  <h3 className="text-sm font-extrabold text-[var(--text-main)]">Mô tả chi tiết</h3>
                  <div className="rounded-xl border border-[var(--border-color)] bg-[#FCFCFA] p-4 text-sm leading-relaxed text-[var(--text-main)]/85 shadow-inner whitespace-pre-line">
                    {product.description}
                  </div>
                </div>
              )}
            </div>

            {/* Actions card */}
            <div className="mt-6 space-y-4">
              {/* Quantity selector */}
              {product.stock !== 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-extrabold text-[var(--text-main)]">Số lượng:</span>
                  <div className="flex items-center rounded-lg border border-[var(--border-color)] bg-white p-1">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      className="inline-flex size-8 items-center justify-center rounded bg-gray-50 text-gray-600 transition hover:bg-gray-100 hover:text-black"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-12 text-center text-sm font-black">{quantity}</span>
                    <button
                      type="button"
                      onClick={handleIncrement}
                      className="inline-flex size-8 items-center justify-center rounded bg-gray-50 text-gray-600 transition hover:bg-gray-100 hover:text-black"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Purchase Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={product.stock === 0 || isAddingToCart}
                  className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#115E59] disabled:bg-gray-200 disabled:text-gray-400 focus-visible:outline-none"
                >
                  {isAddingToCart ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4.5 w-4.5" />
                  )}
                  Thêm vào giỏ hàng
                </button>

                <button
                  type="button"
                  disabled={product.stock === 0}
                  className="flex-1 inline-flex h-12 items-center justify-center rounded-xl bg-[var(--primary-color)] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#cf5017] disabled:bg-gray-200 disabled:text-gray-400 focus-visible:outline-none"
                  onClick={() => {
                    if (!product) return;
                    addToCart(product, quantity, false);
                    router.push('/cart');
                  }}
                >
                  Mua ngay
                </button>

                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  className={`inline-flex size-12 items-center justify-center rounded-xl border transition shadow-sm ${
                    isWishlisted
                      ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100/50'
                      : 'border-[var(--border-color)] bg-white text-[var(--text-main)] hover:border-gray-300'
                  }`}
                  aria-label="Thêm vào yêu thích"
                >
                  <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-red-500' : ''}`} />
                </button>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-[var(--border-color)]">
                {[
                  { icon: ShieldCheck, title: 'Chất lượng', desc: '100% Chính hãng' },
                  { icon: Truck, title: 'Vận chuyển', desc: 'Giao hàng nhanh' },
                  { icon: RotateCcw, title: 'Đổi trả', desc: 'Trong vòng 7 ngày' },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center p-2 rounded-lg bg-[#FAF9F5]">
                    <item.icon className="h-5 w-5 text-[#0F766E] mb-1" />
                    <span className="text-[11px] font-extrabold text-[var(--text-main)]">{item.title}</span>
                    <span className="text-[9px] font-semibold text-[var(--text-muted)] mt-0.5">{item.desc}</span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="mt-12 space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#F59E0B]" />
              <h2 className="text-xl font-black text-[var(--text-main)]">Sản phẩm tương tự</h2>
            </div>
            {relatedLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="animate-pulse rounded-lg border border-[var(--border-color)] bg-white p-3 space-y-3">
                    <div className="aspect-square bg-gray-200 rounded-md" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
}
