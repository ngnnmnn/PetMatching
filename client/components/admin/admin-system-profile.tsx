"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/admin";
import { getAdminErrorMessage, type AdminRow as Row } from "@/components/admin/admin-section-utils";

export function SystemProfileForm({
  profile,
  onSaved,
}: {
  profile?: Row;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    name: profile?.name ?? "PetMatching",
    description: profile?.description ?? "",
    address: profile?.address ?? "",
    phone: profile?.phone ?? "",
  }));
  const [saving, setSaving] = useState(false);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
    };
    if (!data.name || !data.address || !data.phone) {
      toast.error("Vui lòng nhập tên, địa chỉ và số điện thoại.");
      return;
    }

    setSaving(true);
    try {
      await adminApi.updateSystemProfile(data);
      toast.success("Đã cập nhật thông tin hệ thống.");
      onSaved();
    } catch (error: unknown) {
      toast.error(
        getAdminErrorMessage(error, "Không thể cập nhật thông tin hệ thống."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 p-6">
      <div className="border-b border-border pb-5">
        <h3 className="text-base font-black text-foreground">
          Thông tin thương hiệu
        </h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
          Cập nhật thông tin chính thức để khách hàng nhận diện và liên hệ với
          PetMatching.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <StoreField
          label="Tên thương hiệu"
          required
          value={form.name}
          onChange={(value) => update("name", value)}
        />
        <StoreField
          label="Số điện thoại liên hệ"
          required
          value={form.phone}
          onChange={(value) => update("phone", value)}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <StoreField
          label="Email liên hệ"
          type="email"
          readOnly
          value="petmatch@fpt.edu.vn"
        />
        <StoreField
          label="Địa chỉ liên hệ"
          required
          value={form.address}
          onChange={(value) => update("address", value)}
        />
      </div>
      <label className="grid gap-2 text-sm font-black text-foreground">
        Giới thiệu thương hiệu
        <textarea
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
          rows={4}
          className="resize-none rounded-lg border border-border bg-background p-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>
      <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold text-muted-foreground">
          Các thay đổi sẽ được đồng bộ tại những khu vực hiển thị liên quan.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Lưu thay đổi
        </button>
      </div>
    </form>
  );
}

function StoreField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  required?: boolean;
  type?: "text" | "email" | "tel";
  readOnly?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-foreground">
      <span>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-11 rounded-lg border border-border bg-background px-3 text-sm font-semibold outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 read-only:cursor-default read-only:bg-muted/30 read-only:text-muted-foreground read-only:focus:border-border read-only:focus:ring-0"
      />
    </label>
  );
}

