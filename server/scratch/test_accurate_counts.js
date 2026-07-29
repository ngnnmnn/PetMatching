const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function testCounts() {
  const allBookings = await p.spaBooking.findMany({
    select: { id: true, serviceId: true, subServiceIds: true, categoryId: true },
  });

  // Calculate booking count per service ID
  const serviceBookingCounts = {};
  for (const b of allBookings) {
    if (b.serviceId) {
      serviceBookingCounts[b.serviceId] = (serviceBookingCounts[b.serviceId] || 0) + 1;
    }
    if (Array.isArray(b.subServiceIds)) {
      for (const subId of b.subServiceIds) {
        serviceBookingCounts[subId] = (serviceBookingCounts[subId] || 0) + 1;
      }
    }
  }

  // Get categories with dynamic calculations
  const categories = await p.spaCategory.findMany({
    include: {
      services: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('=== ACCURATE CATEGORY COUNTS ===');
  for (const c of categories) {
    const serviceIds = c.services.map(s => s.id);
    let totalBookings = 0;
    for (const b of allBookings) {
      const isDirectCat = b.categoryId === c.id;
      const isMainServiceInCat = b.serviceId && serviceIds.includes(b.serviceId);
      const isSubServiceInCat = Array.isArray(b.subServiceIds) && b.subServiceIds.some(id => serviceIds.includes(id));
      if (isDirectCat || isMainServiceInCat || isSubServiceInCat) {
        totalBookings++;
      }
    }
    console.log(`Category "${c.name}": ${c.services.length} dịch vụ, ${totalBookings} lượt đặt`);
  }
}

testCounts().finally(() => p.$disconnect());
