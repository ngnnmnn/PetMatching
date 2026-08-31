import { Controller, Get, Query } from '@nestjs/common';
import { ShippingService } from './shipping.service';

@Controller('api/shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('provinces')
  getProvinces() {
    return this.shippingService.getProvinces();
  }

  @Get('wards')
  getWards(@Query('province_id') provinceId?: string) {
    return this.shippingService.getWards(Number(provinceId || 0));
  }
}
