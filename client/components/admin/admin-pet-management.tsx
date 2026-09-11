"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { CheckCircle2, Eye, EyeOff, Loader2, PawPrint, ShieldAlert, XCircle, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { AdminFilterSelect } from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminApi, type DocumentStatus, type HidePetReason, type RestorePetReason } from "@/lib/api/admin";
import { AdminPagination, StatusBadge } from "@/components/admin/admin-section-components";
import {
  adminDateCell as dateCell,
  formatDateValue,
  formatDocumentType,
  formatGender,
  formatPetModerationReason,
  formatSpecies,
  formatStatus,
  getAdminErrorMessage,
  hasActionablePetDocument,
  hasApprovedPetDocument,
  hasRejectedPetDocument,
  type AdminRow as Row,
  type PetVerificationFilter,
} from "@/components/admin/admin-section-utils";

export type PetModerationFlow = {
  mode: "HIDE" | "RESTORE";
  pet: Row;
};

function renderPetIdentity(row: Row) {
  return (
    <div className="flex items-center gap-3 whitespace-normal">
      <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
        {row.avatarUrl ? (
          <Image
            src={row.avatarUrl}
            alt={row.name ?? "Thú cưng"}
            fill
            sizes="48px"
            unoptimized
            className="object-cover"
          />
        ) : (
          <PawPrint className="size-5 text-muted-foreground/70" />
        )}
      </span>
      <span className="min-w-0">
        <span
          className="block truncate font-black text-foreground"
          title={row.name}
        >
          {row.name ?? "-"}
        </span>
        <span className="mt-1 block truncate text-[10px] font-bold uppercase text-muted-foreground">
          #
          {String(row.id ?? "")
            .slice(-6)
            .toUpperCase()}
        </span>
      </span>
    </div>
  );
}

function renderPetProfileSummary(row: Row) {
  const breed = row.breed ?? "-";
  return (
    <div className="min-w-0 whitespace-normal">
      <p className="truncate font-black text-foreground">
        {formatSpecies(row.species)} · {formatGender(row.gender)}
      </p>
      <p
        className="mt-1 truncate text-xs font-semibold text-muted-foreground"
        title={breed}
      >
        {breed}
      </p>
    </div>
  );
}

function renderPetOwner(row: Row) {
  return (
    <div className="min-w-0 whitespace-normal">
      <p className="truncate font-black text-foreground">
        {row.owner?.name ?? "-"}
      </p>
      <p
        className="mt-1 truncate text-xs font-semibold text-muted-foreground"
        title={row.owner?.email}
      >
        {row.owner?.email ?? "-"}
      </p>
    </div>
  );
}

function renderPetDocumentSummary(row: Row) {
  const documents: Row[] = row.documents ?? [];
  if (!documents.length) return <StatusBadge status="NONE" />;
  return (
    <div className="grid min-w-0 gap-1.5 whitespace-normal">
      {documents.slice(0, 2).map((document) => (
        <div
          key={document.id}
          className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-1.5"
        >
          <span
            className="line-clamp-2 min-w-0 flex-1 text-[11px] font-bold leading-4 text-foreground"
            title={formatDocumentType(document.type)}
          >
            {formatDocumentType(document.type)}
          </span>
          <StatusBadge status={document.status} compact />
        </div>
      ))}
      {documents.length > 2 && (
        <span className="text-xs font-bold text-muted-foreground">
          +{documents.length - 2} giấy tờ khác
        </span>
      )}
    </div>
  );
}

const hidePetReasonOptions: Array<{ value: HidePetReason; label: string }> = [
  { value: "CONTENT_VIOLATION", label: "Nội dung hoặc hình ảnh vi phạm" },
  { value: "INACCURATE_INFORMATION", label: "Thông tin không chính xác" },
  { value: "SUSPECTED_FAKE", label: "Nghi ngờ hồ sơ giả mạo" },
  { value: "DOCUMENT_FRAUD", label: "Nghi ngờ giấy tờ giả" },
  { value: "UNRESOLVED_REPORT", label: "Có báo cáo cần xác minh" },
  { value: "OTHER", label: "Lý do khác" },
];

const restorePetReasonOptions: Array<{
  value: RestorePetReason;
  label: string;
}> = [
  { value: "INFORMATION_VERIFIED", label: "Đã xác minh lại thông tin" },
  { value: "REPORT_RESOLVED", label: "Báo cáo đã được xử lý" },
  { value: "DOCUMENTS_APPROVED", label: "Giấy tờ đã được duyệt" },
  { value: "ADMIN_REVIEW", label: "Đã được Admin rà soát" },
  { value: "OTHER", label: "Lý do khác" },
];

export function PetModerationDialog({
  flow,
  onClose,
  onSuccess,
}: {
  flow: PetModerationFlow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [detail, setDetail] = useState<Row | null>(null);
  const [reason, setReason] = useState<HidePetReason | RestorePetReason | "">(
    "",
  );
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .pet(flow.pet.id)
      .then((response) => setDetail(response.data))
      .catch((error: unknown) =>
        setError(
          getAdminErrorMessage(error, "Không thể tải chi tiết hồ sơ thú cưng."),
        ),
      )
      .finally(() => setLoading(false));
  }, [flow.pet.id]);

  const isRestore = flow.mode === "RESTORE";
  const reasonOptions = isRestore
    ? restorePetReasonOptions
    : hidePetReasonOptions;
  const restoreBlocked =
    isRestore &&
    Boolean(
      (detail?.unresolvedReportCount ?? 0) > 0 ||
      detail?.owner?.accountStatus !== "ACTIVE",
    );

  const submit = async () => {
    setError("");
    if (!reason) {
      setError("Vui lòng chọn lý do để tiếp tục.");
      return;
    }

    setSaving(true);
    try {
      if (isRestore) {
        await adminApi.restorePet(
          flow.pet.id,
          reason as RestorePetReason,
          note.trim() || undefined,
        );
        toast.success("Đã khôi phục hồ sơ thú cưng.");
      } else {
        await adminApi.hidePet(
          flow.pet.id,
          reason as HidePetReason,
          note.trim() || undefined,
        );
        toast.success("Đã ẩn hồ sơ thú cưng.");
      }
      onSuccess();
    } catch (error: unknown) {
      setError(
        getAdminErrorMessage(
          error,
          "Không thể cập nhật trạng thái hồ sơ thú cưng.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/55 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
        <div className="border-b border-border px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-primary">
            Kiểm duyệt hồ sơ thú cưng
          </p>
          <h3 className="mt-1 text-2xl font-black text-foreground">
            {isRestore ? "Khôi phục hồ sơ" : "Ẩn hồ sơ"} {flow.pet.name}
          </h3>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Chủ sở hữu: {detail?.owner?.name ?? flow.pet.owner?.name ?? "-"}
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
                <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm font-semibold text-foreground/75">
                  <p>
                    <span className="font-black text-foreground">
                      Lý do ẩn gần nhất:
                    </span>{" "}
                    {formatPetModerationReason(
                      detail?.lastHideAction?.metadata?.reason,
                    )}
                  </p>
                  <p>
                    <span className="font-black text-foreground">
                      Thời điểm ẩn:
                    </span>{" "}
                    {detail?.lastHideAction?.createdAt
                      ? dateCell({ createdAt: detail.lastHideAction.createdAt })
                      : "-"}
                  </p>
                  <p>
                    <span className="font-black text-foreground">
                      Báo cáo chưa xử lý:
                    </span>{" "}
                    {detail?.unresolvedReportCount ?? 0}
                  </p>
                </div>
              )}

              {isRestore && (detail?.unresolvedReportCount ?? 0) > 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  Cần xử lý toàn bộ báo cáo liên quan trước khi khôi phục hồ sơ.
                </p>
              )}

              {isRestore && detail?.owner?.accountStatus !== "ACTIVE" && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  Không thể khôi phục khi tài khoản chủ sở hữu không hoạt động.
                </p>
              )}

              <label className="grid gap-2 text-sm font-black text-foreground">
                Lý do <span className="text-red-600">*</span>
                <select
                  value={reason}
                  onChange={(event) =>
                    setReason(
                      event.target.value as HidePetReason | RestorePetReason,
                    )
                  }
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
                >
                  <option value="">Chọn lý do</option>
                  {reasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-foreground">
                Ghi chú
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Nhập thông tin kiểm duyệt bổ sung (không bắt buộc)"
                  className="resize-none rounded-lg border border-border bg-background p-3 text-sm font-semibold outline-none focus:border-primary"
                />
              </label>

              <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-bold leading-5 text-sky-800">
                {isRestore
                  ? "Hồ sơ sẽ hoạt động trở lại, nhưng chức năng ghép đôi vẫn tắt. Chủ sở hữu phải chủ động bật lại sau khi kiểm tra hồ sơ."
                  : "Hồ sơ sẽ bị ẩn khỏi hệ thống, ngừng hoạt động và bị tắt khỏi danh sách ghép đôi."}
              </p>
            </>
          )}

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-black text-foreground/75"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || saving || restoreBlocked}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isRestore ? "Xác nhận khôi phục" : "Xác nhận ẩn"}
          </button>
        </div>
      </div>
    </div>
  );
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
  const options: Array<{
    value: PetVerificationFilter;
    label: string;
    count: number;
  }> = [
    { value: "ALL", label: "Tất cả", count: rows.length },
    {
      value: "PENDING",
      label: "Chờ duyệt",
      count: rows.filter(hasActionablePetDocument).length,
    },
    {
      value: "VERIFIED",
      label: "Đã xác minh",
      count: rows.filter(hasApprovedPetDocument).length,
    },
    {
      value: "NEED_MORE_INFO",
      label: "Cần bổ sung",
      count: rows.filter((row) =>
        row.documents?.some(
          (document: Row) => document.status === "NEED_MORE_INFO",
        ),
      ).length,
    },
    {
      value: "REJECTED",
      label: "Bị từ chối",
      count: rows.filter(hasRejectedPetDocument).length,
    },
    {
      value: "NONE",
      label: "Chưa có giấy tờ",
      count: rows.filter((row) => !row.documents?.length).length,
    },
  ];

  return (
    <div className="border-b bg-muted/20 px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">
            Trạng thái xác minh
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lọc thú cưng theo tình trạng giấy tờ
          </p>
        </div>
        <AdminFilterSelect
          ariaLabel="Lọc thú cưng theo trạng thái xác minh"
          value={value}
          onChange={(nextValue) => onChange(nextValue as PetVerificationFilter)}
          options={options}
          className="w-full sm:w-[260px]"
        />
      </div>
    </div>
  );
}

export function PetManagementPanel({
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
      <PetVerificationFilters
        rows={allPets}
        value={filter}
        onChange={onFilterChange}
      />
      <Table className="w-full table-fixed">
        <TableHeader className="bg-muted/30">
          <TableRow className="h-12 hover:bg-transparent">
            <TableHead className="h-12 w-[18%] px-4 align-middle text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
              Thú cưng
            </TableHead>
            <TableHead className="h-12 w-[13%] px-4 align-middle text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
              Thông tin
            </TableHead>
            <TableHead className="h-12 w-[20%] px-4 align-middle text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
              Chủ sở hữu
            </TableHead>
            <TableHead className="h-12 w-[24%] px-4 align-middle text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
              Giấy tờ
            </TableHead>
            <TableHead className="h-12 w-[12%] px-4 text-center align-middle text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
              Trạng thái
            </TableHead>
            <TableHead className="h-12 w-[13%] px-4 text-center align-middle text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
              Thao tác
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pets.map((pet) => (
            <TableRow key={pet.id} className="group h-20 hover:bg-muted/15">
              <TableCell className="px-4 py-3 align-middle whitespace-normal">
                {renderPetIdentity(pet)}
              </TableCell>
              <TableCell className="px-4 py-3 align-middle whitespace-normal">
                {renderPetProfileSummary(pet)}
              </TableCell>
              <TableCell className="px-4 py-3 align-middle whitespace-normal">
                {renderPetOwner(pet)}
              </TableCell>
              <TableCell className="px-4 py-3 align-middle whitespace-normal">
                {renderPetDocumentSummary(pet)}
              </TableCell>
              <TableCell className="px-4 py-3 align-middle whitespace-normal">
                <div className="flex justify-center">
                  <StatusBadge
                    status={pet.status}
                    label={formatStatus(pet.status)}
                  />
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 align-middle">
                <div className="flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      hasActionablePetDocument(pet) ? "default" : "outline"
                    }
                    onClick={() => onInspect(pet)}
                    aria-label={
                      hasActionablePetDocument(pet)
                        ? `Xem và duyệt hồ sơ ${pet.name}`
                        : `Xem chi tiết hồ sơ ${pet.name}`
                    }
                    className="min-w-[118px] rounded-lg px-3 text-xs font-black"
                  >
                    <Eye className="size-4" />
                    <span className="hidden lg:inline">
                      {hasActionablePetDocument(pet)
                        ? "Xem & duyệt"
                        : "Chi tiết"}
                    </span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!pets.length && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-40 text-center whitespace-normal text-sm font-semibold text-muted-foreground"
              >
                Không có thú cưng phù hợp với bộ lọc này.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <AdminPagination
        currentPage={currentPage}
        totalItems={totalItems}
        onPageChange={onPageChange}
        itemLabel="thú cưng"
      />
    </div>
  );
}

export function PetDetailDialog({
  pet,
  onClose,
  onChanged,
  onModerate,
}: {
  pet: Row;
  onClose: () => void;
  onChanged: () => void;
  onModerate: (mode: "HIDE" | "RESTORE") => void;
}) {
  const [detail, setDetail] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewIntent, setReviewIntent] = useState<{
    documentId: string;
    status: DocumentStatus;
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminApi.pet(pet.id);
      setDetail(response.data);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setError(message ?? "Không thể tải chi tiết hồ sơ thú cưng.");
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
    setReviewNote("");
    setError("");
  };

  const submitReview = async () => {
    if (!reviewIntent) return;
    const normalizedNote = reviewNote.trim();
    if (reviewIntent.status !== "APPROVED" && !normalizedNote) {
      setError(
        reviewIntent.status === "REJECTED"
          ? "Vui lòng nhập lý do từ chối."
          : "Vui lòng ghi rõ thông tin cần bổ sung.",
      );
      return;
    }

    setSaving(true);
    setError("");
    try {
      await adminApi.reviewPetDocument(
        reviewIntent.documentId,
        reviewIntent.status,
        normalizedNote || undefined,
      );
      toast.success(
        reviewIntent.status === "APPROVED"
          ? "Đã duyệt giấy tờ thú cưng."
          : reviewIntent.status === "REJECTED"
            ? "Đã từ chối giấy tờ thú cưng."
            : "Đã yêu cầu bổ sung thông tin.",
      );
      setReviewIntent(null);
      setReviewNote("");
      await loadDetail();
      onChanged();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setError(message ?? "Không thể cập nhật kết quả xác minh.");
    } finally {
      setSaving(false);
    }
  };

  const profileImages = detail
    ? (Array.from(
        new Set([detail.avatarUrl, ...(detail.gallery ?? [])].filter(Boolean)),
      ) as string[])
    : [];
  const documents: Row[] = detail?.documents ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="grid max-h-[92vh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14 text-left">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-primary">
                Chi tiết hồ sơ thú cưng
              </p>
              <DialogTitle className="mt-1 text-2xl">
                {detail?.name ?? pet.name}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Xem đầy đủ thông tin và giấy tờ trước khi đưa ra quyết định.
              </DialogDescription>
            </div>
            {detail && detail.status !== "INACTIVE" && (
              <button
                type="button"
                onClick={() =>
                  onModerate(detail.status === "HIDDEN" ? "RESTORE" : "HIDE")
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-black text-foreground/75 transition hover:border-primary hover:text-primary"
              >
                {detail.status === "HIDDEN" ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
                {detail.status === "HIDDEN" ? "Khôi phục hồ sơ" : "Ẩn hồ sơ"}
              </button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : detail ? (
          <div className="grid min-h-0 gap-6 overflow-x-hidden overflow-y-auto p-6">
            <section className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <div>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40">
                  {profileImages[0] ? (
                    <button
                      type="button"
                      onClick={() => setViewingImageUrl(profileImages[0])}
                      className="relative size-full"
                    >
                      <Image
                        src={profileImages[0]}
                        alt={detail.name}
                        fill
                        sizes="240px"
                        unoptimized
                        className="object-cover"
                      />
                    </button>
                  ) : (
                    <PawPrint className="size-16 text-muted-foreground/70" />
                  )}
                </div>
                {profileImages.length > 1 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {profileImages.slice(1, 5).map((url, index) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setViewingImageUrl(url)}
                        className="relative aspect-square overflow-hidden rounded-lg border border-border"
                      >
                        <Image
                          src={url}
                          alt={`${detail.name} ${index + 2}`}
                          fill
                          sizes="52px"
                          unoptimized
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid content-start gap-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <PetDetailField
                    label="Loài"
                    value={formatSpecies(detail.species)}
                  />
                  <PetDetailField label="Giống" value={detail.breed} />
                  <PetDetailField
                    label="Giới tính"
                    value={formatGender(detail.gender)}
                  />
                  <PetDetailField
                    label="Ngày sinh"
                    value={formatDateValue(detail.birthday)}
                  />
                  <PetDetailField
                    label="Cân nặng"
                    value={detail.weight != null ? `${detail.weight} kg` : "-"}
                  />
                  <PetDetailField
                    label="Khu vực"
                    value={
                      [detail.ward, detail.district, detail.location]
                        .filter(Boolean)
                        .join(", ") || "-"
                    }
                  />
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Chủ sở hữu
                  </p>
                  <p className="mt-2 font-black text-foreground">
                    {detail.owner?.name ?? "-"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    {detail.owner?.email ?? "-"}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Tài khoản chủ
                      </p>
                      <StatusBadge
                        status={detail.owner?.accountStatus}
                        label={formatStatus(detail.owner?.accountStatus)}
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Hồ sơ thú cưng
                      </p>
                      <StatusBadge
                        status={detail.status}
                        label={formatStatus(detail.status)}
                      />
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        Xác minh giấy tờ
                      </p>
                      <StatusBadge
                        status={detail.verificationBadge}
                        label={formatStatus(detail.verificationBadge)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-primary">
                    Giấy tờ xác minh
                  </p>
                  <h3 className="mt-1 text-lg font-black text-foreground">
                    {documents.length} giấy tờ trong hồ sơ
                  </h3>
                </div>
                <span className="text-xs font-bold text-muted-foreground">
                  {
                    documents.filter((document) =>
                      ["PENDING", "REVIEWING"].includes(document.status),
                    ).length
                  }{" "}
                  giấy tờ đang chờ duyệt
                </span>
              </div>

              {documents.length ? (
                <div className="grid gap-3">
                  {documents.map((document) => {
                    const canReview = ["PENDING", "REVIEWING"].includes(
                      document.status,
                    );
                    const activeReview =
                      reviewIntent?.documentId === document.id
                        ? reviewIntent
                        : null;
                    return (
                      <article
                        key={document.id}
                        className="rounded-xl border border-border p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-black text-foreground">
                                {document.title ||
                                  formatDocumentType(document.type)}
                              </h4>
                              <StatusBadge status={document.status} />
                            </div>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                              Gửi ngày {formatDateValue(document.createdAt)}
                            </p>
                          </div>
                          {canReview && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  beginReview(document.id, "APPROVED")
                                }
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="size-4" /> Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  beginReview(document.id, "NEED_MORE_INFO")
                                }
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-800 hover:bg-amber-100"
                              >
                                <ShieldAlert className="size-4" /> Yêu cầu bổ
                                sung
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  beginReview(document.id, "REJECTED")
                                }
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100"
                              >
                                <XCircle className="size-4" /> Từ chối
                              </button>
                            </div>
                          )}
                        </div>

                        {activeReview && (
                          <div
                            className={`mt-3 rounded-lg border px-3 py-2.5 ${activeReview.status === "APPROVED" ? "border-emerald-200 bg-emerald-50/70" : activeReview.status === "REJECTED" ? "border-red-200 bg-red-50/70" : "border-amber-200 bg-amber-50/70"}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-foreground">
                                  {activeReview.status === "APPROVED"
                                    ? "Xác nhận duyệt giấy tờ này?"
                                    : activeReview.status === "REJECTED"
                                      ? "Nhập lý do từ chối giấy tờ này"
                                      : "Nhập thông tin người dùng cần bổ sung"}
                                </p>
                                <p
                                  className="mt-0.5 truncate text-xs font-semibold text-muted-foreground"
                                  title={
                                    document.title ||
                                    formatDocumentType(document.type)
                                  }
                                >
                                  {document.title ||
                                    formatDocumentType(document.type)}{" "}
                                  · {detail.name}
                                </p>
                                {activeReview.status !== "APPROVED" && (
                                  <textarea
                                    autoFocus
                                    maxLength={1000}
                                    rows={2}
                                    value={reviewNote}
                                    onChange={(event) =>
                                      setReviewNote(event.target.value)
                                    }
                                    placeholder={
                                      activeReview.status === "REJECTED"
                                        ? "Nêu rõ lý do từ chối..."
                                        : "Nêu rõ nội dung cần bổ sung..."
                                    }
                                    className="mt-2 w-full resize-none rounded-lg border border-border bg-background p-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                                  />
                                )}
                                {error && (
                                  <p className="mt-1.5 text-xs font-bold text-red-700">
                                    {error}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewIntent(null);
                                    setError("");
                                  }}
                                  disabled={saving}
                                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-black text-foreground/75 disabled:opacity-50"
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  onClick={submitReview}
                                  disabled={
                                    saving ||
                                    (activeReview.status !== "APPROVED" &&
                                      !reviewNote.trim())
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-50 ${activeReview.status === "REJECTED" ? "bg-red-600" : activeReview.status === "NEED_MORE_INFO" ? "bg-amber-600" : "bg-emerald-600"}`}
                                >
                                  {saving && (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  )}
                                  {activeReview.status === "APPROVED"
                                    ? "Xác nhận"
                                    : activeReview.status === "REJECTED"
                                      ? "Từ chối"
                                      : "Gửi yêu cầu"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-4">
                          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                            Ảnh giấy tờ người dùng đã gửi
                          </p>
                          <DocumentImageGallery
                            imageUrls={document.imageUrls ?? []}
                            documentTitle={
                              document.title ||
                              formatDocumentType(document.type)
                            }
                          />
                        </div>
                        <div className="mt-4 grid gap-2 rounded-lg bg-muted/30 p-3 text-sm font-semibold text-foreground/75">
                          <p>
                            <span className="font-black text-foreground">
                              Ghi chú người dùng:
                            </span>{" "}
                            {document.userNote || "-"}
                          </p>
                          {document.reviewNote && (
                            <p>
                              <span className="font-black text-foreground">
                                Phản hồi Admin:
                              </span>{" "}
                              {document.reviewNote}
                            </p>
                          )}
                          {document.reviewerName && (
                            <p className="text-xs">
                              Xử lý bởi {document.reviewerName} ·{" "}
                              {formatDateValue(document.reviewedAt)}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm font-semibold text-muted-foreground">
                  Thú cưng này chưa gửi giấy tờ xác minh.
                </div>
              )}
            </section>

            {error && !reviewIntent && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="p-6">
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </p>
          </div>
        )}
      </DialogContent>
      <ImageLightbox
        imageUrl={viewingImageUrl}
        alt={`Ảnh của ${detail?.name ?? pet.name}`}
        onClose={() => setViewingImageUrl(null)}
      />
    </Dialog>
  );
}

function PetDetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-black text-foreground">{value}</div>
    </div>
  );
}

function DocumentImageGallery({
  imageUrls,
  documentTitle,
}: {
  imageUrls: string[];
  documentTitle: string;
}) {
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
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm transition hover:border-primary hover:shadow-md focus:outline-none focus:ring-4 focus:ring-primary/15"
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
      <ImageLightbox
        imageUrl={viewingImageUrl}
        alt={documentTitle}
        onClose={() => setViewingImageUrl(null)}
      />
    </>
  );
}
