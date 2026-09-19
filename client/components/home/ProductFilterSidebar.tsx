'use client';

import { useState, useEffect } from 'react';
import { Bone, Brush, Cat, Dog, Home, Package, Tag, Filter, Check, ChevronDown, ChevronUp, RotateCcw, Star } from 'lucide-react';

export interface DynamicCategory {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface ProductFilterSidebarProps {
  species: string;
  selectedCategories: string[];
  selectedRating?: number | null;
  customMinPrice?: number;
  customMaxPrice?: number;
  onSpeciesChange: (value: string) => void;
  onCategoriesChange: (values: string[]) => void;
  onRatingChange?: (rating: number | null) => void;
  onCustomPriceChange?: (min?: number, max?: number) => void;
  onClearAllFilters?: () => void;
  hasActiveFilters?: boolean;
  dynamicCategories?: DynamicCategory[];
}

const DEFAULT_CATEGORIES: Array<{
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
    { value: 'DOG_FOOD', label: 'Thức ăn chó', icon: Dog },
    { value: 'CAT_FOOD', label: 'Thức ăn mèo', icon: Cat },
    { value: 'TOY', label: 'Đồ chơi thú cưng', icon: Bone },
    { value: 'ACCESSORY', label: 'Phụ kiện', icon: Tag },
    { value: 'GROOMING', label: 'Chăm sóc & Vệ sinh', icon: Brush },
    { value: 'CAGE_BED', label: 'Chuồng & Giường ngủ', icon: Home },
    { value: 'LEASH_COLLAR', label: 'Dây dắt & Vòng cổ', icon: Tag },
  ];

const RATING_FILTER_OPTIONS = [
  { value: 5, label: '5 sao', stars: 5 },
  { value: 4, label: 'Từ 4 sao', stars: 4 },
  { value: 3, label: 'Từ 3 sao', stars: 3 },
  { value: 2, label: 'Từ 2 sao', stars: 2 },
  { value: 1, label: 'Từ 1 sao', stars: 1 },
];

const CATEGORY_SPECIES: Record<string, 'DOG' | 'CAT' | 'BOTH'> = {
  DOG_FOOD: 'DOG',
  CAT_FOOD: 'CAT',
  TOY: 'BOTH',
  ACCESSORY: 'BOTH',
  GROOMING: 'BOTH',
  CAGE_BED: 'BOTH',
  LEASH_COLLAR: 'BOTH',
};

/**
 * Định dạng chuỗi số thành tiền tệ có dấu phân cách hàng nghìn (VD: 100.000)
 */
function formatInputNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

/**
 * Trích xuất giá trị số nguyên từ chuỗi đã định dạng tiền tệ
 */
function parseInputNumber(value: string): number | undefined {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : undefined;
}

/**
 * Component thanh lọc bên lề (Sidebar):
 * - Hỗ trợ lọc theo loài thú cưng (Chó/Mèo/Tất cả)
 * - Hiển thị 4 danh mục và nút "Xem thêm" mở rộng danh sách
 * - Bộ lọc khoảng giá tùy biến Min - Max có định dạng VNĐ và kiểm tra lỗi max >= min
 * - Bộ lọc đánh giá theo số sao rating của sản phẩm
 * - Nút "Xóa tất cả bộ lọc" chỉ xuất hiện khi có ít nhất 1 bộ lọc đang hoạt động
 */
export default function ProductFilterSidebar({
  species,
  selectedCategories,
  selectedRating = null,
  customMinPrice,
  customMaxPrice,
  onSpeciesChange,
  onCategoriesChange,
  onRatingChange,
  onCustomPriceChange,
  onClearAllFilters,
  hasActiveFilters,
  dynamicCategories,
}: ProductFilterSidebarProps) {
  const [isExpandedCategories, setIsExpandedCategories] = useState(false);
  const [rawMin, setRawMin] = useState(customMinPrice ? customMinPrice.toLocaleString('vi-VN') : '');
  const [rawMax, setRawMax] = useState(customMaxPrice ? customMaxPrice.toLocaleString('vi-VN') : '');

  // Đồng bộ giá trị min/max từ component cha khi được reset
  useEffect(() => {
    setRawMin(customMinPrice ? customMinPrice.toLocaleString('vi-VN') : '');
    setRawMax(customMaxPrice ? customMaxPrice.toLocaleString('vi-VN') : '');
  }, [customMinPrice, customMaxPrice]);

  const minVal = parseInputNumber(rawMin);
  const maxVal = parseInputNumber(rawMax);
  const isPriceInvalid = minVal !== undefined && maxVal !== undefined && minVal > maxVal;

  /**
   * Xử lý khi người dùng nhập giá tối thiểu (Min)
   */
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputNumber(e.target.value);
    setRawMin(formatted);
    const nextMin = parseInputNumber(formatted);
    const currentMax = parseInputNumber(rawMax);

    if (onCustomPriceChange) {
      if (nextMin === undefined || currentMax === undefined || nextMin <= currentMax) {
        onCustomPriceChange(nextMin, currentMax);
      }
    }
  };

  /**
   * Xử lý khi người dùng nhập giá tối đa (Max)
   */
  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputNumber(e.target.value);
    setRawMax(formatted);
    const nextMax = parseInputNumber(formatted);
    const currentMin = parseInputNumber(rawMin);

    if (onCustomPriceChange) {
      if (currentMin === undefined || nextMax === undefined || currentMin <= nextMax) {
        onCustomPriceChange(currentMin, nextMax);
      }
    }
  };

  /** Thao tác chọn hoặc bỏ chọn loài thú cưng */
  const handleSpeciesToggle = (value: string) => {
    onSpeciesChange(value);
  };

  /** Thao tác chọn hoặc bỏ chọn danh mục sản phẩm */
  const handleCategoryToggle = (catValue: string) => {
    let nextCategories: string[];
    if (selectedCategories.includes(catValue)) {
      nextCategories = selectedCategories.filter((c) => c !== catValue);
    } else {
      nextCategories = [...selectedCategories, catValue];
    }
    onCategoriesChange(nextCategories);
  };

  /** Bỏ chọn tất cả danh mục sản phẩm */
  const handleAllCategoriesToggle = () => {
    onCategoriesChange([]);
  };

  /** Thao tác chọn hoặc bỏ chọn mức đánh giá sao */
  const handleRatingToggle = (val: number | null) => {
    if (!onRatingChange) return;
    if (selectedRating === val) {
      onRatingChange(null);
    } else {
      onRatingChange(val);
    }
  };

  // Vô hiệu hóa lựa chọn loài nếu danh mục đã chọn bị giới hạn loài cụ thể
  const isDogSpeciesDisabled = selectedCategories.some(
    (cat) => CATEGORY_SPECIES[cat] === 'CAT'
  );
  const isCatSpeciesDisabled = selectedCategories.some(
    (cat) => CATEGORY_SPECIES[cat] === 'DOG'
  );

  /** Kiểm tra xem một danh mục có bị vô hiệu hóa bởi loài thú cưng đang chọn hay không */
  const isCategoryDisabled = (catValue: string) => {
    if (species === 'DOG' && CATEGORY_SPECIES[catValue] === 'CAT') return true;
    if (species === 'CAT' && CATEGORY_SPECIES[catValue] === 'DOG') return true;
    return false;
  };

  // Sử dụng danh sách danh mục động từ CSDL nếu có, ngược lại dùng danh sách mặc định
  const categoriesToRender: Array<{ value: string; label: string; icon?: any }> =
    dynamicCategories && dynamicCategories.length > 0
      ? dynamicCategories
      : DEFAULT_CATEGORIES;

  const visibleCategories = isExpandedCategories
    ? categoriesToRender
    : categoriesToRender.slice(0, 4);

  // Xác định xem hiện tại có ít nhất 1 bộ lọc đang được kích hoạt hay không
  const isFilterActive = Boolean(
    hasActiveFilters ||
    species !== '' ||
    selectedCategories.length > 0 ||
    (selectedRating !== null && selectedRating !== undefined) ||
    Boolean(rawMin) ||
    Boolean(rawMax)
  );

  return (
    <aside className="sticky top-24 select-none overflow-hidden rounded-2xl border border-[#E7E3DC] bg-white shadow-[0_12px_36px_rgba(34,34,34,0.07)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EEEAE3] bg-gradient-to-r from-[#F0FDFA] to-white px-5 py-4 text-[var(--text-main)]">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#0F766E] text-white shadow-sm">
            <Filter className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-black">Bộ lọc sản phẩm</h3>
            <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-muted)]">Cập nhật kết quả tức thì</p>
          </div>
        </div>

        {/* Nút xóa toàn bộ bộ lọc - Chỉ hiện nếu có ít nhất 1 filter được chọn */}
        {isFilterActive && onClearAllFilters && (
          <button
            type="button"
            onClick={onClearAllFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-black text-red-600 transition hover:bg-red-100 hover:border-red-300 active:scale-95 cursor-pointer shadow-2xs"
            title="Xóa toàn bộ các bộ lọc đang chọn"
          >
            <RotateCcw className="size-3" />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      <div className="space-y-6 p-5">

        {/* 1. Species Filter */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Thành viên thú cưng</h4>
          <div className="flex flex-col gap-1.5">
            {[
              { value: '', label: 'Tất cả thú cưng', icon: Package },
              { value: 'DOG', label: 'Dành cho Chó', icon: Dog },
              { value: 'CAT', label: 'Dành cho Mèo', icon: Cat },
            ].map((item) => {
              const isSelected = species === item.value;
              const Icon = item.icon;
              const isSpeciesBtnDisabled =
                item.value === 'DOG'
                  ? isDogSpeciesDisabled
                  : item.value === 'CAT'
                    ? isCatSpeciesDisabled
                    : false;

              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={isSpeciesBtnDisabled}
                  onClick={() => handleSpeciesToggle(item.value)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition text-left ${isSpeciesBtnDisabled
                      ? 'cursor-not-allowed border-transparent bg-gray-50 text-gray-400 opacity-50'
                      : isSelected
                        ? 'cursor-pointer border-[#99D5CE] bg-[#EAF8F6] text-[#0F766E] shadow-xs'
                        : 'cursor-pointer border-transparent text-[var(--text-main)] hover:border-[#E7E3DC] hover:bg-[#FAF9F7]'
                    }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-[#0F766E]" />
                    {item.label}
                  </span>
                  {isSelected && !isSpeciesBtnDisabled && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Category Filter (Hiển thị 4 danh mục và nút xem thêm) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Danh mục sản phẩm</h4>
            {selectedCategories.length > 0 && (
              <span className="text-[10px] font-bold text-[#E45D1C] bg-[#FFF4ED] px-2 py-0.5 rounded-full">
                {selectedCategories.length} đã chọn
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-bold transition ${selectedCategories.length === 0 ? 'bg-[#FFF4ED] text-[#D94F0B]' : 'text-[var(--text-main)] hover:bg-[#FAF9F7]'}`}>
              <input
                type="checkbox"
                checked={selectedCategories.length === 0}
                onChange={handleAllCategoriesToggle}
                className="rounded border-[#DCDAD4] text-[#E45D1C] focus:ring-[#E45D1C]/20 size-4 cursor-pointer accent-[#E45D1C]"
              />
              <span className="flex items-center gap-2">
                <Package className="size-3.5 text-[#0F766E]" />
                Tất cả danh mục
              </span>
            </label>

            {visibleCategories.map((cat) => {
              const isChecked = selectedCategories.includes(cat.value);
              const Icon = cat.icon || Package;
              const isCatInputDisabled = isCategoryDisabled(cat.value);

              return (
                <label
                  key={cat.value}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs transition duration-150 ${isCatInputDisabled
                      ? 'opacity-40 text-gray-400 cursor-not-allowed'
                      : isChecked
                        ? 'cursor-pointer bg-[#FFF4ED] font-bold text-[#D94F0B]'
                        : 'cursor-pointer text-[var(--text-muted)] hover:bg-[#FAF9F7] hover:text-[var(--text-main)]'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked && !isCatInputDisabled}
                    disabled={isCatInputDisabled}
                    onChange={() => handleCategoryToggle(cat.value)}
                    className="rounded border-[#DCDAD4] text-[#E45D1C] focus:ring-[#E45D1C]/20 size-4 cursor-pointer accent-[#E45D1C] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="flex items-center gap-2">
                    <Icon className="size-3.5 shrink-0 text-[#0F766E]" />
                    {cat.label}
                  </span>
                </label>
              );
            })}

            {/* Nút Xem thêm / Thu gọn danh mục */}
            {categoriesToRender.length > 4 && (
              <button
                type="button"
                onClick={() => setIsExpandedCategories((prev) => !prev)}
                className="mt-1.5 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#DDD8CF] bg-[#FAF9F7] py-2 text-xs font-bold text-[#0F766E] transition hover:bg-white hover:border-[#0F766E] cursor-pointer"
              >
                {isExpandedCategories ? (
                  <>
                    <span>Thu gọn</span>
                    <ChevronUp className="size-3.5" />
                  </>
                ) : (
                  <>
                    <span>Xem thêm ({categoriesToRender.length - 4} danh mục)</span>
                    <ChevronDown className="size-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 3. Price Filter with Custom Min-Max Input */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Khoảng giá tiền</h4>

          {/* Ô nhập giá trị Min và Max tự do */}
          <div className="space-y-2 rounded-xl bg-[#FAF9F7] p-3 border border-[#EFEAE2]">
            <span className="text-[11px] font-bold text-[var(--text-muted)] block">khoảng giá (VNĐ):</span>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={rawMin}
                  onChange={handleMinChange}
                  placeholder="Từ"
                  className={`h-9 w-full rounded-lg border bg-white px-2.5 text-xs font-bold text-[var(--text-main)] placeholder:text-gray-400 focus:outline-none transition ${isPriceInvalid
                      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-[#DCDAD4] focus:border-[var(--primary-color)]'
                    }`}
                />
              </div>
              <span className="text-xs font-bold text-gray-400">-</span>
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={rawMax}
                  onChange={handleMaxChange}
                  placeholder="Đến"
                  className={`h-9 w-full rounded-lg border bg-white px-2.5 text-xs font-bold text-[var(--text-main)] placeholder:text-gray-400 focus:outline-none transition ${isPriceInvalid
                      ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-[#DCDAD4] focus:border-[var(--primary-color)]'
                    }`}
                />
              </div>
            </div>

            {/* Thông báo lỗi khi giá tối đa nhỏ hơn giá tối thiểu */}
            {isPriceInvalid && (
              <p className="text-[11px] font-bold text-red-600 animate-fadeIn flex items-center gap-1">
                <span>⚠️</span>
                <span>giá trị max phải lớn hơn giá trị min</span>
              </p>
            )}
          </div>
        </div>

        {/* 4. Rating Filter (Lọc theo đánh giá sao của sản phẩm) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Đánh giá sản phẩm</h4>
            {selectedRating && (
              <span className="text-[10px] font-bold text-[#E45D1C] bg-[#FFF4ED] px-2 py-0.5 rounded-full">
                Từ {selectedRating}★
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {/* Lựa chọn Tất cả đánh giá */}
            <button
              type="button"
              onClick={() => handleRatingToggle(null)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition text-left cursor-pointer ${
                selectedRating === null || selectedRating === undefined
                  ? 'border-[#FED7AA] bg-[#FFF7ED] text-[#D94F0B] shadow-xs'
                  : 'border-transparent text-[var(--text-main)] hover:border-[#E7E3DC] hover:bg-[#FAF9F7]'
              }`}
            >
              <span>Tất cả đánh giá</span>
              {(selectedRating === null || selectedRating === undefined) && <Check className="size-3.5 text-[#D94F0B]" />}
            </button>

            {/* Các mốc sao từ 5 sao xuống 1 sao */}
            {RATING_FILTER_OPTIONS.map((item) => {
              const isSelected = selectedRating === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleRatingToggle(item.value)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition text-left cursor-pointer ${
                    isSelected
                      ? 'border-[#FED7AA] bg-[#FFF7ED] text-[#D94F0B] font-bold shadow-xs'
                      : 'border-transparent text-[var(--text-muted)] hover:border-[#E7E3DC] hover:bg-[#FAF9F7] hover:text-[var(--text-main)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`size-3.5 ${
                            i < item.stars
                              ? 'fill-[#F59E0B] text-[#F59E0B]'
                              : 'fill-gray-100 text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span>{item.label}</span>
                  </div>
                  {isSelected && <Check className="size-3.5 text-[#D94F0B]" />}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </aside>
  );
}
