import api from '@/lib/axios';
import { Product } from '@/types';

export const wishlistApi = {
  getWishlist: () => api.get<Product[]>('/wishlist'),
  toggleWishlist: (productId: string) =>
    api.post<{ added: boolean }>('/wishlist/toggle', { productId }),
  mergeWishlist: (productIds: string[]) =>
    api.post<Product[]>('/wishlist/merge', { productIds }),
};
