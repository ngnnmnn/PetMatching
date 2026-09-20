import { PrismaService } from '../../../common/prisma/prisma.service';
import { findConfiguredStoreId } from '../../../common/store.utils';

export class AdminStoreOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrders() {
    const storeId = await findConfiguredStoreId(this.prisma);

    return this.prisma.order.findMany({
      where: { storeId: storeId ?? '__missing__' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        customerNameSnapshot: true,
        customerEmailSnapshot: true,
        customerPhoneSnapshot: true,
        status: true,
        totalAmount: true,
        shippingFee: true,
        discountAmount: true,
        voucherCode: true,
        shippingAddress: true,
        shippingStatus: true,
        refundStatus: true,
        refundBankCode: true,
        refundAccountNumber: true,
        refundAccountName: true,
        refundReason: true,
        refundedAt: true,
        refundProofUrl: true,
        deliveryProofUrl: true,
        shippingNote: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        payment: {
          select: {
            id: true,
            method: true,
            status: true,
            amount: true,
            orderCode: true,
            paidAt: true,
            refundedAt: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                brand: true,
              },
            },
            variant: { select: { id: true, name: true } },
          },
        },
        reviews: {
          select: {
            id: true,
            productId: true,
            rating: true,
            comment: true,
            images: true,
            createdAt: true,
            variantName: true,
            product: { select: { name: true } },
            variant: { select: { name: true } },
          },
        },
      },
    });
  }
}
