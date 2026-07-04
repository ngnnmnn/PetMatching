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

export function useProducts(initialFilters?: ProductFilters) {
  const [products, setProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredLoading, setFeaturedLoading] = useState(true);
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
      const response = await productsApi.getList(filters);
      setProducts(response.data.data);
      setMeta(response.data.meta);
    } catch {
      setError('Không thể tải danh sách sản phẩm. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchFeaturedProducts = useCallback(async () => {
    setFeaturedLoading(true);

    try {
      const response = await productsApi.getFeatured();
      setFeaturedProducts(response.data);
    } catch {
      setFeaturedProducts([]);
    } finally {
      setFeaturedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchFeaturedProducts();
  }, [fetchFeaturedProducts]);

  return {
    products,
    featuredProducts,
    loading,
    featuredLoading,
    error,
    meta,
    filters,
    setFilters,
    refetch: fetchProducts,
  };
}
