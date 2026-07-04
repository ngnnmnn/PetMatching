'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { Product } from '@/types';
import ProductCard from './ProductCard';

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg border border-[var(--border-color)] bg-white">
      <div className="aspect-square bg-gray-200" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-200" />
        <div className="h-5 w-1/3 rounded bg-gray-200" />
      </div>
    </div>
  );
}

export default function FeaturedSection({ products, loading }: { products: Product[]; loading: boolean }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-[var(--text-main)]">
            <Sparkles className="size-5 text-[#F59E0B]" />
            Sản phẩm nổi bật
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Những món được đánh giá và quan tâm nhiều nhất.</p>
        </div>
        <button type="button" className="hidden items-center gap-1 text-sm font-bold text-[var(--primary-color)] sm:flex">
          Xem thêm
          <ArrowRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
          : products.map((product) => <ProductCard key={product.id} product={product} featured />)}
      </div>
    </section>
  );
}
