import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Hàm hỗ trợ định dạng chuỗi địa chỉ giao hàng sạch sẽ, tự động loại bỏ các phần từ trùng lặp (như lặp lại Phường/Xã/Quận/Huyện nhiều lần)
 * @param detail Địa chỉ chi tiết (số nhà, đường phố)
 * @param ward Phường/Xã
 * @param district Quận/Huyện
 * @param province Tỉnh/Thành phố
 */
export function formatCleanAddressString(
  detail?: string,
  ward?: string,
  district?: string,
  province?: string,
): string {
  const parts: string[] = [];
  const addedLower = new Set<string>();

  const appendPart = (part?: string) => {
    if (!part) return;
    const trimmed = part.trim();
    if (!trimmed) return;

    // Phân tách các phần bởi dấu phẩy
    const subParts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    for (const sub of subParts) {
      const lower = sub.toLowerCase();
      if (!addedLower.has(lower)) {
        addedLower.add(lower);
        parts.push(sub);
      }
    }
  };

  appendPart(detail);
  appendPart(ward);
  appendPart(district);
  appendPart(province);

  return parts.join(', ');
}

/**
 * Hàm định dạng số tiền VND chuẩn Việt Nam
 * @param amount Số tiền cần định dạng (VNĐ)
 * @returns Chuỗi tiền tệ định dạng VNĐ (vd: 150.000 ₫ hoặc 150.000 đ)
 */
export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Hàm định dạng ngày tháng hiển thị theo định dạng Việt Nam (DD/MM/YYYY)
 * @param date Chuỗi thời gian hoặc đối tượng Date
 * @returns Chuỗi ngày tháng (vd: 13/09/2026)
 */
export function formatDate(date?: string | Date | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Hàm định dạng ngày giờ hiển thị theo định dạng Việt Nam (HH:mm DD/MM/YYYY)
 * @param date Chuỗi thời gian hoặc đối tượng Date
 * @returns Chuỗi ngày giờ (vd: 14:30 13/09/2026)
 */
export function formatDateTime(date?: string | Date | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

/**
 * Hàm tính toán và định dạng ngày thú cưng đủ điều kiện phối giống (đủ 12 tháng tuổi)
 * @param dob Ngày sinh của thú cưng
 * @returns Chuỗi tháng/năm đủ điều kiện (vd: 09/2026) hoặc null nếu chưa có ngày sinh
 */
export function getPetEligibleDate(dob?: string | Date | null): string | null {
  if (!dob) return null;
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(birth.getTime())) return null;
  const eligibleDate = new Date(birth);
  eligibleDate.setMonth(eligibleDate.getMonth() + 12);
  return eligibleDate.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
}
