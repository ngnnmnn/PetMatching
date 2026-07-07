'use client';

import { useState } from 'react';
import { Heart, Search, Store, Sparkles, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import { useWishlist } from '@/context/WishlistContext';
import ProductCard from '@/components/home/ProductCard';

type TabType = 'pets' | 'products';

export default function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pets');
  const { wishlistItems } = useWishlist();

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
      <AppHeader sectionLabel="Yêu thích" />
      
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Page Title & Tab Selector */}
        <div className="flex flex-col items-center justify-between gap-4 border-b border-[var(--border-color)] pb-6 sm:flex-row">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] sm:text-3xl">
              Danh sách yêu thích
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Quản lý các thú cưng và sản phẩm bạn đã lưu để xem lại sau.
            </p>
          </div>

          {/* Custom Tabs */}
          <div className="inline-flex rounded-xl border border-[var(--border-color)] bg-white p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('pets')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold transition-all duration-200 ${
                activeTab === 'pets'
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:bg-[#FAF9F5] hover:text-[var(--text-main)]'
              }`}
            >
              <Heart className="size-4" />
              Thú cưng
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-extrabold transition-all duration-200 ${
                activeTab === 'products'
                  ? 'bg-[#0F766E] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:bg-[#FAF9F5] hover:text-[var(--text-main)]'
              }`}
            >
              <ShoppingBag className="size-4" />
              Sản phẩm ({wishlistItems.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="py-8">
          {activeTab === 'pets' ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-white p-12 text-center shadow-sm">
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-red-50 text-red-500">
                <Heart className="size-8 fill-red-100" />
              </div>
              <h3 className="mb-2 text-lg font-black text-[var(--text-main)]">Không có thú cưng yêu thích</h3>
              <p className="mx-auto mb-8 max-w-md text-sm text-[var(--text-muted)] leading-relaxed">
                Các hồ sơ bạn đã lưu khi quẹt thẻ (swipe) hoặc khám phá sẽ hiển thị tại đây. Tính năng lưu yêu thích này đang được cập nhật.
              </p>
              <Link href="/explore" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#115E59]">
                <Search className="size-4" />
                Khám phá hồ sơ thú cưng
              </Link>
            </div>
          ) : (
            <div>
              {wishlistItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                    <ShoppingBag className="size-8" />
                  </div>
                  <h3 className="mb-2 text-lg font-black text-[var(--text-main)]">Sản phẩm yêu thích trống</h3>
                  <p className="mx-auto mb-8 max-w-md text-sm text-[var(--text-muted)] leading-relaxed">
                    Bạn chưa thêm bất kỳ sản phẩm nào vào danh sách yêu thích. Hãy tiếp tục duyệt qua cửa hàng để tìm kiếm đồ ăn, đồ chơi hoặc phụ kiện tốt nhất cho thú cưng của bạn.
                  </p>
                  <Link href="/home" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#cf5017]">
                    <Store className="size-4" />
                    Ghé thăm cửa hàng
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-muted)]">
                    <Sparkles className="size-4 text-[#F59E0B]" />
                    <span>Có {wishlistItems.length} sản phẩm trong danh sách của bạn</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {wishlistItems.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
