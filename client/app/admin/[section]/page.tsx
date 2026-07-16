'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff, Loader2, PauseCircle, PlayCircle, ShieldAlert, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AccountStatus,
  AdminRole,
  adminApi,
  ApprovalStatus,
  ComplaintAction,
  DocumentStatus,
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
const readOnlySections = new Set(['store-orders', 'spa-bookings', 'analytics', 'settings']);

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
    title: 'Cửa hàng',
    description: 'Duyệt, tạm dừng và giám sát các cửa hàng thú cưng.',
    loader: adminApi.stores,
    columns: [
      { key: 'name', label: 'Cửa hàng' },
      { key: 'manager', label: 'Quản lý', render: (row) => row.manager?.name ?? '-' },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
      { key: '_count', label: 'Sản phẩm', render: (row) => row._count?.products ?? 0 },
      { key: 'orders', label: 'Đơn hàng', render: (row) => row._count?.orders ?? 0 },
    ],
  },
  'store-orders': {
    title: 'Đơn hàng cửa hàng',
    description: 'Tổng quan đơn hàng ở chế độ chỉ xem trong luồng cửa hàng.',
    loader: adminApi.storeOrders,
    columns: [
      { key: 'id', label: 'Mã đơn' },
      { key: 'user', label: 'Khách hàng', render: (row) => row.user?.name ?? '-' },
      { key: 'store', label: 'Cửa hàng', render: (row) => row.store?.name ?? 'Cửa hàng mặc định' },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
      { key: 'totalAmount', label: 'Tổng tiền', render: moneyCell },
      { key: 'createdAt', label: 'Ngày tạo', render: dateCell },
    ],
  },
  'store-complaints': {
    title: 'Khiếu nại cửa hàng',
    description: 'Khiếu nại và xử lý leo thang liên quan đến đơn hàng hoặc sản phẩm.',
    loader: () => adminApi.complaints('STORE'),
    columns: complaintColumns(),
  },
  spas: {
    title: 'Chi nhánh spa',
    description: 'Duyệt, tạm dừng và giám sát các chi nhánh spa.',
    loader: adminApi.spas,
    columns: [
      { key: 'name', label: 'Chi nhánh' },
      { key: 'manager', label: 'Quản lý', render: (row) => row.manager?.name ?? '-' },
      { key: 'address', label: 'Địa chỉ' },
      { key: 'phone', label: 'Điện thoại' },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
      { key: '_count', label: 'Nhân viên', render: (row) => row._count?.staffs ?? 0 },
      { key: 'bookings', label: 'Lịch đặt', render: (row) => row._count?.bookings ?? 0 },
    ],
  },
  'spa-bookings': {
    title: 'Lịch đặt spa',
    description: 'Tổng quan lịch đặt ở chế độ chỉ xem trên toàn bộ chi nhánh spa.',
    loader: adminApi.spaBookings,
    columns: [
      { key: 'user', label: 'Khách hàng', render: (row) => row.user?.name ?? '-' },
      { key: 'branch', label: 'Chi nhánh', render: (row) => row.branch?.name ?? '-' },
      { key: 'service', label: 'Dịch vụ', render: (row) => row.service?.name ?? '-' },
      { key: 'staff', label: 'Nhân viên', render: (row) => row.staff?.name ?? '-' },
      { key: 'status', label: 'Trạng thái', render: (row) => formatStatus(row.status) },
      { key: 'scheduledAt', label: 'Thời gian hẹn', render: dateCell },
    ],
  },
  'spa-complaints': {
    title: 'Khiếu nại spa',
    description: 'Khiếu nại và xử lý leo thang liên quan đến lịch đặt hoặc dịch vụ spa.',
    loader: () => adminApi.complaints('SPA'),
    columns: complaintColumns(),
  },
  reports: {
    title: 'Báo cáo & khiếu nại',
    description: 'Hàng chờ kiểm duyệt tập trung cho mọi loại báo cáo và khiếu nại.',
    loader: () => adminApi.complaints(),
    columns: complaintColumns(),
  },
  analytics: {
    title: 'Phân tích',
    description: 'Phân tích cấp hệ thống về vai trò, đơn hàng, lịch đặt, xác minh và khiếu nại.',
    loader: adminApi.analytics,
    columns: [
      { key: 'group', label: 'Nhóm chỉ số' },
      { key: 'value', label: 'Giá trị' },
      { key: 'count', label: 'Số lượng' },
    ],
  },
  settings: {
    title: 'Cài đặt hệ thống',
    description: 'Các cấu hình hệ thống như danh mục thú cưng, chính sách và lý do từ chối mẫu.',
    loader: adminApi.settings,
    columns: [
      { key: 'key', label: 'Khóa' },
      { key: 'value', label: 'Giá trị', render: (row) => JSON.stringify(row.value) },
      { key: 'updatedAt', label: 'Cập nhật', render: dateCell },
    ],
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

  const titleStats = useMemo(() => {
    const pending = rows.filter((row) => row.status === 'PENDING' || row.accountStatus === 'PENDING_MANAGER').length;
    const active = rows.filter((row) => row.status === 'ACTIVE' || row.accountStatus === 'ACTIVE').length;
    return { total: rows.length, pending, active };
  }, [rows]);

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
      <section className="overflow-hidden rounded-2xl border border-[#D8E0EA] bg-white shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#0F766E]">Mục quản trị</p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-[#172033]">{config.title}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#64748B]">{config.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 self-center">
            <MiniStat label="Tổng" value={titleStats.total} />
            <MiniStat label="Hoạt động" value={titleStats.active} />
            <MiniStat label="Chờ xử lý" value={titleStats.pending} />
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
        ) : (
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
                {rows.map((row, index) => (
                  <tr key={row.id ?? `${section}-${index}`} className="transition hover:bg-[#FAFBFC]">
                    {config.columns.map((column) => (
                      <td key={column.key} className="max-w-[280px] truncate px-5 py-4 text-sm font-semibold text-[#334155]">
                        {column.render ? column.render(row) : renderValue(row[column.key])}
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
                {!rows.length && (
                  <tr>
                    <td className="px-5 py-14 text-center text-sm font-semibold text-[#64748B]" colSpan={config.columns.length + (hasActions ? 1 : 0)}>
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
  const [branches, setBranches] = useState<Row[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [revokeMode, setRevokeMode] = useState<'UNASSIGN' | 'TRANSFER'>('UNASSIGN');
  const [newManagerId, setNewManagerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.spas()
      .then((response) => setBranches(Array.isArray(response.data) ? response.data : []))
      .catch(() => setError('Không thể tải danh sách chi nhánh Spa.'))
      .finally(() => setLoading(false));
  }, []);

  const managedBranches = branches.filter((branch) => branch.managerId === flow.user.id);
  const replacementManagers = users.filter(
    (user) => user.id !== flow.user.id && user.role === 'SPA_MANAGER' && user.accountStatus === 'ACTIVE',
  );
  const selectedBranches = branches.filter((branch) => selectedBranchIds.includes(branch.id));
  const reassignedBranches = selectedBranches.filter(
    (branch) => branch.managerId && branch.managerId !== flow.user.id,
  );

  const toggleBranch = (branchId: string) => {
    setSelectedBranchIds((current) =>
      current.includes(branchId) ? current.filter((id) => id !== branchId) : [...current, branchId],
    );
  };

  const submit = async () => {
    setError('');

    if (flow.mode === 'GRANT' && selectedBranchIds.length === 0) {
      setError('Vui lòng chọn ít nhất một chi nhánh.');
      return;
    }

    if (flow.mode === 'REVOKE' && revokeMode === 'TRANSFER' && !newManagerId) {
      setError('Vui lòng chọn Spa Manager nhận chuyển giao.');
      return;
    }

    setSaving(true);
    try {
      if (flow.mode === 'GRANT') {
        await adminApi.grantSpaManager(flow.user.id, selectedBranchIds, reassignedBranches.length > 0);
        toast.success('Đã cấp quyền Spa Manager và phân công chi nhánh.');
      } else {
        await adminApi.revokeSpaManager(flow.user.id, revokeMode, newManagerId || undefined);
        toast.success(
          revokeMode === 'TRANSFER'
            ? 'Đã thu hồi quyền và chuyển giao chi nhánh.'
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
                <p className="text-sm font-black text-[#172033]">Chọn chi nhánh quản lý</p>
                <p className="mt-1 text-xs font-semibold text-[#64748B]">Bắt buộc chọn ít nhất một chi nhánh.</p>
              </div>
              <div className="grid gap-3">
                {branches.map((branch) => {
                  const occupied = branch.managerId && branch.managerId !== flow.user.id;
                  return (
                    <label
                      key={branch.id}
                      className="flex cursor-pointer gap-3 rounded-xl border border-[#D8E0EA] p-4 transition hover:border-[#0F766E] hover:bg-[#F3FAF8]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBranchIds.includes(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        className="mt-1 size-4 accent-[#0F766E]"
                      />
                      <span className="min-w-0">
                        <span className="block font-black text-[#172033]">{branch.name}</span>
                        <span className="mt-1 block text-xs font-semibold text-[#64748B]">{branch.address}</span>
                        {occupied && (
                          <span className="mt-2 block text-xs font-black text-amber-700">
                            Đang do {branch.manager?.name ?? 'một Manager khác'} quản lý; chọn mục này sẽ chuyển quyền.
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              {reassignedBranches.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  Bạn đang chuyển {reassignedBranches.length} chi nhánh từ Manager hiện tại sang {flow.user.name}.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-xl border border-[#D8E0EA] bg-[#F7F9FB] p-4">
                <p className="text-sm font-black text-[#172033]">Chi nhánh đang quản lý</p>
                {managedBranches.length ? (
                  <ul className="mt-2 grid gap-1 text-sm font-semibold text-[#475569]">
                    {managedBranches.map((branch) => <li key={branch.id}>• {branch.name}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-[#64748B]">Tài khoản chưa được phân công chi nhánh.</p>
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
                  <span className="mt-1 block text-xs font-semibold text-[#64748B]">Các chi nhánh tạm thời chưa có Manager.</span>
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
                  <span className="mt-1 block text-xs font-semibold text-[#64748B]">Chuyển toàn bộ chi nhánh trước khi thu hồi quyền.</span>
                  {revokeMode === 'TRANSFER' && (
                    <select
                      value={newManagerId}
                      onChange={(event) => setNewManagerId(event.target.value)}
                      className="mt-3 h-10 w-full rounded-lg border border-[#D8E0EA] bg-white px-3 text-sm font-bold outline-none focus:border-[#0F766E]"
                    >
                      <option value="">Chọn Spa Manager nhận chuyển giao</option>
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
              ? reassignedBranches.length > 0 ? 'Chuyển quyền & cấp Manager' : 'Cấp quyền & phân công'
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
        <select
          className="h-9 rounded-lg border border-[#D8E0EA] bg-white px-2.5 text-xs font-black text-[#334155] outline-none transition focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
          value={row.role}
          onChange={(event) => onRoleChange(event.target.value as AdminRole)}
          disabled={isSpaStaff}
          title={isSpaStaff ? 'Vai trò nhân viên Spa do Spa Manager quản lý' : undefined}
        >
          {availableRoles.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}
        </select>
        <select
          className="h-9 rounded-lg border border-[#D8E0EA] bg-white px-2.5 text-xs font-black text-[#334155] outline-none transition focus:border-[#0F766E] focus:ring-4 focus:ring-[#0F766E]/10"
          value={row.accountStatus}
          onChange={(event) => onAction(() => adminApi.updateAccountStatus(row.id, event.target.value as AccountStatus), 'Đã cập nhật trạng thái tài khoản.')}
        >
          {accountStatusOptions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
        </select>
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

  if (section === 'stores') {
    return <ApprovalButtons row={row} update={(status) => adminApi.updateStoreStatus(row.id, status)} onAction={onAction} />;
  }

  if (section === 'spas') {
    return <ApprovalButtons row={row} update={(status) => adminApi.updateSpaStatus(row.id, status)} onAction={onAction} />;
  }

  if (section === 'matching-reports' && !row.isResolved) {
    return (
      <div className="flex justify-end">
        <IconButton label="Xử lý" icon={CheckCircle2} onClick={() => onAction(() => adminApi.resolveMatchingReport(row.id), 'Đã xử lý báo cáo.')} />
      </div>
    );
  }

  if (['reports', 'store-complaints', 'spa-complaints'].includes(section) && row.status === 'PENDING') {
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
  row,
  update,
  onAction,
}: {
  row: Row;
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

function complaintColumns() {
  return [
    { key: 'title', label: 'Tiêu đề' },
    { key: 'type', label: 'Loại' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'actionTaken', label: 'Hành động', render: (row: Row) => row.actionTaken ? formatStatus(row.actionTaken) : '-' },
    { key: 'createdAt', label: 'Ngày tạo', render: dateCell },
  ];
}

function normalizeRows(section: string, data: Row[] | Row): Row[] {
  if (section === 'pet-verifications' && Array.isArray(data)) {
    return data.filter((row) => ['PENDING', 'REVIEWING', 'NEED_MORE_INFO'].includes(row.status));
  }

  if (section === 'analytics' && !Array.isArray(data)) {
    return Object.entries(data).flatMap(([group, value]) => {
      if (!Array.isArray(value)) return [{ id: group, group, value: JSON.stringify(value), count: '-' }];
      return value.map((item, index) => ({
        id: `${group}-${index}`,
        group,
        value: item.role ? formatRole(item.role) : item.status ? formatStatus(item.status) : JSON.stringify(item),
        count: item._count?._all ?? item._count ?? '-',
      }));
    });
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
