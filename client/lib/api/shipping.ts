import api from '@/lib/axios';

export interface HanoiWardOption {
  wardCode: string;
  wardName: string;
}

export interface CreateShippingOrderResponse {
  success: boolean;
  message: string;
  ghnOrderCode: string;
  order: any;
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
  ghnOrderCode: string;
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
 * Các hàm tương tác API Vận chuyển và GHN ở phía Client
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
   * Gọi API tạo vận đơn GHN cho đơn hàng (Thao tác 1 chạm dành cho Manager)
   */
  createShippingOrder: (orderId: string) =>
    api.post<CreateShippingOrderResponse>(`/shipping/create-order/${orderId}`),

  /**
   * Tra cứu lịch sử hành trình vận đơn GHN chi tiết
   */
  getTrackingDetail: (ghnOrderCode: string) =>
    api.get<TrackingDetailResponse>(`/shipping/track/${ghnOrderCode}`),

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
   * Ước tính phí giao hàng hỏa tốc AhaMove theo tọa độ GPS điểm nhận
   */
  estimateAhamoveShippingFee: (dropoffLat: number, dropoffLng: number) =>
    api.post<{ success: boolean; distanceKm: number; feeVnd: number; formattedFee: string }>(
      '/shipping/ahamove/estimate-fee',
      { dropoffLat, dropoffLng },
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


