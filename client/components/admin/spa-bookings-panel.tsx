'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  PawPrint,
  RefreshCw,
  Search,
  UserRound,
  WalletCards,
} from 'lucide-react';
import {
  ADMIN_PAYMENT_STATUS_META,
  AdminDetailField as DetailField,
  AdminDetailGrid as DetailGrid,
  AdminDetailSection as DetailSection,
  AdminFilterSelect as FilterSelect,
  AdminStatusBadge,
  AdminSummaryCard as SummaryCard,
  AdminTextBlock as TextBlock,
} from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type SpaServiceSummary = {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  durationMin?: number | null;
  durationMax?: number | null;
};

type SpaBookingRow = {
  [key: string]: unknown;
  id?: string;
  scheduledAt?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  customerNameSnapshot?: string | null;
  customerEmailSnapshot?: string | null;
  customerPhoneSnapshot?: string | null;
  petName?: string | null;
  petSpecies?: string | null;
  petWeight?: number | null;
  priceSnapshot?: number | null;
  totalPrice?: number | null;
  timeStartExpected?: string | null;
  timeEndExpected?: string | null;
  timeStartReal?: string | null;
  timeEndReal?: string | null;
  completionDiffMinutes?: number | null;
  rescheduleCount?: number | null;
  cancelReason?: string | null;
  note?: string | null;
  petConditionAfter?: string | null;
  photoAfter?: string | null;
  issueReported?: string | null;
  user?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  staff?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  pet?: { name?: string | null; species?: string | null; breed?: string | null; weight?: number | null } | null;
  service?: SpaServiceSummary | null;
  mainServiceResolved?: SpaServiceSummary | null;
  subServices?: SpaServiceSummary[];
  payment?: { method?: string | null; status?: string | null; amount?: number | null; paidAt?: string | null; refundedAt?: string | null } | null;
  feedback?: { rateStaff: number; rateServices: number; comment?: string | null; createdAt?: string | null } | null;
};
type DateFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
type PaymentFilter = 'ALL' | 'PAID' | 'PENDING' | 'REFUNDED' | 'UNPAID';

const PAGE_SIZE = 10;
const ACTIVE_STATUSES = ['CHECK_IN', 'ARRIVED', 'IN_PROGRESS', 'LATE'];

const SPA_STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Chờ xác nhận', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  CONFIRMED: { label: 'Đã xác nhận', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  CHECK_IN: { label: 'Đã check-in', className: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  ARRIVED: { label: 'Khách đã đến', className: 'border-teal-200 bg-teal-50 text-teal-700' },
  IN_PROGRESS: { label: 'Đang thực hiện', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  COMPLETED: { label: 'Hoàn thành', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Đã hủy', className: 'border-red-200 bg-red-50 text-red-700' },
  NO_SHOW: { label: 'Không đến', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  LATE: { label: 'Trễ hẹn', className: 'border-rose-200 bg-rose-50 text-rose-700' },
};

export function SpaBookingsPanel({
  bookings,
  onRefresh,
}: {
  bookings: SpaBookingRow[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<SpaBookingRow | null>(null);

  const stats = useMemo(() => ({
    total: bookings.length,
    today: bookings.filter((booking) => isSameLocalDay(booking.scheduledAt, new Date())).length,
    pending: bookings.filter((booking) => booking.status === 'PENDING').length,
    active: bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status ?? '')).length,
    completed: bookings.filter((booking) => booking.status === 'COMPLETED').length,
    attention: bookings.filter((booking) => getAttentionReasons(booking).length > 0).length,
  }), [bookings]);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi');
    return bookings.filter((booking) => {
      if (normalizedSearch && !bookingMatchesSearch(booking, normalizedSearch)) return false;
      if (status === 'ACTIVE_SERVICE' && !ACTIVE_STATUSES.includes(booking.status ?? '')) return false;
      if (status !== 'ALL' && status !== 'ACTIVE_SERVICE' && booking.status !== status) return false;
      if (paymentFilter !== 'ALL' && getPaymentStatus(booking) !== paymentFilter) return false;
      if (!matchesDateFilter(booking.scheduledAt, dateFilter, dateFrom, dateTo)) return false;
      if (attentionOnly && getAttentionReasons(booking).length === 0) return false;
      return true;
    });
  }, [attentionOnly, bookings, dateFilter, dateFrom, dateTo, paymentFilter, search, status]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pageBookings = filteredBookings.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const hasFilters = Boolean(
    search || status !== 'ALL' || dateFilter !== 'ALL' ||
      paymentFilter !== 'ALL' || attentionOnly,
  );

  const resetFilters = () => {
    setSearch('');
    setStatus('ALL');
    setDateFilter('ALL');
    setPaymentFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setAttentionOnly(false);
    setCurrentPage(1);
  };

  const updateFilter = (update: () => void) => {
    update();
    setCurrentPage(1);
  };

  return (
    <div>
      <div className="border-b border-border bg-muted/20 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-foreground">Giám sát lịch hẹn</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Dữ liệu chỉ đọc; mọi thay đổi lịch thuộc quyền quản lý và nhân viên Spa.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="size-4" /> Làm mới
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard label="Tổng lịch" value={stats.total} icon={CalendarDays} onClick={resetFilters} />
          <SummaryCard label="Hôm nay" value={stats.today} icon={Clock3} onClick={() => updateFilter(() => setDateFilter('TODAY'))} />
          <SummaryCard label="Đang chờ" value={stats.pending} icon={Clock3} tone="amber" onClick={() => updateFilter(() => setStatus('PENDING'))} />
          <SummaryCard label="Đang phục vụ" value={stats.active} icon={UserRound} tone="blue" onClick={() => updateFilter(() => setStatus('ACTIVE_SERVICE'))} />
          <SummaryCard label="Hoàn thành" value={stats.completed} icon={CheckCircle2} tone="green" onClick={() => updateFilter(() => setStatus('COMPLETED'))} />
          <SummaryCard label="Cần chú ý" value={stats.attention} icon={AlertTriangle} tone="red" onClick={() => updateFilter(() => setAttentionOnly(true))} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={search}
              onChange={(event) => updateFilter(() => setSearch(event.target.value))}
              placeholder="Tìm mã lịch, khách hàng, thú cưng, nhân viên..."
              className="pl-9"
            />
          </label>
          <FilterSelect
            value={status}
            onChange={(value) => updateFilter(() => setStatus(value))}
            ariaLabel="Lọc theo trạng thái"
            options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'ACTIVE_SERVICE', label: 'Đang phục vụ' },
              ...Object.entries(SPA_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
            ]}
          />
          <FilterSelect
            value={paymentFilter}
            onChange={(value) => updateFilter(() => setPaymentFilter(value as PaymentFilter))}
            ariaLabel="Lọc theo thanh toán"
            options={[
              { value: 'ALL', label: 'Tất cả thanh toán' },
              { value: 'PAID', label: 'Đã thanh toán' },
              { value: 'PENDING', label: 'Chờ thanh toán' },
              { value: 'REFUNDED', label: 'Đã hoàn tiền' },
              { value: 'UNPAID', label: 'Chưa thanh toán' },
            ]}
          />
          <FilterSelect
            value={dateFilter}
            onChange={(value) => updateFilter(() => setDateFilter(value as DateFilter))}
            ariaLabel="Lọc theo thời gian"
            options={[
              { value: 'ALL', label: 'Tất cả thời gian' },
              { value: 'TODAY', label: 'Hôm nay' },
              { value: 'THIS_WEEK', label: 'Tuần này' },
              { value: 'THIS_MONTH', label: 'Tháng này' },
              { value: 'CUSTOM', label: 'Khoảng ngày' },
            ]}
          />
          {dateFilter === 'CUSTOM' && (
            <>
              <Input type="date" value={dateFrom} aria-label="Từ ngày" onChange={(event) => updateFilter(() => setDateFrom(event.target.value))} />
              <Input type="date" value={dateTo} aria-label="Đến ngày" onChange={(event) => updateFilter(() => setDateTo(event.target.value))} />
            </>
          )}
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-bold text-foreground/75">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(event) => updateFilter(() => setAttentionOnly(event.target.checked))}
              className="size-4 accent-primary"
            />
            Chỉ lịch cần chú ý
          </label>
          {hasFilters && (
            <Button type="button" variant="ghost" className="justify-self-start text-red-600" onClick={resetFilters}>
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs font-semibold text-muted-foreground">
        <span>Tìm thấy <strong className="text-foreground">{filteredBookings.length}</strong> lịch hẹn</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead className="bg-muted/30">
            <tr>
              {['Mã lịch / Thời gian', 'Khách hàng / Thú cưng', 'Dịch vụ', 'Nhân viên', 'Trạng thái', 'Thanh toán', 'Theo dõi', 'Chi tiết'].map((label) => (
                <th key={label} className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageBookings.map((booking, index) => {
              const attentionReasons = getAttentionReasons(booking);
              const mainService = booking.mainServiceResolved ?? booking.service;
              return (
                <tr key={booking.id ?? `spa-booking-${index}`} className="cursor-pointer align-top transition hover:bg-muted/20" onClick={() => setSelectedBooking(booking)}>
                  <td className="px-4 py-4">
                    <p className="font-mono text-xs font-black text-primary">#{shortId(booking.id)}</p>
                    <p className="mt-1 whitespace-nowrap text-sm font-black text-foreground">{formatTime(booking.scheduledAt)}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{formatDate(booking.scheduledAt)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-44 truncate text-sm font-black text-foreground">{getCustomerName(booking)}</p>
                    <p className="mt-1 max-w-44 truncate text-xs font-semibold text-muted-foreground">
                      {booking.petName ?? booking.pet?.name ?? 'Chưa có tên pet'} · {formatSpecies(booking.petSpecies ?? booking.pet?.species)}
                      {getPetWeight(booking) ? ` · ${getPetWeight(booking)}kg` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-48 text-sm font-bold text-foreground/85">{mainService?.name ?? 'Gói Spa'}</p>
                    <p className="mt-1 text-xs font-semibold text-violet-700">
                      {booking.subServices?.length ? `+ ${booking.subServices.length} dịch vụ kèm theo` : 'Không có dịch vụ kèm theo'}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-foreground/85">{booking.staff?.name ?? 'Chưa phân công'}</td>
                  <td className="px-4 py-4"><StatusBadge status={booking.status} /></td>
                  <td className="px-4 py-4">
                    <p className="whitespace-nowrap text-sm font-black text-foreground">{formatMoney(getBookingTotal(booking))}</p>
                    <PaymentBadge status={getPaymentStatus(booking)} />
                  </td>
                  <td className="px-4 py-4">
                    {attentionReasons.length ? (
                      <div className="max-w-52 space-y-1">
                        {attentionReasons.slice(0, 2).map((reason) => (
                          <p key={reason} className="flex items-start gap-1 text-xs font-bold text-red-700"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{reason}</p>
                        ))}
                        {attentionReasons.length > 2 && <p className="text-xs font-bold text-muted-foreground">+{attentionReasons.length - 2} cảnh báo khác</p>}
                      </div>
                    ) : <span className="text-xs font-semibold text-muted-foreground/70">Ổn định</span>}
                  </td>
                  <td className="px-4 py-4">
                    <Button type="button" size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setSelectedBooking(booking); }}>
                      <Eye className="size-4" /> Xem
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!pageBookings.length && (
              <tr><td colSpan={8} className="px-5 py-14 text-center text-sm font-semibold text-muted-foreground">Không có lịch hẹn phù hợp với bộ lọc.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
        <p className="text-xs font-semibold text-muted-foreground">Trang {activePage}/{totalPages} · {filteredBookings.length} lịch hẹn</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={activePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Trước</Button>
          <Button type="button" size="sm" variant="outline" disabled={activePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Sau</Button>
        </div>
      </div>

      <SpaBookingDetailDialog booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </div>
  );
}

function SpaBookingDetailDialog({ booking, onClose }: { booking: SpaBookingRow | null; onClose: () => void }) {
  if (!booking) return null;
  const mainService = booking.mainServiceResolved ?? booking.service;
  const attentionReasons = getAttentionReasons(booking);
  const customerEmail = booking.customerEmailSnapshot ?? booking.user?.email;
  const customerPhone = booking.customerPhoneSnapshot ?? booking.user?.phone;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[1120px]">
        <DialogHeader className="relative border-b border-orange-100 bg-linear-to-r from-orange-50 via-background to-background px-6 py-5 pr-14 text-left sm:px-8 sm:py-6 sm:pr-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Chi tiết lịch Spa · Chỉ xem</p>
              <DialogTitle className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-black text-foreground sm:text-3xl">
                Lịch #{shortId(booking.id)} <StatusBadge status={booking.status} />
              </DialogTitle>
              <DialogDescription className="mt-2 text-xs font-semibold sm:text-sm">
                Đặt lúc {formatDateTime(booking.createdAt)} · Cập nhật {formatDateTime(booking.updatedAt)}
              </DialogDescription>
            </div>
            <div className="shrink-0 rounded-xl border border-orange-200 bg-background px-4 py-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Thời gian hẹn</p>
              <p className="mt-1 text-base font-black text-foreground">{formatTime(booking.scheduledAt)} · {formatDate(booking.scheduledAt)}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 overflow-y-auto bg-muted/30 p-4 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-5">
          {attentionReasons.length > 0 && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-4 lg:col-span-2">
              <h3 className="flex items-center gap-2 text-sm font-black text-red-800"><AlertTriangle className="size-4" /> Nội dung cần chú ý</h3>
              <ul className="mt-2 grid gap-1 text-sm font-semibold text-red-700 sm:grid-cols-2">
                {attentionReasons.map((reason) => <li key={reason}>• {reason}</li>)}
              </ul>
            </section>
          )}

          <DetailSection icon={Clock3} title="Thời gian thực hiện">
            <DetailGrid>
              <DetailField label="Ngày giờ hẹn" value={formatDateTime(booking.scheduledAt)} />
              <DetailField label="Số lần đổi lịch" value={String(booking.rescheduleCount ?? 0)} />
              <DetailField label="Bắt đầu dự kiến" value={formatDateTime(booking.timeStartExpected)} />
              <DetailField label="Kết thúc dự kiến" value={formatDateTime(booking.timeEndExpected)} />
              <DetailField label="Bắt đầu thực tế" value={formatDateTime(booking.timeStartReal)} />
              <DetailField label="Kết thúc thực tế" value={formatDateTime(booking.timeEndReal)} />
              <DetailField label="Độ lệch hoàn thành" value={formatCompletionDiff(booking.completionDiffMinutes)} />
            </DetailGrid>
            <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Nhân viên phụ trách</p>
                <p className="mt-1 text-sm font-black text-foreground">{booking.staff?.name ?? 'Chưa phân công'}</p>
              </div>
              {booking.staff && (
                <p className="break-all text-xs font-semibold text-muted-foreground sm:max-w-[55%] sm:text-right">
                  {booking.staff.phone ?? booking.staff.email ?? 'Chưa có thông tin liên hệ'}
                </p>
              )}
            </div>
          </DetailSection>

          <DetailSection icon={UserRound} title="Khách hàng và thú cưng">
              <DetailGrid>
              <DetailField label="Khách hàng" value={getCustomerName(booking)} />
              <DetailField label="Email" value={customerEmail ?? '-'} wide />
              <DetailField label="Số điện thoại" value={customerPhone ?? '-'} />
              <DetailField label="Thú cưng" value={booking.petName ?? booking.pet?.name ?? '-'} />
              <DetailField label="Loài / giống" value={[formatSpecies(booking.petSpecies ?? booking.pet?.species), booking.pet?.breed].filter((value) => value && value !== '-').join(' · ') || '-'} />
              <DetailField label="Cân nặng" value={getPetWeight(booking) ? `${getPetWeight(booking)} kg` : '-'} />
            </DetailGrid>
          </DetailSection>

          <DetailSection icon={WalletCards} title="Dịch vụ và thanh toán" wide>
            <div className="space-y-3">
              <ServiceLine name={mainService?.name ?? 'Gói Spa'} price={mainService?.price ?? booking.priceSnapshot} primary />
              {(booking.subServices ?? []).map((service) => <ServiceLine key={service.id} name={service.name} price={service.price} />)}
              {!booking.subServices?.length && <p className="text-sm font-semibold text-muted-foreground/70">Không có dịch vụ kèm theo.</p>}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-black text-foreground">Tổng tiền</span>
                <span className="text-lg font-black text-primary">{formatMoney(getBookingTotal(booking))}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground/75">
                <PaymentBadge status={getPaymentStatus(booking)} />
                <span>{formatPaymentMethod(booking.payment?.method)}</span>
                {booking.payment?.paidAt && <span>· Thanh toán {formatDateTime(booking.payment.paidAt)}</span>}
                {booking.payment?.refundedAt && <span>· Hoàn tiền {formatDateTime(booking.payment.refundedAt)}</span>}
              </div>
            </div>
          </DetailSection>

          <DetailSection icon={PawPrint} title="Ghi chú và kết quả" wide>
            <div className="grid gap-4 md:grid-cols-2">
              <TextBlock label="Ghi chú của khách" value={booking.note} />
              <TextBlock label="Lý do hủy" value={booking.cancelReason} />
              <TextBlock label="Tình trạng thú cưng sau dịch vụ" value={booking.petConditionAfter} />
              <TextBlock label="Sự cố được ghi nhận" value={booking.issueReported} alert={Boolean(booking.issueReported)} />
              {booking.photoAfter && (
                <div className="md:col-span-2">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground">Ảnh sau dịch vụ</p>
                  <div className="relative h-56 w-full max-w-md overflow-hidden rounded-xl border border-border bg-muted/30">
                    <Image src={booking.photoAfter} alt={`Kết quả dịch vụ của ${booking.petName ?? 'thú cưng'}`} fill sizes="448px" unoptimized className="object-cover" />
                  </div>
                </div>
              )}
            </div>
          </DetailSection>

          <DetailSection icon={CheckCircle2} title="Đánh giá của khách hàng" wide>
            {booking.feedback ? (
              <div className="grid gap-4 md:grid-cols-3">
                <DetailField label="Nhân viên" value={`${booking.feedback.rateStaff}/5 sao`} />
                <DetailField label="Dịch vụ" value={`${booking.feedback.rateServices}/5 sao`} />
                <DetailField label="Ngày đánh giá" value={formatDateTime(booking.feedback.createdAt)} />
                <TextBlock label="Nhận xét" value={booking.feedback.comment} wide />
              </div>
            ) : <p className="text-sm font-semibold text-muted-foreground/70">Khách hàng chưa gửi đánh giá.</p>}
          </DetailSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ServiceLine({ name, price, primary = false }: { name: string; price?: number | null; primary?: boolean }) {
  return <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-foreground/85">{name}</p>{primary && <p className="text-xs font-semibold text-primary">Dịch vụ chính</p>}</div><span className="whitespace-nowrap text-sm font-black text-foreground">{formatMoney(price ?? 0)}</span></div>;
}

function StatusBadge({ status }: { status?: string | null }) {
  return <AdminStatusBadge status={status} meta={SPA_STATUS_META} />;
}

function PaymentBadge({ status }: { status: string }) {
  return <AdminStatusBadge status={status} meta={ADMIN_PAYMENT_STATUS_META} compact />;
}

function bookingMatchesSearch(booking: SpaBookingRow, search: string) {
  const values = [
    booking.id,
    booking.user?.name,
    booking.user?.email,
    booking.user?.phone,
    booking.customerNameSnapshot,
    booking.customerEmailSnapshot,
    booking.customerPhoneSnapshot,
    booking.petName,
    booking.pet?.name,
    booking.staff?.name,
    booking.service?.name,
    booking.mainServiceResolved?.name,
    ...(booking.subServices ?? []).map((service) => service.name),
  ];
  return values.some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(search));
}

function getAttentionReasons(booking: SpaBookingRow) {
  const reasons: string[] = [];
  if (booking.status === 'LATE') reasons.push('Lịch đang bị trễ');
  if (booking.status === 'NO_SHOW') reasons.push('Khách không đến');
  if (booking.status === 'CANCELLED') reasons.push(booking.cancelReason ? `Đã hủy: ${booking.cancelReason}` : 'Lịch đã bị hủy');
  if (booking.issueReported) reasons.push(`Có sự cố: ${booking.issueReported}`);
  if ((booking.completionDiffMinutes ?? 0) > 0) reasons.push(`Hoàn thành trễ ${booking.completionDiffMinutes} phút`);
  if ((booking.rescheduleCount ?? 0) >= 2) reasons.push(`Đã đổi lịch ${booking.rescheduleCount} lần`);
  const scheduledAt = new Date(booking.scheduledAt ?? '').getTime();
  const now = Date.now();
  const isUpcomingSoon = scheduledAt >= now && scheduledAt <= now + 24 * 60 * 60 * 1000;
  if (!booking.staff && isUpcomingSoon && ['PENDING', 'CONFIRMED'].includes(booking.status ?? '')) reasons.push('Sắp đến giờ nhưng chưa phân công nhân viên');
  if (booking.status === 'COMPLETED' && getPaymentStatus(booking) !== 'PAID') reasons.push('Đã hoàn thành nhưng chưa ghi nhận thanh toán');
  return reasons;
}

function matchesDateFilter(value: string | null | undefined, filter: DateFilter, dateFrom: string, dateTo: string) {
  if (filter === 'ALL') return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === 'TODAY') return isSameLocalDay(date, now);
  if (filter === 'THIS_WEEK') {
    const start = startOfLocalDay(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return date >= start && date < end;
  }
  if (filter === 'THIS_MONTH') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  const from = dateFrom ? startOfLocalDay(new Date(`${dateFrom}T00:00:00`)) : null;
  const to = dateTo ? startOfLocalDay(new Date(`${dateTo}T00:00:00`)) : null;
  if (to) to.setDate(to.getDate() + 1);
  return (!from || date >= from) && (!to || date < to);
}

function isSameLocalDay(value: string | Date | null | undefined, reference: Date) {
  if (!value) return false;
  const date = new Date(value);
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth() && date.getDate() === reference.getDate();
}

function startOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getPaymentStatus(booking: SpaBookingRow) {
  return booking.payment?.status ?? 'UNPAID';
}

function getCustomerName(booking: SpaBookingRow) {
  return booking.customerNameSnapshot ?? booking.user?.name ?? 'Khách hàng đã xóa';
}

function getPetWeight(booking: SpaBookingRow) {
  return booking.petWeight ?? booking.pet?.weight ?? null;
}

function getBookingTotal(booking: SpaBookingRow) {
  return booking.totalPrice || booking.payment?.amount || booking.priceSnapshot || 0;
}

function shortId(id?: string) {
  return id ? id.slice(-8).toUpperCase() : '-';
}

function formatSpecies(species?: string | null) {
  if (species === 'DOG') return 'Chó';
  if (species === 'CAT') return 'Mèo';
  return species ?? '-';
}

function formatPaymentMethod(method?: string | null) {
  if (method === 'COD') return 'Tiền mặt';
  if (method === 'QR') return 'QR / PayOS';
  return method ?? 'Chưa có phương thức';
}

function formatCompletionDiff(value?: number | null) {
  if (value == null) return '-';
  if (value > 0) return `Trễ ${value} phút`;
  if (value < 0) return `Sớm ${Math.abs(value)} phút`;
  return 'Đúng giờ';
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('vi-VN');
}

function formatTime(value?: string | Date | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}
