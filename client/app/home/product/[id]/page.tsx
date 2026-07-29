'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  Loader2,
  Zap,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import AppHeader from '@/components/layout/AppHeader';
import Footer from '@/components/layout/Footer';
import { productsApi } from '@/lib/api/products';
import { Product, ProductCategory, ProductReview } from '@/types';
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
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [canUserReview, setCanUserReview] = useState(false);
  const [submitRating, setSubmitRating] = useState(5);
  const [submitComment, setSubmitComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const isWishlisted = product ? isInWishlist(product.id) : false;

  const searchParams = useSearchParams();
  const shouldScrollToReview = searchParams.get('review') === 'true';
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldScrollToReview && canUserReview && reviewSectionRef.current) {
      setTimeout(() => {
        reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 600);
    }
  }, [shouldScrollToReview, canUserReview]);

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
        setLoading(false); // Show main product details immediately!

        // Fetch secondary data concurrently in parallel (non-blocking)
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        setRelatedLoading(true);

        const [reviewsRes, eligibilityRes, relatedRes] = await Promise.allSettled([
          productsApi.getReviews(productId),
          token ? productsApi.canReview(productId) : Promise.resolve({ data: false }),
          productsApi.getList({ category: data.category, limit: 5 }),
        ]);

        if (reviewsRes.status === 'fulfilled') {
          setReviews(reviewsRes.value.data);
        }
        if (eligibilityRes.status === 'fulfilled') {
          setCanUserReview(eligibilityRes.value.data);
        }
        if (relatedRes.status === 'fulfilled') {
          const filtered = (relatedRes.value.data.data || []).filter((p: any) => p.id !== data.id);
          setRelatedProducts(filtered.slice(0, 4));
        }
        setRelatedLoading(false);
      } catch (err) {
        console.error(err);
        setError('Không tìm thấy sản phẩm hoặc xảy ra lỗi kết nối.');
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để lưu sản phẩm yêu thích.');
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    toggleWishlist(product);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await productsApi.submitReview(productId, {
        rating: submitRating,
        comment: submitComment,
      });
      toast.success('Gửi đánh giá thành công! Cảm ơn nhận xét của bạn.');
      setSubmitComment('');
      setSubmitRating(5);
      
      // Reload reviews, product info, and eligibility
      const [prodRes, reviewsRes, eligibilityRes] = await Promise.all([
        productsApi.getById(productId),
        productsApi.getReviews(productId),
        productsApi.canReview(productId).catch(() => ({ data: false })),
      ]);
      setProduct(prodRes.data);
      setReviews(reviewsRes.data);
      setCanUserReview(eligibilityRes.data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi gửi đánh giá.');
    } finally {
      setSubmittingReview(false);
    }
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

  const discount = product.salePrice && product.originalPrice && product.salePrice < product.originalPrice
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
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-[#F0EBE4] bg-[#F8F7F4] flex items-center justify-center p-4">
              <img
                src={activeImage}
                alt={product.name}
                className={`max-h-full max-w-full object-contain transition-all duration-300 rounded-xl ${
                  product.stock === 0 ? 'grayscale opacity-60' : ''
                }`}
              />
              {product.stock === 0 ? (
                <span className="absolute left-4 top-4 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white shadow-md z-10">
                  Tạm hết hàng
                </span>
              ) : discount ? (
                <span className="absolute left-4 top-4 rounded-lg bg-[var(--primary-color)] px-3 py-1.5 text-xs font-black text-white shadow-md">
                  -{discount}%
                </span>
              ) : null}
            </div>

            {/* Thumbnails list */}
            {allImages.length > 1 && (
              <div className="flex flex-wrap gap-2.5">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`relative size-20 overflow-hidden rounded-xl border-2 bg-white transition-all duration-200 hover:scale-105 hover:shadow-md ${
                      activeImage === img
                        ? 'border-[var(--primary-color)] ring-2 ring-[var(--primary-color)]/20'
                        : 'border-[var(--border-color)] hover:border-gray-300'
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
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF3E0] px-3 py-1 text-xs font-bold text-[#E65100]">
                    {CATEGORY_LABELS[product.category] || product.category}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF8F5] px-3 py-1 text-xs font-bold text-[#0F766E]">
                    <PackageCheck className="h-3.5 w-3.5" />
                    {speciesLabel}
                  </span>
                </div>
                {product.unit && (
                  <span className="rounded-md bg-gray-100 px-3 py-1 text-xs font-bold text-[var(--text-muted)]">
                    Đơn vị: {product.unit}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="mt-3 text-3xl font-black leading-tight text-[var(--text-main)] sm:text-4xl">
                {product.name}
              </h1>

              {/* Rating summary & stock */}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-0.5 text-[#F59E0B]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4.5 w-4.5 ${
                        i < Math.floor(product.rating)
                          ? 'fill-[#F59E0B] text-[#F59E0B]'
                          : i < product.rating
                          ? 'fill-[#F59E0B]/50 text-[#F59E0B]'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-1.5 font-bold text-[var(--text-main)]">
                    {product.rating.toFixed(1)}
                  </span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="font-semibold text-[var(--text-muted)]">
                  ({product.reviewCount} đánh giá)
                </span>
                <span className="text-gray-300">|</span>
                <span className="font-bold flex items-center gap-1">
                  {product.stock === null || product.stock === undefined ? (
                    <span className="text-[#0F766E] flex items-center gap-1">
                      <span className="text-xs font-bold">✓</span> Còn hàng
                    </span>
                  ) : product.stock > 0 ? (
                    <span className="text-[#0F766E] flex items-center gap-1">
                      <span className="text-xs font-bold">✓</span> Còn hàng ({product.stock} sản phẩm)
                    </span>
                  ) : (
                    <span className="text-red-500 font-extrabold">Tạm hết hàng</span>
                  )}
                </span>
              </div>

              {/* Price section */}
              <div className="rounded-2xl bg-[#FAF6F0] p-5 mt-5 border border-[#F4EBE0]">
                <p className="text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Giá bán</p>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-black text-[var(--primary-color)]">
                    {formatCurrency(displayPrice)}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-base text-[var(--text-muted)] line-through">
                        {formatCurrency(product.originalPrice)}
                      </span>
                      <span className="inline-block rounded-md bg-[var(--primary-color)]/10 px-2 py-0.5 text-xs font-black text-[var(--primary-color)]">
                        Tiết kiệm {Math.round(100 - (displayPrice / product.originalPrice) * 100)}%
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Short Description */}
              {product.description && (
                <p className="mt-5 text-sm text-[var(--text-main)]/80 leading-relaxed font-medium">
                  {product.description.split(/[.\n]/)[0]}.
                </p>
              )}
            </div>

            {/* Actions card */}
            <div className="mt-6 space-y-4">
              {/* Quantity selector */}
              {product.stock !== 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-extrabold text-[var(--text-main)]">Số lượng</span>
                  <div className="flex items-center rounded-xl border border-[var(--border-color)] bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      className="inline-flex size-9 items-center justify-center rounded-lg bg-gray-50 text-gray-600 transition hover:bg-gray-100 hover:text-black active:scale-95"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center text-sm font-black text-[var(--text-main)]">{quantity}</span>
                    <button
                      type="button"
                      onClick={handleIncrement}
                      className="inline-flex size-9 items-center justify-center rounded-lg bg-gray-50 text-gray-600 transition hover:bg-gray-100 hover:text-black active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {product.stock !== undefined && product.stock !== null && (
                    <span className="text-xs font-bold text-[var(--text-muted)] animate-fadeIn">
                      (Còn {product.stock} sản phẩm trong kho)
                    </span>
                  )}
                </div>
              )}

              {/* Purchase Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={product.stock === 0 || isAddingToCart}
                  className="flex-1 inline-flex h-13 items-center justify-center gap-2 rounded-xl border-2 border-[#0F766E] bg-white px-6 text-sm font-black text-[#0F766E] shadow-sm transition-all duration-200 hover:bg-[#F2FAF8] active:scale-98 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
                >
                  {isAddingToCart ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : product.stock === 0 ? (
                    <X className="h-4.5 w-4.5" />
                  ) : (
                    <ShoppingCart className="h-4.5 w-4.5" />
                  )}
                  {product.stock === 0 ? 'Tạm hết hàng' : 'Thêm vào giỏ hàng'}
                </button>

                <button
                  type="button"
                  disabled={product.stock === 0}
                  className="flex-1 inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E45D1C] to-[#EF6C00] px-6 text-sm font-black text-white shadow-md transition-all duration-200 hover:opacity-95 hover:shadow-lg active:scale-98 disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none cursor-pointer"
                  onClick={() => {
                    if (!product) return;
                    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
                    if (!token) {
                      toast.error('Vui lòng đăng nhập để thực hiện mua hàng.');
                      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
                      return;
                    }
                    try {
                      const directCheckoutItem = {
                        id: product.id,
                        product: product,
                        quantity: quantity
                      };
                      localStorage.setItem('petmatch_direct_checkout_item', JSON.stringify(directCheckoutItem));
                      localStorage.removeItem('petmatch_selected_cart_items'); // ensure no cart items are checked out
                      router.push('/checkout');
                    } catch (e) {
                      console.error(e);
                      toast.error('Có lỗi xảy ra trong quá trình đặt hàng.');
                    }
                  }}
                >
                  {product.stock === 0 ? (
                    <>
                      <X className="h-4.5 w-4.5" />
                      Tạm hết hàng
                    </>
                  ) : (
                    <>
                      <Zap className="h-4.5 w-4.5 fill-white text-white" />
                      Mua ngay
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  className={`inline-flex size-13 items-center justify-center rounded-xl border transition-all duration-200 shadow-sm active:scale-95 ${
                    isWishlisted
                      ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100/50'
                      : 'border-[var(--border-color)] bg-white text-[var(--text-main)] hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  aria-label="Thêm vào yêu thích"
                >
                  <Heart className={`h-5.5 w-5.5 ${isWishlisted ? 'fill-red-500' : ''}`} />
                </button>
              </div>

              {/* Service Badges */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 border-t border-[var(--border-color)] text-sm font-semibold text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="text-[#0F766E] text-base">🚚</span> Miễn phí giao hàng đơn từ 500K
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[#0F766E] text-base">✓</span> Đổi trả trong 7 ngày
                </span>
              </div>

            </div>
          </div>
        </div>

        {/* Detailed description */}
        {product.description && (
          <div className="mt-8 space-y-3">
            <h3 className="text-base font-black text-[var(--text-main)]">Mô tả chi tiết</h3>
            <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 text-sm leading-relaxed text-[var(--text-main)]/85 shadow-sm whitespace-pre-line">
              {product.description}
            </div>
          </div>
        )}

        {/* Specifications Section (Optional) */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <div className="mt-8 space-y-3">
            <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-1.5">
              <Sparkles className="h-4.5 w-4.5 text-[#F59E0B]" />
              Thông số kỹ thuật
            </h3>
            <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white shadow-sm">
              <table className="w-full text-left border-collapse text-sm">
                <tbody>
                  {Object.entries(product.specifications as Record<string, string>).map(([key, val], idx) => (
                    <tr key={key} className={idx % 2 === 0 ? 'bg-[#FAF9F6]' : 'bg-white'}>
                      <td className="w-1/3 px-5 py-4 font-bold text-[var(--text-muted)] border-b border-[var(--border-color)]">
                        {key}
                      </td>
                      <td className="px-5 py-4 font-medium text-[var(--text-main)] border-b border-[var(--border-color)]">
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <section ref={reviewSectionRef} className="mt-12 space-y-6">
          <div className="flex items-center justify-between border-b pb-3 border-[var(--border-color)]">
            <h2 className="text-xl font-black text-[var(--text-main)]">Đánh giá & Nhận xét ({reviews.length})</h2>
            {product && (
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <span className="text-[#F59E0B] flex items-center">
                  <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                  <span className="ml-1">{product.rating.toFixed(1)}/5</span>
                </span>
                <span className="text-gray-400">({product.reviewCount} đánh giá)</span>
              </div>
            )}
          </div>

          {/* Feedback Form (if eligible) */}
          {canUserReview && (
            <div className="rounded-2xl border border-[var(--primary-color)]/20 bg-[var(--primary-color)]/5 p-6 space-y-4">
              <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--primary-color)]" />
                Viết đánh giá sản phẩm
              </h3>
              <p className="text-xs text-[var(--text-muted)] font-semibold">
                Bạn đã mua sản phẩm này thành công. Hãy chia sẻ nhận xét của mình nhé!
              </p>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[var(--text-main)]">Chọn số sao đánh giá: *</label>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const starValue = i + 1;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSubmitRating(starValue)}
                          className="p-1 hover:scale-110 transition cursor-pointer text-[#F59E0B]"
                          aria-label={`Đánh giá ${starValue} sao`}
                        >
                          <Star
                            className={`h-7 w-7 ${
                              starValue <= submitRating
                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[var(--text-main)]">Nhận xét (không bắt buộc):</label>
                  <textarea
                    rows={3}
                    placeholder="Sản phẩm rất tốt, đóng gói cẩn thận, giao hàng nhanh..."
                    value={submitComment}
                    onChange={(e) => setSubmitComment(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-white px-4 py-3 text-sm focus:border-[var(--primary-color)] focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#cf5017] disabled:bg-gray-300 cursor-pointer text-sm font-black"
                  >
                    {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-[var(--border-color)] bg-white p-5 space-y-3 shadow-sm animate-fadeIn">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-[var(--primary-color)]/10 text-[var(--primary-color)] font-bold flex items-center justify-center border text-sm overflow-hidden shadow-sm uppercase">
                        {review.user?.avatarUrl ? (
                          <img src={review.user.avatarUrl} alt={review.user.name} className="size-full object-cover" />
                        ) : (
                          review.user?.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-main)]">{review.user?.name}</p>
                        <p className="text-xxs text-[var(--text-muted)] font-semibold">
                          {new Date(review.createdAt).toLocaleDateString('vi-VN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 text-[#F59E0B]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < review.rating ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-sm text-[var(--text-main)] font-semibold leading-relaxed bg-[#FAF9F6] p-3.5 rounded-xl border border-[#F4EBE0]/50 italic">
                      "{review.comment}"
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-white p-12 text-center text-[var(--text-muted)] font-semibold text-sm">
                Sản phẩm chưa có đánh giá nào. Hãy là người đầu tiên trải nghiệm và viết đánh giá nhé!
              </div>
            )}
          </div>
        </section>

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
      <Footer />
    </div>
  );
}
