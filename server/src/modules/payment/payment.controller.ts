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

    const payment = await this.prisma.payment.findUnique({
      where: { orderCode },
      include: { order: true, spaBooking: true },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch.');
    }

    const referenceId = payment.orderId || payment.spaBookingId;
    if (payment.status === 'PAID') {
      return { isPaid: true, status: payment.status, orderId: referenceId };
    }

    // Double check with PayOS API
    const paymentInfo =
      await this.paymentService.getPaymentLinkInformation(orderCode);
    if (paymentInfo && paymentInfo.status === 'PAID') {
      await this.paymentService.markPaidByOrderCode(orderCode);
      return { isPaid: true, status: 'PAID', orderId: referenceId };
    }

    return { isPaid: false, status: payment.status, orderId: referenceId };
  }

  @Post('payos-webhook')
  @HttpCode(HttpStatus.OK)
  async handlePayosWebhook(@Body() body: any) {
    const verifiedData = await this.paymentService.verifyWebhookData(body);
    if (!verifiedData) {
      throw new BadRequestException('Chữ ký webhook PayOS không hợp lệ.');
    }

    const orderCode = verifiedData.orderCode;
    const payment = await this.prisma.payment.findUnique({
      where: { orderCode },
    });

    if (!payment) {
      console.warn(
        `PayOS webhook received for unknown payment code: ${orderCode}`,
      );
      return { success: false, message: 'Không tìm thấy giao dịch tương ứng.' };
    }

    if (payment.status === 'PAID') {
      console.log(
        `Payment ${payment.id} is already paid. Ignoring duplicate webhook.`,
      );
      return {
        success: true,
        message: 'Giao dịch đã được xử lý.',
      };
    }

    // PayOS success code is "00"
    const isSuccess = body.data?.code === '00' || verifiedData.code === '00';
    const isCancelled =
      body.data?.code === '01' ||
      verifiedData.code === '01' ||
      body.data?.status === 'CANCELLED' ||
      (verifiedData as any).status === 'CANCELLED';

    if (isSuccess) {
      await this.paymentService.markPaidByOrderCode(orderCode);
      console.log(
        `Payment ${payment.id} (code: ${orderCode}) marked as PAID via webhook.`,
      );
    } else if (isCancelled) {
      await this.paymentService.markCancelledByOrderCode(orderCode, 'CANCELLED');
      console.log(
        `Payment ${payment.id} (code: ${orderCode}) marked as CANCELLED via webhook.`,
      );
    }

    return { success: true };
  }
}
