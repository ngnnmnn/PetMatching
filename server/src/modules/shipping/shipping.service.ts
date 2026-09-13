import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { HANOI_WARDS } from '../matching/hanoi-wards';
import { ShippingSimulatorService } from './shipping-simulator.service';

/**
 * Service xử lý tính phí, danh mục Phường/Xã và Tích hợp Giao Hàng Nhanh (GHN)
 */
@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private static readonly HANOI_PROVINCE_ID = 1;

  // Cấu hình API GHN Sandbox mặc định
  private readonly ghnToken =
    process.env.GHN_TOKEN || 'a3fdf0a8-851d-11f1-aa4d-367074fd68e2';
  private readonly ghnShopId = process.env.GHN_SHOP_ID || '195509';
  private readonly ghnBaseUrl =
    process.env.GHN_API_URL || 'https://online-gateway.ghn.vn/shiip/public-api';

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
   * Đẩy đơn hàng sang hệ thống Giao Hàng Nhanh (GHN Sandbox)
   * Quản lý bấm nút "Gửi bên vận chuyển" 1 lần duy nhất
   * @param orderId ID của đơn hàng cần tạo vận đơn
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
      throw new NotFoundException('Không tìm thấy thông tin đơn hàng!');
    }

    if (order.ghnOrderCode) {
      return {
        success: true,
        message: 'Đơn hàng này đã được tạo vận đơn GHN trước đó!',
        ghnOrderCode: order.ghnOrderCode,
        order,
      };
    }

    // Thiết lập thông tin gói hàng
    const toDistrictId = order.districtId || 1442; // Mặc định Đống Đa nếu thiếu
    const toWardCode = order.wardCode || '20101'; // Mặc định Cát Linh nếu thiếu

    const items = order.items.map((item) => ({
      name: item.product.name.substring(0, 50),
      code: item.productId,
      quantity: item.quantity,
      price: Math.round(item.price),
      weight: 200,
    }));

    const totalWeight = items.reduce(
      (sum, item) => sum + item.quantity * item.weight,
      0,
    );

    const body = {
      payment_type_id: 2,
      note: 'Đơn hàng PetMatching - Cho xem hàng',
      required_note: 'KHONGCHOXEMHANG',
      to_name: order.customerNameSnapshot || order.user?.name || 'Khách hàng PetMatching',
      to_phone: order.customerPhoneSnapshot || order.user?.phone || '0988888888',
      to_address: order.shippingAddress,
      to_district_id: Number(toDistrictId),
      to_ward_code: String(toWardCode),
      weight: Math.max(totalWeight, 300),
      length: 15,
      width: 15,
      height: 15,
      service_type_id: 2,
      cod_amount:
        order.status === 'PENDING'
          ? Math.round(order.totalAmount + order.shippingFee)
          : 0,
      items,
    };

    let ghnOrderCode = '';
    let isSandboxFallback = false;

    try {
      // Gọi API khởi tạo đơn GHN
      const response = await fetch(
        `${this.ghnBaseUrl}/v2/shipping-order/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Token: this.ghnToken,
            ShopId: this.ghnShopId,
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();

      if (data.code === 200 && data.data?.order_code) {
        ghnOrderCode = data.data.order_code;
      } else {
        this.logger.warn(
          `[GHN API Sandbox Warning] API GHN trả về lỗi (${data.message}), tự động khởi tạo mã vận đơn thử nghiệm Sandbox...`,
        );
        isSandboxFallback = true;
        ghnOrderCode = `GHN-SB-${Math.floor(100000 + Math.random() * 900000)}`;
      }
    } catch (err) {
      this.logger.warn(
        `[GHN API Connection] Kết nối GHN API gặp sự cố, tự động dùng mã vận đơn giả lập: ${err.message}`,
      );
      isSandboxFallback = true;
      ghnOrderCode = `GHN-SB-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    // Cập nhật đơn hàng trong DB
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ghnOrderCode,
        shippingStatus: 'ready_to_pick',
        status: 'PROCESSING',
        shippingNote: isSandboxFallback
          ? 'Đã gửi đơn GHN Sandbox (Tự động giả lập tiến trình shipper)'
          : 'Đã tạo vận đơn trên GHN thành công',
      },
    });

    // Kích hoạt bộ đếm thời gian giả lập tự động tracking ngầm
    this.shippingSimulatorService.startSimulation(orderId, ghnOrderCode);

    return {
      success: true,
      message: 'Đã tạo đơn vận chuyển GHN thành công!',
      ghnOrderCode,
      order: updatedOrder,
    };
  }

  /**
   * Đón và xử lý Webhook tự động cập nhật trạng thái từ GHN
   * @param payload Dữ liệu webhook gửi từ GHN hoặc Simulator
   */
  async handleWebhook(payload: any) {
    this.logger.log(`[GHN Webhook] Nhận payload: ${JSON.stringify(payload)}`);

    const ghnOrderCode = payload.OrderCode || payload.order_code;
    const status = (payload.Status || payload.status || '').toLowerCase();

    if (!ghnOrderCode) {
      return { success: false, message: 'Thiếu thông tin order_code trong Webhook' };
    }

    const order = await this.prisma.order.findFirst({
      where: { ghnOrderCode },
    });

    if (!order) {
      return { success: false, message: 'Không tìm thấy đơn hàng tương ứng' };
    }

    let newStatus: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' =
      order.status as any;

    switch (status) {
      case 'ready_to_pick':
      case 'picking':
      case 'storing':
      case 'sorting':
        newStatus = 'PROCESSING';
        break;
      case 'delivering':
      case 'transporting':
        newStatus = 'SHIPPED';
        break;
      case 'delivered':
        newStatus = 'DELIVERED';
        break;
      case 'cancel':
      case 'returned':
        newStatus = 'CANCELLED';
        break;
      default:
        break;
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        shippingStatus: status,
        status: newStatus,
      },
    });

    return {
      success: true,
      orderId: order.id,
      ghnOrderCode,
      shippingStatus: status,
      orderStatus: newStatus,
    };
  }

  /**
   * Tra cứu lịch sử hành trình chi tiết của vận đơn GHN tự động
   * @param ghnOrderCode Mã vận đơn GHN
   */
  async getTrackingDetail(ghnOrderCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { ghnOrderCode },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy vận đơn GHN có mã ${ghnOrderCode}`);
    }

    const currentStatus = (order.shippingStatus || 'ready_to_pick').toLowerCase();
    const createdAt = order.createdAt;

    // Xây dựng mốc thời gian hành trình lịch sử vận chuyển
    const trackingEvents: any[] = [
      {
        step: 1,
        statusKey: 'ready_to_pick',
        title: 'Đã tạo vận đơn GHN',
        location: 'Bưu cục GHN Đống Đa - Hà Nội',
        description: 'Shop đã gửi thông tin đơn hàng sang cổng GHN',
        time: createdAt,
        isCompleted: true,
      },
    ];

    const isPicking =
      currentStatus === 'picking' ||
      currentStatus === 'storing' ||
      currentStatus === 'sorting' ||
      currentStatus === 'delivering' ||
      currentStatus === 'transporting' ||
      currentStatus === 'delivered';

    if (isPicking) {
      trackingEvents.push({
        step: 2,
        statusKey: 'picking',
        title: 'Shipper đã lấy hàng',
        location: 'Kho trung chuyển GHN Hà Nội',
        description: 'Shipper GHN đã tiếp nhận và đang luân chuyển hàng',
        time: new Date(createdAt.getTime() + 45 * 1000),
        isCompleted: true,
      });
    }

    const isDelivering =
      currentStatus === 'delivering' ||
      currentStatus === 'transporting' ||
      currentStatus === 'delivered';

    if (isDelivering) {
      trackingEvents.push({
        step: 3,
        statusKey: 'delivering',
        title: 'Đang giao hàng tới người nhận',
        location: 'Tuyến giao hàng nội thành Hà Nội',
        description: 'Shipper GHN đang gọi điện và giao hàng đến địa chỉ',
        time: new Date(createdAt.getTime() + 120 * 1000),
        isCompleted: true,
      });
    }

    const isDelivered = currentStatus === 'delivered' || order.status === 'DELIVERED';

    if (isDelivered) {
      trackingEvents.push({
        step: 4,
        statusKey: 'delivered',
        title: 'Giao hàng thành công',
        location: order.shippingAddress,
        description: 'Người nhận đã kí xác nhận nhận hàng thành công',
        time: new Date(createdAt.getTime() + 210 * 1000),
        isCompleted: true,
      });
    }

    return {
      ghnOrderCode,
      orderId: order.id,
      orderStatus: order.status,
      currentShippingStatus: currentStatus,
      shippingAddress: order.shippingAddress,
      shipperInfo: {
        name: 'Nguyễn Văn Nam (Shipper GHN)',
        phone: '0988 123 456',
        hubName: 'Bưu cục GHN Đống Đa',
      },
      events: trackingEvents,
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
  private getDistrictCoordinates(addressStr: string): { lat: number; lng: number } {
    const addr = (addressStr || '').toLowerCase();
    if (addr.includes('hoàn kiếm')) return { lat: 21.0285, lng: 105.8542 };
    if (addr.includes('hai bà trưng')) return { lat: 21.0069, lng: 105.8432 };
    if (addr.includes('đống đa')) return { lat: 21.0125, lng: 105.8272 };
    if (addr.includes('ba đình')) return { lat: 21.0333, lng: 105.8233 };
    if (addr.includes('cầu giấy')) return { lat: 21.0362, lng: 105.7905 };
    if (addr.includes('thanh xuân')) return { lat: 20.9980, lng: 105.8080 };
    if (addr.includes('tây hồ')) return { lat: 21.0667, lng: 105.8167 };
    if (addr.includes('hoàng mai')) return { lat: 20.9783, lng: 105.8550 };
    if (addr.includes('long biên')) return { lat: 21.0450, lng: 105.8850 };
    if (addr.includes('hà đông')) return { lat: 20.9720, lng: 105.7770 };
    if (addr.includes('nam từ liêm')) return { lat: 21.0170, lng: 105.7640 };
    if (addr.includes('bắc từ liêm')) return { lat: 21.0710, lng: 105.7560 };
    if (addr.includes('thanh trì')) return { lat: 20.9500, lng: 105.8500 };
    if (addr.includes('gia lâm')) return { lat: 21.0167, lng: 105.9333 };
    if (addr.includes('đông anh')) return { lat: 21.1333, lng: 105.8500 };
    if (addr.includes('sóc sơn')) return { lat: 21.2667, lng: 105.8500 };
    if (addr.includes('hoài đức')) return { lat: 21.0167, lng: 105.7000 };
    if (addr.includes('quốc oai')) return { lat: 20.9833, lng: 105.6333 };
    if (addr.includes('thạch thất')) return { lat: 21.0333, lng: 105.5333 };
    if (addr.includes('chương mỹ')) return { lat: 20.8833, lng: 105.7000 };
    if (addr.includes('thanh oai')) return { lat: 20.8667, lng: 105.7833 };
    if (addr.includes('thường tín')) return { lat: 20.8667, lng: 105.8667 };
    if (addr.includes('phú xuyên')) return { lat: 20.7333, lng: 105.9000 };
    if (addr.includes('ứng hòa')) return { lat: 20.7333, lng: 105.7833 };
    if (addr.includes('mỹ đức')) return { lat: 20.6833, lng: 105.7333 };
    if (addr.includes('sơn tây')) return { lat: 21.1333, lng: 105.5000 };
    if (addr.includes('ba vì')) return { lat: 21.2333, lng: 105.3833 };
    if (addr.includes('phúc thọ')) return { lat: 21.1000, lng: 105.5667 };
    if (addr.includes('đan phượng')) return { lat: 21.1000, lng: 105.6667 };
    if (addr.includes('mê linh')) return { lat: 21.1833, lng: 105.7167 };
    return { lat: 21.0285, lng: 105.8542 };
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
        // 2. Tọa độ GPS cố định điểm lấy hàng Shop PetMatching (Bách Khoa - Hai Bà Trưng - Hà Nội)
        const pickupAddress = 'Số 1 Đại Cổ Việt, Hai Bà Trưng, Hà Nội';
        const pickupLat = 21.0069;
        const pickupLng = 105.8432;

        // 3. Phân tích địa chỉ giao hàng động do khách tự chọn khi Checkout (Tách riêng địa chỉ sạch, tên và SĐT người nhận)
        const parsedAddress = this.parseShippingAddressHelper(order.shippingAddress || '');
        const dropoffAddress = parsedAddress.address || 'Số 100 Phố Huế, Hai Bà Trưng, Hà Nội';
        const recipientName = parsedAddress.name || order.customerNameSnapshot || order.user?.name || 'Khách hàng PetMatching';
        const recipientPhone = parsedAddress.phone || order.customerPhoneSnapshot || order.user?.phone || '0988888888';
        const dropoffCoords = this.getDistrictCoordinates(dropoffAddress);

        // 4. Tính toán tổng tiền thu COD từ khách hàng
        // Nếu đơn hàng thanh toán COD: thu đúng tổng giá trị đơn hàng (order.totalAmount - đã bao gồm tiền sản phẩm & phí ship)
        // Nếu đơn hàng đã thanh toán online (PayOS/QR status = 'PAID'): COD = 0 (tài xế chỉ giao hàng, không thu thêm tiền)
        const isAlreadyPaid = order.payment?.status === 'PAID';
        const codAmount = isAlreadyPaid ? 0 : Math.round(Number(order.totalAmount || 0));
        const remarksText = codAmount > 0
          ? `[PETMATCHING] Thu COD người nhận: ${codAmount.toLocaleString('vi-VN')}đ (Đơn hàng #${order.id})`
          : `[PETMATCHING] Đã thanh toán Online (Không thu tiền khách - Đơn hàng #${order.id})`;

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
              address: pickupAddress,
              name: 'PetMatching Shop',
              mobile: mobile,
              lat: pickupLat,
              lng: pickupLng,
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

    // Cập nhật trạng thái đơn hàng trong Database: khi vừa đẩy đơn sang AhaMove -> chuyển sang SHIPPED (Đã gửi vận chuyển)
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        ahamoveOrderCode,
        shippingStatus: 'ASSIGNING',
        status: 'SHIPPED',
        shippingNote: isRealAhamoveCreated
          ? 'Đã phát đơn thành công lên Dashboard AhaMove Staging (business-stg.ahamove.com)'
          : 'Đã tạo vận đơn hỏa tốc AhaMove Sandbox (Tự động giả lập tiến trình)',
      },
    });

    // Chỉ bật bộ đếm giả lập ngầm nếu KHÔNG tạo được đơn thật trên Portal
    if (!isRealAhamoveCreated) {
      this.shippingSimulatorService.startSimulation(orderId, ahamoveOrderCode);
    }

    return {
      success: true,
      message: isRealAhamoveCreated
        ? `Đã đẩy đơn thành công lên AhaMove Portal! Mã đơn: ${ahamoveOrderCode}`
        : `Đã tạo đơn hỏa tốc AhaMove Sandbox! Mã: ${ahamoveOrderCode}`,
      ahamoveOrderCode,
      order: updatedOrder,
    };
  }

  /**
   * Đón và xử lý Webhook tự động cập nhật trạng thái từ AhaMove Staging Portal
   * Cập nhật trạng thái hiển thị: SHIPPED (Đang giao) -> DELIVERED (Giao hàng thành công)
   * @param payload Dữ liệu webhook gửi từ AhaMove
   */
  async handleAhamoveWebhook(payload: any) {
    this.logger.log(`[AhaMove Webhook] Nhận payload: ${JSON.stringify(payload)}`);

    const orderCode = payload.order_id || payload.order_code || payload.shared_link_id;
    const status = (payload.status || '').toUpperCase();

    if (!orderCode) {
      return { success: false, message: 'Thiếu mã đơn hàng AhaMove trong Webhook' };
    }

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ ahamoveOrderCode: orderCode }, { id: orderCode }],
      },
    });

    if (!order) {
      this.logger.warn(`[AhaMove Webhook] Không tìm thấy đơn hàng khớp với mã ${orderCode}`);
      return { success: false, message: 'Không tìm thấy đơn hàng tương ứng' };
    }

    let targetStatus: 'SHIPPED' | 'DELIVERED' | 'CANCELLED' = 'SHIPPED';
    let note = 'Cập nhật từ AhaMove';

    switch (status) {
      case 'ACCEPTED':
        targetStatus = 'SHIPPED';
        note = 'Tài xế AhaMove đã nhận đơn hàng và đang di chuyển tới Shop (Đang giao)';
        break;
      case 'IN_PROCESS':
      case 'IN PROCESS':
        targetStatus = 'SHIPPED';
        note = 'Tài xế AhaMove đã lấy hàng thành công và đang trên đường giao (Đang giao)';
        break;
      case 'COMPLETED':
        targetStatus = 'DELIVERED';
        note = 'Tài xế AhaMove đã giao hàng thành công (Giao hàng thành công)';
        break;
      case 'CANCELLED':
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

    this.logger.log(`[AhaMove Webhook Updated] Đơn ${order.id} -> Status: ${targetStatus} (${status})`);
    return { success: true, message: 'Cập nhật Webhook AhaMove thành công' };
  }

  /**
   * Tính toán phí giao hàng hỏa tốc AhaMove dựa trên tọa độ GPS địa chỉ nhận và bảng giá dịch vụ
   * @param dropoffLat Vĩ độ điểm giao hàng
   * @param dropoffLng Kinh độ điểm giao hàng
   */
  async estimateAhamoveShippingFee(dropoffLat: number, dropoffLng: number) {
    const pickupLat = 21.0069; // Shop PetMatching (Bách Khoa, Hà Nội)
    const pickupLng = 105.8432;

    // Công thức Haversine tính khoảng cách giữa 2 điểm GPS (đơn vị: km)
    const R = 6371;
    const dLat = ((dropoffLat - pickupLat) * Math.PI) / 180;
    const dLon = ((dropoffLng - pickupLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pickupLat * Math.PI) / 180) *
        Math.cos((dropoffLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Number((R * c).toFixed(2));

    // Bảng giá AhaMove HAN-BIKE: 3km đầu = 21.000đ, mỗi km tiếp theo +5.000đ
    let feeVnd = 21000;
    if (distanceKm > 3) {
      feeVnd += Math.ceil(distanceKm - 3) * 5000;
    }

    return {
      success: true,
      distanceKm,
      feeVnd,
      formattedFee: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(feeVnd),
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
              const activeStatuses = ['ACCEPTED', 'IN_PROCESS', 'IN PROCESS', 'DELIVERING', 'ON_TRIP', 'TRIP_START', 'ASSIGNING'];
              if (ahaStatus === 'COMPLETED') {
                targetOrderStatus = 'DELIVERED';
              } else if (activeStatuses.includes(ahaStatus)) {
                targetOrderStatus = 'SHIPPED';
              } else if (ahaStatus === 'CANCELLED') {
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

    const isAccepted =
      currentStatus === 'ACCEPTED' ||
      currentStatus === 'IN_PROCESS' ||
      currentStatus === 'IN PROCESS' ||
      currentStatus === 'COMPLETED';

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

    const isInProcess =
      currentStatus === 'IN_PROCESS' ||
      currentStatus === 'IN PROCESS' ||
      currentStatus === 'COMPLETED';

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
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        q + ' Hà Nội',
      )}&limit=12`;
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
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          q + ', Hà Nội',
        )}&format=json&addressdetails=1&limit=8`;
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
              const isOtherProvince =
                lowerAddr.includes('hồ chí minh') ||
                lowerAddr.includes('sài gòn') ||
                lowerAddr.includes('đà nẵng') ||
                lowerAddr.includes('bình dương') ||
                lowerAddr.includes('đồng nai');
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
  async syncActiveAhamoveOrders() {
    const activeOrders = await this.prisma.order.findMany({
      where: {
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


