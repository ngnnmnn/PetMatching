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
  X,
  Edit2,
  Trash2,
  Upload,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import AppHeader from '@/components/layout/AppHeader';
import Footer from '@/components/layout/Footer';
import { productsApi } from '@/lib/api/products';
import { usersApi } from '@/lib/api/users';
import { uploadImages } from '@/lib/api/uploads';
import { Product, ProductVariant, ProductCategory, ProductReview } from '@/types';
import ProductCard from '@/components/home/ProductCard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useCart } from '@/context/CartContext';

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
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
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
  const [submitImages, setSubmitImages] = useState<string[]>([]);
  const [uploadingReviewImages, setUploadingReviewImages] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Current logged in user & review edit/delete states
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [uploadingEditImages, setUploadingEditImages] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [deletingReviewLoading, setDeletingReviewLoading] = useState(false);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { addToCart } = useCart();

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

  const refreshReviewData = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const [prodRes, reviewsRes, eligibilityRes] = await Promise.all([
        productsApi.getById(productId),
        productsApi.getReviews(productId),
        token ? productsApi.canReview(productId).catch(() => ({ data: false })) : Promise.resolve({ data: false }),
      ]);
      setProduct(prodRes.data);
      setReviews(reviewsRes.data);
      setCanUserReview(eligibilityRes.data);
    } catch (e) {
      console.error('Failed to refresh review data', e);
    }
  };

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
        if (data.variants && data.variants.length > 0) {
          const targetVariantId = searchParams.get('variantId');
          const matched = targetVariantId ? data.variants.find((v: any) => v.id === targetVariantId) : null;
          const initial = matched || data.variants[0];
          setSelectedVariant(initial);
          if (initial.imageUrl) {
            setActiveImage(initial.imageUrl);
          }
        }
        setLoading(false); // Show main product details immediately!

        // Fetch secondary data concurrently in parallel (non-blocking)
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (token) {
          usersApi.getProfile().then((res) => setCurrentUser(res.data)).catch(() => setCurrentUser(null));
        }

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
    const stock = selectedVariant ? selectedVariant.stock : product?.stock;
    if (stock && quantity >= stock) {
      toast.warning(`Chỉ còn lại ${stock} sản phẩm trong kho`);
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
      addToCart(product, quantity, false, selectedVariant?.id);
      toast.success(`Đã thêm ${quantity} sản phẩm "${product.name}${selectedVariant ? ` (${selectedVariant.name})` : ''}" vào giỏ hàng!`, {
        action: {
          label: 'Xem giỏ hàng',
          onClick: () => router.push('/cart'),
        },
      });
    }, 800);
  };



  const handleReviewImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isEdit = false
  ) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (isEdit) {
      if (editImages.length + files.length > 4) {
        toast.warning('Tối đa 4 ảnh cho mỗi đánh giá');
        return;
      }
      setUploadingEditImages(true);
      try {
        const uploaded = await uploadImages(files, 'review');
        setEditImages((prev) => [...prev, ...uploaded.map((img) => img.url)]);
      } catch (err) {
        toast.error('Lỗi khi tải ảnh lên. Vui lòng thử lại.');
      } finally {
        setUploadingEditImages(false);
      }
    } else {
      if (submitImages.length + files.length > 4) {
        toast.warning('Tối đa 4 ảnh cho mỗi đánh giá');
        return;
      }
      setUploadingReviewImages(true);
      try {
        const uploaded = await uploadImages(files, 'review');
        setSubmitImages((prev) => [...prev, ...uploaded.map((img) => img.url)]);
      } catch (err) {
        toast.error('Lỗi khi tải ảnh lên. Vui lòng thử lại.');
      } finally {
        setUploadingReviewImages(false);
      }
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await productsApi.submitReview(productId, {
        rating: submitRating,
        comment: submitComment,
        images: submitImages,
      });
      toast.success('Gửi đánh giá thành công! Cảm ơn nhận xét của bạn.');
      setSubmitComment('');
      setSubmitRating(5);
      setSubmitImages([]);

      await refreshReviewData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi gửi đánh giá.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleOpenEditReview = (review: ProductReview) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment || '');
    setEditImages(review.images || []);
  };

  const handleUpdateReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;
    setSubmittingEdit(true);
    try {
      await productsApi.updateReview(editingReview.id, {
        rating: editRating,
        comment: editComment,
        images: editImages,
      });
      toast.success('Cập nhật nhận xét thành công!');
      setEditingReview(null);
      await refreshReviewData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật nhận xét.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteReviewConfirm = async () => {
    if (!deletingReviewId) return;
    setDeletingReviewLoading(true);
    try {
      await productsApi.deleteReview(deletingReviewId);
      toast.success('Đã xóa đánh giá! Bạn có thể viết lại nhận xét mới cho sản phẩm này.');
      setDeletingReviewId(null);
      await refreshReviewData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Lỗi khi xóa nhận xét.');
    } finally {
      setDeletingReviewLoading(false);
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
                href="/shop"
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

  const discount = selectedVariant
    ? (selectedVariant.salePrice && selectedVariant.sellingPrice && selectedVariant.salePrice < selectedVariant.sellingPrice
      ? Math.round(((selectedVariant.sellingPrice - selectedVariant.salePrice) / selectedVariant.sellingPrice) * 100)
      : null)
    : (product.salePrice && product.sellingPrice && product.salePrice < product.sellingPrice
      ? Math.round(((product.sellingPrice - product.salePrice) / product.sellingPrice) * 100)
      : null);

  const displayPrice = selectedVariant
    ? (selectedVariant.salePrice ?? selectedVariant.sellingPrice)
    : (product.salePrice ?? product.sellingPrice);

  const sellingPrice = selectedVariant
    ? selectedVariant.sellingPrice
    : product.sellingPrice;

  const hasDiscount = selectedVariant
    ? (!!selectedVariant.salePrice && selectedVariant.salePrice < selectedVariant.sellingPrice)
    : (!!product.salePrice && product.salePrice < product.sellingPrice);

  const currentStock = selectedVariant !== null
    ? selectedVariant.stock
    : product.stock;

  const speciesLabel =
    product.targetSpecies === 'DOG'
      ? 'Cho chó'
      : product.targetSpecies === 'CAT'
        ? 'Cho mèo'
        : 'Mọi thú cưng';

  // Gather all images (main imageUrl + product images + variant images)
  const variantImages = (product.variants || [])
    .map((v) => v.imageUrl)
    .filter((img): img is string => !!img);

  const allImages = Array.from(
    new Set([product.imageUrl, ...(product.images || []), ...variantImages])
  ).filter((img): img is string => !!img);

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
            <Link href="/shop" className="hover:text-[var(--primary-color)] flex items-center gap-1 transition">
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
            href="/shop"
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
                className={`max-h-full max-w-full object-contain transition-all duration-300 rounded-xl ${currentStock === 0 ? 'grayscale opacity-60' : ''
                  }`}
              />
              {currentStock === 0 ? (
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
                    onClick={() => {
                      setActiveImage(img);
                      const matchedVariant = product.variants?.find((v) => v.imageUrl === img);
                      if (matchedVariant) {
                        setSelectedVariant(matchedVariant);
                      }
                    }}
                    className={`relative size-20 overflow-hidden rounded-xl border-2 bg-white transition-all duration-200 hover:scale-105 hover:shadow-md ${activeImage === img
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
                {product.reviewCount > 0 ? (
                  <>
                    <div className="flex items-center gap-0.5 text-[#F59E0B]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4.5 w-4.5 ${i < Math.floor(product.rating)
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
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-0.5 text-gray-300">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-4.5 w-4.5 fill-gray-100 text-gray-300" />
                      ))}
                    </div>
                    <span className="font-semibold text-gray-400">
                      (Chưa có đánh giá nào)
                    </span>
                  </>
                )}
                <span className="text-gray-300">|</span>
                <span className="font-bold flex items-center gap-1">
                  {currentStock === null || currentStock === undefined ? (
                    <span className="text-[#0F766E] flex items-center gap-1">
                      <span className="text-xs font-bold">✓</span> Còn hàng
                    </span>
                  ) : currentStock > 0 ? (
                    <span className="text-[#0F766E] flex items-center gap-1">
                      <span className="text-xs font-bold">✓</span> Còn hàng ({currentStock} sản phẩm)
                    </span>
                  ) : (
                    <span className="text-red-500 font-extrabold">Tạm hết hàng</span>
                  )}
                </span>
              </div>

              {/* Product Variants Selector */}
              {product.variants && product.variants.length > 0 && (
                <div className="mt-5 space-y-3 animate-fadeIn bg-gray-50/50 p-4.5 rounded-2xl border border-[var(--border-color)]">
                  <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Phân loại sản phẩm:</p>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => {
                      const isSelected = selectedVariant?.id === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedVariant(v);
                            if (v.imageUrl) {
                              setActiveImage(v.imageUrl);
                            }
                          }}
                          className={`rounded-xl border-2 px-4 py-2.5 text-xs font-black transition-all duration-200 active:scale-95 ${isSelected
                            ? 'border-[#0F766E] bg-[#EEF8F5] text-[#0F766E] shadow-sm'
                            : 'border-[var(--border-color)] bg-white hover:border-gray-300 text-[var(--text-main)]'
                            }`}
                        >
                          {v.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
                        {formatCurrency(sellingPrice)}
                      </span>
                      <span className="inline-block rounded-md bg-[var(--primary-color)]/10 px-2 py-0.5 text-xs font-black text-[var(--primary-color)]">
                        Tiết kiệm {Math.round(100 - (displayPrice / product.sellingPrice) * 100)}%
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
              {currentStock !== 0 && (
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
                  {currentStock !== undefined && currentStock !== null && (
                    <span className="text-xs font-bold text-[var(--text-muted)] animate-fadeIn">
                      (Còn {currentStock} sản phẩm trong kho)
                    </span>
                  )}
                </div>
              )}

              {/* Purchase Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={currentStock === 0 || isAddingToCart}
                  className="flex-1 inline-flex h-13 items-center justify-center gap-2 rounded-xl border-2 border-[#0F766E] bg-white px-6 text-sm font-black text-[#0F766E] shadow-sm transition-all duration-200 hover:bg-[#F2FAF8] active:scale-98 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
                >
                  {isAddingToCart ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : currentStock === 0 ? (
                    <X className="h-4.5 w-4.5" />
                  ) : (
                    <ShoppingCart className="h-4.5 w-4.5" />
                  )}
                  {currentStock === 0 ? 'Tạm hết hàng' : 'Thêm vào giỏ hàng'}
                </button>

                <button
                  type="button"
                  disabled={currentStock === 0}
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
                        id: selectedVariant ? `${product.id}_${selectedVariant.id}` : product.id,
                        productId: product.id,
                        variantId: selectedVariant?.id || null,
                        product: product,
                        variant: selectedVariant,
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
                  {currentStock === 0 ? (
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
                            className={`h-7 w-7 ${starValue <= submitRating
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

                {/* Review Images Upload Section */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[var(--text-main)] flex items-center justify-between">
                    <span>Đính kèm hình ảnh thực tế (Tối đa 4 ảnh):</span>
                    <span className="text-xxs text-[var(--text-muted)] font-normal">{submitImages.length}/4 ảnh</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    {submitImages.map((imgUrl, idx) => (
                      <div key={idx} className="relative size-16 rounded-xl overflow-hidden border border-gray-200 group shadow-xs">
                        <img src={imgUrl} alt={`Review photo ${idx + 1}`} className="size-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setSubmitImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}

                    {submitImages.length < 4 && (
                      <label className="size-16 rounded-xl border-2 border-dashed border-[var(--primary-color)]/30 hover:border-[var(--primary-color)] bg-white hover:bg-[var(--primary-color)]/5 flex flex-col items-center justify-center cursor-pointer transition text-gray-500 hover:text-[var(--primary-color)]">
                        {uploadingReviewImages ? (
                          <Loader2 className="size-5 animate-spin text-[var(--primary-color)]" />
                        ) : (
                          <>
                            <Camera className="size-5" />
                            <span className="text-[9px] font-bold mt-0.5">Thêm ảnh</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={uploadingReviewImages}
                          onChange={(e) => handleReviewImageUpload(e, false)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingReview || uploadingReviewImages}
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

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-0.5 text-[#F59E0B]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-gray-200'
                              }`}
                          />
                        ))}
                      </div>

                      {(currentUser?.id === review.userId ||
                        currentUser?.role === 'ADMIN' ||
                        currentUser?.role === 'MODERATOR' ||
                        currentUser?.role === 'STORE_MANAGER') && (
                          <div className="flex items-center gap-1 ml-2 border-l border-gray-200 pl-2">
                            {currentUser?.id === review.userId && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditReview(review)}
                                className="p-1 rounded-lg text-gray-400 hover:text-[#0F766E] hover:bg-teal-50 transition cursor-pointer"
                                title="Chỉnh sửa đánh giá"
                              >
                                <Edit2 className="size-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeletingReviewId(review.id)}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Xóa đánh giá"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                    </div>
                  </div>

                  {editingReview?.id === review.id ? (
                    <form onSubmit={handleUpdateReviewSubmit} className="mt-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-900">Chỉnh sửa đánh giá của bạn</span>
                        <button
                          type="button"
                          onClick={() => setEditingReview(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-700">Chọn số sao:</label>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => {
                            const starValue = i + 1;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setEditRating(starValue)}
                                className="p-0.5 text-[#F59E0B] hover:scale-110 transition cursor-pointer"
                              >
                                <Star
                                  className={`h-6 w-6 ${starValue <= editRating
                                    ? 'fill-[#F59E0B] text-[#F59E0B]'
                                    : 'text-gray-300'
                                    }`}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-700">Nhận xét:</label>
                        <textarea
                          rows={2}
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs focus:border-[#0F766E] focus:outline-none"
                        />
                      </div>

                      {/* Edit Images Section */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-700">Hình ảnh đính kèm:</label>
                        <div className="flex flex-wrap items-center gap-2">
                          {editImages.map((imgUrl, idx) => (
                            <div key={idx} className="relative size-14 rounded-lg overflow-hidden border border-gray-200">
                              <img src={imgUrl} alt={`Edit review photo ${idx + 1}`} className="size-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setEditImages((prev) => prev.filter((_, i) => i !== idx))}
                                className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition cursor-pointer"
                              >
                                <X className="size-2.5" />
                              </button>
                            </div>
                          ))}
                          {editImages.length < 4 && (
                            <label className="size-14 rounded-lg border-2 border-dashed border-amber-300 hover:border-amber-500 bg-white flex flex-col items-center justify-center cursor-pointer transition text-gray-500">
                              {uploadingEditImages ? (
                                <Loader2 className="size-4 animate-spin text-amber-600" />
                              ) : (
                                <Camera className="size-4 text-amber-600" />
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={uploadingEditImages}
                                onChange={(e) => handleReviewImageUpload(e, true)}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingReview(null)}
                          className="px-3 py-1.5 rounded-lg border font-bold text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={submittingEdit || uploadingEditImages}
                          className="px-4 py-1.5 rounded-lg bg-[#0F766E] text-white font-bold text-xs hover:bg-[#115E59] disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                        >
                          {submittingEdit && <Loader2 className="size-3 animate-spin text-white" />}
                          Lưu thay đổi
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      {review.comment && (
                        <p className="text-sm text-[var(--text-main)] font-semibold leading-relaxed bg-[#FAF9F6] p-3.5 rounded-xl border border-[#F4EBE0]/50 italic">
                          "{review.comment}"
                        </p>
                      )}

                      {/* Display Review Images Gallery */}
                      {review.images && review.images.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {review.images.map((imgUrl, imgIdx) => (
                            <button
                              key={imgIdx}
                              type="button"
                              onClick={() => setLightboxImage(imgUrl)}
                              className="group relative size-20 rounded-xl overflow-hidden border border-gray-200 hover:border-[var(--primary-color)] transition shadow-xs cursor-pointer"
                            >
                              <img src={imgUrl} alt={`Review photo ${imgIdx + 1}`} className="size-full object-cover transition group-hover:scale-105" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                                <ImageIcon className="size-4 text-white opacity-0 group-hover:opacity-100 transition" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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

        {/* Lightbox Modal for Review Photo Zoom */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setLightboxImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
              <img src={lightboxImage} alt="Review zoom" className="max-w-full max-h-[85vh] object-contain mx-auto" />
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute top-3 right-3 size-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-white hover:text-black transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        )}

        {/* Delete Review Confirmation Dialog */}
        <ConfirmDialog
          isOpen={!!deletingReviewId}
          onClose={() => setDeletingReviewId(null)}
          onConfirm={handleDeleteReviewConfirm}
          title="Xóa nhận xét sản phẩm"
          message="Bạn có chắc chắn muốn xóa nhận xét này không? Sau khi xóa, bạn có thể viết lại nhận xét mới cho sản phẩm này."
          confirmText="Xác nhận xóa"
          isDanger={true}
          loading={deletingReviewLoading}
        />

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
