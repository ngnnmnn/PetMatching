'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Mail, PackageOpen, PawPrint, Search, ShieldAlert, UserCheck, UsersRound, UserX, XCircle, X, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  AccountStatus,
  AdminRole,
  adminApi,
  ApprovalStatus,
  ComplaintAction,
  DocumentStatus,
  HidePetReason,
  ModerateReportAbusePayload,
  ResolveMatchingReportPayload,
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

type ReuploadDocumentType = 'VACCINE_RECORD' | 'PEDIGREE_CERT';
type PetVerificationFilter = 'ALL' | 'PENDING' | 'VERIFIED' | 'NEED_MORE_INFO' | 'NONE';

const ADMIN_PAGE_SIZE = 10;

const roleOptions: AdminRole[] = ['USER', 'STORE_MANAGER', 'SPA_MANAGER', 'SPA_STAFF'];
const accountStatusOptions: AccountStatus[] = ['ACTIVE', 'SUSPENDED'];
const complaintTargetOptions = [
  ['ALL', 'Tất cả đối tượng'],
  ['PET', 'Thú cưng'],
  ['USER', 'Người dùng'],
] as const;
const complaintStatusOptions = [
  ['ALL', 'Tất cả trạng thái'],
  ['PENDING', 'Chờ xử lý'],
  ['RESOLVED', 'Có vi phạm'],
  ['DISMISSED', 'Không vi phạm'],
  ['INSUFFICIENT_EVIDENCE', 'Chưa đủ bằng chứng'],
] as const;
const readOnlySections = new Set(['stores', 'system-profile', 'store-overview', 'store-products', 'store-orders', 'spa-overview', 'spa-services', 'spa-bookings']);

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
    description: 'Xem toàn bộ hồ sơ, giấy tờ xác minh và xử lý yêu cầu duyệt tại một nơi.',
    loader: adminApi.pets,
    columns: [],
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
  'system-profile': {
    title: 'Thông tin hệ thống',
    description: 'Quản lý thông tin chung và trạng thái vận hành của PetMatching tại một nơi duy nhất.',
    loader: adminApi.systemProfile,
    columns: [],
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
      { key: 'sellingPrice', label: 'Giá bán', render: (row) => moneyCell({ price: row.sellingPrice }) },
      { key: 'importPrice', label: 'Giá nhập', render: (row) => row.importPrice ? moneyCell({ price: row.importPrice }) : '-' },
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
    columns: [],
  },
  'spa-bookings': {
    title: 'Lịch đặt spa',
    description: 'Quản lý lịch hẹn, phân công lại nhân viên rảnh, giảm giá trễ 30p (10%) và theo dõi hiệu suất làm việc.',
    loader: adminApi.spaBookings,
    columns: [
      { key: 'user', label: 'Khách hàng', render: (row) => row.user?.name ?? '-' },
      { key: 'branch', label: 'Chi nhánh', render: (row) => row.branch?.name ?? row.addressSpa?.name ?? '-' },
      { key: 'service', label: 'Dịch vụ chính', render: (row) => row.service?.name ?? 'Gói Spa' },
      { key: 'subServices', label: 'Dịch vụ phụ', render: (row) => (row.subServiceIds?.length > 0 ? `${row.subServiceIds.length} dịch vụ lẻ` : 'Không') },
      { key: 'staff', label: 'Nhân viên phân công', render: (row) => row.staff?.name ?? 'Chưa phân công' },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
      { key: 'totalPrice', label: 'Tổng tiền', render: (row) => `${(row.totalPrice || row.priceSnapshot || 0).toLocaleString('vi-VN')}đ` },
      { key: 'performance', label: 'Hiệu suất ca', render: (row) => (row.completionDiffMinutes !== undefined && row.completionDiffMinutes !== null ? (row.completionDiffMinutes > 0 ? `⚠️ Muộn ${row.completionDiffMinutes}p` : `✅ Đúng giờ (${Math.abs(row.completionDiffMinutes)}p)`) : '-') },
      { key: 'scheduledAt', label: 'Thời gian hẹn', render: dateCell },
    ],
  },
  reports: {
    title: 'Kiểm duyệt ghép đôi',
    description: 'Tiếp nhận và xử lý các phản ánh phát sinh trong quá trình ghép đôi và trò chuyện.',
    loader: loadMatchingReports,
    columns: matchingReportColumns(),
  },
};

export default function AdminSectionPage() {
  const params = useParams<{ section: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = params.section;
  const section = requestedSection === 'pet-verifications' ? 'pets' : requestedSection;
  const config = sectionConfig[section] ?? sectionConfig.reports;
  const hasActions = !readOnlySections.has(section);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [complaintTarget, setComplaintTarget] = useState('ALL');
  const [complaintStatus, setComplaintStatus] = useState('PENDING');
  const [reportSearch, setReportSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [petVerificationFilter, setPetVerificationFilter] = useState<PetVerificationFilter>(
    requestedSection === 'pet-verifications' || searchParams.get('verification') === 'pending' ? 'PENDING' : 'ALL',
  );
  const [spaManagerRoleFlow, setSpaManagerRoleFlow] = useState<SpaManagerRoleFlow | null>(null);
  const [petModerationFlow, setPetModerationFlow] = useState<PetModerationFlow | null>(null);
  const [petDetail, setPetDetail] = useState<Row | null>(null);
  const [matchingReportDetail, setMatchingReportDetail] = useState<Row | null>(null);
  const [matchingReportLoading, setMatchingReportLoading] = useState(false);

  const load = useCallback(() => {
    setCurrentPage(1);
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
    if (requestedSection === 'pet-verifications') {
      router.replace('/admin/pets?verification=pending');
    }
  }, [requestedSection, router]);

  useEffect(() => {
    if (section !== 'reports') return;
    const query = new URLSearchParams(window.location.search);
    const status = query.get('status');
    setComplaintTarget(query.get('targetType') ?? 'ALL');
    setComplaintStatus(
      status === 'REVIEWING' ? 'PENDING' : status ?? 'PENDING',
    );
  }, [section]);

  const visibleRows = useMemo(() => {
    if (section === 'pets') {
      return [...rows]
        .filter((row) => petMatchesVerificationFilter(row, petVerificationFilter))
        .sort((left, right) => Number(hasActionablePetDocument(right)) - Number(hasActionablePetDocument(left)));
    }
    if (section !== 'reports') return rows;
    const normalizedSearch = reportSearch.trim().toLocaleLowerCase('vi');
    return rows.filter((row) =>
      (complaintTarget === 'ALL' || row.targetType === complaintTarget) &&
      (complaintStatus === 'ALL' ||
        (complaintStatus === 'PENDING'
          ? ['PENDING', 'REVIEWING'].includes(row.status)
          : row.status === complaintStatus)) &&
      (!normalizedSearch || [
        row.reporter?.name,
        row.reporter?.email,
        row.reportedUser?.name,
        row.pet?.name,
        formatMatchingReportReason(row.reason),
      ].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(normalizedSearch))),
    );
  }, [complaintStatus, complaintTarget, petVerificationFilter, reportSearch, rows, section]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / ADMIN_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedRows = visibleRows.slice(
    (activePage - 1) * ADMIN_PAGE_SIZE,
    activePage * ADMIN_PAGE_SIZE,
  );

  const titleStats = useMemo(() => {
    if (section === 'pets') {
      return {
        total: rows.length,
        active: rows.filter((row) => row.verificationBadge === 'VERIFIED').length,
        pending: rows.filter(hasActionablePetDocument).length,
      };
    }
    if (section === 'system-profile') {
      const profile = rows[0];
      return {
        total: 1,
        active: [profile?.storeStatus, profile?.spaStatus].filter((status) => status === 'ACTIVE').length,
        pending: [profile?.storeStatus, profile?.spaStatus].filter((status) => status !== 'ACTIVE').length,
      };
    }
    if (section === 'store-overview') {
      const stats = rows[0]?.stats ?? {};
      return { total: stats.todayOrders ?? 0, active: stats.completedOrders ?? 0, pending: stats.pendingOrders ?? 0 };
    }
    if (section === 'spa-overview') {
      const stats = rows[0]?.stats ?? {};
      return { total: stats.todayBookings ?? 0, active: stats.completedBookings ?? 0, pending: stats.pendingBookings ?? 0 };
    }
    if (section === 'spa-services') {
      const groups = groupSpaServiceVariants(rows);
      return {
        total: groups.length,
        active: groups.filter((group) => group.variants.some((service) => service.isActive)).length,
        pending: groups.filter((group) => group.variants.every((service) => !service.isActive)).length,
      };
    }
    const pending = rows.filter((row) =>
      ['PENDING', 'REVIEWING'].includes(row.status),
    ).length;
    const active = section === 'reports'
        ? rows.filter((row) =>
            ['RESOLVED', 'DISMISSED', 'INSUFFICIENT_EVIDENCE'].includes(
              row.status,
            ),
          ).length
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
      return true;
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Thao tác thất bại.');
      return false;
    } finally {
      setSavingId('');
    }
  };

  const handleRoleChange = (row: Row, nextRole: AdminRole) => {
    if (nextRole === row.role) return;

    if (row.role !== 'SPA_MANAGER' && nextRole === 'SPA_MANAGER') {
      setSpaManagerRoleFlow({ mode: 'GRANT', user: row });
      return;
    }

    if (row.role === 'SPA_MANAGER' && nextRole === 'USER') {
      setSpaManagerRoleFlow({ mode: 'REVOKE', user: row });
      return;
    }

    runAction(row, () => adminApi.updateUserRole(row.id, nextRole), 'Đã cập nhật vai trò.');
  };

  const inspectMatchingReport = async (row: Row) => {
    setMatchingReportLoading(true);
    try {
      if (row.status === 'PENDING') {
        await adminApi.startMatchingReportReview(row.id);
        setRows((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, status: 'REVIEWING' } : item,
          ),
        );
      }
      const response = await adminApi.matchingReport(row.id);
      setMatchingReportDetail(response.data);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      toast.error(message ?? 'Không thể tải chi tiết báo cáo.');
    } finally {
      setMatchingReportLoading(false);
    }
  };

  const moderateMatchingReportReporter = async (
    payload: ModerateReportAbusePayload,
  ) => {
    if (!matchingReportDetail) return;
    const reportId = matchingReportDetail.id;
    setSavingId(`reporter:${reportId}`);
    try {
      await adminApi.moderateMatchingReportReporter(reportId, payload);
      toast.success(
        payload.action === 'WARNING'
          ? 'Đã gửi cảnh báo đến người phản ánh.'
          : 'Đã khóa tài khoản người phản ánh.',
      );
      const response = await adminApi.matchingReport(reportId);
      setMatchingReportDetail(response.data);
      load();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      toast.error(message ?? 'Không thể xử lý tài khoản người phản ánh.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
        <div className="absolute -right-16 -top-20 size-52 rounded-full bg-primary/10" />
        <div className="relative grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              {section === 'users' ? <UsersRound className="size-5" /> : section === 'store-products' ? <PackageOpen className="size-5" /> : <ShieldAlert className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-primary">Trung tâm quản trị</p>
              <h2 className="mt-1.5 text-3xl font-black tracking-normal text-[#172033]">{config.title}</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#64748B]">{config.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 self-center">
            <MiniStat label={section === 'system-profile' ? 'Cơ sở' : section === 'spa-overview' ? 'Lịch hôm nay' : section === 'store-overview' ? 'Đơn hôm nay' : section === 'spa-services' ? 'Dịch vụ' : 'Tổng'} value={titleStats.total} />
            <MiniStat label={section === 'system-profile' ? 'Đang hoạt động' : ['spa-overview', 'store-overview'].includes(section) ? 'Hoàn thành' : section === 'store-products' ? 'Đang bán' : section === 'spa-services' ? 'Đang mở' : section === 'reports' ? 'Đã xử lý' : section === 'pets' ? 'Đã xác minh' : 'Hoạt động'} value={titleStats.active} />
            <MiniStat label={section === 'system-profile' || section === 'spa-services' ? 'Tạm ngừng' : section === 'store-products' ? 'Hết hàng' : 'Chờ xử lý'} value={titleStats.pending} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#D8E0EA] bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-6">
            <p className="font-black text-red-700">{error}</p>
          </div>
        ) : section === 'pets' ? (
          <PetManagementPanel
            allPets={rows}
            pets={paginatedRows}
            filter={petVerificationFilter}
            currentPage={activePage}
            totalItems={visibleRows.length}
            onFilterChange={(value) => {
              setPetVerificationFilter(value);
              setCurrentPage(1);
              window.history.replaceState(null, '', value === 'PENDING' ? '/admin/pets?verification=pending' : '/admin/pets');
            }}
            onPageChange={setCurrentPage}
            onInspect={setPetDetail}
          />
        ) : section === 'users' ? (
          <UserManagementPanel
            users={rows}
            savingId={savingId}
            onRunAction={runAction}
            onRoleChange={handleRoleChange}
          />
        ) : section === 'system-profile' ? (
          <SystemProfileForm profile={rows[0]} onSaved={load} />
        ) : section === 'store-overview' ? (
          <StoreOverviewPanel data={rows[0]} />
        ) : section === 'spa-overview' ? (
          <SpaOverviewPanel data={rows[0]} />
        ) : section === 'spa-services' ? (
          <SpaServicesPanel services={rows} />
        ) : section === 'store-products' ? (
          <ProductCatalogPanel products={rows} />
        ) : (
          <div>
            {section === 'reports' && (
              <MatchingReportFilters
                target={complaintTarget}
                status={complaintStatus}
                search={reportSearch}
                onSearchChange={(value) => {
                  setReportSearch(value);
                  setCurrentPage(1);
                }}
                onTargetChange={(value) => {
                  setComplaintTarget(value);
                  setCurrentPage(1);
                }}
                onStatusChange={(value) => {
                  setComplaintStatus(value);
                  setCurrentPage(1);
                }}
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
                  {paginatedRows.map((row, index) => (
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
                            onInspectMatchingReport={() => inspectMatchingReport(row)}
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
            <AdminPagination
              currentPage={activePage}
              totalItems={visibleRows.length}
              onPageChange={setCurrentPage}
              itemLabel={section === 'pets' ? 'thú cưng' : section === 'reports' ? 'phản ánh' : 'mục'}
            />
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

      {petDetail && (
        <PetDetailDialog
          pet={petDetail}
          onClose={() => setPetDetail(null)}
          onChanged={load}
          onModerate={(mode) => {
            setPetDetail(null);
            setPetModerationFlow({ mode, pet: petDetail });
          }}
        />
      )}

      <MatchingReportDialog
        key={matchingReportDetail?.id ?? 'closed'}
        report={matchingReportDetail}
        open={Boolean(matchingReportDetail)}
        onOpenChange={(open) => !open && setMatchingReportDetail(null)}
        resolving={Boolean(matchingReportDetail && savingId === matchingReportDetail.id)}
        moderatingReporter={Boolean(
          matchingReportDetail &&
            savingId === `reporter:${matchingReportDetail.id}`,
        )}
        onModerateReporter={moderateMatchingReportReporter}
        onResolve={(payload) => {
          if (!matchingReportDetail) return;
          runAction(
            matchingReportDetail,
            () =>
              adminApi.resolveMatchingReport(
                matchingReportDetail.id,
                payload,
              ),
            'Đã xử lý phản ánh.',
          ).then((resolved) => {
            if (resolved) setMatchingReportDetail(null);
          });
        }}
      />
      {matchingReportLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Loader2 className="size-8 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}

function MatchingReportDialog({
  report,
  open,
  onOpenChange,
  resolving,
  moderatingReporter,
  onResolve,
  onModerateReporter,
}: {
  report: Row | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolving: boolean;
  moderatingReporter: boolean;
  onResolve: (payload: ResolveMatchingReportPayload) => void;
  onModerateReporter: (
    payload: ModerateReportAbusePayload,
  ) => Promise<void>;
}) {
  const initialAction: ComplaintAction =
    report?.resolutionOptions?.RESOLVED?.[0] ?? 'RESOLVE';
  const [resolutionStatus, setResolutionStatus] = useState<
    ResolveMatchingReportPayload['status']
  >('RESOLVED');
  const [action, setAction] = useState<ComplaintAction>(initialAction);
  const [adminNote, setAdminNote] = useState('');
  const [resolutionMessage, setResolutionMessage] = useState(
    () =>
      report?.resolutionMessageTemplates?.RESOLVED?.[initialAction] ?? '',
  );
  const [documentTypes, setDocumentTypes] = useState<ReuploadDocumentType[]>([]);
  const messages = report?.match?.messages ?? [];
  const reporterActivity = report?.reporterActivity;
  const isTerminal = Boolean(
    report &&
      ['RESOLVED', 'DISMISSED', 'INSUFFICIENT_EVIDENCE'].includes(
        report.status,
      ),
  );
  const isViolationConclusion = resolutionStatus === 'RESOLVED';
  const availableActions: ComplaintAction[] = isViolationConclusion
    ? (report?.resolutionOptions?.RESOLVED ?? [])
    : ['DISMISS', 'RESOLVE'];
  const isPetDocumentRequest =
    report?.targetType === 'PET' &&
    resolutionStatus === 'INSUFFICIENT_EVIDENCE' &&
    action === 'RESOLVE';

  const changeConclusion = (
    conclusion: 'RESOLVED' | 'NOT_CONFIRMED',
  ) => {
    const nextStatus: ResolveMatchingReportPayload['status'] =
      conclusion === 'RESOLVED' ? 'RESOLVED' : 'DISMISSED';
    const nextAction: ComplaintAction =
      conclusion === 'RESOLVED'
        ? (report?.resolutionOptions?.RESOLVED?.[0] ?? 'WARNING')
        : 'DISMISS';
    setResolutionStatus(nextStatus);
    setAction(nextAction);
    setResolutionMessage(
      report?.resolutionMessageTemplates?.[nextStatus]?.[nextAction] ?? '',
    );
  };

  const changeAction = (nextAction: ComplaintAction) => {
    const nextStatus: ResolveMatchingReportPayload['status'] =
      isViolationConclusion
        ? 'RESOLVED'
        : nextAction === 'DISMISS'
          ? 'DISMISSED'
          : 'INSUFFICIENT_EVIDENCE';
    setResolutionStatus(nextStatus);
    setAction(nextAction);
    setResolutionMessage(
      report?.resolutionMessageTemplates?.[nextStatus]?.[nextAction] ??
        '',
    );
  };

  const canResolve = Boolean(
    adminNote.trim() &&
      resolutionMessage.trim() &&
      availableActions.length &&
      (!isPetDocumentRequest || documentTypes.length),
  );

  const toggleDocumentType = (type: ReuploadDocumentType) => {
    setDocumentTypes((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,820px)] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Xem xét phản ánh</DialogTitle>
          <DialogDescription>
            Kiểm tra nội dung phản ánh và ngữ cảnh trò chuyện trước khi xử lý.
          </DialogDescription>
        </DialogHeader>
        {report && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-2">
              <div className="rounded-xl border bg-[#F8FAFC] p-4 text-sm">
              <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-[#64748B]">Nội dung phản ánh</p>
              <div className="grid gap-3 sm:grid-cols-2">
              <p><span className="font-black">Người phản ánh:</span> {report.reporter?.name ?? report.userId}</p>
              <p><span className="font-black">Bên bị phản ánh:</span> {report.reportedUser?.name ?? report.reportedUserId ?? '-'}</p>
              <p>
                <span className="font-black">Đối tượng:</span>{' '}
                {formatComplaintTarget(report.targetType)} —{' '}
                {report.targetType === 'PET'
                  ? (report.pet?.name ?? report.petId)
                  : (report.reportedUser?.name ?? report.reportedUserId ?? '-')}
              </p>
              <p><span className="font-black">Gửi lúc:</span> {new Date(report.createdAt).toLocaleString('vi-VN')}</p>
              <p><span className="font-black">Lý do:</span> {formatMatchingReportReason(report.reason)}</p>
              </div>
              <div className="mt-4 rounded-lg border border-[#E5EAF0] bg-white p-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-[#64748B]">Mô tả của người phản ánh</p>
                <p className="mt-2 whitespace-pre-wrap break-words font-semibold text-[#334155]">{report.detail || 'Không cung cấp mô tả.'}</p>
              </div>
              {isTerminal && (
                <div className="mt-4 grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 sm:grid-cols-2">
                  <p><span className="font-black">Kết luận:</span> {formatMatchingReportConclusion(report.status)}</p>
                  <p><span className="font-black">Biện pháp:</span> {formatComplaintAction(report.actionTaken)}</p>
                  <p><span className="font-black">Người xử lý:</span> {report.resolver?.name ?? '-'}</p>
                  <p><span className="font-black">Xử lý lúc:</span> {report.resolvedAt ? new Date(report.resolvedAt).toLocaleString('vi-VN') : '-'}</p>
                  <p className="sm:col-span-2"><span className="font-black">Ghi chú nội bộ:</span> {report.adminNote ?? '-'}</p>
                  <p className="sm:col-span-2"><span className="font-black">Phản hồi đã gửi:</span> {report.resolutionMessage ?? '-'}</p>
                </div>
              )}
              </div>
              {reporterActivity && reporterActivity.level !== 'NORMAL' && (
                <div
                  className={`rounded-xl border p-4 text-sm ${
                    reporterActivity.level === 'SUSPECTED_SPAM'
                      ? 'border-red-200 bg-red-50 text-red-950'
                      : 'border-amber-200 bg-amber-50 text-amber-950'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-black">
                        {reporterActivity.level === 'SUSPECTED_SPAM'
                          ? 'Có dấu hiệu spam phản ánh'
                          : 'Tần suất phản ánh cao'}
                      </p>
                      <p className="mt-1 font-medium">
                        {reporterActivity.level === 'SUSPECTED_SPAM'
                          ? `Đã gửi ${reporterActivity.reportsLast7Days} phản ánh trong 7 ngày gần nhất.`
                          : `Đã gửi ${reporterActivity.reportsLast24Hours} phản ánh trong 24 giờ gần nhất.`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-current/15 pt-4">
                    <p className="font-black">Xử lý người gửi phản ánh</p>
                    {report.reporter?.accountStatus === 'SUSPENDED' ? (
                      <p className="mt-2 rounded-lg bg-red-100 p-3 font-bold text-red-800">
                        Tài khoản này hiện đang bị khóa.
                      </p>
                    ) : reporterActivity.level === 'HIGH_FREQUENCY' ? (
                      <button
                        type="button"
                        disabled={moderatingReporter}
                        onClick={() =>
                          onModerateReporter({ action: 'WARNING' })
                        }
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-black text-amber-800 disabled:opacity-60"
                      >
                        {moderatingReporter && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        Gửi cảnh báo
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={moderatingReporter}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Khóa tài khoản này do có dấu hiệu spam phản ánh?',
                            )
                          ) {
                            onModerateReporter({ action: 'BLOCK' });
                          }
                        }}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 font-black text-white disabled:opacity-60"
                      >
                        {moderatingReporter && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        Khóa tài khoản
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div>
              <h3 className="mb-1 text-sm font-black text-[#172033]">Ngữ cảnh cuộc trò chuyện</h3>
              <p className="mb-3 text-xs font-semibold text-[#64748B]">Hiển thị tối đa 30 tin nhắn gần thời điểm gửi phản ánh.</p>
              <div className="grid min-h-32 max-h-64 content-start gap-3 overflow-y-auto overscroll-contain rounded-xl border p-3 pr-2">
                {messages.map((message: Row) => (
                  <div key={message.id} className="rounded-lg bg-[#F8FAFC] p-3 text-sm">
                    <div className="flex justify-between gap-3 text-xs text-[#64748B]">
                      <span className="font-black text-[#334155]">
                        {message.sender?.name ?? message.senderId}{' '}
                        <span className="font-bold text-primary">
                          {message.senderId === report.reporter?.id ? '· Người phản ánh' : message.senderId === report.reportedUser?.id ? '· Bên bị phản ánh' : ''}
                        </span>
                      </span>
                      <span>{new Date(message.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    {message.content && <p className="mt-2 whitespace-pre-wrap break-words">{message.content}</p>}
                    {message.imageUrl && (
                      <a href={message.imageUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                        <img src={message.imageUrl} alt="Ảnh trong báo cáo" className="max-h-64 rounded-lg border object-contain" />
                      </a>
                    )}
                  </div>
                ))}
                {!messages.length && <p className="py-8 text-center text-sm text-[#64748B]">Cuộc ghép đôi không có tin nhắn.</p>}
              </div>
              </div>
              {!isTerminal && (
                <div className="space-y-4 border-t bg-white pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-bold">
                    <span>Kết luận xử lý</span>
                    <select
                      value={isViolationConclusion ? 'RESOLVED' : 'NOT_CONFIRMED'}
                      onChange={(event) =>
                        changeConclusion(
                          event.target.value as 'RESOLVED' | 'NOT_CONFIRMED',
                        )
                      }
                      className="h-10 w-full rounded-lg border bg-white px-3"
                    >
                      <option value="RESOLVED">Xác nhận có vi phạm</option>
                      <option value="NOT_CONFIRMED">Chưa xác nhận có vi phạm</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-bold">
                    <span>Biện pháp áp dụng</span>
                    <select
                      value={action}
                      onChange={(event) =>
                        changeAction(event.target.value as ComplaintAction)
                      }
                      className="h-10 w-full rounded-lg border bg-white px-3"
                    >
                      {availableActions.map((value) => (
                        <option key={value} value={value}>
                          {value === 'RESOLVE' && report.targetType === 'PET'
                            ? 'Yêu cầu tải lại giấy tờ'
                            : formatComplaintAction(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {isPetDocumentRequest && (
                  <fieldset className="rounded-xl border bg-muted/20 p-4">
                    <legend className="px-1 text-sm font-black">Giấy tờ cần tải lại</legend>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm font-bold">
                      {([
                        ['VACCINE_RECORD', 'Sổ tiêm phòng'],
                        ['PEDIGREE_CERT', 'Giấy chứng nhận phả hệ'],
                      ] as const).map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={documentTypes.includes(value)}
                            onChange={() => toggleDocumentType(value)}
                            className="size-4 accent-primary"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <label className="block space-y-2 text-sm font-bold">
                  <span>Ghi chú nội bộ</span>
                  <textarea
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    maxLength={1000}
                    rows={2}
                    placeholder="Căn cứ và lý do đưa ra quyết định..."
                    className="w-full resize-none rounded-lg border bg-white p-3 font-medium"
                  />
                </label>
                <label className="block space-y-2 text-sm font-bold">
                  <span>Nội dung kết quả gửi cho người phản ánh</span>
                  <textarea
                    value={resolutionMessage}
                    onChange={(event) =>
                      setResolutionMessage(event.target.value)
                    }
                    maxLength={1000}
                    rows={3}
                    className="w-full resize-none rounded-lg border bg-white p-3 font-medium"
                  />
                  <span className="block text-xs font-medium text-muted-foreground">
                    Nội dung được tạo sẵn theo kết luận và biện pháp, có thể chỉnh sửa trước khi gửi.
                  </span>
                </label>
                </div>
              )}
            </div>
            {!isTerminal && (
              <div className="flex shrink-0 justify-end border-t bg-white pt-4">
                <button
                    type="button"
                    disabled={resolving || !canResolve}
                    onClick={() =>
                      onResolve({
                        status: resolutionStatus,
                        action,
                        adminNote: adminNote.trim(),
                        resolutionMessage: resolutionMessage.trim(),
                        ...(isPetDocumentRequest ? { documentTypes } : {}),
                      })
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resolving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Hoàn tất xử lý
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
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
  const [currentPage, setCurrentPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filtered.slice(
    (activePage - 1) * ADMIN_PAGE_SIZE,
    activePage * ADMIN_PAGE_SIZE,
  );

  const verifiedCount = users.filter((user) => user.isVerified).length;
  const managerCount = users.filter((user) => ['STORE_MANAGER', 'SPA_MANAGER'].includes(user.role)).length;
  const suspendedCount = users.filter((user) => user.accountStatus === 'SUSPENDED').length;

  return (
    <div>
      <div className="grid gap-3 border-b border-[#E5EAF0] bg-[#FBFCFD] p-4 md:grid-cols-3">
        <UserQuickStat icon={UserCheck} label="Đã xác thực" value={verifiedCount} tone="emerald" />
        <UserQuickStat icon={ShieldAlert} label="Tài khoản quản lý" value={managerCount} tone="primary" />
        <UserQuickStat icon={UserX} label="Đang bị khóa" value={suspendedCount} tone="red" />
      </div>

      <div className="grid gap-3 border-b bg-card p-4 xl:grid-cols-[minmax(260px,1fr)_minmax(440px,1.35fr)_minmax(280px,0.85fr)] xl:items-center">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm theo tên, email hoặc mã người dùng..."
            className="h-10 rounded-xl pl-9 pr-10 font-semibold"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
        <AdminSegmentedFilter
          ariaLabel="Lọc theo vai trò"
          value={roleFilter}
          onChange={(value) => {
            setRoleFilter(value);
            setCurrentPage(1);
          }}
          options={[
            { value: 'ALL', label: 'Tất cả vai trò' },
            ...roleOptions.map((role) => ({ value: role, label: formatRole(role) })),
          ]}
        />
        <AdminSegmentedFilter
          ariaLabel="Lọc theo trạng thái tài khoản"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setCurrentPage(1);
          }}
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            ...accountStatusOptions.map((status) => ({ value: status, label: formatStatus(status) })),
          ]}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[26%]" />
          </colgroup>
          <thead className="bg-[#F7F9FB]">
            <tr>
              {['Người dùng', 'Vai trò hiện tại', 'Xác thực', 'Trạng thái', 'Ngày tham gia', 'Quản lý quyền'].map((label) => (
                <th key={label} className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-[#64748B]">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAF0]">
            {paginatedUsers.map((user) => (
              <tr key={user.id} className="transition hover:bg-[#F8FBFA]">
                <td className="px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-black text-primary-foreground shadow-sm">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-full object-cover" /> : getInitials(user.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#172033]">{user.name || 'Chưa cập nhật tên'}</p>
                      <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-[#64748B]"><Mail className="size-3.5 shrink-0" />{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4"><RoleBadge role={user.role} /></td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${user.isVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                    {user.isVerified ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                    {user.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                  </span>
                </td>
                <td className="px-4 py-4"><StatusBadge status={user.accountStatus} /></td>
                <td className="px-4 py-4 text-sm font-semibold text-[#64748B]">{dateCell(user)}</td>
                <td className="px-4 py-4">
                  <ActionGroup
                    section="users"
                    row={user}
                    busy={savingId === user.id}
                    onAction={(action, success) => onRunAction(user, action, success)}
                    onRoleChange={(role) => onRoleChange(user, role)}
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
      <AdminPagination
        currentPage={activePage}
        totalItems={filtered.length}
        onPageChange={setCurrentPage}
        itemLabel="tài khoản"
      />
    </div>
  );
}

function UserQuickStat({ icon: Icon, label, value, tone }: { icon: typeof UserCheck; label: string; value: number; tone: 'emerald' | 'primary' | 'red' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    primary: 'border-primary/20 bg-primary/10 text-primary',
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

function StatusBadge({ status, label, compact = false }: { status?: string; label?: ReactNode; compact?: boolean }) {
  const tones: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    APPROVED: 'bg-emerald-50 text-emerald-700',
    VERIFIED: 'bg-emerald-50 text-emerald-700',
    PENDING: 'bg-amber-50 text-amber-800',
    HIDDEN: 'bg-amber-50 text-amber-800',
    REVIEWING: 'bg-sky-50 text-sky-700',
    NEED_MORE_INFO: 'bg-orange-50 text-orange-700',
    REJECTED: 'bg-red-50 text-red-700',
    SUSPENDED: 'bg-red-50 text-red-700',
    INACTIVE: 'bg-slate-100 text-slate-600',
    NONE: 'bg-slate-100 text-slate-600',
  };
  return (
    <Badge
      variant="secondary"
      title={typeof label === 'string' ? label : formatStatus(status)}
      className={`max-w-full rounded-full border-0 font-black ${compact ? 'gap-1 px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${tones[status ?? 'NONE'] ?? tones.NONE}`}
    >
      <span className={`${compact ? 'size-1.5' : 'size-2'} rounded-full bg-current opacity-70`} />
      <span className="truncate">{label ?? formatStatus(status)}</span>
    </Badge>
  );
}

function hasActionablePetDocument(pet: Row) {
  return Boolean(pet.documents?.some((document: Row) => ['PENDING', 'REVIEWING'].includes(document.status)));
}

function petMatchesVerificationFilter(pet: Row, filter: PetVerificationFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'PENDING') return hasActionablePetDocument(pet);
  if (filter === 'VERIFIED') return pet.verificationBadge === 'VERIFIED';
  if (filter === 'NEED_MORE_INFO') return Boolean(pet.documents?.some((document: Row) => document.status === 'NEED_MORE_INFO'));
  return !pet.documents?.length;
}

function renderPetIdentity(row: Row) {
  return (
    <div className="flex items-center gap-3 whitespace-normal">
      <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
        {row.avatarUrl
          ? <Image src={row.avatarUrl} alt={row.name ?? 'Thú cưng'} fill sizes="48px" unoptimized className="object-cover" />
          : <PawPrint className="size-5 text-muted-foreground/70" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-black text-foreground" title={row.name}>
          {row.name ?? '-'}
        </span>
        <span className="mt-1 block truncate text-[10px] font-bold uppercase text-muted-foreground">
          #{String(row.id ?? '').slice(-6).toUpperCase()}
        </span>
      </span>
    </div>
  );
}

function renderPetProfileSummary(row: Row) {
  const breed = row.breed ?? '-';
  return (
    <div className="min-w-0 whitespace-normal">
      <p className="truncate font-black text-foreground">
        {formatSpecies(row.species)} · {formatGender(row.gender)}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-muted-foreground" title={breed}>{breed}</p>
    </div>
  );
}

function renderPetOwner(row: Row) {
  return (
    <div className="min-w-0 whitespace-normal">
      <p className="truncate font-black text-foreground">{row.owner?.name ?? '-'}</p>
      <p className="mt-1 truncate text-xs font-semibold text-muted-foreground" title={row.owner?.email}>{row.owner?.email ?? '-'}</p>
    </div>
  );
}

function renderPetDocumentSummary(row: Row) {
  const documents: Row[] = row.documents ?? [];
  if (!documents.length) return <StatusBadge status="NONE" />;
  return (
    <div className="grid min-w-0 gap-1.5 whitespace-normal">
      {documents.slice(0, 2).map((document) => (
        <div key={document.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-1.5">
          <span className="line-clamp-2 min-w-0 flex-1 text-[11px] font-bold leading-4 text-foreground" title={formatDocumentType(document.type)}>
            {formatDocumentType(document.type)}
          </span>
          <StatusBadge status={document.status} compact />
        </div>
      ))}
      {documents.length > 2 && <span className="text-xs font-bold text-muted-foreground">+{documents.length - 2} giấy tờ khác</span>}
    </div>
  );
}

function PetVerificationSummaryBadge({ pet }: { pet: Row }) {
  const documents: Row[] = pet.documents ?? [];
  const pendingCount = documents.filter((document) => ['PENDING', 'REVIEWING'].includes(document.status)).length;
  const needMoreInfoCount = documents.filter((document) => document.status === 'NEED_MORE_INFO').length;
  const rejectedCount = documents.filter((document) => document.status === 'REJECTED').length;

  if (pendingCount) {
    return <StatusBadge status="PENDING" label={`Chờ duyệt · ${pendingCount}`} />;
  }
  if (needMoreInfoCount) {
    return <StatusBadge status="NEED_MORE_INFO" label={`Cần bổ sung · ${needMoreInfoCount}`} />;
  }
  if (pet.verificationBadge === 'VERIFIED') {
    return <StatusBadge status="VERIFIED" />;
  }
  if (rejectedCount) {
    return <StatusBadge status="REJECTED" label={`Từ chối · ${rejectedCount}`} />;
  }
  return <StatusBadge status="NONE" />;
}


function getInitials(name?: string) {
  if (!name?.trim()) return 'U';
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
}


type SpaServiceVariantGroup = {
  key: string;
  name: string;
  species?: string | null;
  variants: Row[];
};

function getSpaServiceBaseName(service: Row) {
  const name = String(service.name ?? 'Dịch vụ Spa').trim();
  if (service.petWeightMin == null && service.petWeightMax == null) return name;

  return name
    .replace(/\s*\([^)]*kg[^)]*\)\s*$/iu, '')
    .replace(/\s+[<>]?\s*\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*kg\s*$/iu, '')
    .trim();
}

function groupSpaServiceVariants(services: Row[]): SpaServiceVariantGroup[] {
  const groups = new Map<string, SpaServiceVariantGroup>();

  services.forEach((service) => {
    const name = getSpaServiceBaseName(service);
    const key = [
      service.categoryId ?? service.category?.name ?? '',
      service.isMain === false ? 'SUB' : 'MAIN',
      service.species ?? 'ALL',
      name.toLocaleLowerCase('vi'),
    ].join('::');
    const existing = groups.get(key);

    if (existing) existing.variants.push(service);
    else groups.set(key, { key, name, species: service.species, variants: [service] });
  });

  return Array.from(groups.values()).sort((left, right) =>
    left.name.localeCompare(right.name, 'vi') || String(left.species).localeCompare(String(right.species)),
  );
}

function formatSpaSpeciesLabel(species?: string | null) {
  if (species === 'DOG') return 'Chó';
  if (species === 'CAT') return 'Mèo';
  return 'Dùng chung';
}

function getSpaWeightRepresentative(rangeKey: string) {
  const [rawMin, rawMax] = rangeKey.split(':');
  const min = rawMin === '' ? 0 : Number(rawMin);
  const max = rawMax === '' ? null : Number(rawMax);

  if (max == null || max === 100) return min + 0.5;
  return (min + max) / 2;
}

function matchesSpaServiceWeight(service: Row, weight: number) {
  if (service.petWeightMin == null && service.petWeightMax == null) return true;
  const min = service.petWeightMin == null ? 0 : Number(service.petWeightMin);
  const max = service.petWeightMax == null ? null : Number(service.petWeightMax);

  if (weight < min) return false;
  if (max == null || max === 100) return true;
  return service.isMain === false ? weight <= max : weight < max;
}

function getSpaWeightDistance(service: Row, weight: number) {
  if (service.petWeightMin == null && service.petWeightMax == null) return 0;
  const min = service.petWeightMin == null ? 0 : Number(service.petWeightMin);
  const max = service.petWeightMax == null || Number(service.petWeightMax) === 100
    ? Number.POSITIVE_INFINITY
    : Number(service.petWeightMax);

  if (weight < min) return min - weight;
  if (weight > max) return weight - max;
  return 0;
}

function SpaServicesPanel({ services }: { services: Row[] }) {
  const [weightRange, setWeightRange] = useState('LOWEST');
  const [currentPage, setCurrentPage] = useState(1);
  const groups = useMemo(() => groupSpaServiceVariants(services), [services]);

  const weightOptions = useMemo(() => {
    const ranges = new Map<string, { min: number | null; max: number | null }>();
    services.forEach((service) => {
      if (service.petWeightMin == null && service.petWeightMax == null) return;
      const key = getSpaWeightKey(service);
      if (!ranges.has(key)) {
        ranges.set(key, {
          min: service.petWeightMin == null ? null : Number(service.petWeightMin),
          max: service.petWeightMax == null ? null : Number(service.petWeightMax),
        });
      }
    });

    return Array.from(ranges.entries())
      .sort(([, left], [, right]) =>
        (left.min ?? 0) - (right.min ?? 0) ||
        (left.max ?? Number.POSITIVE_INFINITY) - (right.max ?? Number.POSITIVE_INFINITY),
      )
      .map(([value, range]) => ({ value, label: formatSpaWeightOption(range.min, range.max) }));
  }, [services]);

  const displayedGroups = useMemo(() => groups.map((group) => {
    const activeVariants = group.variants.filter((service) => service.isActive);
    const selectableVariants = activeVariants.length ? activeVariants : group.variants;
    let selectableCandidates = selectableVariants;

    if (weightRange !== 'LOWEST') {
      const representativeWeight = getSpaWeightRepresentative(weightRange);
      const matchingVariants = selectableVariants.filter((service) =>
        matchesSpaServiceWeight(service, representativeWeight),
      );

      if (matchingVariants.length) {
        selectableCandidates = matchingVariants;
      } else {
        const nearestDistance = Math.min(
          ...selectableVariants.map((service) => getSpaWeightDistance(service, representativeWeight)),
        );
        selectableCandidates = selectableVariants.filter((service) =>
          getSpaWeightDistance(service, representativeWeight) === nearestDistance,
        );
      }
    }

    const selected = selectableCandidates.reduce((lowest, service) =>
      Number(service.price) < Number(lowest.price) ? service : lowest,
    );
    return { ...group, selected };
  }), [groups, weightRange]);

  const totalPages = Math.max(1, Math.ceil(displayedGroups.length / ADMIN_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedGroups = displayedGroups.slice(
    (activePage - 1) * ADMIN_PAGE_SIZE,
    activePage * ADMIN_PAGE_SIZE,
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead className="bg-[#F7F9FB]">
            <tr className="h-[68px]">
              {['Dịch vụ', 'Mô tả'].map((label) => (
                <th key={label} className="align-middle px-4 py-3 text-[11px] font-black uppercase tracking-wider text-[#64748B]">{label}</th>
              ))}
              <th className="align-middle px-4 py-3 text-[11px] font-black uppercase tracking-wider text-[#64748B]">
                <label className="flex items-center gap-2">
                  <span className="shrink-0">Cân nặng</span>
                  <select
                    value={weightRange}
                    onChange={(event) => {
                      setWeightRange(event.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Chọn khoảng cân để xem giá dịch vụ Spa"
                    className="h-8 min-w-0 flex-1 rounded-lg border border-[#D8E0EA] bg-white px-2 text-xs font-black normal-case text-[#334155] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="LOWEST">Mặc định</option>
                    {weightOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </th>
              {['Giá', 'Thời lượng', 'Trạng thái', 'Lượt đặt'].map((label) => (
                <th key={label} className="align-middle px-4 py-3 text-[11px] font-black uppercase tracking-wider text-[#64748B]">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAF0]">
            {paginatedGroups.map((group) => {
              const service = group.selected;
              const duration = service.durationMax && service.durationMax !== service.durationMin
                ? `${service.durationMin}–${service.durationMax} phút`
                : `${service.durationMin} phút`;

              return (
                <tr key={group.key} className="transition hover:bg-[#FAFBFC]">
                  <td className="px-4 py-4">
                    <p className="text-sm font-black text-[#172033]">{group.name}</p>
                    <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-black text-muted-foreground">
                      {formatSpaSpeciesLabel(group.species)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-[#475569]">
                    <p className="line-clamp-2">{service.description || '-'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
                      {service.petWeightMin == null && service.petWeightMax == null
                        ? 'Mọi cân nặng'
                        : formatSpaWeightOption(
                          service.petWeightMin == null ? null : Number(service.petWeightMin),
                          service.petWeightMax == null ? null : Number(service.petWeightMax),
                        )}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-base font-black text-primary">{moneyCell(service)}</p>
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-[#475569]">{duration}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${service.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      <span className="size-2 rounded-full bg-current opacity-70" />
                      {service.isActive ? 'Đang hoạt động' : 'Tạm ngừng'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm font-black text-[#172033]">{service._count?.bookings ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AdminPagination
        currentPage={activePage}
        totalItems={displayedGroups.length}
        onPageChange={setCurrentPage}
        itemLabel="dịch vụ"
      />
    </div>
  );
}

function ProductCatalogPanel({ products }: { products: Row[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [availability, setAvailability] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filtered.slice(
    (activePage - 1) * ADMIN_PAGE_SIZE,
    activePage * ADMIN_PAGE_SIZE,
  );

  return (
    <div>
      <div className="grid gap-3 border-b bg-card p-4 xl:grid-cols-[minmax(280px,1fr)_auto_auto] xl:items-center">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm theo mã, tên hoặc thương hiệu..."
            className="h-10 rounded-xl pl-9 font-semibold"
          />
        </label>
        <AdminSegmentedFilter
          ariaLabel="Lọc theo danh mục sản phẩm"
          value={category}
          onChange={(value) => {
            setCategory(value);
            setCurrentPage(1);
          }}
          options={[
            { value: 'ALL', label: 'Tất cả danh mục' },
            ...categories.map((item) => ({ value: item, label: formatCategory(item) })),
          ]}
        />
        <AdminSegmentedFilter
          ariaLabel="Lọc theo trạng thái sản phẩm"
          value={availability}
          onChange={(value) => {
            setAvailability(value);
            setCurrentPage(1);
          }}
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            { value: 'ACTIVE', label: 'Đang bán' },
            { value: 'LOW', label: 'Sắp hết hàng' },
            { value: 'OUT', label: 'Hết hàng' },
            { value: 'INACTIVE', label: 'Ngừng bán' },
          ]}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-left">
          <thead className="bg-[#F7F9FB]">
            <tr>
              {['Sản phẩm', 'Mã sản phẩm', 'Danh mục', 'Giá bán', 'Giá nhập', 'Tồn kho', 'Trạng thái', 'Cập nhật'].map((label) => (
                <th key={label} className="px-5 py-4 text-[11px] font-black uppercase tracking-wider text-[#64748B]">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAF0]">
            {paginatedProducts.map((product) => {
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
                  <td className="px-5 py-4"><span className="inline-flex rounded-lg bg-primary/10 px-3 py-1.5 font-mono text-sm font-black tracking-wider text-primary">#{product.id}</span></td>
                  <td className="px-5 py-4 text-sm font-bold text-[#475569]">{formatCategory(product.category)}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-[#172033]">{moneyCell({ price: product.salePrice ?? product.sellingPrice })}</p>
                    {product.salePrice && <p className="mt-1 text-xs font-semibold text-[#94A3B8] line-through">{moneyCell({ price: product.sellingPrice })}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-[#475569]">{product.importPrice ? moneyCell({ price: product.importPrice }) : '-'}</td>
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
              <tr><td colSpan={8} className="px-5 py-16 text-center"><AlertTriangle className="mx-auto size-7 text-[#94A3B8]" /><p className="mt-3 text-sm font-bold text-[#64748B]">Không tìm thấy sản phẩm phù hợp.</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <AdminPagination
        currentPage={activePage}
        totalItems={filtered.length}
        onPageChange={setCurrentPage}
        itemLabel="sản phẩm"
      />
    </div>
  );
}

function SystemProfileForm({ profile, onSaved }: { profile?: Row; onSaved: () => void }) {
  const initialForm = () => ({
    name: profile?.name ?? 'PetMatching',
    description: profile?.description ?? '',
    address: profile?.address ?? '',
    phone: profile?.phone ?? '',
    storeStatus: (profile?.storeStatus ?? 'ACTIVE') as ApprovalStatus,
    spaStatus: (profile?.spaStatus ?? 'ACTIVE') as ApprovalStatus,
  });
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initialForm()), [profile]);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = { ...form, name: form.name.trim(), address: form.address.trim(), phone: form.phone.trim() };
    if (!data.name || !data.address || !data.phone) {
      toast.error('Vui lòng nhập tên, địa chỉ và số điện thoại.');
      return;
    }

    setSaving(true);
    try {
      await adminApi.updateSystemProfile(data);
      toast.success('Đã cập nhật thông tin hệ thống.');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Không thể cập nhật thông tin hệ thống.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 p-6">
      <div className="rounded-xl border border-[#BFE1DC] bg-[#EFFAF8] p-4">
        <p className="text-sm font-black text-primary">Một cơ sở PetMatching duy nhất</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#476861]">
          Thông tin bên dưới được dùng thống nhất cho Store và Spa, trong khi trạng thái vận hành được điều khiển độc lập.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <StoreField label="Tên thương hiệu" required value={form.name} onChange={(value) => update('name', value)} />
        <StoreField label="Số điện thoại" required value={form.phone} onChange={(value) => update('phone', value)} />
      </div>
      <StoreField label="Địa chỉ" required value={form.address} onChange={(value) => update('address', value)} />
      <label className="grid gap-2 text-sm font-black text-[#172033]">
        Mô tả chung
        <textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows={4} className="resize-none rounded-lg border border-[#D8E0EA] bg-white p-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
      </label>
      <div className="grid gap-5 md:grid-cols-2">
        <StatusField label="Trạng thái Store" value={form.storeStatus} onChange={(value) => update('storeStatus', value)} />
        <StatusField label="Trạng thái nhận lịch Spa" value={form.spaStatus} onChange={(value) => update('spaStatus', value)} />
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-[#E5EAF0] pt-5">
        <p className="text-xs font-semibold text-[#64748B]">Mọi thay đổi được áp dụng đồng thời cho Store và Spa.</p>
        <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
          {saving && <Loader2 className="size-4 animate-spin" />}
          Lưu thông tin
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
    { label: 'Thông tin hệ thống', value: data?.store?.status === 'ACTIVE' ? 'Đang mở' : 'Tạm ngừng', href: '/admin/system-profile' },
  ];

  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((item) => (
          <Link key={`${item.href}-${item.label}`} href={item.href} className="rounded-xl border border-[#D8E0EA] bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
            <p className="text-xs font-black uppercase tracking-wider text-[#64748B]">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-[#172033]">{item.value}</p>
            <p className="mt-3 text-xs font-black text-primary">Xem chi tiết →</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MiniStat label="Đơn chờ xử lý" value={stats.pendingOrders ?? 0} />
        <MiniStat label="Đã giao" value={stats.completedOrders ?? 0} />
        <MiniStat label="Doanh thu đơn đã giao" value={moneyCell({ price: stats.revenue ?? 0 })} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#D8E0EA]">
        <div className="flex items-center justify-between border-b border-[#E5EAF0] bg-[#F7F9FB] px-5 py-4">
          <div>
            <h3 className="font-black text-[#172033]">Đơn hàng gần đây</h3>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">Năm đơn hàng mới nhất của cửa hàng.</p>
          </div>
          <Link href="/admin/store-orders" className="text-sm font-black text-primary">Xem tất cả</Link>
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
              <span className="text-sm font-bold text-primary">{formatStatus(order.status)}</span>
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
    { label: 'Lịch đặt hôm nay', value: stats.todayBookings ?? 0, href: '/admin/spa-bookings' },
    { label: 'Thông tin hệ thống', value: data?.spa?.status === 'ACTIVE' ? 'Đang mở' : 'Tạm ngừng', href: '/admin/system-profile' },
  ];

  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-xl border border-[#D8E0EA] bg-white p-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
            <p className="text-xs font-black uppercase tracking-wider text-[#64748B]">{item.label}</p>
            <p className="mt-2 text-2xl font-black text-[#172033]">{item.value}</p>
            <p className="mt-3 text-xs font-black text-primary">Xem chi tiết →</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MiniStat label="Chờ xử lý" value={stats.pendingBookings ?? 0} />
        <MiniStat label="Đã hoàn thành" value={stats.completedBookings ?? 0} />
        <MiniStat label="Doanh thu spa" value={moneyCell({ price: stats.revenue ?? 0 })} />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#D8E0EA]">
        <div className="flex items-center justify-between border-b border-[#E5EAF0] bg-[#F7F9FB] px-5 py-4">
          <div>
            <h3 className="font-black text-[#172033]">Lịch sắp tới</h3>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">Năm lịch gần nhất của Spa.</p>
          </div>
          <Link href="/admin/spa-bookings" className="text-sm font-black text-primary">Xem tất cả</Link>
        </div>
        <div className="divide-y divide-[#E5EAF0]">
          {(data?.upcomingBookings ?? []).map((booking: Row) => (
            <div key={booking.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
              <p className="font-black text-[#172033]">{booking.user?.name ?? 'Khách hàng'}</p>
              <p className="text-sm font-semibold text-[#475569]">{booking.service?.name ?? 'Dịch vụ Spa'}</p>
              <p className="text-sm font-semibold text-[#64748B]">{booking.staff?.name ?? 'Chưa phân công'}</p>
              <p className="text-sm font-bold text-primary">{dateCell(booking)}</p>
            </div>
          ))}
          {!data?.upcomingBookings?.length && <p className="px-5 py-10 text-center text-sm font-semibold text-[#64748B]">Chưa có lịch sắp tới.</p>}
        </div>
      </section>
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
        className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
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
          <p className="text-[11px] font-black uppercase tracking-wider text-primary">Quản lý phân quyền Spa</p>
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
              <Loader2 className="size-7 animate-spin text-primary" />
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
                  className="mt-1 accent-primary"
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
                  className="mt-1 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-[#172033]">Chuyển giao cho Manager khác</span>
                  <span className="mt-1 block text-xs font-semibold text-[#64748B]">Bàn giao Spa trước khi thu hồi quyền.</span>
                  {revokeMode === 'TRANSFER' && (
                    <select
                      value={newManagerId}
                      onChange={(event) => setNewManagerId(event.target.value)}
                      className="mt-3 h-10 w-full rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-primary"
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
          <button type="button" onClick={submit} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:opacity-50">
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
          <p className="text-[11px] font-black uppercase tracking-wider text-primary">Kiểm duyệt hồ sơ thú cưng</p>
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
              <Loader2 className="size-7 animate-spin text-primary" />
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
                  className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-primary"
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
                  className="resize-none rounded-lg border border-[#D8E0EA] bg-white p-3 text-sm font-semibold outline-none focus:border-primary"
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
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
  onInspectMatchingReport,
}: {
  section: string;
  row: Row;
  busy: boolean;
  onAction: (action: () => Promise<unknown>, success: string) => void;
  onRoleChange: (role: AdminRole) => void;
  onInspectMatchingReport?: () => void;
}) {
  if (busy) {
    return <Loader2 className="ml-auto size-5 animate-spin text-primary" />;
  }

  if (section === 'users') {
    const availableRoles: AdminRole[] = row.role === 'SPA_MANAGER'
      ? ['SPA_MANAGER', 'USER']
      : row.role === 'STORE_MANAGER'
        ? ['STORE_MANAGER', 'USER', 'SPA_STAFF']
        : roleOptions;

    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0">
          <select
            className="h-9 w-full min-w-0 rounded-lg border border-[#D8E0EA] bg-white px-2 text-xs font-black text-[#334155] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            value={row.role}
            onChange={(event) => onRoleChange(event.target.value as AdminRole)}
          >
            {availableRoles.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
          </select>
        </label>
        <label className="min-w-0">
          <select
            className="h-9 w-full min-w-0 rounded-lg border border-[#D8E0EA] bg-white px-2 text-xs font-black text-[#334155] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            value={row.accountStatus}
            onChange={(event) => onAction(() => adminApi.updateAccountStatus(row.id, event.target.value as AccountStatus), 'Đã cập nhật trạng thái tài khoản.')}
          >
            {accountStatusOptions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
          </select>
        </label>
      </div>
    );
  }

  if (section === 'reports') {
    return (
      <div className="flex justify-end gap-2">
        <IconButton label="Xem xét" icon={Eye} onClick={() => onInspectMatchingReport?.()} />
      </div>
    );
  }

  return <span className="block text-right text-xs font-black text-[#94A3B8]">Chỉ xem</span>;
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
      className="inline-flex size-9 items-center justify-center rounded-lg border border-[#D8E0EA] bg-white text-[#475569] shadow-sm transition hover:border-primary hover:bg-primary/10 hover:text-primary"
    >
      <Icon className="size-4" />
    </button>
  );
}

function AdminPagination({
  currentPage,
  totalItems,
  onPageChange,
  itemLabel,
}: {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemLabel: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_PAGE_SIZE));
  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * ADMIN_PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * ADMIN_PAGE_SIZE, totalItems);
  const pageItems: Array<number | 'start-ellipsis' | 'end-ellipsis'> = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : currentPage <= 4
      ? [1, 2, 3, 4, 5, 'end-ellipsis', totalPages]
      : currentPage >= totalPages - 3
        ? [1, 'start-ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, 'start-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'end-ellipsis', totalPages];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3">
      <p className="text-xs font-bold text-muted-foreground">
        Hiển thị {firstItem}–{lastItem} trên {totalItems} {itemLabel}
      </p>
      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={currentPage === 1}
                tabIndex={currentPage === 1 ? -1 : 0}
                onClick={(event) => {
                  event.preventDefault();
                  if (currentPage > 1) onPageChange(currentPage - 1);
                }}
                className={currentPage === 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
              />
            </PaginationItem>
            {pageItems.map((item, index) => (
              typeof item === 'number' ? (
                <PaginationItem key={item}>
                  <PaginationLink
                    isActive={item === currentPage}
                    aria-label={`Đến trang ${item}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange(item);
                    }}
                    className={item === currentPage
                      ? 'cursor-pointer border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      : 'cursor-pointer'}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ) : (
                <PaginationItem key={`${item}-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              )
            ))}
            <PaginationItem>
              <PaginationNext
                aria-disabled={currentPage === totalPages}
                tabIndex={currentPage === totalPages ? -1 : 0}
                onClick={(event) => {
                  event.preventDefault();
                  if (currentPage < totalPages) onPageChange(currentPage + 1);
                }}
                className={currentPage === totalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function AdminSegmentedFilter({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap rounded-xl border bg-muted/20 p-1"
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              isActive
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
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

function MatchingReportFilters({
  target,
  status,
  search,
  onSearchChange,
  onTargetChange,
  onStatusChange,
}: {
  target: string;
  status: string;
  search: string;
  onSearchChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 border-b bg-card p-4 xl:grid-cols-[minmax(260px,1fr)_auto_auto]">
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Tìm kiếm</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Tên, email, thú cưng hoặc lý do..." aria-label="Tìm kiếm phản ánh ghép đôi" className="pl-9" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Đối tượng</p>
        <AdminSegmentedFilter
          ariaLabel="Lọc theo đối tượng"
          value={target}
          onChange={onTargetChange}
          options={complaintTargetOptions.map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Trạng thái</p>
        <AdminSegmentedFilter
          ariaLabel="Lọc theo trạng thái"
          value={status}
          onChange={onStatusChange}
          options={complaintStatusOptions.map(([value, label]) => ({ value, label }))}
        />
      </div>
    </div>
  );
}

function matchingReportColumns() {
  return [
    { key: 'reason', label: 'Lý do', render: (row: Row) => formatMatchingReportReason(row.reason) },
    { key: 'targetType', label: 'Đối tượng', render: (row: Row) => formatComplaintTarget(row.targetType) },
    { key: 'targetId', label: 'Người/Thú cưng bị phản ánh' },
    { key: 'reporterId', label: 'Người phản ánh', render: (row: Row) => row.reporter?.name ?? row.reporterId },
    { key: 'detail', label: 'Chi tiết' },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row: Row) =>
        ['PENDING', 'REVIEWING'].includes(row.status)
          ? 'Chờ xử lý'
          : formatStatus(row.status),
    },
    { key: 'createdAt', label: 'Ngày gửi', render: dateCell },
  ];
}

async function loadMatchingReports(): Promise<{ data: Row[] }> {
  const matchingReportsResponse = await adminApi.matchingReports();
  const matchingReports: Row[] = Array.isArray(matchingReportsResponse.data)
    ? matchingReportsResponse.data.map((report: Row): Row => ({
      ...report,
      reporterId: report.userId,
      targetType: report.targetType ?? 'USER',
      targetId: report.targetType === 'PET'
        ? (report.pet?.name ?? report.petId)
        : (report.reportedUser?.name ?? report.reportedUserId),
    }))
    : [];

  return {
    data: matchingReports.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  };
}

function normalizeRows(section: string, data: Row[] | Row): Row[] {
  if (['system-profile', 'store-overview', 'spa-overview'].includes(section) && !Array.isArray(data)) return [data];
  if (section === 'stores' && Array.isArray(data)) {
    return data.length ? [data[0]] : [];
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

function formatComplaintTarget(target?: string) {
  const labels: Record<string, string> = {
    ORDER: 'Đơn hàng',
    PRODUCT: 'Sản phẩm',
    PET: 'Thú cưng',
    USER: 'Người dùng',
  };
  return target ? labels[target] ?? target : '-';
}

function PetVerificationFilters({
  rows,
  value,
  onChange,
}: {
  rows: Row[];
  value: PetVerificationFilter;
  onChange: (value: PetVerificationFilter) => void;
}) {
  const options: Array<{ value: PetVerificationFilter; label: string; count: number }> = [
    { value: 'ALL', label: 'Tất cả', count: rows.length },
    { value: 'PENDING', label: 'Chờ duyệt', count: rows.filter(hasActionablePetDocument).length },
    { value: 'VERIFIED', label: 'Đã xác minh', count: rows.filter((row) => row.verificationBadge === 'VERIFIED').length },
    { value: 'NEED_MORE_INFO', label: 'Cần bổ sung', count: rows.filter((row) => row.documents?.some((document: Row) => document.status === 'NEED_MORE_INFO')).length },
    { value: 'NONE', label: 'Chưa có giấy tờ', count: rows.filter((row) => !row.documents?.length).length },
  ];

  return (
    <div className="border-b bg-muted/20 px-5 py-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lọc thú cưng theo trạng thái xác minh">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            onClick={() => onChange(option.value)}
            size="sm"
            variant={value === option.value ? 'default' : 'outline'}
            className="rounded-lg text-xs font-black"
          >
            {option.label}
            <Badge
              variant="secondary"
              className={`border-0 px-1.5 py-0 text-[10px] ${value === option.value ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}
            >
              {option.count}
            </Badge>
          </Button>
        ))}
      </div>
    </div>
  );
}

function PetManagementPanel({
  allPets,
  pets,
  filter,
  currentPage,
  totalItems,
  onFilterChange,
  onPageChange,
  onInspect,
}: {
  allPets: Row[];
  pets: Row[];
  filter: PetVerificationFilter;
  currentPage: number;
  totalItems: number;
  onFilterChange: (value: PetVerificationFilter) => void;
  onPageChange: (page: number) => void;
  onInspect: (pet: Row) => void;
}) {
  return (
    <div>
      <PetVerificationFilters rows={allPets} value={filter} onChange={onFilterChange} />
      <Table className="w-full table-fixed">
        <TableHeader className="bg-muted/35">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[17%] px-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Thú cưng</TableHead>
            <TableHead className="w-[12%] px-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Thông tin</TableHead>
            <TableHead className="w-[17%] px-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Chủ sở hữu</TableHead>
            <TableHead className="w-[19%] px-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Giấy tờ</TableHead>
            <TableHead className="w-[12%] px-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Xác minh</TableHead>
            <TableHead className="w-[11%] px-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Trạng thái</TableHead>
            <TableHead className="w-[12%] px-4 text-right text-[11px] font-black uppercase tracking-wider text-muted-foreground">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pets.map((pet) => (
            <TableRow key={pet.id} className="group">
              <TableCell className="px-4 py-4 whitespace-normal">{renderPetIdentity(pet)}</TableCell>
              <TableCell className="px-3 py-4 whitespace-normal">{renderPetProfileSummary(pet)}</TableCell>
              <TableCell className="px-3 py-4 whitespace-normal">{renderPetOwner(pet)}</TableCell>
              <TableCell className="px-3 py-4 whitespace-normal">{renderPetDocumentSummary(pet)}</TableCell>
              <TableCell className="px-3 py-4 whitespace-normal"><PetVerificationSummaryBadge pet={pet} /></TableCell>
              <TableCell className="px-3 py-4 whitespace-normal"><StatusBadge status={pet.status} label={formatStatus(pet.status)} /></TableCell>
              <TableCell className="px-4 py-4 text-right">
                <Button
                  type="button"
                  size="sm"
                  variant={hasActionablePetDocument(pet) ? 'default' : 'outline'}
                  onClick={() => onInspect(pet)}
                  aria-label={hasActionablePetDocument(pet) ? `Xem và duyệt hồ sơ ${pet.name}` : `Xem chi tiết hồ sơ ${pet.name}`}
                  className="w-full max-w-[132px] rounded-lg px-2 text-xs font-black"
                >
                  <Eye className="size-4" />
                  <span className="hidden lg:inline">{hasActionablePetDocument(pet) ? 'Xem & duyệt' : 'Chi tiết'}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!pets.length && (
            <TableRow>
              <TableCell colSpan={7} className="h-40 text-center whitespace-normal text-sm font-semibold text-muted-foreground">
                Không có thú cưng phù hợp với bộ lọc này.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <AdminPagination currentPage={currentPage} totalItems={totalItems} onPageChange={onPageChange} itemLabel="thú cưng" />
    </div>
  );
}

function PetDetailDialog({
  pet,
  onClose,
  onChanged,
  onModerate,
}: {
  pet: Row;
  onClose: () => void;
  onChanged: () => void;
  onModerate: (mode: 'HIDE' | 'RESTORE') => void;
}) {
  const [detail, setDetail] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reviewIntent, setReviewIntent] = useState<{ documentId: string; status: DocumentStatus } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.pet(pet.id);
      setDetail(response.data);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message ?? 'Không thể tải chi tiết hồ sơ thú cưng.');
    } finally {
      setLoading(false);
    }
  }, [pet.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadDetail(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDetail]);

  const beginReview = (documentId: string, status: DocumentStatus) => {
    setReviewIntent({ documentId, status });
    setReviewNote('');
    setError('');
  };

  const submitReview = async () => {
    if (!reviewIntent) return;
    const normalizedNote = reviewNote.trim();
    if (reviewIntent.status !== 'APPROVED' && !normalizedNote) {
      setError(reviewIntent.status === 'REJECTED' ? 'Vui lòng nhập lý do từ chối.' : 'Vui lòng ghi rõ thông tin cần bổ sung.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await adminApi.reviewPetDocument(reviewIntent.documentId, reviewIntent.status, normalizedNote || undefined);
      toast.success(
        reviewIntent.status === 'APPROVED'
          ? 'Đã duyệt giấy tờ thú cưng.'
          : reviewIntent.status === 'REJECTED'
            ? 'Đã từ chối giấy tờ thú cưng.'
            : 'Đã yêu cầu bổ sung thông tin.',
      );
      setReviewIntent(null);
      setReviewNote('');
      await loadDetail();
      onChanged();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message ?? 'Không thể cập nhật kết quả xác minh.');
    } finally {
      setSaving(false);
    }
  };

  const profileImages = detail
    ? Array.from(new Set([detail.avatarUrl, ...(detail.gallery ?? [])].filter(Boolean))) as string[]
    : [];
  const documents: Row[] = detail?.documents ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="grid max-h-[92vh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-[#E5EAF0] px-6 py-5 pr-14 text-left">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-primary">Chi tiết hồ sơ thú cưng</p>
              <DialogTitle className="mt-1 text-2xl">{detail?.name ?? pet.name}</DialogTitle>
              <DialogDescription className="mt-1">
                Xem đầy đủ thông tin và giấy tờ trước khi đưa ra quyết định.
              </DialogDescription>
            </div>
            {detail && detail.status !== 'INACTIVE' && (
              <button
                type="button"
                onClick={() => onModerate(detail.status === 'HIDDEN' ? 'RESTORE' : 'HIDE')}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#D8E0EA] bg-white px-3 text-xs font-black text-[#475569] transition hover:border-primary hover:text-primary"
              >
                {detail.status === 'HIDDEN' ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                {detail.status === 'HIDDEN' ? 'Khôi phục hồ sơ' : 'Ẩn hồ sơ'}
              </button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
        ) : detail ? (
          <div className="grid min-h-0 gap-6 overflow-x-hidden overflow-y-auto p-6">
            <section className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <div>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-[#D8E0EA] bg-[#F4F7FA]">
                  {profileImages[0] ? (
                    <button type="button" onClick={() => setViewingImageUrl(profileImages[0])} className="relative size-full">
                      <Image src={profileImages[0]} alt={detail.name} fill sizes="240px" unoptimized className="object-cover" />
                    </button>
                  ) : <PawPrint className="size-16 text-[#94A3B8]" />}
                </div>
                {profileImages.length > 1 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {profileImages.slice(1, 5).map((url, index) => (
                      <button key={url} type="button" onClick={() => setViewingImageUrl(url)} className="relative aspect-square overflow-hidden rounded-lg border border-[#D8E0EA]">
                        <Image src={url} alt={`${detail.name} ${index + 2}`} fill sizes="52px" unoptimized className="object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid content-start gap-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <PetDetailField label="Loài" value={formatSpecies(detail.species)} />
                  <PetDetailField label="Giống" value={detail.breed} />
                  <PetDetailField label="Giới tính" value={formatGender(detail.gender)} />
                  <PetDetailField label="Ngày sinh" value={formatDateValue(detail.birthday)} />
                  <PetDetailField label="Cân nặng" value={detail.weight != null ? `${detail.weight} kg` : '-'} />
                  <PetDetailField label="Khu vực" value={[detail.ward, detail.district, detail.location].filter(Boolean).join(', ') || '-'} />
                </div>
                <div className="rounded-xl border border-[#D8E0EA] bg-[#F7F9FB] p-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#64748B]">Chủ sở hữu</p>
                  <p className="mt-2 font-black text-[#172033]">{detail.owner?.name ?? '-'}</p>
                  <p className="mt-1 text-sm font-semibold text-[#64748B]">{detail.owner?.email ?? '-'}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5">
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Tài khoản chủ</p>
                      <StatusBadge status={detail.owner?.accountStatus} label={formatStatus(detail.owner?.accountStatus)} />
                    </div>
                    <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5">
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Hồ sơ thú cưng</p>
                      <StatusBadge status={detail.status} label={formatStatus(detail.status)} />
                    </div>
                    <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5">
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[#64748B]">Xác minh giấy tờ</p>
                      <StatusBadge status={detail.verificationBadge} label={formatStatus(detail.verificationBadge)} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-primary">Giấy tờ xác minh</p>
                  <h3 className="mt-1 text-lg font-black text-[#172033]">{documents.length} giấy tờ trong hồ sơ</h3>
                </div>
                <span className="text-xs font-bold text-[#64748B]">
                  {documents.filter((document) => ['PENDING', 'REVIEWING'].includes(document.status)).length} giấy tờ đang chờ duyệt
                </span>
              </div>

              {documents.length ? (
                <div className="grid gap-3">
                  {documents.map((document) => {
                    const canReview = ['PENDING', 'REVIEWING'].includes(document.status);
                    const activeReview = reviewIntent?.documentId === document.id ? reviewIntent : null;
                    return (
                      <article key={document.id} className="rounded-xl border border-[#D8E0EA] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-black text-[#172033]">{document.title || formatDocumentType(document.type)}</h4>
                              <StatusBadge status={document.status} />
                            </div>
                            <p className="mt-1 text-xs font-semibold text-[#64748B]">Gửi ngày {formatDateValue(document.createdAt)}</p>
                          </div>
                          {canReview && (
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => beginReview(document.id, 'APPROVED')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700">
                                <CheckCircle2 className="size-4" /> Duyệt
                              </button>
                              <button type="button" onClick={() => beginReview(document.id, 'NEED_MORE_INFO')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-800 hover:bg-amber-100">
                                <ShieldAlert className="size-4" /> Yêu cầu bổ sung
                              </button>
                              <button type="button" onClick={() => beginReview(document.id, 'REJECTED')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100">
                                <XCircle className="size-4" /> Từ chối
                              </button>
                            </div>
                          )}
                        </div>

                        {activeReview && (
                          <div className={`mt-3 rounded-lg border px-3 py-2.5 ${activeReview.status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50/70' : activeReview.status === 'REJECTED' ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-[#172033]">
                                  {activeReview.status === 'APPROVED'
                                    ? 'Xác nhận duyệt giấy tờ này?'
                                    : activeReview.status === 'REJECTED'
                                      ? 'Nhập lý do từ chối giấy tờ này'
                                      : 'Nhập thông tin người dùng cần bổ sung'}
                                </p>
                                <p className="mt-0.5 truncate text-xs font-semibold text-[#64748B]" title={document.title || formatDocumentType(document.type)}>
                                  {document.title || formatDocumentType(document.type)} · {detail.name}
                                </p>
                                {activeReview.status !== 'APPROVED' && (
                                  <textarea
                                    autoFocus
                                    maxLength={1000}
                                    rows={2}
                                    value={reviewNote}
                                    onChange={(event) => setReviewNote(event.target.value)}
                                    placeholder={activeReview.status === 'REJECTED' ? 'Nêu rõ lý do từ chối...' : 'Nêu rõ nội dung cần bổ sung...'}
                                    className="mt-2 w-full resize-none rounded-lg border border-[#D8E0EA] bg-white p-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                                  />
                                )}
                                {error && <p className="mt-1.5 text-xs font-bold text-red-700">{error}</p>}
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button type="button" onClick={() => { setReviewIntent(null); setError(''); }} disabled={saving} className="rounded-lg border border-[#D8E0EA] bg-white px-3 py-2 text-xs font-black text-[#475569] disabled:opacity-50">
                                  Hủy
                                </button>
                                <button type="button" onClick={submitReview} disabled={saving || (activeReview.status !== 'APPROVED' && !reviewNote.trim())} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-50 ${activeReview.status === 'REJECTED' ? 'bg-red-600' : activeReview.status === 'NEED_MORE_INFO' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                                  {activeReview.status === 'APPROVED' ? 'Xác nhận' : activeReview.status === 'REJECTED' ? 'Từ chối' : 'Gửi yêu cầu'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-4">
                          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-[#64748B]">
                            Ảnh giấy tờ người dùng đã gửi
                          </p>
                          <DocumentImageGallery imageUrls={document.imageUrls ?? []} documentTitle={document.title || formatDocumentType(document.type)} />
                        </div>
                        <div className="mt-4 grid gap-2 rounded-lg bg-[#F8FAFC] p-3 text-sm font-semibold text-[#475569]">
                          <p><span className="font-black text-[#172033]">Ghi chú người dùng:</span> {document.userNote || '-'}</p>
                          {document.reviewNote && <p><span className="font-black text-[#172033]">Phản hồi Admin:</span> {document.reviewNote}</p>}
                          {document.reviewerName && <p className="text-xs">Xử lý bởi {document.reviewerName} · {formatDateValue(document.reviewedAt)}</p>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center text-sm font-semibold text-[#64748B]">
                  Thú cưng này chưa gửi giấy tờ xác minh.
                </div>
              )}
            </section>

            {error && !reviewIntent && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          </div>
        ) : (
          <div className="p-6"><p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p></div>
        )}
      </DialogContent>
      <ImageLightbox imageUrl={viewingImageUrl} alt={`Ảnh của ${detail?.name ?? pet.name}`} onClose={() => setViewingImageUrl(null)} />
    </Dialog>
  );
}

function PetDetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#D8E0EA] bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">{label}</p>
      <div className="mt-1 text-sm font-black text-[#172033]">{value}</div>
    </div>
  );
}

function formatMatchingReportReason(reason?: string) {
  const labels: Record<string, string> = {
    INAPPROPRIATE_MESSAGE: 'Tin nhắn không phù hợp',
    HARASSMENT: 'Quấy rối',
    FAKE_INFORMATION: 'Thông tin giả',
    PET_SAFETY: 'An toàn thú cưng',
    NO_SHOW: 'Không đến gặp',
    OTHER: 'Lý do khác',
  };
  return reason ? labels[reason] ?? reason : '-';
}

function renderAdminCell(column: { key: string; render?: (row: Row) => ReactNode }, row: Row) {
  if (column.key === 'status' || column.key === 'accountStatus') {
    return <StatusBadge status={row[column.key]} label={column.render?.(row)} />;
  }
  if (column.key === 'role') return <RoleBadge role={row.role} />;
  return column.render ? column.render(row) : renderValue(row[column.key]);
}

function formatComplaintAction(action?: ComplaintAction) {
  const labels: Partial<Record<ComplaintAction, string>> = {
    DISMISS: 'Không xử lý',
    WARNING: 'Gửi cảnh cáo người dùng',
    HIDE_CONTENT: 'Ẩn thú cưng khỏi ghép đôi',
    SUSPEND_ACCOUNT: 'Tạm khóa tài khoản',
    RESOLVE: 'Cần thêm bằng chứng',
    ESCALATE: 'Chuyển cấp xử lý',
  };
  return action ? labels[action] ?? action : '-';
}

function formatMatchingReportConclusion(status?: string) {
  return status === 'RESOLVED'
    ? 'Xác nhận có vi phạm'
    : 'Chưa xác nhận có vi phạm';
}

function getSpaWeightKey(row: Row) {
  const min = row.petWeightMin == null ? '' : Number(row.petWeightMin);
  const max = row.petWeightMax == null ? '' : Number(row.petWeightMax);
  return `${min}:${max}`;
}

function formatSpaWeightOption(min: number | null, max: number | null) {
  if (min == null && max == null) return 'Mọi cân nặng';
  const normalizedMin = min ?? 0;
  if (max == null || max === 100) return `${formatSpaWeightNumber(normalizedMin)}kg trở lên`;
  return `${formatSpaWeightNumber(normalizedMin)}–${formatSpaWeightNumber(max)}kg`;
}

function formatSpaWeightNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
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
    PENDING: 'Đang chờ',
    REVIEWING: 'Đang xem xét',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
    NEED_MORE_INFO: 'Cần bổ sung',
    RESOLVED: 'Đã xử lý',
    DISMISSED: 'Không phát hiện vi phạm',
    INSUFFICIENT_EVIDENCE: 'Chưa đủ bằng chứng',
    ESCALATED: 'Chuyển cấp xử lý',
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
    CHECK_IN: 'Đã Check-in',
    ARRIVED: 'Khách đã đến',
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

function formatSpecies(species?: string) {
  if (species === 'DOG') return 'Chó';
  if (species === 'CAT') return 'Mèo';
  return species ?? '-';
}

function formatGender(gender?: string) {
  if (gender === 'MALE') return 'Đực';
  if (gender === 'FEMALE') return 'Cái';
  return gender ?? '-';
}

function formatDateValue(value?: string | Date | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('vi-VN');
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

function StatusField({ label, value, onChange }: { label: string; value: ApprovalStatus; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-black text-[#172033]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
        <option value="ACTIVE">Đang hoạt động</option>
        <option value="SUSPENDED">Tạm ngừng</option>
      </select>
    </label>
  );
}

function DocumentImageGallery({ imageUrls, documentTitle }: { imageUrls: string[]; documentTitle: string }) {
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  if (!imageUrls.length) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-800">
        Người dùng chưa tải ảnh cho giấy tờ này.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {imageUrls.map((url, index) => (
          <button
            type="button"
            key={`${url.slice(0, 24)}-${index}`}
            onClick={() => setViewingImageUrl(url)}
            aria-label={`Phóng to trang ${index + 1} của ${documentTitle}`}
            title="Bấm để phóng to"
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[#D8E0EA] bg-[#F4F7FA] shadow-sm transition hover:border-primary hover:shadow-md focus:outline-none focus:ring-4 focus:ring-primary/15"
          >
            <Image
              src={url}
              alt={`${documentTitle} - trang ${index + 1}`}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
              unoptimized
              className="object-contain p-1 transition duration-200 group-hover:scale-[1.02]"
            />
            <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/65 text-white opacity-80 shadow transition group-hover:opacity-100">
              <ZoomIn className="size-4" />
            </span>
          </button>
        ))}
      </div>
      <ImageLightbox imageUrl={viewingImageUrl} alt={documentTitle} onClose={() => setViewingImageUrl(null)} />
    </>
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
