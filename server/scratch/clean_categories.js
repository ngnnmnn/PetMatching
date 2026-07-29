const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const idsToDelete = [
    'brand-cat-tia',
    'brand-combo',
    'brand-massage',
    'brand-mong',
    'brand-tai-rang',
    'brand-tam-say',
  ];

  // Find a fallback category (e.g. Dịch vụ lẻ or Tắm)
  const fallbackCat = await p.spaCategory.findFirst({
    where: { id: { notIn: idsToDelete } },
  });

  if (fallbackCat) {
    // Update any services pointing to deleting categories
    const updatedServices = await p.spaService.updateMany({
      where: { categoryId: { in: idsToDelete } },
      data: { categoryId: fallbackCat.id },
    });
    console.log(`Reassigned ${updatedServices.count} services to fallback category ${fallbackCat.name} (${fallbackCat.id})`);

    // Update any bookings pointing to deleting categories
    const updatedBookings = await p.spaBooking.updateMany({
      where: { categoryId: { in: idsToDelete } },
      data: { categoryId: fallbackCat.id },
    });
    console.log(`Reassigned ${updatedBookings.count} bookings to fallback category ${fallbackCat.name} (${fallbackCat.id})`);
  }

  // Delete the 6 specified categories
  const deleted = await p.spaCategory.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  console.log(`Successfully deleted ${deleted.count} specified categories!`);

  const remaining = await p.spaCategory.findMany();
  console.log('Remaining categories count:', remaining.length);
  console.log('Remaining categories list:', remaining.map(c => ({ id: c.id, name: c.name, isMain: c.isMain })));
}

main().finally(() => p.$disconnect());
