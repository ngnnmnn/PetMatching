import api from '@/lib/axios';
import { PaginatedResponse, Product } from '@/types';

export interface ProductFilters {
  category?: string;
  targetSpecies?: string;
  search?: string;
  sortBy?: 'popular' | 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

export const productsApi = {
  getList: (filters?: ProductFilters) =>
    api.get<PaginatedResponse<Product>>('/products', { params: filters }),

  getFeatured: () => api.get<Product[]>('/products/featured'),

  getById: (id: string) => api.get<Product>(`/products/${id}`),
};
