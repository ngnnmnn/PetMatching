import { PrismaService } from '../../../common/prisma/prisma.service';

export class AdminSpaBookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBookings() {
    const bookings = await this.prisma.spaBooking.findMany({
      orderBy: { scheduledAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        pet: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            weight: true,
            avatarUrl: true,
          },
        },
        addressSpa: {
          select: { id: true, name: true, address: true, phone: true },
        },
        category: { select: { id: true, name: true, status: true } },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            duration: true,
          },
        },
        payment: {
          select: {
            id: true,
            method: true,
            status: true,
            amount: true,
            paidAt: true,
            refundedAt: true,
          },
        },
        feedback: {
          select: {
            id: true,
            rateStaff: true,
            rateServices: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });

    const relatedServiceIds = Array.from(
      new Set(
        bookings.flatMap((booking) => [
          ...(booking.mainServiceId ? [booking.mainServiceId] : []),
          ...booking.subServiceIds,
        ]),
      ),
    );
    const relatedServices = relatedServiceIds.length
      ? await this.prisma.spaService.findMany({
          where: { id: { in: relatedServiceIds } },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            duration: true,
          },
        })
      : [];
    const serviceById = new Map(
      relatedServices.map((service) => [service.id, service]),
    );

    return bookings.map((booking) => ({
      ...booking,
      mainServiceResolved:
        (booking.mainServiceId
          ? serviceById.get(booking.mainServiceId)
          : undefined) ?? booking.service,
      subServices: booking.subServiceIds
        .map((id) => serviceById.get(id))
        .filter((service) => service !== undefined),
    }));
  }
}
