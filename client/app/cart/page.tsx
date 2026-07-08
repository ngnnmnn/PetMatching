'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  Minus,
  Plus,
  ArrowLeft,
  ShoppingBag,
  Tag
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
    updateQuantity,
    cartTotal,
    cartCount
  } = useCart();

  const [isMounted, setIsMounted] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedCode, setAppliedCode] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Shipping Fee Logic: Free shipping for orders > 500k, otherwise 30k
  const shippingFee = cartTotal > 500000 || cartTotal === 0 ? 0 : 30000;
  
  // Discount Calculation
  const discountVal = (cartTotal * discountPercent) / 100 + discountAmount;
  const finalTotal = Math.max(0, cartTotal + shippingFee - discountVal);

  const handleApplyPromoCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    const code = promoCode.trim().toUpperCase();
    if (code === 'PETMATCH10') {
      setDiscountPercent(10);
      setDiscountAmount(0);
      setAppliedCode(code);
      toast.success('Áp dụng mã PETMATCH10 thành công! Giảm 10% tổng hóa đơn.');
    } else if (code === 'HELLOWORLD') {
      setDiscountPercent(0);
      setDiscountAmount(50000);
      setAppliedCode(code);
      toast.success('Áp dụng mã HELLOWORLD thành công! Giảm 50.000đ.');
    } else {
      toast.error('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
    }
    setPromoCode('');
  };

  const handleRemovePromo = () => {
    setDiscountPercent(0);
    setDiscountAmount(0);
    setAppliedCode('');
    toast.message('Đã hủy áp dụng mã giảm giá');
  };

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-16">
      <AppHeader sectionLabel="Giỏ hàng" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Back Link */}
        <Link
          href="/home"
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
                <div className="divide-y divide-[var(--border-color)]">
                  {cartItems.map((item) => {
                    const price = item.product.salePrice ?? item.product.originalPrice;
                    const itemSubtotal = price * item.quantity;
                    const isDiscounted = item.product.salePrice && item.product.salePrice < item.product.originalPrice;

                    return (
                      <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        {/* Product Image */}
                        <Link href={`/home/product/${item.id}`} className="shrink-0 aspect-square w-20 sm:w-24 rounded-lg overflow-hidden bg-[#FAF9F5] border border-[var(--border-color)]">
                          <img
                            src={item.product.imageUrl || '/placeholder.svg'}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </Link>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-extrabold text-[#0F766E] uppercase tracking-wider">{item.product.brand || 'PetMatch'}</p>
                          <Link href={`/home/product/${item.id}`} className="block text-sm font-black text-[var(--text-main)] hover:text-primary transition line-clamp-1 mt-0.5">
                            {item.product.name}
                          </Link>
                          {item.product.unit && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">Đơn vị: {item.product.unit}</p>
                          )}
                          
                          {/* Unit Price */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-bold text-[var(--primary-color)]">{formatCurrency(price)}</span>
                            {isDiscounted && (
                              <span className="text-xs text-[var(--text-muted)] line-through">{formatCurrency(item.product.originalPrice)}</span>
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

              {/* Promo Code Box */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-white p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-[var(--text-main)] mb-3 flex items-center gap-2">
                  <Tag className="size-4 text-primary" />
                  Mã giảm giá
                </h3>
                {appliedCode ? (
                  <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-200 p-3.5">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-green-500 shrink-0" />
                      <div>
                        <span className="text-sm font-extrabold text-green-800">Đã áp dụng: {appliedCode}</span>
                        <p className="text-[11px] text-green-700 font-semibold mt-0.5">
                          {discountPercent > 0 ? `Giảm ${discountPercent}% tổng đơn hàng` : `Giảm ${formatCurrency(discountAmount)}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyPromoCode} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập mã (Ví dụ: PETMATCH10, HELLOWORLD)"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="flex-1 rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA]"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-[#0F766E] px-5 py-2 text-sm font-extrabold text-white hover:bg-[#115E59] transition"
                    >
                      Áp dụng
                    </button>
                  </form>
                )}
                <div className="mt-2.5 flex flex-wrap gap-2 text-[10px] text-[var(--text-muted)] font-semibold">
                  <span>Mã gợi ý:</span>
                  <button type="button" onClick={() => setPromoCode('PETMATCH10')} className="underline text-[#0F766E] hover:text-[#115E59]">PETMATCH10 (Giảm 10%)</button>
                  <span>|</span>
                  <button type="button" onClick={() => setPromoCode('HELLOWORLD')} className="underline text-[#0F766E] hover:text-[#115E59]">HELLOWORLD (Giảm 50k)</button>
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
                    <span>Tạm tính ({cartCount} sản phẩm)</span>
                    <span className="text-[var(--text-main)]">{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Phí vận chuyển</span>
                    <span className="text-[var(--text-main)]">
                      {shippingFee === 0 ? 'Tính khi giao' : formatCurrency(shippingFee)}
                    </span>
                  </div>
                  {shippingFee > 0 && (
                    <p className="text-[10px] text-amber-600 font-extrabold mt-0.5">
                      Mua thêm {formatCurrency(500000 - cartTotal)} để được Miễn phí vận chuyển!
                    </p>
                  )}
                  {appliedCode && (
                    <div className="flex justify-between text-green-600">
                      <span>Giảm giá ({appliedCode})</span>
                      <span>-{formatCurrency(discountVal)}</span>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t border-[var(--border-color)] flex justify-between items-end">
                    <span className="text-sm font-black text-[var(--text-main)]">Tổng cộng</span>
                    <span className="text-xl font-black text-[var(--primary-color)]">{formatCurrency(finalTotal)}</span>
                  </div>

                  <button
                    onClick={() => {
                      const url = appliedCode ? `/checkout?code=${appliedCode}` : '/checkout';
                      router.push(url);
                    }}
                    className="w-full mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#cf5017] focus-visible:outline-none"
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
