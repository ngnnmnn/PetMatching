import { UsersService } from './users.service';

describe('UsersService order pricing', () => {
  /** Tạo service với transaction giả lập để kiểm tra toàn bộ phép tính mà không ghi database. */
  function setup() {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Khách hàng',
          email: 'customer@example.com',
          phone: '0911111111',
        }),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          name: 'Thức ăn thú cưng',
          isActive: true,
          stock: 10,
          sellingPrice: 120000,
          salePrice: 100000,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productVariant: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
      voucher: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'voucher-1',
          code: 'GIAM10K',
          type: 'FIXED',
          value: 10000,
          minOrderAmount: 0,
          maxDiscountAmount: null,
          maxUsage: null,
          usedCount: 0,
          isActive: true,
          startDate: null,
          expiredAt: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: 'store-1' }),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: data.id,
          ...data,
          payment: null,
        })),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const shippingService = {
      estimateAhamoveShippingFee: jest.fn().mockResolvedValue({ feeVnd: 30000 }),
    };
    const service = new UsersService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      shippingService as any,
    );

    return { service, tx, shippingService };
  }

  it('ignores client totals and persists prices calculated from the database', async () => {
    const { service, tx, shippingService } = setup();

    const result = await service.createOrder('user-1', {
      shippingAddress: 'Địa chỉ giao hàng',
      shippingLatitude: 21.08,
      shippingLongitude: 105.88,
      paymentMethod: 'COD',
      voucherCode: 'GIAM10K',
      items: [{ productId: 'product-1', quantity: 2 }],
      totalAmount: 1,
      shippingFee: 0,
    });

    expect(shippingService.estimateAhamoveShippingFee).toHaveBeenCalledWith(
      21.08,
      105.88,
      'Địa chỉ giao hàng',
    );
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: 220000,
          shippingFee: 30000,
          discountAmount: 10000,
          items: {
            create: [
              {
                productId: 'product-1',
                variantId: null,
                quantity: 2,
                price: 100000,
              },
            ],
          },
        }),
      }),
    );
    expect(result.totalAmount).toBe(220000);
    expect(tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stock: { gte: 2 } }),
      }),
    );
  });

  it('applies free shipping vouchers to the backend-calculated shipping fee', async () => {
    const { service, tx } = setup();
    tx.voucher.findUnique.mockResolvedValue({
      id: 'voucher-ship',
      code: 'FREESHIP',
      type: 'FREE_SHIP',
      value: 100,
      minOrderAmount: 0,
      maxDiscountAmount: null,
      maxUsage: null,
      usedCount: 0,
      isActive: true,
      startDate: null,
      expiredAt: null,
    });

    const result = await service.createOrder('user-1', {
      shippingAddress: 'Địa chỉ giao hàng',
      paymentMethod: 'COD',
      voucherCode: 'FREESHIP',
      items: [{ productId: 'product-1', quantity: 2 }],
    });

    expect(result.shippingFee).toBe(30000);
    expect(result.discountAmount).toBe(30000);
    expect(result.totalAmount).toBe(200000);
  });

  it('automatically waives shipping for a subtotal above 500,000 VND', async () => {
    const { service } = setup();

    const result = await service.createOrder('user-1', {
      shippingAddress: 'Địa chỉ giao hàng',
      paymentMethod: 'COD',
      items: [{ productId: 'product-1', quantity: 6 }],
    });

    expect(result.shippingFee).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.totalAmount).toBe(600000);
  });
});
