import { Injectable } from '@nestjs/common';
import { HANOI_WARDS } from '../matching/hanoi-wards';

@Injectable()
export class ShippingService {
  private static readonly HANOI_PROVINCE_ID = 1;

  getProvinces() {
    return [
      {
        provinceId: ShippingService.HANOI_PROVINCE_ID,
        provinceName: 'Thành phố Hà Nội',
        code: String(ShippingService.HANOI_PROVINCE_ID),
      },
    ];
  }

  getWards(provinceId: number) {
    if (provinceId !== ShippingService.HANOI_PROVINCE_ID) return [];

    return HANOI_WARDS.map(({ wardCode, name }) => ({
      wardCode,
      wardName: name,
    }));
  }
}
