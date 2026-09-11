"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, PackageOpen, ShieldAlert, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { MatchingReportDialog, MatchingReportFilters } from "@/components/admin/admin-matching-reports";
import { UserManagementPanel } from "@/components/admin/admin-user-management";
import { ProductCatalogPanel, SpaServicesPanel } from "@/components/admin/admin-catalog-panels";
import { SystemProfileForm } from "@/components/admin/admin-system-profile";
import { SpaManagerRoleDialog, type SpaManagerRoleFlow } from "@/components/admin/admin-spa-role-dialog";
import { PetDetailDialog, PetManagementPanel, PetModerationDialog, type PetModerationFlow } from "@/components/admin/admin-pet-management";
import { ActionGroup, AdminPagination, MiniStat, RoleBadge, StatusBadge } from "@/components/admin/admin-section-components";
import { adminSectionConfig as sectionConfig, sectionsWithoutTableActions } from "@/components/admin/admin-section-config";
import {
  ADMIN_PAGE_SIZE,
  formatMatchingReportReason,
  getAdminErrorMessage,
  groupSpaServiceVariants,
  hasActionablePetDocument,
  hasApprovedPetDocument,
  normalizeAdminRows as normalizeRows,
  petMatchesVerificationFilter,
  renderAdminValue as renderValue,
  type AdminRow as Row,
  type PetVerificationFilter,
} from "@/components/admin/admin-section-utils";
import { SpaOverviewPanel, StoreOverviewPanel } from "@/components/admin/business-overview-panels";
import { SpaBookingsPanel } from "@/components/admin/spa-bookings-panel";
import { StoreOrdersPanel } from "@/components/admin/store-orders-panel";
import { useAdminDashboardRange } from "@/components/admin/admin-dashboard-range-context";
import { AdminRole, adminApi, ModerateReportAbusePayload } from "@/lib/api/admin";
export default function AdminSectionPage() {
  const params = useParams<{ section: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = params.section;
  const section =
    requestedSection === "pet-verifications" ? "pets" : requestedSection;
  const config = sectionConfig[section];
  const showTableActions = !sectionsWithoutTableActions.has(section);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [complaintTarget, setComplaintTarget] = useState("ALL");
  const [complaintStatus, setComplaintStatus] = useState("PENDING");
  const [reportSearch, setReportSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { timeRange: overviewTimeRange, setTimeRange: setOverviewTimeRange } =
    useAdminDashboardRange();
  const [petVerificationFilter, setPetVerificationFilter] =
    useState<PetVerificationFilter>(
      requestedSection === "pet-verifications" ||
        searchParams.get("verification") === "pending"
        ? "PENDING"
        : "ALL",
    );
  const [spaManagerRoleFlow, setSpaManagerRoleFlow] =
    useState<SpaManagerRoleFlow | null>(null);
  const [petModerationFlow, setPetModerationFlow] =
    useState<PetModerationFlow | null>(null);
  const [petDetail, setPetDetail] = useState<Row | null>(null);
  const [matchingReportDetail, setMatchingReportDetail] = useState<Row | null>(
    null,
  );
  const [matchingReportLoading, setMatchingReportLoading] = useState(false);

  const load = useCallback(() => {
    if (!config) return;
    setCurrentPage(1);
    setLoading(true);
    setError("");
    const loader =
      section === "store-overview"
        ? () => adminApi.storeDashboard(overviewTimeRange)
        : section === "spa-overview"
          ? () => adminApi.spaDashboard(overviewTimeRange)
          : config.loader;
    loader()
      .then((response) => setRows(normalizeRows(section, response.data)))
      .catch(() => setError("Không thể tải dữ liệu cho mục quản trị này."))
      .finally(() => setLoading(false));
  }, [config, overviewTimeRange, section]);

  useEffect(() => {
    // Loading remote section data is the synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (requestedSection === "pet-verifications") {
      router.replace("/admin/pets?verification=pending");
    }
  }, [requestedSection, router]);

  useEffect(() => {
    if (section !== "reports") return;
    const query = new URLSearchParams(window.location.search);
    const status = query.get("status");
    // Keep report filters synchronized with links from the dashboard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComplaintTarget(query.get("targetType") ?? "ALL");
    setComplaintStatus(
      status === "REVIEWING" ? "PENDING" : (status ?? "PENDING"),
    );
  }, [section]);

  const visibleRows = useMemo(() => {
    if (section === "pets") {
      return [...rows]
        .filter((row) =>
          petMatchesVerificationFilter(row, petVerificationFilter),
        )
        .sort(
          (left, right) =>
            Number(hasActionablePetDocument(right)) -
            Number(hasActionablePetDocument(left)),
        );
    }
    if (section !== "reports") return rows;
    const normalizedSearch = reportSearch.trim().toLocaleLowerCase("vi");
    return rows.filter(
      (row) =>
        (complaintTarget === "ALL" || row.targetType === complaintTarget) &&
        (complaintStatus === "ALL" ||
          (complaintStatus === "PENDING"
            ? ["PENDING", "REVIEWING"].includes(row.status)
            : row.status === complaintStatus)) &&
        (!normalizedSearch ||
          [
            row.reporter?.name,
            row.reporter?.email,
            row.reportedUser?.name,
            row.pet?.name,
            formatMatchingReportReason(row.reason),
          ].some((value) =>
            String(value ?? "")
              .toLocaleLowerCase("vi")
              .includes(normalizedSearch),
          )),
    );
  }, [
    complaintStatus,
    complaintTarget,
    petVerificationFilter,
    reportSearch,
    rows,
    section,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(visibleRows.length / ADMIN_PAGE_SIZE),
  );
  const activePage = Math.min(currentPage, totalPages);
  const paginatedRows = visibleRows.slice(
    (activePage - 1) * ADMIN_PAGE_SIZE,
    activePage * ADMIN_PAGE_SIZE,
  );

  const titleStats = useMemo(() => {
    if (section === "pets") {
      return {
        total: rows.length,
        active: rows.filter(hasApprovedPetDocument).length,
        pending: rows.filter(hasActionablePetDocument).length,
      };
    }
    if (section === "system-profile") {
      return { total: 1, active: 1, pending: 1 };
    }
    if (section === "store-overview") {
      const stats = rows[0]?.stats ?? {};
      return {
        total: stats.todayOrders ?? 0,
        active: stats.completedOrders ?? 0,
        pending: stats.pendingOrders ?? 0,
      };
    }
    if (section === "spa-overview") {
      const stats = rows[0]?.stats ?? {};
      return {
        total: stats.todayBookings ?? 0,
        active: stats.completedBookings ?? 0,
        pending: stats.pendingBookings ?? 0,
      };
    }
    if (section === "spa-services") {
      const groups = groupSpaServiceVariants(rows);
      return {
        total: groups.length,
        active: groups.filter((group) =>
          group.variants.some((service) => service.isActive),
        ).length,
        pending: groups.filter((group) =>
          group.variants.every((service) => !service.isActive),
        ).length,
      };
    }
    const pending = rows.filter((row) =>
      ["PENDING", "REVIEWING"].includes(row.status),
    ).length;
    const active =
      section === "reports"
        ? rows.filter((row) =>
            ["RESOLVED", "DISMISSED", "INSUFFICIENT_EVIDENCE"].includes(
              row.status,
            ),
          ).length
        : rows.filter(
            (row) => row.status === "ACTIVE" || row.accountStatus === "ACTIVE",
          ).length;
    if (section === "store-products") {
      return {
        total: rows.length,
        active: rows.filter((row) => row.isActive).length,
        pending: rows.filter((row) => (row.stock ?? 0) === 0).length,
      };
    }
    return { total: rows.length, pending, active };
  }, [rows, section]);

  const runAction = async (
    row: Row,
    action: () => Promise<unknown>,
    success: string,
  ) => {
    setSavingId(row.id);
    try {
      await action();
      toast.success(success);
      load();
      return true;
    } catch (error: unknown) {
      toast.error(getAdminErrorMessage(error, "Thao tác thất bại."));
      return false;
    } finally {
      setSavingId("");
    }
  };

  const handleRoleChange = (row: Row, nextRole: AdminRole) => {
    if (nextRole === row.role) return;

    if (row.role !== "SPA_MANAGER" && nextRole === "SPA_MANAGER") {
      setSpaManagerRoleFlow({ mode: "GRANT", user: row });
      return;
    }

    if (row.role === "SPA_MANAGER" && nextRole === "USER") {
      setSpaManagerRoleFlow({ mode: "REVOKE", user: row });
      return;
    }

    runAction(
      row,
      () => adminApi.updateUserRole(row.id, nextRole),
      "Đã cập nhật vai trò.",
    );
  };

  const inspectMatchingReport = async (row: Row) => {
    setMatchingReportLoading(true);
    try {
      if (row.status === "PENDING") {
        await adminApi.startMatchingReportReview(row.id);
        setRows((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, status: "REVIEWING" } : item,
          ),
        );
      }
      const response = await adminApi.matchingReport(row.id);
      setMatchingReportDetail(response.data);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      toast.error(message ?? "Không thể tải chi tiết báo cáo.");
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
        payload.action === "WARNING"
          ? "Đã gửi cảnh báo đến người phản ánh."
          : "Đã khóa tài khoản người phản ánh.",
      );
      const response = await adminApi.matchingReport(reportId);
      setMatchingReportDetail(response.data);
      load();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      toast.error(message ?? "Không thể xử lý tài khoản người phản ánh.");
    } finally {
      setSavingId("");
    }
  };

  if (!config) notFound();

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
        <div className="absolute -right-16 -top-20 size-52 rounded-full bg-primary/10" />
        <div
          className={`relative grid gap-5 p-6 ${["system-profile", "store-orders", "spa-bookings"].includes(section) ? "" : "lg:grid-cols-[minmax(0,1fr)_360px]"}`}
        >
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              {section === "users" ? (
                <UsersRound className="size-5" />
              ) : section === "store-products" ? (
                <PackageOpen className="size-5" />
              ) : (
                <ShieldAlert className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-primary">
                Trung tâm quản trị
              </p>
              <h2 className="mt-1.5 text-3xl font-black tracking-normal text-foreground">
                {config.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>
          {!["system-profile", "store-orders", "spa-bookings"].includes(
            section,
          ) && (
            <div className="grid grid-cols-3 gap-3 self-center">
              <MiniStat
                label={
                  section === "spa-overview"
                    ? "Lịch hôm nay"
                    : section === "store-overview"
                      ? "Đơn hôm nay"
                      : section === "spa-services"
                        ? "Dịch vụ"
                        : "Tổng"
                }
                value={titleStats.total}
              />
              <MiniStat
                label={
                  ["spa-overview", "store-overview"].includes(section)
                    ? "Hoàn thành"
                    : section === "store-products"
                      ? "Đang bán"
                      : section === "spa-services"
                        ? "Đang mở"
                        : section === "reports"
                          ? "Đã xử lý"
                          : section === "pets"
                            ? "Đã xác minh"
                            : "Hoạt động"
                }
                value={titleStats.active}
              />
              <MiniStat
                label={
                  section === "spa-services"
                    ? "Tạm ngừng"
                    : section === "store-products"
                      ? "Hết hàng"
                      : "Chờ xử lý"
                }
                value={titleStats.pending}
              />
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-6">
            <p className="font-black text-red-700">{error}</p>
          </div>
        ) : section === "pets" ? (
          <PetManagementPanel
            allPets={rows}
            pets={paginatedRows}
            filter={petVerificationFilter}
            currentPage={activePage}
            totalItems={visibleRows.length}
            onFilterChange={(value) => {
              setPetVerificationFilter(value);
              setCurrentPage(1);
              window.history.replaceState(
                null,
                "",
                value === "PENDING"
                  ? "/admin/pets?verification=pending"
                  : "/admin/pets",
              );
            }}
            onPageChange={setCurrentPage}
            onInspect={setPetDetail}
          />
        ) : section === "users" ? (
          <UserManagementPanel
            users={rows}
            savingId={savingId}
            onRunAction={runAction}
            onRoleChange={handleRoleChange}
          />
        ) : section === "system-profile" ? (
          <SystemProfileForm
            key={String(rows[0]?.id ?? "loading")}
            profile={rows[0]}
            onSaved={load}
          />
        ) : section === "store-overview" ? (
          <StoreOverviewPanel
            data={rows[0]}
            timeRange={overviewTimeRange}
            onTimeRangeChange={setOverviewTimeRange}
            onRefresh={load}
          />
        ) : section === "spa-overview" ? (
          <SpaOverviewPanel
            data={rows[0]}
            timeRange={overviewTimeRange}
            onTimeRangeChange={setOverviewTimeRange}
            onRefresh={load}
          />
        ) : section === "spa-services" ? (
          <SpaServicesPanel services={rows} />
        ) : section === "spa-bookings" ? (
          <SpaBookingsPanel bookings={rows} onRefresh={load} />
        ) : section === "store-orders" ? (
          <StoreOrdersPanel orders={rows} onRefresh={load} />
        ) : section === "store-products" ? (
          <ProductCatalogPanel products={rows} />
        ) : (
          <div>
            {section === "reports" && (
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
                <thead className="bg-muted/30">
                  <tr>
                    {config.columns.map((column) => (
                      <th
                        key={column.key}
                        className="px-5 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground"
                      >
                        {column.label}
                      </th>
                    ))}
                    {showTableActions && (
                      <th className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Thao tác
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedRows.map((row, index) => (
                    <tr
                      key={row.id ?? `${section}-${index}`}
                      className="transition hover:bg-muted/20"
                    >
                      {config.columns.map((column) => (
                        <td
                          key={column.key}
                          className="max-w-[280px] truncate px-5 py-4 text-sm font-semibold text-foreground/85"
                        >
                          {renderAdminCell(column, row)}
                        </td>
                      ))}
                      {showTableActions && (
                        <td className="px-5 py-4">
                          <ActionGroup
                            section={section}
                            row={row}
                            busy={savingId === row.id}
                            onAction={(action, success) =>
                              runAction(row, action, success)
                            }
                            onRoleChange={(nextRole) =>
                              handleRoleChange(row, nextRole)
                            }
                            onInspectMatchingReport={() =>
                              inspectMatchingReport(row)
                            }
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                  {!visibleRows.length && (
                    <tr>
                      <td
                        className="px-5 py-14 text-center text-sm font-semibold text-muted-foreground"
                        colSpan={
                          config.columns.length + (showTableActions ? 1 : 0)
                        }
                      >
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
              itemLabel={
                section === "pets"
                  ? "thú cưng"
                  : section === "reports"
                    ? "phản ánh"
                    : "mục"
              }
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
        key={matchingReportDetail?.id ?? "closed"}
        report={matchingReportDetail}
        open={Boolean(matchingReportDetail)}
        onOpenChange={(open) => !open && setMatchingReportDetail(null)}
        resolving={Boolean(
          matchingReportDetail && savingId === matchingReportDetail.id,
        )}
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
              adminApi.resolveMatchingReport(matchingReportDetail.id, payload),
            "Đã xử lý phản ánh.",
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

function renderAdminCell(
  column: { key: string; render?: (row: Row) => ReactNode },
  row: Row,
) {
  if (column.key === "status" || column.key === "accountStatus") {
    return (
      <StatusBadge status={row[column.key]} label={column.render?.(row)} />
    );
  }
  if (column.key === "role") return <RoleBadge role={row.role} />;
  return column.render ? column.render(row) : renderValue(row[column.key]);
}
