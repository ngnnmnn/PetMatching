import { Injectable, Logger } from '@nestjs/common';

export interface Coordinate {
  lat: number;
  lng: number;
}

@Injectable()
export class OsrmService {
  private readonly logger = new Logger(OsrmService.name);
  private readonly BASE_URL = 'https://router.project-osrm.org';
  private readonly TIMEOUT_MS = 3500; // Giới hạn thời gian chờ 3.5 giây tránh treo request matching

  /**
   * Tính toán khoảng cách đường bộ thực tế từ 1 điểm xuất phát đến danh sách nhiều điểm đích (Batch Table Routing).
   * Sử dụng OSRM Table Service để tối ưu 1 request duy nhất cho tối đa 100 điểm.
   *
   * @param origin Tọa độ của thú cưng gốc (thú cưng cái / người đang tìm kiếm)
   * @param destinations Danh sách tọa độ của các ứng viên ghép đôi
   * @returns Map ánh xạ chỉ số destination (0, 1, ...) -> khoảng cách đường bộ tính bằng km (làm tròn 1 chữ số thập phân),
   *          hoặc null nếu OSRM bị lỗi/timeout (để fallback an toàn sang Haversine).
   */
  async getBatchRoadDistances(
    origin: Coordinate,
    destinations: Coordinate[],
  ): Promise<Map<number, number> | null> {
    if (!destinations || destinations.length === 0) {
      return new Map();
    }

    try {
      // Giới hạn tối đa 99 điểm đích trong 1 lượt batch (OSRM public server cho phép tối đa 100 tọa độ/request)
      const cappedDestinations = destinations.slice(0, 99);

      // Chuỗi tọa độ theo chuẩn OSRM: kinh độ (lng), sau đó đến vĩ độ (lat), ngăn cách bởi dấu chấm phẩy
      // Điểm đầu tiên (index 0) là origin:
      const coordsParts = [
        `${origin.lng.toFixed(6)},${origin.lat.toFixed(6)}`,
        ...cappedDestinations.map(
          (dest) => `${dest.lng.toFixed(6)},${dest.lat.toFixed(6)}`,
        ),
      ];

      const url = `${this.BASE_URL}/table/v1/driving/${coordsParts.join(';')}?sources=0&annotations=distance`;

      // Tạo AbortController với thời gian timeout giới hạn
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PetMatching/1.0 (NestJS OSRM Client)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(
          `OSRM Table API phản hồi mã lỗi HTTP ${response.status}: ${response.statusText}`,
        );
        return null;
      }

      const data = await response.json();

      if (data?.code !== 'Ok' || !Array.isArray(data?.distances?.[0])) {
        this.logger.warn(`OSRM Table API trả dữ liệu không hợp lệ: ${data?.code}`);
        return null;
      }

      const row = data.distances[0];
      const resultMap = new Map<number, number>();

      // row[0] là khoảng cách từ origin đến chính nó (0m)
      // row[i + 1] là khoảng cách từ origin đến cappedDestinations[i]
      for (let i = 0; i < cappedDestinations.length; i++) {
        const distMeters = row[i + 1];
        if (distMeters != null && typeof distMeters === 'number' && distMeters >= 0) {
          // Quy đổi từ mét sang kilômét và làm tròn 1 chữ số thập phân
          const distKm = Math.round((distMeters / 1000) * 10) / 10;
          resultMap.set(i, distKm);
        }
      }

      return resultMap;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        this.logger.warn(`OSRM Table API bị timeout sau ${this.TIMEOUT_MS}ms, chuyển sang fallback Haversine.`);
      } else {
        this.logger.warn(`Lỗi khi gọi OSRM Table API: ${error?.message || error}`);
      }
      return null;
    }
  }
}
