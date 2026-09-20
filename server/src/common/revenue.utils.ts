import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  SpaBookingStatus,
} from '@prisma/client';

const paidPayment: Prisma.PaymentNullableScalarRelationFilter = {
  is: { status: PaymentStatus.PAID },
};

function fulfilledStoreOrderBaseWhere(): Prisma.OrderWhereInput {
  return {
    status: OrderStatus.DELIVERED,
    OR: [{ refundStatus: null }, { refundStatus: { not: 'REFUNDED' } }],
  };
}

function recognizedStoreRevenueBaseWhere(): Prisma.OrderWhereInput {
  return {
    ...fulfilledStoreOrderBaseWhere(),
    payment: paidPayment,
  };
}

function recognizedSpaRevenueBaseWhere(): Prisma.SpaBookingWhereInput {
  return {
    status: SpaBookingStatus.COMPLETED,
    payment: paidPayment,
  };
}

export function fulfilledStoreOrderWhere(
  storeId?: string,
): Prisma.OrderWhereInput {
  return {
    ...fulfilledStoreOrderBaseWhere(),
    storeId: storeId ?? '__missing__',
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

export function recognizedSpaRevenueWhere(
  addressSpaId?: string,
): Prisma.SpaBookingWhereInput {
  return {
    ...recognizedSpaRevenueBaseWhere(),
    addressSpaId: addressSpaId ?? '__missing__',
  };
}

export function isRecognizedSpaBooking(booking: {
  status: SpaBookingStatus;
  payment?: { status: PaymentStatus } | null;
}): boolean {
  return (
    booking.status === SpaBookingStatus.COMPLETED &&
    booking.payment?.status === PaymentStatus.PAID
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

type SpaRevenueBooking = {
  serviceId?: string | null;
  mainServiceId?: string | null;
  subServiceIds?: string[];
  subServicesSnapshot?: unknown;
  totalPrice: number;
  priceSnapshot?: number | null;
};

export type SpaRevenueAllocation = { serviceId: string; revenue: number };

function allocateRevenue(
  total: number,
  serviceIds: string[],
  snapshot: unknown,
): SpaRevenueAllocation[] {
  if (serviceIds.length === 0 || total <= 0) return [];
  const snapshotPrices = new Map<string, number>();
  if (Array.isArray(snapshot)) {
    snapshot.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const { id, price } = item as { id?: unknown; price?: unknown };
      if (typeof id === 'string' && Number(price) > 0) {
        snapshotPrices.set(id, Number(price));
      }
    });
  }
  const weights = serviceIds.map((id) => snapshotPrices.get(id) ?? 1);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let allocated = 0;
  return serviceIds.map((serviceId, index) => {
    const revenue =
      index === serviceIds.length - 1
        ? total - allocated
        : Math.round((total * weights[index]) / weightTotal);
    allocated += revenue;
    return { serviceId, revenue };
  });
}

/** Splits one paid Spa booking without losing or double-counting its revenue. */
export function getSpaRevenueAllocations(
  booking: SpaRevenueBooking,
): SpaRevenueAllocation[] {
  const total = getSpaBookingRevenue(booking);
  const mainServiceId = booking.serviceId ?? booking.mainServiceId;
  const subServiceIds = Array.from(new Set(booking.subServiceIds ?? [])).filter(
    (serviceId) => serviceId !== mainServiceId,
  );

  if (!mainServiceId) {
    return allocateRevenue(total, subServiceIds, booking.subServicesSnapshot);
  }
  if (subServiceIds.length === 0) {
    return [{ serviceId: mainServiceId, revenue: total }];
  }

  const mainRevenue = Math.min(
    total,
    Math.max(0, booking.priceSnapshot ?? total),
  );
  return [
    { serviceId: mainServiceId, revenue: mainRevenue },
    ...allocateRevenue(
      total - mainRevenue,
      subServiceIds,
      booking.subServicesSnapshot,
    ),
  ];
}
