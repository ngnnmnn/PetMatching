"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import type { AdminDashboardParams } from "@/lib/api/admin";

type PresetRange = Exclude<
  NonNullable<AdminDashboardParams["range"]>,
  "custom"
>;

export type RevenueComparison = {
  range?: {
    label: string;
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
  };
  revenue?: {
    current: number;
    previous: number;
    changePercent: number;
  };
};

const rangeOptions: Array<{ value: PresetRange; label: string }> = [
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "90d", label: "90 ngày" },
  { value: "12m", label: "12 tháng" },
];

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const shortDate = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function DashboardTimeControls({
  value,
  onChange,
  onRefresh,
  refreshing = false,
}: {
  value: AdminDashboardParams;
  onChange: (value: AdminDashboardParams) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [showCustomRange, setShowCustomRange] = useState(
    value.range === "custom",
  );
  const [customFrom, setCustomFrom] = useState(
    value.from ?? dateInputOffset(-29),
  );
  const [customTo, setCustomTo] = useState(value.to ?? dateInputOffset(0));
  const customRangeInvalid = !customFrom || !customTo || customFrom > customTo;

  const selectPreset = (range: PresetRange) => {
    setShowCustomRange(false);
    onChange({ range });
  };

  const applyCustomRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (customRangeInvalid) return;
    onChange({ range: "custom", from: customFrom, to: customTo });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[#D8E0EA] bg-white p-1 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rangeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => selectPreset(option.value)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
              value.range === option.value && !showCustomRange
                ? "bg-primary text-primary-foreground"
                : "text-[#64748B] hover:bg-[#F1F4F7] hover:text-[#172033]"
            }`}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustomRange((current) => !current)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
            value.range === "custom" || showCustomRange
              ? "bg-primary text-primary-foreground"
              : "text-[#64748B] hover:bg-[#F1F4F7] hover:text-[#172033]"
          }`}
        >
          <CalendarDays className="size-3.5" /> Tùy chọn
        </button>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Làm mới dữ liệu"
            className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#D8E0EA] text-[#64748B] transition hover:bg-[#F1F4F7] hover:text-[#172033] disabled:opacity-60"
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        )}
      </div>

      {showCustomRange && (
        <form
          onSubmit={applyCustomRange}
          className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[#D8E0EA] bg-white p-3 shadow-sm"
        >
          <label className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            Từ
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="h-9 rounded-lg border border-[#D8E0EA] bg-white px-2 text-xs font-semibold text-[#172033]"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            Đến
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="h-9 rounded-lg border border-[#D8E0EA] bg-white px-2 text-xs font-semibold text-[#172033]"
            />
          </label>
          <button
            type="submit"
            disabled={customRangeInvalid}
            className="h-9 rounded-lg bg-primary px-3 text-xs font-black text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Áp dụng
          </button>
        </form>
      )}
    </div>
  );
}

export function RevenueGrowthBadge({
  comparison,
}: {
  comparison?: RevenueComparison;
}) {
  const revenue = comparison?.revenue;
  const change = revenue?.changePercent ?? 0;
  const positive = change >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const difference = (revenue?.current ?? 0) - (revenue?.previous ?? 0);
  const currentPeriod = formatPeriod(
    comparison?.range?.from,
    comparison?.range?.to,
  );
  const previousPeriod = formatPeriod(
    comparison?.range?.previousFrom,
    comparison?.range?.previousTo,
  );

  return (
    <span
      className="group relative inline-flex shrink-0 cursor-help"
      tabIndex={0}
      aria-label={`${positive ? "Tăng" : "Giảm"} ${Math.abs(change).toFixed(1)} phần trăm so với kỳ trước`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${
          positive
            ? "bg-emerald-50 text-emerald-700"
            : "bg-rose-50 text-rose-700"
        }`}
      >
        <Icon className="size-3.5" /> {Math.abs(change).toFixed(1)}%
      </span>
      <span className="pointer-events-none invisible absolute right-0 top-full z-30 mt-2 w-72 translate-y-1 rounded-xl border border-[#D8E0EA] bg-white p-3 opacity-0 shadow-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:visible group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        <span className="block text-xs font-black text-[#172033]">
          So sánh với kỳ liền trước
        </span>
        <ComparisonRow
          label="Kỳ hiện tại"
          period={currentPeriod}
          value={revenue?.current ?? 0}
        />
        <ComparisonRow
          label="Kỳ trước"
          period={previousPeriod}
          value={revenue?.previous ?? 0}
        />
        <span className="mt-2 flex items-center justify-between gap-3 border-t border-[#E5EAF0] pt-2 text-xs font-semibold text-[#64748B]">
          <span>Chênh lệch</span>
          <span
            className={`font-black ${positive ? "text-emerald-700" : "text-rose-700"}`}
          >
            {difference >= 0 ? "+" : ""}
            {money.format(difference)}
          </span>
        </span>
        {revenue?.previous === 0 && (revenue?.current ?? 0) > 0 && (
          <span className="mt-2 block text-[11px] font-semibold leading-4 text-[#64748B]">
            Kỳ trước chưa có doanh thu; mức tăng được hiển thị là 100%.
          </span>
        )}
      </span>
    </span>
  );
}

function ComparisonRow({
  label,
  period,
  value,
}: {
  label: string;
  period: string;
  value: number;
}) {
  return (
    <span className="mt-2 flex items-start justify-between gap-3 text-xs font-semibold text-[#64748B]">
      <span>
        {label}
        <br />
        <span className="text-[10px]">{period}</span>
      </span>
      <span className="font-black text-[#172033]">{money.format(value)}</span>
    </span>
  );
}

function formatPeriod(from?: string, to?: string) {
  return from && to
    ? `${shortDate.format(new Date(from))} – ${shortDate.format(new Date(to))}`
    : "—";
}

function dateInputOffset(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
