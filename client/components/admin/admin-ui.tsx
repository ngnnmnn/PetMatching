"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AdminFilterOption = {
  value: string;
  label: string;
  count?: number;
};

export type AdminStatusMeta = Record<
  string,
  { label: string; className: string }
>;

export const ADMIN_PAYMENT_STATUS_META: AdminStatusMeta = {
  PAID: {
    label: "Đã thanh toán",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  PENDING: {
    label: "Chờ thanh toán",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  PAYMENT_ERROR: {
    label: "Thanh toán lỗi",
    className: "border-destructive/20 bg-destructive/5 text-destructive",
  },
  EXPIRED: {
    label: "Thanh toán hết hạn",
    className: "border-destructive/20 bg-destructive/5 text-destructive",
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  CANCELLED: {
    label: "Đã hủy thanh toán",
    className: "border-border bg-muted text-muted-foreground",
  },
  UNPAID: {
    label: "Chưa thanh toán",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function AdminFilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AdminFilterOption[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "h-10 w-full rounded-xl border-border bg-background px-3 text-sm font-semibold shadow-none",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="font-medium">
            <span className="flex w-full items-center justify-between gap-4">
              <span>{option.label}</span>
              {option.count !== undefined && (
                <span className="min-w-6 rounded-full bg-muted px-1.5 py-0.5 text-center text-[10px] font-bold text-muted-foreground">
                  {option.count.toLocaleString("vi-VN")}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const SUMMARY_TONES = {
  default: "border-border bg-card text-foreground",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-destructive/20 bg-destructive/5 text-destructive",
};

export function AdminSummaryCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: keyof typeof SUMMARY_TONES;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm",
        SUMMARY_TONES[tone],
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-background/80">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-xl font-semibold">{value}</span>
        <span className="block text-xs font-bold uppercase tracking-wide">{label}</span>
      </span>
    </button>
  );
}

export function AdminDetailSection({
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
      className={cn(
        "min-w-0 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5",
        wide && "lg:col-span-2",
      )}
    >
      <h3 className="mb-4 flex items-center gap-2.5 text-sm font-bold text-foreground">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function AdminDetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</div>;
}

export function AdminDetailField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-foreground/85">{value}</p>
    </div>
  );
}

export function AdminTextBlock({
  label,
  value,
  alert = false,
  wide = false,
}: {
  label: string;
  value?: string | null;
  alert?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "md:col-span-3" : undefined}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 whitespace-pre-wrap text-sm font-medium",
          alert ? "text-destructive" : "text-foreground/85",
        )}
      >
        {value || "Không có thông tin."}
      </p>
    </div>
  );
}

export function AdminStatusBadge({
  status,
  meta,
  fallback = "-",
  compact = false,
}: {
  status?: string | null;
  meta: AdminStatusMeta;
  fallback?: string;
  compact?: boolean;
}) {
  const presentation = meta[status ?? ""] ?? {
    label: status ?? fallback,
    className: "border-border bg-muted text-muted-foreground",
  };

  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap", compact && "mt-1 text-[10px]", presentation.className)}
    >
      {presentation.label}
    </Badge>
  );
}
