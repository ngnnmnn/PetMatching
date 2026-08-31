import api from '@/lib/axios';
import { Voucher, CreateVoucherInput, UpdateVoucherInput } from '@/types';

export const vouchersApi = {
  getVouchers: () => api.get<Voucher[]>('/vouchers'),
  createVoucher: (data: CreateVoucherInput) => api.post<Voucher>('/vouchers', data),
  updateVoucher: (id: string, data: UpdateVoucherInput) => api.put<Voucher>(`/vouchers/${id}`, data),
  toggleVoucherStatus: (id: string) => api.patch<Voucher>(`/vouchers/${id}/toggle`),
  deleteVoucher: (id: string) => api.delete<{ success: boolean; message: string }>(`/vouchers/${id}`),
};
