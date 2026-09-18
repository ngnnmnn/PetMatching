import * as XLSX from 'xlsx';
import {
  appendTableSheet,
  createWorkbook,
  getExcelCell,
  writeWorkbook,
  type ExcelCellValue,
} from '../../common/excel.utils';

type RevenuePoint = {
  label: string;
  storeRevenue: number;
  spaRevenue: number;
  totalRevenue: number;
  transactions: number;
};

type AdminReportUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  accountStatus: string;
  isVerified: boolean;
  createdAt: Date;
  _count: { pets: number; orders: number };
};

type AdminReportPet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  gender: string;
  birthday: Date;
  weight: number;
  status: string;
  verificationBadge: string;
  createdAt: Date;
  owner: {
    name: string;
    email: string;
    accountStatus: string;
  };
  _count: {
    documents: number;
    sentMatchingRequests: number;
    receivedMatchingRequests: number;
  };
};

type AdminReportInput = {
  generatedAt: Date;
  range: { label: string; from: string; to: string };
  revenue: {
    total: number;
    store: number;
    spa: number;
    previousTotal: number;
    changePercent: number;
  };
  revenueSeries: RevenuePoint[];
  users: AdminReportUser[];
  pets: AdminReportPet[];
};

const ROLE_LABELS: Record<string, string> = {
  USER: 'Người dùng',
  MODERATOR: 'Kiểm duyệt viên',
  STORE_MANAGER: 'Quản lý cửa hàng',
  SPA_MANAGER: 'Quản lý Spa',
  SPA_STAFF: 'Nhân viên Spa',
};

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  SUSPENDED: 'Đã khóa',
};

const PET_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Tạm ẩn',
  BANNED: 'Bị ẩn do vi phạm',
};

const VERIFICATION_LABELS: Record<string, string> = {
  NONE: 'Chưa xác minh',
  PENDING: 'Đang chờ xác minh',
  VERIFIED: 'Đã xác minh',
};

const SPECIES_LABELS: Record<string, string> = { DOG: 'Chó', CAT: 'Mèo' };
const GENDER_LABELS: Record<string, string> = { MALE: 'Đực', FEMALE: 'Cái' };

export function buildAdminReportExcel(input: AdminReportInput): Buffer {
  const workbook = createWorkbook();
  appendRevenueSheet(workbook, input);

  appendTableSheet(workbook, {
    name: 'Người dùng',
    title: 'DANH SÁCH NGƯỜI DÙNG PETMATCHING',
    subtitle: `Dữ liệu tại thời điểm xuất: ${formatVietnamDateTime(input.generatedAt)}`,
    columns: [
      { header: 'STT', width: 7, value: (_, index) => index + 1 },
      { header: 'Mã người dùng', width: 28, value: (row) => row.id },
      { header: 'Họ và tên', width: 24, value: (row) => row.name },
      { header: 'Email', width: 30, value: (row) => row.email },
      { header: 'Số điện thoại', width: 16, value: (row) => row.phone ?? '' },
      {
        header: 'Vai trò',
        width: 20,
        value: (row) => ROLE_LABELS[row.role] ?? row.role,
      },
      {
        header: 'Trạng thái tài khoản',
        width: 20,
        value: (row) =>
          ACCOUNT_STATUS_LABELS[row.accountStatus] ?? row.accountStatus,
      },
      {
        header: 'Xác thực email',
        width: 17,
        value: (row) => (row.isVerified ? 'Đã xác thực' : 'Chưa xác thực'),
      },
      { header: 'Số thú cưng', width: 14, value: (row) => row._count.pets },
      { header: 'Số đơn hàng', width: 14, value: (row) => row._count.orders },
      {
        header: 'Ngày tham gia',
        width: 18,
        value: (row) => toVietnamExcelDate(row.createdAt),
        numberFormat: 'dd/mm/yyyy hh:mm',
      },
    ],
    rows: input.users,
  });

  appendTableSheet(workbook, {
    name: 'Thú cưng',
    title: 'DANH SÁCH THÚ CƯNG PETMATCHING',
    subtitle: `Dữ liệu tại thời điểm xuất: ${formatVietnamDateTime(input.generatedAt)}`,
    columns: [
      { header: 'STT', width: 7, value: (_, index) => index + 1 },
      { header: 'Mã thú cưng', width: 28, value: (row) => row.id },
      { header: 'Tên thú cưng', width: 20, value: (row) => row.name },
      {
        header: 'Loài',
        width: 12,
        value: (row) => SPECIES_LABELS[row.species] ?? row.species,
      },
      { header: 'Giống', width: 24, value: (row) => row.breed },
      {
        header: 'Giới tính',
        width: 12,
        value: (row) => GENDER_LABELS[row.gender] ?? row.gender,
      },
      {
        header: 'Ngày sinh',
        width: 15,
        value: (row) => toVietnamExcelDate(row.birthday),
        numberFormat: 'dd/mm/yyyy',
      },
      {
        header: 'Cân nặng (kg)',
        width: 15,
        value: (row) => row.weight,
        numberFormat: '0.0',
      },
      { header: 'Chủ sở hữu', width: 24, value: (row) => row.owner.name },
      {
        header: 'Email chủ sở hữu',
        width: 30,
        value: (row) => row.owner.email,
      },
      {
        header: 'Trạng thái chủ',
        width: 18,
        value: (row) =>
          ACCOUNT_STATUS_LABELS[row.owner.accountStatus] ??
          row.owner.accountStatus,
      },
      {
        header: 'Trạng thái hồ sơ',
        width: 19,
        value: (row) => PET_STATUS_LABELS[row.status] ?? row.status,
      },
      {
        header: 'Xác minh hồ sơ',
        width: 20,
        value: (row) =>
          VERIFICATION_LABELS[row.verificationBadge] ?? row.verificationBadge,
      },
      {
        header: 'Số giấy tờ',
        width: 13,
        value: (row) => row._count.documents,
      },
      {
        header: 'Yêu cầu ghép đôi đã gửi',
        width: 24,
        value: (row) => row._count.sentMatchingRequests,
      },
      {
        header: 'Yêu cầu ghép đôi đã nhận',
        width: 25,
        value: (row) => row._count.receivedMatchingRequests,
      },
      {
        header: 'Ngày tạo hồ sơ',
        width: 18,
        value: (row) => toVietnamExcelDate(row.createdAt),
        numberFormat: 'dd/mm/yyyy hh:mm',
      },
    ],
    rows: input.pets,
  });

  return writeWorkbook(workbook);
}

function appendRevenueSheet(workbook: XLSX.WorkBook, input: AdminReportInput) {
  const from = toVietnamExcelDate(new Date(input.range.from));
  const to = toVietnamExcelDate(new Date(input.range.to));
  const rows: ExcelCellValue[][] = [
    ['BÁO CÁO DOANH THU PETMATCHING'],
    ['Kỳ báo cáo', input.range.label],
    ['Từ ngày', from, 'Đến ngày', to],
    ['Xuất lúc', toVietnamExcelDate(input.generatedAt)],
    [],
    ['Chỉ số', 'Giá trị'],
    ['Doanh thu cửa hàng', input.revenue.store],
    ['Doanh thu Spa', input.revenue.spa],
    ['Tổng doanh thu', input.revenue.total],
    ['Doanh thu kỳ trước', input.revenue.previousTotal],
    ['Tăng trưởng so với kỳ trước', input.revenue.changePercent / 100],
    [],
    ['Chi tiết theo thời gian'],
    [
      'Thời gian',
      'Doanh thu cửa hàng',
      'Doanh thu Spa',
      'Tổng doanh thu',
      'Số giao dịch',
    ],
    ...input.revenueSeries.map((point) => [
      point.label,
      point.storeRevenue,
      point.spaRevenue,
      point.totalRevenue,
      point.transactions,
    ]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  worksheet['!cols'] = [
    { wch: 27 },
    { wch: 23 },
    { wch: 23 },
    { wch: 23 },
    { wch: 16 },
  ];
  worksheet['!rows'] = rows.map((_, index) => ({ hpt: index === 0 ? 28 : 21 }));
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 12, c: 0 }, e: { r: 12, c: 4 } },
  ];
  worksheet['!autofilter'] = {
    ref: `A14:E${Math.max(14, 14 + input.revenueSeries.length)}`,
  };

  const titleCell = getExcelCell(worksheet, 'A1');
  if (titleCell) {
    titleCell.s = {
      fill: { fgColor: { rgb: 'DCFCE7' } },
      font: { bold: true, color: { rgb: '14532D' }, sz: 16 },
    };
  }
  for (const rowNumber of [6, 14]) {
    for (
      let columnIndex = 0;
      columnIndex < (rowNumber === 6 ? 2 : 5);
      columnIndex += 1
    ) {
      const cell = getExcelCell(
        worksheet,
        XLSX.utils.encode_cell({ r: rowNumber - 1, c: columnIndex }),
      );
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: '166534' } },
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
    }
  }
  for (const address of ['B3', 'D3', 'B4']) {
    const cell = getExcelCell(worksheet, address);
    if (cell) cell.z = 'dd/mm/yyyy hh:mm';
  }
  for (const address of ['B7', 'B8', 'B9', 'B10']) {
    const cell = getExcelCell(worksheet, address);
    if (cell) cell.z = '#,##0 "₫"';
  }
  const growthCell = getExcelCell(worksheet, 'B11');
  if (growthCell) growthCell.z = '0.0%';
  for (let rowIndex = 14; rowIndex < rows.length; rowIndex += 1) {
    for (const columnIndex of [1, 2, 3]) {
      const cell = getExcelCell(
        worksheet,
        XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex }),
      );
      if (cell) cell.z = '#,##0 "₫"';
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tổng quan doanh thu');
}

function formatVietnamDateTime(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function toVietnamExcelDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    getPart('hour'),
    getPart('minute'),
    getPart('second'),
  );
}
