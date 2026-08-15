/**
 * Toạ độ trung tâm của các tỉnh / thành phố tại Việt Nam (Latitude, Longitude)
 * Dùng làm fallback khi thông tin thú cưng không chứa toạ độ kinh/vĩ độ GPS chính xác.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export const PROVINCE_COORDINATES: Record<string, LatLng> = {
  // Thành phố trực thuộc trung ương
  'ha noi': { lat: 21.0285, lng: 105.8542 },
  'tp. ho chi minh': { lat: 10.8231, lng: 106.6297 },
  'ho chi minh': { lat: 10.8231, lng: 106.6297 },
  'tp. hcm': { lat: 10.8231, lng: 106.6297 },
  'hcm': { lat: 10.8231, lng: 106.6297 },
  'da nang': { lat: 16.0544, lng: 108.2022 },
  'tp. da nang': { lat: 16.0544, lng: 108.2022 },
  'hai phong': { lat: 20.8449, lng: 106.6881 },
  'tp. hai phong': { lat: 20.8449, lng: 106.6881 },
  'can tho': { lat: 10.0452, lng: 105.7469 },
  'tp. can tho': { lat: 10.0452, lng: 105.7469 },

  // Miền Bắc
  'an giang': { lat: 10.3759, lng: 105.4185 },
  'bac giang': { lat: 21.2731, lng: 106.1946 },
  'bac kan': { lat: 22.147, lng: 105.8348 },
  'bac lieu': { lat: 9.2941, lng: 105.7244 },
  'bac ninh': { lat: 21.1861, lng: 106.0763 },
  'ben tre': { lat: 10.2415, lng: 106.3756 },
  'binh dinh': { lat: 13.783, lng: 109.2197 },
  'binh duong': { lat: 11.1604, lng: 106.6508 },
  'binh phuoc': { lat: 11.7507, lng: 106.9007 },
  'binh thuan': { lat: 11.1042, lng: 108.1834 },
  'ca mau': { lat: 9.1769, lng: 105.1524 },
  'cao bang': { lat: 22.6657, lng: 106.2575 },
  'dak lak': { lat: 12.6667, lng: 108.05 },
  'dak nong': { lat: 12.0039, lng: 107.6874 },
  'dien bien': { lat: 21.3847, lng: 103.0232 },
  'dong nai': { lat: 11.0531, lng: 107.1852 },
  'dong thap': { lat: 10.4938, lng: 105.6882 },
  'gia lai': { lat: 13.9833, lng: 108.0 },
  'ha giang': { lat: 22.8233, lng: 104.9839 },
  'ha nam': { lat: 20.5453, lng: 105.9126 },
  'ha tinh': { lat: 18.3559, lng: 105.8877 },
  'hai duong': { lat: 20.9386, lng: 106.3216 },
  'hau giang': { lat: 9.7844, lng: 105.4701 },
  'hoa binh': { lat: 20.8183, lng: 105.3382 },
  'hung yen': { lat: 20.6464, lng: 106.0511 },
  'khanh hoa': { lat: 12.2388, lng: 109.1967 },
  'nha trang': { lat: 12.2388, lng: 109.1967 },
  'kien giang': { lat: 10.0125, lng: 105.0809 },
  'kon tum': { lat: 14.3541, lng: 108.0076 },
  'lai chau': { lat: 22.3963, lng: 103.4586 },
  'lam dong': { lat: 11.9404, lng: 108.4583 },
  'da lat': { lat: 11.9404, lng: 108.4583 },
  'lang son': { lat: 21.8475, lng: 106.7607 },
  'lao cai': { lat: 22.4856, lng: 103.9707 },
  'long an': { lat: 10.5334, lng: 106.4116 },
  'nam dinh': { lat: 20.4371, lng: 106.1743 },
  'nghe an': { lat: 19.2342, lng: 104.8384 },
  'ninh binh': { lat: 20.2506, lng: 105.9745 },
  'ninh thuan': { lat: 11.5653, lng: 108.9882 },
  'phu tho': { lat: 21.3227, lng: 105.2016 },
  'phu yen': { lat: 13.0882, lng: 109.0929 },
  'quang binh': { lat: 17.469, lng: 106.6225 },
  'quang nam': { lat: 15.5667, lng: 108.4833 },
  'quang ngai': { lat: 15.1205, lng: 108.7924 },
  'quang ninh': { lat: 21.0069, lng: 107.2925 },
  'ha long': { lat: 20.9505, lng: 107.0733 },
  'quang tri': { lat: 16.7441, lng: 107.1856 },
  'soc trang': { lat: 9.6037, lng: 105.9801 },
  'son la': { lat: 21.3258, lng: 103.9188 },
  'tay ninh': { lat: 11.3653, lng: 106.1009 },
  'thai binh': { lat: 20.4463, lng: 106.3366 },
  'thai nguyen': { lat: 21.5928, lng: 105.8442 },
  'thanh hoa': { lat: 19.8067, lng: 105.7851 },
  'thua thien hue': { lat: 16.4637, lng: 107.5909 },
  'hue': { lat: 16.4637, lng: 107.5909 },
  'tien giang': { lat: 10.4493, lng: 106.3418 },
  'tra vinh': { lat: 9.9348, lng: 106.3456 },
  'tuyen quang': { lat: 21.8247, lng: 105.2173 },
  'vinh long': { lat: 10.2537, lng: 105.9722 },
  'vinh phuc': { lat: 21.3089, lng: 105.6049 },
  'yen bai': { lat: 21.7051, lng: 104.8704 },
  'ba ria - vung tau': { lat: 10.5417, lng: 107.2429 },
  'vung tau': { lat: 10.346, lng: 107.0843 },
};

/**
 * Loại bỏ dấu tiếng Việt và ký tự đặc biệt để so sánh chuỗi linh hoạt
 */
export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Loại bỏ tất cả ký tự đặc biệt, chỉ giữ lại chữ, số và khoảng trắng.
 * Dùng cho trường hợp dữ liệu bị lỗi encoding (ví dụ: "TP. H? Ch? Minh").
 */
function stripNonAlpha(str: string): string {
  return str.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Tìm toạ độ trung tâm dựa theo tên vị trí/tỉnh thành
 */
export function getProvinceCoords(locationName?: string | null): LatLng | null {
  if (!locationName) return null;

  const normalized = removeVietnameseTones(locationName);

  // 1. Khớp chính xác key
  if (PROVINCE_COORDINATES[normalized]) {
    return PROVINCE_COORDINATES[normalized];
  }

  // 2. Thử xóa các tiền tố phổ biến: "tp.", "thanh pho", "tinh"
  const cleaned = normalized
    .replace(/^(tp\.?|thanh pho|tinh)\s+/i, '')
    .trim();

  if (PROVINCE_COORDINATES[cleaned]) {
    return PROVINCE_COORDINATES[cleaned];
  }

  // 3. Tìm substring match (cho cả normalized lẫn cleaned)
  for (const [key, coords] of Object.entries(PROVINCE_COORDINATES)) {
    if (normalized.includes(key) || key.includes(normalized) || cleaned.includes(key)) {
      return coords;
    }
  }

  // 4. Fallback: xử lý data bị lỗi encoding
  //    Ví dụ: "TP. H? Ch? Minh" → stripped "tp h ch minh"
  //    Chiến lược: kiểm tra từ cuối cùng có ý nghĩa (thường là phần phân biệt của tên)
  //    và kết hợp kiểm tra prefix "tp" hoặc các từ khác
  const stripped = stripNonAlpha(normalized);
  const strippedWords = stripped.split(' ').filter((w) => w.length > 0);

  // Lấy từ cuối cùng đủ dài (>= 2 ký tự) làm từ khóa chính
  const lastSignificant = [...strippedWords].reverse().find((w) => w.length >= 3);

  if (lastSignificant) {
    for (const [key, coords] of Object.entries(PROVINCE_COORDINATES)) {
      const keyWords = stripNonAlpha(key).split(' ');
      const keyLast = [...keyWords].reverse().find((w) => w.length >= 3);
      if (keyLast && keyLast === lastSignificant) {
        // Kiểm tra thêm xem có ít nhất 1 từ khác cũng match (tránh false positive)
        const otherMatch = strippedWords.some(
          (sw) => sw !== lastSignificant && keyWords.some((kw) => kw !== keyLast && (kw.startsWith(sw) || sw.startsWith(kw))),
        );
        if (otherMatch || keyWords.length === 1) {
          return coords;
        }
      }
    }
  }

  return null;
}
