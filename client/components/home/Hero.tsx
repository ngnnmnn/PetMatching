'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDES = [
  {
    image: '/hero-pets.jpg',
    tag: 'CỬA HÀNG PHỤ KIỆN',
    title: 'Phụ Kiện Chất Lượng Cho Thú Cưng',
    description: 'Khám phá hàng nghìn sản phẩm chính hãng — từ thức ăn, đồ chơi đến phụ kiện cao cấp. Mọi thứ thú cưng cần, gói gọn trong một cửa hàng.',
    buttonText: 'Mua sắm ngay',
    link: '/shop',
  },
  {
    image: '/hero-spa.jpg',
    tag: 'DỊCH VỤ SPA',
    title: 'Spa & Làm Đẹp Thú Cưng Chuyên Nghiệp',
    description: 'Tắm sạch, cắt tỉa lông tạo kiểu, vệ sinh tai và chăm sóc toàn diện cho thú cưng yêu quý của bạn bởi các chuyên gia spa giàu kinh nghiệm.',
    buttonText: 'Đặt lịch ngay',
    link: '/spa',
  },
  {
    image: '/hero-match.jpg',
    tag: 'GHÉP ĐÔI THÚ CƯNG',
    title: 'Tìm Bạn Đời Hoàn Hảo Cho Thú Cưng',
    description: 'Nền tảng ghép đôi và tìm kiếm bạn bè cho thú cưng hàng đầu Việt Nam. Kết nối tình cảm, giúp thú cưng tìm được một nửa yêu thương.',
    buttonText: 'Bắt đầu ghép đôi',
    link: '/pet-matching',
  },
];

export default function Hero() {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % SLIDES.length);
    }, 10000); // Tự động chuyển mỗi 10 giây

    return () => clearInterval(timer);
  }, [currentIdx]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx((prev) => (prev + 1) % SLIDES.length);
  };

  return (
    <section className="relative overflow-hidden w-full min-h-[520px] sm:min-h-[600px] md:min-h-[660px] lg:min-h-[720px] flex items-center bg-neutral-950 group">
      {/* Background Image Carousel */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1.05 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute inset-0 overflow-hidden"
          >
            <Image
              src={SLIDES[currentIdx].image}
              alt={SLIDES[currentIdx].title}
              fill
              priority
              className="object-cover filter blur-[2px]"
              sizes="100vw"
            />
            {/* Lớp phủ chuyển sắc tối để tăng độ tương phản đọc chữ */}
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-900/65 to-transparent" />
            <div className="absolute inset-0 bg-black/25" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide Content */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10 py-24 sm:py-28 md:py-32">
        <div className="max-w-3xl text-left text-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="space-y-6"
            >
              {/* Badge */}
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-400 border border-white/10 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
                {SLIDES[currentIdx].tag}
              </span>

              {/* Title */}
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold leading-[1.15] tracking-tight text-white drop-shadow-md">
                {SLIDES[currentIdx].title}
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg md:text-xl text-neutral-200 leading-relaxed max-w-2xl drop-shadow">
                {SLIDES[currentIdx].description}
              </p>

              {/* Action Button */}
              <div className="pt-2">
                {SLIDES[currentIdx].link.startsWith('#') ? (
                  <Button
                    size="lg"
                    className="h-12 px-6 text-base font-semibold rounded-xl bg-[var(--primary-color)] text-white hover:bg-[var(--primary-color)]/95 active:scale-95 transition-all shadow-lg hover:shadow-orange-500/20 flex items-center gap-2 group cursor-pointer"
                    onClick={() => {
                      const element = document.getElementById(SLIDES[currentIdx].link.substring(1));
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    {SLIDES[currentIdx].buttonText}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    className="h-12 px-6 text-base font-semibold rounded-xl bg-[var(--primary-color)] text-white hover:bg-[var(--primary-color)]/95 active:scale-95 transition-all shadow-lg hover:shadow-orange-500/20 flex items-center gap-2 group cursor-pointer"
                  >
                    <Link href={SLIDES[currentIdx].link}>
                      {SLIDES[currentIdx].buttonText}
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Điều hướng thủ công (Nút bấm sang trái/phải) */}
      <button
        onClick={handlePrev}
        className="absolute left-4 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white hover:scale-105 active:scale-95 opacity-0 group-hover:opacity-100 focus:opacity-100 duration-300 md:left-6 cursor-pointer"
        aria-label="Slide trước"
      >
        <ChevronLeft className="size-6" />
      </button>

      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white hover:scale-105 active:scale-95 opacity-0 group-hover:opacity-100 focus:opacity-100 duration-300 md:right-6 cursor-pointer"
        aria-label="Slide tiếp theo"
      >
        <ChevronRight className="size-6" />
      </button>

      {/* Dấu chấm chỉ số (Indicators) */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2.5">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIdx(idx)}
            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
              idx === currentIdx ? 'w-8 bg-[var(--primary-color)]' : 'w-2 bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Đi tới slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
