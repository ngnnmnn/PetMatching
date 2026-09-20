"use client";

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock3,
  Layers3,
  PawPrint,
  Scissors,
  Search,
} from "lucide-react";
import { AdminFilterSelect } from "@/components/admin/shared/admin-ui";
import { AdminPagination } from "@/components/admin/shared/admin-section-components";
import {
  ADMIN_PAGE_SIZE,
  groupSpaServiceVariants,
  type AdminRow as Row,
} from "@/components/admin/shared/admin-section-utils";
import { Input } from "@/components/ui/input";
import {
  computeServiceDisplayRanges,
  formatWeightRange,
  getServiceBracketsForSpecies,
  parseArrayField,
  type SpaWeightBracket,
} from "@/lib/spa-bracket.utils";

type SpaBracketRow = SpaWeightBracket & {
  key: string;
  species: "DOG" | "CAT" | "ALL";
  speciesLabel: string;
  isActive: boolean;
};

const spaMoney = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

/**
 * Chuyển cấu hình JSON cân nặng của một dịch vụ thành các dòng dễ đọc cho Admin.
 * Dữ liệu hai chiều được tách riêng theo Chó/Mèo, còn cấu hình dùng chung chỉ hiển thị một lần.
 */
function buildSpaBracketRows(service: Row): SpaBracketRow[] {
  const minimums = parseArrayField(service.petMinWeight);
  const separatesSpecies = Array.isArray(minimums[0]);
  const normalizedSpecies =
    service.species === "DOG" || service.species === "CAT"
      ? service.species
      : "ALL";
  const targets: Array<"DOG" | "CAT" | "ALL"> = separatesSpecies
    ? ["DOG", "CAT"]
    : [normalizedSpecies];

  return targets.flatMap((species) => {
    const targetSpecies = species === "ALL" ? "DOG" : species;
    const speciesLabel =
      species === "DOG" ? "Chó" : species === "CAT" ? "Mèo" : "Chó & mèo";

    return getServiceBracketsForSpecies(service, targetSpecies).map(
      (bracket, index) => ({
        ...bracket,
        key: `${service.id}-${species}-${index}`,
        species,
        speciesLabel,
        isActive: service.isActive !== false,
      }),
    );
  });
}

/**
 * Tổng hợp khoảng giá, thời lượng, lượt đặt và cấu hình cân nặng của một nhóm dịch vụ.
 */
function summarizeSpaServiceGroup(variants: Row[]) {
  const ranges = variants.map((service) => computeServiceDisplayRanges(service));
  const bracketRows = variants.flatMap(buildSpaBracketRows);
  const minPrice = Math.min(...ranges.map((range) => range.minPrice));
  const maxPrice = Math.max(...ranges.map((range) => range.maxPrice));
  const minDuration = Math.min(...ranges.map((range) => range.minDuration));
  const maxDuration = Math.max(...ranges.map((range) => range.maxDuration));
  const activeCount = variants.filter((service) => service.isActive !== false).length;

  return {
    bracketRows,
    minPrice,
    maxPrice,
    minDuration,
    maxDuration,
    activeCount,
    totalBookings: variants.reduce(
      (sum, service) => sum + Number(service._count?.bookings ?? 0),
      0,
    ),
  };
}

/**
 * Hiển thị danh mục dịch vụ Spa cho Admin theo đúng cấu trúc mảng cân nặng mới của Manager.
 * Màn hình chỉ đọc, hỗ trợ tìm kiếm, lọc, xem khoảng giá và mở chi tiết từng mốc cấu hình.
 */
export function SpaServicesPanel({ services }: { services: Row[] }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [currentPage, setCurrentPage] = useState(1);

  const groups = useMemo(
    () =>
      groupSpaServiceVariants(services).map((group) => {
        const primary = group.variants[0];
        const summary = summarizeSpaServiceGroup(group.variants);
        return {
          ...group,
          ...summary,
          categoryId: primary.categoryId ?? primary.category?.id ?? "UNCATEGORIZED",
          categoryName: primary.category?.name ?? "Chưa phân loại",
          description:
            group.variants.find((service) => service.description)?.description ?? "",
          imageUrl:
            group.variants.find((service) => service.imageUrl)?.imageUrl ?? null,
          isMain: primary.isMain !== false,
        };
      }),
    [services],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          groups.map((group) => [
            group.categoryId,
            { value: group.categoryId, label: group.categoryName },
          ]),
        ).values(),
      ).sort((left, right) => left.label.localeCompare(right.label, "vi")),
    [groups],
  );

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return groups.filter((group) => {
      const matchesQuery =
        !normalizedQuery ||
        [group.name, group.categoryName, group.description].some((value) =>
          String(value ?? "").toLocaleLowerCase("vi").includes(normalizedQuery),
        );
      const matchesType =
        typeFilter === "ALL" ||
        (typeFilter === "MAIN" ? group.isMain : !group.isMain);
      const matchesCategory =
        categoryFilter === "ALL" || group.categoryId === categoryFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE"
          ? group.activeCount > 0
          : group.activeCount === 0);
      return matchesQuery && matchesType && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, groups, query, statusFilter, typeFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredGroups.length / ADMIN_PAGE_SIZE),
  );
  const activePage = Math.min(currentPage, totalPages);
  const paginatedGroups = filteredGroups.slice(
    (activePage - 1) * ADMIN_PAGE_SIZE,
    activePage * ADMIN_PAGE_SIZE,
  );

  return (
    <div>
      <div className="grid gap-3 border-b bg-card p-4 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_190px_210px_190px] xl:items-center">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm tên, danh mục hoặc mô tả dịch vụ..."
            className="h-10 rounded-xl pl-9 font-semibold"
          />
        </label>
        <AdminFilterSelect
          ariaLabel="Lọc theo loại dịch vụ Spa"
          value={typeFilter}
          onChange={(value) => {
            setTypeFilter(value);
            setCurrentPage(1);
          }}
          options={[
            { value: "ALL", label: "Tất cả phân loại" },
            { value: "MAIN", label: "Dịch vụ chính" },
            { value: "SUB", label: "Dịch vụ lẻ" },
          ]}
        />
        <AdminFilterSelect
          ariaLabel="Lọc theo danh mục dịch vụ Spa"
          value={categoryFilter}
          onChange={(value) => {
            setCategoryFilter(value);
            setCurrentPage(1);
          }}
          options={[
            { value: "ALL", label: "Tất cả danh mục" },
            ...categories,
          ]}
        />
        <AdminFilterSelect
          ariaLabel="Lọc theo trạng thái dịch vụ Spa"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setCurrentPage(1);
          }}
          options={[
            { value: "ALL", label: "Tất cả trạng thái" },
            { value: "ACTIVE", label: "Đang hoạt động" },
            { value: "INACTIVE", label: "Tạm ngừng" },
          ]}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[16%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className="bg-muted/30">
            <tr>
              {[
                "Dịch vụ",
                "Đối tượng",
                "Thời lượng",
                "Khoảng giá",
                "Lượt đặt",
                "Trạng thái",
                "Cấu hình",
              ].map((label, index) => (
                <th
                  key={label}
                  className={`px-4 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground ${index >= 2 ? "text-center" : ""}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedGroups.map((group) => {
              const isExpanded = Boolean(expandedGroups[group.key]);
              const priceLabel =
                group.minPrice === group.maxPrice
                  ? spaMoney.format(group.minPrice)
                  : `${spaMoney.format(group.minPrice)} – ${spaMoney.format(group.maxPrice)}`;
              const durationLabel =
                group.minDuration === group.maxDuration
                  ? `${group.minDuration} phút`
                  : `${group.minDuration} – ${group.maxDuration} phút`;
              const species = Array.from(
                new Map(
                  group.bracketRows.map((row) => [row.species, row.speciesLabel]),
                ).values(),
              );

              return (
                <Fragment key={group.key}>
                  <tr className="group transition hover:bg-primary/[0.035]">
                    <td className="px-4 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/10 bg-primary/5 shadow-sm">
                          {group.imageUrl ? (
                            <Image
                              src={group.imageUrl}
                              alt=""
                              fill
                              sizes="48px"
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <Scissors className="size-5 text-primary/70" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-foreground" title={group.name}>
                            {group.name}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${group.isMain ? "bg-primary/10 text-primary" : "bg-violet-50 text-violet-700"}`}>
                              {group.isMain ? "Dịch vụ chính" : "Dịch vụ lẻ"}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                              {group.categoryName}
                            </span>
                          </div>
                          {group.description && (
                            <p className="mt-1.5 truncate text-xs font-medium text-muted-foreground" title={group.description}>
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col items-start gap-1.5">
                        {species.map((label) => (
                          <span key={label} className="inline-flex whitespace-nowrap items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
                            <PawPrint className="size-3" /> {label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className="inline-flex whitespace-nowrap items-center gap-1.5 text-[13px] font-bold text-foreground/75">
                        <Clock3 className="size-3.5 shrink-0 text-muted-foreground" />
                        {durationLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <p className="whitespace-nowrap text-[13px] font-black text-primary">
                        {priceLabel}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className="inline-flex min-w-14 whitespace-nowrap justify-center rounded-xl bg-violet-50 px-2 py-1.5 text-[13px] font-black text-violet-700">
                        {group.totalBookings} lượt
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-black ${group.activeCount > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />
                        {group.activeCount > 0
                          ? `Đang mở${group.variants.length > 1 ? ` ${group.activeCount}/${group.variants.length}` : ""}`
                          : "Tạm ngừng"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGroups((current) => ({
                            ...current,
                            [group.key]: !current[group.key],
                          }))
                        }
                        className="inline-flex whitespace-nowrap items-center gap-1 rounded-xl border border-primary/20 bg-background px-2.5 py-2 text-[11px] font-black text-primary transition hover:border-primary/40 hover:bg-primary/5"
                        aria-expanded={isExpanded}
                      >
                        <Layers3 className="size-3.5 shrink-0" />
                        {group.bracketRows.length} mốc
                        {isExpanded ? (
                          <ChevronDown className="size-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="bg-muted/20 px-5 py-4">
                        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wider text-foreground">
                                Cấu hình cân nặng · {group.name}
                              </p>
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                Giá và thời lượng đang áp dụng cho từng đối tượng.
                              </p>
                            </div>
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
                              {group.bracketRows.length} mốc cấu hình
                            </span>
                          </div>
                          <table className="w-full min-w-[720px] text-left">
                            <thead className="bg-muted/25">
                              <tr>
                                {["Đối tượng", "Khoảng cân nặng", "Thời lượng", "Đơn giá", "Trạng thái"].map((label) => (
                                  <th key={label} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {group.bracketRows.map((bracket) => (
                                <tr key={bracket.key} className="hover:bg-muted/15">
                                  <td className="px-4 py-3 text-xs font-black text-foreground">
                                    {bracket.speciesLabel}
                                  </td>
                                  <td className="px-4 py-3 text-xs font-bold text-foreground/75">
                                    {formatWeightRange(bracket.minWeight, bracket.maxWeight)}
                                  </td>
                                  <td className="px-4 py-3 text-xs font-bold text-foreground/75">
                                    {bracket.duration} phút
                                  </td>
                                  <td className="px-4 py-3 text-xs font-black text-primary">
                                    {spaMoney.format(bracket.price)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-black ${bracket.isActive ? "text-emerald-700" : "text-slate-500"}`}>
                                      <span className="size-1.5 rounded-full bg-current" />
                                      {bracket.isActive ? "Đang áp dụng" : "Tạm ngừng"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {!filteredGroups.length && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <AlertTriangle className="mx-auto size-7 text-muted-foreground/70" />
                  <p className="mt-3 text-sm font-bold text-muted-foreground">
                    Không tìm thấy dịch vụ Spa phù hợp.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        currentPage={activePage}
        totalItems={filteredGroups.length}
        onPageChange={setCurrentPage}
        itemLabel="nhóm dịch vụ"
      />
    </div>
  );
}
