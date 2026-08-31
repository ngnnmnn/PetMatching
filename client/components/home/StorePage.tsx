'use client';
import Image from 'next/image';
import { Sparkles, ArrowRight, Scissors, Heart, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { useProducts } from '@/hooks/useProducts';
import ProductCard from './ProductCard';
import Hero from './Hero';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';

// Filter out test/system products (e.g. vouchers, shipping fees, debug products, gibberish keyboard mashes)
const isTestOrSystemProduct = (product: any) => {
  const nameLower = product.name.toLowerCase();
  const brandLower = (product.brand || '').toLowerCase();
  const descLower = (product.description || '').toLowerCase();

  const hasKeyword = (
    nameLower.includes('test') ||
    nameLower.includes('freeship') ||
    nameLower.includes('voucher') ||
    nameLower.includes('coupon') ||
    nameLower.includes('phí ship') ||
    nameLower.includes('phí vận chuyển') ||
    nameLower.includes('thử nghiệm') ||
    nameLower.includes('thu nghiem') ||
    nameLower.includes('nháp') ||
    nameLower.includes('nhap') ||
    nameLower.includes('demo') ||
    nameLower.includes('excel') ||
    brandLower.includes('test') ||
    brandLower.includes('demo') ||
    descLower.includes('test') ||
    descLower.includes('thử nghiệm') ||
    descLower.includes('demo')
  );

  if (hasKeyword) return true;

  const isGibberish = (str: string): boolean => {
    const s = str.toLowerCase();
    const mashes = [
      'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl', 'jklm',
      'ádf', 'sdf', 'dfg', 'fgh', 'ghj', 'hjk', 'jkl',
      'qwer', 'wert', 'erty', 'rtyu', 'tyui', 'yuio', 'uiop',
      'zxcv', 'xcvb', 'cvbn', 'vbnm',
      'abcde', 'bcdef', 'cdefg', 'defgh', 'efghi', 'fghij',
      'xyz', 'qwe', 'asd', 'zxc', 'abc', '123', '456', '789'
    ];
    if (mashes.some(m => s.includes(m))) return true;
    const clean = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (mashes.some(m => clean.includes(m))) return true;
    if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(clean)) return true;
    const words = clean.split(/[^a-z0-9]+/);
    for (const w of words) {
      if (w.length > 2 && !/[aeiouy0-9]/.test(w)) {
        return true;
      }
    }
    return false;
  };

  return isGibberish(product.name) || (product.brand && isGibberish(product.brand));
};

export default function StorePage() {
  const { featuredProducts, featuredLoading, error } = useProducts({ 
    limit: 8,
  });

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

        {/* Hero Slide Banner đặt ở ngoài main để chiếm 100% width */}
        <Hero />

        <main className="mx-auto max-w-7xl space-y-20 px-4 py-12 sm:px-6">

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
                {featuredProducts
                  .filter((product) => (product.stock ?? 0) > 0 && !isTestOrSystemProduct(product))
                  .slice(0, 4)
                  .map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
              </div>
            )}
          </section>

          {/* Dual Promo Section: Spa & Pet Matching */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Spa Promo Card */}
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-gradient-to-br from-[#F0FDF4] to-white p-6 sm:p-8 shadow-[var(--shadow-soft)] hover:shadow-lg hover:border-emerald-200 transition-all duration-300 group">
              <div className="flex flex-col lg:flex-row gap-6 items-stretch justify-between">
                <div className="flex-1 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-[#15803D] uppercase tracking-wider">
                      <Scissors className="h-3 w-3" />
                      Pet Spa & Grooming
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-[var(--text-main)] leading-tight">
                      Chăm sóc toàn diện <br /> Cho bé cưng tỏa sáng
                    </h3>
                    <p className="text-xs font-semibold text-[var(--text-muted)] leading-relaxed max-w-sm">
                      Dịch vụ cắt tỉa lông tạo kiểu chuyên nghiệp, tắm sấy thơm tho và vệ sinh móng tai răng chuẩn quốc tế. Đặt lịch nhanh chóng, chăm sóc chu đáo bởi đội ngũ tận tâm.
                    </p>
                    <div className="space-y-1.5 pt-1 text-[11px] text-[#16A34A] font-bold">
                      <div className="flex items-center gap-1.5">✓ Cắt tỉa tạo kiểu nghệ thuật</div>
                      <div className="flex items-center gap-1.5">✓ Tắm sấy khử mùi thơm lâu</div>
                      <div className="flex items-center gap-1.5">✓ Vệ sinh tai móng chuyên sâu</div>
                    </div>
                  </div>
                  <div className="pt-4">
                    <Link
                      href="/spa"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-5 text-xs font-extrabold text-white shadow-sm hover:bg-[#15803D] active:scale-95 transition cursor-pointer"
                    >
                      Đặt lịch ngay
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
                <div className="w-full lg:w-[42%] relative rounded-2xl overflow-hidden min-h-[180px] lg:min-h-none shadow-xs border border-emerald-100">
                  <Image
                    src="/hero-spa.jpg"
                    alt="Pet Spa"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-w-7xl) 33vw, 100vw"
                  />
                </div>
              </div>
            </div>

            {/* Pet Matching Promo Card */}
            <div className="relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-gradient-to-br from-[#FFF5F5] to-white p-6 sm:p-8 shadow-[var(--shadow-soft)] hover:shadow-lg hover:border-rose-200 transition-all duration-300 group">
              <div className="flex flex-col lg:flex-row gap-6 items-stretch justify-between">
                <div className="flex-1 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE4E4] px-3 py-1 text-[10px] font-black text-[#E11D48] uppercase tracking-wider">
                      <Heart className="h-3 w-3 fill-[#E11D48] text-[#E11D48]" />
                      Pet Matching AI
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-[var(--text-main)] leading-tight">
                      Tìm kiếm bạn đời <br /> Kết nối tình cảm bé cưng
                    </h3>
                    <p className="text-xs font-semibold text-[var(--text-muted)] leading-relaxed max-w-sm">
                      Thuật toán so khớp thông minh dựa trên giống loài, tuổi tác và khoảng cách địa lý giúp thú cưng của bạn nhanh chóng tìm được một nửa yêu thương và duy trì nòi giống an toàn.
                    </p>
                    <div className="space-y-1.5 pt-1 text-[11px] text-[#E11D48] font-bold">
                      <div className="flex items-center gap-1.5">✓ So khớp thông minh tự động</div>
                      <div className="flex items-center gap-1.5">✓ Swipe Card kết duyên độc đáo</div>
                      <div className="flex items-center gap-1.5">✓ Nhắn tin giao lưu trực tuyến</div>
                    </div>
                  </div>
                  <div className="pt-4">
                    <Link
                      href="/explore"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#E11D48] px-5 text-xs font-extrabold text-white shadow-sm hover:bg-[#BE123C] active:scale-95 transition cursor-pointer"
                    >
                      Bắt đầu ghép đôi
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
                <div className="w-full lg:w-[42%] relative rounded-2xl overflow-hidden min-h-[180px] lg:min-h-none shadow-xs border border-rose-100">
                  <Image
                    src="/hero-match.jpg"
                    alt="Pet Matching"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-w-7xl) 33vw, 100vw"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Core Values Section */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-[var(--border-color)]">
            {[
              { icon: ShieldCheck, title: 'Sản phẩm chính hãng', desc: 'Cam kết 100% thức ăn & phụ kiện nguồn gốc xuất xứ rõ ràng.' },
              { icon: Truck, title: 'Giao hàng thuận tiện', desc: 'Phí vận chuyển minh bạch, đơn hàng được cửa hàng chủ động xác nhận và bàn giao.' },
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
