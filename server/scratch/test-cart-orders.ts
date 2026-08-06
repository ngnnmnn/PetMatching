import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const userId = 'cmruvipsl0000vjlw60dji1pn';
  console.log('Querying cart and orders for user:', userId);

  try {
    const cart = await prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });
    console.log('Cart Items:', cart.map(c => ({ id: c.id, productId: c.productId, name: c.product.name, quantity: c.quantity })));

    const orders = await prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    for (const order of orders) {
      console.log(`Order ID: ${order.id}, Status: ${order.status}, Method: ${order.paymentMethod}`);
      console.log('Order Items:', order.items.map(i => ({ productId: i.productId, name: i.product.name, quantity: i.quantity })));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
