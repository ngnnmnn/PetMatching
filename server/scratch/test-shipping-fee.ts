import { PrismaClient } from '@prisma/client';
import { ShippingService } from '../src/modules/shipping/shipping.service';

const prisma = new PrismaClient();
const shippingService = new ShippingService(prisma as any);

async function main() {
  console.log('Testing calculateShippingFee...');
  try {
    const res = await shippingService.calculateShippingFee({
      toDistrictId: 1442,
      toWardCode: '20101',
    });
    console.log('Success Result:', res);
  } catch (err: any) {
    console.error('Error occurred:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
