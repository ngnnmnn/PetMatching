import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PayOS } from '@payos/node';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
  private payos: PayOS;

  constructor() {
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

  /**
   * Create a payout request (Chi hộ) via PayOS
   */
  async createPayout(params: {
    referenceId: string;
    amount: number;
    description: string;
    toBin: string;
    toAccountNumber: string;
  }) {
    try {
      const payoutClientId = process.env.PAYOS_PAYOUT_CLIENT_ID;
      const payoutApiKey = process.env.PAYOS_PAYOUT_API_KEY;
      const payoutChecksumKey = process.env.PAYOS_PAYOUT_CHECKSUM_KEY;

      if (!payoutClientId || !payoutApiKey || !payoutChecksumKey) {
        throw new Error('Cấu hình Kênh chi PayOS chưa đầy đủ trong file .env');
      }

      const { referenceId, amount, description, toBin, toAccountNumber } =
        params;

      // Signature raw string order: amount=$amount&description=$description&referenceId=$referenceId&toAccountNumber=$toAccountNumber&toBin=$toBin
      const rawSignature = `amount=${amount}&description=${description}&referenceId=${referenceId}&toAccountNumber=${toAccountNumber}&toBin=${toBin}`;
      const signature = crypto
        .createHmac('sha256', payoutChecksumKey)
        .update(rawSignature)
        .digest('hex');

      const response = await fetch('https://api-merchant.payos.vn/v1/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': payoutClientId,
          'x-api-key': payoutApiKey,
          'x-signature': signature,
          'x-idempotency-key': `idemp_${referenceId}_${Date.now()}`,
        },
        body: JSON.stringify({
          referenceId,
          amount,
          description,
          toBin,
          toAccountNumber,
        }),
      });

      const data = await response.json();
      if (data.code !== '00') {
        throw new Error(
          `PayOS Payout error: ${data.desc} (code: ${data.code})`,
        );
      }
      return data.data;
    } catch (error) {
      console.error('Failed to create PayOS payout:', error);
      throw new InternalServerErrorException(
        error.message || 'Lỗi khi tạo yêu cầu chi hộ qua PayOS.',
      );
    }
  }
}
