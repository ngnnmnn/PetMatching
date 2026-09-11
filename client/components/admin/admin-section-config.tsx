import type { ReactNode } from "react";
import { adminApi } from "@/lib/api/admin";
import {
  adminDateCell,
  formatComplaintTarget,
  formatMatchingReportReason,
  formatRole,
  formatStatus,
  type AdminRow,
} from "@/components/admin/admin-section-utils";

export type AdminSectionConfig = {
  title: string;
  description: string;
  loader: () => Promise<{ data: AdminRow[] | AdminRow }>;
  columns: Array<{
    key: string;
    label: string;
    render?: (row: AdminRow) => ReactNode;
  }>;
};

export const sectionsWithoutTableActions = new Set([
  "system-profile",
  "store-overview",
  "store-products",
  "store-orders",
  "spa-overview",
  "spa-services",
  "spa-bookings",
]);

export const adminSectionConfig: Record<string, AdminSectionConfig> = {
  users: {
    title: "Người dùng & vai trò",
    description: "Xem người dùng, gán vai trò và khóa hoặc mở khóa tài khoản.",
    loader: adminApi.users,
    columns: [
      { key: "name", label: "Tên" },
      { key: "email", label: "Email" },
      { key: "role", label: "Vai trò", render: (row) => formatRole(row.role) },
      { key: "accountStatus", label: "Trạng thái", render: (row) => formatStatus(row.accountStatus) },
      { key: "isVerified", label: "Email xác thực", render: (row) => (row.isVerified ? "Có" : "Không") },
      { key: "createdAt", label: "Ngày tạo", render: adminDateCell },
    ],
  },
  pets: {
    title: "Thú cưng",
    description: "Xem toàn bộ hồ sơ, giấy tờ xác minh và xử lý yêu cầu duyệt tại một nơi.",
    loader: adminApi.pets,
    columns: [],
  },
  "system-profile": {
    title: "Hồ sơ thương hiệu",
    description: "Quản lý nội dung giới thiệu và thông tin liên hệ hiển thị trên các dịch vụ PetMatching.",
    loader: adminApi.systemProfile,
    columns: [],
  },
  "store-overview": {
    title: "Tổng quan cửa hàng",
    description: "Theo dõi doanh thu, đơn hàng, tồn kho và hiệu quả sản phẩm của PetMatching Store.",
    loader: adminApi.storeDashboard,
    columns: [],
  },
  "store-products": {
    title: "Sản phẩm",
    description: "Giám sát danh mục, giá bán, tồn kho và trạng thái sản phẩm của PetMatching Store.",
    loader: adminApi.storeProducts,
    columns: [],
  },
  "store-orders": {
    title: "Đơn hàng",
    description: "Theo dõi toàn bộ đơn hàng của PetMatching Store ở chế độ chỉ xem.",
    loader: adminApi.storeOrders,
    columns: [],
  },
  "spa-overview": {
    title: "Tổng quan Spa",
    description: "Theo dõi doanh thu, lịch hẹn, dịch vụ và năng lực vận hành của Spa PetMatching.",
    loader: adminApi.spaDashboard,
    columns: [],
  },
  "spa-services": {
    title: "Dịch vụ Spa",
    description: "Theo dõi danh mục, giá, thời lượng và trạng thái dịch vụ.",
    loader: adminApi.spaServices,
    columns: [],
  },
  "spa-bookings": {
    title: "Lịch đặt spa",
    description: "Theo dõi lịch hẹn, thanh toán và chất lượng vận hành Spa ở chế độ chỉ xem.",
    loader: adminApi.spaBookings,
    columns: [],
  },
  reports: {
    title: "Kiểm duyệt ghép đôi",
    description: "Tiếp nhận và xử lý các phản ánh phát sinh trong quá trình ghép đôi và trò chuyện.",
    loader: loadMatchingReports,
    columns: matchingReportColumns(),
  },
};

function matchingReportColumns(): AdminSectionConfig["columns"] {
  return [
    { key: "reason", label: "Lý do", render: (row) => formatMatchingReportReason(row.reason) },
    { key: "targetType", label: "Đối tượng", render: (row) => formatComplaintTarget(row.targetType) },
    { key: "targetId", label: "Người/Thú cưng bị phản ánh" },
    { key: "reporterId", label: "Người phản ánh", render: (row) => row.reporter?.name ?? row.reporterId },
    { key: "detail", label: "Chi tiết" },
    {
      key: "status",
      label: "Trạng thái",
      render: (row) => (["PENDING", "REVIEWING"].includes(row.status) ? "Chờ xử lý" : formatStatus(row.status)),
    },
    { key: "createdAt", label: "Ngày gửi", render: adminDateCell },
  ];
}

async function loadMatchingReports(): Promise<{ data: AdminRow[] }> {
  const response = await adminApi.matchingReports();
  const reports: AdminRow[] = Array.isArray(response.data)
    ? response.data.map((report: AdminRow) => ({
        ...report,
        reporterId: report.userId,
        targetType: report.targetType ?? "USER",
        targetId:
          report.targetType === "PET"
            ? (report.pet?.name ?? report.petId)
            : (report.reportedUser?.name ?? report.reportedUserId),
      }))
    : [];
  return {
    data: reports.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  };
}
