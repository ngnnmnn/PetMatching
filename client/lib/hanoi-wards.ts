/**
 * Danh sách chuẩn 126 Phường / Xã / Thị trấn tại Hà Nội (theo chuẩn 2 cấp hành chính)
 * Kèm toạ độ tâm GPS chính xác để tính toán khoảng cách tự động (Haversine distance).
 */

export interface HanoiWard {
  name: string;
  lat: number;
  lng: number;
}

export const HANOI_WARDS: HanoiWard[] = [
  { name: 'Phường Ba Đình', lat: 21.0345, lng: 105.8236 },
  { name: 'Phường Ngọc Hà', lat: 21.0378, lng: 105.8269 },
  { name: 'Phường Giảng Võ', lat: 21.0272, lng: 105.8197 },
  { name: 'Phường Hoàn Kiếm', lat: 21.0285, lng: 105.8542 },
  { name: 'Phường Cửa Nam', lat: 21.0267, lng: 105.8443 },
  { name: 'Phường Phú Thượng', lat: 21.0821, lng: 105.8056 },
  { name: 'Phường Hồng Hà', lat: 21.0422, lng: 105.8614 },
  { name: 'Phường Tây Hồ', lat: 21.0667, lng: 105.8192 },
  { name: 'Phường Bồ Đề', lat: 21.0361, lng: 105.8717 },
  { name: 'Phường Việt Hưng', lat: 21.0603, lng: 105.9036 },
  { name: 'Phường Phúc Lợi', lat: 21.0461, lng: 105.9381 },
  { name: 'Phường Long Biên', lat: 21.0333, lng: 105.8894 },
  { name: 'Phường Nghĩa Đô', lat: 21.0456, lng: 105.7958 },
  { name: 'Phường Cầu Giấy', lat: 21.0338, lng: 105.7944 },
  { name: 'Phường Yên Hòa', lat: 21.0189, lng: 105.7911 },
  { name: 'Phường Ô Chợ Dừa', lat: 21.0183, lng: 105.8272 },
  { name: 'Phường Láng', lat: 21.0142, lng: 105.8083 },
  { name: 'Phường Văn Miếu - Quốc Tử Giám', lat: 21.0281, lng: 105.8361 },
  { name: 'Phường Kim Liên', lat: 21.0094, lng: 105.8367 },
  { name: 'Phường Đống Đa', lat: 21.0156, lng: 105.8289 },
  { name: 'Phường Hai Bà Trưng', lat: 21.0108, lng: 105.8522 },
  { name: 'Phường Vĩnh Tuy', lat: 21.0017, lng: 105.8706 },
  { name: 'Phường Bạch Mai', lat: 21.0042, lng: 105.8489 },
  { name: 'Phường Vĩnh Hưng', lat: 20.9936, lng: 105.8853 },
  { name: 'Phường Định Công', lat: 20.9842, lng: 105.8336 },
  { name: 'Phường Tương Mai', lat: 20.9939, lng: 105.8475 },
  { name: 'Phường Lĩnh Nam', lat: 20.9856, lng: 105.8942 },
  { name: 'Phường Hoàng Mai', lat: 20.9781, lng: 105.8578 },
  { name: 'Phường Hoàng Liệt', lat: 20.9631, lng: 105.8378 },
  { name: 'Phường Yên Sở', lat: 20.9686, lng: 105.8756 },
  { name: 'Phường Phương Liệt', lat: 21.0003, lng: 105.8406 },
  { name: 'Phường Khương Đình', lat: 20.9922, lng: 105.8167 },
  { name: 'Phường Thanh Xuân', lat: 20.9989, lng: 105.8089 },
  { name: 'Xã Sóc Sơn', lat: 21.2828, lng: 105.8478 },
  { name: 'Xã Kim Anh', lat: 21.27, lng: 105.8011 },
  { name: 'Xã Trung Giã', lat: 21.3325, lng: 105.8672 },
  { name: 'Xã Đa Phúc', lat: 21.3056, lng: 105.8822 },
  { name: 'Xã Nội Bài', lat: 21.2186, lng: 105.8039 },
  { name: 'Xã Đông Anh', lat: 21.1397, lng: 105.8497 },
  { name: 'Xã Phúc Thịnh', lat: 21.1211, lng: 105.8211 },
  { name: 'Xã Thư Lâm', lat: 21.1689, lng: 105.8928 },
  { name: 'Xã Thiên Lộc', lat: 21.1278, lng: 105.7833 },
  { name: 'Xã Vĩnh Thanh', lat: 21.1022, lng: 105.8361 },
  { name: 'Xã Phù Đổng', lat: 21.0744, lng: 105.9528 },
  { name: 'Xã Thuận An', lat: 21.0267, lng: 105.9756 },
  { name: 'Xã Gia Lâm', lat: 21.0194, lng: 105.9389 },
  { name: 'Xã Bát Tràng', lat: 20.9786, lng: 105.9122 },
  { name: 'Phường Từ Liêm', lat: 21.0422, lng: 105.7611 },
  { name: 'Phường Thượng Cát', lat: 21.0944, lng: 105.7317 },
  { name: 'Phường Đông Ngạc', lat: 21.0856, lng: 105.7767 },
  { name: 'Phường Xuân Đỉnh', lat: 21.0711, lng: 105.7906 },
  { name: 'Phường Tây Tựu', lat: 21.0603, lng: 105.7239 },
  { name: 'Phường Phú Diễn', lat: 21.0506, lng: 105.7628 },
  { name: 'Phường Xuân Phương', lat: 21.0322, lng: 105.7417 },
  { name: 'Phường Tây Mỗ', lat: 21.0028, lng: 105.7431 },
  { name: 'Phường Đại Mỗ', lat: 20.9933, lng: 105.7631 },
  { name: 'Xã Thanh Trì', lat: 20.9458, lng: 105.8561 },
  { name: 'Phường Thanh Liệt', lat: 20.9694, lng: 105.8172 },
  { name: 'Xã Đại Thanh', lat: 20.9572, lng: 105.8017 },
  { name: 'Xã Ngọc Hồi', lat: 20.9233, lng: 105.8567 },
  { name: 'Xã Nam Phù', lat: 20.9167, lng: 105.8872 },
  { name: 'Xã Yên Xuân', lat: 20.9389, lng: 105.8756 },
  { name: 'Xã Quang Minh', lat: 21.1961, lng: 105.7511 },
  { name: 'Xã Yên Lãng', lat: 21.1822, lng: 105.7139 },
  { name: 'Xã Tiến Thắng', lat: 21.2189, lng: 105.7122 },
  { name: 'Xã Mê Linh', lat: 21.1611, lng: 105.7228 },
  { name: 'Phường Kiến Hưng', lat: 20.9589, lng: 105.7894 },
  { name: 'Phường Hà Đông', lat: 20.9722, lng: 105.7761 },
  { name: 'Phường Yên Nghĩa', lat: 20.9539, lng: 105.7439 },
  { name: 'Phường Phú Lương', lat: 20.9411, lng: 105.7706 },
  { name: 'Phường Sơn Tây', lat: 21.1367, lng: 105.5036 },
  { name: 'Phường Tùng Thiện', lat: 21.1189, lng: 105.5089 },
  { name: 'Xã Đoài Phương', lat: 21.1472, lng: 105.4611 },
  { name: 'Xã Quảng Oai', lat: 21.2178, lng: 105.4056 },
  { name: 'Xã Cổ Đô', lat: 21.2689, lng: 105.3789 },
  { name: 'Xã Minh Châu', lat: 21.2917, lng: 105.4189 },
  { name: 'Xã Vật Lại', lat: 21.2056, lng: 105.3533 },
  { name: 'Xã Bất Bạt', lat: 21.1733, lng: 105.3211 },
  { name: 'Xã Suối Hai', lat: 21.1389, lng: 105.3739 },
  { name: 'Xã Ba Vì', lat: 21.0822, lng: 105.3611 },
  { name: 'Xã Yên Bài', lat: 21.0333, lng: 105.4189 },
  { name: 'Xã Phúc Thọ', lat: 21.1067, lng: 105.5789 },
  { name: 'Xã Phúc Lộc', lat: 21.1322, lng: 105.5567 },
  { name: 'Xã Hát Môn', lat: 21.1278, lng: 105.6267 },
  { name: 'Xã Đan Phượng', lat: 21.0967, lng: 105.6711 },
  { name: 'Xã Liên Minh', lat: 21.1211, lng: 105.6639 },
  { name: 'Xã Ô Diên', lat: 21.0833, lng: 105.6989 },
  { name: 'Xã Hoài Đức', lat: 21.0189, lng: 105.7067 },
  { name: 'Xã Dương Hòa', lat: 21.0456, lng: 105.6789 },
  { name: 'Xã Sơn Đồng', lat: 21.0411, lng: 105.7011 },
  { name: 'Xã An Khánh', lat: 20.9989, lng: 105.7278 },
  { name: 'Phường Dương Nội', lat: 20.9822, lng: 105.7489 },
  { name: 'Xã Quốc Oai', lat: 20.9944, lng: 105.6367 },
  { name: 'Xã Kiều Phú', lat: 20.9633, lng: 105.6178 },
  { name: 'Xã Hưng Đạo', lat: 21.0167, lng: 105.6189 },
  { name: 'Xã Phú Cát', lat: 20.9789, lng: 105.5689 },
  { name: 'Xã Thạch Thất', lat: 21.0378, lng: 105.5411 },
  { name: 'Xã Hạ Bằng', lat: 21.0089, lng: 105.5389 },
  { name: 'Xã Hòa Lạc', lat: 20.9911, lng: 105.5211 },
  { name: 'Xã Tây Phương', lat: 21.0267, lng: 105.5944 },
  { name: 'Phường Chương Mỹ', lat: 20.8922, lng: 105.7033 },
  { name: 'Xã Phú Nghĩa', lat: 20.9189, lng: 105.6639 },
  { name: 'Xã Xuân Mai', lat: 20.8989, lng: 105.5789 },
  { name: 'Xã Quảng Bị', lat: 20.8711, lng: 105.6411 },
  { name: 'Xã Trần Phú', lat: 20.8389, lng: 105.6311 },
  { name: 'Xã Hòa Phú', lat: 20.8644, lng: 105.7178 },
  { name: 'Xã Thanh Oai', lat: 20.8756, lng: 105.7811 },
  { name: 'Xã Bình Minh', lat: 20.9089, lng: 105.7739 },
  { name: 'Xã Tam Hưng', lat: 20.8611, lng: 105.8089 },
  { name: 'Xã Dân Hòa', lat: 20.8178, lng: 105.7767 },
  { name: 'Xã Thường Tín', lat: 20.8694, lng: 105.8611 },
  { name: 'Xã Hồng Vân', lat: 20.8789, lng: 105.9089 },
  { name: 'Xã Thượng Phúc', lat: 20.8311, lng: 105.8739 },
  { name: 'Xã Chương Dương', lat: 20.8456, lng: 105.9189 },
  { name: 'Xã Phú Xuyên', lat: 20.7333, lng: 105.9067 },
  { name: 'Xã Phượng Dực', lat: 20.7611, lng: 105.8567 },
  { name: 'Xã Chuyên Mỹ', lat: 20.7189, lng: 105.8539 },
  { name: 'Xã Đại Xuyên', lat: 20.6867, lng: 105.9239 },
  { name: 'Xã Vân Đình', lat: 20.7311, lng: 105.7722 },
  { name: 'Xã Ứng Thiên', lat: 20.7689, lng: 105.7867 },
  { name: 'Xã Ứng Hòa', lat: 20.7067, lng: 105.7611 },
  { name: 'Xã Hòa Xá', lat: 20.6639, lng: 105.7789 },
  { name: 'Xã Mỹ Đức', lat: 20.6856, lng: 105.7289 },
  { name: 'Xã Phúc Sơn', lat: 20.7211, lng: 105.6989 },
  { name: 'Xã Hồng Sơn', lat: 20.6544, lng: 105.7311 },
  { name: 'Xã Hương Sơn', lat: 20.6189, lng: 105.8089 },
];

/**
 * Loại bỏ dấu tiếng Việt để tìm kiếm linh hoạt
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
 * Tìm kiếm Phường/Xã tại Hà Nội theo từ khoá (hỗ trợ có dấu và không dấu)
 */
export function searchHanoiWards(keyword: string): HanoiWard[] {
  if (!keyword || !keyword.trim()) return HANOI_WARDS;
  const cleanKeyword = removeVietnameseTones(keyword);
  return HANOI_WARDS.filter((ward) =>
    removeVietnameseTones(ward.name).includes(cleanKeyword),
  );
}

/**
 * Tìm toạ độ của 1 Phường/Xã tại Hà Nội theo tên
 */
export function getHanoiWardCoords(wardName?: string | null): { lat: number; lng: number } {
  if (!wardName) {
    // Mặc định trung tâm Hà Nội (Hoàn Kiếm)
    return { lat: 21.0285, lng: 105.8542 };
  }
  const cleanTarget = removeVietnameseTones(wardName);
  const found = HANOI_WARDS.find((w) => {
    const cleanW = removeVietnameseTones(w.name);
    return cleanW === cleanTarget || cleanTarget.includes(cleanW) || cleanW.includes(cleanTarget);
  });
  return found ? { lat: found.lat, lng: found.lng } : { lat: 21.0285, lng: 105.8542 };
}
