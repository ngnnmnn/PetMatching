import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CalculateFeeDto } from './dto/calculate-fee.dto';
import { CreateShippingOrderDto } from './dto/create-shipping-order.dto';
import { ShippingService } from './shipping.service';

@Controller('api/shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('provinces')
  async getProvinces() {
    return this.shippingService.getProvinces();
  }

  @Get('districts')
  async getDistricts(@Query('province_id') provinceId: string) {
    return this.shippingService.getDistricts(Number(provinceId));
  }

  @Get('wards')
  async getWards(@Query('district_id') districtId: string) {
    return this.shippingService.getWards(Number(districtId));
  }

  @Post('calculate-fee')
  async calculateShippingFee(@Body() dto: CalculateFeeDto) {
    return this.shippingService.calculateShippingFee(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-order')
  async createShippingOrder(@Body() dto: CreateShippingOrderDto) {
    return this.shippingService.createShippingOrder(dto.orderId);
  }

  @Post('webhook')
  async handleWebhook(@Body() payload: any) {
    return this.shippingService.handleWebhook(payload);
  }
}
