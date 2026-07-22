import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ManagerGuard } from '../../common/auth/manager.guard';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
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

  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: any) {
    return this.managerService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.managerService.deleteProduct(id);
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
}
