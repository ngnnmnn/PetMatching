"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RevenuePoint = {
  label: string;
  storeRevenue: number;
  spaRevenue: number;
  totalRevenue: number;
  transactions: number;
};

function formatAxisMoney(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return String(value);
}

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: RevenuePoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-xs">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" /> Cửa hàng
          </span>
          <span className="font-extrabold text-foreground">
            {point.storeRevenue.toLocaleString("vi-VN")} đ
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-chart-2" /> Spa
          </span>
          <span className="font-extrabold text-foreground">
            {point.spaRevenue.toLocaleString("vi-VN")} đ
          </span>
        </div>
        <div className="border-t border-border/80 pt-1.5">
          <div className="flex items-center justify-between gap-4 font-black">
            <span>Tổng cộng</span>
            <span className="text-primary">
              {point.totalRevenue.toLocaleString("vi-VN")} đ
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {point.transactions.toLocaleString("vi-VN")} giao dịch
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Biểu đồ doanh thu Admin được tách độc lập để áp dụng Dynamic Import (Code-splitting)
 * Giúp giảm tải thư viện Recharts nặng (>150KB) khỏi bundle JS chính khi tải trang
 */
export default function AdminRevenueChart({
  data = [],
}: {
  data: RevenuePoint[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 8, right: 4, left: -16, bottom: 0 }}
      >
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          minTickGap={24}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickFormatter={formatAxisMoney}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={<RevenueTooltip />}
        />
        <Bar
          dataKey="storeRevenue"
          name="Store"
          stackId="revenue"
          fill="var(--primary)"
          radius={[0, 0, 3, 3]}
          maxBarSize={42}
        />
        <Bar
          dataKey="spaRevenue"
          name="Spa"
          stackId="revenue"
          fill="var(--chart-2)"
          radius={[5, 5, 0, 0]}
          maxBarSize={42}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
