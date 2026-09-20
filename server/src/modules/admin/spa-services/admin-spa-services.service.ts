import { PrismaService } from '../../../common/prisma/prisma.service';

export class AdminSpaServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getServices() {
    const [services, mainServiceGroups, bookingsWithSubServices] =
      await Promise.all([
        this.prisma.spaService.findMany({
          orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
          include: {
            category: { select: { id: true, name: true } },
          },
        }),
        this.prisma.spaBooking.groupBy({
          by: ['serviceId'],
          where: { serviceId: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.spaBooking.findMany({
          where: { subServiceIds: { isEmpty: false } },
          select: { subServiceIds: true },
        }),
      ]);

    const bookingCountByService = new Map<string, number>();
    mainServiceGroups.forEach((group) => {
      if (group.serviceId) {
        bookingCountByService.set(group.serviceId, group._count._all);
      }
    });
    bookingsWithSubServices.forEach((booking) => {
      booking.subServiceIds.forEach((serviceId) => {
        bookingCountByService.set(
          serviceId,
          (bookingCountByService.get(serviceId) ?? 0) + 1,
        );
      });
    });

    return services.map((service) => ({
      ...service,
      _count: { bookings: bookingCountByService.get(service.id) ?? 0 },
    }));
  }
}
