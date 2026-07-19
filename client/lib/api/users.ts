import api from '@/lib/axios';
import { Address, ChangePasswordData, ProfileResponse, UpdateProfileData } from '@/types';

export const usersApi = {
  getProfile: () => api.get<ProfileResponse>('/users/profile'),
  updateProfile: (data: UpdateProfileData) => api.put('/users/profile', data),
  deleteAccount: () => api.delete('/users/profile'),
  uploadAvatar: (formData: FormData) =>
    api.post<{ avatarUrl: string }>('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  changePassword: (data: ChangePasswordData) =>
    api.post('/users/change-password', data),
  getAddresses: () => api.get<Address[]>('/users/addresses'),
  createAddress: (
    data: Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ) =>
    api.post<Address>('/users/addresses', data),
  updateAddress: (id: string, data: Partial<Address>) =>
    api.put<Address>(`/users/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/users/addresses/${id}`),
  setDefaultAddress: (id: string) =>
    api.patch<Address>(`/users/addresses/${id}/default`),
  getOrders: () => api.get<any[]>('/users/orders'),
  createOrder: (data: {
    totalAmount: number;
    shippingAddress: string;
    paymentMethod?: string;
    items: { productId: string; quantity: number; price: number }[];
  }) => api.post<any>('/users/orders', data),
  cancelOrder: (id: string) => api.patch<any>(`/users/orders/${id}/cancel`),
  updateOrderShipping: (id: string, shippingAddress: string) =>
    api.put<any>(`/users/orders/${id}/shipping`, { shippingAddress }),
};

