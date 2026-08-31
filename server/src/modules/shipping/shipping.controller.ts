import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { CalculateFeeDto } from './dto/calculate-fee.dto';
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
  async getWards(
    @Query('district_id') districtId?: string,
    @Query('province_id') provinceId?: string,
  ) {
    const targetId = Number(provinceId || districtId || 0);
    return this.shippingService.getWards(targetId);
  }

  @Post('calculate-fee')
  calculateShippingFee(@Body() dto: CalculateFeeDto) {
    return this.shippingService.calculateShippingFee(dto);
  }
}
