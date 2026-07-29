const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const categories = await p.spaCategory.findMany({
    include: {
      services: true,
      bookings: true,
      _count: { select: { services: true, bookings: true } },
    },
  });

  console.log('=== CATEGORIES COUNT SUMMARY ===');
  for (const c of categories) {
    const serviceIds = c.services.map(s => s.id);

    // Bookings that match main service or sub-services or categoryId
    const actualBookings = serviceIds.length > 0 ? await p.spaBooking.findMany({
      where: {
        OR: [
          { categoryId: c.id },
          { serviceId: { in: serviceIds } },
          { subServiceIds: { hasSome: serviceIds } },
        ],
      },
    }) : [];

    console.log(`Category: "${c.name}" (ID: ${c.id})`);
    console.log(`  - Services in DB: ${c.services.length} (_count.services = ${c._count.services})`);
    console.log(`  - Direct bookings on categoryId: ${c.bookings.length} (_count.bookings = ${c._count.bookings})`);
    console.log(`  - Actual bookings matching services: ${actualBookings.length}`);
    console.log('---');
  }

  // Also check total services and bookings in system
  const totalServices = await p.spaService.count();
  const totalBookings = await p.spaBooking.count();
  console.log(`TOTAL Services in DB: ${totalServices}`);
  console.log(`TOTAL Bookings in DB: ${totalBookings}`);
}

main().finally(() => p.$disconnect());
