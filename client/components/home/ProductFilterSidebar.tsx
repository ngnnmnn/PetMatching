'use client';

import { useState, useEffect } from 'react';
import { Bone, Brush, Cat, Dog, HeartPulse, Home, Package, Tag, Filter, Check, RotateCcw } from 'lucide-react';
import { ProductCategory } from '@/types';

interface ProductFilterSidebarProps {
  species: string;
  selectedCategories: string[];
  selectedPrices: string[];
  onSpeciesChange: (value: string) => void;
  onCategoriesChange: (values: string[]) => void;
  onPricesChange: (values: string[]) => void;
}

const CATEGORIES: Array<{
  value: ProductCategory;
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
  { value: 'MEDICAL', label: 'Y tế & Thuốc', icon: HeartPulse },
];

const PRICE_RANGES = [
  { value: 'under_100k', label: 'Dưới 100.000đ' },
  { value: '100k_500k', label: '100.000đ - 500.000đ' },
  { value: '500k_1m', label: '500.000đ - 1.000.000đ' },
  { value: 'over_1m', label: 'Trên 1.000.000đ' },
];

export default function ProductFilterSidebar({
  species,
  selectedCategories,
  selectedPrices,
  onSpeciesChange,
  onCategoriesChange,
  onPricesChange,
}: ProductFilterSidebarProps) {
  // Local state to hold filters before clicking Apply
  const [localSpecies, setLocalSpecies] = useState(species);
  const [localCategories, setLocalCategories] = useState<string[]>(selectedCategories);
  const [localPrices, setLocalPrices] = useState<string[]>(selectedPrices);

  // Sync state if props change externally
  useEffect(() => {
    setLocalSpecies(species);
  }, [species]);

  useEffect(() => {
    setLocalCategories(selectedCategories);
  }, [selectedCategories]);

  useEffect(() => {
    setLocalPrices(selectedPrices);
  }, [selectedPrices]);

  // Toggle handlers for local states
  const handleSpeciesToggle = (value: string) => {
    setLocalSpecies(value);
  };

  const handleCategoryToggle = (catValue: string) => {
    if (localCategories.includes(catValue)) {
      setLocalCategories(localCategories.filter((c) => c !== catValue));
    } else {
      setLocalCategories([...localCategories, catValue]);
    }
  };

  const handleAllCategoriesToggle = () => {
    setLocalCategories([]);
  };

  const handlePriceToggle = (priceValue: string) => {
    if (localPrices.includes(priceValue)) {
      setLocalPrices(localPrices.filter((p) => p !== priceValue));
    } else {
      setLocalPrices([...localPrices, priceValue]);
    }
  };

  const handleAllPricesToggle = () => {
    setLocalPrices([]);
  };

  // Submit all filters to the parent
  const handleApplyFilters = () => {
    onSpeciesChange(localSpecies);
    onCategoriesChange(localCategories);
    onPricesChange(localPrices);
  };

  // Clear all local and parent filters
  const handleResetFilters = () => {
    setLocalSpecies('');
    setLocalCategories([]);
    setLocalPrices([]);
    onSpeciesChange('');
    onCategoriesChange([]);
    onPricesChange([]);
  };

  return (
    <aside className="rounded-xl border border-[var(--border-color)] bg-white p-5 shadow-[0_8px_24px_rgba(26,26,26,0.03)] space-y-6 select-none sticky top-24">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#F4F4F4] pb-3 text-[var(--text-main)]">
        <Filter className="size-4 text-[#0F766E]" />
        <h3 className="text-base font-extrabold tracking-wide">Bộ lọc sản phẩm</h3>
      </div>

      {/* 1. Species Filter */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Thành viên thú cưng</h4>
        <div className="flex flex-col gap-1.5">
          {[
            { value: '', label: 'Tất cả thú cưng', icon: Package },
            { value: 'DOG', label: 'Dành cho Chó', icon: Dog },
            { value: 'CAT', label: 'Dành cho Mèo', icon: Cat },
          ].map((item) => {
            const isSelected = localSpecies === item.value;
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => handleSpeciesToggle(item.value)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition text-left cursor-pointer ${
                  isSelected
                    ? 'bg-[#FFF6F0] text-[var(--primary-color)]'
                    : 'text-[var(--text-main)] hover:bg-[#FAF9F5]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4 text-[#0F766E]" />
                  {item.label}
                </span>
                {isSelected && <Check className="size-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Category Filter */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Danh mục sản phẩm</h4>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2.5 px-1 py-0.5 text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:opacity-90">
            <input
              type="checkbox"
              checked={localCategories.length === 0}
              onChange={handleAllCategoriesToggle}
              className="rounded border-[#DCDAD4] text-[#E45D1C] focus:ring-[#E45D1C]/20 size-4 cursor-pointer accent-[#E45D1C]"
            />
            <span className="flex items-center gap-2">
              <Package className="size-3.5 text-[#0F766E]" />
              Tất cả danh mục
            </span>
          </label>

          {CATEGORIES.map((cat) => {
            const isChecked = localCategories.includes(cat.value);
            const Icon = cat.icon;
            return (
              <label
                key={cat.value}
                className="flex items-center gap-2.5 px-1 py-0.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer transition duration-150"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleCategoryToggle(cat.value)}
                  className="rounded border-[#DCDAD4] text-[#E45D1C] focus:ring-[#E45D1C]/20 size-4 cursor-pointer accent-[#E45D1C]"
                />
                <span className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0" />
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
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2.5 px-1 py-0.5 text-xs font-semibold text-[var(--text-main)] cursor-pointer hover:opacity-90">
            <input
              type="checkbox"
              checked={localPrices.length === 0}
              onChange={handleAllPricesToggle}
              className="rounded border-[#DCDAD4] text-[#E45D1C] focus:ring-[#E45D1C]/20 size-4 cursor-pointer accent-[#E45D1C]"
            />
            <span>Tất cả mức giá</span>
          </label>

          {PRICE_RANGES.map((range) => {
            const isChecked = localPrices.includes(range.value);
            return (
              <label
                key={range.value}
                className="flex items-center gap-2.5 px-1 py-0.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer transition duration-150"
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

      {/* Action Buttons: Apply & Clear */}
      <div className="pt-4 border-t border-[#F4F4F4] space-y-2">
        <button
          type="button"
          onClick={handleApplyFilters}
          className="w-full h-10 rounded-lg bg-[var(--primary-color)] hover:bg-[#cf5017] text-white font-extrabold text-xs shadow-md shadow-[rgba(228,93,28,0.18)] transition-all duration-150 active:scale-95 cursor-pointer flex items-center justify-center"
        >
          Áp dụng bộ lọc
        </button>
        <button
          type="button"
          onClick={handleResetFilters}
          className="w-full h-9 rounded-lg border border-[var(--border-color)] bg-white hover:bg-[#FAF9F5] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="size-3.5" />
          Thiết lập lại
        </button>
      </div>
    </aside>
  );
}
