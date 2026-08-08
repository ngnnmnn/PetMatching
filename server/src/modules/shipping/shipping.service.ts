import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CalculateFeeDto } from './dto/calculate-fee.dto';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly ghnToken =
    process.env.GHN_TOKEN || 'a3fdf0a8-851d-11f1-aa4d-367074fd68e2';
  private readonly ghnShopId = process.env.GHN_SHOP_ID || '6561701';
  private readonly ghnBaseUrl =
    process.env.GHN_API_URL || 'https://online-gateway.ghn.vn/shiip/public-api';

  constructor(private readonly prisma: PrismaService) {}

  private async syncProductStockTx(tx: any, productId: string) {
    const variants = await tx.productVariant.findMany({
      where: { productId },
    });
    const totalStock = variants.reduce((sum: number, v: any) => sum + v.stock, 0);
    await tx.product.update({
      where: { id: productId },
      data: { stock: totalStock },
    });
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Token: this.ghnToken,
      ShopId: this.ghnShopId,
    };
  }

  /**
   * Lấy danh sách Tỉnh / Thành phố từ GHN
   */
  async getProvinces() {
    try {
      const response = await fetch(`${this.ghnBaseUrl}/master-data/province`, {
        method: 'GET',
        headers: { Token: this.ghnToken },
      });
      const data = await response.json();
      if (data.code !== 200) {
        throw new BadRequestException(
          data.message || 'Không thể lấy danh sách Tỉnh/Thành từ GHN',
        );
      }
      return data.data.map((item: any) => ({
        provinceId: item.ProvinceID,
        provinceName: item.ProvinceName,
        code: item.Code,
      }));
    } catch (error) {
      this.logger.error('Lỗi getProvinces:', error);
      throw new BadRequestException('Lỗi kết nối tới dịch vụ giao hàng GHN');
    }
  }

  /**
   * Lấy danh sách Quận / Huyện từ GHN theo Province ID
   */
  async getDistricts(provinceId: number) {
    try {
      const response = await fetch(`${this.ghnBaseUrl}/master-data/district`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Token: this.ghnToken,
        },
        body: JSON.stringify({ province_id: Number(provinceId) }),
      });
      const data = await response.json();
      if (data.code !== 200) {
        throw new BadRequestException(
          data.message || 'Không thể lấy danh sách Quận/Huyện từ GHN',
        );
      }
      return data.data.map((item: any) => ({
        districtId: item.DistrictID,
        districtName: item.DistrictName,
        code: item.Code,
      }));
    } catch (error) {
      this.logger.error('Lỗi getDistricts:', error);
      throw new BadRequestException('Lỗi kết nối tới dịch vụ giao hàng GHN');
    }
  }

  /**
   * Lấy danh sách Phường / Xã từ GHN theo District ID
   */
  async getWards(districtId: number) {
    try {
      const response = await fetch(
        `${this.ghnBaseUrl}/master-data/ward?district_id=${districtId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Token: this.ghnToken,
          },
          body: JSON.stringify({ district_id: Number(districtId) }),
        },
      );
      const data = await response.json();
      if (data.code !== 200) {
        throw new BadRequestException(
          data.message || 'Không thể lấy danh sách Phường/Xã từ GHN',
        );
      }
      // Chỉ hiển thị các phường/xã đang hoạt động bình thường và không bị khóa nhận hàng trên GHN
      return data.data
        .filter(
          (item: any) =>
            Number(item.Status) === 1 &&
            (item.Config?.To?.LockType !== 1 &&
              item.Config?.To?.LockType !== '1' &&
              item.Config?.To?.LockType !== 'locked'),
        )
        .map((item: any) => ({
          wardCode: item.WardCode,
          wardName: item.WardName,
        }));
    } catch (error) {
      this.logger.error('Lỗi getWards:', error);
      throw new BadRequestException('Lỗi kết nối tới dịch vụ giao hàng GHN');
    }
  }

  /**
   * Tính phí giao hàng GHN theo địa chỉ nhận
   */
  async calculateShippingFee(dto: CalculateFeeDto) {
    try {
      const body = {
        service_type_id: 2, // Chuẩn / Hàng nhẹ
        from_district_id: 1442, // Kho Đống Đa, Hà Nội
        from_ward_code: '20101', // Phường Cát Linh
        to_district_id: Number(dto.toDistrictId),
        to_ward_code: String(dto.toWardCode),
        weight: dto.weight || 500, // gram
        length: dto.length || 15,
        width: dto.width || 15,
        height: dto.height || 15,
        insurance_value: dto.insuranceValue || 0,
      };

      const response = await fetch(`${this.ghnBaseUrl}/v2/shipping-order/fee`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.code !== 200) {
        this.logger.warn(`GHN Calculate Fee warning: ${data.message}`);
        // Fallback phí mặc định nếu địa chỉ Sandbox chưa khớp chính xác
        return {
          total: 30000,
          serviceFee: 30000,
          isEstimated: true,
          message: data.message,
        };
      }

      return {
        total: data.data.total,
        serviceFee: data.data.service_fee,
        insuranceFee: data.data.insurance_fee || 0,
        isEstimated: false,
      };
    } catch (error) {
      this.logger.error('Lỗi calculateShippingFee:', error);
      return {
        total: 30000,
        serviceFee: 30000,
        isEstimated: true,
        message: 'Không thể gọi API GHN, áp dụng phí mặc định',
      };
    }
  }

  /**
   * Lấy mã phường/xã hoạt động đầu tiên của quận/huyện từ GHN (dùng làm fallback)
   */
  private async getFirstActiveWardCode(
    districtId: number,
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.ghnBaseUrl}/master-data/ward?district_id=${districtId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Token: this.ghnToken,
          },
          body: JSON.stringify({ district_id: Number(districtId) }),
        },
      );
      const data = await response.json();
      if (data.code === 200 && data.data && data.data.length > 0) {
        // Ưu tiên tìm phường/xã có Status === 1 (Đang hoạt động)
        const activeWard = data.data.find((w: any) => w.Status === 1);
        return activeWard ? activeWard.WardCode : data.data[0].WardCode;
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Lỗi getFirstActiveWardCode cho district ${districtId}:`,
        error,
      );
      return null;
    }
  }
}
