"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Eye, Loader2, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { adminApi, type AccountStatus, type AdminRole } from "@/lib/api/admin";
import {
  ADMIN_ACCOUNT_STATUS_OPTIONS as accountStatusOptions,
  ADMIN_PAGE_SIZE,
  ADMIN_ROLE_OPTIONS as roleOptions,
  formatRole,
  formatStatus,
  type AdminRow as Row,
} from "@/components/admin/admin-section-utils";

export function UserQuickStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof UserCheck;
  label: string;
  value: number;
  tone: "emerald" | "primary" | "red";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    primary: "border-primary/20 bg-primary/10 text-primary",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 ${tones[tone]}`}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-background/80">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xl font-black">{value}</p>
        <p className="text-[11px] font-black uppercase tracking-wider opacity-80">
          {label}
        </p>
      </div>
    </div>
  );
}

export function RoleBadge({ role }: { role?: string }) {
  const tones: Record<string, string> = {
    USER: "bg-slate-100 text-slate-700",
    STORE_MANAGER: "bg-sky-50 text-sky-700",
    SPA_MANAGER: "bg-violet-50 text-violet-700",
    SPA_STAFF: "bg-fuchsia-50 text-fuchsia-700",
    MODERATOR: "bg-amber-50 text-amber-800",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${tones[role ?? ""] ?? "bg-slate-100 text-slate-700"}`}
    >
      {formatRole(role)}
    </span>
  );
}

export function StatusBadge({
  status,
  label,
  compact = false,
}: {
  status?: string;
  label?: ReactNode;
  compact?: boolean;
}) {
  const tones: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    VERIFIED: "bg-emerald-50 text-emerald-700",
    PENDING: "bg-amber-50 text-amber-800",
    HIDDEN: "bg-amber-50 text-amber-800",
    REVIEWING: "bg-sky-50 text-sky-700",
    NEED_MORE_INFO: "bg-orange-50 text-orange-700",
    REJECTED: "bg-red-50 text-red-700",
    SUSPENDED: "bg-red-50 text-red-700",
    INACTIVE: "bg-slate-100 text-slate-600",
    NONE: "bg-slate-100 text-slate-600",
  };
  return (
    <Badge
      variant="secondary"
      title={typeof label === "string" ? label : formatStatus(status)}
      className={`max-w-full whitespace-nowrap rounded-full border-0 font-black ${compact ? "gap-1 px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${tones[status ?? "NONE"] ?? tones.NONE}`}
    >
      <span
        className={`${compact ? "size-1.5" : "size-2"} rounded-full bg-current opacity-70`}
      />
      <span className="truncate">{label ?? formatStatus(status)}</span>
    </Badge>
  );
}

export function ActionGroup({
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
    return (
      <Loader2
        className={`${section === "users" ? "mx-auto" : "ml-auto"} size-5 animate-spin text-primary`}
      />
    );
  }

  if (section === "users") {
    const availableRoles: AdminRole[] =
      row.role === "SPA_MANAGER"
        ? ["SPA_MANAGER", "USER"]
        : row.role === "STORE_MANAGER"
          ? ["STORE_MANAGER", "USER", "SPA_STAFF"]
          : roleOptions;

    return (
      <div className="mx-auto grid max-w-[340px] grid-cols-2 gap-2">
        <label className="min-w-0">
          <select
            aria-label={`Đổi vai trò của ${row.name}`}
            className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-xs font-black text-foreground/85 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            value={row.role}
            onChange={(event) => onRoleChange(event.target.value as AdminRole)}
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {formatRole(role)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <select
            aria-label={`Đổi trạng thái tài khoản của ${row.name}`}
            className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-xs font-black text-foreground/85 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
            value={row.accountStatus}
            onChange={(event) =>
              onAction(
                () =>
                  adminApi.updateAccountStatus(
                    row.id,
                    event.target.value as AccountStatus,
                  ),
                "Đã cập nhật trạng thái tài khoản.",
              )
            }
          >
            {accountStatusOptions.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (section === "reports") {
    return (
      <div className="flex justify-end gap-2">
        <IconButton
          label="Xem xét"
          icon={Eye}
          onClick={() => onInspectMatchingReport?.()}
        />
      </div>
    );
  }

  return (
    <span className="block text-right text-xs font-black text-muted-foreground/70">
      Chỉ xem
    </span>
  );
}

export function IconButton({
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
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground/75 shadow-sm transition hover:border-primary hover:bg-primary/10 hover:text-primary"
    >
      <Icon className="size-4" />
    </button>
  );
}

export function AdminPagination({
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
  const firstItem =
    totalItems === 0 ? 0 : (currentPage - 1) * ADMIN_PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * ADMIN_PAGE_SIZE, totalItems);
  const pageItems: Array<number | "start-ellipsis" | "end-ellipsis"> =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : currentPage <= 4
        ? [1, 2, 3, 4, 5, "end-ellipsis", totalPages]
        : currentPage >= totalPages - 3
          ? [
              1,
              "start-ellipsis",
              totalPages - 4,
              totalPages - 3,
              totalPages - 2,
              totalPages - 1,
              totalPages,
            ]
          : [
              1,
              "start-ellipsis",
              currentPage - 1,
              currentPage,
              currentPage + 1,
              "end-ellipsis",
              totalPages,
            ];

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
                className={
                  currentPage === 1
                    ? "pointer-events-none opacity-40"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
            {pageItems.map((item, index) =>
              typeof item === "number" ? (
                <PaginationItem key={item}>
                  <PaginationLink
                    isActive={item === currentPage}
                    aria-label={`Đến trang ${item}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange(item);
                    }}
                    className={
                      item === currentPage
                        ? "cursor-pointer border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "cursor-pointer"
                    }
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ) : (
                <PaginationItem key={`${item}-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                aria-disabled={currentPage === totalPages}
                tabIndex={currentPage === totalPages ? -1 : 0}
                onClick={(event) => {
                  event.preventDefault();
                  if (currentPage < totalPages) onPageChange(currentPage + 1);
                }}
                className={
                  currentPage === totalPages
                    ? "pointer-events-none opacity-40"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-20 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-center">
      <p className="text-xl font-black tracking-normal text-foreground">
        {value}
      </p>
      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

