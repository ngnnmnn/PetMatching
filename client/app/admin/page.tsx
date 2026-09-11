"use client";

import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  ClipboardCheck,
  HeartHandshake,
  RefreshCw,
  ShoppingBag,
  Stethoscope,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminApi } from "@/lib/api/admin";
import {
  DashboardTimeControls,
  RevenueGrowthBadge,
} from "@/components/admin/dashboard-time-controls";
import { useAdminDashboardRange } from "@/components/admin/admin-dashboard-range-context";

type RevenuePoint = {
  label: string;
  storeRevenue: number;
  spaRevenue: number;
  totalRevenue: number;
  transactions: number;
};

type DashboardData = {
  stats: {
    users: { total: number };
    pets: { total: number; verified: number; pendingVerification: number };
    matching: { totalMatches: number; pendingReports: number };
    moderation: {
      createdToday: number;
      overdue24Hours: number;
    };
    store: {
      status: string | null;
      totalOrders: number;
      pendingOrders: number;
      activeProducts: number;
      outOfStockProducts: number;
    };
    spa: {
      status: string | null;
      totalServices: number;
      totalBookings: number;
      pendingBookings?: number;
    };
  };
  analytics: {
    range: {
      label: string;
      from: string;
      to: string;
      previousFrom: string;
      previousTo: string;
    };
    revenue: {
      total: number;
      store: number;
      spa: number;
      previousTotal: number;
      changePercent: number;
    };
    revenueSeries: RevenuePoint[];
    updatedAt: string;
  };
};

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const { timeRange: params, setTimeRange: setParams } =
    useAdminDashboardRange();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(
    async (showRefreshState = false) => {
      if (showRefreshState) setRefreshing(true);
      setError("");
      try {
        const response = await adminApi.dashboard(params);
        setData(response.data);
      } catch {
        setError("Không thể tải bảng điều khiển quản trị.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [params],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const pendingCount = data
    ? data.stats.pets.pendingVerification + data.stats.matching.pendingReports
    : 0;

  const pendingItems = data
    ? [
        {
          label: "Giấy tờ thú cưng",
          description: "Hồ sơ chờ xác minh",
          value: data.stats.pets.pendingVerification,
          href: "/admin/pets?verification=pending",
          icon: ClipboardCheck,
          tone: "warning" as const,
        },
        {
          label: "Báo cáo ghép đôi",
          description: "Phản ánh đang mở",
          value: data.stats.matching.pendingReports,
          href: "/admin/reports?status=PENDING",
          icon: AlertTriangle,
          tone: "danger" as const,
        },
      ]
    : [];

  const hasRevenue =
    data?.analytics?.revenueSeries?.some((item) => item.totalRevenue > 0) ??
    false;
  if (loading) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <StateBox
        title="Không thể tải bảng điều khiển"
        description={error}
        onRetry={() => void loadDashboard()}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="grid gap-6 pb-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
          <h1 className="shrink-0 text-2xl font-extrabold tracking-tight text-primary">
            Tổng quan hệ thống
          </h1>
          <span
            className="h-5 w-px shrink-0 bg-primary/35"
            aria-hidden="true"
          />
          <p className="truncate text-sm font-medium text-foreground/65">
            Theo dõi vận hành Ghép đôi, Cửa hàng và Spa tại một nơi
          </p>
        </div>

        <div className="shrink-0">
          <DashboardTimeControls
            value={params}
            onChange={setParams}
            onRefresh={() => void loadDashboard(true)}
            refreshing={refreshing}
          />
        </div>
      </header>

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{error} Dữ liệu gần nhất vẫn đang được hiển thị.</span>
          <button
            type="button"
            onClick={() => void loadDashboard(true)}
            className="font-bold underline"
          >
            Thử lại
          </button>
        </div>
      )}

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Chỉ số tổng quan"
      >
        <MetricCard
          label="Tổng doanh thu"
          value={currency.format(data.analytics?.revenue?.total ?? 0)}
          detail={`Cửa hàng ${formatCompactMoney(data.analytics?.revenue?.store ?? 0)} · Spa ${formatCompactMoney(data.analytics?.revenue?.spa ?? 0)}`}
          icon={CircleDollarSign}
          tone="primary"
          badge={
            <RevenueGrowthBadge
              comparison={{
                range: data.analytics?.range,
                revenue: {
                  current: data.analytics?.revenue?.total ?? 0,
                  previous: data.analytics?.revenue?.previousTotal ?? 0,
                  changePercent: data.analytics?.revenue?.changePercent ?? 0,
                },
              }}
            />
          }
          context={data.analytics?.range?.label ?? ""}
        />
        <MetricCard
          label="Cửa hàng"
          value={data.stats.store.totalOrders.toLocaleString("vi-VN")}
          detail={`${data.stats.store.activeProducts.toLocaleString("vi-VN")} sản phẩm đang bán · ${data.stats.store.pendingOrders.toLocaleString("vi-VN")} đơn chờ xử lý`}
          icon={ShoppingBag}
          tone="primary"
          context="Xem tổng quan cửa hàng"
          href="/admin/store-overview"
        />
        <MetricCard
          label="Spa"
          value={data.stats.spa.totalBookings.toLocaleString("vi-VN")}
          detail={`${data.stats.spa.totalServices.toLocaleString("vi-VN")} dịch vụ · ${(data.stats.spa.pendingBookings ?? 0).toLocaleString("vi-VN")} lịch chờ xác nhận`}
          icon={Stethoscope}
          tone="teal"
          context="Xem tổng quan Spa"
          href="/admin/spa-overview"
        />
        <MetricCard
          label="Ghép đôi"
          value={data.stats.matching.totalMatches.toLocaleString("vi-VN")}
          detail={`${data.stats.pets.total.toLocaleString("vi-VN")} thú cưng · ${data.stats.matching.pendingReports.toLocaleString("vi-VN")} báo cáo đang mở`}
          icon={HeartHandshake}
          tone="blue"
          context="Xem khu vực ghép đôi"
          href="/admin/reports"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <div className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Doanh thu theo thời gian
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">
                Store và Spa
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Doanh thu được ghi nhận trong{" "}
                {(data.analytics?.range?.label ?? "").toLowerCase()}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
              <ChartLegend color="bg-primary" label="Store" />
              <ChartLegend color="bg-chart-2" label="Spa" />
            </div>
          </div>

          <div
            className="relative mt-6 h-80 w-full"
            aria-label="Biểu đồ cột doanh thu Store và Spa"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.analytics?.revenueSeries ?? []}
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
            {!hasRevenue && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-xl border bg-card/95 px-4 py-3 text-center shadow-sm">
                  <BarChart3 className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">
                    Chưa có doanh thu trong khoảng này
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-destructive">
                Trung tâm kiểm duyệt
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">
                Tác vụ cần Admin duyệt
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Giấy tờ thú cưng và báo cáo Matching đang mở.
              </p>
            </div>
            <span className="flex min-w-10 items-center justify-center rounded-xl bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
              {pendingCount}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <ModerationSummary
              label="Mới hôm nay"
              value={data.stats.moderation.createdToday}
              tone="primary"
            />
            <ModerationSummary
              label="Tồn quá 24 giờ"
              value={data.stats.moderation.overdue24Hours}
              tone={
                data.stats.moderation.overdue24Hours > 0 ? "danger" : "muted"
              }
            />
          </div>
          <div className="mt-5 grid gap-3">
            {pendingItems.map((item) => (
              <PendingLink key={item.label} {...item} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  context,
  icon: Icon,
  tone,
  badge,
  href,
}: {
  label: string;
  value: string | number;
  detail: string;
  context: string;
  icon: LucideIcon;
  tone: "primary" | "teal" | "blue" | "danger";
  badge?: React.ReactNode;
  href?: string;
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    teal: "bg-chart-2/10 text-chart-2",
    blue: "bg-chart-3/10 text-chart-3",
    danger: "bg-destructive/10 text-destructive",
  };
  const card = (
    <article
      className={`h-full rounded-2xl border bg-card p-5 shadow-sm transition-all ${
        href
          ? "group hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
          : "hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-bold leading-6 text-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-[22px] font-semibold leading-7 tracking-tight text-foreground/90">
            {value}
          </p>
        </div>
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <div className="mt-5 flex min-h-11 items-end justify-between gap-3 border-t pt-3.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-5 text-muted-foreground">
            {detail}
          </p>
          <p
            className={`mt-0.5 flex items-center gap-1 text-[13px] font-semibold leading-5 ${href ? "text-primary" : "text-foreground/80"}`}
          >
            {context}
            {href && (
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            )}
          </p>
        </div>
        {badge}
      </div>
    </article>
  );

  return href ? (
    <Link
      href={href}
      aria-label={context}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  ) : (
    card
  );
}

function ModerationSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "danger" | "muted";
}) {
  const tones = {
    primary: "border-primary/20 bg-primary/5 text-primary",
    danger: "border-destructive/20 bg-destructive/5 text-destructive",
    muted: "border-border bg-muted/40 text-muted-foreground",
  };

  return (
    <div className={`rounded-xl border px-3 py-3 ${tones[tone]}`}>
      <p className="text-xl font-extrabold">{value.toLocaleString("vi-VN")}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

function PendingLink({
  label,
  description,
  value,
  href,
  icon: Icon,
  tone,
}: {
  label: string;
  description: string;
  value: number;
  href: string;
  icon: LucideIcon;
  tone: "warning" | "danger";
}) {
  const tones = {
    warning: "bg-chart-4/15 text-foreground",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border p-3 transition hover:border-primary/40 hover:bg-muted/40"
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {value > 0 ? description : "Không có mục tồn đọng"}
        </p>
      </div>
      <span
        className={`min-w-8 rounded-lg px-2 py-1 text-center text-xs font-bold ${value > 0 ? tones[tone] : "bg-muted text-muted-foreground"}`}
      >
        {value}
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
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
    <div className="min-w-52 rounded-xl border bg-card p-3 shadow-lg">
      <p className="text-xs font-bold text-foreground">{label}</p>
      <div className="mt-3 grid gap-2 text-xs">
        <TooltipRow
          color="bg-primary"
          label="Store"
          value={currency.format(point.storeRevenue)}
        />
        <TooltipRow
          color="bg-chart-2"
          label="Spa"
          value={currency.format(point.spaRevenue)}
        />
        <div className="mt-1 flex items-center justify-between gap-5 border-t pt-2 font-bold">
          <span>Tổng doanh thu</span>
          <span>{currency.format(point.totalRevenue)}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Giao dịch</span>
          <span>{point.transactions}</span>
        </div>
      </div>
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`size-2 rounded-sm ${color}`} />
        {label}
      </span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ChartLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 pb-8">
      <div className="flex items-end justify-between gap-6">
        <div className="grid gap-3">
          <div className="h-3 w-36 rounded bg-muted" />
          <div className="h-9 w-72 rounded bg-muted" />
          <div className="h-4 w-96 max-w-full rounded bg-muted" />
        </div>
        <div className="hidden h-11 w-96 rounded-xl bg-muted lg:block" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-40 rounded-2xl border bg-card" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <div className="h-[430px] rounded-2xl border bg-card" />
        <div className="h-[430px] rounded-2xl border bg-card" />
      </div>
    </div>
  );
}

function StateBox({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
      <AlertTriangle className="mx-auto size-7 text-destructive" />
      <h2 className="mt-3 text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
      >
        <RefreshCw className="size-4" /> Thử lại
      </button>
    </div>
  );
}

function formatAxisMoney(value: number) {
  if (value >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 1)} tỷ`;
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)} tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatCompactMoney(value: number) {
  return (
    new Intl.NumberFormat("vi-VN", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value) + "đ"
  );
}
