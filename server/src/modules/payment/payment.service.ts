import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PayOS } from '@payos/node';

@Injectable()
export class PaymentService {
  private payos: PayOS;

  constructor() {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
      console.error('PAYOS credentials are not fully configured in environment variables.');
    }

    this.payos = new PayOS({
      clientId: clientId || '',
      apiKey: apiKey || '',
      checksumKey: checksumKey || '',
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
