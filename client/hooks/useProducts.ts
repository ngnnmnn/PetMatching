'use client';

import { useCallback, useEffect, useState } from 'react';
import { Product } from '@/types';
import { ProductFilters, productsApi } from '@/lib/api/products';

const DEFAULT_META = {
  total: 0,
  page: 1,
  limit: 12,
  totalPages: 0,
};

export function useProducts(
  initialFilters?: ProductFilters,
  mode: 'list' | 'featured' = 'list',
) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [filters, setFilters] = useState<ProductFilters>({
    sortBy: 'popular',
    page: 1,
    limit: 12,
    ...initialFilters,
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'featured') {
        const response = await productsApi.getFeatured();
        setProducts(response.data);
        return;
      }
      const response = await productsApi.getList(filters);
      setProducts(response.data.data);
      setMeta(response.data.meta);
    } catch {
      setError(
        mode === 'featured'
          ? 'Không thể tải sản phẩm nổi bật. Vui lòng thử lại.'
          : 'Không thể tải danh sách sản phẩm. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters, mode]);

  useEffect(() => {
    const loadTimer = window.setTimeout(
      () => void fetchProducts(),
      filters.search ? 300 : 0,
    );
    return () => window.clearTimeout(loadTimer);
  }, [fetchProducts, filters.search]);

  return {
    products,
    loading,
    error,
    meta,
    filters,
    setFilters,
    refetch: fetchProducts,
  };
}
