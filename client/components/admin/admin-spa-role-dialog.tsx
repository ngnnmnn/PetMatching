"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/admin";
import { getAdminErrorMessage, type AdminRow as Row } from "@/components/admin/admin-section-utils";

export type SpaManagerRoleFlow = {
  mode: "GRANT" | "REVOKE";
  user: Row;
};

export function SpaManagerRoleDialog({
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
  const [revokeMode, setRevokeMode] = useState<"UNASSIGN" | "TRANSFER">(
    "UNASSIGN",
  );
  const [newManagerId, setNewManagerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .spas()
      .then((response) => {
        const spas = Array.isArray(response.data)
          ? response.data.slice(0, 1)
          : [];
        setSpa(spas[0] ?? null);
      })
      .catch(() => setError("Không thể tải thông tin Spa."))
      .finally(() => setLoading(false));
  }, []);

  const managesSpa = spa?.managerId === flow.user.id;
  const replacementManagers = users.filter(
    (user) =>
      user.id !== flow.user.id &&
      ["USER", "SPA_MANAGER"].includes(user.role) &&
      user.accountStatus === "ACTIVE",
  );
  const isReassignment = Boolean(
    spa?.managerId && spa.managerId !== flow.user.id,
  );

  const submit = async () => {
    setError("");

    if (flow.mode === "GRANT" && !spa) {
      setError("Chưa cấu hình thông tin Spa.");
      return;
    }

    if (flow.mode === "REVOKE" && revokeMode === "TRANSFER" && !newManagerId) {
      setError("Vui lòng chọn Spa Manager nhận chuyển giao.");
      return;
    }

    setSaving(true);
    try {
      if (flow.mode === "GRANT") {
        await adminApi.grantSpaManager(flow.user.id, isReassignment);
        toast.success("Đã cấp quyền quản lý Spa.");
      } else {
        await adminApi.revokeSpaManager(
          flow.user.id,
          revokeMode,
          newManagerId || undefined,
        );
        toast.success(
          revokeMode === "TRANSFER"
            ? "Đã thu hồi quyền và bàn giao Spa."
            : "Đã thu hồi quyền Spa Manager.",
        );
      }
      onSuccess();
    } catch (error: unknown) {
      setError(
        getAdminErrorMessage(error, "Không thể cập nhật quyền Spa Manager."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/55 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
        <div className="border-b border-border px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-primary">
            Quản lý phân quyền Spa
          </p>
          <h3 className="mt-1 text-2xl font-black text-foreground">
            {flow.mode === "GRANT"
              ? "Cấp quyền quản lý Spa"
              : "Thu hồi quyền quản lý Spa"}
          </h3>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {flow.user.name} · {flow.user.email}
          </p>
        </div>

        <div className="grid gap-5 p-6">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="size-7 animate-spin text-primary" />
            </div>
          ) : flow.mode === "GRANT" ? (
            <>
              <div>
                <p className="text-sm font-black text-foreground">
                  Spa được phân công
                </p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  Hệ thống chỉ có một Spa và sẽ tự động phân công.
                </p>
              </div>
              <div className="grid gap-3">
                {spa && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <span className="min-w-0">
                      <span className="block font-black text-foreground">
                        {spa.name}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                        {spa.address}
                      </span>
                      {isReassignment && (
                        <span className="mt-2 block text-xs font-black text-amber-700">
                          Đang do {spa.manager?.name ?? "một Manager khác"} quản
                          lý; thao tác này sẽ chuyển quyền.
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
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-black text-foreground">
                  Spa đang quản lý
                </p>
                {managesSpa ? (
                  <p className="mt-2 text-sm font-semibold text-foreground/75">
                    • {spa?.name}
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-muted-foreground">
                    Tài khoản chưa được phân công Spa.
                  </p>
                )}
              </div>

              <label className="flex cursor-pointer gap-3 rounded-xl border border-border p-4">
                <input
                  type="radio"
                  name="revokeMode"
                  checked={revokeMode === "UNASSIGN"}
                  onChange={() => setRevokeMode("UNASSIGN")}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block font-black text-foreground">
                    Bỏ phân công
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                    Spa sẽ tạm thời chưa có Manager.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer gap-3 rounded-xl border border-border p-4">
                <input
                  type="radio"
                  name="revokeMode"
                  checked={revokeMode === "TRANSFER"}
                  onChange={() => setRevokeMode("TRANSFER")}
                  disabled={!replacementManagers.length}
                  className="mt-1 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-foreground">
                    Chuyển giao cho Manager khác
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                    Bàn giao Spa trước khi thu hồi quyền.
                  </span>
                  {revokeMode === "TRANSFER" && (
                    <select
                      value={newManagerId}
                      onChange={(event) => setNewManagerId(event.target.value)}
                      className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
                    >
                      <option value="">Chọn người nhận chuyển giao</option>
                      {replacementManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} · {manager.email}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              </label>
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
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {flow.mode === "GRANT"
              ? isReassignment
                ? "Chuyển quyền & cấp Manager"
                : "Cấp quyền Spa Manager"
              : revokeMode === "TRANSFER"
                ? "Thu hồi & chuyển giao"
                : "Thu hồi quyền"}
          </button>
        </div>
      </div>
    </div>
  );
}

