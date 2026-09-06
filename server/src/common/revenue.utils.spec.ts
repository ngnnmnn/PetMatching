import { OrderStatus, PaymentStatus, SpaBookingStatus } from '@prisma/client';
import {
  getSpaBookingRevenue,
  isRecognizedSpaBooking,
  recognizedAllSpaRevenueWhere,
  recognizedAllStoreRevenueWhere,
  recognizedSpaRevenueWhere,
  recognizedStoreRevenueWhere,
} from './revenue.utils';

describe('revenue utils', () => {
  it('scopes store revenue to delivered, non-refunded orders', () => {
    expect(recognizedStoreRevenueWhere('store-1')).toEqual({
      storeId: 'store-1',
      status: OrderStatus.DELIVERED,
      payment: { isNot: { status: PaymentStatus.REFUNDED } },
      OR: [{ refundStatus: null }, { refundStatus: { not: 'REFUNDED' } }],
    });
  });

  it('scopes spa revenue to completed, non-refunded bookings', () => {
    expect(recognizedSpaRevenueWhere('spa-1')).toEqual({
      addressSpaId: 'spa-1',
      status: SpaBookingStatus.COMPLETED,
      payment: { isNot: { status: PaymentStatus.REFUNDED } },
    });
  });

  it('can recognize revenue across every store and spa branch', () => {
    expect(recognizedAllStoreRevenueWhere()).toEqual({
      status: OrderStatus.DELIVERED,
      payment: { isNot: { status: PaymentStatus.REFUNDED } },
      OR: [{ refundStatus: null }, { refundStatus: { not: 'REFUNDED' } }],
    });
    expect(recognizedAllSpaRevenueWhere()).toEqual({
      status: SpaBookingStatus.COMPLETED,
      payment: { isNot: { status: PaymentStatus.REFUNDED } },
    });
  });

  it('recognizes completed unpaid bookings but excludes refunds', () => {
    expect(
      isRecognizedSpaBooking({
        status: SpaBookingStatus.COMPLETED,
        payment: { status: PaymentStatus.PENDING },
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
});
