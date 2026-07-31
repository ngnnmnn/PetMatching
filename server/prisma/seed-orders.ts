import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found for seeding addresses and orders.');
    return;
  }

  const products = await prisma.product.findMany({ take: 3 });
  if (products.length === 0) {
    console.log('No products found. Run seed-products first.');
    return;
  }

  console.log(`Seeding addresses and orders for user: ${user.email}`);

  await prisma.address.deleteMany({ where: { userId: user.id } });
  await prisma.address.create({
    data: {
      userId: user.id,
      receiverName: user.name,
      receiverPhone: user.phone || '0987654321',
      province: 'Ha Noi',
      district: 'Cau Giay',
      ward: 'Dich Vong Hau',
      detail: 'So 12 ngo 81 Duy Tan',
      isDefault: true,
    },
  });

  await prisma.order.deleteMany({ where: { userId: user.id } });

  const statuses = [
    OrderStatus.DELIVERED,
    OrderStatus.PROCESSING,
    OrderStatus.PENDING,
  ];

  for (const [index, product] of products.entries()) {
    const quantity = index + 1;
    const price = product.salePrice ?? product.sellingPrice;

    await prisma.order.create({
      data: {
        userId: user.id,
        status: statuses[index] ?? OrderStatus.PENDING,
        totalAmount: price * quantity,
        shippingAddress: 'So 12 ngo 81 Duy Tan, Dich Vong Hau, Cau Giay, Ha Noi',
        items: {
          create: {
            productId: product.id,
            quantity,
            price,
          },
        },
      },
    });
  }

  console.log('Seed orders and addresses completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
