'use client';

import Image from 'next/image';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Hero() {
  const handleScrollToProducts = () => {
    const filterSection = document.getElementById('search-filter-section');
    if (filterSection) {
      filterSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl py-12 lg:py-16 shadow-[var(--shadow-soft)]"
      style={{ background: 'var(--gradient-hero)' }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center relative z-10">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-4 py-1.5 text-xs font-semibold text-[var(--primary-color)] border border-[var(--primary-color)]/20 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Cửa hàng phụ kiện thú cưng số 1
          </span>

          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--text-main)] leading-[1.05] tracking-tight">
            Phụ kiện <span className="text-[var(--primary-color)]">chất lượng</span>
            <br className="hidden sm:block" />
            cho thú cưng của bạn
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[var(--text-muted)] max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Khám phá hàng nghìn sản phẩm chính hãng — từ thức ăn, đồ chơi đến
            phụ kiện cao cấp. Mọi thứ thú cưng cần, gói gọn trong một cửa hàng.
          </p>

          <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
            <Button
              size="lg"
              className="h-12 px-6 text-base font-semibold rounded-xl bg-[var(--primary-color)] text-white hover:bg-[var(--primary-color)]/95 transition-all shadow-md hover:shadow-lg"
              onClick={handleScrollToProducts}
            >
              Mua sắm ngay
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-12 px-6 text-base font-semibold rounded-xl bg-white/60 backdrop-blur border-[var(--border-color)] text-[var(--text-main)] hover:bg-white transition-all shadow-sm"
              onClick={handleScrollToProducts}
            >
              Khám phá danh mục
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap gap-8 justify-center lg:justify-start text-sm">
            {[
              ['10K+', 'Khách hàng'],
              ['500+', 'Sản phẩm'],
              ['4.9★', 'Đánh giá'],
            ].map(([k, v]) => (
              <div key={k} className="transition-all hover:scale-105">
                <div className="text-2xl font-extrabold text-[var(--text-main)]">
                  {k}
                </div>
                <div className="text-[var(--text-muted)]">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto max-w-md lg:max-w-none w-full">
          <div className="absolute -inset-4 rounded-[2.5rem] bg-[var(--primary-color)]/10 blur-2xl opacity-60" />

          <div className="relative overflow-hidden rounded-[2rem] shadow-xl border-4 border-white/50 aspect-square max-w-[450px] mx-auto lg:ml-auto">
            <Image
              src="/hero-pets.jpg"
              alt="Chó và mèo cùng phụ kiện chăm sóc thú cưng"
              fill
              priority
              className="object-cover"
              sizes="(max-w-728px) 100vw, 450px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
