"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  HeartHandshake,
  PawPrint,
  RefreshCw,
  ShoppingBag,
  Stethoscope,
  UsersRound,
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
import { adminApi, type AdminDashboardParams } from "@/lib/api/admin";

type RevenuePoint = {
  period: string;
  label: string;
  storeRevenue: number;
  spaRevenue: number;
  totalRevenue: number;
  transactions: number;
};

type DashboardRangeKey = "7d" | "30d" | "90d" | "12m" | "custom";
type ActivityFilter = "all" | "users" | "pets" | "verification" | "matching";

type DashboardData = {
  stats: {
    users: { total: number };
    pets: { total: number; verified: number; pendingVerification: number };
    matching: { totalMatches: number; pendingReports: number };
    store: {
      totalStores: number;
      activeStores: number;
      pendingStores: number;
      totalProducts: number;
      totalOrders: number;
      pendingOrders: number;
      activeProducts: number;
      outOfStockProducts: number;
      revenue: number;
    };
    spa: {
      totalBranches: number;
      activeBranches: number;
      pendingBranches: number;
      totalServices: number;
      totalBookings: number;
      pendingBookings?: number;
      revenue: number;
    };
  };
  analytics: {
    range: {
      key: DashboardRangeKey;
      label: string;
      from: string;
      to: string;
      granularity: "day" | "week" | "month";
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
  recentActivities: {
    users: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      createdAt: string;
    }>;
    pets: Array<{
      id: string;
      name: string;
      species: string;
      verificationBadge: string;
      createdAt: string;
    }>;
    petDocuments: Array<{
      id: string;
      status: string;
      type: string;
      createdAt: string;
      pet?: { name?: string };
    }>;
    matchingReports?: Array<{
      id: string;
      reason: string;
      targetType: string;
      status: string;
      createdAt: string;
      reporter?: { name?: string };
      reportedUser?: { name?: string };
      pet?: { name?: string };
    }>;
  };
};

type ActivityItem = {
  id: string;
  kind: Exclude<ActivityFilter, "all">;
  title: string;
  meta: string;
  status: string;
  createdAt: string;
  href: string;
};

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const RANGE_OPTIONS: Array<{
  key: Exclude<DashboardRangeKey, "custom">;
  label: string;
}> = [
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "90d", label: "90 ngày" },
  { key: "12m", label: "12 tháng" },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [params, setParams] = useState<AdminDashboardParams>({ range: "30d" });
  const [customFrom, setCustomFrom] = useState(() => dateInputOffset(-29));
  const [customTo, setCustomTo] = useState(() => dateInputOffset(0));
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
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

  const pendingCount = useMemo(() => {
    if (!data) return 0;
    return (
      data.stats.pets.pendingVerification +
      data.stats.matching.pendingReports +
      data.stats.store.pendingOrders +
      (data.stats.spa.pendingBookings ?? 0)
    );
  }, [data]);

  const pendingItems = useMemo(() => {
    if (!data) return [];
    return [
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
      {
        label: "Đơn hàng",
        description: "Đơn chờ xử lý",
        value: data.stats.store.pendingOrders,
        href: "/admin/store-orders",
        icon: ShoppingBag,
        tone: "primary" as const,
      },
      {
        label: "Lịch Spa",
        description: "Lịch chờ xác nhận",
        value: data.stats.spa.pendingBookings ?? 0,
        href: "/admin/spa-bookings",
        icon: Stethoscope,
        tone: "teal" as const,
      },
    ];
  }, [data]);

  const activities = useMemo<ActivityItem[]>(() => {
    if (!data) return [];
    const items: ActivityItem[] = [
      ...data.recentActivities.users.map((item) => ({
        id: `user-${item.id}`,
        kind: "users" as const,
        title: item.name,
        meta: `${item.email} · ${formatRole(item.role)}`,
        status: "Tài khoản mới",
        createdAt: item.createdAt,
        href: "/admin/users",
      })),
      ...data.recentActivities.pets.map((item) => ({
        id: `pet-${item.id}`,
        kind: "pets" as const,
        title: item.name,
        meta: `${formatStatus(item.species)} · ${formatStatus(item.verificationBadge)}`,
        status: "Hồ sơ mới",
        createdAt: item.createdAt,
        href: "/admin/pets",
      })),
      ...data.recentActivities.petDocuments.map((item) => ({
        id: `document-${item.id}`,
        kind: "verification" as const,
        title: item.pet?.name ?? "Hồ sơ thú cưng",
        meta: formatStatus(item.type),
        status: formatStatus(item.status),
        createdAt: item.createdAt,
        href: "/admin/pets?verification=pending",
      })),
      ...(data.recentActivities.matchingReports ?? []).map((item) => ({
        id: `report-${item.id}`,
        kind: "matching" as const,
        title: formatMatchingReportReason(item.reason),
        meta: `${item.reporter?.name ?? "Người dùng"} → ${item.targetType === "PET" ? (item.pet?.name ?? "Thú cưng") : (item.reportedUser?.name ?? "Người dùng")}`,
        status: formatStatus(item.status),
        createdAt: item.createdAt,
        href: "/admin/reports",
      })),
    ];
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [data]);

  const visibleActivities = useMemo(
    () =>
      activities
        .filter(
          (item) => activityFilter === "all" || item.kind === activityFilter,
        )
        .slice(0, 8),
    [activities, activityFilter],
  );

  const hasRevenue =
    data?.analytics.revenueSeries.some((item) => item.totalRevenue > 0) ??
    false;
  const customRangeInvalid = !customFrom || !customTo || customFrom > customTo;

  const selectPreset = (range: Exclude<DashboardRangeKey, "custom">) => {
    setShowCustomRange(false);
    setParams({ range });
  };

  const applyCustomRange = () => {
    if (customRangeInvalid) return;
    setParams({ range: "custom", from: customFrom, to: customTo });
  };

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
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Activity className="size-4" /> Trung tâm điều hành
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Tổng quan hệ thống
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Theo dõi sức khỏe vận hành của Ghép đôi, Cửa hàng và Spa tại một
            nơi.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" /> Cập nhật{" "}
            {formatDateTime(data.analytics.updatedAt)}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border bg-card p-1 shadow-sm">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => selectPreset(option.key)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  params.range === option.key && !showCustomRange
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustomRange((current) => !current)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                params.range === "custom" || showCustomRange
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <CalendarDays className="size-3.5" /> Tùy chọn
            </button>
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              disabled={refreshing}
              aria-label="Làm mới dữ liệu"
              className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw
                className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          {showCustomRange && (
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-card p-3 shadow-sm">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                Từ
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="h-9 rounded-lg border bg-background px-2 text-xs text-foreground"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                Đến
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="h-9 rounded-lg border bg-background px-2 text-xs text-foreground"
                />
              </label>
              <button
                type="button"
                disabled={customRangeInvalid}
                onClick={applyCustomRange}
                className="h-9 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Áp dụng
              </button>
            </div>
          )}
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
          value={currency.format(data.analytics.revenue.total)}
          detail={`Store ${formatCompactMoney(data.analytics.revenue.store)} · Spa ${formatCompactMoney(data.analytics.revenue.spa)}`}
          icon={CircleDollarSign}
          tone="primary"
          badge={<ChangeBadge value={data.analytics.revenue.changePercent} />}
          context={data.analytics.range.label}
        />
        <MetricCard
          label="Hệ sinh thái"
          value={data.stats.users.total.toLocaleString("vi-VN")}
          detail={`${data.stats.pets.total.toLocaleString("vi-VN")} thú cưng · ${data.stats.pets.verified} đã xác minh`}
          icon={UsersRound}
          tone="teal"
          context="Người dùng đã đăng ký"
        />
        <MetricCard
          label="Lượt ghép đôi"
          value={data.stats.matching.totalMatches.toLocaleString("vi-VN")}
          detail={`${data.stats.matching.pendingReports} báo cáo đang mở`}
          icon={HeartHandshake}
          tone="blue"
          context="Toàn hệ thống"
        />
        <MetricCard
          label="Cần xử lý"
          value={pendingCount.toLocaleString("vi-VN")}
          detail={
            pendingCount > 0
              ? "Các hàng chờ cần Admin kiểm tra"
              : "Không có công việc tồn đọng"
          }
          icon={pendingCount > 0 ? AlertTriangle : CheckCircle2}
          tone={pendingCount > 0 ? "danger" : "teal"}
          context="Trạng thái hiện tại"
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
                {data.analytics.range.label.toLowerCase()}.
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
                data={data.analytics.revenueSeries}
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
                Ưu tiên hôm nay
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">
                Hàng chờ xử lý
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Đi thẳng đến các tác vụ đang mở.
              </p>
            </div>
            <span className="flex min-w-10 items-center justify-center rounded-xl bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
              {pendingCount}
            </span>
          </div>
          <div className="mt-5 grid gap-3">
            {pendingItems.map((item) => (
              <PendingLink key={item.label} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Sức khỏe vận hành"
          title="Ba khu vực trọng yếu"
          description="Các tín hiệu cần theo dõi trên toàn bộ nền tảng."
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <SystemAreaCard
            icon={HeartHandshake}
            title="Ghép đôi"
            description="Kết nối và an toàn cộng đồng"
            href="/admin/reports"
            tone="blue"
            metrics={[
              { label: "Lượt ghép", value: data.stats.matching.totalMatches },
              {
                label: "Báo cáo mở",
                value: data.stats.matching.pendingReports,
                alert: data.stats.matching.pendingReports > 0,
              },
              { label: "Thú cưng", value: data.stats.pets.total },
              {
                label: "Chờ xác minh",
                value: data.stats.pets.pendingVerification,
                alert: data.stats.pets.pendingVerification > 0,
              },
            ]}
          />
          <SystemAreaCard
            icon={ShoppingBag}
            title="Cửa hàng"
            description={`${data.stats.store.activeStores}/${data.stats.store.totalStores} cửa hàng hoạt động`}
            href="/admin/store-orders"
            tone="primary"
            metrics={[
              { label: "Đơn hàng", value: data.stats.store.totalOrders },
              {
                label: "Chờ xử lý",
                value: data.stats.store.pendingOrders,
                alert: data.stats.store.pendingOrders > 0,
              },
              { label: "Đang bán", value: data.stats.store.activeProducts },
              {
                label: "Hết hàng",
                value: data.stats.store.outOfStockProducts,
                alert: data.stats.store.outOfStockProducts > 0,
              },
            ]}
          />
          <SystemAreaCard
            icon={Stethoscope}
            title="Spa"
            description={`${data.stats.spa.activeBranches}/${data.stats.spa.totalBranches} chi nhánh hoạt động`}
            href="/admin/spa-bookings"
            tone="teal"
            metrics={[
              { label: "Lịch đặt", value: data.stats.spa.totalBookings },
              {
                label: "Chờ xác nhận",
                value: data.stats.spa.pendingBookings ?? 0,
                alert: (data.stats.spa.pendingBookings ?? 0) > 0,
              },
              { label: "Dịch vụ", value: data.stats.spa.totalServices },
              {
                label: "Chi nhánh chờ",
                value: data.stats.spa.pendingBranches,
                alert: data.stats.spa.pendingBranches > 0,
              },
            ]}
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="Cập nhật hệ thống"
            title="Hoạt động gần đây"
            description="Dòng thời gian hợp nhất từ các khu vực của PetMatching."
          />
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1">
            {(
              [
                ["all", "Tất cả"],
                ["users", "Người dùng"],
                ["pets", "Thú cưng"],
                ["verification", "Xác minh"],
                ["matching", "Ghép đôi"],
              ] as Array<[ActivityFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivityFilter(key)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${activityFilter === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 divide-y">
          {visibleActivities.length > 0 ? (
            visibleActivities.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))
          ) : (
            <div className="py-12 text-center">
              <Activity className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Chưa có hoạt động trong nhóm này.
              </p>
            </div>
          )}
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
}: {
  label: string;
  value: string | number;
  detail: string;
  context: string;
  icon: typeof UsersRound;
  tone: "primary" | "teal" | "blue" | "danger";
  badge?: React.ReactNode;
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    teal: "bg-chart-2/10 text-chart-2",
    blue: "bg-chart-3/10 text-chart-3",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <div className="mt-4 flex min-h-10 items-end justify-between gap-3 border-t pt-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {detail}
          </p>
          <p className="mt-1 text-xs font-semibold text-foreground">
            {context}
          </p>
        </div>
        {badge}
      </div>
    </article>
  );
}

function ChangeBadge({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${positive ? "bg-chart-2/10 text-chart-2" : "bg-destructive/10 text-destructive"}`}
    >
      <Icon className="size-3.5" /> {Math.abs(value).toFixed(1)}%
    </span>
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
  icon: typeof ShoppingBag;
  tone: "warning" | "danger" | "primary" | "teal";
}) {
  const tones = {
    warning: "bg-chart-4/15 text-foreground",
    danger: "bg-destructive/10 text-destructive",
    primary: "bg-primary/10 text-primary",
    teal: "bg-chart-2/10 text-chart-2",
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

function SystemAreaCard({
  icon: Icon,
  title,
  description,
  href,
  tone,
  metrics,
}: {
  icon: typeof ShoppingBag;
  title: string;
  description: string;
  href: string;
  tone: "primary" | "teal" | "blue";
  metrics: Array<{ label: string; value: string | number; alert?: boolean }>;
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    teal: "bg-chart-2/10 text-chart-2",
    blue: "bg-chart-3/10 text-chart-3",
  };
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-foreground">{title}</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <Link
          href={href}
          aria-label={`Xem chi tiết ${title}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary"
        >
          <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p
              className={`text-xl font-bold ${metric.alert ? "text-destructive" : "text-foreground"}`}
            >
              {metric.value}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const config = {
    users: { icon: UsersRound, tone: "bg-primary/10 text-primary" },
    pets: { icon: PawPrint, tone: "bg-chart-2/10 text-chart-2" },
    verification: {
      icon: ClipboardCheck,
      tone: "bg-chart-4/15 text-foreground",
    },
    matching: {
      icon: AlertTriangle,
      tone: "bg-destructive/10 text-destructive",
    },
  }[item.kind];
  const Icon = config.icon;
  return (
    <Link
      href={item.href}
      className="group grid gap-3 py-4 transition first:pt-0 last:pb-0 hover:bg-muted/30 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:px-2"
    >
      <span
        className={`flex size-10 items-center justify-center rounded-xl ${config.tone}`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {item.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.meta}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
        <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {item.status}
        </span>
        <p className="text-xs text-muted-foreground sm:mt-1">
          {formatRelativeDate(item.createdAt)}
        </p>
      </div>
      <ArrowRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block" />
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

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

function dateInputOffset(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRole(role?: string) {
  const roles: Record<string, string> = {
    USER: "Người dùng",
    ADMIN: "Quản trị viên",
    MODERATOR: "Kiểm duyệt viên",
    STORE_MANAGER: "Quản lý cửa hàng",
    SPA_MANAGER: "Quản lý Spa",
    SPA_STAFF: "Nhân viên Spa",
  };
  return role ? (roles[role] ?? role) : "-";
}

function formatMatchingReportReason(reason?: string) {
  const labels: Record<string, string> = {
    INAPPROPRIATE_MESSAGE: "Tin nhắn không phù hợp",
    HARASSMENT: "Quấy rối",
    FAKE_INFORMATION: "Thông tin giả",
    PET_SAFETY: "An toàn thú cưng",
    NO_SHOW: "Không đến gặp",
    OTHER: "Lý do khác",
  };
  return reason ? (labels[reason] ?? reason) : "-";
}

function formatStatus(status?: string) {
  const statuses: Record<string, string> = {
    DOG: "Chó",
    CAT: "Mèo",
    NONE: "Chưa xác minh",
    PENDING: "Đang chờ",
    REVIEWING: "Đang xem xét",
    VERIFIED: "Đã xác minh",
    APPROVED: "Đã duyệt",
    REJECTED: "Đã từ chối",
    NEED_MORE_INFO: "Cần bổ sung",
    VACCINE_RECORD: "Hồ sơ tiêm chủng",
    PEDIGREE_CERT: "Chứng nhận phả hệ",
    RESOLVED: "Đã xử lý",
    DISMISSED: "Không phát hiện vi phạm",
    INSUFFICIENT_EVIDENCE: "Chưa đủ bằng chứng",
    ESCALATED: "Chuyển cấp xử lý",
  };
  return status ? (statuses[status] ?? status) : "-";
}
