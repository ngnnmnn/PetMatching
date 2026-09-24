import api from '@/lib/axios';
import { Address, ChangePasswordData, ProfileResponse, UpdateProfileData, VoucherType } from '@/types';

export interface AppliedVoucherResponse {
  success: boolean;
  code: string;
  type: VoucherType;
  value: number;
  discountAmount?: number;
  message: string;
}

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
  getMatchingBlocks: () => api.get<Array<{
    createdAt: string;
    blocked: { id: string; name: string; avatarUrl?: string | null };
  }>>('/matching/blocks'),
  unblockMatchingUser: (userId: string) => api.delete(`/matching/blocks/${userId}`),
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
    shippingAddress: string;
    districtId?: number;
    wardCode?: string;
    shippingLatitude?: number;
    shippingLongitude?: number;
    paymentMethod?: string;
    voucherCode?: string;
    items: { productId: string; variantId?: string | null; quantity: number }[];
  }) => api.post<any>('/users/orders', data),
  cancelOrder: (id: string) => api.patch<any>(`/users/orders/${id}/cancel`),
  deleteOrder: (id: string) => api.delete<any>(`/users/orders/${id}`),
  /**
   * Cập nhật địa chỉ giao hàng và tọa độ mới của đơn hàng PENDING.
   * Tọa độ GPS (shippingLatitude, shippingLongitude) là tùy chọn để hỗ trợ địa chỉ không có tọa độ sẵn.
   */
  updateOrderShipping: (
    id: string,
    data: {
      shippingAddress: string;
      districtId?: number;
      wardCode?: string;
      shippingLatitude?: number;
      shippingLongitude?: number;
    },
  ) => api.put<any>(`/users/orders/${id}/shipping`, data),
  retryPayment: (id: string) => api.post<any>(`/users/orders/${id}/retry-payment`),
  requestRefund: (
    id: string,
    data: { bankCode: string; accountNumber: string; accountName: string; reason: string },
  ) => api.post<any>(`/users/orders/${id}/request-refund`, data),
  applyVoucher: (code: string, totalAmount: number) =>
    api.post<AppliedVoucherResponse>('/vouchers/apply', { code, totalAmount }),
};

