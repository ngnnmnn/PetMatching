'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  Minus,
  Plus,
  ArrowLeft,
  ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';
import AppHeader from '@/components/layout/AppHeader';
import { useCart } from '@/context/CartContext';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CartPage() {
  const router = useRouter();
  const {
    cartItems,
    removeFromCart,
    updateQuantity
  } = useCart();

  const [isMounted, setIsMounted] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize selectedItemIds when cart is first loaded (defaulting to unchecked)
  useEffect(() => {
    if (isMounted && cartItems.length > 0 && !hasInitializedSelection) {
      setSelectedItemIds([]);
      setHasInitializedSelection(true);
    }
  }, [cartItems, isMounted, hasInitializedSelection]);

  // Sync selectedItemIds when cart items change (clean up deleted items from selection)
  useEffect(() => {
    if (hasInitializedSelection) {
      const currentIds = cartItems.map((item) => item.id);
      setSelectedItemIds((prev) => prev.filter((id) => currentIds.includes(id)));
    }
  }, [cartItems, hasInitializedSelection]);

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === cartItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(cartItems.map((item) => item.id));
    }
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
  const selectedItems = cartItems.filter((item) => selectedItemIds.includes(item.id));

  const selectedTotal = selectedItems.reduce((acc, item) => {
    const price = item.product.salePrice ?? item.product.sellingPrice;
    return acc + price * item.quantity;
  }, 0);

  const selectedCount = selectedItems.reduce((acc, item) => acc + item.quantity, 0);

  // Shipping Fee Logic: Free shipping for orders > 500k, otherwise 30k
  const shippingFee = selectedTotal > 500000 || selectedTotal === 0 ? 0 : 30000;
  const finalTotal = selectedTotal + shippingFee;

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
              href="/home"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#cf5017]"
            >
              Quay lại cửa hàng
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Cart Items List */}
            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-2xl border border-[var(--border-color)] bg-white overflow-hidden shadow-sm">

                {/* Select All Bar */}
                <div className="bg-[#FCFCFA] px-4 py-3 border-b border-[var(--border-color)] flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.length === cartItems.length && cartItems.length > 0}
                    onChange={handleToggleSelectAll}
                    className="size-5 rounded border-[var(--border-color)] text-[var(--primary-color)] focus:ring-[var(--primary-color)] accent-[var(--primary-color)] cursor-pointer shrink-0"
                    id="select-all-cart"
                  />
                  <label htmlFor="select-all-cart" className="text-sm font-bold text-[var(--text-main)] cursor-pointer select-none">
                    Chọn tất cả ({cartItems.length} sản phẩm)
                  </label>
                </div>

                <div className="divide-y divide-[var(--border-color)]">
                  {cartItems.map((item) => {
                    const price = item.variant
                      ? (item.variant.salePrice ?? item.variant.sellingPrice)
                      : (item.product.salePrice ?? item.product.sellingPrice);
                    const originalPrice = item.variant
                      ? item.variant.sellingPrice
                      : item.product.sellingPrice;
                    const itemSubtotal = price * item.quantity;
                    const isDiscounted = item.variant
                      ? (item.variant.salePrice && item.variant.salePrice < item.variant.sellingPrice)
                      : (item.product.salePrice && item.product.salePrice < item.product.sellingPrice);

                    return (
                      <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        {/* Checkbox */}
                        <div className="flex items-center h-full sm:self-center shrink-0 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={() => handleToggleSelectItem(item.id)}
                            className="size-5 rounded border-[var(--border-color)] text-[var(--primary-color)] focus:ring-[var(--primary-color)] accent-[var(--primary-color)] cursor-pointer shrink-0"
                          />
                        </div>

                        {/* Product Image */}
                        <Link href={`/product/${item.productId}`} className="shrink-0 aspect-square w-20 sm:w-24 rounded-lg overflow-hidden bg-[#FAF9F5] border border-[var(--border-color)]">
                          <img
                            src={(item.variant && item.variant.imageUrl) || item.product.imageUrl || '/placeholder.svg'}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </Link>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-extrabold text-[#0F766E] uppercase tracking-wider">{item.product.brand || 'PetMatch'}</p>
                          <Link href={`/product/${item.productId}`} className="block text-sm font-black text-[var(--text-main)] hover:text-primary transition line-clamp-1 mt-0.5">
                            {item.product.name}
                          </Link>
                          {item.variant && (
                            <p className="text-[11px] text-[#0F766E] font-extrabold mt-0.5 bg-[#EEF8F5] px-2 py-0.5 rounded inline-block">
                              Phân loại: {item.variant.name}
                            </p>
                          )}
                          {item.product.unit && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">Đơn vị: {item.product.unit}</p>
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
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="inline-flex size-7 items-center justify-center rounded bg-gray-50 text-gray-600 transition hover:bg-gray-100 hover:text-black"
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
                            className="inline-flex size-9 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
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
                      {shippingFee === 0 ? 'Miễn phí' : formatCurrency(shippingFee)}
                    </span>
                  </div>
                  {shippingFee > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-amber-600 font-extrabold mt-0.5">
                        Mua thêm {formatCurrency(500000 - selectedTotal)} để được Miễn phí vận chuyển!
                      </p>
                      <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                        * Phí vận chuyển thực tế sẽ được tính chính xác tại trang thanh toán dựa trên địa chỉ giao hàng của bạn.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[var(--border-color)] flex justify-between items-end">
                    <span className="text-sm font-black text-[var(--text-main)]">Tổng cộng</span>
                    <span className="text-xl font-black text-[var(--primary-color)]">{formatCurrency(finalTotal)}</span>
                  </div>

                  <button
                    disabled={selectedItemIds.length === 0}
                    onClick={() => {
                      localStorage.setItem(
                        'petmatch_selected_cart_items',
                        JSON.stringify(selectedItemIds)
                      );
                      localStorage.removeItem('petmatch_direct_checkout_item');
                      router.push('/checkout');
                    }}
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
