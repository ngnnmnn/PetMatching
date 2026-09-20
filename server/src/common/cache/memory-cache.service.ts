import { Injectable } from '@nestjs/common';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

@Injectable()
export class MemoryCacheService {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly maxEntries = 200;
  private version = 0;

  /** Trả dữ liệu còn hạn hoặc chỉ chạy một lần khi nhiều request cùng nạp một khóa. */
  async getOrSet<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = this.entries.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (cached) this.entries.delete(key);

    const running = this.pending.get(key) as Promise<T> | undefined;
    if (running) return running;

    const version = this.version;
    const request = loader()
      .then((value) => {
        if (version === this.version) this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        if (this.pending.get(key) === request) this.pending.delete(key);
      });

    this.pending.set(key, request);
    return request;
  }

  /** Xóa toàn bộ khóa theo tiền tố sau khi dữ liệu nguồn thay đổi. */
  deleteByPrefix(prefix: string): void {
    this.version++;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
    for (const key of this.pending.keys()) {
      if (key.startsWith(prefix)) this.pending.delete(key);
    }
  }

  /** Lưu giá trị có thời hạn và giới hạn kích thước để cache không tăng vô hạn. */
  private set<T>(key: string, value: T, ttlMs: number): void {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey) this.entries.delete(oldestKey);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
