import api from '@/lib/axios';

export interface HanoiWardOption {
  wardCode: string;
  wardName: string;
}

export const shippingApi = {
  getHanoiWards: () =>
    api.get<HanoiWardOption[]>('/shipping/wards', {
      params: { province_id: 1 },
    }),
};
