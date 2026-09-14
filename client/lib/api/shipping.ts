import api from '@/lib/axios';

export interface HanoiWardOption {
  wardCode: string;
  wardName: string;
}

export interface TrackingEvent {
  step: number;
  statusKey: string;
  title: string;
  location: string;
  description: string;
  time: string;
  isCompleted: boolean;
}

export interface TrackingDetailResponse {
  ahamoveOrderCode?: string;
  orderId: string;
  orderStatus: string;
  currentShippingStatus: string;
  shippingAddress: string;
  shipperInfo: {
    name: string;
    phone: string;
    hubName: string;
  };
  events: TrackingEvent[];
}

/**
 * Các hàm tương tác API Vận chuyển và AhaMove ở phía Client
 */
export const shippingApi = {
  /**
   * Lấy danh sách Phường/Xã khu vực Hà Nội
   */
  getHanoiWards: () =>
    api.get<HanoiWardOption[]>('/shipping/wards', {
      params: { province_id: 1 },
    }),

  /**
   * Gọi API tạo vận đơn hỏa tốc AhaMove cho đơn hàng
   */
  createAhamoveShippingOrder: (orderId: string) =>
    api.post<{ success: boolean; message: string; ahamoveOrderCode: string; order: any }>(
      `/shipping/ahamove/create-order/${orderId}`,
    ),

  /**
   * Tra cứu lịch sử hành trình vận đơn hỏa tốc AhaMove chi tiết
   */
  getAhamoveTrackingDetail: (code: string) =>
    api.get<TrackingDetailResponse>(`/shipping/track-ahamove/${code}`),

  /**
   * Ước tính phí giao hàng hỏa tốc AhaMove thời gian thực từ Portal API theo tọa độ GPS hoặc chuỗi địa chỉ
   */
  estimateAhamoveShippingFee: (params: { dropoffLat?: number; dropoffLng?: number; addressStr?: string }) =>
    api.post<{ success: boolean; distanceKm?: number; feeVnd: number; formattedFee: string; isRealAhamoveFee?: boolean }>(
      '/shipping/ahamove/estimate-fee',
      params,
    ),

  /**
   * Tìm kiếm gợi ý địa chỉ tự động khu vực Hà Nội từ OpenStreetMap
   */
  searchAddressAutocomplete: (query: string) =>
    api.get<any[]>('/shipping/autocomplete', {
      params: { q: query },
    }),

  /**
   * Đồng bộ tự động tất cả các đơn AhaMove đang giao trực tiếp từ Portal API
   */
  syncActiveAhamoveOrders: () =>
    api.post<{ success: boolean; count: number; updated: number }>('/shipping/ahamove/sync-active'),
};


