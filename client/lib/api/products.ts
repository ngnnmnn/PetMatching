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

export const productsApi = {
  getList: (filters?: ProductFilters) =>
    api.get<PaginatedResponse<Product>>('/products', { params: filters }),

  getFeatured: () => api.get<Product[]>('/products/featured'),

  getById: (id: string) => api.get<Product>(`/products/${id}`),

  getCategories: () => api.get<Category[]>('/products/categories'),

  getReviews: (productId: string) => api.get<ProductReview[]>(`/products/${productId}/reviews`),

  canReview: (productId: string) => api.get<boolean>(`/products/${productId}/can-review`),

  submitReview: (productId: string, data: { rating: number; comment?: string; images?: string[] }) =>
    api.post<ProductReview>(`/products/${productId}/reviews`, data),

  updateReview: (reviewId: string, data: { rating: number; comment?: string; images?: string[] }) =>
    api.put<ProductReview>(`/products/reviews/${reviewId}`, data),

  deleteReview: (reviewId: string) =>
    api.delete<{ success: boolean; message: string }>(`/products/reviews/${reviewId}`),
};
