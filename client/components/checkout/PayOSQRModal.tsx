'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Copy, Check, QrCode, AlertCircle, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface PayOSQRData {
  orderId?: string;
  orderCode: number;
  accountNumber: string;
  accountName: string;
  bin: string;
  amount: number;
  description: string;
  qrCode?: string;
  qrImageUrl?: string;
  checkoutUrl?: string;
}

interface PayOSQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
  onCancelOrder?: (orderId: string) => void;
  qrData: PayOSQRData | null;
}

function getBankNameByBin(bin: string): string {
  const bankMap: Record<string, string> = {
    '970422': 'MBBank (Ngân hàng Quân Đội)',
    '970415': 'VietinBank',
    '970436': 'Vietcombank',
    '970418': 'BIDV',
    '970407': 'Techcombank',
    '970416': 'ACB',
    '970432': 'VPBank',
    '970423': 'TPBank',
    '970441': 'VIB',
  };
  return bankMap[bin] || `Ngân hàng (Mã BIN ${bin})`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PayOSQRModal({
  isOpen,
  onClose,
  onSuccess,
  onCancelOrder,
  qrData,
}: PayOSQRModalProps) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  // 15 minutes countdown (900 seconds)
  const [timeLeft, setTimeLeft] = useState(900);
  const [isExpired, setIsExpired] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleClose = () => {
    if (!isPaid && qrData?.orderId && onCancelOrder) {
      onCancelOrder(qrData.orderId);
    }
    onClose();
  };

  // 15-Minute Countdown Timer
  useEffect(() => {
    if (!isOpen || !qrData) return;

    setTimeLeft(900);
    setIsExpired(false);
    setIsPaid(false);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExpired(true);
          if (!isPaid && qrData?.orderId && onCancelOrder) {
            onCancelOrder(qrData.orderId);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, qrData, isPaid, onCancelOrder]);

  // Real-time payment check (Poll every 3 seconds)
  useEffect(() => {
    if (!isOpen || !qrData || isExpired || isPaid) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/payment/check-status/${qrData.orderCode}`);
        const data = await res.json();

        if (data.isPaid) {
          setIsPaid(true);
          clearInterval(pollInterval);
          toast.success('Thanh toán đơn hàng thành công!');
          setTimeout(() => {
            onSuccess(data.orderId || String(qrData.orderCode));
          }, 1500);
        }
      } catch (err) {
        console.error('Failed to check payment status', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isOpen, qrData, isExpired, isPaid, apiBaseUrl, onSuccess]);

  if (!isOpen || !qrData) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Đã sao chép ${fieldName}!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 text-[#0F766E]">
              <QrCode className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[var(--text-main)]">
                Thanh toán qua mã QR (PayOS)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">Quét mã bằng ứng dụng Ngân hàng / MoMo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-[var(--text-main)] hover:bg-gray-100 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Success Banner */}
        {isPaid ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in duration-200">
            <div className="mx-auto size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <Check className="size-8 stroke-[3]" />
            </div>
            <h3 className="text-lg font-black text-emerald-800">Thanh toán thành công!</h3>
            <p className="text-xs text-gray-500 font-medium">Hệ thống đang chuyển hướng tới trang đơn hàng...</p>
            <Loader2 className="size-5 animate-spin mx-auto text-emerald-600 mt-2" />
          </div>
        ) : (
          <>
            {/* 15-Minute Countdown Timer Banner */}
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
              isExpired
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2 text-xs font-bold">
                <Clock className="size-4 shrink-0" />
                <span>{isExpired ? 'Mã QR đã hết hạn thanh toán' : 'Mã QR hết hạn sau:'}</span>
              </div>
              <div className={`text-sm font-black font-mono px-2 py-0.5 rounded-md ${
                isExpired ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
              }`}>
                {formattedTime}
              </div>
            </div>

            {isExpired ? (
              <div className="py-6 text-center space-y-3">
                <AlertCircle className="size-12 text-red-500 mx-auto" />
                <p className="text-sm font-bold text-gray-700">Mã QR đã quá 15 phút thời hạn thanh toán.</p>
                <p className="text-xs text-gray-500">Vui lòng đóng cửa sổ này và đặt hàng lại để tạo mã QR mới.</p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl bg-gray-900 px-6 py-2.5 text-xs font-extrabold text-white hover:bg-black transition"
                >
                  Đóng cửa sổ
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* QR Image Box */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 bg-[#FAF9F6]">
                  {qrData.qrImageUrl ? (
                    <img
                      src={qrData.qrImageUrl}
                      alt="VietQR PayOS"
                      className="size-48 object-contain rounded-lg border border-gray-100 shadow-sm"
                    />
                  ) : (
                    <div className="size-48 flex items-center justify-center bg-gray-100 rounded-lg text-xs text-gray-400">
                      Không tải được QR
                    </div>
                  )}
                  <span className="text-[10px] font-bold text-gray-500 mt-2 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-emerald-600" /> Thanh toán an toàn qua VietQR / PayOS
                  </span>
                </div>

                {/* Account Details List */}
                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-[11px] text-gray-400 font-semibold block">Ngân hàng:</span>
                    <span className="font-extrabold text-[var(--text-main)]">
                      {getBankNameByBin(qrData.bin)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-gray-400 font-semibold block">Chủ tài khoản:</span>
                    <span className="font-extrabold text-[var(--text-main)] uppercase">
                      {qrData.accountName}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-gray-400 font-semibold block">Số tài khoản:</span>
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-1.5 border border-gray-200 font-mono font-bold text-sm">
                      <span>{qrData.accountNumber}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(qrData.accountNumber, 'Số tài khoản')}
                        className="p-1 rounded text-gray-500 hover:text-primary hover:bg-gray-200 transition"
                      >
                        {copiedField === 'Số tài khoản' ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-gray-400 font-semibold block">Số tiền:</span>
                    <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-1.5 border border-emerald-200 font-black text-sm text-emerald-800">
                      <span>{formatCurrency(qrData.amount)}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(String(qrData.amount), 'Số tiền')}
                        className="p-1 rounded text-emerald-700 hover:bg-emerald-200 transition"
                      >
                        {copiedField === 'Số tiền' ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-gray-400 font-semibold block">Nội dung chuyển khoản:</span>
                    <div className="flex items-center justify-between bg-amber-50 rounded-lg p-1.5 border border-amber-200 font-mono font-bold text-amber-900">
                      <span>{qrData.description}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(qrData.description, 'Nội dung chuyển khoản')}
                        className="p-1 rounded text-amber-800 hover:bg-amber-200 transition"
                      >
                        {copiedField === 'Nội dung chuyển khoản' ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Note & Fallback Link */}
            {!isExpired && (
              <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin text-[#0F766E]" /> Tự động xác nhận sau 10-30s...
                </span>

                {qrData.checkoutUrl && (
                  <a
                    href={qrData.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0F766E] font-bold hover:underline inline-flex items-center gap-1 text-[11px]"
                  >
                    Mở trang PayOS <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
