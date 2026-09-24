import { PrismaService } from '../../../common/prisma/prisma.service';
import { resolveServicePriceAndDuration } from '../../spa/spa-bracket.utils';

export class AdminSpaBookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách lịch hẹn Spa cho trang quản trị Admin
   * Gắn dịch vụ chính (mainServiceResolved) và danh sách dịch vụ phụ (ưu tiên snapshot đã chốt giá)
   */
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

    return bookings.map((booking) => {
      const resolvedMain =
        (booking.mainServiceId
          ? serviceById.get(booking.mainServiceId)
          : undefined) ?? booking.service;

      const petSpecies = booking.petSpecies || booking.pet?.species || 'DOG';
      const petWeight = booking.petWeight || booking.pet?.weight || 0;

      const subServicesFromIds = booking.subServiceIds
        .map((id) => serviceById.get(id))
        .filter((service): service is NonNullable<typeof service> => service !== undefined);

      const subServices =
        Array.isArray(booking.subServicesSnapshot) &&
        booking.subServicesSnapshot.length > 0
          ? (booking.subServicesSnapshot as any[])
          : subServicesFromIds.map((s) => {
              const resolved = resolveServicePriceAndDuration(s, petSpecies, petWeight);
              return {
                ...s,
                price: resolved.price,
                duration: resolved.duration,
              };
            });

      let mainServiceResolved = resolvedMain;
      if (mainServiceResolved && typeof (mainServiceResolved as any).price !== 'number') {
        const resolved = resolveServicePriceAndDuration(mainServiceResolved, petSpecies, petWeight);
        mainServiceResolved = {
          ...mainServiceResolved,
          price: resolved.price,
          duration: resolved.duration,
        };
      }

      return {
        ...booking,
        mainServiceResolved,
        subServices,
      };
    });
  }
}
