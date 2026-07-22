'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Mail, PackageOpen, PauseCircle, PlayCircle, Search, ShieldAlert, UserCheck, UsersRound, UserX, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AccountStatus,
  AdminRole,
  adminApi,
  ApprovalStatus,
  HidePetReason,
  RestorePetReason,
} from '@/lib/api/admin';

type Row = Record<string, any>;

type SpaManagerRoleFlow = {
  mode: 'GRANT' | 'REVOKE';
  user: Row;
};

type PetModerationFlow = {
  mode: 'HIDE' | 'RESTORE';
  pet: Row;
};

const roleOptions: AdminRole[] = ['USER', 'STORE_MANAGER', 'SPA_MANAGER'];
const accountStatusOptions: AccountStatus[] = ['ACTIVE', 'SUSPENDED', 'PENDING_MANAGER'];
const complaintTypeOptions = [
  ['ALL', 'Tất cả nhóm'],
  ['STORE', 'Cửa hàng'],
  ['SPA', 'Spa'],
  ['MATCHING', 'Ghép đôi'],
  ['PET', 'Thú cưng'],
  ['USER', 'Người dùng'],
  ['REVIEW', 'Đánh giá'],
] as const;
const complaintTargetOptions = [
  ['ALL', 'Tất cả đối tượng'],
  ['ORDER', 'Đơn hàng'],
  ['PRODUCT', 'Sản phẩm'],
] as const;
const complaintStatusOptions = [
  ['ALL', 'Tất cả trạng thái'],
  ['PENDING', 'Chờ xử lý'],
  ['RESOLVED', 'Đã xử lý'],
  ['ESCALATED', 'Đã chuyển cấp'],
  ['DISMISSED', 'Đã bỏ qua'],
] as const;
const readOnlySections = new Set(['stores', 'store-overview', 'store-products', 'store-orders', 'store-settings', 'spa-overview', 'spa-services', 'spa-staff-schedule', 'spa-bookings']);

const sectionConfig: Record<string, {
  title: string;
  description: string;
  loader: () => Promise<{ data: Row[] | Row }>;
  columns: Array<{ key: string; label: string; render?: (row: Row) => ReactNode }>;
}> = {
  users: {
    title: 'Người dùng & vai trò',
    description: 'Xem người dùng, gán vai trò và khóa hoặc mở khóa tài khoản.',
    loader: adminApi.users,
    columns: [
      { key: 'name', label: 'Tên' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Vai trò', render: (row) => formatRole(row.role) },
      { key: 'accountStatus', label: 'Trạng thái', render: (row) => formatStatus(row.accountStatus) },
      { key: 'isVerified', label: 'Email xác thực', render: (row) => row.isVerified ? 'Có' : 'Không' },
      { key: 'createdAt', label: 'Ngày tạo', render: dateCell },
    ],
  },
  pets: {
    title: 'Thú cưng',
    description: 'Giám sát hồ sơ thú cưng trên toàn hệ thống và trạng thái hiển thị.',
    loader: adminApi.pets,
    columns: [
      { key: 'name', label: 'Thú cưng' },
      { key: 'species', label: 'Loài' },
      { key: 'breed', label: 'Giống' },
      { key: 'owner', label: 'Chủ sở hữu', render: (row) => row.owner?.name ?? '-' },
      { key: 'verificationBadge', label: 'Xác minh', render: (row) => formatStatus(row.verificationBadge) },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
    ],
  },
  'pet-verifications': {
    title: 'Xác minh thú cưng',
    description: 'Kiểm tra giấy tờ người dùng tải lên và xác nhận hồ sơ thú cưng.',
    loader: adminApi.petVerifications,
    columns: [
      { key: 'pet', label: 'Thú cưng', render: (row) => row.pet?.name ?? '-' },
      { key: 'type', label: 'Loại giấy tờ', render: (row) => formatDocumentType(row.type) },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
      { key: 'imageUrls', label: 'Tài liệu', render: (row) => renderDocumentLinks(row.imageUrls) },
      { key: 'userNote', label: 'Ghi chú người dùng', render: (row) => row.userNote ?? '-' },
      { key: 'createdAt', label: 'Ngày gửi', render: dateCell },
    ],
  },
  'matching-reports': {
    title: 'Báo cáo ghép đôi',
    description: 'Các báo cáo liên quan đến thú cưng, hồ sơ và hoạt động ghép đôi.',
    loader: adminApi.matchingReports,
    columns: [
      { key: 'petId', label: 'Mã thú cưng' },
      { key: 'userId', label: 'Người báo cáo' },
      { key: 'reason', label: 'Lý do' },
      { key: 'isResolved', label: 'Đã xử lý', render: (row) => row.isResolved ? 'Có' : 'Không' },
      { key: 'createdAt', label: 'Ngày tạo', render: dateCell },
    ],
  },
  stores: {
    title: 'Tổng quan cửa hàng',
    description: 'Theo dõi thông tin và các chỉ số hoạt động của cửa hàng PetMatching duy nhất.',
    loader: adminApi.stores,
    columns: [
      { key: 'name', label: 'Tên cửa hàng' },
      { key: 'manager', label: 'Nhân sự quản lý', render: (row) => row.manager?.name ?? 'Chưa phân công' },
      { key: 'phone', label: 'Điện thoại' },
      { key: 'address', label: 'Địa chỉ' },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
      { key: '_count', label: 'Sản phẩm', render: (row) => row._count?.products ?? 0 },
      { key: 'orders', label: 'Đơn hàng', render: (row) => row._count?.orders ?? 0 },
    ],
  },
  'store-overview': {
    title: 'Tổng quan cửa hàng',
    description: 'Dashboard mini theo dõi nhanh hoạt động kinh doanh của PetMatching Store.',
    loader: adminApi.storeDashboard,
    columns: [],
  },
  'store-products': {
    title: 'Sản phẩm',
    description: 'Giám sát danh mục, giá bán, tồn kho và trạng thái sản phẩm của PetMatching Store.',
    loader: adminApi.storeProducts,
    columns: [
      { key: 'id', label: 'Mã sản phẩm' },
      { key: 'name', label: 'Tên sản phẩm' },
      { key: 'category', label: 'Danh mục' },
      { key: 'brand', label: 'Thương hiệu' },
      { key: 'originalPrice', label: 'Giá bán', render: (row) => moneyCell({ price: row.originalPrice }) },
      { key: 'salePrice', label: 'Giá ưu đãi', render: (row) => row.salePrice ? moneyCell({ price: row.salePrice }) : '-' },
      { key: 'stock', label: 'Tồn kho' },
      { key: 'isActive', label: 'Trạng thái', render: (row) => row.isActive ? 'Đang bán' : 'Ngừng bán' },
      { key: 'updatedAt', label: 'Cập nhật', render: dateCell },
    ],
  },
  'store-orders': {
    title: 'Đơn hàng',
    description: 'Theo dõi toàn bộ đơn hàng của PetMatching Store ở chế độ chỉ xem.',
    loader: adminApi.storeOrders,
    columns: [
      { key: 'id', label: 'Mã đơn' },
      { key: 'user', label: 'Khách hàng', render: (row) => row.user?.name ?? '-' },
      { key: 'items', label: 'Số sản phẩm', render: (row) => row.items?.reduce((sum: number, item: Row) => sum + (item.quantity ?? 0), 0) ?? 0 },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
      { key: 'totalAmount', label: 'Tổng tiền', render: moneyCell },
      { key: 'createdAt', label: 'Ngày đặt', render: dateCell },
    ],
  },
  'store-settings': {
    title: 'Cấu hình cửa hàng',
    description: 'Cập nhật thông tin chính thức của cửa hàng PetMatching hiển thị trên hệ thống.',
    loader: adminApi.stores,
    columns: [],
  },
  spas: {
    title: 'Thông tin Spa',
    description: 'Theo dõi thông tin và trạng thái nhận lịch của Spa PetMatching.',
    loader: adminApi.spas,
    columns: [],
  },
  'spa-overview': {
    title: 'Tổng quan Spa',
    description: 'Dashboard mini theo dõi nhanh toàn bộ hoạt động của Spa PetMatching.',
    loader: adminApi.spaDashboard,
    columns: [],
  },
  'spa-services': {
    title: 'Dịch vụ Spa',
    description: 'Theo dõi danh mục, giá, thời lượng và trạng thái dịch vụ.',
    loader: adminApi.spaServices,
    columns: [
      { key: 'name', label: 'Dịch vụ' },
      { key: 'description', label: 'Mô tả' },
      { key: 'price', label: 'Giá', render: moneyCell },
      { key: 'durationMin', label: 'Thời lượng', render: (row) => `${row.durationMin} phút` },
      { key: 'isActive', label: 'Trạng thái', render: (row) => row.isActive ? 'Đang hoạt động' : 'Tạm ngừng' },
      { key: '_count', label: 'Lượt đặt', render: (row) => row._count?.bookings ?? 0 },
    ],
  },
  'spa-staff-schedule': {
    title: 'Lịch nhân viên',
    description: 'Theo dõi lịch Spa đã phân công cho từng nhân viên.',
    loader: adminApi.spaStaffSchedule,
    columns: [
      { key: 'staff', label: 'Nhân viên', render: (row) => row.staff?.name ?? '-' },
      { key: 'service', label: 'Dịch vụ', render: (row) => row.service?.name ?? '-' },
      { key: 'pet', label: 'Thú cưng', render: (row) => row.pet?.name ?? row.petName ?? '-' },
      { key: 'scheduledAt', label: 'Thời gian', render: dateCell },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
    ],
  },
  'spa-bookings': {
    title: 'Lịch đặt spa',
    description: 'Theo dõi toàn bộ lịch đặt của Spa PetMatching ở chế độ chỉ xem.',
    loader: adminApi.spaBookings,
    columns: [
      { key: 'user', label: 'Khách hàng', render: (row) => row.user?.name ?? '-' },
      { key: 'service', label: 'Dịch vụ', render: (row) => row.service?.name ?? '-' },
      { key: 'staff', label: 'Nhân viên', render: (row) => row.staff?.name ?? '-' },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
      { key: 'scheduledAt', label: 'Thời gian hẹn', render: dateCell },
    ],
  },
  reports: {
    title: 'Báo cáo & khiếu nại',
    description: 'Hàng chờ kiểm duyệt tập trung cho mọi loại báo cáo và khiếu nại.',
    loader: () => adminApi.complaints(),
    columns: complaintColumns(),
  },
};

export default function AdminSectionPage() {
  const params = useParams<{ section: string }>();
  const section = params.section;
  const config = sectionConfig[section] ?? sectionConfig.reports;
  const hasActions = !readOnlySections.has(section);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [complaintType, setComplaintType] = useState('ALL');
  const [complaintTarget, setComplaintTarget] = useState('ALL');
  const [complaintStatus, setComplaintStatus] = useState('ALL');
  const [spaManagerRoleFlow, setSpaManagerRoleFlow] = useState<SpaManagerRoleFlow | null>(null);
  const [petModerationFlow, setPetModerationFlow] = useState<PetModerationFlow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    config.loader()
      .then((response) => setRows(normalizeRows(section, response.data)))
      .catch(() => setError('Không thể tải dữ liệu cho mục quản trị này.'))
      .finally(() => setLoading(false));
  }, [config, section]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (section !== 'reports') return;
    const query = new URLSearchParams(window.location.search);
    setComplaintType(query.get('type') ?? 'ALL');
    setComplaintTarget(query.get('targetType') ?? 'ALL');
    setComplaintStatus(query.get('status') ?? 'ALL');
  }, [section]);

  const visibleRows = useMemo(() => {
    if (section !== 'reports') return rows;
    return rows.filter((row) =>
      (complaintType === 'ALL' || row.type === complaintType) &&
      (complaintTarget === 'ALL' || row.targetType === complaintTarget) &&
      (complaintStatus === 'ALL' || row.status === complaintStatus),
    );
  }, [complaintStatus, complaintTarget, complaintType, rows, section]);

  const titleStats = useMemo(() => {
    if (section === 'store-overview') {
      const stats = rows[0]?.stats ?? {};
      return { total: stats.todayOrders ?? 0, active: stats.completedOrders ?? 0, pending: stats.pendingOrders ?? 0 };
    }
    if (section === 'spa-overview') {
      const stats = rows[0]?.stats ?? {};
      return { total: stats.todayBookings ?? 0, active: stats.completedBookings ?? 0, pending: stats.pendingBookings ?? 0 };
    }
    const pending = rows.filter((row) => row.status === 'PENDING' || row.accountStatus === 'PENDING_MANAGER').length;
    const active = section === 'spa-services'
      ? rows.filter((row) => row.isActive).length
      : section === 'reports'
      ? rows.filter((row) => row.status === 'RESOLVED').length
      : rows.filter((row) => row.status === 'ACTIVE' || row.accountStatus === 'ACTIVE').length;
    if (section === 'store-products') {
      return {
        total: rows.length,
        active: rows.filter((row) => row.isActive).length,
        pending: rows.filter((row) => (row.stock ?? 0) === 0).length,
      };
    }
    return { total: rows.length, pending, active };
  }, [rows, section]);

  const runAction = async (row: Row, action: () => Promise<unknown>, success: string) => {
    setSavingId(row.id);
    try {
      await action();
      toast.success(success);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Thao tác thất bại.');
    } finally {
      setSavingId('');
    }
  };

  const handleRoleChange = (row: Row, nextRole: AdminRole) => {
    if (nextRole === row.role) return;

    if (row.role === 'USER' && nextRole === 'SPA_MANAGER') {
      setSpaManagerRoleFlow({ mode: 'GRANT', user: row });
      return;
    }

    if (row.role === 'SPA_MANAGER' && nextRole === 'USER') {
      setSpaManagerRoleFlow({ mode: 'REVOKE', user: row });
      return;
    }

    runAction(row, () => adminApi.updateUserRole(row.id, nextRole), 'Đã cập nhật vai trò.');
  };

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-[#CFE3E0] bg-white shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[#0F766E]" />
        <div className="absolute -right-16 -top-20 size-52 rounded-full bg-[#E7F3F1]" />
        <div className="relative grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#0F766E] text-white shadow-sm">
              {section === 'users' ? <UsersRound className="size-5" /> : section === 'store-products' ? <PackageOpen className="size-5" /> : <ShieldAlert className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#0F766E]">Trung tâm quản trị</p>
              <h2 className="mt-1.5 text-3xl font-black tracking-normal text-[#172033]">{config.title}</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#64748B]">{config.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 self-center">
            <MiniStat label={section === 'spa-overview' ? 'Lịch hôm nay' : section === 'store-overview' ? 'Đơn hôm nay' : 'Tổng'} value={titleStats.total} />
            <MiniStat label={['spa-overview', 'store-overview'].includes(section) ? 'Hoàn thành' : section === 'store-products' ? 'Đang bán' : section === 'spa-services' ? 'Đang mở' : section === 'reports' ? 'Đã xử lý' : 'Hoạt động'} value={titleStats.active} />
            <MiniStat label={section === 'store-products' ? 'Hết hàng' : 'Chờ xử lý'} value={titleStats.pending} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#D8E0EA] bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-[#0F766E]" />
          </div>
        ) : error ? (
          <div className="p-6">
            <p className="font-black text-red-700">{error}</p>
          </div>
        ) : section === 'users' ? (
          <UserManagementPanel
            users={rows}
            savingId={savingId}
            onRunAction={runAction}
            onRoleChange={handleRoleChange}
          />
        ) : section === 'store-overview' ? (
          <StoreOverviewPanel data={rows[0]} />
        ) : section === 'spa-overview' ? (
          <SpaOverviewPanel data={rows[0]} />
        ) : section === 'store-settings' ? (
          <StoreSettingsForm store={rows[0]} onSaved={load} />
        ) : section === 'spas' ? (
          <SpaSettingsForm spa={rows[0]} onSaved={load} />
        ) : section === 'store-products' ? (
          <ProductCatalogPanel products={rows} />
        ) : (
          <div>
            {section === 'reports' && (
              <ComplaintFilters
                type={complaintType}
                target={complaintTarget}
                status={complaintStatus}
                onTypeChange={setComplaintType}
                onTargetChange={setComplaintTarget}
                onStatusChange={setComplaintStatus}
              />
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="bg-[#F7F9FB]">
                  <tr>
                    {config.columns.map((column) => (
                      <th key={column.key} className="px-5 py-4 text-[11px] font-black uppercase tracking-wider text-[#64748B]">
                        {column.label}
                      </th>
                    ))}
                    {hasActions && (
                      <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-[#64748B]">Thao tác</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF0]">
                  {visibleRows.map((row, index) => (
                    <tr key={row.id ?? `${section}-${index}`} className="transition hover:bg-[#FAFBFC]">
                      {config.columns.map((column) => (
                        <td key={column.key} className="max-w-[280px] truncate px-5 py-4 text-sm font-semibold text-[#334155]">
                          {renderAdminCell(column, row)}
                        </td>
                      ))}
                      {hasActions && (
                        <td className="px-5 py-4">
                          <ActionGroup
                            section={section}
                            row={row}
                            busy={savingId === row.id}
                            onAction={(action, success) => runAction(row, action, success)}
                            onRoleChange={(nextRole) => handleRoleChange(row, nextRole)}
                            onPetModeration={(mode) => setPetModerationFlow({ mode, pet: row })}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                  {!visibleRows.length && (
                    <tr>
                      <td className="px-5 py-14 text-center text-sm font-semibold text-[#64748B]" colSpan={config.columns.length + (hasActions ? 1 : 0)}>
                        Chưa có dữ liệu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {spaManagerRoleFlow && (
        <SpaManagerRoleDialog
          flow={spaManagerRoleFlow}
          users={rows}
          onClose={() => setSpaManagerRoleFlow(null)}
          onSuccess={() => {
            setSpaManagerRoleFlow(null);
            load();
          }}
        />
      )}

      {petModerationFlow && (
        <PetModerationDialog
          flow={petModerationFlow}
          onClose={() => setPetModerationFlow(null)}
          onSuccess={() => {
            setPetModerationFlow(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserManagementPanel({
  users,
  savingId,
  onRunAction,
  onRoleChange,
}: {
  users: Row[];
  savingId: string;
  onRunAction: (row: Row, action: () => Promise<unknown>, success: string) => void;
  onRoleChange: (row: Row, role: AdminRole) => void;
}) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !normalizedQuery ||
        user.name?.toLowerCase().includes(normalizedQuery) ||
        user.email?.toLowerCase().includes(normalizedQuery) ||
        String(user.id).toLowerCase().includes(normalizedQuery);
      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || user.accountStatus === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  const verifiedCount = users.filter((user) => user.isVerified).length;
  const managerCount = users.filter((user) => ['STORE_MANAGER', 'SPA_MANAGER'].includes(user.role)).length;
  const suspendedCount = users.filter((user) => user.accountStatus === 'SUSPENDED').length;

  return (
    <div>
      <div className="grid gap-3 border-b border-[#E5EAF0] bg-[#FBFCFD] p-4 md:grid-cols-3">
        <UserQuickStat icon={UserCheck} label="Đã xác thực" value={verifiedCount} tone="emerald" />
        <UserQuickStat icon={ShieldAlert} label="Tài khoản quản lý" value={managerCount} tone="teal" />
        <UserQuickStat icon={UserX} label="Đang bị khóa" value={suspendedCount} tone="red" />
      </div>

      <div className="grid gap-3 border-b border-[#E5EAF0] p-4 lg:grid-cols-[minmax(300px,1fr)_220px_220px]">
        <label className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên, email hoặc mã người dùng..."
            className="h-11 w-full rounded-lg border border-[#D8E0EA] bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
          />
        </label>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-[#0F766E]">
          <option value="ALL">Tất cả vai trò</option>
          {roleOptions.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
          <option value="SPA_STAFF">Nhân viên spa</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-[#0F766E]">
          <option value="ALL">Tất cả trạng thái</option>
          {accountStatusOptions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-left">
          <thead className="bg-[#F7F9FB]">
            <tr>
              {['Người dùng', 'Vai trò hiện tại', 'Xác thực', 'Trạng thái', 'Ngày tham gia', 'Quản lý quyền'].map((label) => (
                <th key={label} className={`px-5 py-4 text-[11px] font-black uppercase tracking-wider text-[#64748B] ${label === 'Quản lý quyền' ? 'text-right' : ''}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAF0]">
            {filtered.map((user) => (
              <tr key={user.id} className="transition hover:bg-[#F8FBFA]">
                <td className="px-5 py-4">
                  <div className="flex min-w-[260px] items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#0F766E] to-[#164E63] text-sm font-black text-white shadow-sm">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" /> : getInitials(user.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="max-w-[260px] truncate text-sm font-black text-[#172033]">{user.name || 'Chưa cập nhật tên'}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#64748B]"><Mail className="size-3.5" />{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4"><RoleBadge role={user.role} /></td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${user.isVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                    {user.isVerified ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                    {user.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                  </span>
                </td>
                <td className="px-5 py-4"><AccountStatusBadge status={user.accountStatus} /></td>
                <td className="px-5 py-4 text-sm font-semibold text-[#64748B]">{dateCell(user)}</td>
                <td className="px-5 py-4">
                  <ActionGroup
                    section="users"
                    row={user}
                    busy={savingId === user.id}
                    onAction={(action, success) => onRunAction(user, action, success)}
                    onRoleChange={(role) => onRoleChange(user, role)}
                    onPetModeration={() => undefined}
                  />
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={6} className="px-5 py-16 text-center"><UsersRound className="mx-auto size-8 text-[#94A3B8]" /><p className="mt-3 text-sm font-bold text-[#64748B]">Không tìm thấy người dùng phù hợp.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[#E5EAF0] bg-[#FBFCFD] px-5 py-3 text-xs font-bold text-[#64748B]">Hiển thị {filtered.length} / {users.length} tài khoản</div>
    </div>
  );
}

function UserQuickStat({ icon: Icon, label, value, tone }: { icon: typeof UserCheck; label: string; value: number; tone: 'emerald' | 'teal' | 'red' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    teal: 'bg-[#E7F3F1] text-[#0F766E] border-[#CFE3E0]',
    red: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${tones[tone]}`}>
      <span className="flex size-9 items-center justify-center rounded-lg bg-white/80"><Icon className="size-4" /></span>
      <div><p className="text-xl font-black">{value}</p><p className="text-[11px] font-black uppercase tracking-wider opacity-80">{label}</p></div>
    </div>
  );
}

function RoleBadge({ role }: { role?: string }) {
  const tones: Record<string, string> = {
    USER: 'bg-slate-100 text-slate-700',
    STORE_MANAGER: 'bg-sky-50 text-sky-700',
    SPA_MANAGER: 'bg-violet-50 text-violet-700',
    SPA_STAFF: 'bg-fuchsia-50 text-fuchsia-700',
    MODERATOR: 'bg-amber-50 text-amber-800',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${tones[role ?? ''] ?? 'bg-slate-100 text-slate-700'}`}>{formatRole(role)}</span>;
}

function AccountStatusBadge({ status }: { status?: string }) {
  const tone = status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : status === 'SUSPENDED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${tone}`}><span className="size-2 rounded-full bg-current opacity-70" />{formatStatus(status)}</span>;
}

function getInitials(name?: string) {
  if (!name?.trim()) return 'U';
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function ProductCatalogPanel({ products }: { products: Row[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [availability, setAvailability] = useState('ALL');

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !normalizedQuery ||
        String(product.id).includes(normalizedQuery) ||
        product.name?.toLowerCase().includes(normalizedQuery) ||
        product.brand?.toLowerCase().includes(normalizedQuery);
      const matchesCategory = category === 'ALL' || product.category === category;
      const matchesAvailability = availability === 'ALL' ||
        (availability === 'ACTIVE' && product.isActive && (product.stock ?? 0) > 0) ||
        (availability === 'LOW' && (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5) ||
        (availability === 'OUT' && (product.stock ?? 0) === 0) ||
        (availability === 'INACTIVE' && !product.isActive);
      return matchesQuery && matchesCategory && matchesAvailability;
    });
  }, [products, query, category, availability]);

  return (
    <div>
      <div className="grid gap-3 border-b border-[#E5EAF0] bg-[#FBFCFD] p-4 lg:grid-cols-[minmax(280px,1fr)_220px_220px]">
        <label className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo mã, tên hoặc thương hiệu..."
            className="h-11 w-full rounded-lg border border-[#D8E0EA] bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
          />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-[#0F766E]">
          <option value="ALL">Tất cả danh mục</option>
          {categories.map((item) => <option key={item} value={item}>{formatCategory(item)}</option>)}
        </select>
        <select value={availability} onChange={(event) => setAvailability(event.target.value)} className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-[#0F766E]">
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang bán</option>
          <option value="LOW">Sắp hết hàng</option>
          <option value="OUT">Hết hàng</option>
          <option value="INACTIVE">Ngừng bán</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-left">
          <thead className="bg-[#F7F9FB]">
            <tr>
              {['Sản phẩm', 'Mã sản phẩm', 'Danh mục', 'Giá bán', 'Tồn kho', 'Trạng thái', 'Cập nhật'].map((label) => (
                <th key={label} className="px-5 py-4 text-[11px] font-black uppercase tracking-wider text-[#64748B]">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAF0]">
            {filtered.map((product) => {
              const stock = product.stock ?? 0;
              const stockTone = stock === 0 ? 'text-red-700 bg-red-50 border-red-200' : stock <= 5 ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200';
              return (
                <tr key={product.id} className="transition hover:bg-[#FAFBFC]">
                  <td className="px-5 py-4">
                    <div className="flex min-w-[260px] items-center gap-3">
                      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5EAF0] bg-[#F7F9FB]">
                        {product.imageUrl ? <img src={product.imageUrl} alt="" className="size-full object-cover" /> : <PackageOpen className="size-5 text-[#94A3B8]" />}
                      </span>
                      <div className="min-w-0">
                        <p className="max-w-[300px] truncate text-sm font-black text-[#172033]" title={product.name}>{product.name}</p>
                        <p className="mt-1 text-xs font-semibold text-[#64748B]">{product.brand || 'Chưa có thương hiệu'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><span className="inline-flex rounded-lg bg-[#E7F3F1] px-3 py-1.5 font-mono text-sm font-black tracking-wider text-[#0F766E]">#{product.id}</span></td>
                  <td className="px-5 py-4 text-sm font-bold text-[#475569]">{formatCategory(product.category)}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-[#172033]">{moneyCell({ price: product.salePrice ?? product.originalPrice })}</p>
                    {product.salePrice && <p className="mt-1 text-xs font-semibold text-[#94A3B8] line-through">{moneyCell({ price: product.originalPrice })}</p>}
                  </td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${stockTone}`}>{stock} sản phẩm</span></td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-black ${product.isActive ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                      <span className={`size-2 rounded-full ${product.isActive ? 'bg-emerald-500' : 'bg-[#94A3B8]'}`} />
                      {product.isActive ? 'Đang bán' : 'Ngừng bán'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-[#64748B]">{dateCell(product)}</td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={7} className="px-5 py-16 text-center"><AlertTriangle className="mx-auto size-7 text-[#94A3B8]" /><p className="mt-3 text-sm font-bold text-[#64748B]">Không tìm thấy sản phẩm phù hợp.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[#E5EAF0] bg-[#FBFCFD] px-5 py-3 text-xs font-bold text-[#64748B]">Hiển thị {filtered.length} / {products.length} sản phẩm</div>
    </div>
  );
}

function StoreSettingsForm({ store, onSaved }: { store?: Row; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: store?.name ?? 'PetMatching Store',
    phone: store?.phone ?? '',
    address: store?.address ?? '',
    description: store?.description ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: store?.name ?? 'PetMatching Store',
      phone: store?.phone ?? '',
      address: store?.address ?? '',
      description: store?.description ?? '',
    });
  }, [store]);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên cửa hàng.');
      return;
    }

    setSaving(true);
    try {
      await adminApi.updateStoreSettings(form);
      toast.success('Đã cập nhật cấu hình cửa hàng.');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Không thể cập nhật cấu hình cửa hàng.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5 p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <StoreField label="Tên cửa hàng" required value={form.name} onChange={(value) => update('name', value)} />
        <StoreField label="Số điện thoại" value={form.phone} onChange={(value) => update('phone', value)} />
      </div>
      <StoreField label="Địa chỉ" value={form.address} onChange={(value) => update('address', value)} />
      <label className="grid gap-2 text-sm font-black text-[#172033]">
        Mô tả cửa hàng
        <textarea
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          rows={5}
          placeholder="Giới thiệu ngắn về PetMatching Store"
          className="resize-none rounded-lg border border-[#D8E0EA] bg-white p-3 text-sm font-semibold outline-none transition focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
        />
      </label>
      <div className="flex items-center justify-between gap-4 border-t border-[#E5EAF0] pt-5">
        <p className="text-xs font-semibold text-[#64748B]">Thay đổi được áp dụng cho cửa hàng PetMatching duy nhất.</p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#0F766E] px-5 text-sm font-black text-white transition hover:bg-[#0B5F59] disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Lưu cấu hình
        </button>
      </div>
    </form>
  );
}

function StoreOverviewPanel({ data }: { data?: Row }) {
  const stats = data?.stats ?? {};
  const shortcuts = [
    { label: 'Sản phẩm', value: stats.activeProducts ?? 0, href: '/admin/store-products' },
    { label: 'Đơn hàng hôm nay', value: stats.todayOrders ?? 0, href: '/admin/store-orders' },
    { label: 'Hết hàng', value: stats.outOfStockProducts ?? 0, href: '/admin/store-products' },
    { label: 'Cấu hình cửa hàng', value: data?.store?.status === 'ACTIVE' ? 'Đang mở' : 'Tạm ngừng', href: '/admin/store-settings' },
  ];

  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((item) => (
          <Link key={`${item.href}-${item.label}`} href={item.href} className="rounded-xl border border-[#D8E0EA] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#0F766E] hover:shadow-md">
            <p className="text-xs font-black uppercase tracking-wider text-[#64748B]">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-[#172033]">{item.value}</p>
            <p className="mt-3 text-xs font-black text-[#0F766E]">Xem chi tiết →</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MiniStat label="Đơn chờ xử lý" value={stats.pendingOrders ?? 0} />
        <MiniStat label="Đã giao" value={stats.completedOrders ?? 0} />
        <MiniStat label="Doanh thu cửa hàng" value={moneyCell({ price: stats.revenue ?? 0 })} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#D8E0EA]">
        <div className="flex items-center justify-between border-b border-[#E5EAF0] bg-[#F7F9FB] px-5 py-4">
          <div>
            <h3 className="font-black text-[#172033]">Đơn hàng gần đây</h3>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">Năm đơn hàng mới nhất của cửa hàng.</p>
          </div>
          <Link href="/admin/store-orders" className="text-sm font-black text-[#0F766E]">Xem tất cả</Link>
        </div>
        <div className="divide-y divide-[#E5EAF0]">
          {(data?.recentOrders ?? []).map((order: Row) => (
            <div key={order.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
              <div>
                <p className="font-black text-[#172033]">{order.user?.name ?? 'Khách hàng'}</p>
                <p className="mt-1 text-xs font-semibold text-[#64748B]">#{order.id}</p>
              </div>
              <p className="text-sm font-semibold text-[#475569]">{order.items?.reduce((sum: number, item: Row) => sum + (item.quantity ?? 0), 0) ?? 0} sản phẩm</p>
              <p className="text-sm font-black text-[#172033]">{moneyCell(order)}</p>
              <span className="text-sm font-bold text-[#0F766E]">{formatStatus(order.status)}</span>
            </div>
          ))}
          {!data?.recentOrders?.length && <p className="px-5 py-10 text-center text-sm font-semibold text-[#64748B]">Chưa có đơn hàng.</p>}
        </div>
      </section>
    </div>
  );
}

function SpaOverviewPanel({ data }: { data?: Row }) {
  const stats = data?.stats ?? {};
  const shortcuts = [
    { label: 'Dịch vụ Spa', value: stats.services ?? 0, href: '/admin/spa-services' },
    { label: 'Lịch nhân viên', value: stats.staffs ?? 0, href: '/admin/spa-staff-schedule' },
    { label: 'Lịch đặt hôm nay', value: stats.todayBookings ?? 0, href: '/admin/spa-bookings' },
    { label: 'Thông tin Spa', value: data?.spa?.status === 'ACTIVE' ? 'Đang mở' : 'Tạm ngừng', href: '/admin/spas' },
  ];

  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-xl border border-[#D8E0EA] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#0F766E] hover:shadow-md">
            <p className="text-xs font-black uppercase tracking-wider text-[#64748B]">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-[#172033]">{item.value}</p>
            <p className="mt-3 text-xs font-black text-[#0F766E]">Xem chi tiết →</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MiniStat label="Chờ xử lý" value={stats.pendingBookings ?? 0} />
        <MiniStat label="Đã hoàn thành" value={stats.completedBookings ?? 0} />
        <MiniStat label="Doanh thu Spa" value={moneyCell({ price: stats.revenue ?? 0 })} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#D8E0EA]">
        <div className="flex items-center justify-between border-b border-[#E5EAF0] bg-[#F7F9FB] px-5 py-4">
          <div>
            <h3 className="font-black text-[#172033]">Lịch sắp tới</h3>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">Năm lịch gần nhất của Spa.</p>
          </div>
          <Link href="/admin/spa-bookings" className="text-sm font-black text-[#0F766E]">Xem tất cả</Link>
        </div>
        <div className="divide-y divide-[#E5EAF0]">
          {(data?.upcomingBookings ?? []).map((booking: Row) => (
            <div key={booking.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
              <p className="font-black text-[#172033]">{booking.user?.name ?? 'Khách hàng'}</p>
              <p className="text-sm font-semibold text-[#475569]">{booking.service?.name ?? 'Dịch vụ Spa'}</p>
              <p className="text-sm font-semibold text-[#64748B]">{booking.staff?.name ?? 'Chưa phân công'}</p>
              <p className="text-sm font-bold text-[#0F766E]">{dateCell(booking)}</p>
            </div>
          ))}
          {!data?.upcomingBookings?.length && <p className="px-5 py-10 text-center text-sm font-semibold text-[#64748B]">Chưa có lịch sắp tới.</p>}
        </div>
      </section>
    </div>
  );
}

function SpaSettingsForm({ spa, onSaved }: { spa?: Row; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: spa?.name ?? 'PetMatching Spa',
    phone: spa?.phone ?? '',
    address: spa?.address ?? '',
    description: spa?.description ?? '',
    status: (spa?.status ?? 'ACTIVE') as ApprovalStatus,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: spa?.name ?? 'PetMatching Spa',
      phone: spa?.phone ?? '',
      address: spa?.address ?? '',
      description: spa?.description ?? '',
      status: (spa?.status ?? 'ACTIVE') as ApprovalStatus,
    });
  }, [spa]);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      toast.error('Vui lòng nhập tên và địa chỉ Spa.');
      return;
    }

    setSaving(true);
    try {
      await adminApi.updateSpaSettings(form);
      toast.success('Đã cập nhật thông tin Spa.');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Không thể cập nhật thông tin Spa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 p-6">
      <div className="grid gap-4 rounded-xl border border-[#D8E0EA] bg-[#F7F9FB] p-4 sm:grid-cols-3">
        <InfoStat label="Quản lý" value={spa?.manager?.name ?? 'Chưa phân công'} />
        <InfoStat label="Nhân viên" value={spa?._count?.staffs ?? 0} />
        <InfoStat label="Tổng lịch đặt" value={spa?._count?.bookings ?? 0} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <StoreField label="Tên Spa" required value={form.name} onChange={(value) => update('name', value)} />
        <StoreField label="Số điện thoại" value={form.phone} onChange={(value) => update('phone', value)} />
      </div>
      <StoreField label="Địa chỉ" required value={form.address} onChange={(value) => update('address', value)} />
      <label className="grid gap-2 text-sm font-black text-[#172033]">
        Trạng thái nhận lịch
        <select
          value={form.status}
          onChange={(event) => update('status', event.target.value)}
          className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
        >
          <option value="ACTIVE">Đang nhận lịch</option>
          <option value="SUSPENDED">Tạm ngừng nhận lịch</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-black text-[#172033]">
        Giới thiệu Spa
        <textarea
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          rows={5}
          placeholder="Giới thiệu ngắn về dịch vụ chăm sóc thú cưng"
          className="resize-none rounded-lg border border-[#D8E0EA] bg-white p-3 text-sm font-semibold outline-none transition focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
        />
      </label>
      <div className="flex items-center justify-between gap-4 border-t border-[#E5EAF0] pt-5">
        <p className="text-xs font-semibold text-[#64748B]">Hệ thống chỉ sử dụng một Spa PetMatching duy nhất.</p>
        <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#0F766E] px-5 text-sm font-black text-white transition hover:bg-[#0B5F59] disabled:opacity-50">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Lưu thông tin
        </button>
      </div>
    </form>
  );
}

function InfoStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wider text-[#64748B]">{label}</p>
      <p className="mt-1 text-base font-black text-[#172033]">{value}</p>
    </div>
  );
}

function StoreField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-[#172033]">
      {label}{required && <span className="text-red-600"> *</span>}
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
      />
    </label>
  );
}

function SpaManagerRoleDialog({
  flow,
  users,
  onClose,
  onSuccess,
}: {
  flow: SpaManagerRoleFlow;
  users: Row[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [spa, setSpa] = useState<Row | null>(null);
  const [revokeMode, setRevokeMode] = useState<'UNASSIGN' | 'TRANSFER'>('UNASSIGN');
  const [newManagerId, setNewManagerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.spas()
      .then((response) => {
        const spas = Array.isArray(response.data) ? response.data.slice(0, 1) : [];
        setSpa(spas[0] ?? null);
      })
      .catch(() => setError('Không thể tải thông tin Spa.'))
      .finally(() => setLoading(false));
  }, []);

  const managesSpa = spa?.managerId === flow.user.id;
  const replacementManagers = users.filter(
    (user) =>
      user.id !== flow.user.id &&
      ['USER', 'SPA_MANAGER'].includes(user.role) &&
      user.accountStatus === 'ACTIVE',
  );
  const isReassignment = Boolean(spa?.managerId && spa.managerId !== flow.user.id);

  const submit = async () => {
    setError('');

    if (flow.mode === 'GRANT' && !spa) {
      setError('Chưa cấu hình thông tin Spa.');
      return;
    }

    if (flow.mode === 'REVOKE' && revokeMode === 'TRANSFER' && !newManagerId) {
      setError('Vui lòng chọn Spa Manager nhận chuyển giao.');
      return;
    }

    setSaving(true);
    try {
      if (flow.mode === 'GRANT') {
        await adminApi.grantSpaManager(flow.user.id, isReassignment);
        toast.success('Đã cấp quyền quản lý Spa.');
      } else {
        await adminApi.revokeSpaManager(flow.user.id, revokeMode, newManagerId || undefined);
        toast.success(
          revokeMode === 'TRANSFER'
            ? 'Đã thu hồi quyền và bàn giao Spa.'
            : 'Đã thu hồi quyền Spa Manager.',
        );
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể cập nhật quyền Spa Manager.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/55 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#D8E0EA] bg-white shadow-2xl">
        <div className="border-b border-[#E5EAF0] px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#0F766E]">Quản lý phân quyền Spa</p>
          <h3 className="mt-1 text-2xl font-black text-[#172033]">
            {flow.mode === 'GRANT' ? 'Cấp quyền quản lý Spa' : 'Thu hồi quyền quản lý Spa'}
          </h3>
          <p className="mt-2 text-sm font-semibold text-[#64748B]">
            {flow.user.name} · {flow.user.email}
          </p>
        </div>

        <div className="grid gap-5 p-6">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="size-7 animate-spin text-[#0F766E]" />
            </div>
          ) : flow.mode === 'GRANT' ? (
            <>
              <div>
                <p className="text-sm font-black text-[#172033]">Spa được phân công</p>
                <p className="mt-1 text-xs font-semibold text-[#64748B]">Hệ thống chỉ có một Spa và sẽ tự động phân công.</p>
              </div>
              <div className="grid gap-3">
                {spa && (
                  <div className="rounded-xl border border-[#D8E0EA] bg-[#F7F9FB] p-4">
                    <span className="min-w-0">
                      <span className="block font-black text-[#172033]">{spa.name}</span>
                      <span className="mt-1 block text-xs font-semibold text-[#64748B]">{spa.address}</span>
                      {isReassignment && (
                        <span className="mt-2 block text-xs font-black text-amber-700">
                          Đang do {spa.manager?.name ?? 'một Manager khác'} quản lý; thao tác này sẽ chuyển quyền.
                        </span>
                      )}
                      </span>
                  </div>
                )}
              </div>
              {isReassignment && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  Bạn đang chuyển quyền quản lý Spa sang {flow.user.name}.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-xl border border-[#D8E0EA] bg-[#F7F9FB] p-4">
                <p className="text-sm font-black text-[#172033]">Spa đang quản lý</p>
                {managesSpa ? (
                  <p className="mt-2 text-sm font-semibold text-[#475569]">• {spa?.name}</p>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-[#64748B]">Tài khoản chưa được phân công Spa.</p>
                )}
              </div>

              <label className="flex cursor-pointer gap-3 rounded-xl border border-[#D8E0EA] p-4">
                <input
                  type="radio"
                  name="revokeMode"
                  checked={revokeMode === 'UNASSIGN'}
                  onChange={() => setRevokeMode('UNASSIGN')}
                  className="mt-1 accent-[#0F766E]"
                />
                <span>
                  <span className="block font-black text-[#172033]">Bỏ phân công</span>
                  <span className="mt-1 block text-xs font-semibold text-[#64748B]">Spa sẽ tạm thời chưa có Manager.</span>
                </span>
              </label>

              <label className="flex cursor-pointer gap-3 rounded-xl border border-[#D8E0EA] p-4">
                <input
                  type="radio"
                  name="revokeMode"
                  checked={revokeMode === 'TRANSFER'}
                  onChange={() => setRevokeMode('TRANSFER')}
                  disabled={!replacementManagers.length}
                  className="mt-1 accent-[#0F766E]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-[#172033]">Chuyển giao cho Manager khác</span>
                  <span className="mt-1 block text-xs font-semibold text-[#64748B]">Bàn giao Spa trước khi thu hồi quyền.</span>
                  {revokeMode === 'TRANSFER' && (
                    <select
                      value={newManagerId}
                      onChange={(event) => setNewManagerId(event.target.value)}
                      className="mt-3 h-10 w-full rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-[#0F766E]"
                    >
                      <option value="">Chọn người nhận chuyển giao</option>
                      {replacementManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>{manager.name} · {manager.email}</option>
                      ))}
                    </select>
                  )}
                </span>
              </label>
            </>
          )}

          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E5EAF0] px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-[#D8E0EA] px-4 py-2 text-sm font-black text-[#475569]">
            Hủy
          </button>
          <button type="button" onClick={submit} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-black text-white disabled:opacity-50">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {flow.mode === 'GRANT'
              ? isReassignment ? 'Chuyển quyền & cấp Manager' : 'Cấp quyền Spa Manager'
              : revokeMode === 'TRANSFER' ? 'Thu hồi & chuyển giao' : 'Thu hồi quyền'}
          </button>
        </div>
      </div>
    </div>
  );
}

const hidePetReasonOptions: Array<{ value: HidePetReason; label: string }> = [
  { value: 'CONTENT_VIOLATION', label: 'Nội dung hoặc hình ảnh vi phạm' },
  { value: 'INACCURATE_INFORMATION', label: 'Thông tin không chính xác' },
  { value: 'SUSPECTED_FAKE', label: 'Nghi ngờ hồ sơ giả mạo' },
  { value: 'DOCUMENT_FRAUD', label: 'Nghi ngờ giấy tờ giả' },
  { value: 'UNRESOLVED_REPORT', label: 'Có báo cáo cần xác minh' },
  { value: 'OTHER', label: 'Lý do khác' },
];

const restorePetReasonOptions: Array<{ value: RestorePetReason; label: string }> = [
  { value: 'INFORMATION_VERIFIED', label: 'Đã xác minh lại thông tin' },
  { value: 'REPORT_RESOLVED', label: 'Báo cáo đã được xử lý' },
  { value: 'DOCUMENTS_APPROVED', label: 'Giấy tờ đã được duyệt' },
  { value: 'ADMIN_REVIEW', label: 'Đã được Admin rà soát' },
  { value: 'OTHER', label: 'Lý do khác' },
];

function PetModerationDialog({
  flow,
  onClose,
  onSuccess,
}: {
  flow: PetModerationFlow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [detail, setDetail] = useState<Row | null>(null);
  const [reason, setReason] = useState<HidePetReason | RestorePetReason | ''>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.pet(flow.pet.id)
      .then((response) => setDetail(response.data))
      .catch((err: any) => setError(err?.response?.data?.message ?? 'Không thể tải chi tiết hồ sơ thú cưng.'))
      .finally(() => setLoading(false));
  }, [flow.pet.id]);

  const isRestore = flow.mode === 'RESTORE';
  const reasonOptions = isRestore ? restorePetReasonOptions : hidePetReasonOptions;
  const restoreBlocked = isRestore && Boolean(
    (detail?.unresolvedReportCount ?? 0) > 0 || detail?.owner?.accountStatus !== 'ACTIVE',
  );

  const submit = async () => {
    setError('');
    if (!reason) {
      setError('Vui lòng chọn lý do để tiếp tục.');
      return;
    }

    setSaving(true);
    try {
      if (isRestore) {
        await adminApi.restorePet(flow.pet.id, reason as RestorePetReason, note.trim() || undefined);
        toast.success('Đã khôi phục hồ sơ thú cưng.');
      } else {
        await adminApi.hidePet(flow.pet.id, reason as HidePetReason, note.trim() || undefined);
        toast.success('Đã ẩn hồ sơ thú cưng.');
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể cập nhật trạng thái hồ sơ thú cưng.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/55 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#D8E0EA] bg-white shadow-2xl">
        <div className="border-b border-[#E5EAF0] px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-[#0F766E]">Kiểm duyệt hồ sơ thú cưng</p>
          <h3 className="mt-1 text-2xl font-black text-[#172033]">
            {isRestore ? 'Khôi phục hồ sơ' : 'Ẩn hồ sơ'} {flow.pet.name}
          </h3>
          <p className="mt-2 text-sm font-semibold text-[#64748B]">
            Chủ sở hữu: {detail?.owner?.name ?? flow.pet.owner?.name ?? '-'}
          </p>
        </div>

        <div className="grid gap-5 p-6">
          {loading ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="size-7 animate-spin text-[#0F766E]" />
            </div>
          ) : (
            <>
              {isRestore && (
                <div className="grid gap-2 rounded-xl border border-[#D8E0EA] bg-[#F7F9FB] p-4 text-sm font-semibold text-[#475569]">
                  <p><span className="font-black text-[#172033]">Lý do ẩn gần nhất:</span> {formatPetModerationReason(detail?.lastHideAction?.metadata?.reason)}</p>
                  <p><span className="font-black text-[#172033]">Thời điểm ẩn:</span> {detail?.lastHideAction?.createdAt ? dateCell({ createdAt: detail.lastHideAction.createdAt }) : '-'}</p>
                  <p><span className="font-black text-[#172033]">Báo cáo chưa xử lý:</span> {detail?.unresolvedReportCount ?? 0}</p>
                </div>
              )}

              {isRestore && (detail?.unresolvedReportCount ?? 0) > 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  Cần xử lý toàn bộ báo cáo liên quan trước khi khôi phục hồ sơ.
                </p>
              )}

              {isRestore && detail?.owner?.accountStatus !== 'ACTIVE' && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  Không thể khôi phục khi tài khoản chủ sở hữu không hoạt động.
                </p>
              )}

              <label className="grid gap-2 text-sm font-black text-[#172033]">
                Lý do <span className="text-red-600">*</span>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as HidePetReason | RestorePetReason)}
                  className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-[#0F766E]"
                >
                  <option value="">Chọn lý do</option>
                  {reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-[#172033]">
                Ghi chú
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Nhập thông tin kiểm duyệt bổ sung (không bắt buộc)"
                  className="resize-none rounded-lg border border-[#D8E0EA] bg-white p-3 text-sm font-semibold outline-none focus:border-[#0F766E]"
                />
              </label>

              <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-bold leading-5 text-sky-800">
                {isRestore
                  ? 'Hồ sơ sẽ hoạt động trở lại, nhưng chức năng ghép đôi vẫn tắt. Chủ sở hữu phải chủ động bật lại sau khi kiểm tra hồ sơ.'
                  : 'Hồ sơ sẽ bị ẩn khỏi hệ thống, ngừng hoạt động và bị tắt khỏi danh sách ghép đôi.'}
              </p>
            </>
          )}

          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E5EAF0] px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-[#D8E0EA] px-4 py-2 text-sm font-black text-[#475569]">
            Hủy
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || saving || restoreBlocked}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isRestore ? 'Xác nhận khôi phục' : 'Xác nhận ẩn'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionGroup({
  section,
  row,
  busy,
  onAction,
  onRoleChange,
  onPetModeration,
}: {
  section: string;
  row: Row;
  busy: boolean;
  onAction: (action: () => Promise<unknown>, success: string) => void;
  onRoleChange: (role: AdminRole) => void;
  onPetModeration: (mode: 'HIDE' | 'RESTORE') => void;
}) {
  if (busy) {
    return <Loader2 className="ml-auto size-5 animate-spin text-[#0F766E]" />;
  }

  if (section === 'users') {
    const isSpaStaff = row.role === 'SPA_STAFF';
    const availableRoles: AdminRole[] = isSpaStaff
      ? ['SPA_STAFF']
      : row.role === 'SPA_MANAGER'
        ? ['SPA_MANAGER', 'USER']
        : row.role === 'STORE_MANAGER'
          ? ['STORE_MANAGER', 'USER']
          : roleOptions;

    return (
      <div className="flex flex-wrap justify-end gap-2">
        <label>
          <select
            className="h-9 rounded-lg border border-[#D8E0EA] bg-white px-2.5 text-xs font-black text-[#334155] outline-none transition focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
            value={row.role}
            onChange={(event) => onRoleChange(event.target.value as AdminRole)}
            disabled={isSpaStaff}
            title={isSpaStaff ? 'Vai trò nhân viên Spa do Spa Manager quản lý' : undefined}
          >
            {availableRoles.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
          </select>
        </label>
        <label>
          <select
            className="h-9 rounded-lg border border-[#D8E0EA] bg-white px-2.5 text-xs font-black text-[#334155] outline-none transition focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
            value={row.accountStatus}
            onChange={(event) => onAction(() => adminApi.updateAccountStatus(row.id, event.target.value as AccountStatus), 'Đã cập nhật trạng thái tài khoản.')}
          >
            {accountStatusOptions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
          </select>
        </label>
      </div>
    );
  }

  if (section === 'pet-verifications') {
    return (
      <div className="flex justify-end gap-2">
        <IconButton label="Duyệt" icon={CheckCircle2} onClick={() => onAction(() => adminApi.reviewPetVerification(row.id, 'APPROVED'), 'Đã duyệt giấy tờ thú cưng.')} />
        <IconButton label="Yêu cầu bổ sung" icon={ShieldAlert} onClick={() => onAction(() => adminApi.reviewPetVerification(row.id, 'NEED_MORE_INFO', 'Vui lòng bổ sung thêm bằng chứng.'), 'Đã yêu cầu bổ sung thông tin.')} />
        <IconButton label="Từ chối" icon={XCircle} onClick={() => onAction(() => adminApi.reviewPetVerification(row.id, 'REJECTED', 'Giấy tờ không hợp lệ.'), 'Đã từ chối giấy tờ thú cưng.')} />
      </div>
    );
  }

  if (section === 'pets') {
    if (row.status === 'INACTIVE') {
      return <span className="block text-right text-xs font-black text-[#64748B]">Chủ sở hữu đã ngừng</span>;
    }

    return (
      <div className="flex justify-end">
        {row.status === 'HIDDEN'
          ? <IconButton label="Khôi phục" icon={Eye} onClick={() => onPetModeration('RESTORE')} />
          : <IconButton label="Ẩn" icon={EyeOff} onClick={() => onPetModeration('HIDE')} />}
      </div>
    );
  }

  if (section === 'spas') {
    return <ApprovalButtons update={(status) => adminApi.updateSpaStatus(row.id, status)} onAction={onAction} />;
  }

  if (section === 'matching-reports' && !row.isResolved) {
    return (
      <div className="flex justify-end">
        <IconButton label="Xử lý" icon={CheckCircle2} onClick={() => onAction(() => adminApi.resolveMatchingReport(row.id), 'Đã xử lý báo cáo.')} />
      </div>
    );
  }

  if (section === 'reports' && row.status === 'PENDING') {
    return (
      <div className="flex justify-end gap-2">
        <IconButton label="Xử lý" icon={CheckCircle2} onClick={() => onAction(() => adminApi.resolveComplaint(row.id, 'RESOLVE'), 'Đã xử lý khiếu nại.')} />
        <IconButton label="Chuyển cấp" icon={ShieldAlert} onClick={() => onAction(() => adminApi.resolveComplaint(row.id, 'ESCALATE'), 'Đã chuyển cấp khiếu nại.')} />
      </div>
    );
  }

  return <span className="block text-right text-xs font-black text-[#94A3B8]">Chỉ xem</span>;
}

function ApprovalButtons({
  update,
  onAction,
}: {
  update: (status: ApprovalStatus) => Promise<unknown>;
  onAction: (action: () => Promise<unknown>, success: string) => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <IconButton label="Kích hoạt" icon={PlayCircle} onClick={() => onAction(() => update('ACTIVE'), 'Đã cập nhật trạng thái.')} />
      <IconButton label="Tạm dừng" icon={PauseCircle} onClick={() => onAction(() => update('SUSPENDED'), 'Đã cập nhật trạng thái.')} />
    </div>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof CheckCircle2;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-[#D8E0EA] bg-white text-[#475569] shadow-sm transition hover:border-[#0F766E] hover:bg-[#E7F3F1] hover:text-[#0F766E]"
    >
      <Icon className="size-4" />
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-20 rounded-xl border border-[#E5EAF0] bg-[#F7F9FB] px-3 py-2.5 text-center">
      <p className="text-xl font-black tracking-normal text-[#172033]">{value}</p>
      <p className="text-[11px] font-black uppercase tracking-wider text-[#64748B]">{label}</p>
    </div>
  );
}

function ComplaintFilters({
  type,
  target,
  status,
  onTypeChange,
  onTargetChange,
  onStatusChange,
}: {
  type: string;
  target: string;
  status: string;
  onTypeChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  const selectClassName = 'h-11 rounded-xl border border-[#D8E0EA] bg-white px-3 text-sm font-bold text-[#334155] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/10';

  return (
    <div className="flex flex-wrap gap-3 border-b border-[#E5EAF0] bg-[#FAFBFC] p-4">
      <select aria-label="Lọc theo nhóm khiếu nại" value={type} onChange={(event) => onTypeChange(event.target.value)} className={selectClassName}>
        {complaintTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Lọc theo đối tượng" value={target} onChange={(event) => onTargetChange(event.target.value)} className={selectClassName}>
        {complaintTargetOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => onStatusChange(event.target.value)} className={selectClassName}>
        {complaintStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
  );
}

function complaintColumns() {
  return [
    { key: 'title', label: 'Tiêu đề' },
    { key: 'type', label: 'Nhóm', render: (row: Row) => formatComplaintType(row.type) },
    { key: 'targetType', label: 'Đối tượng', render: (row: Row) => formatComplaintTarget(row.targetType) },
    { key: 'status', label: 'Trạng thái' },
    { key: 'actionTaken', label: 'Hành động', render: (row: Row) => row.actionTaken ? formatStatus(row.actionTaken) : '-' },
    { key: 'createdAt', label: 'Ngày tạo', render: dateCell },
  ];
}

function normalizeRows(section: string, data: Row[] | Row): Row[] {
  if (['store-overview', 'spa-overview'].includes(section) && !Array.isArray(data)) return [data];
  if (['stores', 'store-settings'].includes(section) && Array.isArray(data)) {
    return data.length ? [data[0]] : [];
  }

  if (section === 'pet-verifications' && Array.isArray(data)) {
    return data.filter((row) => ['PENDING', 'REVIEWING', 'NEED_MORE_INFO'].includes(row.status));
  }

  return Array.isArray(data) ? data : [];
}

function renderValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
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

function formatComplaintType(type?: string) {
  const labels: Record<string, string> = {
    STORE: 'Cửa hàng',
    SPA: 'Spa',
    MATCHING: 'Ghép đôi',
    PET: 'Thú cưng',
    USER: 'Người dùng',
    REVIEW: 'Đánh giá',
  };
  return type ? labels[type] ?? type : '-';
}

function formatComplaintTarget(target?: string) {
  const labels: Record<string, string> = { ORDER: 'Đơn hàng', PRODUCT: 'Sản phẩm' };
  return target ? labels[target] ?? target : '-';
}

function renderAdminCell(column: { key: string; render?: (row: Row) => ReactNode }, row: Row) {
  if (column.key === 'status' || column.key === 'accountStatus') {
    return <AccountStatusBadge status={row[column.key]} />;
  }
  if (column.key === 'role') return <RoleBadge role={row.role} />;
  return column.render ? column.render(row) : renderValue(row[column.key]);
}

function formatCategory(category?: string) {
  const categories: Record<string, string> = {
    DOG_FOOD: 'Thức ăn cho chó',
    CAT_FOOD: 'Thức ăn cho mèo',
    TOY: 'Đồ chơi',
    ACCESSORY: 'Phụ kiện',
    GROOMING: 'Chăm sóc & vệ sinh',
    CAGE_BED: 'Chuồng & đệm nằm',
    LEASH_COLLAR: 'Vòng cổ & dây dắt',
    MEDICAL: 'Y tế & thuốc',
  };
  return category ? categories[category] ?? category : '-';
}

function formatStatus(status?: string) {
  const statuses: Record<string, string> = {
    ACTIVE: 'Đang hoạt động',
    SUSPENDED: 'Tạm dừng',
    PENDING_MANAGER: 'Chờ duyệt quản lý',
    PENDING: 'Đang chờ',
    REVIEWING: 'Đang xem xét',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
    NEED_MORE_INFO: 'Cần bổ sung',
    RESOLVED: 'Đã xử lý',
    DISMISSED: 'Đã bỏ qua',
    ESCALATED: 'Đã chuyển cấp',
    WARNING: 'Cảnh báo',
    HIDE_CONTENT: 'Ẩn nội dung',
    SUSPEND_ACCOUNT: 'Khóa tài khoản',
    RESOLVE: 'Xử lý',
    ESCALATE: 'Chuyển cấp',
    NONE: 'Chưa xác minh',
    VERIFIED: 'Đã xác minh',
    HIDDEN: 'Đã ẩn',
    INACTIVE: 'Không hoạt động',
    PROCESSING: 'Đang xử lý',
    SHIPPED: 'Đang giao',
    DELIVERED: 'Đã giao',
    CANCELLED: 'Đã hủy',
    CONFIRMED: 'Đã xác nhận',
    ASSIGNED: 'Đã phân công',
    IN_PROGRESS: 'Đang thực hiện',
    COMPLETED: 'Hoàn tất',
    NO_SHOW: 'Không đến',
    USER: 'Người dùng',
    PET: 'Thú cưng',
    MATCHING: 'Ghép đôi',
    STORE: 'Cửa hàng',
    SPA: 'Spa',
    REVIEW: 'Đánh giá',
  };

  return status ? statuses[status] ?? status : '-';
}

function formatDocumentType(type?: string) {
  const types: Record<string, string> = {
    VACCINE_RECORD: 'Sổ tiêm phòng',
    PEDIGREE_CERT: 'Giấy phả hệ VKA/TICA',
    HEALTH_CHECK: 'Giấy khám sức khỏe',
  };

  return type ? types[type] ?? type : '-';
}

function formatPetModerationReason(reason?: string) {
  const reasons: Record<string, string> = {
    CONTENT_VIOLATION: 'Nội dung hoặc hình ảnh vi phạm',
    INACCURATE_INFORMATION: 'Thông tin không chính xác',
    SUSPECTED_FAKE: 'Nghi ngờ hồ sơ giả mạo',
    DOCUMENT_FRAUD: 'Nghi ngờ giấy tờ giả',
    UNRESOLVED_REPORT: 'Có báo cáo cần xác minh',
    INFORMATION_VERIFIED: 'Đã xác minh lại thông tin',
    REPORT_RESOLVED: 'Báo cáo đã được xử lý',
    DOCUMENTS_APPROVED: 'Giấy tờ đã được duyệt',
    ADMIN_REVIEW: 'Đã được Admin rà soát',
    OTHER: 'Lý do khác',
  };

  return reason ? reasons[reason] ?? reason : '-';
}

function renderDocumentLinks(imageUrls?: string[]) {
  if (!imageUrls?.length) return '-';

  return (
    <div className="flex flex-wrap gap-2">
      {imageUrls.map((url, index) => (
        <a
          key={`${url.slice(0, 24)}-${index}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-[#D8E0EA] px-2.5 py-1 text-xs font-black text-[#0F766E] transition hover:border-[#0F766E] hover:bg-[#E6F5F2]"
        >
          Ảnh {index + 1}
        </a>
      ))}
    </div>
  );
}

function dateCell(row: Row) {
  const value = row.createdAt ?? row.updatedAt ?? row.scheduledAt;
  return value ? new Date(value).toLocaleDateString('vi-VN') : '-';
}

function moneyCell(row: Row) {
  const value = row.totalAmount ?? row.priceSnapshot ?? row.price;
  return typeof value === 'number'
    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
    : '-';
}
