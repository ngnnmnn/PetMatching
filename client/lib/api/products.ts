import api from '@/lib/axios';
import { PaginatedResponse, Product, Category, ProductReview } from '@/types';

export interface ProductFilters {
  category?: string;
  targetSpecies?: string;
  search?: string;
  // Các tiêu chí sắp xếp: nổi bật/mặc định, mới nhất, giá tăng/giảm, đánh giá cao, giảm giá nhiều
  sortBy?: 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating_desc' | 'discount_desc';
  page?: number;
  limit?: number;
}

import { fetchWithCache, invalidateCache } from '@/lib/cache/api-cache';

/**
 * Xóa bộ nhớ đệm danh mục sản phẩm khi có cập nhật từ trang quản lý
 */
export function invalidateCategoriesCache() {
  invalidateCache('products:categories');
}

export const productsApi = {
  getList: (filters?: ProductFilters) =>
    api.get<PaginatedResponse<Product>>('/products', { params: filters }),

  getFeatured: () => api.get<Product[]>('/products/featured'),

  getById: (id: string) => api.get<Product>(`/products/${id}`),

  /**
   * Lấy danh sách danh mục sản phẩm có hỗ trợ bộ nhớ đệm (TTL: 10 phút)
   * Tránh gọi lại API nhiều lần khi chuyển trang giữa Shop và Quản lý
   */
  getCategories: (options?: { force?: boolean }) =>
    fetchWithCache(
      'products:categories',
      () => api.get<Category[]>('/products/categories'),
      10 * 60 * 1000,
      options?.force,
    ),

  getReviews: (productId: string) => api.get<ProductReview[]>(`/products/${productId}/reviews`),

  canReview: (productId: string) => api.get<boolean>(`/products/${productId}/can-review`),

  submitReview: (productId: string, data: { rating: number; comment?: string; images?: string[] }) =>
    api.post<ProductReview>(`/products/${productId}/reviews`, data),

  updateReview: (reviewId: string, data: { rating: number; comment?: string; images?: string[] }) =>
    api.put<ProductReview>(`/products/reviews/${reviewId}`, data),

  deleteReview: (reviewId: string) =>
    api.delete<{ success: boolean; message: string }>(`/products/reviews/${reviewId}`),
};
