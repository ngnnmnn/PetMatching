'use client';

import { useState, useEffect } from 'react';
import { X, Tag, Ticket, Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { vouchersApi } from '@/lib/api/vouchers';
import { Voucher } from '@/types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVoucher: (code: string) => void;
  currentAppliedCode?: string;
  subtotal: number;
}

export default function VoucherModal({
  isOpen,
  onClose,
  onSelectVoucher,
  currentAppliedCode,
  subtotal,
}: VoucherModalProps) {
  const [inputCode, setInputCode] = useState('');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchVouchers = async () => {
      setLoading(true);
      try {
        const res = await vouchersApi.getVouchers();
        const list = Array.isArray(res.data) ? res.data : [];
        setVouchers(list);
      } catch (err) {
        console.error('Failed to load vouchers from DB', err);
        setVouchers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVouchers();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyClick = (code: string) => {
    setApplyingCode(code);
    onSelectVoucher(code);
    setApplyingCode(null);
    onClose();
  };

  const handleManualApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      toast.error('Vui lòng nhập mã Voucher.');
      return;
    }
    handleApplyClick(inputCode.trim().toUpperCase());
    setInputCode('');
  };

  const now = new Date();

  // Filter vouchers into eligible and ineligible
  const eligibleVouchers: Voucher[] = [];
  const ineligibleVouchers: Voucher[] = [];

  vouchers.forEach((v) => {
    if (!v.isActive) return;
    if (v.expiredAt && new Date(v.expiredAt) <= now) return;
    if (v.maxUsage && v.usedCount >= v.maxUsage) return;

    const minAmount = v.minOrderAmount || 0;
    if (subtotal >= minAmount) {
      eligibleVouchers.push(v);
    } else {
      ineligibleVouchers.push(v);
    }
  });

  const getVoucherTitle = (v: Voucher) => {
    if (v.type === 'PERCENTAGE') {
      return `Giảm ${v.value}%`;
    }
    if (v.type === 'FIXED') {
      return `Giảm ${formatCurrency(v.value)}`;
    }
    if (v.type === 'FREE_SHIP') {
      return v.value === 100 || v.value === 0 ? 'Freeship 100%' : `Freeship ${formatCurrency(v.value)}`;
    }
    return 'Giảm giá';
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-2xl flex flex-col space-y-4 animate-in zoom-in-95 duration-200 text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
            <Ticket className="size-5 text-[#0F766E]" />
            Chọn PetMatching Voucher
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-[var(--text-main)] hover:bg-gray-100 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Notice: 1 voucher per order constraint */}
        <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-2.5 text-xs text-amber-900 font-semibold flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>Áp dụng tối đa <strong>1 Voucher</strong> cho mỗi đơn hàng.</span>
        </div>

        {/* Manual Input Form */}
        <form onSubmit={handleManualApply} className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-3 size-4 text-gray-400" />
            <input
              type="text"
              placeholder="Nhập mã voucher (Ví dụ: PETMATCH10)"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] pl-9 pr-4 py-2 text-sm uppercase focus:outline-none focus:border-primary bg-[#FCFCFA] font-mono"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#0F766E] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#115E59] transition shrink-0"
          >
            Áp dụng
          </button>
        </form>

        {/* Voucher List Scroll Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[50vh]">
          {loading ? (
            <div className="flex justify-center items-center py-10 text-gray-400 text-xs font-medium">
              <Loader2 className="size-5 animate-spin mr-2" /> Đang tải danh sách voucher...
            </div>
          ) : (
            <>
              {/* Eligible Vouchers */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-500" /> Mã giảm giá khả dụng ({eligibleVouchers.length})
                </h3>

                {eligibleVouchers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 rounded-xl bg-gray-50 border border-dashed">
                    Chưa có mã giảm giá nào phù hợp với đơn hàng này.
                  </div>
                ) : (
                  eligibleVouchers.map((v) => {
                    const isSelected = currentAppliedCode?.toUpperCase() === v.code.toUpperCase();
                    return (
                      <div
                        key={v.id || v.code}
                        className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-[#0F766E] bg-teal-50/60 ring-1 ring-[#0F766E]'
                            : 'border-[var(--border-color)] bg-[#FAF9F5] hover:border-teal-400'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-[#0F766E] bg-teal-100/80 px-2 py-0.5 rounded-lg border border-teal-200">
                              {v.code}
                            </span>
                            <span className="font-extrabold text-sm text-[var(--text-main)]">
                              {getVoucherTitle(v)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 font-medium">
                            {v.description || `Đơn tối thiểu ${formatCurrency(v.minOrderAmount || 0)}`}
                          </p>
                          {v.minOrderAmount ? (
                            <p className="text-[10px] text-gray-400 font-semibold">
                              Đơn tối thiểu: {formatCurrency(v.minOrderAmount)}
                              {v.maxDiscountAmount ? ` • Giảm tối đa ${formatCurrency(v.maxDiscountAmount)}` : ''}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplyClick(v.code)}
                          disabled={applyingCode === v.code}
                          className={`rounded-xl px-3.5 py-2 text-xs font-black shrink-0 transition flex items-center gap-1 ${
                            isSelected
                              ? 'bg-[#0F766E] text-white hover:bg-[#115E59]'
                              : 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="size-3.5" /> Đã áp dụng
                            </>
                          ) : (
                            'Áp dụng'
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Ineligible Vouchers */}
              {ineligibleVouchers.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-[var(--border-color)]">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">
                    Mã chưa đủ điều kiện ({ineligibleVouchers.length})
                  </h3>

                  {ineligibleVouchers.map((v) => {
                    const diff = (v.minOrderAmount || 0) - subtotal;
                    return (
                      <div
                        key={v.id || v.code}
                        className="p-3.5 rounded-2xl border border-gray-200 bg-gray-50/70 opacity-70 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                              {v.code}
                            </span>
                            <span className="font-bold text-xs text-gray-700">
                              {getVoucherTitle(v)}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-700 font-bold flex items-center gap-1">
                            ⚠️ Mua thêm {formatCurrency(diff)} để sử dụng mã này (Đơn tối thiểu {formatCurrency(v.minOrderAmount || 0)})
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled
                          className="rounded-xl bg-gray-200 text-gray-400 px-3 py-1.5 text-xs font-bold shrink-0 cursor-not-allowed"
                        >
                          Chưa đủ điều kiện
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[var(--border-color)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-xs font-extrabold text-[var(--text-main)] hover:bg-gray-100 transition"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
