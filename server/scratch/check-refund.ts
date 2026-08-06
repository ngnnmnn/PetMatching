import { PrismaClient } from '@prisma/client';
import { ManagerService } from '../src/modules/manager/manager.service';
import { PaymentService } from '../src/modules/payment/payment.service';

const prisma = new PrismaClient();
const paymentService = new PaymentService();
const managerService = new ManagerService(
  prisma as any,
  {} as any,
  paymentService,
  {} as any
);

async function main() {
  console.log('Finding any order to test refund approval/rejection...');
  try {
    const orders = await prisma.order.findMany({
      take: 1,
    });
    
    if (orders.length === 0) {
      console.log('No orders found at all in the database.');
      return;
    }
    
    const testOrder = orders[0];
    console.log(`Using order ID ${testOrder.id} for testing.`);
    
    // Set to PENDING refund status
    await prisma.order.update({
      where: { id: testOrder.id },
      data: {
        refundStatus: 'PENDING',
        refundBankCode: '970415', // VietinBank BIN
        refundAccountNumber: '1023456789',
        refundAccountName: 'TEST OWNER',
        refundReason: 'Testing refund errors',
      },
    });
    console.log('Order status prepared as PENDING.');

    // 1. Test approveRefund
    console.log('Testing approveRefund...');
    try {
      const result = await managerService.approveRefund(testOrder.id);
      console.log('Approve Refund Success:', result);
    } catch (approveErr: any) {
      console.error('Approve Refund Failed with error:');
      console.error(approveErr);
    }

    // Reset to PENDING for rejectRefund test
    await prisma.order.update({
      where: { id: testOrder.id },
      data: {
        refundStatus: 'PENDING',
      },
    });

    // 2. Test rejectRefund
    console.log('Testing rejectRefund...');
    try {
      const result = await managerService.rejectRefund(testOrder.id);
      console.log('Reject Refund Success:', result);
    } catch (rejectErr: any) {
      console.error('Reject Refund Failed with error:');
      console.error(rejectErr);
    }

    // Restore original status
    await prisma.order.update({
      where: { id: testOrder.id },
      data: {
        status: testOrder.status,
        refundStatus: testOrder.refundStatus,
        refundBankCode: testOrder.refundBankCode,
        refundAccountNumber: testOrder.refundAccountNumber,
        refundAccountName: testOrder.refundAccountName,
        refundReason: testOrder.refundReason,
      },
    });
    console.log('Test completed and original order state restored.');
  } catch (error: any) {
    console.error('Test script crashed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
