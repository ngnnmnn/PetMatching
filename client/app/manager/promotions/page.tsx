'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Tag,
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  Edit2,
  Trash2,
  Power,
  Calendar,
  Sparkles,
  Percent,
  DollarSign,
  Truck,
  TrendingUp,
  Award,
  Loader2,
  ArrowLeft,
  X,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { vouchersApi } from '@/lib/api/vouchers';
import { Voucher, VoucherType } from '@/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';

const currency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

// Helper format datetime for datetime-local input
function formatLocalDateTime(date?: Date | string | null) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PromotionsPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Step 1 Modal: Choose Type
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);

  // Step 2 Modal: Form Fill (Create / Edit)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    type: '' as VoucherType | '',
    isFreeship100: true, // For FREE_SHIP mode
    value: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    description: '',
    maxUsage: '',
    expiredAt: '',
    isActive: true,
  });

  // Confirm Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load Vouchers
  const loadVouchers = async () => {
    setLoading(true);
    try {
      const res = await vouchersApi.getVouchers();
      setVouchers(res.data || []);
    } catch (error) {
      console.error('Failed to load vouchers', error);
      toast.error('Lỗi khi tải danh sách mã khuyến mãi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();
  }, []);

  // Copy code handler
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Đã sao chép mã ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      code: '',
      type: '',
      isFreeship100: true,
      value: '',
      minOrderAmount: '',
      maxDiscountAmount: '',
      description: '',
      maxUsage: '',
      expiredAt: '',
      isActive: true,
    });
    setEditingVoucher(null);
  };

  // Step 1: Open Type Picker
  const handleStartCreate = () => {
    resetForm();
    setIsTypePickerOpen(true);
  };

  // Step 2: Select Type & Open Form
  const handleSelectType = (chosenType: VoucherType) => {
    setFormData((prev) => ({
      ...prev,
      type: chosenType,
      value: '',
      maxDiscountAmount: '',
      isFreeship100: true,
    }));
    setIsTypePickerOpen(false);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal directly with locked type
  const handleOpenEditModal = (voucher: Voucher) => {
    setEditingVoucher(voucher);
    const isFreeshipFull = voucher.type === 'FREE_SHIP' && (voucher.value === 100 || voucher.value === 0);
    setFormData({
      code: voucher.code,
      type: voucher.type,
      isFreeship100: isFreeshipFull,
      value: isFreeshipFull ? '' : String(voucher.value),
      minOrderAmount: voucher.minOrderAmount ? String(voucher.minOrderAmount) : '',
      maxDiscountAmount: voucher.maxDiscountAmount
        ? String(voucher.maxDiscountAmount)
        : '',
      description: voucher.description || '',
      maxUsage: voucher.maxUsage ? String(voucher.maxUsage) : '',
      expiredAt: formatLocalDateTime(voucher.expiredAt),
      isActive: voucher.isActive,
    });
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCode = formData.code.trim().toUpperCase();
    if (!cleanCode) {
      toast.error('Vui lòng nhập mã khuyến mãi.');
      return;
    }

    if (!formData.type) {
      toast.error('Loại khuyến mãi không hợp lệ.');
      return;
    }

    let finalValue = 0;
    if (formData.type === 'FREE_SHIP') {
      finalValue = formData.isFreeship100 ? 100 : Number(formData.value);
      if (!formData.isFreeship100 && (isNaN(finalValue) || finalValue <= 0)) {
        toast.error('Vui lòng nhập mức giảm phí ship lớn hơn 0đ.');
        return;
      }
    } else {
      finalValue = Number(formData.value);
      if (isNaN(finalValue) || finalValue <= 0) {
        toast.error('Vui lòng nhập giá trị giảm lớn hơn 0.');
        return;
      }
      if (formData.type === 'PERCENTAGE' && finalValue > 100) {
        toast.error('Mức giảm theo phần trăm không được vượt quá 100%.');
        return;
      }
    }

    // Strict validation for Expiration Date
    const now = new Date();
    let expiredAtObj: Date | null = null;
    if (formData.expiredAt) {
      expiredAtObj = new Date(formData.expiredAt);
      if (isNaN(expiredAtObj.getTime())) {
        toast.error('Ngày kết thúc không hợp lệ.');
        return;
      }
      if (expiredAtObj <= now) {
        toast.error('Ngày kết thúc phải là một thời điểm ở tương lai (sau thời điểm hiện tại).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        code: cleanCode,
        type: formData.type as VoucherType,
        value: finalValue,
        minOrderAmount: formData.minOrderAmount
          ? Number(formData.minOrderAmount)
          : 0,
        maxDiscountAmount:
          formData.type === 'PERCENTAGE' && formData.maxDiscountAmount
            ? Number(formData.maxDiscountAmount)
            : undefined,
        description: formData.description.trim() || undefined,
        maxUsage: formData.maxUsage ? Number(formData.maxUsage) : undefined,
        expiredAt: expiredAtObj ? expiredAtObj.toISOString() : undefined,
        isActive: formData.isActive,
      };

      if (editingVoucher) {
        await vouchersApi.updateVoucher(editingVoucher.id, payload);
        toast.success('Cập nhật khuyến mãi thành công!');
      } else {
        await vouchersApi.createVoucher(payload);
        toast.success('Tạo khuyến mãi mới thành công!');
      }

      setIsFormModalOpen(false);
      resetForm();
      loadVouchers();
    } catch (error: any) {
      console.error('Failed to submit voucher form', error);
      const msg =
        error.response?.data?.message || 'Có lỗi xảy ra khi lưu khuyến mãi.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (voucher: Voucher) => {
    try {
      await vouchersApi.toggleVoucherStatus(voucher.id);
      toast.success(
        `Đã ${voucher.isActive ? 'vô hiệu hóa' : 'kích hoạt'} mã ${voucher.code}`,
      );
      loadVouchers();
    } catch (error) {
      console.error('Failed to toggle voucher status', error);
      toast.error('Lỗi khi đổi trạng thái mã khuyến mãi.');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await vouchersApi.deleteVoucher(deletingId);
      toast.success('Đã xóa mã khuyến mãi thành công!');
      setDeletingId(null);
      loadVouchers();
    } catch (error) {
      console.error('Failed to delete voucher', error);
      toast.error('Lỗi khi xóa mã khuyến mãi.');
    }
  };

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    const now = new Date();
    return vouchers.filter((v) => {
      // Search
      const matchSearch =
        v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.description &&
          v.description.toLowerCase().includes(searchQuery.toLowerCase()));

      // Type filter
      const matchType = selectedType === 'ALL' || v.type === selectedType;

      // Status filter
      const isExpired = v.expiredAt && new Date(v.expiredAt) <= now;
      let matchStatus = true;
      if (selectedStatus === 'ACTIVE') {
        matchStatus = v.isActive && !isExpired;
      } else if (selectedStatus === 'INACTIVE') {
        matchStatus = !v.isActive;
      } else if (selectedStatus === 'EXPIRED') {
        matchStatus = isExpired === true;
      }

      return matchSearch && matchType && matchStatus;
    });
  }, [vouchers, searchQuery, selectedType, selectedStatus]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date();
    const total = vouchers.length;
    const active = vouchers.filter(
      (v) => v.isActive && (!v.expiredAt || new Date(v.expiredAt) > now),
    ).length;
    const totalUsed = vouchers.reduce((sum, v) => sum + (v.usedCount || 0), 0);
    const freeshipCount = vouchers.filter((v) => v.type === 'FREE_SHIP').length;

    return { total, active, totalUsed, freeshipCount };
  }, [vouchers]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Navigation / Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Link
                href="/manager"
                className="flex items-center gap-1 hover:text-[var(--primary-color)] transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Quản lý Cửa hàng
              </Link>
              <span>/</span>
              <span className="text-slate-800">Chương trình Khuyến mãi</span>
            </div>
            <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              <Tag className="size-7 text-[var(--primary-color)]" />
              Tạo & Quản lý Khuyến mãi
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Tạo mã giảm giá, voucher freeship và quản lý các chương trình ưu đãi cho khách hàng.
            </p>
          </div>

          <button
            onClick={handleStartCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:bg-pink-600 hover:shadow-pink-500/30 active:scale-95 cursor-pointer"
          >
            <Plus className="size-5" />
            Tạo Mã Khuyến Mãi Mới
          </button>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tổng Mã Khuyến Mãi
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">
                  {stats.total}
                </h3>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-pink-50 text-[var(--primary-color)]">
                <Tag className="size-6" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Đang Hoạt Động
                </p>
                <h3 className="mt-1 text-2xl font-black text-emerald-600">
                  {stats.active}
                </h3>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Sparkles className="size-6" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tổng Lượt Đã Sử Dụng
                </p>
                <h3 className="mt-1 text-2xl font-black text-blue-600">
                  {stats.totalUsed}
                </h3>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <TrendingUp className="size-6" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Mã Miễn Phí Vận Chuyển
                </p>
                <h3 className="mt-1 text-2xl font-black text-amber-600">
                  {stats.freeshipCount}
                </h3>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Truck className="size-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm mã khuyến mãi hoặc mô tả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--primary-color)] focus:bg-white focus:ring-2 focus:ring-pink-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Type */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold text-slate-600">
              <button
                onClick={() => setSelectedType('ALL')}
                className={cn(
                  'rounded-lg px-3 py-1.5 transition-all cursor-pointer',
                  selectedType === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'hover:text-slate-900',
                )}
              >
                Tất cả
              </button>
              <button
                onClick={() => setSelectedType('PERCENTAGE')}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-3 py-1.5 transition-all cursor-pointer',
                  selectedType === 'PERCENTAGE'
                    ? 'bg-white text-pink-600 shadow-sm'
                    : 'hover:text-slate-900',
                )}
              >
                <Percent className="size-3" />
                Giảm %
              </button>
              <button
                onClick={() => setSelectedType('FIXED')}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-3 py-1.5 transition-all cursor-pointer',
                  selectedType === 'FIXED'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'hover:text-slate-900',
                )}
              >
                <DollarSign className="size-3" />
                Giảm tiền
              </button>
              <button
                onClick={() => setSelectedType('FREE_SHIP')}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-3 py-1.5 transition-all cursor-pointer',
                  selectedType === 'FREE_SHIP'
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'hover:text-slate-900',
                )}
              >
                <Truck className="size-3" />
                Freeship
              </button>
            </div>

            {/* Filter by Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition-all focus:border-[var(--primary-color)]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">🟢 Đang hoạt động</option>
              <option value="EXPIRED">⏰ Đã hết hạn</option>
              <option value="INACTIVE">🔴 Đã vô hiệu hóa</option>
            </select>
          </div>
        </div>

        {/* Content List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Loader2 className="size-8 animate-spin text-[var(--primary-color)]" />
            <span className="ml-3 text-sm font-bold text-slate-500">
              Đang tải danh sách khuyến mãi...
            </span>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
            <div className="flex size-16 items-center justify-center rounded-full bg-pink-50 text-[var(--primary-color)]">
              <Tag className="size-8" />
            </div>
            <h3 className="mt-4 text-lg font-extrabold text-slate-900">
              Chưa có mã khuyến mãi nào
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {searchQuery || selectedType !== 'ALL' || selectedStatus !== 'ALL'
                ? 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'
                : 'Hãy tạo mã khuyến mãi đầu tiên để thu hút người mua hàng!'}
            </p>
            <button
              onClick={handleStartCreate}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary-color)] px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-pink-600 cursor-pointer"
            >
              <Plus className="size-4" />
              Tạo khuyến mãi ngay
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredVouchers.map((voucher) => {
              const now = new Date();
              const isExpired = voucher.expiredAt && new Date(voucher.expiredAt) <= now;
              const isUsageExceeded = voucher.maxUsage && voucher.usedCount >= voucher.maxUsage;
              const isActive = voucher.isActive && !isExpired && !isUsageExceeded;

              return (
                <div
                  key={voucher.id}
                  className={cn(
                    'relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md',
                    isActive
                      ? 'border-slate-200/80 hover:border-pink-300'
                      : 'border-slate-200 bg-slate-50/50 opacity-80',
                  )}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {voucher.type === 'PERCENTAGE' && (
                          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-pink-100 text-pink-600 font-bold">
                            <Percent className="size-5" />
                          </span>
                        )}
                        {voucher.type === 'FIXED' && (
                          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 font-bold">
                            <DollarSign className="size-5" />
                          </span>
                        )}
                        {voucher.type === 'FREE_SHIP' && (
                          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 font-bold">
                            <Truck className="size-5" />
                          </span>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-base font-black tracking-wider text-slate-900">
                              {voucher.code}
                            </span>
                            <button
                              onClick={() => handleCopyCode(voucher.code)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                              title="Sao chép mã"
                            >
                              {copiedCode === voucher.code ? (
                                <Check className="size-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400">
                            {voucher.type === 'PERCENTAGE'
                              ? 'Giảm theo phần trăm'
                              : voucher.type === 'FIXED'
                                ? 'Giảm tiền cố định'
                                : 'Miễn phí vận chuyển'}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      {isExpired ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600">
                          <Clock className="size-3" /> Hết hạn
                        </span>
                      ) : !voucher.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-extrabold text-rose-600">
                          Đã tắt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
                          <Sparkles className="size-3" /> Hoạt động
                        </span>
                      )}
                    </div>

                    {/* Value Display */}
                    <div className="mt-4 rounded-xl bg-slate-50 p-3">
                      <div className="text-xl font-black text-slate-900">
                        {voucher.type === 'PERCENTAGE' ? (
                          <span>Giảm {voucher.value}%</span>
                        ) : voucher.type === 'FIXED' ? (
                          <span>Giảm {currency.format(voucher.value)}</span>
                        ) : voucher.value === 100 || voucher.value === 0 ? (
                          <span className="text-amber-600">Freeship 100% (Miễn phí 100%)</span>
                        ) : (
                          <span className="text-amber-600">Giảm ship {currency.format(voucher.value)}</span>
                        )}
                      </div>

                      <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                        {voucher.type === 'PERCENTAGE' && voucher.maxDiscountAmount && (
                          <p>• Giảm tối đa: <strong className="text-slate-700">{currency.format(voucher.maxDiscountAmount)}</strong></p>
                        )}
                        <p>
                          • Đơn tối thiểu:{' '}
                          <strong className="text-slate-700">
                            {voucher.minOrderAmount
                              ? currency.format(voucher.minOrderAmount)
                              : '0đ'}
                          </strong>
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    {voucher.description && (
                      <p className="mt-3 text-xs text-slate-600 line-clamp-2">
                        {voucher.description}
                      </p>
                    )}

                    {/* Usage Progress */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                        <span>Lượt sử dụng</span>
                        <span>
                          <strong>{voucher.usedCount}</strong>
                          {voucher.maxUsage ? ` / ${voucher.maxUsage}` : ' (Không giới hạn)'}
                        </span>
                      </div>
                      {voucher.maxUsage && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              voucher.usedCount >= voucher.maxUsage
                                ? 'bg-rose-500'
                                : 'bg-[var(--primary-color)]',
                            )}
                            style={{
                              width: `${Math.min(
                                100,
                                (voucher.usedCount / voucher.maxUsage) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer & Expiration Date */}
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="size-3.5 text-slate-400" />
                      {voucher.expiredAt ? (
                        <span>
                          Hết hạn:{' '}
                          <strong className={cn(isExpired ? 'text-rose-600' : 'text-slate-700')}>
                            {new Date(voucher.expiredAt).toLocaleDateString('vi-VN')}
                          </strong>
                        </span>
                      ) : (
                        <span>Không giới hạn hạn dùng</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStatus(voucher)}
                        className={cn(
                          'rounded-lg p-1.5 text-xs font-bold transition-all cursor-pointer',
                          voucher.isActive
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
                        )}
                        title={voucher.isActive ? 'Bật/Tắt trạng thái' : 'Kích hoạt mã'}
                      >
                        <Power className="size-4" />
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(voucher)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
                        title="Chỉnh sửa mã"
                      >
                        <Edit2 className="size-4" />
                      </button>

                      <button
                        onClick={() => setDeletingId(voucher.id)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Xóa mã"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* STEP 1 MODAL: CHOOSE PROMOTION TYPE FIRST */}
        {isTypePickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl transition-all">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Chọn Loại Khuyến Mãi
                  </h2>
                  <p className="text-xs text-slate-500">
                    Vui lòng chọn loại ưu đãi trước. Loại khuyến mãi sẽ được cố định cho mã này.
                  </p>
                </div>
                <button
                  onClick={() => setIsTypePickerOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3.5">
                {/* Option 1: PERCENTAGE */}
                <button
                  type="button"
                  onClick={() => handleSelectType('PERCENTAGE')}
                  className="group flex items-center justify-between rounded-2xl border border-slate-200/80 p-4 text-left transition-all hover:border-pink-500 hover:bg-pink-50/50 hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-pink-100 text-pink-600 font-extrabold transition-transform group-hover:scale-110">
                      <Percent className="size-6" />
                    </span>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-pink-600">
                        Giảm Theo Phần Trăm (%)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Giảm % giá trị đơn hàng (Ví dụ: Giảm 10%, 20% tối đa 50k...)
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-slate-400 group-hover:text-pink-600 transition-transform group-hover:translate-x-1" />
                </button>

                {/* Option 2: FIXED */}
                <button
                  type="button"
                  onClick={() => handleSelectType('FIXED')}
                  className="group flex items-center justify-between rounded-2xl border border-slate-200/80 p-4 text-left transition-all hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 font-extrabold transition-transform group-hover:scale-110">
                      <DollarSign className="size-6" />
                    </span>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-emerald-600">
                        Giảm Số Tiền Cố Định (VNĐ)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Trừ trực tiếp số tiền cố định vào đơn hàng (Ví dụ: Giảm 30.000đ, 50.000đ...)
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-1" />
                </button>

                {/* Option 3: FREE_SHIP */}
                <button
                  type="button"
                  onClick={() => handleSelectType('FREE_SHIP')}
                  className="group flex items-center justify-between rounded-2xl border border-slate-200/80 p-4 text-left transition-all hover:border-amber-500 hover:bg-amber-50/50 hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 font-extrabold transition-transform group-hover:scale-110">
                      <Truck className="size-6" />
                    </span>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-amber-600">
                        Miễn Phí Vận Chuyển (Freeship)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Miễn 100% phí ship hoặc giảm một phần phí vận chuyển của đơn hàng.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-slate-400 group-hover:text-amber-600 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 MODAL: FORM FILL (TYPE IS LOCKED) */}
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl transition-all">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900">
                      {editingVoucher ? 'Chỉnh Sửa Khuyến Mãi' : 'Tạo Khuyến Mãi Mới'}
                    </h2>
                    {/* Locked Type Badge */}
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black',
                      formData.type === 'PERCENTAGE' && 'bg-pink-100 text-pink-700',
                      formData.type === 'FIXED' && 'bg-emerald-100 text-emerald-700',
                      formData.type === 'FREE_SHIP' && 'bg-amber-100 text-amber-800',
                    )}>
                      {formData.type === 'PERCENTAGE' && <><Percent className="size-3" /> Giảm %</>}
                      {formData.type === 'FIXED' && <><DollarSign className="size-3" /> Giảm tiền VND</>}
                      {formData.type === 'FREE_SHIP' && <><Truck className="size-3" /> Freeship</>}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Nhập các thông tin chi tiết dưới đây cho khuyến mãi này.
                  </p>
                </div>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {/* 1. Code Field */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Mã Khuyến Mãi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: PETSUMMER2026"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        code: e.target.value.toUpperCase(),
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm font-bold tracking-wider text-slate-900 outline-none transition-all focus:border-[var(--primary-color)] focus:ring-2 focus:ring-pink-500/20"
                  />
                </div>

                {/* 2. Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Mô tả chương trình / Điều kiện áp dụng
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Nhập mô tả ngắn gọn cho khách hàng..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-900 outline-none transition-all focus:border-[var(--primary-color)]"
                  />
                </div>

                {/* 3. TYPE-SPECIFIC DYNAMIC INPUTS */}
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  {/* IF FREESHIP */}
                  {formData.type === 'FREE_SHIP' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
                      <label className="block text-xs font-bold text-amber-900">
                        Cấu hình Miễn phí vận chuyển:
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 text-xs font-semibold">
                        <label className="flex items-center gap-1.5 cursor-pointer text-amber-900">
                          <input
                            type="radio"
                            name="freeshipMode"
                            checked={formData.isFreeship100}
                            onChange={() =>
                              setFormData((prev) => ({ ...prev, isFreeship100: true, value: '' }))
                            }
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span>Giảm 100% phí ship</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-amber-900">
                          <input
                            type="radio"
                            name="freeshipMode"
                            checked={!formData.isFreeship100}
                            onChange={() =>
                              setFormData((prev) => ({ ...prev, isFreeship100: false }))
                            }
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span>Giảm tối đa theo số tiền (VNĐ)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* VALUE INPUTS */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {!(formData.type === 'FREE_SHIP' && formData.isFreeship100) && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          {formData.type === 'PERCENTAGE'
                            ? 'Số % giảm (%)'
                            : formData.type === 'FIXED'
                              ? 'Số tiền giảm (VNĐ)'
                              : 'Mức giảm phí ship tối đa (VNĐ)'}{' '}
                          <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max={formData.type === 'PERCENTAGE' ? 100 : undefined}
                          placeholder={
                            formData.type === 'PERCENTAGE'
                              ? 'Ví dụ: 15'
                              : 'Ví dụ: 30000'
                          }
                          value={formData.value}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, value: e.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--primary-color)]"
                        />
                      </div>
                    )}

                    {formData.type === 'PERCENTAGE' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          Số tiền giảm tối đa (VNĐ)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Để trống nếu không giới hạn"
                          value={formData.maxDiscountAmount}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              maxDiscountAmount: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--primary-color)]"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Đơn hàng tối thiểu (VNĐ)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0đ"
                        value={formData.minOrderAmount}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            minOrderAmount: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--primary-color)]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Giới hạn tổng số lượt dùng
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Để trống nếu không giới hạn"
                        value={formData.maxUsage}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, maxUsage: e.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--primary-color)]"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Expiration Date & Active Status */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Ngày kết thúc (Hết hạn)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.expiredAt}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          expiredAt: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--primary-color)]"
                    />
                    <span className="text-[10px] text-slate-400">
                      Bắt buộc phải ở thời điểm trong tương lai.
                    </span>
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 cursor-pointer transition-all hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            isActive: e.target.checked,
                          }))
                        }
                        className="size-4 rounded border-slate-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Kích hoạt mã ngay sau khi tạo
                      </span>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-pink-600 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting && <Loader2 className="size-4 animate-spin" />}
                    {editingVoucher ? 'Cập nhật khuyến mãi' : 'Tạo khuyến mãi mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirm Dialog */}
        <ConfirmDialog
          isOpen={!!deletingId}
          title="Xác nhận xóa mã khuyến mãi"
          message="Bạn có chắc chắn muốn xóa mã khuyến mãi này không? Hành động này không thể hoàn tác."
          confirmText="Xóa khuyến mãi"
          cancelText="Hủy"
          isDanger={true}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      </div>
    </div>
  );
}
