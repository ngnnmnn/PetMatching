"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/admin";
import { getAdminErrorMessage, type AdminRow as Row } from "@/components/admin/admin-section-utils";
import { AddressAutocompleteInput } from "@/components/checkout/AddressAutocompleteInput";

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
    latitude: typeof profile?.latitude === "number" ? profile.latitude : null,
    longitude: typeof profile?.longitude === "number" ? profile.longitude : null,
    phone: profile?.phone ?? "",
  }));
  const [saving, setSaving] = useState(false);

  // Cập nhật các trường văn bản của hồ sơ hệ thống mà không làm thay đổi tọa độ đã chọn.
  const update = (key: "name" | "description" | "address" | "phone", value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Chỉ lưu địa chỉ khi Admin đã chọn một kết quả OpenStreetMap có tọa độ hợp lệ.
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      latitude: form.latitude,
      longitude: form.longitude,
      phone: form.phone.trim(),
    };
    if (!data.name || !data.address || !data.phone) {
      toast.error("Vui lòng nhập tên, địa chỉ và số điện thoại.");
      return;
    }
    if (data.latitude == null || data.longitude == null) {
      toast.error("Vui lòng chọn địa chỉ từ danh sách gợi ý OpenStreetMap.");
      return;
    }

    setSaving(true);
    try {
      await adminApi.updateSystemProfile({
        ...data,
        latitude: data.latitude as number,
        longitude: data.longitude as number,
      });
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
        <AddressAutocompleteInput
          label="Địa chỉ liên hệ"
          required
          initialValue={form.address}
          onChangeText={(value) =>
            setForm((current) => ({
              ...current,
              address: value,
              latitude: value === current.address ? current.latitude : null,
              longitude: value === current.address ? current.longitude : null,
            }))
          }
          onSelectLocation={(location) =>
            setForm((current) => ({
              ...current,
              address: location.address,
              latitude: location.lat,
              longitude: location.lng,
            }))
          }
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

// Hiển thị trường nhập văn bản thống nhất cho các thông tin không phải địa chỉ bản đồ.
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

