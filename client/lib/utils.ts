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
