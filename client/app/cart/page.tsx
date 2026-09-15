'use client';

import { useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  Minus,
  Plus,
  ArrowLeft,
  ShoppingBag,
  AlertCircle
} from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { type CartItem, useCart } from '@/context/CartContext';

import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FREE_SHIPPING_THRESHOLD = 500000;

/** Đăng ký rỗng để React phân biệt lần render server và client mà không cần cập nhật state trong effect. */
function subscribeToMount() {
  return () => undefined;
}

/** Xác định component đã chạy trên trình duyệt để tránh lệch giao diện khi hydrate dữ liệu giỏ hàng. */
function useIsMounted() {
  return useSyncExternalStore(subscribeToMount, () => true, () => false);
}

/** Định dạng số tiền trong giỏ hàng theo đơn vị Việt Nam đồng. */
function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Lấy đúng đơn giá hiện tại, ưu tiên giá của phân loại sản phẩm nếu có. */
function getCartItemPrice(item: CartItem) {
  return item.variant
    ? (item.variant.salePrice ?? item.variant.sellingPrice)
    : (item.product.salePrice ?? item.product.sellingPrice);
}

/** Kiểm tra khả năng mua và số lượng tồn kho hiện tại của một dòng giỏ hàng. */
function getItemStockStatus(item: CartItem) {
  const isProductInactive = item.product?.isActive === false;
  const isVariantInactive = !!item.variant && item.variant.isActive === false;
  const isInactive = isProductInactive || isVariantInactive;

  const availableStock = item.variant
    ? (item.variant.stock ?? 0)
    : (item.product?.stock ?? 0);

  const isOutOfStock = availableStock <= 0;
  const isStockInsufficient = availableStock < item.quantity;
  const isUnpurchasable = isInactive || isOutOfStock || isStockInsufficient;

  return {
    isInactive,
    availableStock,
    isOutOfStock,
    isStockInsufficient,
    isUnpurchasable,
  };
}

/**
 * Hàm so sánh thời gian thêm sản phẩm vào giỏ hàng giảm dần.
 * Sản phẩm thêm sau (mới hơn) sẽ được đưa lên trên cùng.
 */
function compareAddedTime(a: CartItem, b: CartItem) {
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (timeB !== timeA) {
    return timeB - timeA;
  }
  const updateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const updateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return updateB - updateA;
}

/** Hiển thị giỏ hàng, quản lý lựa chọn sản phẩm và tạm tính trước khi thanh toán. */
export default function CartPage() {
  const router = useRouter();
  const {
    cartItems,
    removeFromCart,
    removeMultipleFromCart,
    updateQuantity
  } = useCart();

  const isMounted = useIsMounted();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // 1. Phân loại và sắp xếp sản phẩm:
  // - Sản phẩm khả dụng: Đang mở bán và còn hàng trong kho (stock > 0), xếp theo thời gian thêm vào giỏ (mới nhất lên trên)
  const availableItems = cartItems
    .filter((item) => {
      const status = getItemStockStatus(item);
      return !status.isInactive && !status.isOutOfStock;
    })
    .sort(compareAddedTime);

  // - Sản phẩm không khả dụng: Hết hàng trong kho hoặc tạm ngưng bán, xếp theo thời gian thêm vào giỏ (mới nhất lên trên)
  const unavailableItems = cartItems
    .filter((item) => {
      const status = getItemStockStatus(item);
      return status.isInactive || status.isOutOfStock;
    })
    .sort(compareAddedTime);

  // Các sản phẩm có thể thanh toán (phải thuộc availableItems và số lượng mua <= tồn kho)
  const purchasableItems = availableItems.filter(
    (item) => !getItemStockStatus(item).isStockInsufficient,
  );
  // Danh sách ID được chọn hợp lệ (chỉ chấp nhận các item khả dụng)
  const validSelectedItemIds = selectedItemIds.filter((id) =>
    availableItems.some((item) => item.id === id),
  );

  /**
   * Chọn hoặc bỏ chọn một sản phẩm khả dụng trong giỏ hàng.
   */
  const handleToggleSelectItem = (item: CartItem) => {
    const status = getItemStockStatus(item);
    if (status.isInactive) {
      toast.warning(`Sản phẩm "${item.product?.name || 'này'}" hiện đang tạm ngưng bán, không thể chọn mua.`);
      return;
    }
    if (status.isOutOfStock) {
      toast.warning(`Sản phẩm "${item.product?.name || 'này'}" hiện đã hết hàng trong kho.`);
      return;
    }
    if (status.isStockInsufficient) {
      toast.warning(`Kho chỉ còn ${status.availableStock} sản phẩm, không đủ số lượng trong giỏ (${item.quantity}). Vui lòng giảm số lượng.`);
      return;
    }
    setSelectedItemIds((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
    );
  };

  /**
   * Chọn tất cả hoặc bỏ chọn tất cả các sản phẩm khả dụng trong giỏ hàng.
   */
  const handleToggleSelectAll = () => {
    if (validSelectedItemIds.length === purchasableItems.length && purchasableItems.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(purchasableItems.map((item) => item.id));
    }
  };

  /**
   * Xóa toàn bộ sản phẩm trong danh sách hàng không khả dụng.
   */
  const handleClearUnavailable = async () => {
    if (unavailableItems.length === 0) return;
    const ids = unavailableItems.map((i) => i.id);
    if (removeMultipleFromCart) {
      await removeMultipleFromCart(ids);
    } else {
      for (const id of ids) {
        await removeFromCart(id);
      }
    }
  };

  /**
   * Kiểm tra điều kiện và chuyển hướng sang trang thanh toán.
   */
  const handleProceedToCheckout = () => {
    if (validSelectedItemIds.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 sản phẩm hợp lệ còn hàng để thanh toán.');
      return;
    }

    const selectedItems = cartItems.filter((i) => validSelectedItemIds.includes(i.id));
    for (const item of selectedItems) {
      const status = getItemStockStatus(item);
      if (status.isInactive) {
        toast.error(`Sản phẩm "${item.product.name}" hiện đang tạm ngưng bán. Vui lòng bỏ chọn khỏi giỏ hàng.`);
        return;
      }
      if (status.isOutOfStock) {
        toast.error(`Sản phẩm "${item.product.name}" hiện đã hết hàng. Vui lòng bỏ chọn khỏi giỏ hàng.`);
        return;
      }
      if (status.isStockInsufficient) {
        toast.error(`Sản phẩm "${item.product.name}" chỉ còn ${status.availableStock} cái trong kho (Bạn đang chọn ${item.quantity}). Vui lòng điều chỉnh số lượng.`);
        return;
      }
    }

    localStorage.setItem('petmatch_selected_cart_items', JSON.stringify(validSelectedItemIds));
    localStorage.removeItem('petmatch_direct_checkout_item');
    router.push('/checkout');
  };

  if (!isMounted) {
    return (
      <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
        <AppHeader sectionLabel="Giỏ hàng" />
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-[var(--primary-color)] border-t-transparent" />
          <p className="text-sm font-semibold text-[var(--text-muted)]">Đang tải giỏ hàng...</p>
        </div>
      </main>
    );
  }

  // Calculate totals based on selected items only
  const selectedItems = availableItems.filter((item) => validSelectedItemIds.includes(item.id));

  const selectedTotal = selectedItems.reduce((acc, item) => {
    return acc + getCartItemPrice(item) * item.quantity;
  }, 0);

  const selectedCount = selectedItems.reduce((acc, item) => acc + item.quantity, 0);

  // Cart chỉ xác định miễn phí vận chuyển; phí thực tế được tính theo địa chỉ tại checkout.
  const isFreeShipping = selectedTotal > FREE_SHIPPING_THRESHOLD;
  const amountNeededForFreeShipping = Math.max(
    0,
    FREE_SHIPPING_THRESHOLD - selectedTotal + 1,
  );
  const areAllPurchasableItemsSelected =
    purchasableItems.length > 0 &&
    purchasableItems.every((item) => validSelectedItemIds.includes(item.id));

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-16">
      <AppHeader sectionLabel="Giỏ hàng" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Back Link */}
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-muted)] hover:text-primary transition mb-6"
        >
          <ArrowLeft className="size-4" />
          Tiếp tục mua sắm
        </Link>

        <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] sm:text-3xl mb-8">
          Giỏ hàng của bạn
        </h1>

        {cartItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-white p-16 text-center shadow-sm max-w-2xl mx-auto">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-orange-50 text-[var(--primary-color)]">
              <ShoppingBag className="size-10" />
            </div>
            <h3 className="mb-2 text-xl font-black text-[var(--text-main)]">Giỏ hàng trống</h3>
            <p className="mx-auto mb-8 max-w-md text-sm text-[var(--text-muted)] leading-relaxed">
              Không có sản phẩm nào trong giỏ hàng của bạn. Hãy quay lại cửa hàng để khám phá hàng ngàn phụ kiện, đồ ăn hấp dẫn cho thú cưng nhé!
            </p>
            <Link
              href="/shop"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#cf5017]"
            >
              Quay lại cửa hàng
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Cart Items List */}
            <div className="lg:col-span-8 space-y-6">

              {/* MỤC 1: SẢN PHẨM KHẢ DỤNG */}
              {availableItems.length > 0 ? (
                <div className="rounded-2xl border border-[var(--border-color)] bg-white overflow-hidden shadow-sm">
                  {/* Select All Bar */}
                  <div className="bg-[#FCFCFA] px-4 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={areAllPurchasableItemsSelected}
                        onChange={handleToggleSelectAll}
                        className="size-5 rounded border-[var(--border-color)] text-[var(--primary-color)] focus:ring-[var(--primary-color)] accent-[var(--primary-color)] cursor-pointer shrink-0"
                        id="select-all-cart"
                      />
                      <label htmlFor="select-all-cart" className="text-sm font-bold text-[var(--text-main)] cursor-pointer select-none">
                        Chọn tất cả ({availableItems.length} sản phẩm khả dụng)
                      </label>
                    </div>
                  </div>

                  <div className="divide-y divide-[var(--border-color)]">
                    {availableItems.map((item) => {
                      const price = getCartItemPrice(item);
                      const originalPrice = item.variant
                        ? item.variant.sellingPrice
                        : item.product.sellingPrice;
                      const itemSubtotal = price * item.quantity;
                      const isDiscounted = item.variant
                        ? (item.variant.salePrice && item.variant.salePrice < item.variant.sellingPrice)
                        : (item.product.salePrice && item.product.salePrice < item.product.sellingPrice);

                      const status = getItemStockStatus(item);

                      return (
                        <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center transition-colors hover:bg-[#FAF9F5]/40">
                          {/* Checkbox */}
                          <div className="flex items-center h-full sm:self-center shrink-0 pr-2">
                            <input
                              type="checkbox"
                              checked={validSelectedItemIds.includes(item.id)}
                              onChange={() => handleToggleSelectItem(item)}
                              className="size-5 rounded border-[var(--border-color)] text-[var(--primary-color)] focus:ring-[var(--primary-color)] accent-[var(--primary-color)] shrink-0 cursor-pointer"
                            />
                          </div>

                          {/* Product Image */}
                          <Link href={`/product/${item.productId}`} className="shrink-0 aspect-square w-20 sm:w-24 rounded-lg overflow-hidden bg-[#FAF9F5] border border-[var(--border-color)] relative">
                            <Image
                              src={(item.variant && item.variant.imageUrl) || item.product.imageUrl || '/placeholder.svg'}
                              alt={item.product.name}
                              fill
                              sizes="(max-width: 640px) 80px, 96px"
                              className="object-cover transition-all"
                            />
                          </Link>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-[10px] font-extrabold text-[#0F766E] uppercase tracking-wider">{item.product.brand || 'PetMatch'}</span>
                              {status.isStockInsufficient && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 border border-amber-200">
                                  ⚠️ Kho chỉ còn {status.availableStock} cái
                                </span>
                              )}
                            </div>
                            <Link href={`/product/${item.productId}`} className="block text-sm font-black transition line-clamp-1 mt-0.5 text-[var(--text-main)] hover:text-primary">
                              {item.product.name}
                            </Link>
                            {item.variant && (
                              <p className="text-[11px] text-[#0F766E] font-extrabold mt-0.5 bg-[#EEF8F5] px-2 py-0.5 rounded inline-block">
                                Phân loại: {item.variant.name}
                              </p>
                            )}
                            {/* Unit Price */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-bold text-[var(--primary-color)]">{formatCurrency(price)}</span>
                              {isDiscounted && (
                                <span className="text-xs text-[var(--text-muted)] line-through">{formatCurrency(originalPrice)}</span>
                              )}
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center rounded-lg border border-[var(--border-color)] bg-white p-1">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="inline-flex size-7 items-center justify-center rounded bg-gray-50 text-gray-600 transition hover:bg-gray-100 hover:text-black"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-10 text-center text-xs font-black">{item.quantity}</span>
                              <button
                                type="button"
                                disabled={item.quantity >= status.availableStock}
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className={cn(
                                  "inline-flex size-7 items-center justify-center rounded bg-gray-50 text-gray-600 transition",
                                  item.quantity >= status.availableStock
                                    ? "opacity-40 cursor-not-allowed"
                                    : "hover:bg-gray-100 hover:text-black"
                                )}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Item Subtotal */}
                            <div className="hidden sm:block text-right min-w-[80px]">
                              <span className="text-sm font-black text-[var(--text-main)]">{formatCurrency(itemSubtotal)}</span>
                            </div>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className="inline-flex size-9 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                              aria-label="Xóa sản phẩm"
                            >
                              <Trash2 className="size-4.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-white p-8 text-center shadow-sm">
                  <p className="text-sm font-semibold text-[var(--text-muted)]">
                    Hiện không có sản phẩm nào khả dụng để thanh toán.
                  </p>
                </div>
              )}

              {/* MỤC 2: HÀNG KHÔNG KHẢ DỤNG (HẾT HÀNG HOẶC TẠM NGƯNG BÁN) */}
              {unavailableItems.length > 0 && (
                <div className="rounded-2xl border border-red-200/80 bg-white overflow-hidden shadow-sm">
                  {/* Tiêu đề mục Hàng không khả dụng */}
                  <div className="bg-red-50/50 px-4 py-3.5 border-b border-red-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-red-100 text-red-600">
                        <AlertCircle className="size-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                          Hàng không khả dụng
                          <span className="rounded-full bg-red-100 px-2 py-0.2 text-xs font-black text-red-600">
                            {unavailableItems.length}
                          </span>
                        </h2>
                        <p className="text-[11px] text-gray-500 font-medium">
                          Sản phẩm đã hết hàng hoặc ngừng kinh doanh và không thể thanh toán
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearUnavailable}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 hover:underline transition cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      Xóa tất cả ({unavailableItems.length})
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100 bg-slate-50/50">
                    {unavailableItems.map((item) => {
                      const price = getCartItemPrice(item);
                      const status = getItemStockStatus(item);

                      return (
                        <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center opacity-75 hover:opacity-100 transition-opacity">
                          {/* Checkbox vô hiệu hóa */}
                          <div className="flex items-center h-full sm:self-center shrink-0 pr-2">
                            <input
                              type="checkbox"
                              disabled
                              checked={false}
                              className="size-5 rounded border-gray-300 bg-gray-200 text-gray-400 cursor-not-allowed opacity-50 shrink-0"
                              title="Sản phẩm không khả dụng"
                            />
                          </div>

                          {/* Product Image */}
                          <div className="shrink-0 aspect-square w-20 sm:w-24 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 relative grayscale opacity-60">
                            <Image
                              src={(item.variant && item.variant.imageUrl) || item.product.imageUrl || '/placeholder.svg'}
                              alt={item.product.name}
                              fill
                              sizes="(max-width: 640px) 80px, 96px"
                              className="object-cover"
                            />
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.product.brand || 'PetMatch'}</span>
                              {status.isInactive ? (
                                <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200">
                                  🚫 Ngừng kinh doanh
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 border border-amber-200">
                                  ⚠️ Hết hàng trong kho
                                </span>
                              )}
                            </div>
                            <span className="block text-sm font-bold text-gray-500 line-through line-clamp-1">
                              {item.product.name}
                            </span>
                            {item.variant && (
                              <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                                Phân loại: {item.variant.name} {item.variant.isActive === false && '(Đã ngưng)'}
                              </p>
                            )}
                            {/* Price */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-semibold text-gray-400">{formatCurrency(price)}</span>
                            </div>
                          </div>

                          {/* Quantity (ReadOnly) */}
                          <div className="flex items-center gap-3">
                            <div className="text-xs font-bold text-gray-400 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-100">
                              SL: {item.quantity}
                            </div>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className="inline-flex size-9 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                              aria-label="Xóa sản phẩm không khả dụng"
                              title="Xóa khỏi giỏ hàng"
                            >
                              <Trash2 className="size-4.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Order Summary & Checkout Redirect */}
            <div className="lg:col-span-4 space-y-6">

              {/* Summary Card */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-[var(--text-main)] pb-2 border-b border-[var(--border-color)]">Tóm tắt đơn hàng</h3>

                <div className="space-y-2.5 text-sm font-semibold">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Tạm tính ({selectedCount} sản phẩm)</span>
                    <span className="text-[var(--text-main)]">{formatCurrency(selectedTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Phí vận chuyển (Tạm tính)</span>
                    <span className="text-[var(--text-main)]">
                      {selectedTotal === 0
                        ? '—'
                        : isFreeShipping
                          ? 'Miễn phí'
                          : 'Tính tại bước thanh toán'}
                    </span>
                  </div>
                  {selectedTotal > 0 && !isFreeShipping && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-amber-600 font-extrabold mt-0.5">
                        Mua thêm {formatCurrency(amountNeededForFreeShipping)} để được miễn phí vận chuyển!
                      </p>
                      <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                        * Phí vận chuyển được tính theo địa chỉ giao hàng tại bước thanh toán.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[var(--border-color)] flex justify-between items-end">
                    <span className="text-sm font-black text-[var(--text-main)]">Tạm tính</span>
                    <span className="text-xl font-black text-[var(--primary-color)]">{formatCurrency(selectedTotal)}</span>
                  </div>

                  <button
                    disabled={validSelectedItemIds.length === 0}
                    onClick={handleProceedToCheckout}
                    className="w-full mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#cf5017] focus-visible:outline-none disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Mua ngay
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </main>
  );
}
