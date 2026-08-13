import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PayOS } from '@payos/node';
import { NotificationCategory, NotificationEventType, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentService {
  private payos: PayOS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
      console.error(
        'PAYOS credentials are not fully configured in environment variables.',
      );
    }

    this.payos = new PayOS({
      clientId: clientId || '',
      apiKey: apiKey || '',
      checksumKey: checksumKey || '',
    });
  }

  async generateOrderCode(): Promise<number> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const orderCode = Math.floor(100000000 + Math.random() * 900000000);
      const exists = await this.prisma.payment.findUnique({
        where: { orderCode },
        select: { id: true },
      });
      if (!exists) return orderCode;
    }

    throw new InternalServerErrorException(
      'Không thể tạo mã thanh toán duy nhất. Vui lòng thử lại.',
    );
  }

  async createQrLink(params: {
    paymentId: string;
    descriptionPrefix: string;
    returnUrl: string;
    cancelUrl: string;
    items?: Array<{ name: string; quantity: number; price: number }>;
    forceNewCode?: boolean;
  }) {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: params.paymentId },
    });
    const mustGenerateNewCode =
      params.forceNewCode ||
      payment.status === PaymentStatus.CANCELLED ||
      payment.status === PaymentStatus.EXPIRED ||
      payment.status === PaymentStatus.PAYMENT_ERROR ||
      (payment.status === PaymentStatus.PENDING && !!payment.paymentUrl);
    const orderCode =
      !mustGenerateNewCode && payment.orderCode
        ? payment.orderCode
        : await this.generateOrderCode();

    try {
      const link = await this.createPaymentLink({
        orderCode,
        amount: Math.round(payment.amount),
        description: `${params.descriptionPrefix}${orderCode}`,
        returnUrl: params.returnUrl,
        cancelUrl: params.cancelUrl,
        items: params.items,
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          method: 'QR',
          status: PaymentStatus.PENDING,
          orderCode,
          paymentUrl: link.checkoutUrl,
        },
      });

      return link;
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          method: 'QR',
          status: PaymentStatus.PAYMENT_ERROR,
          orderCode,
          paymentUrl: null,
        },
      });
      throw error;
    }
  }

  async markPaidByOrderCode(orderCode: number) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { orderCode },
        include: { order: true, spaBooking: true },
      });
      if (!payment) return null;

      const paidPayment =
        payment.status === PaymentStatus.PAID
          ? payment
          : await tx.payment.update({
              where: { id: payment.id },
              data: { status: PaymentStatus.PAID, paidAt: new Date() },
              include: { order: true, spaBooking: true },
            });

      if (
        payment.order &&
        ['PENDING', 'PAYMENT_ERROR'].includes(payment.order.status)
      ) {
        const updatedOrder = await tx.order.update({
          where: { id: payment.order.id },
          data: { status: 'PROCESSING' },
        });
        await this.notifications.create({
          userId: payment.order.userId,
          category: NotificationCategory.ORDER,
          eventType: NotificationEventType.ORDER_STATUS_CHANGED,
          title: 'Thanh toán đơn hàng thành công',
          content: `Đơn hàng #${updatedOrder.id.slice(-8).toUpperCase()} đang được xử lý.`,
          targetUrl: `/orders?orderId=${updatedOrder.id}`,
          entityType: 'ORDER',
          entityId: updatedOrder.id,
        }, tx);
      }

      if (
        payment.spaBooking &&
        payment.spaBooking.status !== 'COMPLETED'
      ) {
        const timeEndReal = new Date();
        const expectedEnd =
          payment.spaBooking.timeEndExpected ||
          new Date(
            payment.spaBooking.scheduledAt.getTime() + 45 * 60 * 1000,
          );
        const updatedBooking = await tx.spaBooking.update({
          where: { id: payment.spaBooking.id },
          data: {
            status: 'COMPLETED',
            timeEndReal,
            completionDiffMinutes: Math.round(
              (timeEndReal.getTime() - expectedEnd.getTime()) / 60000,
            ),
          },
        });
        await this.notifications.create({
          userId: payment.spaBooking.userId,
          category: NotificationCategory.APPOINTMENT,
          eventType: NotificationEventType.SPA_BOOKING_STATUS_CHANGED,
          title: 'Lịch Spa đã hoàn thành',
          content: `Lịch Spa của ${updatedBooking.petName || 'thú cưng'} đã hoàn thành.`,
          targetUrl: `/spa/bookings?bookingId=${updatedBooking.id}`,
          entityType: 'SPA_BOOKING',
          entityId: updatedBooking.id,
        }, tx);
      }

      return paidPayment;
    });
  }

  /**
   * Create a PayOS payment link for an order
   */
  async createPaymentLink(params: {
    orderCode: number;
    amount: number;
    description: string;
    returnUrl: string;
    cancelUrl: string;
    items?: Array<{ name: string; quantity: number; price: number }>;
  }) {
    try {
      const response = await this.payos.paymentRequests.create({
        orderCode: params.orderCode,
        amount: params.amount,
        description: params.description,
        returnUrl: params.returnUrl,
        cancelUrl: params.cancelUrl,
        items: params.items,
      });
      return response;
    } catch (error) {
      console.error('Failed to create PayOS payment link:', error);
      throw new InternalServerErrorException(
        error.message || 'Lỗi khi tạo liên kết thanh toán PayOS.',
      );
    }
  }

  /**
   * Verify webhook callback data signature from PayOS
   */
  async verifyWebhookData(body: any) {
    try {
      return await this.payos.webhooks.verify(body);
    } catch (error) {
      console.error('PayOS webhook verification failed:', error);
      return null;
    }
  }

  /**
   * Retrieve payment link details from PayOS
   */
  async getPaymentLinkInformation(orderCode: number) {
    try {
      return await this.payos.paymentRequests.get(orderCode);
    } catch (error) {
      console.error('Failed to get payment link info from PayOS:', error);
      return null;
    }
  }

}
