/**
 * Tiện ích xử lý mốc cân nặng, thời gian thực hiện và giá dịch vụ Spa
 * Hỗ trợ lưu trữ và phân tích cú pháp mảng cho từng loài (Chó/Mèo) hoặc cả hai (ALL)
 */

export interface SpaWeightBracket {
  minWeight: number;
  maxWeight: number | null;
  duration: number;
  price: number;
}

export interface ResolvedSpaServicePrice {
  price: number;
  duration: number;
  matchedBracketIndex: number;
  matchedSpecies: 'DOG' | 'CAT';
}

/**
 * Chuẩn hóa giá trị mảng từ dữ liệu database (có thể là Array, JSON string, hoặc chuỗi "[...][...]")
 * @param val Dữ liệu từ database (Json hoặc string)
 * @returns Mảng đã được giải mã
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
 * Trích xuất danh sách các mốc cân nặng áp dụng cho loài cụ thể (DOG hoặc CAT)
 * @param service Bản ghi dịch vụ Spa
 * @param targetSpecies Loài của thú cưng ('DOG' hoặc 'CAT')
 */
export function getServiceBracketsForSpecies(
  service: any,
  targetSpecies?: 'DOG' | 'CAT' | string | null,
): SpaWeightBracket[] {
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
    // Với ALL: mảng 0 là cho Chó, mảng 1 là cho Mèo
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
 * Tìm kiếm mốc cân nặng phù hợp nhất cho cân nặng và loài thú cưng
 * Quy tắc: Nếu max = null thì chỉ cần cân nặng >= min là đạt điều kiện
 * @param service Bản ghi dịch vụ Spa
 * @param petSpecies Loài của thú cưng ('DOG' | 'CAT')
 * @param petWeight Cân nặng của thú cưng (kg)
 */
export function resolveServicePriceAndDuration(
  service: any,
  petSpecies?: 'DOG' | 'CAT' | string | null,
  petWeight?: number | null,
): ResolvedSpaServicePrice {
  const normSpecies: 'DOG' | 'CAT' = petSpecies === 'CAT' ? 'CAT' : 'DOG';
  const brackets = getServiceBracketsForSpecies(service, normSpecies);

  if (brackets.length === 0) {
    return {
      price: 0,
      duration: 60,
      matchedBracketIndex: 0,
      matchedSpecies: normSpecies,
    };
  }

  const weight = typeof petWeight === 'number' && !isNaN(petWeight) ? petWeight : 0;

  // Tìm mốc phù hợp
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
          matchedSpecies: normSpecies,
        };
      }
    } else {
      // Khoảng bình thường [min, max)
      if (weight >= min && weight < max) {
        return {
          price: b.price,
          duration: b.duration,
          matchedBracketIndex: i,
          matchedSpecies: normSpecies,
        };
      }
    }
  }

  // Nếu cân nặng vượt quá mốc cuối cùng (hoặc mốc cuối cùng có giới hạn max nhỏ hơn cân nặng thực tế)
  const lastIndex = brackets.length - 1;
  const lastBracket = brackets[lastIndex];
  if (weight >= (lastBracket.minWeight ?? 0)) {
    return {
      price: lastBracket.price,
      duration: lastBracket.duration,
      matchedBracketIndex: lastIndex,
      matchedSpecies: normSpecies,
    };
  }

  // Fallback về mốc đầu tiên
  return {
    price: brackets[0].price,
    duration: brackets[0].duration,
    matchedBracketIndex: 0,
    matchedSpecies: normSpecies,
  };
}

/**
 * Tính toán khoảng giá và thời gian (min-max) để hiển thị trên giao diện chung
 * @param service Bản ghi dịch vụ Spa
 */
export function computeServiceDisplayRanges(service: any) {
  const prc = parseArrayField(service.price);
  const dur = parseArrayField(service.duration);

  const flatPrices: number[] = prc
    .flat(Infinity)
    .filter((n: any) => typeof n === 'number' && !isNaN(n));
  const flatDurations: number[] = dur
    .flat(Infinity)
    .filter((n: any) => typeof n === 'number' && !isNaN(n));

  const minPrice = flatPrices.length ? Math.min(...flatPrices) : 0;
  const maxPrice = flatPrices.length ? Math.max(...flatPrices) : minPrice;
  const minDuration = flatDurations.length ? Math.min(...flatDurations) : 30;
  const maxDuration = flatDurations.length ? Math.max(...flatDurations) : minDuration;

  return {
    minPrice,
    maxPrice,
    minDuration,
    maxDuration,
    displayPrice: minPrice,
    displayDuration: minDuration,
  };
}
