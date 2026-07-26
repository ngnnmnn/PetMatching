import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('api/payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('check-status/:orderCode')
  async checkPaymentStatus(@Param('orderCode') orderCodeStr: string) {
    const orderCode = Number(orderCodeStr);
    if (!orderCode) {
      throw new BadRequestException('Mã đơn hàng không hợp lệ.');
    }

    const order = await this.prisma.order.findUnique({
      where: { orderCode },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
    }

    if (
      order.status === 'PROCESSING' ||
      order.status === 'SHIPPED' ||
      order.status === 'DELIVERED'
    ) {
      return { isPaid: true, status: order.status, orderId: order.id };
    }

    // Double check with PayOS API
    const paymentInfo = await this.paymentService.getPaymentLinkInformation(orderCode);
    if (paymentInfo && paymentInfo.status === 'PAID') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'PROCESSING' },
      });
      return { isPaid: true, status: 'PROCESSING', orderId: order.id };
    }

    return { isPaid: false, status: order.status, orderId: order.id };
  }

  @Post('payos-webhook')
  @HttpCode(HttpStatus.OK)
  async handlePayosWebhook(@Body() body: any) {
    const verifiedData = await this.paymentService.verifyWebhookData(body);
    if (!verifiedData) {
      throw new BadRequestException('Chữ ký webhook PayOS không hợp lệ.');
    }

    const orderCode = verifiedData.orderCode;
    const order = await this.prisma.order.findUnique({
      where: { orderCode },
    });

    if (!order) {
      console.warn(`PayOS webhook received for unknown orderCode: ${orderCode}`);
      return { success: false, message: 'Không tìm thấy đơn hàng tương ứng.' };
    }

    // Idempotent check: Only update status if the order is currently PENDING or PAYMENT_ERROR
    if (order.status !== 'PENDING' && order.status !== 'PAYMENT_ERROR') {
      console.log(
        `Order ${order.id} is already in status ${order.status}. Ignoring webhook to prevent status regression.`,
      );
      return { success: true, message: `Đơn hàng đã được xử lý (trạng thái: ${order.status}).` };
    }

    // PayOS success code is "00"
    if (body.data?.code === '00') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'PROCESSING' },
      });
      console.log(
        `Order ${order.id} (code: ${orderCode}) successfully marked as PAID/PROCESSING via webhook.`,
      );
    }

    return { success: true };
  }
}
