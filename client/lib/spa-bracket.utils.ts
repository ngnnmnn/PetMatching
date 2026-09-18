/**
 * Tiện ích xử lý mốc cân nặng, thời gian và giá dịch vụ Spa phía client
 * Hỗ trợ chuyển đổi, giải mã mảng cân nặng, và kiểm tra điều kiện mốc cân nặng
 */

export interface SpaWeightBracket {
  minWeight: number;
  maxWeight: number | null;
  duration: number;
  price: number;
}

/**
 * Các mốc cân nặng có sẵn chuẩn dành cho Chó
 * (0-3, 3-5, 5-10, 10-20, 20-30, 30-50, >50)
 */
export const DOG_WEIGHT_PRESETS = [
  { min: 0, max: 3 },
  { min: 3, max: 5 },
  { min: 5, max: 10 },
  { min: 10, max: 20 },
  { min: 20, max: 30 },
  { min: 30, max: 50 },
  { min: 50, max: null },
];

/**
 * Các mốc cân nặng có sẵn chuẩn dành cho Mèo
 * (0-3, 3-5, 5-15, 15-30, >30)
 */
export const CAT_WEIGHT_PRESETS = [
  { min: 0, max: 3 },
  { min: 3, max: 5 },
  { min: 5, max: 15 },
  { min: 15, max: 30 },
  { min: 30, max: null },
];

/**
 * Giải mã và chuẩn hóa mảng dữ liệu từ API hoặc state
 * @param val Giá trị mảng, chuỗi JSON, hoặc chuỗi "[...][...]"
 */
export function parseArrayField(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const matches = trimmed.match(/\[[^\]]*\]/g);
      if (matches && matches.length > 1) {
        return matches.map((m) => {
          try {
            return JSON.parse(m);
          } catch {
            return [];
          }
        });
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        return [];
      }
    }
  }
  return [];
}

/**
 * Trích xuất các mốc cân nặng theo loài (Chó / Mèo) từ dịch vụ Spa
 * @param service Đối tượng dịch vụ Spa
 * @param targetSpecies Loài áp dụng ('DOG' hoặc 'CAT')
 */
export function getServiceBracketsForSpecies(
  service: any,
  targetSpecies?: 'DOG' | 'CAT' | string | null,
): SpaWeightBracket[] {
  if (!service) return [];
  const isAll = !service.species || service.species === 'ALL';
  const minWeightsRaw = parseArrayField(service.petMinWeight);
  const maxWeightsRaw = parseArrayField(service.petMaxWeight);
  const durationsRaw = parseArrayField(service.duration);
  const pricesRaw = parseArrayField(service.price);

  let mins: number[] = [];
  let maxs: (number | null)[] = [];
  let durs: number[] = [];
  let prcs: number[] = [];

  const is2D = isAll && Array.isArray(minWeightsRaw[0]);

  if (is2D) {
    const idx = targetSpecies === 'CAT' ? 1 : 0;
    mins = Array.isArray(minWeightsRaw[idx]) ? minWeightsRaw[idx] : minWeightsRaw[0] || [];
    maxs = Array.isArray(maxWeightsRaw[idx]) ? maxWeightsRaw[idx] : maxWeightsRaw[0] || [];
    durs = Array.isArray(durationsRaw[idx]) ? durationsRaw[idx] : durationsRaw[0] || [];
    prcs = Array.isArray(pricesRaw[idx]) ? pricesRaw[idx] : pricesRaw[0] || [];
  } else {
    mins = Array.isArray(minWeightsRaw[0]) ? minWeightsRaw[0] : minWeightsRaw;
    maxs = Array.isArray(maxWeightsRaw[0]) ? maxWeightsRaw[0] : maxWeightsRaw;
    durs = Array.isArray(durationsRaw[0]) ? durationsRaw[0] : durationsRaw;
    prcs = Array.isArray(pricesRaw[0]) ? pricesRaw[0] : pricesRaw;
  }

  // Fallback nếu dữ liệu cũ còn lưu ở dạng đơn lẻ
  if (mins.length === 0 && service.petWeightMin !== undefined && service.petWeightMin !== null) {
    mins = [Number(service.petWeightMin)];
  }
  if (maxs.length === 0 && service.petWeightMax !== undefined) {
    maxs = [service.petWeightMax !== null ? Number(service.petWeightMax) : null];
  }
  if (prcs.length === 0 && typeof service.price === 'number') {
    prcs = [service.price];
  }
  if (durs.length === 0 && typeof service.durationMin === 'number') {
    durs = [service.durationMin];
  }

  const length = Math.max(mins.length, maxs.length, durs.length, prcs.length, 1);
  const brackets: SpaWeightBracket[] = [];

  for (let i = 0; i < length; i++) {
    brackets.push({
      minWeight: typeof mins[i] === 'number' ? mins[i] : 0,
      maxWeight: typeof maxs[i] === 'number' ? maxs[i] : null,
      duration: typeof durs[i] === 'number' ? durs[i] : (typeof durs[0] === 'number' ? durs[0] : 60),
      price: typeof prcs[i] === 'number' ? prcs[i] : (typeof prcs[0] === 'number' ? prcs[0] : 0),
    });
  }

  return brackets;
}

/**
 * Tìm mốc cân nặng tương ứng với cân nặng thú cưng
 * Quy tắc: Nếu max = null thì chỉ cần cân nặng >= min là đạt điều kiện
 * @param service Dịch vụ Spa
 * @param petSpecies Loài của thú cưng ('DOG' | 'CAT')
 * @param petWeight Cân nặng của thú cưng (kg)
 */
export function resolveServicePriceAndDuration(
  service: any,
  petSpecies?: 'DOG' | 'CAT' | string | null,
  petWeight?: number | null,
) {
  const normSpecies: 'DOG' | 'CAT' = petSpecies === 'CAT' ? 'CAT' : 'DOG';
  const brackets = getServiceBracketsForSpecies(service, normSpecies);

  if (brackets.length === 0) {
    return {
      price: typeof service?.price === 'number' ? service.price : 0,
      duration: typeof service?.durationMin === 'number' ? service.durationMin : 60,
      matchedBracketIndex: 0,
    };
  }

  const weight = typeof petWeight === 'number' && !isNaN(petWeight) ? petWeight : 0;

  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i];
    const min = b.minWeight ?? 0;
    const max = b.maxWeight;

    // Nếu max = null -> chỉ cần cân nặng >= min là đạt điều kiện
    if (max === null || max === undefined) {
      if (weight >= min) {
        return {
          price: b.price,
          duration: b.duration,
          matchedBracketIndex: i,
        };
      }
    } else {
      if (weight >= min && weight < max) {
        return {
          price: b.price,
          duration: b.duration,
          matchedBracketIndex: i,
        };
      }
    }
  }

  const lastIndex = brackets.length - 1;
  const lastBracket = brackets[lastIndex];
  if (weight >= (lastBracket.minWeight ?? 0)) {
    return {
      price: lastBracket.price,
      duration: lastBracket.duration,
      matchedBracketIndex: lastIndex,
    };
  }

  return {
    price: brackets[0].price,
    duration: brackets[0].duration,
    matchedBracketIndex: 0,
  };
}

/**
 * Định dạng chuỗi hiển thị khoảng cân nặng người dùng dễ đọc
 * @param min Cân nặng tối thiểu
 * @param max Cân nặng tối đa (null nếu không giới hạn trên)
 */
export function formatWeightRange(min: number | null | undefined, max: number | null | undefined): string {
  const minVal = min !== null && min !== undefined ? Number(min) : null;
  const maxVal = max !== null && max !== undefined ? Number(max) : null;

  if (minVal === null && maxVal === null) return 'Mọi cân nặng';
  if (minVal === 0 && maxVal === null) return 'Mọi cân nặng';
  if (minVal !== null && maxVal === null) return `Từ ${minVal} kg`;
  if (minVal === null && maxVal !== null) return `Đến ${maxVal} kg`;
  if (minVal !== null && maxVal !== null) {
    if (minVal === maxVal) return `${minVal} kg`;
    return `${minVal} – ${maxVal} kg`;
  }
  return 'Mọi cân nặng';
}

/**
 * Tính toán khoảng giá và khoảng thời gian thực hiện của dịch vụ
 * @param service Bản ghi dịch vụ Spa
 */
export function computeServiceDisplayRanges(service: any) {
  const prc = parseArrayField(service.price);
  const dur = parseArrayField(service.duration);

  let flatPrices: number[] = prc
    .flat(Infinity)
    .filter((n: any) => typeof n === 'number' && !isNaN(n));
  let flatDurations: number[] = dur
    .flat(Infinity)
    .filter((n: any) => typeof n === 'number' && !isNaN(n));

  if (flatPrices.length === 0 && typeof service.price === 'number') {
    flatPrices = [service.price];
  }
  if (flatDurations.length === 0 && typeof service.durationMin === 'number') {
    flatDurations = [service.durationMin];
  }

  const minPrice = flatPrices.length ? Math.min(...flatPrices) : 0;
  const maxPrice = flatPrices.length ? Math.max(...flatPrices) : minPrice;
  const minDuration = flatDurations.length ? Math.min(...flatDurations) : 30;
  const maxDuration = flatDurations.length ? Math.max(...flatDurations) : minDuration;

  return {
    minPrice,
    maxPrice,
    minDuration,
    maxDuration,
    priceStr: minPrice === maxPrice
      ? `${minPrice.toLocaleString('vi-VN')}đ`
      : `${minPrice.toLocaleString('vi-VN')}đ – ${maxPrice.toLocaleString('vi-VN')}đ`,
    durationStr: minDuration === maxDuration
      ? `${minDuration} phút`
      : `${minDuration} – ${maxDuration} phút`,
  };
}
