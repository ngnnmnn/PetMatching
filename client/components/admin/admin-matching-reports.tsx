"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, CheckCircle2, Loader2, Search } from "lucide-react";
import { AdminFilterSelect } from "@/components/admin/admin-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ComplaintAction, ModerateReportAbusePayload, ResolveMatchingReportPayload } from "@/lib/api/admin";
import {
  formatComplaintAction,
  formatComplaintTarget,
  formatMatchingReportConclusion,
  formatMatchingReportReason,
  type AdminRow as Row,
} from "@/components/admin/admin-section-utils";

type ReuploadDocumentType = "VACCINE_RECORD" | "PEDIGREE_CERT";

const complaintTargetOptions = [
  ["ALL", "Tất cả đối tượng"],
  ["PET", "Thú cưng"],
  ["USER", "Người dùng"],
] as const;

const complaintStatusOptions = [
  ["ALL", "Tất cả trạng thái"],
  ["PENDING", "Chờ xử lý"],
  ["RESOLVED", "Có vi phạm"],
  ["DISMISSED", "Không vi phạm"],
  ["INSUFFICIENT_EVIDENCE", "Chưa đủ bằng chứng"],
] as const;

export function MatchingReportDialog({
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
  onModerateReporter: (payload: ModerateReportAbusePayload) => Promise<void>;
}) {
  const initialAction: ComplaintAction =
    report?.resolutionOptions?.RESOLVED?.[0] ?? "RESOLVE";
  const [resolutionStatus, setResolutionStatus] =
    useState<ResolveMatchingReportPayload["status"]>("RESOLVED");
  const [action, setAction] = useState<ComplaintAction>(initialAction);
  const [adminNote, setAdminNote] = useState("");
  const [resolutionMessage, setResolutionMessage] = useState(
    () => report?.resolutionMessageTemplates?.RESOLVED?.[initialAction] ?? "",
  );
  const [documentTypes, setDocumentTypes] = useState<ReuploadDocumentType[]>(
    [],
  );
  const messages = report?.match?.messages ?? [];
  const reporterActivity = report?.reporterActivity;
  const isTerminal = Boolean(
    report &&
    ["RESOLVED", "DISMISSED", "INSUFFICIENT_EVIDENCE"].includes(report.status),
  );
  const isViolationConclusion = resolutionStatus === "RESOLVED";
  const availableActions: ComplaintAction[] = isViolationConclusion
    ? (report?.resolutionOptions?.RESOLVED ?? [])
    : ["DISMISS", "RESOLVE"];
  const isPetDocumentRequest =
    report?.targetType === "PET" &&
    resolutionStatus === "INSUFFICIENT_EVIDENCE" &&
    action === "RESOLVE";

  const changeConclusion = (conclusion: "RESOLVED" | "NOT_CONFIRMED") => {
    const nextStatus: ResolveMatchingReportPayload["status"] =
      conclusion === "RESOLVED" ? "RESOLVED" : "DISMISSED";
    const nextAction: ComplaintAction =
      conclusion === "RESOLVED"
        ? (report?.resolutionOptions?.RESOLVED?.[0] ?? "WARNING")
        : "DISMISS";
    setResolutionStatus(nextStatus);
    setAction(nextAction);
    setResolutionMessage(
      report?.resolutionMessageTemplates?.[nextStatus]?.[nextAction] ?? "",
    );
  };

  const changeAction = (nextAction: ComplaintAction) => {
    const nextStatus: ResolveMatchingReportPayload["status"] =
      isViolationConclusion
        ? "RESOLVED"
        : nextAction === "DISMISS"
          ? "DISMISSED"
          : "INSUFFICIENT_EVIDENCE";
    setResolutionStatus(nextStatus);
    setAction(nextAction);
    setResolutionMessage(
      report?.resolutionMessageTemplates?.[nextStatus]?.[nextAction] ?? "",
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
              <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Nội dung phản ánh
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p>
                    <span className="font-black">Người phản ánh:</span>{" "}
                    {report.reporter?.name ?? report.userId}
                  </p>
                  <p>
                    <span className="font-black">Bên bị phản ánh:</span>{" "}
                    {report.reportedUser?.name ?? report.reportedUserId ?? "-"}
                  </p>
                  <p>
                    <span className="font-black">Đối tượng:</span>{" "}
                    {formatComplaintTarget(report.targetType)} —{" "}
                    {report.targetType === "PET"
                      ? (report.pet?.name ?? report.petId)
                      : (report.reportedUser?.name ??
                        report.reportedUserId ??
                        "-")}
                  </p>
                  <p>
                    <span className="font-black">Gửi lúc:</span>{" "}
                    {new Date(report.createdAt).toLocaleString("vi-VN")}
                  </p>
                  <p>
                    <span className="font-black">Lý do:</span>{" "}
                    {formatMatchingReportReason(report.reason)}
                  </p>
                </div>
                <div className="mt-4 rounded-lg border border-border bg-background p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Mô tả của người phản ánh
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words font-semibold text-foreground/85">
                    {report.detail || "Không cung cấp mô tả."}
                  </p>
                </div>
                {isTerminal && (
                  <div className="mt-4 grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 sm:grid-cols-2">
                    <p>
                      <span className="font-black">Kết luận:</span>{" "}
                      {formatMatchingReportConclusion(report.status)}
                    </p>
                    <p>
                      <span className="font-black">Biện pháp:</span>{" "}
                      {formatComplaintAction(report.actionTaken)}
                    </p>
                    <p>
                      <span className="font-black">Người xử lý:</span>{" "}
                      {report.resolver?.name ?? "-"}
                    </p>
                    <p>
                      <span className="font-black">Xử lý lúc:</span>{" "}
                      {report.resolvedAt
                        ? new Date(report.resolvedAt).toLocaleString("vi-VN")
                        : "-"}
                    </p>
                    <p className="sm:col-span-2">
                      <span className="font-black">Ghi chú nội bộ:</span>{" "}
                      {report.adminNote ?? "-"}
                    </p>
                    <p className="sm:col-span-2">
                      <span className="font-black">Phản hồi đã gửi:</span>{" "}
                      {report.resolutionMessage ?? "-"}
                    </p>
                  </div>
                )}
              </div>
              {reporterActivity && reporterActivity.level !== "NORMAL" && (
                <div
                  className={`rounded-xl border p-4 text-sm ${
                    reporterActivity.level === "SUSPECTED_SPAM"
                      ? "border-red-200 bg-red-50 text-red-950"
                      : "border-amber-200 bg-amber-50 text-amber-950"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-black">
                        {reporterActivity.level === "SUSPECTED_SPAM"
                          ? "Có dấu hiệu spam phản ánh"
                          : "Tần suất phản ánh cao"}
                      </p>
                      <p className="mt-1 font-medium">
                        {reporterActivity.level === "SUSPECTED_SPAM"
                          ? `Đã gửi ${reporterActivity.reportsLast7Days} phản ánh trong 7 ngày gần nhất.`
                          : `Đã gửi ${reporterActivity.reportsLast24Hours} phản ánh trong 24 giờ gần nhất.`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-current/15 pt-4">
                    <p className="font-black">Xử lý người gửi phản ánh</p>
                    {report.reporter?.accountStatus === "SUSPENDED" ? (
                      <p className="mt-2 rounded-lg bg-red-100 p-3 font-bold text-red-800">
                        Tài khoản này hiện đang bị khóa.
                      </p>
                    ) : reporterActivity.level === "HIGH_FREQUENCY" ? (
                      <button
                        type="button"
                        disabled={moderatingReporter}
                        onClick={() =>
                          onModerateReporter({ action: "WARNING" })
                        }
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-background px-3 py-2 font-black text-amber-800 disabled:opacity-60"
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
                              "Khóa tài khoản này do có dấu hiệu spam phản ánh?",
                            )
                          ) {
                            onModerateReporter({ action: "BLOCK" });
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
                <h3 className="mb-1 text-sm font-black text-foreground">
                  Ngữ cảnh cuộc trò chuyện
                </h3>
                <p className="mb-3 text-xs font-semibold text-muted-foreground">
                  Hiển thị tối đa 30 tin nhắn gần thời điểm gửi phản ánh.
                </p>
                <div className="grid min-h-32 max-h-64 content-start gap-3 overflow-y-auto overscroll-contain rounded-xl border p-3 pr-2">
                  {messages.map((message: Row) => (
                    <div
                      key={message.id}
                      className="rounded-lg bg-muted/30 p-3 text-sm"
                    >
                      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                        <span className="font-black text-foreground/85">
                          {message.sender?.name ?? message.senderId}{" "}
                          <span className="font-bold text-primary">
                            {message.senderId === report.reporter?.id
                              ? "· Người phản ánh"
                              : message.senderId === report.reportedUser?.id
                                ? "· Bên bị phản ánh"
                                : ""}
                          </span>
                        </span>
                        <span>
                          {new Date(message.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      {message.content && (
                        <p className="mt-2 whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      )}
                      {message.imageUrl && (
                        <a
                          href={message.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block"
                        >
                          <Image
                            src={message.imageUrl}
                            alt="Ảnh trong báo cáo"
                            width={640}
                            height={360}
                            unoptimized
                            className="max-h-64 w-auto rounded-lg border object-contain"
                          />
                        </a>
                      )}
                    </div>
                  ))}
                  {!messages.length && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Cuộc ghép đôi không có tin nhắn.
                    </p>
                  )}
                </div>
              </div>
              {!isTerminal && (
                <div className="space-y-4 border-t bg-background pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm font-bold">
                      <span>Kết luận xử lý</span>
                      <select
                        value={
                          isViolationConclusion ? "RESOLVED" : "NOT_CONFIRMED"
                        }
                        onChange={(event) =>
                          changeConclusion(
                            event.target.value as "RESOLVED" | "NOT_CONFIRMED",
                          )
                        }
                        className="h-10 w-full rounded-lg border bg-background px-3"
                      >
                        <option value="RESOLVED">Xác nhận có vi phạm</option>
                        <option value="NOT_CONFIRMED">
                          Chưa xác nhận có vi phạm
                        </option>
                      </select>
                    </label>
                    <label className="space-y-2 text-sm font-bold">
                      <span>Biện pháp áp dụng</span>
                      <select
                        value={action}
                        onChange={(event) =>
                          changeAction(event.target.value as ComplaintAction)
                        }
                        className="h-10 w-full rounded-lg border bg-background px-3"
                      >
                        {availableActions.map((value) => (
                          <option key={value} value={value}>
                            {value === "RESOLVE" && report.targetType === "PET"
                              ? "Yêu cầu tải lại giấy tờ"
                              : formatComplaintAction(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {isPetDocumentRequest && (
                    <fieldset className="rounded-xl border bg-muted/20 p-4">
                      <legend className="px-1 text-sm font-black">
                        Giấy tờ cần tải lại
                      </legend>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm font-bold">
                        {(
                          [
                            ["VACCINE_RECORD", "Sổ tiêm phòng"],
                            ["PEDIGREE_CERT", "Giấy chứng nhận phả hệ"],
                          ] as const
                        ).map(([value, label]) => (
                          <label
                            key={value}
                            className="flex items-center gap-2"
                          >
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
                      className="w-full resize-none rounded-lg border bg-background p-3 font-medium"
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
                      className="w-full resize-none rounded-lg border bg-background p-3 font-medium"
                    />
                    <span className="block text-xs font-medium text-muted-foreground">
                      Nội dung được tạo sẵn theo kết luận và biện pháp, có thể
                      chỉnh sửa trước khi gửi.
                    </span>
                  </label>
                </div>
              )}
            </div>
            {!isTerminal && (
              <div className="flex shrink-0 justify-end border-t bg-background pt-4">
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
                  {resolving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
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

export function MatchingReportFilters({
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
    <div className="grid gap-3 border-b bg-card p-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_220px_220px]">
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Tìm kiếm
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tên, email, thú cưng hoặc lý do..."
            aria-label="Tìm kiếm phản ánh ghép đôi"
            className="pl-9"
          />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Đối tượng
        </p>
        <AdminFilterSelect
          ariaLabel="Lọc theo đối tượng"
          value={target}
          onChange={onTargetChange}
          options={complaintTargetOptions.map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Trạng thái
        </p>
        <AdminFilterSelect
          ariaLabel="Lọc theo trạng thái"
          value={status}
          onChange={onStatusChange}
          options={complaintStatusOptions.map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>
    </div>
  );
}

