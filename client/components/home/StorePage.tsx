'use client';

import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Scissors, Heart, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useProducts } from '@/hooks/useProducts';
import ProductCard from './ProductCard';
import Hero from './Hero';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';

const QUICK_CATEGORIES = [
  { name: 'Thức ăn cho Chó', category: 'DOG_FOOD', icon: '🐶', desc: 'Dinh dưỡng cân bằng' },
  { name: 'Thức ăn cho Mèo', category: 'CAT_FOOD', icon: '🐱', desc: 'Hương vị yêu thích' },
  { name: 'Đồ chơi thú cưng', category: 'TOY', icon: '⚽', desc: 'Giải trí vui nhộn' },
  { name: 'Phụ kiện làm đẹp', category: 'ACCESSORY', icon: '🎒', desc: 'Thời trang cao cấp' },
  { name: 'Lồng & Đệm nằm', category: 'CAGE_BED', icon: '🛏️', desc: 'Ấm áp êm ái' },
  { name: 'Dây dắt & Vòng cổ', category: 'LEASH_COLLAR', icon: '🎗️', desc: 'An toàn đi dạo' },
];

export default function StorePage() {
  const router = useRouter();
  const { featuredProducts, featuredLoading, error } = useProducts({ 
    limit: 8,
  });

  const handleCategoryClick = (categoryKey: string) => {
    router.push(`/shop?category=${categoryKey}`);
  };

  return (
    <div
      className="min-h-screen text-[var(--text-main)] flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--bg-page)',
        fontFamily: 'Inter, Outfit, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div className="w-full">
        <AppHeader sectionLabel="Trang chủ" />

        <main className="mx-auto max-w-7xl space-y-16 px-4 py-6 sm:px-6">
          {/* Hero Slide Banner */}
          <Hero />

          {/* Quick Categories Section */}
          <section className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-main)]">
                Danh mục nổi bật
              </h2>
              <p className="text-sm text-[var(--text-muted)] font-bold">
                Tìm kiếm nhanh phụ kiện và thức ăn phù hợp nhất cho bé cưng của bạn
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              {QUICK_CATEGORIES.map((cat, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCategoryClick(cat.category)}
                  className="flex flex-col items-center p-5 rounded-2xl border border-[var(--border-color)] bg-white shadow-[var(--shadow-soft)] hover:shadow-lg hover:border-[var(--primary-color)] transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group"
                >
                  <span className="text-4xl mb-3 filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">
                    {cat.icon}
                  </span>
                  <span className="text-sm font-black text-[var(--text-main)] text-center">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-extrabold mt-1 text-center">
                    {cat.desc}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Featured Products Section */}
          <section className="space-y-6">
            <div className="flex items-end justify-between border-b border-[var(--border-color)] pb-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-[var(--primary-color)] uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Sản phẩm Hot
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] mt-1.5">
                  Sản phẩm nổi bật
                </h2>
              </div>
              <Link
                href="/shop"
                className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--primary-color)] hover:underline group cursor-pointer"
              >
                Xem tất cả
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {featuredLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="aspect-[3/4] w-full rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-xl bg-red-50 p-4 text-center text-sm font-semibold text-red-600">
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {featuredProducts.slice(0, 4).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>

          {/* Dual Promo Section: Spa & Pet Matching */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Spa Promo Card */}
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-gradient-to-br from-[#F0FDF4] to-white p-8 sm:p-10 shadow-[var(--shadow-soft)] flex flex-col justify-between group hover:shadow-md transition">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-extrabold text-[#15803D] uppercase">
                  <Scissors className="h-3.5 w-3.5" />
                  Pet Spa & Grooming
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] leading-tight">
                  Chăm sóc toàn diện <br /> Cho bé cưng tỏa sáng
                </h3>
                <p className="text-sm font-semibold text-[var(--text-muted)] leading-relaxed max-w-md">
                  Dịch vụ cắt tỉa lông tạo kiểu chuyên nghiệp, tắm sấy thơm tho và vệ sinh móng tai răng chuẩn quốc tế. Đặt lịch nhanh chóng, chăm sóc chu đáo bởi đội ngũ tận tâm.
                </p>
                <div className="flex gap-4 pt-1 text-xs text-[#16A34A] font-extrabold">
                  <span>✓ Cắt tỉa tạo kiểu</span>
                  <span>•</span>
                  <span>✓ Tắm sấy khử mùi</span>
                  <span>•</span>
                  <span>✓ Vệ sinh tai móng</span>
                </div>
              </div>
              <div className="pt-6">
                <Link
                  href="/spa"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-6 text-sm font-extrabold text-white shadow-sm hover:bg-[#15803D] active:scale-95 transition cursor-pointer"
                >
                  Đặt lịch ngay
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Pet Matching Promo Card */}
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-gradient-to-br from-[#FFF5F5] to-white p-8 sm:p-10 shadow-[var(--shadow-soft)] flex flex-col justify-between group hover:shadow-md transition">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE4E4] px-3 py-1 text-xs font-extrabold text-[#E11D48] uppercase">
                  <Heart className="h-3.5 w-3.5 fill-[#E11D48] text-[#E11D48]" />
                  Pet Matching AI
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] leading-tight">
                  Tìm kiếm bạn đời <br /> Kết nối tình cảm bé cưng
                </h3>
                <p className="text-sm font-semibold text-[var(--text-muted)] leading-relaxed max-w-md">
                  Thuật toán so khớp thông minh dựa trên giống loài, tuổi tác và khoảng cách địa lý giúp thú cưng của bạn nhanh chóng tìm được một nửa yêu thương và duy trì nòi giống an toàn.
                </p>
                <div className="flex gap-4 pt-1 text-xs text-[#E11D48] font-extrabold">
                  <span>✓ So khớp thông minh</span>
                  <span>•</span>
                  <span>✓ Swipe Card thú cưng</span>
                  <span>•</span>
                  <span>✓ Chat kết nối</span>
                </div>
              </div>
              <div className="pt-6">
                <Link
                  href="/pet-matching"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#E11D48] px-6 text-sm font-extrabold text-white shadow-sm hover:bg-[#BE123C] active:scale-95 transition cursor-pointer"
                >
                  Bắt đầu ghép đôi
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* Core Values Section */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-[var(--border-color)]">
            {[
              { icon: ShieldCheck, title: 'Sản phẩm chính hãng', desc: 'Cam kết 100% thức ăn & phụ kiện nguồn gốc xuất xứ rõ ràng.' },
              { icon: Truck, title: 'Giao hàng siêu tốc', desc: 'Đồng bộ vận chuyển GHN giao hàng nhanh toàn quốc chỉ từ 1-3 ngày.' },
              { icon: RotateCcw, title: 'Chính sách đổi trả', desc: 'Đổi trả miễn phí trong vòng 7 ngày đối với các sản phẩm lỗi sản xuất.' },
            ].map((value, idx) => (
              <div key={idx} className="flex gap-4 p-5 rounded-2xl bg-[#FAF9F5] border border-[var(--border-color)]">
                <value.icon className="h-8 w-8 text-[#0F766E] shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-[var(--text-main)]">{value.title}</h4>
                  <p className="text-xs text-[var(--text-muted)] font-semibold leading-relaxed">{value.desc}</p>
                </div>
              </div>
            ))}
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
