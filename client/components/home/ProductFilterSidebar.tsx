'use client';

import { Bone, Brush, Cat, Dog, HeartPulse, Home, Package, Tag, Filter, Check } from 'lucide-react';
import { ProductCategory } from '@/types';

export interface DynamicCategory {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface ProductFilterSidebarProps {
  species: string;
  selectedCategories: string[];
  selectedPrices: string[];
  onSpeciesChange: (value: string) => void;
  onCategoriesChange: (values: string[]) => void;
  onPricesChange: (values: string[]) => void;
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

const PRICE_RANGES = [
  { value: 'under_100k', label: 'Dưới 100.000đ' },
  { value: '100k_500k', label: '100.000đ - 500.000đ' },
  { value: '500k_1m', label: '500.000đ - 1.000.000đ' },
  { value: 'over_1m', label: 'Trên 1.000.000đ' },
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
 * Component thanh lọc bên lề (Sidebar) hỗ trợ lọc theo loài thú cưng, danh mục động từ DB và khoảng giá.
 */
export default function ProductFilterSidebar({
  species,
  selectedCategories,
  selectedPrices,
  onSpeciesChange,
  onCategoriesChange,
  onPricesChange,
  dynamicCategories,
}: ProductFilterSidebarProps) {
  /** Thao tác bật/tắt lọc theo loài thú cưng (Chó/Mèo/Tất cả) */
  const handleSpeciesToggle = (value: string) => {
    onSpeciesChange(value);
  };

  /** Thao tác chọn hoặc bỏ chọn một danh mục sản phẩm cụ thể */
  const handleCategoryToggle = (catValue: string) => {
    let nextCategories: string[];
    if (selectedCategories.includes(catValue)) {
      nextCategories = selectedCategories.filter((c) => c !== catValue);
    } else {
      nextCategories = [...selectedCategories, catValue];
    }
    onCategoriesChange(nextCategories);
  };

  /** Thao tác bỏ chọn tất cả danh mục (xem tất cả) */
  const handleAllCategoriesToggle = () => {
    onCategoriesChange([]);
  };

  /** Thao tác chọn hoặc bỏ chọn một khoảng giá tiền */
  const handlePriceToggle = (priceValue: string) => {
    let nextPrices: string[];
    if (selectedPrices.includes(priceValue)) {
      nextPrices = selectedPrices.filter((p) => p !== priceValue);
    } else {
      nextPrices = [...selectedPrices, priceValue];
    }
    onPricesChange(nextPrices);
  };

  /** Thao tác bỏ chọn tất cả khoảng giá (xem tất cả giá) */
  const handleAllPricesToggle = () => {
    onPricesChange([]);
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

  return (
    <aside className="sticky top-24 select-none overflow-hidden rounded-2xl border border-[#E7E3DC] bg-white shadow-[0_12px_36px_rgba(34,34,34,0.07)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#EEEAE3] bg-gradient-to-r from-[#F0FDFA] to-white px-5 py-4 text-[var(--text-main)]">
        <span className="flex size-9 items-center justify-center rounded-xl bg-[#0F766E] text-white shadow-sm">
          <Filter className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-black">Bộ lọc sản phẩm</h3>
          <p className="mt-0.5 text-[10px] font-semibold text-[var(--text-muted)]">Kết quả cập nhật ngay khi chọn</p>
        </div>
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
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-bold transition text-left ${
                  isSpeciesBtnDisabled
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

      {/* 2. Category Filter */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Danh mục sản phẩm</h4>
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

          {categoriesToRender.map((cat) => {
            const isChecked = selectedCategories.includes(cat.value);
            const Icon = cat.icon || Package;
            const isCatInputDisabled = isCategoryDisabled(cat.value);

            return (
              <label
                key={cat.value}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs transition duration-150 ${
                  isCatInputDisabled
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
        </div>
      </div>

      {/* 3. Price Filter */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Khoảng giá tiền</h4>
        <div className="grid grid-cols-1 gap-1.5">
          <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${selectedPrices.length === 0 ? 'border-[#FED7AA] bg-[#FFF7ED] text-[#D94F0B]' : 'border-transparent text-[var(--text-main)] hover:bg-[#FAF9F7]'}`}>
            <input
              type="checkbox"
              checked={selectedPrices.length === 0}
              onChange={handleAllPricesToggle}
              className="rounded border-[#DCDAD4] text-[#E45D1C] focus:ring-[#E45D1C]/20 size-4 cursor-pointer accent-[#E45D1C]"
            />
            <span>Tất cả mức giá</span>
          </label>

          {PRICE_RANGES.map((range) => {
            const isChecked = selectedPrices.includes(range.value);
            return (
              <label
                key={range.value}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${isChecked ? 'border-[#FED7AA] bg-[#FFF7ED] text-[#D94F0B]' : 'border-transparent text-[var(--text-muted)] hover:bg-[#FAF9F7] hover:text-[var(--text-main)]'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handlePriceToggle(range.value)}
                  className="rounded border-[#DCDAD4] text-[#E45D1C] focus:ring-[#E45D1C]/20 size-4 cursor-pointer accent-[#E45D1C]"
                />
                <span>{range.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      </div>
    </aside>
  );
}
