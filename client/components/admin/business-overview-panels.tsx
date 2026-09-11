"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  MapPin,
  PackageCheck,
  PackageOpen,
  Scissors,
  ShoppingBag,
  TrendingUp,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DashboardTimeControls,
  RevenueGrowthBadge,
  type RevenueComparison,
} from "@/components/admin/dashboard-time-controls";
import type { AdminDashboardParams } from "@/lib/api/admin";

type RevenuePoint = { label: string; revenue: number };
type StatusPoint = { status: string; value: number };

type StoreOverviewData = {
  store?: {
    name?: string;
    address?: string | null;
    status?: string;
    manager?: { name?: string | null } | null;
  } | null;
  stats?: {
    products?: number;
    activeProducts?: number;
    outOfStockProducts?: number;
    lowStockProducts?: number;
    todayOrders?: number;
    totalOrders?: number;
    pendingOrders?: number;
    processingOrders?: number;
    recognizedOrders?: number;
    revenue?: number;
    itemsSold?: number;
  };
  analytics?: RevenueComparison;
  revenueSeries?: RevenuePoint[];
  statusDistribution?: StatusPoint[];
  topProducts?: Array<{
    id: string;
    name?: string;
    stock?: number;
    sold?: number;
  }>;
  recentOrders?: Array<{
    id: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    user?: { name?: string | null } | null;
    items?: Array<{ quantity?: number; product?: { name?: string } }>;
  }>;
};

type SpaOverviewData = {
  spa?: {
    name?: string;
    address?: string;
    status?: string;
    manager?: { name?: string | null } | null;
  } | null;
  stats?: {
    services?: number;
    inactiveServices?: number;
    staffCount?: number;
    activeStaffCount?: number;
    todayBookings?: number;
    totalBookings?: number;
    pendingBookings?: number;
    inProgressBookings?: number;
    recognizedBookings?: number;
    revenue?: number;
  };
  analytics?: RevenueComparison;
  revenueSeries?: RevenuePoint[];
  statusDistribution?: StatusPoint[];
  topServices?: Array<{
    id: string;
    name: string;
    bookings: number;
    revenue: number;
  }>;
  upcomingBookings?: Array<{
    id: string;
    status: string;
    scheduledAt: string;
    user?: { name?: string | null } | null;
    staff?: { name?: string | null } | null;
    service?: { name?: string | null } | null;
  }>;
};

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const compactMoney = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

const chartColors = {
  amber: "#F59E0B", blue: "#3B82F6", violet: "#8B5CF6",
  emerald: "#10B981", rose: "#F43F5E", orange: "#F97316",
} as const;

const chartTooltipStyle = {
  borderRadius: 12, borderColor: "var(--border)", backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)", fontSize: 12, fontWeight: 600,
} as const;

const storeStatusMeta: Record<string, StatusMeta> = {
  PENDING: { label: "Chờ xử lý", color: "bg-amber-500", chartColor: chartColors.amber },
  PACKED: { label: "Đang xử lý", color: "bg-blue-500", chartColor: chartColors.blue },
  PROCESSING: {
    label: "Đang xử lý",
    color: "bg-blue-500",
    chartColor: chartColors.blue,
  },
  SHIPPED: {
    label: "Đang giao",
    color: "bg-violet-500",
    chartColor: chartColors.violet,
  },
  DELIVERED: {
    label: "Đã hoàn thành",
    color: "bg-emerald-500",
    chartColor: chartColors.emerald,
  },
  CANCELLED: {
    label: "Không thành công",
    color: "bg-rose-500",
    chartColor: chartColors.rose,
  },
  EXPIRED: { label: "Đã hết hạn", color: "bg-rose-500", chartColor: chartColors.rose },
  PAYMENT_ERROR: {
    label: "Lỗi thanh toán",
    color: "bg-rose-500",
    chartColor: chartColors.rose,
  },
};

const spaStatusMeta: Record<string, StatusMeta> = {
  PENDING: {
    label: "Chờ xác nhận",
    color: "bg-amber-500",
    chartColor: chartColors.amber,
  },
  CONFIRMED: {
    label: "Đã xác nhận",
    color: "bg-blue-500",
    chartColor: chartColors.blue,
  },
  CHECK_IN: {
    label: "Đã check-in",
    color: "bg-violet-500",
    chartColor: chartColors.violet,
  },
  ARRIVED: {
    label: "Khách đã đến",
    color: "bg-violet-500",
    chartColor: chartColors.violet,
  },
  IN_PROGRESS: {
    label: "Đang thực hiện",
    color: "bg-violet-500",
    chartColor: chartColors.violet,
  },
  COMPLETED: {
    label: "Hoàn thành",
    color: "bg-emerald-500",
    chartColor: chartColors.emerald,
  },
  CANCELLED: {
    label: "Đã hủy / vắng",
    color: "bg-rose-500",
    chartColor: chartColors.rose,
  },
  NO_SHOW: {
    label: "Khách vắng mặt",
    color: "bg-rose-500",
    chartColor: chartColors.rose,
  },
  LATE: { label: "Trễ hẹn", color: "bg-orange-500", chartColor: chartColors.orange },
};

type StatusMeta = { label: string; color: string; chartColor: string };

const metricTones = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-blue-50 text-blue-700",
  teal: "bg-emerald-50 text-emerald-700",
  violet: "bg-violet-50 text-violet-700",
  danger: "bg-rose-50 text-rose-700",
};

export function StoreOverviewPanel({
  data,
  timeRange,
  onTimeRangeChange,
  onRefresh,
}: {
  data?: StoreOverviewData;
  timeRange: AdminDashboardParams;
  onTimeRangeChange: (range: AdminDashboardParams) => void;
  onRefresh: () => void;
}) {
  const stats = data?.stats ?? {};
  const productHealth = stats.products
    ? Math.round(((stats.activeProducts ?? 0) / stats.products) * 100)
    : 0;

  return (
    <OverviewShell>
      <OverviewRangeFilter
        value={timeRange}
        rangeLabel={data?.analytics?.range?.label}
        onChange={onTimeRangeChange}
        onRefresh={onRefresh}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          label="Doanh thu ghi nhận"
          value={money.format(stats.revenue ?? 0)}
          detail={`${(stats.recognizedOrders ?? 0).toLocaleString("vi-VN")} giao dịch được ghi nhận`}
          icon={CircleDollarSign}
          tone="primary"
          badge={<RevenueGrowthBadge comparison={data?.analytics} />}
        />
        <OverviewMetric
          label="Đơn hàng hôm nay"
          value={(stats.todayOrders ?? 0).toLocaleString("vi-VN")}
          detail={`${stats.pendingOrders ?? 0} đơn đang chờ xử lý`}
          icon={ShoppingBag}
          tone="blue"
          href="/admin/store-orders"
        />
        <OverviewMetric
          label="Sản phẩm"
          value={(stats.products ?? 0).toLocaleString("vi-VN")}
          detail={`${stats.activeProducts ?? 0} đang bán · ${(stats.itemsSold ?? 0).toLocaleString("vi-VN")} đã bán trong kỳ`}
          icon={PackageOpen}
          tone="teal"
          href="/admin/store-products"
        />
        <OverviewMetric
          label="Cảnh báo tồn kho"
          value={`${(stats.outOfStockProducts ?? 0) + (stats.lowStockProducts ?? 0)}`}
          detail={`${stats.outOfStockProducts ?? 0} hết hàng · ${stats.lowStockProducts ?? 0} sắp hết`}
          icon={AlertTriangle}
          tone="danger"
          href="/admin/store-products"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
        <RevenueChart
          title={`Doanh thu Store · ${data?.analytics?.range?.label ?? "Khoảng đã chọn"}`}
          data={data?.revenueSeries ?? []}
        />
        <BusinessHealthCard
          title={data?.store?.name ?? "PetMatching Store"}
          address={data?.store?.address}
          manager={data?.store?.manager?.name}
          active={data?.store?.status === "ACTIVE"}
          rows={[
            {
              label: "Sản phẩm đang bán",
              value: `${stats.activeProducts ?? 0}/${stats.products ?? 0}`,
            },
            { label: "Sức khỏe danh mục", value: `${productHealth}%` },
            { label: "Đơn đang vận hành", value: stats.processingOrders ?? 0 },
            { label: "Tổng đơn hàng", value: stats.totalOrders ?? 0 },
          ]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <StatusBreakdown
          title="Trạng thái đơn hàng"
          description="Tỷ trọng trên toàn bộ đơn hàng của cửa hàng."
          data={data?.statusDistribution ?? []}
          meta={storeStatusMeta}
        />
        <RankedList
          title="Sản phẩm bán chạy"
          description="Xếp hạng theo số lượng từ các đơn đã giao."
          href="/admin/store-products"
          empty="Chưa có dữ liệu sản phẩm đã bán."
          rows={(data?.topProducts ?? []).map((product) => ({
            id: product.id,
            title: product.name ?? "Sản phẩm",
            description: `Tồn kho: ${product.stock ?? 0}`,
            value: `${product.sold ?? 0} đã bán`,
          }))}
        />
      </div>

      <RecentList
        title="Đơn hàng gần đây"
        description="Năm đơn hàng mới nhất phát sinh trên Store."
        href="/admin/store-orders"
        empty="Chưa có đơn hàng nào."
        rows={(data?.recentOrders ?? []).map((order) => {
          const quantity = (order.items ?? []).reduce(
            (sum, item) => sum + (item.quantity ?? 0),
            0,
          );
          const itemNames = (order.items ?? [])
            .map((item) => item.product?.name)
            .filter(Boolean)
            .join(", ");
          return {
            id: order.id,
            title: order.user?.name ?? "Khách hàng",
            description: itemNames || `${quantity} sản phẩm`,
            date: dateTime.format(new Date(order.createdAt)),
            value: money.format(order.totalAmount),
            status: storeStatusMeta[order.status]?.label ?? order.status,
          };
        })}
      />
    </OverviewShell>
  );
}

export function SpaOverviewPanel({
  data,
  timeRange,
  onTimeRangeChange,
  onRefresh,
}: {
  data?: SpaOverviewData;
  timeRange: AdminDashboardParams;
  onTimeRangeChange: (range: AdminDashboardParams) => void;
  onRefresh: () => void;
}) {
  const stats = data?.stats ?? {};

  return (
    <OverviewShell>
      <OverviewRangeFilter
        value={timeRange}
        rangeLabel={data?.analytics?.range?.label}
        onChange={onTimeRangeChange}
        onRefresh={onRefresh}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          label="Doanh thu ghi nhận"
          value={money.format(stats.revenue ?? 0)}
          detail={`${stats.recognizedBookings ?? 0} giao dịch được ghi nhận`}
          icon={CircleDollarSign}
          tone="primary"
          badge={<RevenueGrowthBadge comparison={data?.analytics} />}
        />
        <OverviewMetric
          label="Lịch hẹn hôm nay"
          value={(stats.todayBookings ?? 0).toLocaleString("vi-VN")}
          detail={`${stats.pendingBookings ?? 0} lịch chờ xác nhận`}
          icon={CalendarClock}
          tone="blue"
          href="/admin/spa-bookings"
        />
        <OverviewMetric
          label="Dịch vụ Spa"
          value={(
            (stats.services ?? 0) + (stats.inactiveServices ?? 0)
          ).toLocaleString("vi-VN")}
          detail={`${stats.services ?? 0} đang mở · ${stats.inactiveServices ?? 0} tạm ngừng`}
          icon={Scissors}
          tone="teal"
          href="/admin/spa-services"
        />
        <OverviewMetric
          label="Nhân sự hoạt động"
          value={`${stats.activeStaffCount ?? 0}/${stats.staffCount ?? 0}`}
          detail={`${stats.services ?? 0} dịch vụ đang mở`}
          icon={UsersRound}
          tone="violet"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
        <RevenueChart
          title={`Doanh thu Spa · ${data?.analytics?.range?.label ?? "Khoảng đã chọn"}`}
          data={data?.revenueSeries ?? []}
        />
        <BusinessHealthCard
          title={data?.spa?.name ?? "PetMatching Spa"}
          address={data?.spa?.address}
          manager={data?.spa?.manager?.name}
          active={data?.spa?.status === "ACTIVE"}
          rows={[
            { label: "Dịch vụ đang mở", value: stats.services ?? 0 },
            { label: "Dịch vụ tạm ngừng", value: stats.inactiveServices ?? 0 },
            {
              label: "Lịch đang thực hiện",
              value: stats.inProgressBookings ?? 0,
            },
            { label: "Tổng lịch đặt", value: stats.totalBookings ?? 0 },
          ]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <StatusBreakdown
          title="Trạng thái lịch hẹn"
          description="Tỷ trọng trên toàn bộ lịch đặt của Spa."
          data={data?.statusDistribution ?? []}
          meta={spaStatusMeta}
        />
        <RankedList
          title="Dịch vụ nổi bật"
          description="Xếp hạng theo doanh thu từ lịch đã hoàn thành."
          href="/admin/spa-services"
          empty="Chưa có doanh thu dịch vụ."
          rows={(data?.topServices ?? []).map((service) => ({
            id: service.id,
            title: service.name,
            description: `${service.bookings} lượt hoàn thành`,
            value: money.format(service.revenue),
          }))}
        />
      </div>

      <RecentList
        title="Lịch hẹn sắp tới"
        description="Năm lịch gần nhất cần Spa chuẩn bị và theo dõi."
        href="/admin/spa-bookings"
        empty="Chưa có lịch hẹn sắp tới."
        rows={(data?.upcomingBookings ?? []).map((booking) => ({
          id: booking.id,
          title: booking.user?.name ?? "Khách hàng",
          description: `${booking.service?.name ?? "Dịch vụ Spa"} · ${booking.staff?.name ?? "Chưa phân công"}`,
          date: dateTime.format(new Date(booking.scheduledAt)),
          value: "",
          status: spaStatusMeta[booking.status]?.label ?? booking.status,
        }))}
      />
    </OverviewShell>
  );
}

function OverviewShell({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 bg-muted/30 p-5 sm:p-6">{children}</div>;
}

function OverviewRangeFilter({
  value,
  rangeLabel,
  onChange,
  onRefresh,
}: {
  value: AdminDashboardParams;
  rangeLabel?: string;
  onChange: (range: AdminDashboardParams) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-black text-foreground">
          Khoảng thời gian báo cáo
        </p>
        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
          {rangeLabel
            ? `${rangeLabel} · Áp dụng cho số liệu kinh doanh`
            : "Đang tải dữ liệu"}
        </p>
      </div>
      <DashboardTimeControls
        value={value}
        onChange={onChange}
        onRefresh={onRefresh}
      />
    </div>
  );
}

function OverviewMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  href,
  badge,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ShoppingBag;
  tone: keyof typeof metricTones;
  href?: string;
  badge?: ReactNode;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-muted-foreground">{label}</p>
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${metricTones[tone]}`}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-3 truncate text-2xl font-black tracking-tight text-foreground">
        {value}
      </p>
      <div className="mt-2 flex min-h-6 items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-muted-foreground">
          {detail}
        </p>
        {badge}
      </div>
    </>
  );
  const className =
    "rounded-2xl border border-border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}

function RevenueChart({
  title,
  data,
}: {
  title: string;
  data: RevenuePoint[];
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-primary">
            Xu hướng doanh thu
          </p>
          <h3 className="mt-1 text-lg font-black text-foreground">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Chỉ ghi nhận giao dịch đã hoàn thành, không hoàn tiền.
          </p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <TrendingUp className="size-5" />
        </span>
      </div>
      <div className="mt-5 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: -16 }}
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
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => compactMoney.format(Number(value))}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              formatter={(value) => [money.format(Number(value)), "Doanh thu"]}
              labelFormatter={(label) => `Ngày ${label}`}
              contentStyle={chartTooltipStyle}
            />
            <Bar
              dataKey="revenue"
              fill="var(--primary)"
              radius={[6, 6, 2, 2]}
              maxBarSize={44}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function BusinessHealthCard({
  title,
  address,
  manager,
  active,
  rows,
}: {
  title: string;
  address?: string | null;
  manager?: string | null;
  active: boolean;
  rows: Array<{ label: string; value: string | number }>;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-primary">
            Tình trạng vận hành
          </p>
          <h3 className="mt-1 truncate text-lg font-black text-foreground">
            {title}
          </h3>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
        >
          <span
            className={`size-2 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`}
          />
          {active ? "Đang mở" : "Tạm ngừng"}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-xs font-semibold text-muted-foreground">
        <p className="flex gap-2">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>{address || "Chưa cập nhật địa chỉ"}</span>
        </p>
        <p className="flex gap-2">
          <UserRoundCog className="size-3.5 shrink-0 text-primary" />
          <span>{manager || "Chưa phân công quản lý"}</span>
        </p>
      </div>
      <div className="mt-5 divide-y divide-border border-y border-border">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 py-3 text-sm"
          >
            <span className="font-semibold text-muted-foreground">{row.label}</span>
            <span className="font-black text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
      <Link
        href="/admin/system-profile"
        className="mt-4 inline-flex items-center gap-1 text-sm font-black text-primary"
      >
        Xem thông tin hệ thống <ChevronRight className="size-4" />
      </Link>
    </section>
  );
}

function StatusBreakdown({
  title,
  description,
  data,
  meta,
}: {
  title: string;
  description: string;
  data: StatusPoint[];
  meta: Record<string, StatusMeta>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-foreground">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {description}
          </p>
        </div>
        <PackageCheck className="size-5 text-primary" />
      </div>
      <div className="mt-3 grid items-center gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="relative mx-auto h-52 w-52">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((item) => (
                    <Cell
                      key={item.status}
                      fill={meta[item.status]?.chartColor ?? "var(--muted-foreground)"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, context) => [
                    Number(value).toLocaleString("vi-VN"),
                    meta[String(context.payload.status)]?.label ??
                      context.payload.status,
                  ]}
                  contentStyle={chartTooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="absolute inset-4 rounded-full border-[28px] border-border" />
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-foreground">{total}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Tổng
            </span>
          </div>
        </div>
        <div className="grid content-center gap-y-1">
          {data.map((item) => (
            <div
              key={item.status}
              className="flex min-w-0 items-center justify-between gap-3 border-b border-border py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-muted-foreground">
                <span
                  className={`size-2.5 shrink-0 rounded-full ${meta[item.status]?.color ?? "bg-slate-400"}`}
                />
                <span className="truncate">
                  {meta[item.status]?.label ?? item.status}
                </span>
              </span>
              <span className="text-sm font-black text-foreground">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RankedList({
  title,
  description,
  href,
  rows,
  empty,
}: {
  title: string;
  description: string;
  href: string;
  rows: Array<{
    id: string;
    title: string;
    description: string;
    value: string;
  }>;
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <SectionHeading title={title} description={description} href={href} />
      <div className="mt-4 divide-y divide-border">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">
                {row.title}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                {row.description}
              </p>
            </div>
            <p className="shrink-0 text-sm font-black text-primary">
              {row.value}
            </p>
          </div>
        ))}
        {!rows.length && <EmptyLine icon={PackageOpen} text={empty} />}
      </div>
    </section>
  );
}

function RecentList({
  title,
  description,
  href,
  rows,
  empty,
}: {
  title: string;
  description: string;
  href: string;
  rows: Array<{
    id: string;
    title: string;
    description: string;
    date: string;
    value: string;
    status: string;
  }>;
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <SectionHeading title={title} description={description} href={href} />
      <div className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1.4fr)_minmax(160px,.8fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">
                {row.title}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                {row.description}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Clock3 className="size-3.5 text-primary" />
                {row.date}
              </p>
              <p className="mt-1 text-xs font-bold text-primary">
                {row.status}
              </p>
            </div>
            {row.value && (
              <p className="text-sm font-black text-foreground">{row.value}</p>
            )}
          </div>
        ))}
        {!rows.length && <EmptyLine icon={CalendarClock} text={empty} />}
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-base font-black text-foreground">{title}</h3>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          {description}
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-primary"
      >
        Xem tất cả <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

function EmptyLine({
  icon: Icon,
  text,
}: {
  icon: typeof Scissors;
  text: string;
}) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Icon className="size-6" />
      <p className="text-sm font-semibold">{text}</p>
    </div>
  );
}
