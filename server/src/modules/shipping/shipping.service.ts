import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CalculateFeeDto } from './dto/calculate-fee.dto';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly ghnToken = process.env.GHN_TOKEN || 'a3fdf0a8-851d-11f1-aa4d-367074fd68e2';
  private readonly ghnShopId = process.env.GHN_SHOP_ID || '6561701';
  private readonly ghnBaseUrl = process.env.GHN_API_URL || 'https://online-gateway.ghn.vn/shiip/public-api';

  constructor(private readonly prisma: PrismaService) {}

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Token: this.ghnToken,
      ShopId: this.ghnShopId,
    };
  }

  /**
   * Lấy danh sách Tỉnh / Thành phố từ GHN
   */
  async getProvinces() {
    try {
      const response = await fetch(`${this.ghnBaseUrl}/master-data/province`, {
        method: 'GET',
        headers: { Token: this.ghnToken },
      });
      const data = await response.json();
      if (data.code !== 200) {
        throw new BadRequestException(data.message || 'Không thể lấy danh sách Tỉnh/Thành từ GHN');
      }
      return data.data.map((item: any) => ({
        provinceId: item.ProvinceID,
        provinceName: item.ProvinceName,
        code: item.Code,
      }));
    } catch (error) {
      this.logger.error('Lỗi getProvinces:', error);
      throw new BadRequestException('Lỗi kết nối tới dịch vụ giao hàng GHN');
    }
  }

  /**
   * Lấy danh sách Quận / Huyện từ GHN theo Province ID
   */
  async getDistricts(provinceId: number) {
    try {
      const response = await fetch(`${this.ghnBaseUrl}/master-data/district`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Token: this.ghnToken,
        },
        body: JSON.stringify({ province_id: Number(provinceId) }),
      });
      const data = await response.json();
      if (data.code !== 200) {
        throw new BadRequestException(data.message || 'Không thể lấy danh sách Quận/Huyện từ GHN');
      }
      return data.data.map((item: any) => ({
        districtId: item.DistrictID,
        districtName: item.DistrictName,
        code: item.Code,
      }));
    } catch (error) {
      this.logger.error('Lỗi getDistricts:', error);
      throw new BadRequestException('Lỗi kết nối tới dịch vụ giao hàng GHN');
    }
  }

  /**
   * Lấy danh sách Phường / Xã từ GHN theo District ID
   */
  async getWards(districtId: number) {
    try {
      const response = await fetch(
        `${this.ghnBaseUrl}/master-data/ward?district_id=${districtId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Token: this.ghnToken,
          },
          body: JSON.stringify({ district_id: Number(districtId) }),
        },
      );
      const data = await response.json();
      if (data.code !== 200) {
        throw new BadRequestException(data.message || 'Không thể lấy danh sách Phường/Xã từ GHN');
      }
      return data.data.map((item: any) => ({
        wardCode: item.WardCode,
        wardName: item.WardName,
      }));
    } catch (error) {
      this.logger.error('Lỗi getWards:', error);
      throw new BadRequestException('Lỗi kết nối tới dịch vụ giao hàng GHN');
    }
  }

  /**
   * Tính phí giao hàng GHN theo địa chỉ nhận
   */
  async calculateShippingFee(dto: CalculateFeeDto) {
    try {
      const body = {
        service_type_id: 2, // Chuẩn / Hàng nhẹ
        from_district_id: 1442, // Kho Đống Đa, Hà Nội
        from_ward_code: '20101', // Phường Cát Linh
        to_district_id: Number(dto.toDistrictId),
        to_ward_code: String(dto.toWardCode),
        weight: dto.weight || 500, // gram
        length: dto.length || 15,
        width: dto.width || 15,
        height: dto.height || 15,
        insurance_value: dto.insuranceValue || 0,
      };

      const response = await fetch(`${this.ghnBaseUrl}/v2/shipping-order/fee`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.code !== 200) {
        this.logger.warn(`GHN Calculate Fee warning: ${data.message}`);
        // Fallback phí mặc định nếu địa chỉ Sandbox chưa khớp chính xác
        return {
          total: 30000,
          serviceFee: 30000,
          isEstimated: true,
          message: data.message,
        };
      }

      return {
        total: data.data.total,
        serviceFee: data.data.service_fee,
        insuranceFee: data.data.insurance_fee || 0,
        isEstimated: false,
      };
    } catch (error) {
      this.logger.error('Lỗi calculateShippingFee:', error);
      return {
        total: 30000,
        serviceFee: 30000,
        isEstimated: true,
        message: 'Không thể gọi API GHN, áp dụng phí mặc định',
      };
    }
  }

  /**
   * Tạo đơn giao hàng GHN
   */
  async createShippingOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng!');
    }

    const toDistrictId = order.districtId || 1442; // Mặc định Quận Đống Đa nếu đơn cũ thiếu ID GHN
    const toWardCode = order.wardCode || '20101'; // Mặc định Phường Cát Linh

    const items = order.items.map((item) => ({
      name: item.product.name.substring(0, 50),
      code: item.productId,
      quantity: item.quantity,
      price: Math.round(item.price),
      weight: 200, // Mặc định 200g/sp
    }));

    const totalWeight = items.reduce((sum, item) => sum + item.quantity * item.weight, 0);

    const body = {
      payment_type_id: 2, // Người nhận trả phí (hoặc cộng vào COD)
      note: 'Giao hàng PetMatching',
      required_note: 'KHONGCHOXEMHANG',
      to_name: order.user.name || 'Khách hàng PetMatching',
      to_phone: order.user.phone || '0988888888',
      to_address: order.shippingAddress,
      to_district_id: Number(toDistrictId),
      to_ward_code: String(toWardCode),
      weight: Math.max(totalWeight, 300),
      length: 15,
      width: 15,
      height: 15,
      service_type_id: 2,
      cod_amount: order.paymentMethod === 'COD' ? Math.round(order.totalAmount + order.shippingFee) : 0,
      items,
    };

    try {
      const response = await fetch(`${this.ghnBaseUrl}/v2/shipping-order/create`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.code !== 200) {
        this.logger.error(`GHN Create Order Failed: ${JSON.stringify(data)}`);
        throw new BadRequestException(data.message || 'Không thể tạo đơn hàng trên GHN!');
      }

      const ghnOrderCode = data.data.order_code;
      const expectedDeliveryDate = data.data.expected_delivery_time;

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          ghnOrderCode,
          shippingStatus: 'ready_to_pick',
          status: 'SHIPPED',
        },
      });

      return {
        success: true,
        ghnOrderCode,
        expectedDeliveryDate,
        order: updatedOrder,
      };
    } catch (error) {
      this.logger.error('Lỗi createShippingOrder:', error);
      throw new BadRequestException(error.message || 'Lỗi khi tạo vận đơn GHN');
    }
  }

  /**
   * Xử lý Webhook cập nhật trạng thái đơn hàng tự động từ GHN
   */
  async handleWebhook(payload: any) {
    this.logger.log(`Nhận GHN Webhook Payload: ${JSON.stringify(payload)}`);

    const ghnOrderCode = payload.OrderCode || payload.order_code;
    const status = (payload.Status || payload.status || '').toLowerCase();

    if (!ghnOrderCode) {
      return { success: false, message: 'Thiếu OrderCode trong payload' };
    }

    const order = await this.prisma.order.findFirst({
      where: { ghnOrderCode },
    });

    if (!order) {
      this.logger.warn(`Không tìm thấy đơn hàng trong hệ thống có ghnOrderCode=${ghnOrderCode}`);
      return { success: false, message: 'Đơn hàng không tồn tại' };
    }

    let newOrderStatus = order.status;

    // Ánh xạ trạng thái GHN sang OrderStatus của PetMatching
    switch (status) {
      case 'ready_to_pick':
      case 'picking':
      case 'storing':
      case 'transporting':
      case 'sorting':
        newOrderStatus = 'PROCESSING';
        break;
      case 'delivering':
        newOrderStatus = 'SHIPPED';
        break;
      case 'delivered':
        newOrderStatus = 'DELIVERED';
        break;
      case 'cancel':
      case 'returned':
      case 'return':
        newOrderStatus = 'CANCELLED';
        break;
      default:
        break;
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        shippingStatus: status,
        status: newOrderStatus,
      },
    });

    this.logger.log(`Đã cập nhật đơn hàng ${order.id}: GHN Status=${status}, OrderStatus=${newOrderStatus}`);

    return {
      success: true,
      orderId: order.id,
      shippingStatus: status,
      orderStatus: newOrderStatus,
    };
  }

  /**
   * Tra cứu chi tiết đơn hàng từ GHN API theo mã vận đơn
   */
  async getShippingOrderDetail(ghnOrderCode: string) {
    try {
      const response = await fetch(`${this.ghnBaseUrl}/v2/shipping-order/detail`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ order_code: ghnOrderCode }),
      });
      const data = await response.json();
      if (data.code !== 200) {
        this.logger.error(`Không thể lấy chi tiết vận đơn GHN ${ghnOrderCode}: ${data.message}`);
        return null;
      }
      return data.data;
    } catch (error) {
      this.logger.error(`Lỗi kết nối GHN detail API cho mã ${ghnOrderCode}:`, error);
      return null;
    }
  }
}
