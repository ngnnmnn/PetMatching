'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CircleDollarSign,
  Loader2,
  PawPrint,
  ShoppingBag,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin';

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
      pendingComplaints: number;
      revenue: number;
    };
    spa: {
      totalBranches: number;
      activeBranches: number;
      pendingBranches: number;
      totalServices: number;
      totalBookings: number;
      pendingComplaints: number;
      revenue: number;
    };
  };
  recentActivities: {
    users: Array<{ id: string; name: string; email: string; role: string; createdAt: string }>;
    pets: Array<{ id: string; name: string; species: string; verificationBadge: string; createdAt: string }>;
    petDocuments: Array<{ id: string; status: string; type: string; createdAt: string; pet?: { name?: string } }>;
    complaints: Array<{ id: string; type: string; status: string; title: string; createdAt: string }>;
  };
};

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.dashboard()
      .then((response) => setData(response.data))
      .catch(() => setError('Không thể tải bảng điều khiển quản trị.'))
      .finally(() => setLoading(false));
  }, []);

  const primaryMetrics = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Người dùng',
        value: data.stats.users.total,
        detail: 'Tài khoản đã đăng ký',
        icon: UsersRound,
        color: 'teal',
      },
      {
        label: 'Thú cưng',
        value: data.stats.pets.total,
        detail: `${data.stats.pets.verified} hồ sơ đã xác minh`,
        icon: PawPrint,
        color: 'orange',
      },
      {
        label: 'Ghép đôi',
        value: data.stats.matching.totalMatches,
        detail: `${data.stats.matching.pendingReports} báo cáo đang mở`,
        icon: BarChart3,
        color: 'blue',
      },
      {
        label: 'Cần xử lý',
        value: data.stats.pets.pendingVerification + data.stats.matching.pendingReports + data.stats.store.pendingComplaints + data.stats.spa.pendingComplaints,
        detail: 'Mục đang chờ quản trị viên xem xét',
        icon: AlertTriangle,
        color: 'red',
      },
    ];
  }, [data]);

  const pendingItems = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Xác minh thú cưng',
        value: data.stats.pets.pendingVerification,
        href: '/admin/pet-verifications',
        tone: 'amber',
      },
      {
        label: 'Báo cáo ghép đôi',
        value: data.stats.matching.pendingReports,
        href: '/admin/matching-reports',
        tone: 'red',
      },
      {
        label: 'Đơn hàng chờ xử lý',
        value: data.stats.store.pendingOrders,
        href: '/admin/store-orders',
        tone: 'teal',
      },
      {
        label: 'Khiếu nại cửa hàng',
        value: data.stats.store.pendingComplaints,
        href: '/admin/reports?type=STORE&status=PENDING',
        tone: 'red',
      },
      {
        label: 'Spa cần kích hoạt',
        value: data.stats.spa.pendingBranches,
        href: '/admin/spas',
        tone: 'teal',
      },
      {
        label: 'Khiếu nại spa',
        value: data.stats.spa.pendingComplaints,
        href: '/admin/reports?type=SPA&status=PENDING',
        tone: 'red',
      },
    ];
  }, [data]);

  if (loading) return <LoadingState />;
  if (error || !data) return <StateBox title="Không thể tải bảng điều khiển" description={error || 'Không có dữ liệu trả về.'} />;

  return (
    <div className="grid gap-5 pb-8">
      <section className="relative overflow-hidden rounded-3xl bg-[#0E3B3A] text-white shadow-[0_16px_40px_rgba(15,118,110,0.18)]">
        <div className="absolute -right-20 -top-28 size-80 rounded-full bg-[#1D7770]/55" />
        <div className="absolute -bottom-32 right-44 size-64 rounded-full border-[40px] border-white/5" />
        <div className="relative grid gap-7 p-6 lg:grid-cols-[minmax(0,1fr)_500px] lg:p-8">
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#A7F3D0]">
                  <CheckCircle2 className="size-3.5" /> Trung tâm điều hành
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B9D8D5]"><CalendarDays className="size-3.5" />{formatLongDate(new Date())}</span>
              </div>
              <h2 className="mt-5 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">Tổng quan vận hành PetMatching</h2>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[#B9D8D5]">Theo dõi người dùng, ghép đôi, cửa hàng và Spa tại một nơi duy nhất.</p>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <StatusChip label="Hệ thống" value="Đang hoạt động" />
              <StatusChip label="Mục cần xử lý" value={String(primaryMetrics[3]?.value ?? 0)} warning={Number(primaryMetrics[3]?.value ?? 0) > 0} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HeroStat icon={CircleDollarSign} label="Doanh thu cửa hàng" value={currency.format(data.stats.store.revenue)} />
            <HeroStat icon={CircleDollarSign} label="Doanh thu Spa" value={currency.format(data.stats.spa.revenue)} />
            <HeroStat icon={ShoppingBag} label="Tổng đơn hàng" value={data.stats.store.totalOrders} />
            <HeroStat icon={CalendarDays} label="Tổng lịch Spa" value={data.stats.spa.totalBookings} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {primaryMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[#B54708]">Ưu tiên hôm nay</p>
              <h3 className="mt-1 text-xl font-black tracking-normal">Hàng chờ cần xử lý</h3>
              <p className="mt-1 text-sm font-semibold text-[#64748B]">Truy cập nhanh những công việc cần Admin kiểm tra.</p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Clock3 className="size-5" /></span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingItems.map((item) => (
              <PendingLink key={item.label} {...item} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#0F766E]">Sức khỏe hệ thống</p>
          <h3 className="mt-1 text-xl font-black tracking-normal">Nhịp hoạt động</h3>
          <div className="mt-4 grid gap-4">
            <PulseRow
              icon={ShoppingBag}
              label="PetMatching Store"
              value={`${data.stats.store.totalOrders} đơn hàng / ${data.stats.store.pendingOrders} chờ xử lý`}
              meta={`${data.stats.store.activeProducts} sản phẩm đang bán, ${data.stats.store.outOfStockProducts} hết hàng`}
            />
            <PulseRow
              icon={Stethoscope}
              label="Spa"
              value={data.stats.spa.activeBranches ? 'Đang nhận lịch' : 'Tạm ngừng nhận lịch'}
              meta={`${data.stats.spa.totalServices} dịch vụ, ${data.stats.spa.totalBookings} lịch đặt`}
            />
            <PulseRow
              icon={ClipboardCheck}
              label="Xác minh"
              value={`${data.stats.pets.verified} thú cưng đã xác minh`}
              meta={`${data.stats.pets.pendingVerification} yêu cầu đang chờ`}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionHeading eyebrow="Vận hành kinh doanh" title="Cửa hàng và Spa" description="Các chỉ số quan trọng của hai khối dịch vụ chính." />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <OperationCard
            icon={ShoppingBag}
            title="PetMatching Store"
            href="/admin/store-orders"
            tone="teal"
            revenue={data.stats.store.revenue}
            metrics={[
              { label: 'Đơn hàng', value: data.stats.store.totalOrders },
              { label: 'Chờ xử lý', value: data.stats.store.pendingOrders },
              { label: 'Sản phẩm đang bán', value: data.stats.store.activeProducts },
              { label: 'Hết hàng', value: data.stats.store.outOfStockProducts },
            ]}
          />
          <OperationCard
            icon={Stethoscope}
            title="PetMatching Spa"
            href="/admin/spa-bookings"
            tone="violet"
            revenue={data.stats.spa.revenue}
            metrics={[
              { label: 'Lịch đặt', value: data.stats.spa.totalBookings },
              { label: 'Trạng thái nhận lịch', value: data.stats.spa.activeBranches ? 'Đang mở' : 'Tạm ngừng' },
              { label: 'Dịch vụ', value: data.stats.spa.totalServices },
              { label: 'Khiếu nại chờ xử lý', value: data.stats.spa.pendingComplaints },
            ]}
          />
        </div>
      </section>

      <section>
        <SectionHeading eyebrow="Cập nhật hệ thống" title="Hoạt động gần đây" description="Thông tin mới nhất phát sinh trên toàn bộ nền tảng." />
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ActivityPanel icon={UsersRound} title="Người dùng gần đây" href="/admin/users" rows={data.recentActivities.users.map((item) => ({
          id: item.id,
          title: item.name,
          meta: `${item.email} - ${formatRole(item.role)}`,
          status: formatDate(item.createdAt),
        }))} />
        <ActivityPanel icon={ClipboardCheck} title="Yêu cầu xác minh" href="/admin/pet-verifications" rows={data.recentActivities.petDocuments.map((item) => ({
          id: item.id,
          title: item.pet?.name ?? item.type,
          meta: formatStatus(item.type),
          status: formatStatus(item.status),
        }))} />
        <ActivityPanel icon={PawPrint} title="Thú cưng mới" href="/admin/pets" rows={data.recentActivities.pets.map((item) => ({
          id: item.id,
          title: item.name,
          meta: `${formatStatus(item.species)} - ${formatStatus(item.verificationBadge)}`,
          status: formatDate(item.createdAt),
        }))} />
        <ActivityPanel icon={AlertTriangle} title="Khiếu nại gần đây" href="/admin/reports" rows={data.recentActivities.complaints.map((item) => ({
          id: item.id,
          title: item.title,
          meta: formatStatus(item.type),
          status: formatStatus(item.status),
        }))} />
        </div>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#D8E0EA] bg-white">
      <Loader2 className="size-8 animate-spin text-[#0F766E]" />
    </div>
  );
}

function StateBox({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-[#D8E0EA] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm font-semibold text-[#64748B]">{description}</p>
    </div>
  );
}

function HeroStat({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm transition hover:bg-white/15">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#B9D8D5]">{label}</p>
        <Icon className="size-4 text-[#A7F3D0]" />
      </div>
      <p className="mt-3 truncate text-xl font-black tracking-normal text-white sm:text-2xl">{value}</p>
    </div>
  );
}

function StatusChip({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${warning ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'}`}>
      <span className={`size-2 rounded-full ${warning ? 'bg-amber-300' : 'bg-emerald-300'}`} />
      {label}: <strong className="font-black">{value}</strong>
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof UsersRound;
  color: string;
}) {
  const tones: Record<string, string> = {
    teal: 'bg-[#E7F3F1] text-[#0F766E]',
    orange: 'bg-[#FFF1E8] text-[#C2410C]',
    blue: 'bg-[#EAF1FF] text-[#1D4ED8]',
    red: 'bg-[#FFF1F0] text-[#B42318]',
  };

  return (
    <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black text-[#64748B]">{label}</p>
          <p className="mt-3 truncate text-3xl font-black tracking-normal text-[#111827]">{value}</p>
        </div>
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tones[color]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 truncate text-sm font-semibold text-[#64748B]">{detail}</p>
    </div>
  );
}

function PendingLink({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: string;
}) {
  const tones: Record<string, string> = {
    amber: 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]',
    red: 'bg-[#FFF1F0] text-[#B42318] border-[#FECDCA]',
    teal: 'bg-[#E7F3F1] text-[#0F766E] border-[#BFE3DE]',
  };

  return (
    <Link
      href={href}
      className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[#D8E0EA] bg-[#FAFBFC] p-4 transition hover:border-[#0F766E] hover:bg-white"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[#172033]">{label}</p>
        <p className="mt-1 text-xs font-bold text-[#64748B]">Hàng chờ mở</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`min-w-10 rounded-lg border px-2.5 py-1.5 text-center text-sm font-black ${tones[tone]}`}>
          {value}
        </span>
        <ArrowRight className="size-4 text-[#94A3B8] transition group-hover:translate-x-0.5 group-hover:text-[#0F766E]" />
      </div>
    </Link>
  );
}

function PulseRow({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl bg-[#F7F9FB] p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#0F766E] shadow-sm">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-black text-[#172033]">{label}</p>
        <p className="mt-1 truncate text-sm font-bold text-[#475569]">{value}</p>
        <p className="mt-1 truncate text-xs font-semibold text-[#64748B]">{meta}</p>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wider text-[#0F766E]">{eyebrow}</p>
      <h3 className="mt-1 text-xl font-black tracking-normal text-[#172033]">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-[#64748B]">{description}</p>
    </div>
  );
}

function OperationCard({
  icon: Icon,
  title,
  href,
  tone,
  revenue,
  metrics,
}: {
  icon: typeof ShoppingBag;
  title: string;
  href: string;
  tone: 'teal' | 'violet';
  revenue: number;
  metrics: Array<{ label: string; value: string | number }>;
}) {
  const styles = tone === 'teal'
    ? { icon: 'bg-[#E7F3F1] text-[#0F766E]', line: 'bg-[#0F766E]', revenue: 'text-[#0F766E]' }
    : { icon: 'bg-violet-50 text-violet-700', line: 'bg-violet-600', revenue: 'text-violet-700' };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-y-0 left-0 w-1 ${styles.line}`} />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`flex size-11 items-center justify-center rounded-xl ${styles.icon}`}><Icon className="size-5" /></span>
          <div><h4 className="text-base font-black text-[#172033]">{title}</h4><p className="mt-0.5 text-xs font-semibold text-[#64748B]">Tổng quan hoạt động</p></div>
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-black text-[#64748B] hover:text-[#0F766E]">Chi tiết <ArrowRight className="size-3.5" /></Link>
      </div>
      <div className="mt-5 rounded-xl bg-[#F7F9FB] p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">Tổng doanh thu</p>
        <p className={`mt-1 text-2xl font-black ${styles.revenue}`}>{currency.format(revenue)}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-[#E5EAF0] px-3 py-3">
            <p className="text-xl font-black text-[#172033]">{metric.value}</p>
            <p className="mt-1 text-[11px] font-bold text-[#64748B]">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityPanel({
  icon: Icon,
  title,
  href,
  rows,
}: {
  icon: typeof UsersRound;
  title: string;
  href: string;
  rows: Array<{ id: string; title: string; meta: string; status: string }>;
}) {
  return (
    <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-[#E7F3F1] text-[#0F766E]"><Icon className="size-4" /></span><h3 className="text-base font-black tracking-normal">{title}</h3></div>
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-black text-[#64748B] hover:text-[#0F766E]">Xem tất cả <ArrowRight className="size-3.5" /></Link>
      </div>
      <div className="mt-4 divide-y divide-[#E5EAF0]">
        {rows.length ? rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#172033]">{row.title}</p>
              <p className="mt-1 truncate text-xs font-semibold text-[#64748B]">{row.meta}</p>
            </div>
            <span className="self-center rounded-lg bg-[#F2F5F8] px-2.5 py-1 text-xs font-black text-[#475569]">
              {row.status}
            </span>
          </div>
        )) : (
          <p className="py-8 text-sm font-semibold text-[#64748B]">Chưa có dữ liệu.</p>
        )}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN');
}

function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
}

function formatRole(role?: string) {
  const roles: Record<string, string> = {
    USER: 'Người dùng',
    ADMIN: 'Quản trị viên',
    MODERATOR: 'Kiểm duyệt viên',
    STORE_MANAGER: 'Quản lý cửa hàng',
    SPA_MANAGER: 'Quản lý spa',
    SPA_STAFF: 'Nhân viên spa',
  };

  return role ? roles[role] ?? role : '-';
}

function formatStatus(status?: string) {
  const statuses: Record<string, string> = {
    DOG: 'Chó',
    CAT: 'Mèo',
    NONE: 'Chưa xác minh',
    PENDING: 'Đang chờ',
    VERIFIED: 'Đã xác minh',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
    NEED_MORE_INFO: 'Cần bổ sung',
    USER: 'Người dùng',
    PET: 'Thú cưng',
    MATCHING: 'Ghép đôi',
    STORE: 'Cửa hàng',
    SPA: 'Spa',
    REVIEW: 'Đánh giá',
    RESOLVED: 'Đã xử lý',
    DISMISSED: 'Đã bỏ qua',
    ESCALATED: 'Đã chuyển cấp',
  };

  return status ? statuses[status] ?? status : '-';
}
