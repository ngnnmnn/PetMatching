import api from '@/lib/axios';
import { Product } from '@/types';

export interface CartItemResponse {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product: Product;
}

export const cartApi = {
  getCart: () => api.get<CartItemResponse[]>('/cart'),
  addToCart: (productId: string, quantity: number) =>
    api.post<CartItemResponse>('/cart', { productId, quantity }),
  updateQuantity: (productId: string, quantity: number) =>
    api.patch<CartItemResponse>(`/cart/${productId}`, { quantity }),
  removeFromCart: (productId: string) =>
    api.delete<any>(`/cart/${productId}`),
  clearCart: () => api.delete<any>('/cart'),
  mergeCart: (items: { productId: string; quantity: number }[]) =>
    api.post<CartItemResponse[]>('/cart/merge', { items }),
};
