'use client';

import { Grid3X3, Search } from 'lucide-react';
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

export default function ProductGrid({
  products,
  loading,
  total,
}: {
  products: Product[];
  loading: boolean;
  total: number;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-[var(--text-main)]">
            <Grid3X3 className="size-5 text-[#0F766E]" />
            Tất cả sản phẩm
          </h2>
          {!loading && <p className="mt-1 text-sm text-[var(--text-muted)]">{total} sản phẩm phù hợp</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 12 }).map((_, index) => <SkeletonCard key={index} />)
          : products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>

      {!loading && products.length === 0 && (
        <div className="py-16 text-center text-[var(--text-muted)]">
          <Search className="mx-auto mb-4 size-12" />
          <p className="text-lg font-semibold text-[var(--text-main)]">Không tìm thấy sản phẩm nào</p>
          <p className="mt-1 text-sm">Thử tìm kiếm với từ khóa khác</p>
        </div>
      )}
    </section>
  );
}
