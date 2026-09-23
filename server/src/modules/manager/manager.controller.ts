import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  Query,
  Res,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ManagerGuard } from '../../common/auth/manager.guard';
import type { Response } from 'express';
import type {
  CreateManagerProductInput,
  ManagerProductVariantInput,
  UpdateManagerProductInput,
} from './dto/manager-product-input';
import { ManagerService } from './manager.service';

@UseGuards(JwtAuthGuard, ManagerGuard)
@Controller('api/manager')
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  @Get('dashboard-stats')
  getDashboardStats(
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.managerService.getDashboardStats({ range, from, to });
  }

  @Get('activity-snapshot')
  getActivitySnapshot() {
    return this.managerService.getActivitySnapshot();
  }

  @Get('products')
  getProducts() {
    return this.managerService.getProducts();
  }

  @Post('products')
  createProduct(@Body() dto: CreateManagerProductInput) {
    return this.managerService.createProduct(dto);
  }

  @Post('products/import')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'file', maxCount: 1 }, { name: 'images' }], {
      storage: memoryStorage(),
      limits: { fileSize: 30 * 1024 * 1024 }, // Up to 30MB
    }),
  )
  importProducts(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
  ) {
    const excelFile = files?.file?.[0];
    const imageFiles = files?.images || [];
    return this.managerService.importProducts(
      excelFile as Express.Multer.File,
      imageFiles,
    );
  }

  @Put('products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateManagerProductInput,
  ) {
    return this.managerService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.managerService.deleteProduct(id);
  }

  @Get('orders/export')
  async exportOrders(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('onlyRefunded') onlyRefunded?: string,
  ) {
    const buffer = await this.managerService.exportOrdersToExcel({
      startDate,
      endDate,
      onlyRefunded: onlyRefunded === 'true',
    });
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="orders_export.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('orders')
  getOrders() {
    return this.managerService.getOrders();
  }

  @Post('orders/upload-refund-proof')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    }),
  )
  uploadRefundProof(@UploadedFile() file: Express.Multer.File) {
    return this.managerService.uploadRefundProof(file);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @Body()
    dto: { status: string; deliveryProofUrl?: string; shippingNote?: string },
  ) {
    return this.managerService.updateOrderStatus(
      id,
      dto.status,
      dto.deliveryProofUrl,
      dto.shippingNote,
    );
  }

  @Get('customers')
  getCustomers() {
    return this.managerService.getCustomers();
  }

  @Post('categories')
  createCategory(@Body() dto: { name: string }) {
    return this.managerService.createCategory(dto);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: { name: string }) {
    return this.managerService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.managerService.deleteCategory(id);
  }

  @Post('orders/:id/approve-refund')
  approveRefund(
    @Param('id') id: string,
    @Body() dto?: { refundProofUrl?: string },
  ) {
    return this.managerService.approveRefund(id, dto?.refundProofUrl);
  }

  @Post('orders/:id/reject-refund')
  rejectRefund(@Param('id') id: string) {
    return this.managerService.rejectRefund(id);
  }

  @Patch('orders/:id/refund-proof')
  updateRefundProof(
    @Param('id') id: string,
    @Body() dto: { refundProofUrl: string },
  ) {
    return this.managerService.updateRefundProof(id, dto.refundProofUrl);
  }

  @Get('products/:productId/variants')
  getProductVariants(@Param('productId') productId: string) {
    return this.managerService.getProductVariants(productId);
  }

  @Post('products/:productId/variants')
  createProductVariant(
    @Param('productId') productId: string,
    @Body() dto: ManagerProductVariantInput,
  ) {
    return this.managerService.createProductVariant(productId, dto);
  }

  @Put('variants/:variantId')
  updateProductVariant(
    @Param('variantId') variantId: string,
    @Body() dto: ManagerProductVariantInput,
  ) {
    return this.managerService.updateProductVariant(variantId, dto);
  }

  @Delete('variants/:variantId')
  deleteProductVariant(@Param('variantId') variantId: string) {
    return this.managerService.deleteProductVariant(variantId);
  }
}
