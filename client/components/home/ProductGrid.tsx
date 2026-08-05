'use client';

import { Search } from 'lucide-react';
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
  selectedPet,
  onPreviewClick,
  isPreviewOpen = false,
  gridClassName,
}: {
  products: Product[];
  loading: boolean;
  selectedPet?: any;
  onPreviewClick?: (product: Product) => void;
  isPreviewOpen?: boolean;
  gridClassName?: string;
}) {
  return (
    <section>
      <div className={gridClassName || (isPreviewOpen ? "grid grid-cols-1 sm:grid-cols-2 gap-6" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6")}>
        {loading
          ? Array.from({ length: 12 }).map((_, index) => <SkeletonCard key={index} />)
          : products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selectedPet={selectedPet}
                onPreviewClick={onPreviewClick}
              />
            ))}
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
