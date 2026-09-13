import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Service Giả lập tiến trình vận chuyển GHN ngầm (Sandbox Simulator)
 * Tự động chuyển trạng thái đơn hàng theo thời gian khi ở môi trường Sandbox/Dev
 * Giúp trải nghiệm tự động hóa 100% không bị đứng yên do thiếu shipper thật.
 */
@Injectable()
export class ShippingSimulatorService {
  private readonly logger = new Logger(ShippingSimulatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Khởi chạy giả lập tiến trình shipper GHN cho mã vận đơn ghnOrderCode
   * @param orderId ID đơn hàng trong cơ sở dữ liệu
   * @param ghnOrderCode Mã vận đơn GHN sinh ra từ API Sandbox
   */
  startSimulation(orderId: string, ghnOrderCode: string) {
    this.logger.log(
      `[GHN Simulator] Đã kích hoạt giả lập tiến trình tự động cho đơn ${orderId} (GHN Code: ${ghnOrderCode})`,
    );

    // Giai đoạn 1: Sau 45 giây -> Shipper đang đến lấy hàng (PROCESSING / picking)
    setTimeout(async () => {
      await this.updateOrderStatus(
        orderId,
        ghnOrderCode,
        'picking',
        'PROCESSING',
        'Shipper GHN đã lấy hàng thành công',
      );
    }, 45000);

    // Giai đoạn 2: Sau 120 giây (2 phút) -> Đang giao hàng (SHIPPED / delivering)
    setTimeout(async () => {
      await this.updateOrderStatus(
        orderId,
        ghnOrderCode,
        'delivering',
        'SHIPPED',
        'Đơn hàng GHN đang trên đường giao tới người nhận',
      );
    }, 120000);

    // Giai đoạn 3: Sau 210 giây (3.5 phút) -> Giao thành công (DELIVERED / delivered)
    setTimeout(async () => {
      await this.updateOrderStatus(
        orderId,
        ghnOrderCode,
        'delivered',
        'DELIVERED',
        'Khách hàng đã nhận hàng thành công từ GHN',
      );
    }, 210000);
  }

  /**
   * Cập nhật trạng thái đơn hàng trong Database khi giả lập nhảy mốc
   */
  private async updateOrderStatus(
    orderId: string,
    ghnOrderCode: string,
    shippingStatus: string,
    status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED',
    note: string,
  ) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      // Nếu đơn hàng đã bị hủy hoặc không tồn tại thì dừng giả lập
      if (!order || order.status === 'CANCELLED') {
        this.logger.warn(
          `[GHN Simulator] Bỏ qua giả lập do đơn ${orderId} đã hủy hoặc không tồn tại.`,
        );
        return;
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          shippingStatus,
          status,
          shippingNote: note,
        },
      });

      this.logger.log(
        `[GHN Simulator Auto-Update] Đơn ${orderId} (${ghnOrderCode}) -> Status: ${status}, ShippingStatus: ${shippingStatus}`,
      );
    } catch (err) {
      this.logger.error(
        `[GHN Simulator Error] Lỗi cập nhật giả lập cho đơn ${orderId}:`,
        err,
      );
    }
  }
}
