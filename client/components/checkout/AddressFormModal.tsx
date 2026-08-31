'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MapPin, ChevronDown, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { HanoiWardOption, shippingApi } from '@/lib/api/shipping';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

interface CustomSelectOption {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  label: string;
  placeholder: string;
  options: CustomSelectOption[];
  value: string | number | undefined;
  onChange: (value: string | number, label: string) => void;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
}

function removeDiacritics(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const cleanWardName = (name: string) => {
  let s = removeDiacritics(name).toLowerCase().trim();
  s = s.replace(/^(phuong|xa|thi tran)\s+/g, '');
  return s.trim();
};


function CustomSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled = false,
  loading = false,
  required = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const s = removeDiacritics(searchTerm).toLowerCase();
    const l = removeDiacritics(opt.label).toLowerCase();
    return l.includes(s);
  });

  return (
    <div className="flex flex-col relative" ref={containerRef}>
      <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1.5 h-4 flex items-center">
        {label} {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-sm bg-[#FCFCFA] text-left focus:outline-none focus:border-primary disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition hover:border-gray-400"
      >
        <span className={`truncate ${!selectedOption ? 'text-gray-400' : 'text-[var(--text-main)] font-semibold'}`}>
          {loading ? 'Đang tải danh sách...' : selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`size-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-white border border-[var(--border-color)] shadow-2xl p-2 max-h-64 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          {options.length > 5 && (
            <div className="relative mb-2 shrink-0">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-gray-400" />
              <input
                type="text"
                autoFocus
                placeholder="Gõ để tìm nhanh..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary bg-[#FCFCFA]"
              />
            </div>
          )}

          <div className="overflow-y-auto space-y-0.5 max-h-48 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-xs text-gray-400 font-medium">Không tìm thấy dữ liệu</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value, opt.label);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition text-left ${
                      isSelected
                        ? 'bg-[#0F766E]/10 text-[#0F766E] font-bold'
                        : 'text-[var(--text-main)] hover:bg-gray-100 font-medium'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="size-3.5 text-[#0F766E] shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    receiverName: string;
    receiverPhone: string;
    provinceName: string;
    districtName: string;
    wardName: string;
    detail: string;
    provinceId?: number;
    districtId?: number;
    wardCode?: string;
    saveAddressToDb: boolean;
    setAsDefault: boolean;
    calculatedShippingFee?: number;
  }) => void;
  savedAddresses?: any[];
  initialData?: {
    receiverName?: string;
    receiverPhone?: string;
    province?: string;
    district?: string;
    ward?: string;
    detail?: string;
    provinceId?: number;
    districtId?: number;
    wardCode?: string;
  };
  title?: string;
  submitButtonText?: string;
  showSaveOptions?: boolean;
  showShippingFee?: boolean;
  itemsSubtotal?: number;
}

const HANOI_PROVINCE_ID = 1;
const HANOI_PROVINCE_NAME = 'Thành phố Hà Nội';

export default function AddressFormModal({
  isOpen,
  onClose,
  onSubmit,
  savedAddresses,
  initialData,
  title = 'Nhập địa chỉ giao hàng',
  submitButtonText,
  showSaveOptions = false,
  showShippingFee = false,
  itemsSubtotal,
}: AddressFormModalProps) {
  const actionButtonText =
    submitButtonText ||
    (initialData?.receiverName || initialData?.detail ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới');

  const [addressTab, setAddressTab] = useState<'saved' | 'new'>(
    savedAddresses && savedAddresses.length > 0 ? 'saved' : 'new',
  );
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);

  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [saveAddressToDb, setSaveAddressToDb] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(false);

  // Address data is currently limited to Hanoi.
  const [wards, setWards] = useState<HanoiWardOption[]>([]);
  const [wardCode, setWardCode] = useState<string | undefined>(initialData?.wardCode);
  const [wardName, setWardName] = useState<string>(initialData?.ward || '');

  const [loadingWards, setLoadingWards] = useState(false);

  // Fixed shipping fee preview.
  const calculatedShippingFee = showShippingFee ? 30000 : null;
  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (savedAddresses && savedAddresses.length > 0) {
        setAddressTab('saved');
        const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
        handleSelectSavedAddress(defaultAddr);
      } else {
        setAddressTab('new');
        setReceiverName(initialData?.receiverName || '');
        setReceiverPhone(initialData?.receiverPhone || '');
        setDetail(initialData?.detail || '');
        setWardName(initialData?.ward || '');
        setWardCode(initialData?.wardCode);
      }
    }
  }, [initialData, isOpen, savedAddresses]);

  // Fetch Wards for Hanoi (province_id = 1) when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const fetchWards = async () => {
      setLoadingWards(true);
      try {
        const response = await shippingApi.getHanoiWards();
        const list = response.data;
        setWards(list);

        if (initialData?.ward && !initialData?.wardCode) {
          const cleanInit = cleanWardName(initialData.ward);
          let match = list.find((w) => cleanWardName(w.wardName) === cleanInit);
          if (!match) {
            match = list.find((w) => {
              const apiName = removeDiacritics(w.wardName).toLowerCase();
              const initName = removeDiacritics(initialData.ward!).toLowerCase();
              return apiName.includes(initName) || initName.includes(apiName);
            });
          }
          if (match) {
            setWardCode(match.wardCode);
            setWardName(match.wardName);
          }
        }
      } catch (err) {
        console.error('Failed to load Hanoi wards', err);
        setWards([]);
      } finally {
        setLoadingWards(false);
      }
    };

    fetchWards();
  }, [isOpen, initialData?.ward, initialData?.wardCode]);

  const handleSelectSavedAddress = (addr: any) => {
    setSelectedSavedAddressId(addr.id);
    setReceiverName(addr.receiverName || addr.name || '');
    setReceiverPhone(addr.phone || addr.receiverPhone || '');
    setDetail(addr.detail || '');
    setWardName(addr.ward || '');
    setWardCode(addr.wardCode || undefined);
  };

  const handleWardSelect = (val: string | number, label: string) => {
    setWardCode(String(val));
    setWardName(label);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverName.trim() || !receiverPhone.trim() || !detail.trim() || !wardName) {
      toast.error('Vui lòng chọn hoặc điền đầy đủ các thông tin địa chỉ.');
      return;
    }

    if (!wardCode) {
      toast.error('Vui lòng chọn Phường/Xã từ hệ thống.');
      return;
    }

    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    if (!phoneRegex.test(receiverPhone.trim())) {
      toast.error('Số điện thoại không hợp lệ! Vui lòng nhập số điện thoại gồm 10 chữ số.');
      return;
    }

    onSubmit({
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      provinceName: HANOI_PROVINCE_NAME,
      districtName: wardName,
      wardName,
      detail: detail.trim(),
      provinceId: HANOI_PROVINCE_ID,
      districtId: Number(wardCode),
      wardCode,
      saveAddressToDb,
      setAsDefault,
      calculatedShippingFee: calculatedShippingFee ?? undefined,
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const wardOptions: CustomSelectOption[] = wards.map((w) => ({
    value: w.wardCode,
    label: w.wardName,
  }));

  if (!isOpen) return null;

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-black text-[var(--text-main)] flex items-center gap-2">
            <MapPin className="size-5 text-[#0F766E]" />
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-[var(--text-main)] hover:bg-gray-100 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Saved Addresses Tabs */}
        {savedAddresses && savedAddresses.length > 0 && (
          <div className="flex border-b border-[var(--border-color)] text-xs font-extrabold gap-4 pb-2">
            <button
              type="button"
              onClick={() => {
                setAddressTab('saved');
                if (savedAddresses.length > 0) {
                  handleSelectSavedAddress(savedAddresses[0]);
                }
              }}
              className={`pb-2 transition border-b-2 ${
                addressTab === 'saved'
                  ? 'border-[#0F766E] text-[#0F766E]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              📋 Địa chỉ đã lưu ({savedAddresses.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setAddressTab('new');
                setSelectedSavedAddressId(null);
              }}
              className={`pb-2 transition border-b-2 ${
                addressTab === 'new'
                  ? 'border-[#0F766E] text-[#0F766E]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              ✍️ Nhập địa chỉ mới
            </button>
          </div>
        )}

        {/* Tab 1: Saved Addresses List */}
        {addressTab === 'saved' && savedAddresses && savedAddresses.length > 0 && (
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {savedAddresses.map((addr) => {
              const isSelected = selectedSavedAddressId === addr.id;
              const fullStr = `${addr.detail}, ${addr.ward}, ${addr.district}, ${addr.province}`;
              return (
                <div
                  key={addr.id}
                  onClick={() => handleSelectSavedAddress(addr)}
                  className={cn(
                    'p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3',
                    isSelected
                      ? 'border-[#0F766E] bg-teal-50/50 ring-1 ring-[#0F766E]'
                      : 'border-[#EFEAE2] bg-[#FAF9F5] hover:bg-gray-100',
                  )}
                >
                  <input
                    type="radio"
                    name="selectedAddressModal"
                    checked={isSelected}
                    onChange={() => handleSelectSavedAddress(addr)}
                    className="size-4 accent-[#0F766E] mt-0.5"
                  />
                  <div className="flex-1 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[var(--text-main)]">{addr.receiverName || addr.name}</span>
                      <span className="text-gray-400">•</span>
                      <span className="font-mono text-gray-600">{addr.phone || addr.receiverPhone}</span>
                      {addr.isDefault && (
                        <span className="bg-[#0F766E]/10 text-[#0F766E] text-[10px] font-black px-1.5 py-0.5 rounded">
                          Mặc định
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 font-semibold leading-relaxed">{fullStr}</p>
                    {(!addr.districtId || !addr.wardCode) && (
                      <p className="text-[10px] text-amber-700 font-bold italic">
                        ⚠️ Địa chỉ này cần xác nhận lại Phường/Xã để tính phí ship chính xác.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {addressTab === 'new' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">
                    Tên người nhận *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên người nhận"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Nhập số điện thoại"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA]"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-teal-50/70 border border-[#0F766E]/20 p-3 text-xs font-semibold text-[#0F766E] flex items-center gap-2">
                <MapPin className="size-4 shrink-0" />
                <span>📍 Hệ thống hiện tại chỉ áp dụng giao hàng cho các khu vực thuộc <strong>Thành phố Hà Nội</strong>.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fixed Province/City Input */}
                <div>
                  <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1.5 h-4 flex items-center">
                    Tỉnh / Thành phố <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={HANOI_PROVINCE_NAME}
                    className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-sm bg-gray-100 text-gray-700 font-bold cursor-not-allowed"
                  />
                </div>

                {/* Custom Ward Select */}
                <CustomSelect
                  label="Phường / Xã (Hà Nội)"
                  placeholder="Chọn Phường/Xã..."
                  options={wardOptions}
                  value={wardCode}
                  onChange={handleWardSelect}
                  loading={loadingWards}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">
                  Địa chỉ chi tiết (số nhà, đường) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Số 2h, ngõ 81 Duy Tân"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA]"
                />
              </div>

              {showSaveOptions && (
                <div className="flex flex-col gap-2 pt-1 text-xs font-bold">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAddressToDb}
                      onChange={(e) => setSaveAddressToDb(e.target.checked)}
                      className="accent-[var(--primary-color)]"
                    />
                    Lưu địa chỉ này vào sổ địa chỉ
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={setAsDefault}
                      onChange={(e) => setSetAsDefault(e.target.checked)}
                      className="accent-[var(--primary-color)]"
                    />
                    Đặt làm địa chỉ mặc định
                  </label>
                </div>
              )}
            </>
          )}

          {/* Live Recalculated Shipping Fee & Total Order Preview Box */}
          {showShippingFee && (
            <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-3.5 text-xs space-y-1.5 animate-fadeIn">
              <div className="flex justify-between items-center font-extrabold text-emerald-900">
                <span>Phí vận chuyển mới:</span>
                <span className="text-sm font-black text-[#0F766E]">
                  {calculatedShippingFee !== null ? (
                    formatCurrency(calculatedShippingFee)
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              {itemsSubtotal !== undefined && calculatedShippingFee !== null && (
                <div className="flex justify-between items-center font-black text-gray-900 pt-1.5 border-t border-emerald-200/60 text-sm">
                  <span>Tổng thanh toán đơn hàng sau khi đổi địa chỉ:</span>
                  <span className="text-lg text-[var(--primary-color)] font-mono">
                    {formatCurrency(itemsSubtotal + calculatedShippingFee)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-extrabold text-[var(--text-main)] hover:bg-gray-50 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#0F766E] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#115E59] transition"
            >
              {actionButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
