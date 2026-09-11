"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  MapPin,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Search,
  Star,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type OrderItem = {
  id?: string;
  quantity?: number | null;
  price?: number | null;
  product?: {
    id?: string;
    name?: string | null;
    imageUrl?: string | null;
    brand?: string | null;
    unit?: string | null;
  } | null;
  variant?: { id?: string; name?: string | null } | null;
};

type OrderReview = {
  id?: string;
  productId?: string;
  rating?: number | null;
  comment?: string | null;
  images?: string[];
  createdAt?: string | null;
  product?: { name?: string | null } | null;
};

type StoreOrderRow = {
  [key: string]: unknown;
  id?: string;
  status?: string | null;
  totalAmount?: number | null;
  shippingFee?: number | null;
  discountAmount?: number | null;
  voucherCode?: string | null;
  shippingAddress?: string | null;
  shippingStatus?: string | null;
  shippingNote?: string | null;
  deliveryProofUrl?: string | null;
  customerNameSnapshot?: string | null;
  customerEmailSnapshot?: string | null;
  customerPhoneSnapshot?: string | null;
  refundStatus?: string | null;
  refundBankCode?: string | null;
  refundAccountNumber?: string | null;
  refundAccountName?: string | null;
  refundReason?: string | null;
  refundedAt?: string | null;
  refundProofUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  user?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  payment?: {
    method?: string | null;
    status?: string | null;
    amount?: number | null;
    orderCode?: number | null;
    paidAt?: string | null;
    refundedAt?: string | null;
  } | null;
  items?: OrderItem[];
  reviews?: OrderReview[];
};

type DateFilter = "ALL" | "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";

const PAGE_SIZE = 10;
const FULFILLMENT_STATUSES = ["PROCESSING", "PACKED", "SHIPPED"];
const ORDER_STEPS = ["PENDING", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"];

const ORDER_STATUS_META: Record<string, { label: string; className: string }> =
  {
    PENDING: {
      label: "Chờ xác nhận",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    PROCESSING: {
      label: "Đang xử lý",
      className: "border-cyan-200 bg-cyan-50 text-cyan-700",
    },
    PACKED: {
      label: "Đã đóng gói",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    },
    SHIPPED: {
      label: "Đang giao",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    },
    DELIVERED: {
      label: "Đã giao",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    CANCELLED: {
      label: "Đã hủy",
      className: "border-red-200 bg-red-50 text-red-700",
    },
    EXPIRED: {
      label: "Đã hết hạn",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    },
    PAYMENT_ERROR: {
      label: "Lỗi thanh toán",
      className: "border-red-200 bg-red-50 text-red-700",
    },
  };

const PAYMENT_META: Record<string, { label: string; className: string }> = {
  PAID: {
    label: "Đã thanh toán",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  PENDING: {
    label: "Chờ thanh toán",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  CANCELLED: {
    label: "Đã hủy thanh toán",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  EXPIRED: {
    label: "Thanh toán hết hạn",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  PAYMENT_ERROR: {
    label: "Thanh toán lỗi",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  UNPAID: {
    label: "Chưa thanh toán",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

export function StoreOrdersPanel({
  orders,
  onRefresh,
}: {
  orders: StoreOrderRow[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<StoreOrderRow | null>(
    null,
  );

  const stats = useMemo(
    () => ({
      total: orders.length,
      today: orders.filter((order) =>
        isSameLocalDay(order.createdAt, new Date()),
      ).length,
      pending: orders.filter((order) => order.status === "PENDING").length,
      fulfillment: orders.filter((order) =>
        FULFILLMENT_STATUSES.includes(order.status ?? ""),
      ).length,
      delivered: orders.filter((order) => order.status === "DELIVERED").length,
      attention: orders.filter(
        (order) => getOrderAttentionReasons(order).length > 0,
      ).length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("vi");
    return orders.filter((order) => {
      if (normalizedSearch && !orderMatchesSearch(order, normalizedSearch))
        return false;
      if (
        status === "FULFILLMENT" &&
        !FULFILLMENT_STATUSES.includes(order.status ?? "")
      )
        return false;
      if (
        status !== "ALL" &&
        status !== "FULFILLMENT" &&
        order.status !== status
      )
        return false;
      if (paymentStatus !== "ALL" && getPaymentStatus(order) !== paymentStatus)
        return false;
      if (!matchesDateFilter(order.createdAt, dateFilter, dateFrom, dateTo))
        return false;
      if (attentionOnly && getOrderAttentionReasons(order).length === 0)
        return false;
      return true;
    });
  }, [
    attentionOnly,
    dateFilter,
    dateFrom,
    dateTo,
    orders,
    paymentStatus,
    search,
    status,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pageOrders = filteredOrders.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE,
  );
  const hasFilters = Boolean(
    search ||
    status !== "ALL" ||
    paymentStatus !== "ALL" ||
    dateFilter !== "ALL" ||
    attentionOnly,
  );

  const resetFilters = () => {
    setSearch("");
    setStatus("ALL");
    setPaymentStatus("ALL");
    setDateFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setAttentionOnly(false);
    setCurrentPage(1);
  };

  const updateFilter = (update: () => void) => {
    update();
    setCurrentPage(1);
  };

  return (
    <div>
      <div className="border-b border-[#E5EAF0] bg-[#FBFCFD] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#172033]">
              Giám sát đơn hàng
            </p>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">
              Dữ liệu chỉ đọc; việc xử lý và cập nhật đơn thuộc quyền quản lý
              cửa hàng.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="size-4" /> Làm mới
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <SummaryCard
            label="Tổng đơn"
            value={stats.total}
            icon={ReceiptText}
            onClick={resetFilters}
          />
          <SummaryCard
            label="Hôm nay"
            value={stats.today}
            icon={CalendarDays}
            onClick={() => updateFilter(() => setDateFilter("TODAY"))}
          />
          <SummaryCard
            label="Chờ xác nhận"
            value={stats.pending}
            icon={Clock3}
            tone="amber"
            onClick={() => updateFilter(() => setStatus("PENDING"))}
          />
          <SummaryCard
            label="Đang xử lý"
            value={stats.fulfillment}
            icon={Truck}
            tone="blue"
            onClick={() => updateFilter(() => setStatus("FULFILLMENT"))}
          />
          <SummaryCard
            label="Đã giao"
            value={stats.delivered}
            icon={CheckCircle2}
            tone="green"
            onClick={() => updateFilter(() => setStatus("DELIVERED"))}
          />
          <SummaryCard
            label="Cần chú ý"
            value={stats.attention}
            icon={AlertTriangle}
            tone="red"
            onClick={() => updateFilter(() => setAttentionOnly(true))}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={search}
              onChange={(event) =>
                updateFilter(() => setSearch(event.target.value))
              }
              placeholder="Tìm mã đơn, khách hàng, sản phẩm, số điện thoại..."
              className="pl-9"
            />
          </label>
          <FilterSelect
            value={status}
            onChange={(value) => updateFilter(() => setStatus(value))}
            ariaLabel="Lọc theo trạng thái đơn"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="FULFILLMENT">Đang xử lý và giao</option>
            {Object.entries(ORDER_STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={paymentStatus}
            onChange={(value) => updateFilter(() => setPaymentStatus(value))}
            ariaLabel="Lọc theo thanh toán"
          >
            <option value="ALL">Tất cả thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
            <option value="PENDING">Chờ thanh toán</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
            <option value="CANCELLED">Đã hủy thanh toán</option>
            <option value="UNPAID">Chưa có thanh toán</option>
          </FilterSelect>
          <FilterSelect
            value={dateFilter}
            onChange={(value) =>
              updateFilter(() => setDateFilter(value as DateFilter))
            }
            ariaLabel="Lọc theo ngày đặt"
          >
            <option value="ALL">Tất cả thời gian</option>
            <option value="TODAY">Hôm nay</option>
            <option value="THIS_WEEK">Tuần này</option>
            <option value="THIS_MONTH">Tháng này</option>
            <option value="CUSTOM">Khoảng ngày</option>
          </FilterSelect>
          {dateFilter === "CUSTOM" && (
            <>
              <Input
                type="date"
                value={dateFrom}
                aria-label="Từ ngày"
                onChange={(event) =>
                  updateFilter(() => setDateFrom(event.target.value))
                }
              />
              <Input
                type="date"
                value={dateTo}
                aria-label="Đến ngày"
                onChange={(event) =>
                  updateFilter(() => setDateTo(event.target.value))
                }
              />
            </>
          )}
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-[#D8E0EA] bg-white px-3 text-sm font-bold text-[#475569]">
            <input
              type="checkbox"
              checked={attentionOnly}
              onChange={(event) =>
                updateFilter(() => setAttentionOnly(event.target.checked))
              }
              className="size-4 accent-primary"
            />
            Chỉ đơn cần chú ý
          </label>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              className="justify-self-start text-red-600"
              onClick={resetFilters}
            >
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-[#E5EAF0] px-5 py-3 text-xs font-semibold text-[#64748B]">
        <span>
          Tìm thấy{" "}
          <strong className="text-[#172033]">{filteredOrders.length}</strong>{" "}
          đơn hàng
        </span>
        <span>Chỉ xem</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1220px] border-collapse text-left">
          <thead className="bg-[#F7F9FB]">
            <tr>
              {[
                "Mã đơn / Ngày đặt",
                "Khách hàng",
                "Sản phẩm",
                "Giao đến",
                "Trạng thái",
                "Thanh toán",
                "Tổng tiền",
                "Theo dõi",
                "Chi tiết",
              ].map((label) => (
                <th
                  key={label}
                  className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-[#64748B]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAF0]">
            {pageOrders.map((order, index) => {
              const delivery = parseShippingAddress(order.shippingAddress);
              const attentionReasons = getOrderAttentionReasons(order);
              const totalItems = getTotalItems(order);
              return (
                <tr
                  key={order.id ?? `store-order-${index}`}
                  className="cursor-pointer align-top transition hover:bg-[#FAFBFC]"
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="px-4 py-4">
                    <p className="font-mono text-xs font-black text-primary">
                      #{getOrderCode(order)}
                    </p>
                    <p className="mt-1 text-sm font-black text-[#172033]">
                      {formatTime(order.createdAt)}
                    </p>
                    <p className="text-xs font-semibold text-[#64748B]">
                      {formatDate(order.createdAt)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-44 truncate text-sm font-black text-[#172033]">
                      {getCustomerName(order)}
                    </p>
                    <p className="mt-1 max-w-44 truncate text-xs font-semibold text-[#64748B]">
                      {getCustomerPhone(order) ?? "Chưa có số điện thoại"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-52 text-sm font-bold text-[#334155]">
                      {order.items?.[0]?.product?.name ?? "Sản phẩm"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-violet-700">
                      {totalItems} sản phẩm
                      {(order.items?.length ?? 0) > 1
                        ? ` · ${order.items?.length} loại`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="max-w-52 truncate text-sm font-bold text-[#334155]">
                      {delivery.address}
                    </p>
                    <p className="mt-1 max-w-52 truncate text-xs text-[#64748B]">
                      {delivery.name} · {delivery.phone}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-xs font-bold text-[#475569]">
                      {formatPaymentMethod(order.payment?.method)}
                    </p>
                    <PaymentBadge status={getPaymentStatus(order)} />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-black text-[#172033]">
                    {formatMoney(order.totalAmount ?? 0)}
                  </td>
                  <td className="px-4 py-4">
                    {attentionReasons.length ? (
                      <div className="max-w-52 space-y-1">
                        {attentionReasons.slice(0, 2).map((reason) => (
                          <p
                            key={reason}
                            className="flex items-start gap-1 text-xs font-bold text-red-700"
                          >
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                            {reason}
                          </p>
                        ))}
                        {attentionReasons.length > 2 && (
                          <p className="text-xs font-bold text-[#64748B]">
                            +{attentionReasons.length - 2} cảnh báo khác
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-[#94A3B8]">
                        Ổn định
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedOrder(order);
                      }}
                    >
                      <Eye className="size-4" /> Xem
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!pageOrders.length && (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-14 text-center text-sm font-semibold text-[#64748B]"
                >
                  Không có đơn hàng phù hợp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5EAF0] px-5 py-4">
        <p className="text-xs font-semibold text-[#64748B]">
          Trang {activePage}/{totalPages} · {filteredOrders.length} đơn hàng
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={activePage <= 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          >
            Trước
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={activePage >= totalPages}
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages, page + 1))
            }
          >
            Sau
          </Button>
        </div>
      </div>

      <StoreOrderDetailDialog
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}

function StoreOrderDetailDialog({
  order,
  onClose,
}: {
  order: StoreOrderRow | null;
  onClose: () => void;
}) {
  if (!order) return null;
  const delivery = parseShippingAddress(order.shippingAddress);
  const attentionReasons = getOrderAttentionReasons(order);
  const itemsSubtotal = (order.items ?? []).reduce(
    (sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 0),
    0,
  );
  const currentStep = ORDER_STEPS.indexOf(order.status ?? "");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[1120px]">
        <DialogHeader className="relative border-b border-orange-100 bg-linear-to-r from-orange-50 via-white to-white px-6 py-5 pr-14 text-left sm:px-8 sm:py-6 sm:pr-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                Chi tiết đơn hàng · Chỉ xem
              </p>
              <DialogTitle className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-black text-[#172033] sm:text-3xl">
                Đơn #{getOrderCode(order)}{" "}
                <OrderStatusBadge status={order.status} />
              </DialogTitle>
              <DialogDescription className="mt-2 text-xs font-semibold sm:text-sm">
                Đặt lúc {formatDateTime(order.createdAt)} · Cập nhật{" "}
                {formatDateTime(order.updatedAt)}
              </DialogDescription>
            </div>
            <div className="shrink-0 rounded-xl border border-orange-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                Tổng thanh toán
              </p>
              <p className="mt-1 text-xl font-black text-primary">
                {formatMoney(order.totalAmount ?? 0)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 overflow-y-auto bg-[#F7F9FB] p-4 sm:p-6 lg:grid-cols-2 lg:gap-5">
          {attentionReasons.length > 0 && (
            <section className="rounded-xl border border-red-200 bg-red-50 p-4 lg:col-span-2">
              <h3 className="flex items-center gap-2 text-sm font-black text-red-800">
                <AlertTriangle className="size-4" /> Nội dung cần chú ý
              </h3>
              <ul className="mt-2 grid gap-1 text-sm font-semibold text-red-700 sm:grid-cols-2">
                {attentionReasons.map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            </section>
          )}

          <DetailSection icon={UserRound} title="Khách hàng và người nhận">
            <DetailGrid>
              <DetailField label="Khách hàng" value={getCustomerName(order)} />
              <DetailField
                label="Số điện thoại"
                value={getCustomerPhone(order) ?? "-"}
              />
              <DetailField
                label="Email"
                value={getCustomerEmail(order) ?? "-"}
                wide
              />
              <DetailField label="Người nhận" value={delivery.name} />
              <DetailField
                label="Điện thoại nhận hàng"
                value={delivery.phone}
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection icon={MapPin} title="Thông tin giao hàng">
            <DetailGrid>
              <DetailField label="Địa chỉ" value={delivery.address} wide />
              <DetailField
                label="Ghi chú của khách"
                value={delivery.note || "-"}
                wide
              />
              <DetailField
                label="Trạng thái vận chuyển"
                value={formatShippingStatus(order.shippingStatus)}
              />
              <DetailField
                label="Ghi chú vận chuyển"
                value={order.shippingNote ?? "-"}
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection icon={Truck} title="Tiến trình đơn hàng" wide>
            {currentStep >= 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {ORDER_STEPS.map((step, index) => {
                  const done = index <= currentStep;
                  const current = index === currentStep;
                  return (
                    <div
                      key={step}
                      className={`rounded-xl border p-3 text-center ${done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-400"} ${current ? "ring-2 ring-primary/30" : ""}`}
                    >
                      <span
                        className={`mx-auto flex size-6 items-center justify-center rounded-full text-[10px] font-black ${done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}
                      >
                        {done ? "✓" : index + 1}
                      </span>
                      <p className="mt-2 text-[10px] font-black uppercase">
                        {ORDER_STATUS_META[step]?.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[#64748B]">
                Đơn hàng đã kết thúc ở trạng thái{" "}
                <strong>
                  {ORDER_STATUS_META[order.status ?? ""]?.label ?? order.status}
                </strong>
                .
              </p>
            )}
          </DetailSection>

          <DetailSection
            icon={PackageCheck}
            title={`Sản phẩm (${getTotalItems(order)})`}
            wide
          >
            <div className="overflow-x-auto rounded-xl border border-[#E5EAF0]">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-[#F7F9FB]">
                  <tr className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                    <th className="px-4 py-3">Sản phẩm</th>
                    <th className="px-4 py-3">Biến thể</th>
                    <th className="px-4 py-3 text-center">Số lượng</th>
                    <th className="px-4 py-3 text-right">Đơn giá</th>
                    <th className="px-4 py-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF0]">
                  {(order.items ?? []).map((item, index) => (
                    <tr key={item.id ?? index}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.product?.imageUrl ? (
                            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border bg-white">
                              <Image
                                src={item.product.imageUrl}
                                alt={item.product.name ?? "Sản phẩm"}
                                fill
                                sizes="44px"
                                unoptimized
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-slate-50">
                              <PackageCheck className="size-4 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-[#172033]">
                              {item.product?.name ?? "Sản phẩm đã xóa"}
                            </p>
                            <p className="text-xs font-semibold text-[#64748B]">
                              {[item.product?.brand, item.product?.unit]
                                .filter(Boolean)
                                .join(" · ") || "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#475569]">
                        {item.variant?.name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center font-black">
                        {item.quantity ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatMoney(item.price ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-primary">
                        {formatMoney((item.price ?? 0) * (item.quantity ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>

          <DetailSection icon={ReceiptText} title="Giá trị đơn hàng">
            <div className="space-y-3 text-sm">
              <MoneyLine label="Tiền sản phẩm" value={itemsSubtotal} />
              <MoneyLine
                label="Phí vận chuyển"
                value={order.shippingFee ?? 0}
              />
              <MoneyLine
                label={
                  order.voucherCode
                    ? `Giảm giá · ${order.voucherCode}`
                    : "Giảm giá"
                }
                value={-(order.discountAmount ?? 0)}
                discount
              />
              <div className="flex items-center justify-between border-t border-[#E5EAF0] pt-3">
                <span className="font-black text-[#172033]">Tổng cộng</span>
                <span className="text-lg font-black text-primary">
                  {formatMoney(order.totalAmount ?? 0)}
                </span>
              </div>
            </div>
          </DetailSection>

          <DetailSection icon={WalletCards} title="Thanh toán">
            <DetailGrid>
              <DetailField
                label="Phương thức"
                value={formatPaymentMethod(order.payment?.method)}
              />
              <DetailField
                label="Trạng thái"
                value={
                  PAYMENT_META[getPaymentStatus(order)]?.label ??
                  getPaymentStatus(order)
                }
              />
              <DetailField
                label="Số tiền ghi nhận"
                value={formatMoney(
                  order.payment?.amount ?? order.totalAmount ?? 0,
                )}
              />
              <DetailField
                label="Mã giao dịch"
                value={
                  order.payment?.orderCode
                    ? String(order.payment.orderCode)
                    : "-"
                }
              />
              <DetailField
                label="Thanh toán lúc"
                value={formatDateTime(order.payment?.paidAt)}
                wide
              />
            </DetailGrid>
          </DetailSection>

          {(order.deliveryProofUrl || order.shippingNote) && (
            <DetailSection icon={CheckCircle2} title="Kết quả giao hàng" wide>
              <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
                {order.deliveryProofUrl && (
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                      Ảnh giao hàng
                    </p>
                    <div className="relative h-48 overflow-hidden rounded-xl border bg-slate-50">
                      <Image
                        src={order.deliveryProofUrl}
                        alt="Bằng chứng giao hàng"
                        fill
                        sizes="320px"
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  </div>
                )}
                <TextBlock
                  label="Ghi chú vận chuyển"
                  value={order.shippingNote}
                />
              </div>
            </DetailSection>
          )}

          {order.refundStatus && (
            <DetailSection icon={RefreshCw} title="Thông tin hoàn tiền" wide>
              <DetailGrid>
                <DetailField
                  label="Trạng thái hoàn"
                  value={formatRefundStatus(order.refundStatus)}
                />
                <DetailField
                  label="Ngày hoàn tiền"
                  value={formatDateTime(
                    order.refundedAt ?? order.payment?.refundedAt,
                  )}
                />
                <DetailField
                  label="Ngân hàng"
                  value={order.refundBankCode ?? "-"}
                />
                <DetailField
                  label="Số tài khoản"
                  value={order.refundAccountNumber ?? "-"}
                />
                <DetailField
                  label="Chủ tài khoản"
                  value={order.refundAccountName ?? "-"}
                />
                <DetailField
                  label="Lý do hoàn"
                  value={order.refundReason ?? "-"}
                />
                {order.refundProofUrl && (
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                      Chứng từ hoàn tiền
                    </p>
                    <div className="relative h-48 max-w-md overflow-hidden rounded-xl border bg-slate-50">
                      <Image
                        src={order.refundProofUrl}
                        alt="Chứng từ hoàn tiền"
                        fill
                        sizes="448px"
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  </div>
                )}
              </DetailGrid>
            </DetailSection>
          )}

          <DetailSection icon={Star} title="Đánh giá sản phẩm" wide>
            {(order.reviews?.length ?? 0) > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {order.reviews?.map((review, index) => (
                  <div
                    key={review.id ?? index}
                    className="rounded-xl border border-[#E5EAF0] bg-[#FBFCFD] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-[#172033]">
                        {review.product?.name ?? "Sản phẩm"}
                      </p>
                      <span className="whitespace-nowrap text-sm font-black text-amber-600">
                        {review.rating ?? 0}/5 ★
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#475569]">
                      {review.comment || "Không có nhận xét."}
                    </p>
                    {(review.images?.length ?? 0) > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {review.images?.map((imageUrl, imageIndex) => (
                          <div
                            key={`${imageUrl}-${imageIndex}`}
                            className="relative size-14 overflow-hidden rounded-lg border bg-white"
                          >
                            <Image
                              src={imageUrl}
                              alt={`Ảnh đánh giá ${imageIndex + 1}`}
                              fill
                              sizes="56px"
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-[#94A3B8]">
                      {formatDateTime(review.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[#94A3B8]">
                Khách hàng chưa đánh giá sản phẩm trong đơn này.
              </p>
            )}
          </DetailSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "default" | "amber" | "blue" | "green" | "red";
  onClick: () => void;
}) {
  const tones = {
    default: "border-slate-200 bg-white text-slate-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${tones[tone]}`}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-white/80">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-xl font-black">{value}</span>
        <span className="block text-[11px] font-black uppercase tracking-wide">
          {label}
        </span>
      </span>
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className="h-10 rounded-md border border-[#D8E0EA] bg-white px-3 text-sm font-semibold text-[#475569] outline-none focus:border-primary"
    >
      {children}
    </select>
  );
}

function DetailSection({
  icon: Icon,
  title,
  wide = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-[#DDE4EC] bg-white p-4 shadow-xs sm:p-5 ${wide ? "lg:col-span-2" : ""}`}
    >
      <h3 className="mb-4 flex items-center gap-2.5 text-sm font-black text-[#172033]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-primary">
          <Icon className="size-4" />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">
      {children}
    </div>
  );
}
function DetailField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748B]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold leading-5 text-[#334155]">
        {value}
      </p>
    </div>
  );
}
function TextBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-[#334155]">
        {value || "Không có thông tin."}
      </p>
    </div>
  );
}
function MoneyLine({
  label,
  value,
  discount = false,
}: {
  label: string;
  value: number;
  discount?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-semibold text-[#64748B]">{label}</span>
      <span
        className={`font-black ${discount && value < 0 ? "text-emerald-700" : "text-[#334155]"}`}
      >
        {value < 0 ? `-${formatMoney(Math.abs(value))}` : formatMoney(value)}
      </span>
    </div>
  );
}

function OrderStatusBadge({ status }: { status?: string | null }) {
  const meta = ORDER_STATUS_META[status ?? ""] ?? {
    label: status ?? "-",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return (
    <Badge variant="outline" className={`whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}
function PaymentBadge({ status }: { status: string }) {
  const meta = PAYMENT_META[status] ?? PAYMENT_META.UNPAID;
  return (
    <Badge
      variant="outline"
      className={`mt-1 whitespace-nowrap text-[10px] ${meta.className}`}
    >
      {meta.label}
    </Badge>
  );
}

function getOrderAttentionReasons(order: StoreOrderRow) {
  const reasons: string[] = [];
  if (order.status === "PAYMENT_ERROR") reasons.push("Đơn gặp lỗi thanh toán");
  if (order.status === "EXPIRED") reasons.push("Đơn đã hết hạn");
  if (order.status === "CANCELLED") reasons.push("Đơn đã bị hủy");
  if (order.refundStatus === "PENDING")
    reasons.push("Đang chờ xử lý hoàn tiền");
  if (order.refundStatus === "FAILED") reasons.push("Hoàn tiền thất bại");
  if (order.shippingStatus?.toUpperCase().includes("FAILED"))
    reasons.push("Vận chuyển gặp sự cố");
  if (order.status === "DELIVERED" && getPaymentStatus(order) !== "PAID")
    reasons.push("Đã giao nhưng chưa ghi nhận thanh toán");
  const createdAt = new Date(order.createdAt ?? "").getTime();
  if (
    order.status === "PENDING" &&
    Number.isFinite(createdAt) &&
    Date.now() - createdAt > 24 * 60 * 60 * 1000
  )
    reasons.push("Chờ xác nhận quá 24 giờ");
  return reasons;
}

function orderMatchesSearch(order: StoreOrderRow, search: string) {
  const delivery = parseShippingAddress(order.shippingAddress);
  const values = [
    order.id,
    order.payment?.orderCode,
    getCustomerName(order),
    getCustomerEmail(order),
    getCustomerPhone(order),
    delivery.name,
    delivery.phone,
    delivery.address,
    order.voucherCode,
    ...(order.items ?? []).flatMap((item) => [
      item.product?.name,
      item.product?.brand,
      item.variant?.name,
    ]),
  ];
  return values.some((value) =>
    String(value ?? "")
      .toLocaleLowerCase("vi")
      .includes(search),
  );
}

function parseShippingAddress(value?: string | null) {
  const raw = value?.trim() ?? "";
  const parts = raw.split(" | ");
  const result = {
    name: "Chưa rõ",
    phone: "Chưa rõ",
    address: raw || "Chưa có địa chỉ",
    note: "",
  };
  for (const part of parts) {
    if (part.startsWith("Tên: ")) result.name = part.slice(5);
    else if (part.startsWith("SĐT: ")) result.phone = part.slice(5);
    else if (part.startsWith("Địa chỉ: ")) result.address = part.slice(9);
  }
  const noteMarker = " (Ghi chú: ";
  const noteIndex = result.address.indexOf(noteMarker);
  if (noteIndex >= 0 && result.address.endsWith(")")) {
    result.note = result.address.slice(noteIndex + noteMarker.length, -1);
    result.address = result.address.slice(0, noteIndex);
  }
  return result;
}

function getOrderCode(order: StoreOrderRow) {
  return order.payment?.orderCode
    ? String(order.payment.orderCode)
    : shortId(order.id);
}
function getCustomerName(order: StoreOrderRow) {
  return order.customerNameSnapshot ?? order.user?.name ?? "Khách hàng đã xóa";
}
function getCustomerEmail(order: StoreOrderRow) {
  return order.customerEmailSnapshot ?? order.user?.email ?? null;
}
function getCustomerPhone(order: StoreOrderRow) {
  return order.customerPhoneSnapshot ?? order.user?.phone ?? null;
}
function getPaymentStatus(order: StoreOrderRow) {
  return order.payment?.status ?? "UNPAID";
}
function getTotalItems(order: StoreOrderRow) {
  return (order.items ?? []).reduce(
    (sum, item) => sum + (item.quantity ?? 0),
    0,
  );
}
function shortId(id?: string) {
  return id ? id.slice(-8).toUpperCase() : "-";
}
function formatPaymentMethod(method?: string | null) {
  if (method === "COD") return "Tiền mặt";
  if (method === "QR") return "QR / PayOS";
  return method ?? "Chưa có phương thức";
}
function formatRefundStatus(status?: string | null) {
  if (status === "PENDING") return "Chờ xử lý";
  if (status === "REFUNDED") return "Đã hoàn tiền";
  if (status === "FAILED") return "Hoàn tiền thất bại";
  return status ?? "-";
}
function formatShippingStatus(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: "Chờ vận chuyển",
    PICKED_UP: "Đã lấy hàng",
    DELIVERING: "Đang giao",
    DELIVERED: "Đã giao",
    FAILED: "Giao hàng thất bại",
  };
  return status ? (labels[status] ?? status) : "-";
}
function formatMoney(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}
function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("vi-VN");
}
function formatTime(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}
function isSameLocalDay(
  value: string | Date | null | undefined,
  reference: Date,
) {
  if (!value) return false;
  const date = new Date(value);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}
function startOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
function matchesDateFilter(
  value: string | null | undefined,
  filter: DateFilter,
  dateFrom: string,
  dateTo: string,
) {
  if (filter === "ALL") return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === "TODAY") return isSameLocalDay(date, now);
  if (filter === "THIS_WEEK") {
    const start = startOfLocalDay(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return date >= start && date < end;
  }
  if (filter === "THIS_MONTH")
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  const from = dateFrom
    ? startOfLocalDay(new Date(`${dateFrom}T00:00:00`))
    : null;
  const to = dateTo ? startOfLocalDay(new Date(`${dateTo}T00:00:00`)) : null;
  if (to) to.setDate(to.getDate() + 1);
  return (!from || date >= from) && (!to || date < to);
}
