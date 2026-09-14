import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ShippingService } from './shipping.service';

/**
 * Controller tiếp nhận yêu cầu liên quan đến vận chuyển và vận đơn hỏa tốc AhaMove
 */
@Controller('api/shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /**
   * Lấy danh sách Phường/Xã khu vực Hà Nội
   */
  @Get('wards')
  getWards(@Query('province_id') provinceId?: string) {
    return this.shippingService.getWards(Number(provinceId || 0));
  }

  /**
   * API cho Manager tạo đơn giao hàng hỏa tốc AhaMove Sandbox
   * @param orderId ID đơn hàng cần tạo vận đơn hỏa tốc
   */
  @Post('ahamove/create-order/:orderId')
  createAhamoveShippingOrder(@Param('orderId') orderId: string) {
    return this.shippingService.createAhamoveShippingOrder(orderId);
  }

  /**
   * Endpoint đón Webhook cập nhật trạng thái tự động từ AhaMove Staging Portal
   */
  @Post('ahamove/webhook')
  handleAhamoveWebhook(@Body() payload: any) {
    return this.shippingService.handleAhamoveWebhook(payload);
  }

  /**
   * API tra cứu chi tiết lịch sử hành trình vận đơn hỏa tốc AhaMove
   * @param code Mã vận đơn AhaMove
   */
  @Get('track-ahamove/:code')
  getAhamoveTrackingDetail(@Param('code') code: string) {
    return this.shippingService.getAhamoveTrackingDetail(code);
  }

  /**
   * API ước tính phí giao hỏa tốc AhaMove dựa trên tọa độ GPS hoặc chuỗi địa chỉ nhận
   * @param body { dropoffLat?, dropoffLng?, addressStr? }
   */
  @Post('ahamove/estimate-fee')
  estimateAhamoveShippingFee(@Body() body: { dropoffLat?: number; dropoffLng?: number; addressStr?: string }) {
    return this.shippingService.estimateAhamoveShippingFee(body.dropoffLat, body.dropoffLng, body.addressStr);
  }

  /**
   * Endpoint gợi ý tìm kiếm địa chỉ tự động khu vực Hà Nội từ OpenStreetMap
   * @param query Từ khóa địa chỉ người dùng gõ
   */
  @Get('autocomplete')
  searchAddressAutocomplete(@Query('q') query: string) {
    return this.shippingService.searchAddressAutocomplete(query || '');
  }

  /**
   * Endpoint thủ công / tự động đồng bộ tất cả đơn hàng AhaMove đang hoạt động từ Portal API
   */
  @Post('ahamove/sync-active')
  syncActiveAhamoveOrders() {
    return this.shippingService.syncActiveAhamoveOrders();
  }
}

