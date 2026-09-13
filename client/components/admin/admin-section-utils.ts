import axios from "axios";
import type { AccountStatus, AdminRole, ComplaintAction } from "@/lib/api/admin";

// Admin APIs return different shapes for each section.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdminRow = Record<string, any>;

export type PetVerificationFilter =
  | "ALL"
  | "PENDING"
  | "VERIFIED"
  | "NEED_MORE_INFO"
  | "REJECTED"
  | "NONE";

export const ADMIN_PAGE_SIZE = 10;
export const ADMIN_ROLE_OPTIONS: AdminRole[] = ["USER", "STORE_MANAGER", "SPA_MANAGER", "SPA_STAFF"];
export const ADMIN_ACCOUNT_STATUS_OPTIONS: AccountStatus[] = ["ACTIVE", "SUSPENDED"];

type SpaServiceVariantGroup = {
  key: string;
  name: string;
  species?: string | null;
  variants: AdminRow[];
};

const ROLE_LABELS: Record<string, string> = {
  USER: "Người dùng",
  ADMIN: "Quản trị viên",
  MODERATOR: "Kiểm duyệt viên",
  STORE_MANAGER: "Quản lý cửa hàng",
  SPA_MANAGER: "Quản lý spa",
  SPA_STAFF: "Nhân viên spa",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  SUSPENDED: "Tạm dừng",
  PENDING: "Đang chờ",
  REVIEWING: "Đang xem xét",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  NEED_MORE_INFO: "Cần bổ sung",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Không phát hiện vi phạm",
  INSUFFICIENT_EVIDENCE: "Chưa đủ bằng chứng",
  ESCALATED: "Chuyển cấp xử lý",
  WARNING: "Cảnh báo",
  HIDE_CONTENT: "Ẩn nội dung",
  SUSPEND_ACCOUNT: "Khóa tài khoản",
  RESOLVE: "Xử lý",
  ESCALATE: "Chuyển cấp",
  NONE: "Chưa xác minh",
  VERIFIED: "Đã xác minh",
  HIDDEN: "Đã ẩn",
  INACTIVE: "Không hoạt động",
  PROCESSING: "Đang xử lý",
  SHIPPED: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  CONFIRMED: "Đã xác nhận",
  CHECK_IN: "Đã Check-in",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Hoàn tất",
  NO_SHOW: "Không đến",
  USER: "Người dùng",
  PET: "Thú cưng",
  MATCHING: "Ghép đôi",
  STORE: "Cửa hàng",
  SPA: "Spa",
  REVIEW: "Đánh giá",
};

const COMPLAINT_TARGET_LABELS: Record<string, string> = {
  ORDER: "Đơn hàng",
  PRODUCT: "Sản phẩm",
  PET: "Thú cưng",
  USER: "Người dùng",
};

const MATCHING_REPORT_REASON_LABELS: Record<string, string> = {
  INAPPROPRIATE_MESSAGE: "Tin nhắn không phù hợp",
  HARASSMENT: "Quấy rối",
  FAKE_INFORMATION: "Thông tin giả",
  PET_SAFETY: "An toàn thú cưng",
  NO_SHOW: "Không đến gặp",
  OTHER: "Lý do khác",
};

const COMPLAINT_ACTION_LABELS: Partial<Record<ComplaintAction, string>> = {
  DISMISS: "Không xử lý",
  WARNING: "Gửi cảnh cáo người dùng",
  HIDE_CONTENT: "Ẩn thú cưng khỏi ghép đôi",
  SUSPEND_ACCOUNT: "Tạm khóa tài khoản",
  RESOLVE: "Cần thêm bằng chứng",
  ESCALATE: "Chuyển cấp xử lý",
};

const CATEGORY_LABELS: Record<string, string> = {
  DOG_FOOD: "Thức ăn cho chó",
  CAT_FOOD: "Thức ăn cho mèo",
  TOY: "Đồ chơi",
  ACCESSORY: "Phụ kiện",
  GROOMING: "Chăm sóc & vệ sinh",
  CAGE_BED: "Chuồng & đệm nằm",
  LEASH_COLLAR: "Vòng cổ & dây dắt",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  VACCINE_RECORD: "Sổ tiêm phòng",
  PEDIGREE_CERT: "Giấy phả hệ VKA/TICA",
  HEALTH_CHECK: "Giấy khám sức khỏe",
};

const PET_MODERATION_REASON_LABELS: Record<string, string> = {
  CONTENT_VIOLATION: "Nội dung hoặc hình ảnh vi phạm",
  INACCURATE_INFORMATION: "Thông tin không chính xác",
  SUSPECTED_FAKE: "Nghi ngờ hồ sơ giả mạo",
  DOCUMENT_FRAUD: "Nghi ngờ giấy tờ giả",
  UNRESOLVED_REPORT: "Có báo cáo cần xác minh",
  INFORMATION_VERIFIED: "Đã xác minh lại thông tin",
  REPORT_RESOLVED: "Báo cáo đã được xử lý",
  DOCUMENTS_APPROVED: "Giấy tờ đã được duyệt",
  ADMIN_REVIEW: "Đã được Admin rà soát",
  OTHER: "Lý do khác",
};

function labelFor(value: string | undefined, labels: Record<string, string>) {
  return value ? (labels[value] ?? value) : "-";
}

export function normalizeAdminRows(section: string, data: AdminRow[] | AdminRow): AdminRow[] {
  if (["system-profile", "store-overview", "spa-overview"].includes(section) && !Array.isArray(data)) {
    return [data];
  }
  return Array.isArray(data) ? data : [];
}

export function renderAdminValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export const formatRole = (role?: string) => labelFor(role, ROLE_LABELS);
export const formatStatus = (status?: string) => labelFor(status, STATUS_LABELS);
export const formatComplaintTarget = (target?: string) => labelFor(target, COMPLAINT_TARGET_LABELS);
export const formatMatchingReportReason = (reason?: string) => labelFor(reason, MATCHING_REPORT_REASON_LABELS);
export const formatCategory = (category?: string) => labelFor(category, CATEGORY_LABELS);
export const formatDocumentType = (type?: string) => labelFor(type, DOCUMENT_TYPE_LABELS);
export const formatPetModerationReason = (reason?: string) => labelFor(reason, PET_MODERATION_REASON_LABELS);

export function formatComplaintAction(action?: ComplaintAction) {
  return action ? (COMPLAINT_ACTION_LABELS[action] ?? action) : "-";
}

export function formatMatchingReportConclusion(status?: string) {
  return status === "RESOLVED" ? "Xác nhận có vi phạm" : "Chưa xác nhận có vi phạm";
}

export function formatSpecies(species?: string) {
  return species === "DOG" ? "Chó" : species === "CAT" ? "Mèo" : (species ?? "-");
}

export function formatGender(gender?: string) {
  return gender === "MALE" ? "Đực" : gender === "FEMALE" ? "Cái" : (gender ?? "-");
}

export function formatDateValue(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("vi-VN");
}

export function adminDateCell(row: AdminRow) {
  const value = row.createdAt ?? row.updatedAt ?? row.scheduledAt;
  return value ? new Date(value).toLocaleDateString("vi-VN") : "-";
}

export function adminMoneyCell(row: AdminRow) {
  const value = row.totalAmount ?? row.priceSnapshot ?? row.price;
  return typeof value === "number"
    ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value)
    : "-";
}

export function getAdminErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError<{ message?: string | string[] }>(error)) return fallback;
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(", ") : message || fallback;
}

export function getInitials(name?: string) {
  if (!name?.trim()) return "U";
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

export function hasActionablePetDocument(pet: AdminRow) {
  return Boolean(
    pet.documents?.some((document: AdminRow) => ["PENDING", "REVIEWING"].includes(document.status)),
  );
}

export function hasApprovedPetDocument(pet: AdminRow) {
  return Boolean(pet.documents?.some((document: AdminRow) => document.status === "APPROVED"));
}

export function hasRejectedPetDocument(pet: AdminRow) {
  return Boolean(pet.documents?.some((document: AdminRow) => document.status === "REJECTED"));
}

export function petMatchesVerificationFilter(pet: AdminRow, filter: PetVerificationFilter) {
  if (filter === "ALL") return true;
  if (filter === "PENDING") return hasActionablePetDocument(pet);
  if (filter === "VERIFIED") return hasApprovedPetDocument(pet);
  if (filter === "NEED_MORE_INFO") {
    return Boolean(pet.documents?.some((document: AdminRow) => document.status === "NEED_MORE_INFO"));
  }
  if (filter === "REJECTED") return hasRejectedPetDocument(pet);
  return !pet.documents?.length;
}

function getSpaServiceBaseName(service: AdminRow) {
  const name = String(service.name ?? "Dịch vụ Spa").trim();
  if (service.petWeightMin == null && service.petWeightMax == null) return name;
  return name
    .replace(/\s*\([^)]*kg[^)]*\)\s*$/iu, "")
    .replace(/\s+[<>]?\s*\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*kg\s*$/iu, "")
    .trim();
}

export function groupSpaServiceVariants(services: AdminRow[]): SpaServiceVariantGroup[] {
  const groups = new Map<string, SpaServiceVariantGroup>();
  services.forEach((service) => {
    const name = getSpaServiceBaseName(service);
    const key = [
      service.categoryId ?? service.category?.name ?? "",
      service.isMain === false ? "SUB" : "MAIN",
      service.species ?? "ALL",
      name.toLocaleLowerCase("vi"),
    ].join("::");
    const existing = groups.get(key);
    if (existing) existing.variants.push(service);
    else groups.set(key, { key, name, species: service.species, variants: [service] });
  });
  return Array.from(groups.values()).sort(
    (left, right) => left.name.localeCompare(right.name, "vi") || String(left.species).localeCompare(String(right.species)),
  );
}

export function formatSpaSpeciesLabel(species?: string | null) {
  return species === "DOG" ? "Chó" : species === "CAT" ? "Mèo" : "Dùng chung";
}

export function getSpaWeightKey(row: AdminRow) {
  const min = row.petWeightMin == null ? "" : Number(row.petWeightMin);
  const max = row.petWeightMax == null ? "" : Number(row.petWeightMax);
  return `${min}:${max}`;
}

export function getSpaWeightRepresentative(rangeKey: string) {
  const [rawMin, rawMax] = rangeKey.split(":");
  const min = rawMin === "" ? 0 : Number(rawMin);
  const max = rawMax === "" ? null : Number(rawMax);
  return max == null || max === 100 ? min + 0.5 : (min + max) / 2;
}

export function matchesSpaServiceWeight(service: AdminRow, weight: number) {
  if (service.petWeightMin == null && service.petWeightMax == null) return true;
  const min = service.petWeightMin == null ? 0 : Number(service.petWeightMin);
  const max = service.petWeightMax == null ? null : Number(service.petWeightMax);
  if (weight < min) return false;
  if (max == null || max === 100) return true;
  return service.isMain === false ? weight <= max : weight < max;
}

export function getSpaWeightDistance(service: AdminRow, weight: number) {
  if (service.petWeightMin == null && service.petWeightMax == null) return 0;
  const min = service.petWeightMin == null ? 0 : Number(service.petWeightMin);
  const max =
    service.petWeightMax == null || Number(service.petWeightMax) === 100
      ? Number.POSITIVE_INFINITY
      : Number(service.petWeightMax);
  if (weight < min) return min - weight;
  return weight > max ? weight - max : 0;
}

export function formatSpaWeightOption(min: number | null, max: number | null) {
  if (min == null && max == null) return "Mọi cân nặng";
  const normalizedMin = min ?? 0;
  if (max == null || max === 100) return `${formatSpaWeightNumber(normalizedMin)}kg trở lên`;
  return `${formatSpaWeightNumber(normalizedMin)}–${formatSpaWeightNumber(max)}kg`;
}

function formatSpaWeightNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}
