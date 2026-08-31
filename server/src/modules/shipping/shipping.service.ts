import { Injectable } from '@nestjs/common';
import { HANOI_WARDS } from '../matching/hanoi-wards';

@Injectable()
export class ShippingService {
  private static readonly HANOI_PROVINCE_ID = 1;

  getWards(provinceId: number) {
    if (provinceId !== ShippingService.HANOI_PROVINCE_ID) return [];

    return HANOI_WARDS.map(({ wardCode, name }) => ({
      wardCode,
      wardName: name,
    }));
  }
}
