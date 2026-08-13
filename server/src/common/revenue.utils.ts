import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  SpaBookingStatus,
} from '@prisma/client';

const notRefundedPayment: Prisma.PaymentNullableScalarRelationFilter = {
  isNot: { status: PaymentStatus.REFUNDED },
};

export function recognizedStoreRevenueWhere(
  storeId?: string,
): Prisma.OrderWhereInput {
  return {
    storeId: storeId ?? '__missing__',
    status: OrderStatus.DELIVERED,
    payment: notRefundedPayment,
    OR: [{ refundStatus: null }, { refundStatus: { not: 'REFUNDED' } }],
  };
}

export function recognizedSpaRevenueWhere(
  addressSpaId?: string,
): Prisma.SpaBookingWhereInput {
  return {
    addressSpaId: addressSpaId ?? '__missing__',
    status: SpaBookingStatus.COMPLETED,
    payment: notRefundedPayment,
  };
}

export function isRecognizedSpaBooking(booking: {
  status: SpaBookingStatus;
  payment?: { status: PaymentStatus } | null;
}): boolean {
  return (
    booking.status === SpaBookingStatus.COMPLETED &&
    booking.payment?.status !== PaymentStatus.REFUNDED
  );
}

export function getSpaBookingRevenue(booking: {
  totalPrice: number;
  priceSnapshot?: number | null;
}): number {
  return booking.totalPrice > 0
    ? booking.totalPrice
    : (booking.priceSnapshot ?? 0);
}
