import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HANOI_WARDS } from '../matching/hanoi-wards';
import { ShippingSimulatorService } from './shipping-simulator.service';

/**
 * Service xử lý tính phí, danh mục Phường/Xã và Tích hợp Giao hàng hỏa tốc AhaMove
 */
@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private static readonly HANOI_PROVINCE_ID = 1;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shippingSimulatorService: ShippingSimulatorService,
  ) {}

  /**
   * Lấy danh sách Phường/Xã khu vực Hà Nội
   */
  getWards(provinceId: number) {
    if (provinceId !== ShippingService.HANOI_PROVINCE_ID && provinceId !== 0) {
      return [];
    }

    return HANOI_WARDS.map(({ wardCode, name }) => ({
      wardCode,
      wardName: name,
    }));
  }

  /**
   * Tính phí vận chuyển (Cố định 30,000 VND cho khu vực Hà Nội)
   */
  calculateShippingFee() {
    return {
      total: 30000,
      serviceFee: 30000,
      insuranceFee: 0,
      isEstimated: false,
    };
  }

  /**
   * Phân tích chuỗi địa chỉ giao hàng trong Database để lấy riêng thông tin địa chỉ sạch, tên và SĐT người nhận
   * @param addressStr Chuỗi địa chỉ dạng "Tên: X | SĐT: Y | Địa chỉ: Z (Ghi chú: N)"
   */
  private parseShippingAddressHelper(addressStr: string) {
    const parts = addressStr ? addressStr.split(' | ') : [];
    let name = '';
    let phone = '';
    let address = addressStr || '';
    let note = '';

    for (const part of parts) {
      if (part.startsWith('Tên: ')) {
        name = part.replace('Tên: ', '');
      } else if (part.startsWith('SĐT: ')) {
        phone = part.replace('SĐT: ', '');
      } else if (part.startsWith('Địa chỉ: ')) {
        address = part.replace('Địa chỉ: ', '');
      }
    }

    if (address.includes(' (Ghi chú: ')) {
      const noteStart = address.indexOf(' (Ghi chú: ');
      note = address.slice(noteStart + 11, -1);
      address = address.slice(0, noteStart);
    }

    return { name, phone, address: address.trim(), note };
  }

  /**
   * Trả về tọa độ GPS tương đối (vĩ độ, kinh độ) dựa trên Quận/Huyện địa chỉ giao hàng của khách
   * @param addressStr Địa chỉ giao hàng của khách
   */
  /**
   * Trả về tọa độ GPS tương đối (vĩ độ, kinh độ) dựa trên Quận/Huyện/Xã/Phường địa chỉ giao hàng của khách
   * @param addressStr Địa chỉ giao hàng của khách
   */
  private getDistrictCoordinates(addressStr: string): {
    lat: number;
    lng: number;
  } {
    const addr = (addressStr || '').toLowerCase();
    if (addr.includes('hòa lạc') || addr.includes('hoa lac') || addr.includes('thạch hòa') || addr.includes('tiến xuân')) {
      return { lat: 21.0188, lng: 105.5264 }; // Tọa độ GPS khu vực Hòa Lạc - Thạch Thất (33.81 km)
    }
    if (addr.includes('xuân mai') || addr.includes('xuan mai') || addr.includes('chúc sơn')) {
      return { lat: 20.8833, lng: 105.7 };
    }
    if (addr.includes('sơn tây') || addr.includes('son tay')) {
      return { lat: 21.1333, lng: 105.5 };
    }
    if (addr.includes('nội bài') || addr.includes('noi bai')) {
      return { lat: 21.2185, lng: 105.8042 };
    }
    if (addr.includes('hoàn kiếm')) return { lat: 21.0285, lng: 105.8542 };
    if (addr.includes('hai bà trưng')) return { lat: 21.0069, lng: 105.8432 };
    if (addr.includes('đống đa') || addr.includes('đường láng') || addr.includes('láng')) return { lat: 21.0125, lng: 105.8272 };
    if (addr.includes('ba đình')) return { lat: 21.0333, lng: 105.8233 };
    if (addr.includes('cầu giấy')) return { lat: 21.0362, lng: 105.7905 };
    if (addr.includes('thanh xuân')) return { lat: 20.998, lng: 105.808 };
    if (addr.includes('tây hồ')) return { lat: 21.0667, lng: 105.8167 };
    if (addr.includes('hoàng mai')) return { lat: 20.9783, lng: 105.855 };
    if (addr.includes('long biên')) return { lat: 21.045, lng: 105.885 };
    if (addr.includes('hà đông')) return { lat: 20.972, lng: 105.777 };
    if (addr.includes('nam từ liêm')) return { lat: 21.017, lng: 105.764 };
    if (addr.includes('bắc từ liêm')) return { lat: 21.071, lng: 105.756 };
    if (addr.includes('thanh trì')) return { lat: 20.95, lng: 105.85 };
    if (addr.includes('gia lâm')) return { lat: 21.0167, lng: 105.9333 };
    if (addr.includes('đông anh')) return { lat: 21.1333, lng: 105.85 };
    if (addr.includes('sóc sơn')) return { lat: 21.2667, lng: 105.85 };
    if (addr.includes('hoài đức')) return { lat: 21.0167, lng: 105.7 };
    if (addr.includes('quốc oai')) return { lat: 20.9833, lng: 105.6333 };
    if (addr.includes('thạch thất')) return { lat: 21.0333, lng: 105.5333 };
    if (addr.includes('chương mỹ')) return { lat: 20.8833, lng: 105.7 };
    if (addr.includes('thanh oai')) return { lat: 20.8667, lng: 105.7833 };
    if (addr.includes('thường tín')) return { lat: 20.8667, lng: 105.8667 };
    if (addr.includes('phú xuyên')) return { lat: 20.7333, lng: 105.9 };
    if (addr.includes('ứng hòa')) return { lat: 20.7333, lng: 105.7833 };
    if (addr.includes('mỹ đức')) return { lat: 20.6833, lng: 105.7333 };
    if (addr.includes('ba vì')) return { lat: 21.2333, lng: 105.3833 };
    if (addr.includes('phúc thọ')) return { lat: 21.1, lng: 105.5667 };
    if (addr.includes('đan phượng')) return { lat: 21.1, lng: 105.6667 };
    if (addr.includes('mê linh')) return { lat: 21.1833, lng: 105.7167 };
    return { lat: 21.0285, lng: 105.8542 };
  }

  /**
   * Ưu tiên tọa độ OpenStreetMap đã lưu; chỉ suy ra từ chuỗi địa chỉ cho dữ liệu cũ chưa có tọa độ.
   */
  private resolveCoordinates(latitude: number | null | undefined, longitude: number | null | undefined, address: string): { lat: number; lng: number } {
    if (
      typeof latitude === 'number' &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      typeof longitude === 'number' &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return { lat: latitude, lng: longitude };
    }

    return this.getDistrictCoordinates(address);
  }

  /**
   * Lấy Store duy nhất do Admin quản lý làm nguồn điểm lấy hàng cho mọi luồng AhaMove.
   */
  private async getStorePickupPoint() {
    const store = await this.prisma.store.findFirst({
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        phone: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!store) {
      throw new NotFoundException('Cửa hàng chưa được cấu hình.');
    }

    const name = store.name?.trim();
    const phone = store.phone?.trim();
    const address = store.address?.trim();
    if (!name || !phone || !address) {
      throw new BadRequestException('Vui lòng cập nhật đầy đủ tên, số điện thoại và địa chỉ cửa hàng trong trang Admin.');
    }

    const coordinates = this.resolveCoordinates(store.latitude, store.longitude, address);

    return {
      name,
      phone,
      address,
      ...coordinates,
    };
  }

  /**
   * Đẩy đơn hàng sang hệ thống AhaMove Sandbox (Giao hàng hỏa tốc nội thành)
   * Quản lý bấm nút "Gửi bên vận chuyển (AhaMove)" 1 lần duy nhất
   * @param orderId ID của đơn hàng cần giao hỏa tốc
   */
  async createAhamoveShippingOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        payment: true,
        items: { include: { product: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy thông tin đơn hàng!');
    }

    if (order.ahamoveOrderCode) {
      return {
        success: true,
        message: 'Đơn hàng này đã được tạo đơn giao hỏa tốc AhaMove trước đó!',
        ahamoveOrderCode: order.ahamoveOrderCode,
        order,
      };
    }

    const pickup = await this.getStorePickupPoint();

    let ahamoveOrderCode = '';
    let isRealAhamoveCreated = false;
    const apiKey = process.env.AHAMOVE_API_KEY || 'sk_test_1oSlooJ79RRzEzAPV4xHQfEQEmuC0FYe';
    const mobile = process.env.AHAMOVE_MOBILE || '84869098696';
    const baseUrl = process.env.AHAMOVE_API_URL || 'https://partner-apistg.ahamove.com';

    try {
      // 1. Lấy Bearer Token chính thức từ AhaMove Staging cho số điện thoại đối tác
      const tokenRes = await fetch(`${baseUrl}/v3/accounts/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, mobile: mobile }),
      });
      const tokenData = await tokenRes.json();
      const token = tokenData?.token;

      if (token) {
        // 2. Điểm lấy hàng luôn dùng thông tin Store do Admin quản lý.
        // 3. Phân tích địa chỉ giao hàng động do khách tự chọn khi Checkout (Tách riêng địa chỉ sạch, tên và SĐT người nhận)
        const parsedAddress = this.parseShippingAddressHelper(order.shippingAddress || '');
        const dropoffAddress = parsedAddress.address || 'Số 100 Phố Huế, Hai Bà Trưng, Hà Nội';
        const recipientName = parsedAddress.name || order.customerNameSnapshot || order.user?.name || 'Khách hàng PetMatching';
        const recipientPhone = parsedAddress.phone || order.customerPhoneSnapshot || order.user?.phone || '0988888888';
        const dropoffCoords = this.resolveCoordinates(order.shippingLatitude, order.shippingLongitude, dropoffAddress);

        // 4. Tính toán tổng tiền thu COD từ khách hàng
        // Nếu đơn hàng thanh toán COD: thu đúng tổng giá trị đơn hàng (order.totalAmount - đã bao gồm tiền sản phẩm & phí ship)
        // Nếu đơn hàng đã thanh toán online (PayOS/QR status = 'PAID'): COD = 0 (tài xế chỉ giao hàng, không thu thêm tiền)
        const isAlreadyPaid = order.payment?.status === 'PAID';
        const codAmount = isAlreadyPaid ? 0 : Math.round(Number(order.totalAmount || 0));
        const remarksText = codAmount > 0 ? `[PETMATCHING] Thu COD người nhận: ${codAmount.toLocaleString('vi-VN')}đ (Đơn hàng #${order.id})` : `[PETMATCHING] Đã thanh toán Online (Không thu tiền khách - Đơn hàng #${order.id})`;

        const body: any = {
          service_id: 'HAN-BIKE',
          payment_method: 'CASH',
          remarks: remarksText,
          items: [
            {
              name: `Đơn hàng PetMatching #${order.id}`,
              number: 1,
              price: codAmount,
            },
          ],
          path: [
            {
              address: pickup.address,
              name: pickup.name,
              mobile: pickup.phone,
              lat: pickup.lat,
              lng: pickup.lng,
            },
            {
              address: dropoffAddress,
              name: recipientName,
              mobile: recipientPhone,
              lat: dropoffCoords.lat,
              lng: dropoffCoords.lng,
              cod: codAmount,
            },
          ],
        };

        let response = await fetch(`${baseUrl}/v3/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        let data = await response.json();

        // Xử lý tự động: Nếu tài khoản Sandbox/Staging AhaMove giới hạn max_cod = 0đ (INVALID_MAX_COD), tự động chuyển cod ở nấc giao thành 0 và lưu ghi chú COD trong remarks để tạo vận đơn thật thành công
        if (!response.ok && data?.code === 'INVALID_MAX_COD' && codAmount > 0) {
          this.logger.warn(`[AhaMove Staging Notice] Tài khoản Staging bị giới hạn COD max = 0đ, tự động nạp COD vào Ghi chú (Remarks) để tạo vận đơn Staging thành công...`);
          body.path[1].cod = 0;
          response = await fetch(`${baseUrl}/v3/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });
          data = await response.json();
        }

        if (data && (data.order_id || data._id || data.shared_link_id)) {
          ahamoveOrderCode = data.order_id || data._id || data.shared_link_id;
          isRealAhamoveCreated = true;
          this.logger.log(`[AhaMove Staging SUCCESS] Đã tạo đơn thành công trên Dashboard AhaMove: ID=${ahamoveOrderCode}`);
        } else {
          this.logger.warn(`[AhaMove Sandbox API Warning] ${JSON.stringify(data)}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`[AhaMove API Connection Error] ${err.message}`);
    }

    if (!isRealAhamoveCreated) {
      ahamoveOrderCode = `AHAMOVE-STG-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    // Cập nhật trạng thái đơn hàng trong Database: khi vừa đẩy đơn sang AhaMove -> lưu shippingStatus: ASSIGNING, giữ nguyên status order cho đến khi tài xế nhận đơn
    const initialOrderStatus = order.status === 'PENDING' ? 'CONFIRMED' : order.status;
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ahamoveOrderCode,
        shippingStatus: 'ASSIGNING',
        status: initialOrderStatus,
        shippingNote: isRealAhamoveCreated ? 'Đã phát đơn thành công lên Dashboard AhaMove Staging (business-stg.ahamove.com), đang quét tìm tài xế' : 'Đã tạo vận đơn hỏa tốc AhaMove Sandbox (Tự động giả lập tiến trình)',
      },
    });

    // Chỉ bật bộ đếm giả lập ngầm nếu KHÔNG tạo được đơn thật trên Portal
    if (!isRealAhamoveCreated) {
      this.shippingSimulatorService.startSimulation(orderId, ahamoveOrderCode);
    }

    return {
      success: true,
      message: isRealAhamoveCreated ? `Đã đẩy đơn thành công lên AhaMove Portal! Mã đơn: ${ahamoveOrderCode}` : `Đã tạo đơn hỏa tốc AhaMove Sandbox! Mã: ${ahamoveOrderCode}`,
      ahamoveOrderCode,
      order: updatedOrder,
    };
  }

  /**
   * Đón và xử lý Webhook tự động cập nhật trạng thái từ AhaMove Staging Portal
   * Chỉ chuyển trạng thái đơn hàng sang SHIPPED (Đang giao) khi tài xế đã chấp nhận đơn (ACCEPTED) hoặc đang giao hàng.
   * Khi trạng thái chuyển sang DELIVERED, tự động cập nhật hóa đơn thanh toán COD sang PAID
   * @param payload Dữ liệu webhook gửi từ AhaMove Sandbox
   */
  async handleAhamoveWebhook(payload: any) {
    this.logger.log(`[AhaMove Webhook] Nhận payload: ${JSON.stringify(payload)}`);

    const orderCode = payload.order_id || payload.order_code || payload.shared_link_id || payload.id || payload._id;
    const status = (payload.status || payload.order_status || '').toUpperCase();

    if (!orderCode) {
      return {
        success: false,
        message: 'Thiếu mã đơn hàng AhaMove trong Webhook',
      };
    }

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ ahamoveOrderCode: orderCode }, { id: orderCode }],
      },
      include: { payment: true },
    });

    if (!order) {
      this.logger.warn(`[AhaMove Webhook] Không tìm thấy đơn hàng khớp với mã ${orderCode}`);
      return { success: false, message: 'Không tìm thấy đơn hàng tương ứng' };
    }

    let targetStatus: any = order.status;
    let note = 'Cập nhật từ AhaMove Sandbox';

    switch (status) {
      case 'ASSIGNING':
      case 'CREATED':
        // Chưa có tài xế nhận -> Giữ nguyên trạng thái đơn (CONFIRMED/PACKED), ghi nhận shippingStatus ASSIGNING
        targetStatus = order.status;
        note = 'Đã đẩy đơn sang AhaMove, đang tìm tài xế xe máy gần nhất';
        break;
      case 'ACCEPTED':
      case 'CONFIRMED':
        // Tài xế đã nhận đơn -> Chuyển sang SHIPPED (Đang giao)
        targetStatus = 'SHIPPED';
        note = 'Tài xế AhaMove đã nhận đơn hàng và đang di chuyển tới Shop (Đang giao)';
        break;
      case 'IN_PROCESS':
      case 'IN PROCESS':
      case 'DELIVERING':
      case 'ON_TRIP':
      case 'TRIP_START':
      case 'PICKED':
        // Tài xế đã lấy hàng và đang đi giao -> SHIPPED (Đang giao)
        targetStatus = 'SHIPPED';
        note = 'Tài xế AhaMove đã lấy hàng thành công và đang trên đường giao (Đang giao)';
        break;
      case 'COMPLETED':
      case 'DELIVERED':
      case 'SUCCESSFUL':
      case 'FINISHED':
        targetStatus = 'DELIVERED';
        note = 'Tài xế AhaMove đã giao hàng thành công (Giao hàng thành công)';
        break;
      case 'CANCELLED':
      case 'FAILED':
      case 'REJECTED':
        targetStatus = 'CANCELLED';
        note = 'Đơn giao hàng AhaMove đã bị hủy';
        break;
      default:
        targetStatus = order.status as any;
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        // Chuẩn hóa lưu shippingStatus chữ in hoa để khớp đồng bộ với Frontend
        shippingStatus: status.toUpperCase(),
        status: targetStatus,
        shippingNote: note,
      },
    });

    // Tự động thanh toán cho đơn hàng COD khi giao hàng thành công từ AhaMove
    if (targetStatus === 'DELIVERED' && order.payment && order.payment.method === 'COD' && order.payment.status !== 'PAID') {
      await this.prisma.payment.update({
        where: { id: order.payment.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      this.logger.log(`[AhaMove Webhook] Tự động cập nhật thanh toán COD sang PAID cho đơn ${order.id}`);
    }

    this.logger.log(`[AhaMove Webhook Updated] Đơn ${order.id} -> Status: ${targetStatus} (${status})`);
    return { success: true, message: 'Cập nhật Webhook AhaMove thành công' };
  }

  /**
   * Tính toán cước phí giao hàng hỏa tốc AhaMove thời gian thực kèm tính toán trọng lượng đơn hàng
   * - Đơn <= 10kg: cước phí chuẩn theo khoảng cách
   * - 10kg < Đơn <= 30kg: Cước chuẩn + Phụ phí quá cân (+5.000đ cho mỗi kg vượt quá 10kg)
   * - Đơn > 30kg: Vượt quá giới hạn giao bằng xe máy, trả về flag isOverweightLimit để chặn đặt hàng
   * @param dropoffLat Vĩ độ điểm giao hàng (tùy chọn)
   * @param dropoffLng Kinh độ điểm giao hàng (tùy chọn)
   * @param addressStr Chuỗi địa chỉ giao hàng (tùy chọn)
   * @param items Danh sách sản phẩm/phân loại trong đơn hàng để tính tổng trọng lượng (tùy chọn)
   * @param customWeightKg Tổng trọng lượng truyền trực tiếp (tùy chọn)
   */
  async estimateAhamoveShippingFee(
    dropoffLat?: number,
    dropoffLng?: number,
    addressStr?: string,
    items?: Array<{ productId: string; variantId?: string | null; quantity: number }>,
    customWeightKg?: number,
  ) {
    const pickup = await this.getStorePickupPoint();
    const dropoff = this.resolveCoordinates(dropoffLat, dropoffLng, addressStr || '');
    const apiKey = process.env.AHAMOVE_API_KEY || 'sk_test_1oSlooJ79RRzEzAPV4xHQfEQEmuC0FYe';
    const mobile = process.env.AHAMOVE_MOBILE || '84869098696';
    const baseUrl = process.env.AHAMOVE_API_URL || 'https://partner-apistg.ahamove.com';

    let estimatedFee = 30000;
    let isRealAhamoveFee = false;

    // 1. Thử gọi trực tiếp API báo giá ước tính chính thức từ AhaMove Portal v3
    try {
      const tokenRes = await fetch(`${baseUrl}/v3/accounts/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, mobile: mobile }),
      });
      const tokenData = await tokenRes.json();
      const token = tokenData?.token;

      if (token) {
        let estimatedOrderValue = 0;
        if (items && Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            let price = 0;
            if (item.variantId) {
              const variant = await this.prisma.productVariant.findUnique({
                where: { id: item.variantId },
                select: { salePrice: true, sellingPrice: true },
              });
              price = variant?.salePrice ?? variant?.sellingPrice ?? 0;
            } else if (item.productId) {
              const product = await this.prisma.product.findUnique({
                where: { id: item.productId },
                select: { salePrice: true, sellingPrice: true },
              });
              price = product?.salePrice ?? product?.sellingPrice ?? 0;
            }
            estimatedOrderValue += (item.quantity || 1) * price;
          }
        }

        const parsedAddr = this.parseShippingAddressHelper(addressStr || '');
        const recipientName = parsedAddr.name || 'Khách hàng PetMatching';
        const recipientPhone = parsedAddr.phone || '0988888888';

        // Sử dụng endpoint POST /v3/orders kèm flag `idle: 1` để lấy báo giá cước chuẩn theo quãng đường giao thông thực tế của AhaMove (tránh 404 ở Staging)
        const estimateBody: any = {
          service_id: 'HAN-BIKE',
          payment_method: 'CASH',
          idle: 1, // Flag idle = 1 thông báo cho AhaMove đây là truy vấn báo giá ước tính ngầm, không tự tạo đơn phát tới tài xế
          items: [
            {
              name: 'Đơn hàng PetMatching',
              number: 1,
              price: Math.round(estimatedOrderValue),
            },
          ],
          path: [
            {
              address: pickup.address,
              name: pickup.name,
              mobile: pickup.phone,
              lat: pickup.lat,
              lng: pickup.lng,
            },
            {
              address: parsedAddr.address || addressStr || 'Địa chỉ giao hàng',
              name: recipientName,
              mobile: recipientPhone,
              lat: dropoff.lat,
              lng: dropoff.lng,
              cod: 0, // Đặt COD = 0 ở chế độ ước tính để tránh lỗi INVALID_MAX_COD của môi trường Staging
            },
          ],
        };

        const feeRes = await fetch(`${baseUrl}/v3/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(estimateBody),
        });

        if (feeRes.ok) {
          const feeData = await feeRes.json();
          // AhaMove trả về cấu trúc { order: { total_fee: 33000 } } khi dùng idle = 1 trên /v3/orders
          const ahaFee =
            feeData?.order?.total_fee ||
            feeData?.order?.total_price ||
            feeData?.total_fee ||
            feeData?.total_price ||
            feeData?.fee ||
            (Array.isArray(feeData) && (feeData[0]?.total_price || feeData[0]?.fee));

          if (ahaFee && typeof ahaFee === 'number' && ahaFee > 0) {
            estimatedFee = Math.round(ahaFee);
            isRealAhamoveFee = true;
            this.logger.log(`[AhaMove Estimate API] Giá cước ước tính thời gian thực từ AhaMove Portal: ${estimatedFee}đ`);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[AhaMove Estimate API Notice] ${err.message}`);
    }

    // Tính toán khoảng cách Haversine giữa điểm shop và điểm giao
    const R = 6371;
    const dLat = ((dropoff.lat - pickup.lat) * Math.PI) / 180;
    const dLon = ((dropoff.lng - pickup.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((pickup.lat * Math.PI) / 180) * Math.cos((dropoff.lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Number((R * c).toFixed(2));

    // 2. Nếu không gọi được API AhaMove Portal -> Dùng công thức Haversine làm fallback
    if (!isRealAhamoveFee) {
      estimatedFee = 21000;
      if (distanceKm > 3) {
        estimatedFee += Math.ceil(distanceKm - 3) * 5000;
      }
    }

    // 3. Tính toán tổng khối lượng đơn hàng và phụ phí quá kg (>10kg: +5k/kg, >30kg: quá tải trọng xe máy)
    let totalWeightKg = 0;
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        let itemWeight = 0.5;
        if (item.variantId) {
          const variant = await this.prisma.productVariant.findUnique({
            where: { id: item.variantId },
            select: { weightKg: true, product: { select: { weightKg: true } } },
          });
          itemWeight = variant?.weightKg ?? variant?.product?.weightKg ?? 0.5;
        } else if (item.productId) {
          const product = await this.prisma.product.findUnique({
            where: { id: item.productId },
            select: { weightKg: true },
          });
          itemWeight = product?.weightKg ?? 0.5;
        }
        totalWeightKg += (item.quantity || 1) * itemWeight;
      }
    } else if (customWeightKg !== undefined && customWeightKg !== null) {
      totalWeightKg = customWeightKg;
    }
    totalWeightKg = Number(totalWeightKg.toFixed(2));

    let overweightFee = 0;
    let isOverweightLimit = false;

    if (totalWeightKg > 10) {
      const extraKg = Math.ceil(totalWeightKg - 10);
      overweightFee = extraKg * 5000;
      if (totalWeightKg > 30) {
        isOverweightLimit = true;
      }
    }

    // Nếu quá trọng lượng tối đa 1 đơn (> 30kg), không tính phí ship xe máy (gán 0đ) và chỉ hiển thị cảnh báo cho khách hàng
    const baseFee = isOverweightLimit ? 0 : estimatedFee;
    const finalFee = isOverweightLimit ? 0 : baseFee + overweightFee;

    return {
      success: true,
      feeVnd: finalFee,
      baseFee: isOverweightLimit ? 0 : baseFee,
      overweightFee: isOverweightLimit ? 0 : overweightFee,
      totalWeightKg,
      isOverweightLimit,
      limitWarningMessage: isOverweightLimit
        ? `Đơn hàng nặng ${totalWeightKg}kg vượt quá trọng lượng tối đa 30kg của 1 đơn xe máy. Không tính phí ship xe máy tự động. Cửa hàng sẽ liên hệ với bạn để hỗ trợ phương thức vận chuyển riêng.`
        : null,
      isRealAhamoveFee,
      distanceKm,
      formattedFee: new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(finalFee),
    };
  }

  /**
   * Tra cứu lịch sử hành trình chi tiết của vận đơn giao hỏa tốc AhaMove
   * Tự động đồng bộ trực tiếp trạng thái thực tế từ Portal AhaMove API v3
   * @param code Mã vận đơn AhaMove
   */
  async getAhamoveTrackingDetail(code: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ ahamoveOrderCode: code }, { id: code }],
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy vận đơn AhaMove có mã ${code}`);
    }

    let currentStatus = (order.shippingStatus || 'ASSIGNING').toUpperCase();
    let driverName = 'Trần Văn Mạnh (Tài xế AhaMove Hỏa Tốc)';
    let driverPhone = '0912 888 999';

    // Gọi trực tiếp AhaMove Staging API v3 để đồng bộ trạng thái thực tế nếu có mã vận đơn AhaMove thật
    if (order.ahamoveOrderCode && !order.ahamoveOrderCode.startsWith('AHAMOVE-STG-')) {
      try {
        const apiKey = process.env.AHAMOVE_API_KEY || 'sk_test_1oSlooJ79RRzEzAPV4xHQfEQEmuC0FYe';
        const mobile = process.env.AHAMOVE_MOBILE || '84869098696';
        const baseUrl = process.env.AHAMOVE_API_URL || 'https://partner-apistg.ahamove.com';

        const tokenRes = await fetch(`${baseUrl}/v3/accounts/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey, mobile: mobile }),
        });
        const tokenData = await tokenRes.json();
        const token = tokenData?.token;

        if (token) {
          const detailRes = await fetch(`${baseUrl}/v3/orders/${order.ahamoveOrderCode}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (detailRes.ok) {
            const ahaData = await detailRes.json();
            const ahaStatus = (ahaData.status || '').toUpperCase();
            if (ahaStatus) {
              currentStatus = ahaStatus;
              if (ahaData.supplier_name || ahaData.driver_name) {
                driverName = ahaData.supplier_name || ahaData.driver_name;
              }
              if (ahaData.supplier_id || ahaData.driver_phone) {
                driverPhone = ahaData.supplier_id || ahaData.driver_phone;
              }

              // Tự động cập nhật Database nếu trạng thái trên AhaMove Portal có thay đổi
              let targetOrderStatus: any = order.status;
              // Chỉ khi tài xế đã chấp nhận đơn (ACCEPTED) hoặc đang di chuyển giao hàng mới chuyển sang SHIPPED (Đang giao)
              const driverAcceptedStatuses = ['ACCEPTED', 'IN_PROCESS', 'IN PROCESS', 'DELIVERING', 'ON_TRIP', 'TRIP_START', 'CONFIRMED', 'PICKED'];
              const completedStatuses = ['COMPLETED', 'DELIVERED', 'SUCCESSFUL', 'FINISHED'];
              const cancelledStatuses = ['CANCELLED', 'FAILED', 'REJECTED'];

              if (completedStatuses.includes(ahaStatus)) {
                targetOrderStatus = 'DELIVERED';
              } else if (driverAcceptedStatuses.includes(ahaStatus)) {
                targetOrderStatus = 'SHIPPED';
              } else if (cancelledStatuses.includes(ahaStatus)) {
                targetOrderStatus = 'CANCELLED';
              }

              if (order.shippingStatus !== ahaStatus || order.status !== targetOrderStatus) {
                await this.prisma.order.update({
                  where: { id: order.id },
                  data: {
                    shippingStatus: ahaStatus,
                    status: targetOrderStatus,
                    shippingNote: `Tự động đồng bộ từ AhaMove Portal: ${ahaStatus}`,
                  },
                });

                // Tự động cập nhật thanh toán COD thành PAID khi AhaMove báo hoàn tất
                if (targetOrderStatus === 'DELIVERED') {
                  const payment = await this.prisma.payment.findUnique({
                    where: { orderId: order.id },
                  });
                  if (payment && payment.method === 'COD' && payment.status !== 'PAID') {
                    await this.prisma.payment.update({
                      where: { id: payment.id },
                      data: { status: 'PAID', paidAt: new Date() },
                    });
                    this.logger.log(`[AhaMove Sync] Tự động cập nhật thanh toán COD thành PAID cho đơn ${order.id}`);
                  }
                }
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`[AhaMove Live Sync Warning] ${err.message}`);
      }
    }

    const createdAt = order.createdAt;

    // Chuẩn hóa timeline 6 bước đúng theo tiến trình Portal AhaMove (Tạo đơn -> Tìm tài xế -> Đã nhận -> Thực hiện -> Giao thành công -> Hoàn thành)
    const trackingEvents: any[] = [
      {
        step: 1,
        statusKey: 'CREATED',
        title: 'Tạo đơn',
        location: 'Điểm lấy hàng Shop PetMatching',
        description: `Đơn hàng được khởi tạo bởi ${order.customerNameSnapshot || 'Shop PetMatching'}`,
        time: createdAt,
        isCompleted: true,
      },
      {
        step: 2,
        statusKey: 'ASSIGNING',
        title: 'Tìm tài xế',
        location: 'Hệ thống AhaMove Hà Nội',
        description: 'Hệ thống AhaMove đang định vị và quét tài xế xe máy gần nhất',
        time: new Date(createdAt.getTime() + 15 * 1000),
        isCompleted: true,
      },
    ];

    const isAccepted = currentStatus === 'ACCEPTED' || currentStatus === 'IN_PROCESS' || currentStatus === 'IN PROCESS' || currentStatus === 'COMPLETED';

    if (isAccepted) {
      trackingEvents.push({
        step: 3,
        statusKey: 'ACCEPTED',
        title: 'Đã nhận',
        location: 'Tài xế đang tới Shop lấy hàng',
        description: `Tài xế ${driverName} (${driverPhone}) đã nhận đơn hàng`,
        time: new Date(createdAt.getTime() + 45 * 1000),
        isCompleted: true,
      });
    }

    const isInProcess = currentStatus === 'IN_PROCESS' || currentStatus === 'IN PROCESS' || currentStatus === 'COMPLETED';

    if (isInProcess) {
      trackingEvents.push({
        step: 4,
        statusKey: 'IN_PROCESS',
        title: 'Thực hiện',
        location: 'Tuyến đường giao hàng hỏa tốc',
        description: 'Tài xế đã lấy hàng thành công và đang hỏa tốc vận chuyển tới khách',
        time: new Date(createdAt.getTime() + 120 * 1000),
        isCompleted: true,
      });
    }

    const isCompleted = currentStatus === 'COMPLETED' || order.status === 'DELIVERED';

    if (isCompleted) {
      trackingEvents.push(
        {
          step: 5,
          statusKey: 'DELIVERED_PART',
          title: 'Giao hàng thành công gói thứ 1',
          location: order.shippingAddress,
          description: 'Tài xế đã giao thú cưng/hàng hóa tận tay người nhận',
          time: new Date(createdAt.getTime() + 180 * 1000),
          isCompleted: true,
        },
        {
          step: 6,
          statusKey: 'COMPLETED',
          title: 'Hoàn thành',
          location: 'Hệ thống AhaMove Portal',
          description: 'Đơn hàng giao hỏa tốc hoàn thành và đóng vận đơn',
          time: new Date(createdAt.getTime() + 210 * 1000),
          isCompleted: true,
        },
      );
    }

    return {
      ahamoveOrderCode: order.ahamoveOrderCode || code,
      orderId: order.id,
      orderStatus: order.status,
      currentShippingStatus: currentStatus,
      shippingAddress: order.shippingAddress,
      shipperInfo: {
        name: driverName,
        phone: driverPhone,
        vehicle: 'Honda Wave - BKS: 29-H1 888.88',
        hubName: 'Đội xe hỏa tốc AhaMove Hà Nội',
      },
      events: trackingEvents,
    };
  }

  /**
   * Tra cứu địa chỉ tự động giới hạn nghiêm ngặt khu vực Thành phố Hà Nội bằng cách kết hợp Photon & Nominatim OpenStreetMap
   * Lọc chỉ các vị trí nằm trong khung tọa độ GPS Hà Nội (Vĩ độ: 20.53 - 21.39, Kinh độ: 105.28 - 106.02)
   * @param query Từ khóa địa chỉ khách hàng nhập vào
   */
  async searchAddressAutocomplete(query: string) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim();

    const results: any[] = [];
    const seenAddresses = new Set<string>();

    try {
      // 1. Tra cứu qua Photon OpenStreetMap Engine
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ' Hà Nội')}&limit=12`;
      const photonRes = await fetch(photonUrl);
      if (photonRes.ok) {
        const photonData = await photonRes.json();
        const features = photonData?.features || [];

        for (const feat of features) {
          const props = feat.properties || {};
          const coords = feat.geometry?.coordinates || [0, 0];
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);

          // Kiểm tra nghiêm ngặt khung tọa độ địa lý Hà Nội
          const isStrictHanoiGPS = lat >= 20.53 && lat <= 21.39 && lng >= 105.28 && lng <= 106.02;
          if (!isStrictHanoiGPS) continue;

          const name = props.name || '';
          const street = props.street || props.name || '';
          const houseNumber = props.housenumber ? `Số ${props.housenumber}, ` : '';
          const district = props.district || props.suburb || props.city || 'Hà Nội';
          const city = 'Thành phố Hà Nội';

          let fullAddress = '';
          if (houseNumber) fullAddress += houseNumber;
          if (street) fullAddress += street;
          if (name && name !== street) fullAddress += ` (${name})`;
          if (district && !fullAddress.includes(district)) fullAddress += `, ${district}`;
          if (!fullAddress.includes('Hà Nội')) fullAddress += ', Thành phố Hà Nội';

          const cleanAddr = fullAddress.trim();
          if (cleanAddr && !seenAddresses.has(cleanAddr.toLowerCase())) {
            seenAddresses.add(cleanAddr.toLowerCase());
            results.push({
              address: cleanAddr,
              detail: `${houseNumber}${street || name}`.trim() || cleanAddr,
              ward: district,
              district: district,
              province: city,
              lng: lng,
              lat: lat,
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[Autocomplete Error Photon] ${err.message}`);
    }

    try {
      // 2. Tra cứu bổ sung qua Nominatim OpenStreetMap Engine nếu kết quả quá ít
      if (results.length < 3) {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Hà Nội')}&format=json&addressdetails=1&limit=8`;
        const nomRes = await fetch(nomUrl, {
          headers: { 'User-Agent': 'PetMatching/1.0' },
        });
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (Array.isArray(nomData)) {
            for (const item of nomData) {
              const lat = Number(item.lat);
              const lng = Number(item.lon);

              // Kiểm tra nghiêm ngặt khung tọa độ địa lý Hà Nội
              const isStrictHanoiGPS = lat >= 20.53 && lat <= 21.39 && lng >= 105.28 && lng <= 106.02;
              if (!isStrictHanoiGPS) continue;

              const addrObj = item.address || {};
              const cleanAddr = item.display_name || '';
              const lowerAddr = cleanAddr.toLowerCase();

              // Loại bỏ các địa điểm ở TP.HCM / Sài Gòn / Tỉnh khác bị trùng từ khóa "Hà Nội" trong tên quán
              const isOtherProvince = lowerAddr.includes('hồ chí minh') || lowerAddr.includes('sài gòn') || lowerAddr.includes('đà nẵng') || lowerAddr.includes('bình dương') || lowerAddr.includes('đồng nai');
              if (isOtherProvince) continue;

              const houseNum = addrObj.house_number ? `Số ${addrObj.house_number}, ` : '';
              const street = addrObj.road || addrObj.suburb || '';

              if (cleanAddr && !seenAddresses.has(cleanAddr.toLowerCase())) {
                seenAddresses.add(cleanAddr.toLowerCase());
                results.push({
                  address: cleanAddr,
                  detail: `${houseNum}${street}`.trim() || cleanAddr,
                  ward: addrObj.suburb || addrObj.district || 'Hà Nội',
                  district: addrObj.district || addrObj.suburb || 'Hà Nội',
                  province: 'Thành phố Hà Nội',
                  lng: lng,
                  lat: lat,
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[Autocomplete Error Nominatim] ${err.message}`);
    }

    return results;
  }

  /**
   * Tự động đồng bộ tất cả các đơn hàng AhaMove đang giao từ AhaMove Staging Portal
   * Quét toàn bộ đơn có mã ahamoveOrderCode chưa hoàn thành để cập nhật trạng thái mới nhất từ AhaMove API
   */
  async syncActiveAhamoveOrders(userId?: string) {
    const activeOrders = await this.prisma.order.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ahamoveOrderCode: { not: null },
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
    });

    if (activeOrders.length === 0) {
      return { success: true, count: 0, updated: 0 };
    }

    let updatedCount = 0;
    for (const order of activeOrders) {
      if (order.ahamoveOrderCode) {
        try {
          await this.getAhamoveTrackingDetail(order.ahamoveOrderCode);
          updatedCount++;
        } catch (err: any) {
          this.logger.warn(`[Sync AhaMove Error] Order ${order.id}: ${err.message}`);
        }
      }
    }

    return { success: true, count: activeOrders.length, updated: updatedCount };
  }
}
