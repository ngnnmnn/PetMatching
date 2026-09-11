"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Mail, Search, ShieldAlert, UserCheck, UsersRound, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AccountStatus, AdminRole } from "@/lib/api/admin";
import { ActionGroup, AdminPagination, RoleBadge, StatusBadge, UserQuickStat } from "@/components/admin/admin-section-components";
import {
  ADMIN_ACCOUNT_STATUS_OPTIONS as accountStatusOptions,
  ADMIN_PAGE_SIZE,
  ADMIN_ROLE_OPTIONS as roleOptions,
  adminDateCell as dateCell,
  formatRole,
  formatStatus,
  getInitials,
  type AdminRow as Row,
} from "@/components/admin/admin-section-utils";

export function UserManagementPanel({
  users,
  savingId,
  onRunAction,
  onRoleChange,
}: {
  users: Row[];
  savingId: string;
  onRunAction: (
    row: Row,
    action: () => Promise<unknown>,
    success: string,
  ) => void;
  onRoleChange: (row: Row, role: AdminRole) => void;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRole | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "ALL">(
    "ALL",
  );
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        user.name?.toLowerCase().includes(normalizedQuery) ||
        user.email?.toLowerCase().includes(normalizedQuery) ||
        String(user.id).toLowerCase().includes(normalizedQuery);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" || user.accountStatus === statusFilter;
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
  const managerCount = users.filter((user) =>
    ["STORE_MANAGER", "SPA_MANAGER"].includes(user.role),
  ).length;
  const suspendedCount = users.filter(
    (user) => user.accountStatus === "SUSPENDED",
  ).length;
  const hasActiveFilters =
    Boolean(query) || roleFilter !== "ALL" || statusFilter !== "ALL";

  const clearFilters = () => {
    setQuery("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setCurrentPage(1);
  };

  return (
    <div>
      <div className="grid gap-3 border-b border-border bg-muted/20 p-4 md:grid-cols-3">
        <UserQuickStat
          icon={UserCheck}
          label="Đã xác thực"
          value={verifiedCount}
          tone="emerald"
        />
        <UserQuickStat
          icon={ShieldAlert}
          label="Tài khoản quản lý"
          value={managerCount}
          tone="primary"
        />
        <UserQuickStat
          icon={UserX}
          label="Đang bị khóa"
          value={suspendedCount}
          tone="red"
        />
      </div>

      <div className="grid gap-3 border-b bg-card p-4 md:grid-cols-2 xl:grid-cols-[minmax(320px,1fr)_220px_200px_112px] xl:items-center">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm theo tên, email hoặc mã người dùng..."
            className="h-11 rounded-xl pl-9 pr-10 font-semibold"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
        <Select
          value={roleFilter}
          onValueChange={(value) => {
            setRoleFilter(value as AdminRole | "ALL");
            setCurrentPage(1);
          }}
        >
          <SelectTrigger
            className="h-11 w-full rounded-xl bg-background px-3 font-bold"
            aria-label="Lọc theo vai trò"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả vai trò</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role}>
                {formatRole(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as AccountStatus | "ALL");
            setCurrentPage(1);
          }}
        >
          <SelectTrigger
            className="h-11 w-full rounded-xl bg-background px-3 font-bold"
            aria-label="Lọc theo trạng thái tài khoản"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            {accountStatusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {formatStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex h-11 items-center justify-end md:col-span-2 xl:col-span-1">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={clearFilters}
              className="h-10 rounded-xl px-3 font-bold text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
              Xóa lọc
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[25%]" />
          </colgroup>
          <thead className="bg-muted/30">
            <tr className="h-12">
              {[
                "Người dùng",
                "Vai trò hiện tại",
                "Xác thực",
                "Trạng thái",
                "Ngày tham gia",
                "Quản lý quyền",
              ].map((label, index) => (
                <th
                  key={label}
                  className={`h-12 px-4 align-middle text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground ${index === 0 ? "text-left" : "text-center"}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedUsers.map((user) => (
              <tr key={user.id} className="h-20 transition hover:bg-muted/15">
                <td className="px-4 py-3 align-middle">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-black text-primary-foreground shadow-sm">
                      {user.avatarUrl ? (
                        <Image
                          src={user.avatarUrl}
                          alt=""
                          fill
                          sizes="44px"
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        getInitials(user.name)
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-foreground">
                        {user.name || "Chưa cập nhật tên"}
                      </p>
                      <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-muted-foreground">
                        <Mail className="size-3.5 shrink-0" />
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center align-middle">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3 text-center align-middle">
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${user.isVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
                  >
                    {user.isVerified ? (
                      <CheckCircle2 className="size-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-3.5 shrink-0" />
                    )}
                    {user.isVerified ? "Đã xác thực" : "Chưa xác thực"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center align-middle">
                  <StatusBadge status={user.accountStatus} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center align-middle text-sm font-semibold text-muted-foreground">
                  {dateCell(user)}
                </td>
                <td className="px-4 py-3 align-middle">
                  <ActionGroup
                    section="users"
                    row={user}
                    busy={savingId === user.id}
                    onAction={(action, success) =>
                      onRunAction(user, action, success)
                    }
                    onRoleChange={(role) => onRoleChange(user, role)}
                  />
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <UsersRound className="mx-auto size-8 text-muted-foreground/70" />
                  <p className="mt-3 text-sm font-bold text-muted-foreground">
                    Không tìm thấy người dùng phù hợp.
                  </p>
                </td>
              </tr>
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

