import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { CalculateFeeDto } from './dto/calculate-fee.dto';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  /**
   * Lấy danh sách Tỉnh / Thành phố từ Open API v2 (provinces.open-api.vn/api/v2/p/)
   */
  async getProvinces() {
    try {
      const response = await fetch('https://provinces.open-api.vn/api/v2/p/', {
        method: 'GET',
      });
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      return list.map((item: any) => ({
        provinceId: item.code,
        provinceName: item.name,
        code: String(item.code),
      }));
    } catch (error) {
      this.logger.error('Lỗi getProvinces từ Open API v2:', error);
      return [];
    }
  }

  /**
   * Lấy danh sách Phường / Xã từ Open API v2 theo mã Tỉnh / Thành phố (provinces.open-api.vn/api/v2/p/{code}?depth=2)
   */
  async getWards(provinceId: number) {
    try {
      const response = await fetch(
        `https://provinces.open-api.vn/api/v2/p/${provinceId}?depth=2`,
        {
          method: 'GET',
        },
      );
      const data = await response.json();
      const wards = Array.isArray(data?.wards) ? data.wards : [];
      return wards.map((item: any) => ({
        wardCode: String(item.code),
        wardName: item.name,
      }));
    } catch (error) {
      this.logger.error(`Lỗi getWards cho province ${provinceId}:`, error);
      return [];
    }
  }

  /**
   * Hỗ trợ tương thích cho getDistricts (trả về danh sách wards làm đơn vị hành chính con)
   */
  async getDistricts(provinceId: number) {
    try {
      const wards = await this.getWards(provinceId);
      return wards.map((w: any) => ({
        districtId: Number(w.wardCode),
        districtName: w.wardName,
        code: w.wardCode,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Phí giao hàng mặc định 30,000 VND (30k)
   */
  calculateShippingFee(_dto?: CalculateFeeDto) {
    return {
      total: 30000,
      serviceFee: 30000,
      insuranceFee: 0,
      isEstimated: false,
    };
  }
}
