import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Controller('api/payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

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
