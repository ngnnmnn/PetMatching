"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, PackageOpen, Search } from "lucide-react";
import { AdminFilterSelect } from "@/components/admin/admin-ui";
import { Input } from "@/components/ui/input";
import { AdminPagination } from "@/components/admin/admin-section-components";
import {
  ADMIN_PAGE_SIZE,
  adminDateCell as dateCell,
  adminMoneyCell as moneyCell,
  formatCategory,
  formatSpaSpeciesLabel,
  formatSpaWeightOption,
  getSpaWeightDistance,
  getSpaWeightKey,
  getSpaWeightRepresentative,
  groupSpaServiceVariants,
  matchesSpaServiceWeight,
  type AdminRow as Row,
} from "@/components/admin/admin-section-utils";

export function SpaServicesPanel({ services }: { services: Row[] }) {
  const [weightRange, setWeightRange] = useState("LOWEST");
  const [currentPage, setCurrentPage] = useState(1);
  const groups = useMemo(() => groupSpaServiceVariants(services), [services]);

  const weightOptions = useMemo(() => {
    const ranges = new Map<
      string,
      { min: number | null; max: number | null }
    >();
    services.forEach((service) => {
      if (service.petWeightMin == null && service.petWeightMax == null) return;
      const key = getSpaWeightKey(service);
      if (!ranges.has(key)) {
        ranges.set(key, {
          min:
            service.petWeightMin == null ? null : Number(service.petWeightMin),
          max:
            service.petWeightMax == null ? null : Number(service.petWeightMax),
        });
      }
    });

    return Array.from(ranges.entries())
      .sort(
        ([, left], [, right]) =>
          (left.min ?? 0) - (right.min ?? 0) ||
          (left.max ?? Number.POSITIVE_INFINITY) -
            (right.max ?? Number.POSITIVE_INFINITY),
      )
      .map(([value, range]) => ({
        value,
        label: formatSpaWeightOption(range.min, range.max),
      }));
  }, [services]);

  const displayedGroups = useMemo(
    () =>
      groups.map((group) => {
        const activeVariants = group.variants.filter(
          (service) => service.isActive,
        );
        const selectableVariants = activeVariants.length
          ? activeVariants
          : group.variants;
        let selectableCandidates = selectableVariants;

        if (weightRange !== "LOWEST") {
          const representativeWeight = getSpaWeightRepresentative(weightRange);
          const matchingVariants = selectableVariants.filter((service) =>
            matchesSpaServiceWeight(service, representativeWeight),
          );

          if (matchingVariants.length) {
            selectableCandidates = matchingVariants;
          } else {
            const nearestDistance = Math.min(
              ...selectableVariants.map((service) =>
                getSpaWeightDistance(service, representativeWeight),
              ),
            );
            selectableCandidates = selectableVariants.filter(
              (service) =>
                getSpaWeightDistance(service, representativeWeight) ===
                nearestDistance,
            );
          }
        }

        const selected = selectableCandidates.reduce((lowest, service) =>
          Number(service.price) < Number(lowest.price) ? service : lowest,
        );
        return { ...group, selected };
      }),
    [groups, weightRange],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(displayedGroups.length / ADMIN_PAGE_SIZE),
  );
  const activePage = Math.min(currentPage, totalPages);
  const paginatedGroups = displayedGroups.slice(
    (activePage - 1) * ADMIN_PAGE_SIZE,
    activePage * ADMIN_PAGE_SIZE,
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead className="bg-muted/30">
            <tr className="h-[68px]">
              {["Dịch vụ", "Mô tả"].map((label) => (
                <th
                  key={label}
                  className="align-middle px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground"
                >
                  {label}
                </th>
              ))}
              <th className="align-middle px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                <label className="flex items-center gap-2">
                  <span className="shrink-0">Cân nặng</span>
                  <select
                    value={weightRange}
                    onChange={(event) => {
                      setWeightRange(event.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Chọn khoảng cân để xem giá dịch vụ Spa"
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs font-black normal-case text-foreground/85 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="LOWEST">Mặc định</option>
                    {weightOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </th>
              {["Giá", "Thời lượng", "Trạng thái", "Lượt đặt"].map((label) => (
                <th
                  key={label}
                  className="align-middle px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedGroups.map((group) => {
              const service = group.selected;
              const duration =
                service.durationMax &&
                service.durationMax !== service.durationMin
                  ? `${service.durationMin}–${service.durationMax} phút`
                  : `${service.durationMin} phút`;

              return (
                <tr key={group.key} className="transition hover:bg-muted/20">
                  <td className="px-4 py-4">
                    <p className="text-sm font-black text-foreground">
                      {group.name}
                    </p>
                    <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-black text-muted-foreground">
                      {formatSpaSpeciesLabel(group.species)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-foreground/75">
                    <p className="line-clamp-2">{service.description || "-"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
                      {service.petWeightMin == null &&
                      service.petWeightMax == null
                        ? "Mọi cân nặng"
                        : formatSpaWeightOption(
                            service.petWeightMin == null
                              ? null
                              : Number(service.petWeightMin),
                            service.petWeightMax == null
                              ? null
                              : Number(service.petWeightMax),
                          )}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-base font-black text-primary">
                      {moneyCell(service)}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-foreground/75">
                    {duration}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${service.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      <span className="size-2 rounded-full bg-current opacity-70" />
                      {service.isActive ? "Đang hoạt động" : "Tạm ngừng"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm font-black text-foreground">
                    {service._count?.bookings ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AdminPagination
        currentPage={activePage}
        totalItems={displayedGroups.length}
        onPageChange={setCurrentPage}
        itemLabel="dịch vụ"
      />
    </div>
  );
}

export function ProductCatalogPanel({ products }: { products: Row[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [availability, setAvailability] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => product.category).filter(Boolean)),
      ).sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        String(product.id).includes(normalizedQuery) ||
        product.name?.toLowerCase().includes(normalizedQuery) ||
        product.brand?.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        category === "ALL" || product.category === category;
      const matchesAvailability =
        availability === "ALL" ||
        (availability === "ACTIVE" &&
          product.isActive &&
          (product.stock ?? 0) > 0) ||
        (availability === "LOW" &&
          (product.stock ?? 0) > 0 &&
          (product.stock ?? 0) <= 5) ||
        (availability === "OUT" && (product.stock ?? 0) === 0) ||
        (availability === "INACTIVE" && !product.isActive);
      return matchesQuery && matchesCategory && matchesAvailability;
    });
  }, [products, query, category, availability]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filtered.slice(
    (activePage - 1) * ADMIN_PAGE_SIZE,
    activePage * ADMIN_PAGE_SIZE,
  );

  return (
    <div>
      <div className="grid gap-3 border-b bg-card p-4 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_220px] xl:items-center">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm theo mã, tên hoặc thương hiệu..."
            className="h-10 rounded-xl pl-9 font-semibold"
          />
        </label>
        <AdminFilterSelect
          ariaLabel="Lọc theo danh mục sản phẩm"
          value={category}
          onChange={(value) => {
            setCategory(value);
            setCurrentPage(1);
          }}
          options={[
            { value: "ALL", label: "Tất cả danh mục" },
            ...categories.map((item) => ({
              value: item,
              label: formatCategory(item),
            })),
          ]}
        />
        <AdminFilterSelect
          ariaLabel="Lọc theo trạng thái sản phẩm"
          value={availability}
          onChange={(value) => {
            setAvailability(value);
            setCurrentPage(1);
          }}
          options={[
            { value: "ALL", label: "Tất cả trạng thái" },
            { value: "ACTIVE", label: "Đang bán" },
            { value: "LOW", label: "Sắp hết hàng" },
            { value: "OUT", label: "Hết hàng" },
            { value: "INACTIVE", label: "Ngừng bán" },
          ]}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-left">
          <thead className="bg-muted/30">
            <tr>
              {[
                "Sản phẩm",
                "Mã sản phẩm",
                "Danh mục",
                "Giá bán",
                "Giá nhập",
                "Tồn kho",
                "Trạng thái",
                "Cập nhật",
              ].map((label) => (
                <th
                  key={label}
                  className="px-5 py-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedProducts.map((product) => {
              const stock = product.stock ?? 0;
              const stockTone =
                stock === 0
                  ? "text-red-700 bg-red-50 border-red-200"
                  : stock <= 5
                    ? "text-amber-800 bg-amber-50 border-amber-200"
                    : "text-emerald-700 bg-emerald-50 border-emerald-200";
              return (
                <tr key={product.id} className="transition hover:bg-muted/20">
                  <td className="px-5 py-4">
                    <div className="flex min-w-[260px] items-center gap-3">
                      <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt=""
                            fill
                            sizes="48px"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <PackageOpen className="size-5 text-muted-foreground/70" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p
                          className="max-w-[300px] truncate text-sm font-black text-foreground"
                          title={product.name}
                        >
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {product.brand || "Chưa có thương hiệu"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-lg bg-primary/10 px-3 py-1.5 font-mono text-sm font-black tracking-wider text-primary">
                      #{product.id}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-foreground/75">
                    {formatCategory(product.category)}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-foreground">
                      {moneyCell({
                        price: product.salePrice ?? product.sellingPrice,
                      })}
                    </p>
                    {product.salePrice && (
                      <p className="mt-1 text-xs font-semibold text-muted-foreground/70 line-through">
                        {moneyCell({ price: product.sellingPrice })}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-foreground/75">
                    {product.importPrice
                      ? moneyCell({ price: product.importPrice })
                      : "-"}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${stockTone}`}
                    >
                      {stock} sản phẩm
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-black ${product.isActive ? "text-emerald-700" : "text-muted-foreground"}`}
                    >
                      <span
                        className={`size-2 rounded-full ${product.isActive ? "bg-emerald-500" : "bg-muted-foreground/70"}`}
                      />
                      {product.isActive ? "Đang bán" : "Ngừng bán"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-muted-foreground">
                    {dateCell(product)}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center">
                  <AlertTriangle className="mx-auto size-7 text-muted-foreground/70" />
                  <p className="mt-3 text-sm font-bold text-muted-foreground">
                    Không tìm thấy sản phẩm phù hợp.
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
        itemLabel="sản phẩm"
      />
    </div>
  );
}

