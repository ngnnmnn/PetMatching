import api from '@/lib/axios';
import { Product, ProductVariant } from '@/types';

export interface CartItemResponse {
  id: string;
  userId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product: Product;
  variant?: ProductVariant | null;
}

export const cartApi = {
  getCart: () => api.get<CartItemResponse[]>('/cart'),
  addToCart: (productId: string, quantity: number, variantId?: string | null) =>
    api.post<CartItemResponse>('/cart', { productId, quantity, variantId }),
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) =>
    api.patch<CartItemResponse>(`/cart/${productId}`, { quantity, variantId }),
  removeFromCart: (productId: string, variantId?: string | null) =>
    api.delete<any>(`/cart/${productId}`, { params: { variantId } }),
  clearCart: () => api.delete<any>('/cart'),
  mergeCart: (items: { productId: string; quantity: number; variantId?: string | null }[]) =>
    api.post<CartItemResponse[]>('/cart/merge', { items }),
};
