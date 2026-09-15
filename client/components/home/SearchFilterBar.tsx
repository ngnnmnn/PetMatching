'use client';

import { useState } from 'react';
import { Search, X, ArrowDownAZ } from 'lucide-react';

interface SearchFilterBarProps {
  onSearch: (value: string) => void;
  onSortChange: (value: string) => void;
  sortBy: string;
}

/**
 * Component thanh tìm kiếm và sắp xếp sản phẩm:
 * - Hỗ trợ gõ tìm kiếm tức thì theo từ khóa có dấu hoặc không dấu
 * - Lựa chọn tiêu chí sắp xếp hiển thị
 */
export default function SearchFilterBar({
  onSearch,
  onSortChange,
  sortBy,
}: SearchFilterBarProps) {
  const [searchValue, setSearchValue] = useState('');

  /**
   * Xử lý khi thay đổi nội dung tìm kiếm: Cập nhật state và tìm kiếm tức thì
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    onSearch(val.trim());
  };

  /**
   * Kích hoạt tìm kiếm khi nhấn phím Enter
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearch(searchValue.trim());
    }
  };

  /**
   * Xóa nội dung tìm kiếm và tải lại danh sách đầy đủ
   */
  const handleClear = () => {
    setSearchValue('');
    onSearch('');
  };

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-white p-4 shadow-[0_8px_24px_rgba(26,26,26,0.04)] space-y-3">
      {/* Ô tìm kiếm */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Tìm theo tên sản phẩm, thương hiệu (có dấu hoặc không dấu)..."
            className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[#FBFAF7] pl-10 pr-10 text-sm text-[var(--text-main)] transition placeholder:text-[#A6A6A6] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(228,93,28,0.12)]"
          />
          {searchValue && (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={handleClear}
              className="absolute right-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-page)] hover:text-[var(--text-main)] cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSearch(searchValue.trim())}
          className="h-11 px-5 rounded-xl bg-[var(--primary-color)] hover:bg-[#cf5017] text-white text-sm font-bold shadow-sm transition-all duration-150 active:scale-95 shrink-0 cursor-pointer"
        >
          Tìm kiếm
        </button>
      </div>

      {/* Sắp xếp sản phẩm */}
      <div className="flex justify-end items-center gap-2 text-sm">
        <label htmlFor="sort-products" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
          <ArrowDownAZ className="size-4 text-[#0F766E]" />
          Sắp xếp theo:
        </label>
        <select
          id="sort-products"
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value)}
          className="h-9 min-w-[160px] rounded-lg border border-[var(--border-color)] bg-[#FBFAF7] px-2.5 text-xs font-semibold text-[var(--text-main)] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none cursor-pointer"
        >
          {/* Các tùy chọn sắp xếp sản phẩm */}
          <option value="popular">Mặc định</option>
          <option value="newest">Mới nhất</option>
          <option value="rating_desc">Đánh giá</option>
          <option value="discount_desc">Giảm giá</option>
          <option value="price_asc">Giá tăng dần</option>
          <option value="price_desc">Giá giảm dần</option>
        </select>
      </div>
    </div>
  );
}
