const MATCHING_REPORT_REASON_LABELS: Record<string, string> = {
  INAPPROPRIATE_MESSAGE: 'gửi tin nhắn không phù hợp',
  HARASSMENT: 'quấy rối người dùng khác',
  FAKE_INFORMATION: 'cung cấp thông tin giả',
  PET_SAFETY: 'vi phạm quy định an toàn thú cưng',
  NO_SHOW: 'không đến buổi hẹn ghép đôi',
  OTHER: 'vi phạm tiêu chuẩn cộng đồng',
};

export function formatMatchingReportReason(reason?: string | null) {
  return reason
    ? (MATCHING_REPORT_REASON_LABELS[reason] ?? 'vi phạm tiêu chuẩn cộng đồng')
    : 'vi phạm tiêu chuẩn cộng đồng';
}

export function buildAccountSuspensionMessage(reason?: string | null) {
  return `Tài khoản của bạn đã bị tạm khóa do ${formatMatchingReportReason(reason)}. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.`;
}
