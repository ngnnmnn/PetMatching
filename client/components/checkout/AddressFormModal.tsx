'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MapPin, ChevronDown, Search, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Province {
  provinceId: number;
  provinceName: string;
  code?: string;
}

interface District {
  districtId: number;
  districtName: string;
  code?: string;
}

interface Ward {
  wardCode: string;
  wardName: string;
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

const cleanAddressName = (name: string, type: 'province' | 'district' | 'ward') => {
  let s = removeDiacritics(name).toLowerCase().trim();
  if (type === 'province') {
    s = s.replace(/^(tinh|thanh pho|tp)\s+/g, '');
  } else if (type === 'district') {
    s = s.replace(/^(quan|huyen|thi xa|thanh pho|tp)\s+/g, '');
  } else if (type === 'ward') {
    s = s.replace(/^(phuong|xa|thi tran)\s+/g, '');
  }
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
          {loading ? 'Đang tải GHN...' : selectedOption ? selectedOption.label : placeholder}
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
  }) => void;
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
  showSaveOptions?: boolean;
}

export default function AddressFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  title = 'Nhập địa chỉ giao hàng',
  showSaveOptions = false,
}: AddressFormModalProps) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [saveAddressToDb, setSaveAddressToDb] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(false);

  // GHN Address Data
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);

  const [provinceId, setProvinceId] = useState<number | undefined>(initialData?.provinceId);
  const [districtId, setDistrictId] = useState<number | undefined>(initialData?.districtId);
  const [wardCode, setWardCode] = useState<string | undefined>(initialData?.wardCode);

  const [provinceName, setProvinceName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [wardName, setWardName] = useState('');

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setReceiverName(initialData?.receiverName || '');
      setReceiverPhone(initialData?.receiverPhone || '');
      setDetail(initialData?.detail || '');
      setProvinceName(initialData?.province || '');
      setDistrictName(initialData?.district || '');
      setWardName(initialData?.ward || '');

      setProvinceId(initialData?.provinceId);
      setDistrictId(initialData?.districtId);
      setWardCode(initialData?.wardCode);

      setDistricts([]);
      setWards([]);
    }
  }, [initialData, isOpen]);

  // Fetch GHN Provinces
  useEffect(() => {
    if (!isOpen) return;

    const fetchProvinces = async () => {
      setLoadingProvinces(true);
      try {
        const res = await fetch(`${apiBaseUrl}/shipping/provinces`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setProvinces(list);

        if (initialData?.province && !initialData?.provinceId) {
          const cleanInit = cleanAddressName(initialData.province, 'province');
          // 1. Try exact cleaned name match first
          let match = list.find((p: Province) => cleanAddressName(p.provinceName, 'province') === cleanInit);
          // 2. Fallback to fuzzy match
          if (!match) {
            match = list.find((p: Province) => {
              const apiName = removeDiacritics(p.provinceName).toLowerCase();
              const initName = removeDiacritics(initialData.province!).toLowerCase();
              return apiName.includes(initName) || initName.includes(apiName);
            });
          }
          if (match) {
            setProvinceId(match.provinceId);
            setProvinceName(match.provinceName);
          }
        }
      } catch (err) {
        console.error('Failed to load GHN provinces', err);
        setProvinces([]);
      } finally {
        setLoadingProvinces(false);
      }
    };

    fetchProvinces();
  }, [isOpen, initialData?.province, apiBaseUrl]);

  // Fetch GHN Districts when provinceId changes
  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      setWards([]);
      setDistrictId(undefined);
      setWardCode(undefined);
      return;
    }

    const fetchDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const res = await fetch(`${apiBaseUrl}/shipping/districts?province_id=${provinceId}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setDistricts(list);
        setWards([]);
        setWardCode(undefined);

        if (initialData?.district && !initialData?.districtId && list.length > 0) {
          const cleanInit = cleanAddressName(initialData.district, 'district');
          // 1. Try exact cleaned name match first
          let match = list.find((d: District) => cleanAddressName(d.districtName, 'district') === cleanInit);
          // 2. Fallback to fuzzy match
          if (!match) {
            match = list.find((d: District) => {
              const apiName = removeDiacritics(d.districtName).toLowerCase();
              const initName = removeDiacritics(initialData.district!).toLowerCase();
              return apiName.includes(initName) || initName.includes(apiName);
            });
          }
          if (match) {
            setDistrictId(match.districtId);
            setDistrictName(match.districtName);
          }
        }
      } catch (err) {
        console.error('Failed to load GHN districts', err);
        setDistricts([]);
      } finally {
        setLoadingDistricts(false);
      }
    };

    fetchDistricts();
  }, [provinceId, initialData?.district, apiBaseUrl]);

  // Fetch GHN Wards when districtId changes
  useEffect(() => {
    if (!districtId) {
      setWards([]);
      setWardCode(undefined);
      return;
    }

    const fetchWards = async () => {
      setLoadingWards(true);
      try {
        const res = await fetch(`${apiBaseUrl}/shipping/wards?district_id=${districtId}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setWards(list);

        if (initialData?.ward && !initialData?.wardCode && list.length > 0) {
          const cleanInit = cleanAddressName(initialData.ward, 'ward');
          // 1. Try exact cleaned name match first
          let match = list.find((w: Ward) => cleanAddressName(w.wardName, 'ward') === cleanInit);
          // 2. Fallback to fuzzy match
          if (!match) {
            match = list.find((w: Ward) => {
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
        console.error('Failed to load GHN wards', err);
        setWards([]);
      } finally {
        setLoadingWards(false);
      }
    };

    fetchWards();
  }, [districtId, initialData?.ward, apiBaseUrl]);

  if (!isOpen) return null;

  const handleProvinceSelect = (val: string | number, label: string) => {
    const pId = Number(val);
    setProvinceId(pId);
    setProvinceName(label);
    setDistrictId(undefined);
    setDistrictName('');
    setWardCode(undefined);
    setWardName('');
  };

  const handleDistrictSelect = (val: string | number, label: string) => {
    const dId = Number(val);
    setDistrictId(dId);
    setDistrictName(label);
    setWardCode(undefined);
    setWardName('');
  };

  const handleWardSelect = (val: string | number, label: string) => {
    setWardCode(String(val));
    setWardName(label);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverName.trim() || !receiverPhone.trim() || !detail.trim() || !provinceName || !districtName || !wardName) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    if (!provinceId || !districtId || !wardCode) {
      toast.error('Vui lòng chọn địa chỉ Tỉnh/Thành, Quận/Huyện, và Phường/Xã từ danh sách gợi ý của GHN.');
      return;
    }

    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    if (!phoneRegex.test(receiverPhone.trim())) {
      toast.error('Số điện thoại không hợp lệ! Vui lòng nhập số điện thoại Việt Nam gồm 10 chữ số (ví dụ: 0987654321).');
      return;
    }

    onSubmit({
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      provinceName,
      districtName,
      wardName,
      detail: detail.trim(),
      provinceId,
      districtId,
      wardCode,
      saveAddressToDb,
      setAsDefault,
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const provinceOptions: CustomSelectOption[] = provinces.map((p) => ({
    value: p.provinceId,
    label: p.provinceName,
  }));

  const districtOptions: CustomSelectOption[] = districts.map((d) => ({
    value: d.districtId,
    label: d.districtName,
  }));

  const wardOptions: CustomSelectOption[] = wards.map((w) => ({
    value: w.wardCode,
    label: w.wardName,
  }));

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-visible rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Custom Province Select */}
            <CustomSelect
              label="Tỉnh / Thành"
              placeholder="Chọn Tỉnh/Thành"
              options={provinceOptions}
              value={provinceId}
              onChange={handleProvinceSelect}
              loading={loadingProvinces}
              required
            />

            {/* Custom District Select */}
            <CustomSelect
              label="Quận / Huyện"
              placeholder="Chọn Quận/Huyện"
              options={districtOptions}
              value={districtId}
              onChange={handleDistrictSelect}
              disabled={!provinceId}
              loading={loadingDistricts}
              required
            />

            {/* Custom Ward Select */}
            <CustomSelect
              label="Phường / Xã"
              placeholder="Chọn Phường/Xã"
              options={wardOptions}
              value={wardCode}
              onChange={handleWardSelect}
              disabled={!districtId}
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
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
