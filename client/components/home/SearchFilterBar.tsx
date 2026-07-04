'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchFilterBarProps {
  onSearch: (value: string) => void;
  onSpeciesChange: (value: string) => void;
  onSortChange: (value: string) => void;
  species: string;
  sortBy: string;
}

export default function SearchFilterBar({
  onSearch,
  onSpeciesChange,
  onSortChange,
  species,
  sortBy,
}: SearchFilterBarProps) {
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSearch(searchValue.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [onSearch, searchValue]);

  return (
    <section className="rounded-lg border border-[var(--border-color)] bg-white p-3 shadow-[0_12px_32px_rgba(26,26,26,0.05)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Tìm sản phẩm, thương hiệu..."
            className="h-11 w-full rounded-md border border-[var(--border-color)] bg-[#FBFAF7] pl-10 pr-10 text-sm text-[var(--text-main)] transition placeholder:text-[#A6A6A6] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(228,93,28,0.12)]"
          />
          {searchValue && (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={() => setSearchValue('')}
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-page)] hover:text-[var(--text-main)]"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <select
          value={species}
          onChange={(event) => onSpeciesChange(event.target.value)}
          className="h-11 min-w-[150px] rounded-md border border-[var(--border-color)] bg-[#FBFAF7] px-3 text-sm font-medium text-[var(--text-main)] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
        >
          <option value="">Tất cả thú cưng</option>
          <option value="DOG">Chó</option>
          <option value="CAT">Mèo</option>
        </select>

        <select
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value)}
          className="h-11 min-w-[170px] rounded-md border border-[var(--border-color)] bg-[#FBFAF7] px-3 text-sm font-medium text-[var(--text-main)] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
        >
          <option value="popular">Phổ biến nhất</option>
          <option value="newest">Mới nhất</option>
          <option value="price_asc">Giá tăng dần</option>
          <option value="price_desc">Giá giảm dần</option>
        </select>
      </div>
    </section>
  );
}
