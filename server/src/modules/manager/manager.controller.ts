import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Query,
  Res,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ManagerGuard } from '../../common/auth/manager.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import { Response } from 'express';
import { ManagerService } from './manager.service';

@UseGuards(JwtAuthGuard, ManagerGuard)
@Controller('api/manager')
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  @Get('dashboard-stats')
  getDashboardStats() {
    return this.managerService.getDashboardStats();
  }

  @Get('products')
  getProducts() {
    return this.managerService.getProducts();
  }

  @Post('products')
  createProduct(@Body() dto: any) {
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
  updateProduct(@Param('id') id: string, @Body() dto: any) {
    return this.managerService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.managerService.deleteProduct(id);
  }

  @Get('orders/export')
  async exportOrders(
    @Res() res: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('onlyPendingGhn') onlyPendingGhn?: string,
    @Query('onlyRefunded') onlyRefunded?: string,
  ) {
    const buffer = await this.managerService.exportOrdersToExcel({
      startDate,
      endDate,
      onlyPendingGhn: onlyPendingGhn === 'true',
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

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.managerService.updateOrderStatus(id, status);
  }

  @Get('customers')
  getCustomers() {
    return this.managerService.getCustomers();
  }

  @Get('store-settings')
  getStoreSettings(@Req() req: AuthenticatedRequest) {
    return this.managerService.getOrCreateStore(req.user.id);
  }

  @Put('store-settings')
  updateStoreSettings(@Req() req: AuthenticatedRequest, @Body() dto: any) {
    return this.managerService.updateStoreSettings(req.user.id, dto);
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

  @Get('units')
  getProductUnits() {
    return this.managerService.getProductUnits();
  }

  @Post('units')
  createProductUnit(@Body() dto: { name: string }) {
    return this.managerService.createProductUnit(dto);
  }

  @Put('units/:id')
  updateProductUnit(@Param('id') id: string, @Body() dto: { name: string }) {
    return this.managerService.updateProductUnit(id, dto);
  }

  @Delete('units/:id')
  deleteProductUnit(@Param('id') id: string) {
    return this.managerService.deleteProductUnit(id);
  }

  @Post('orders/:id/approve-refund')
  approveRefund(@Param('id') id: string) {
    return this.managerService.approveRefund(id);
  }

  @Post('orders/:id/reject-refund')
  rejectRefund(@Param('id') id: string) {
    return this.managerService.rejectRefund(id);
  }

  @Get('products/:productId/variants')
  getProductVariants(@Param('productId') productId: string) {
    return this.managerService.getProductVariants(productId);
  }

  @Post('products/:productId/variants')
  createProductVariant(
    @Param('productId') productId: string,
    @Body() dto: any,
  ) {
    return this.managerService.createProductVariant(productId, dto);
  }

  @Put('variants/:variantId')
  updateProductVariant(
    @Param('variantId') variantId: string,
    @Body() dto: any,
  ) {
    return this.managerService.updateProductVariant(variantId, dto);
  }

  @Delete('variants/:variantId')
  deleteProductVariant(@Param('variantId') variantId: string) {
    return this.managerService.deleteProductVariant(variantId);
  }
}
