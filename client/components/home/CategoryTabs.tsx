'use client';

import { Bone, Brush, Cat, Dog, HeartPulse, Home, Package, Tag } from 'lucide-react';
import { ProductCategory } from '@/types';

const CATEGORIES: Array<{
  value?: ProductCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { label: 'Tất cả', icon: Package },
  { value: 'DOG_FOOD', label: 'Thức ăn chó', icon: Dog },
  { value: 'CAT_FOOD', label: 'Thức ăn mèo', icon: Cat },
  { value: 'TOY', label: 'Đồ chơi', icon: Bone },
  { value: 'ACCESSORY', label: 'Phụ kiện', icon: Tag },
  { value: 'GROOMING', label: 'Chăm sóc', icon: Brush },
  { value: 'CAGE_BED', label: 'Chuồng & giường', icon: Home },
  { value: 'LEASH_COLLAR', label: 'Dây dắt', icon: Tag },
  { value: 'MEDICAL', label: 'Y tế', icon: HeartPulse },
];

export default function CategoryTabs({
  active,
  onChange,
}: {
  active?: string;
  onChange: (value?: string) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-2">
        {CATEGORIES.map((category) => {
          const selected = active === category.value || (!active && !category.value);
          const Icon = category.icon;

          return (
            <button
              key={category.value ?? 'all'}
              type="button"
              onClick={() => onChange(category.value)}
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold shadow-sm transition ${
                selected
                  ? 'border-[var(--primary-color)] bg-[var(--bg-demo-box)] text-[var(--primary-color)] shadow-[0_10px_22px_rgba(228,93,28,0.12)]'
                  : 'border-[var(--border-color)] bg-white text-[var(--text-muted)] hover:border-[#D8D8D8] hover:text-[var(--text-main)]'
              }`}
            >
              <Icon className="size-4" />
              {category.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
