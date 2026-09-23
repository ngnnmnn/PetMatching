import { OrderStatus, PaymentStatus, SpaBookingStatus } from '@prisma/client';
import {
  fulfilledStoreOrderWhere,
  getSpaBookingRevenue,
  getSpaRevenueAllocations,
  isRecognizedSpaBooking,
  recognizedSpaRevenueWhere,
  recognizedStoreRevenueWhere,
} from './revenue.utils';

describe('revenue utils', () => {
  it('scopes store revenue to delivered and paid orders', () => {
    expect(recognizedStoreRevenueWhere('store-1')).toEqual({
      storeId: 'store-1',
      status: OrderStatus.DELIVERED,
      payment: { is: { status: PaymentStatus.PAID } },
      OR: [{ refundStatus: null }, { refundStatus: { not: 'REFUNDED' } }],
    });
    expect(fulfilledStoreOrderWhere('store-1')).toEqual({
      storeId: 'store-1',
      status: OrderStatus.DELIVERED,
      OR: [{ refundStatus: null }, { refundStatus: { not: 'REFUNDED' } }],
    });
  });

  it('scopes spa revenue to completed and paid bookings', () => {
    expect(recognizedSpaRevenueWhere('spa-1')).toEqual({
      addressSpaId: 'spa-1',
      status: SpaBookingStatus.COMPLETED,
      payment: { is: { status: PaymentStatus.PAID } },
    });
  });

  it('recognizes only completed paid bookings', () => {
    expect(
      isRecognizedSpaBooking({
        status: SpaBookingStatus.COMPLETED,
        payment: { status: PaymentStatus.PENDING },
      }),
    ).toBe(false);
    expect(
      isRecognizedSpaBooking({
        status: SpaBookingStatus.COMPLETED,
        payment: { status: PaymentStatus.PAID },
      }),
    ).toBe(true);
    expect(
      isRecognizedSpaBooking({
        status: SpaBookingStatus.COMPLETED,
        payment: { status: PaymentStatus.REFUNDED },
      }),
    ).toBe(false);
    expect(
      isRecognizedSpaBooking({
        status: SpaBookingStatus.IN_PROGRESS,
        payment: { status: PaymentStatus.PAID },
      }),
    ).toBe(false);
  });

  it('uses the legacy snapshot only when totalPrice is zero', () => {
    expect(
      getSpaBookingRevenue({ totalPrice: 120_000, priceSnapshot: 90_000 }),
    ).toBe(120_000);
    expect(getSpaBookingRevenue({ totalPrice: 0, priceSnapshot: 90_000 })).toBe(
      90_000,
    );
  });

  it('allocates the full booking revenue to main and add-on services', () => {
    expect(
      getSpaRevenueAllocations({
        serviceId: 'main-1',
        subServiceIds: ['extra-1', 'extra-2'],
        subServicesSnapshot: [
          { id: 'extra-1', price: 20_000 },
          { id: 'extra-2', price: 30_000 },
        ],
        priceSnapshot: 100_000,
        totalPrice: 150_000,
      }),
    ).toEqual([
      { serviceId: 'main-1', revenue: 100_000 },
      { serviceId: 'extra-1', revenue: 20_000 },
      { serviceId: 'extra-2', revenue: 30_000 },
    ]);
    expect(
      getSpaRevenueAllocations({
        subServiceIds: ['extra-1'],
        priceSnapshot: 30_000,
        totalPrice: 30_000,
      }),
    ).toEqual([{ serviceId: 'extra-1', revenue: 30_000 }]);
  });
});
