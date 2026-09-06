import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  SpaBookingStatus,
} from '@prisma/client';

const notRefundedPayment: Prisma.PaymentNullableScalarRelationFilter = {
  isNot: { status: PaymentStatus.REFUNDED },
};

function recognizedStoreRevenueBaseWhere(): Prisma.OrderWhereInput {
  return {
    status: OrderStatus.DELIVERED,
    payment: notRefundedPayment,
    OR: [{ refundStatus: null }, { refundStatus: { not: 'REFUNDED' } }],
  };
}

function recognizedSpaRevenueBaseWhere(): Prisma.SpaBookingWhereInput {
  return {
    status: SpaBookingStatus.COMPLETED,
    payment: notRefundedPayment,
  };
}

export function recognizedStoreRevenueWhere(
  storeId?: string,
): Prisma.OrderWhereInput {
  return {
    ...recognizedStoreRevenueBaseWhere(),
    storeId: storeId ?? '__missing__',
  };
}

export function recognizedAllStoreRevenueWhere(): Prisma.OrderWhereInput {
  return recognizedStoreRevenueBaseWhere();
}

export function recognizedSpaRevenueWhere(
  addressSpaId?: string,
): Prisma.SpaBookingWhereInput {
  return {
    ...recognizedSpaRevenueBaseWhere(),
    addressSpaId: addressSpaId ?? '__missing__',
  };
}

export function recognizedAllSpaRevenueWhere(): Prisma.SpaBookingWhereInput {
  return recognizedSpaRevenueBaseWhere();
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
