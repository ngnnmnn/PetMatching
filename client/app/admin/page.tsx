'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
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
        label: 'Cửa hàng chờ duyệt',
        value: data.stats.store.pendingStores,
        href: '/admin/stores',
        tone: 'teal',
      },
      {
        label: 'Khiếu nại cửa hàng',
        value: data.stats.store.pendingComplaints,
        href: '/admin/store-complaints',
        tone: 'red',
      },
      {
        label: 'Chi nhánh spa chờ duyệt',
        value: data.stats.spa.pendingBranches,
        href: '/admin/spas',
        tone: 'teal',
      },
      {
        label: 'Khiếu nại spa',
        value: data.stats.spa.pendingComplaints,
        href: '/admin/spa-complaints',
        tone: 'red',
      },
    ];
  }, [data]);

  if (loading) return <LoadingState />;
  if (error || !data) return <StateBox title="Không thể tải bảng điều khiển" description={error || 'Không có dữ liệu trả về.'} />;

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-2xl border border-[#D8E0EA] bg-[#102A43] text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#7DD3C7]">Tổng quan hệ thống</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-normal sm:text-4xl">
              Theo dõi ghép đôi, cửa hàng và spa trong một bảng điều khiển.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#B8C7D8]">
              Nắm nhanh hàng chờ xác minh, luồng giao dịch đang hoạt động và các khiếu nại cần xử lý.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <HeroStat label="Doanh thu cửa hàng" value={currency.format(data.stats.store.revenue)} />
            <HeroStat label="Doanh thu spa" value={currency.format(data.stats.spa.revenue)} />
            <HeroStat label="Đơn hàng cửa hàng" value={data.stats.store.totalOrders} />
            <HeroStat label="Lịch đặt spa" value={data.stats.spa.totalBookings} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {primaryMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black tracking-normal">Hàng chờ cần xử lý</h3>
              <p className="mt-1 text-sm font-semibold text-[#64748B]">Những mục nên được quản trị viên kiểm tra trước.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingItems.map((item) => (
              <PendingLink key={item.label} {...item} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black tracking-normal">Nhịp hoạt động</h3>
          <div className="mt-4 grid gap-4">
            <PulseRow
              icon={ShoppingBag}
              label="Cửa hàng"
              value={`${data.stats.store.activeStores} đang hoạt động / ${data.stats.store.pendingStores} chờ duyệt`}
              meta={`${data.stats.store.totalProducts} sản phẩm, ${data.stats.store.totalOrders} đơn hàng`}
            />
            <PulseRow
              icon={Stethoscope}
              label="Spa"
              value={`${data.stats.spa.activeBranches} đang hoạt động / ${data.stats.spa.pendingBranches} chờ duyệt`}
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

      <section className="grid gap-6 xl:grid-cols-2">
        <ActivityPanel title="Người dùng gần đây" rows={data.recentActivities.users.map((item) => ({
          id: item.id,
          title: item.name,
          meta: `${item.email} - ${formatRole(item.role)}`,
          status: formatDate(item.createdAt),
        }))} />
        <ActivityPanel title="Yêu cầu xác minh thú cưng" rows={data.recentActivities.petDocuments.map((item) => ({
          id: item.id,
          title: item.pet?.name ?? item.type,
          meta: formatStatus(item.type),
          status: formatStatus(item.status),
        }))} />
        <ActivityPanel title="Thú cưng mới" rows={data.recentActivities.pets.map((item) => ({
          id: item.id,
          title: item.name,
          meta: `${formatStatus(item.species)} - ${formatStatus(item.verificationBadge)}`,
          status: formatDate(item.createdAt),
        }))} />
        <ActivityPanel title="Khiếu nại gần đây" rows={data.recentActivities.complaints.map((item) => ({
          id: item.id,
          title: item.title,
          meta: formatStatus(item.type),
          status: formatStatus(item.status),
        }))} />
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

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-[#B8C7D8]">{label}</p>
      <p className="mt-2 truncate text-2xl font-black tracking-normal text-white">{value}</p>
    </div>
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

function ActivityPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; title: string; meta: string; status: string }>;
}) {
  return (
    <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black tracking-normal">{title}</h3>
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
