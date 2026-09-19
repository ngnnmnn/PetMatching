/**
 * Module quản lý bộ nhớ đệm (In-Memory Cache) phía Client cho các API ít biến động.
 * 
 * Lợi ích:
 * - Giảm tải request thừa lên server khi người dùng chuyển trang qua lại.
 * - Hiển thị dữ liệu tức thì (0ms latency), loại bỏ giật lag và loading spinner.
 * - Tự động gom các request trùng lặp gọi đồng thời (Request Deduplication).
 * - Hỗ trợ thời gian sống (TTL) và cơ chế xóa cache chủ động (Cache Invalidation).
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttlMs: number;
};

// Lưu trữ dữ liệu cache trong bộ nhớ RAM của trình duyệt
const memoryCache = new Map<string, CacheEntry<unknown>>();

// Lưu trữ các Promise đang chạy để tránh bắn nhiều request trùng lặp cùng một lúc
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Lấy dữ liệu từ cache hoặc thực thi fetchFunction nếu chưa có hoặc đã hết hạn
 * @param key Khóa định danh của cache (ví dụ: 'products:categories')
 * @param fetcher Hàm async gọi API thực tế
 * @param ttlMs Thời gian sống của cache tính bằng mili-giây (mặc định 5 phút)
 * @param force Làm mới bắt buộc bỏ qua cache hiện tại nếu true
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60 * 1000,
  force = false,
): Promise<T> {
  const now = Date.now();

  // 1. Kiểm tra cache hiện có nếu không bắt buộc làm mới
  if (!force) {
    const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
    if (cached && now - cached.timestamp < cached.ttlMs) {
      return cached.data;
    }
  }

  // 2. Nếu đang có một request cùng key đang chạy, chia sẻ chung kết quả tránh spam server
  const existingPromise = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existingPromise) {
    return existingPromise;
  }

  // 3. Thực thi gọi API mới và lưu vào cache
  const requestPromise = (async () => {
    try {
      const result = await fetcher();
      memoryCache.set(key, {
        data: result,
        timestamp: Date.now(),
        ttlMs,
      });
      return result;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, requestPromise);
  return requestPromise;
}

/**
 * Xóa một mục cụ thể trong cache
 */
export function invalidateCache(key: string): void {
  memoryCache.delete(key);
  inFlightRequests.delete(key);
}

/**
 * Xóa tất cả các mục có key bắt đầu bằng tiền tố prefix
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Xóa toàn bộ bộ nhớ đệm (dùng khi đăng xuất hoặc chuyển tài khoản)
 */
export function clearAllApiCache(): void {
  memoryCache.clear();
  inFlightRequests.clear();
}

// Lắng nghe sự kiện thay đổi phiên đăng nhập để làm sạch cache an toàn
if (typeof window !== 'undefined') {
  window.addEventListener('auth-change', () => {
    // Khi trạng thái xác thực thay đổi (đăng nhập / đăng xuất), xóa cache dữ liệu người dùng
    invalidateCachePrefix('pets:');
    invalidateCachePrefix('user:');
  });
}
