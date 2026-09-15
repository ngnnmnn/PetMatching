import { ShippingService } from './shipping.service';

describe('ShippingService', () => {
  const prisma = {
    store: { findFirst: jest.fn() },
    order: { findUnique: jest.fn(), update: jest.fn() },
  };
  const shippingSimulator = { startSimulation: jest.fn() };
  const service = new ShippingService(prisma as any, shippingSimulator as any);
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('returns the 126 local Hanoi wards with unique official codes', () => {
    const wards = service.getWards(1);

    expect(wards).toHaveLength(126);
    expect(new Set(wards.map(({ wardCode }) => wardCode)).size).toBe(126);
    expect(wards).toContainEqual({
      wardCode: '70',
      wardName: 'Phường Hoàn Kiếm',
    });
  });

  it('does not return Hanoi wards for another province code', () => {
    expect(service.getWards(79)).toEqual([]);
  });

  it('uses the Admin-configured Store as the AhaMove estimate pickup', async () => {
    prisma.store.findFirst.mockResolvedValue({
      name: 'PetMatching',
      phone: '0900000000',
      address: '123 Đường Store, Hà Nội',
      latitude: 21.01,
      longitude: 105.81,
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ token: 'token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total_price: 42000 }),
      }) as jest.Mock;

    const result = await service.estimateAhamoveShippingFee(
      21.08,
      105.88,
      '456 Đường Khách, Hà Nội',
    );

    const estimateRequest = (global.fetch as jest.Mock).mock.calls[1][1];
    const body = JSON.parse(estimateRequest.body);
    expect(body.path).toEqual([
      {
        address: '123 Đường Store, Hà Nội',
        lat: 21.01,
        lng: 105.81,
      },
      {
        address: '456 Đường Khách, Hà Nội',
        lat: 21.08,
        lng: 105.88,
      },
    ]);
    expect(result.feeVnd).toBe(42000);
    expect(result.isRealAhamoveFee).toBe(true);
  });

  it('uses the Order shipping snapshot when creating an AhaMove order', async () => {
    prisma.store.findFirst.mockResolvedValue({
      name: 'PetMatching',
      phone: '0900000000',
      address: '123 Đường Store, Hà Nội',
      latitude: 21.01,
      longitude: 105.81,
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'PM-TEST',
      ahamoveOrderCode: null,
      shippingAddress:
        'Tên: Khách | SĐT: 0911111111 | Địa chỉ: 456 Đường Khách, Hà Nội',
      shippingLatitude: 21.08,
      shippingLongitude: 105.88,
      totalAmount: 100000,
      customerNameSnapshot: 'Khách',
      customerPhoneSnapshot: '0911111111',
      user: null,
      payment: null,
      items: [],
    });
    prisma.order.update.mockResolvedValue({ id: 'PM-TEST' });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ token: 'token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order_id: 'AHA-TEST' }),
      }) as jest.Mock;

    await service.createAhamoveShippingOrder('PM-TEST');

    const createRequest = (global.fetch as jest.Mock).mock.calls[1][1];
    const body = JSON.parse(createRequest.body);
    expect(body.path[0]).toMatchObject({ lat: 21.01, lng: 105.81 });
    expect(body.path[1]).toMatchObject({ lat: 21.08, lng: 105.88 });
  });
});
