import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/modules/users/users.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const prisma = app.get(PrismaService);

  const userId = 'cmruvipsl0000vjlw60dji1pn';
  const productId = '637852'; // Whiskas

  console.log('--- STARTING VERIFICATION TEST ---');

  try {
    // 1. Get initial stock of Whiskas
    const initialProduct = await prisma.product.findUnique({
      where: { id: productId },
    });
    const initialStock = initialProduct?.stock || 0;
    console.log(`Initial stock of Whiskas (ID: ${productId}):`, initialStock);

    if (initialStock < 5) {
      // Top up stock for testing
      await prisma.product.update({
        where: { id: productId },
        data: { stock: 10 },
      });
      console.log('Topped up Whiskas stock to 10 for testing.');
    }

    const currentProduct = await prisma.product.findUnique({ where: { id: productId } });
    const currentStock = currentProduct?.stock || 0;

    // 2. Create a pending QR order manually using UsersService to simulate check out
    console.log('Simulating order creation...');
    const order = await usersService.createOrder(userId, {
      totalAmount: 170000,
      shippingFee: 30000,
      shippingAddress: 'Test Address, Cát Linh, Đống Đa, Hà Nội',
      districtId: 1442,
      wardCode: '20101',
      paymentMethod: 'QR',
      items: [
        {
          productId: productId,
          quantity: 2,
          price: 85000,
        },
      ],
    });

    console.log(`Created order: ID = ${order.id}, Status = ${order.status}, Code = ${order.orderCode}`);

    // Check stock after order creation
    const productAfterOrder = await prisma.product.findUnique({
      where: { id: productId },
    });
    const stockAfterOrder = productAfterOrder?.stock || 0;
    console.log(`Stock after order creation:`, stockAfterOrder);
    
    // Expect stock to have decremented by 2
    if (stockAfterOrder !== currentStock - 2) {
      throw new Error(`Stock decrement failed! Expected ${currentStock - 2}, got ${stockAfterOrder}`);
    }
    console.log('✅ Stock decremented correctly by 2.');

    // 3. Cancel the QR order via usersService.cancelOrder
    console.log('Simulating QR order cancellation...');
    await usersService.cancelOrder(userId, order.id);
    console.log('Order cancelled successfully.');

    // Verify order is deleted (since it is QR and cancelled, it should be deleted from DB)
    const orderCheck = await prisma.order.findUnique({
      where: { id: order.id },
    });
    if (orderCheck) {
      throw new Error('Order was not deleted from database after QR cancellation!');
    }
    console.log('✅ QR Order deleted from database correctly.');

    // Verify stock is restored
    const productAfterCancel = await prisma.product.findUnique({
      where: { id: productId },
    });
    const stockAfterCancel = productAfterCancel?.stock || 0;
    console.log(`Stock after cancellation:`, stockAfterCancel);
    if (stockAfterCancel !== currentStock) {
      throw new Error(`Stock restoration failed! Expected ${currentStock}, got ${stockAfterCancel}`);
    }
    console.log('✅ Stock restored back to initial level correctly.');

    console.log('--- VERIFICATION TEST PASSED SUCCESSFULLY ---');
  } catch (error) {
    console.error('❌ Verification test failed with error:', error);
  } finally {
    await app.close();
  }
}

main();
