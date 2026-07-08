'use client';

import { useState, useEffect } from 'react';
import { X, MapPin } from 'lucide-react';

interface Province {
  code: number;
  name: string;
}

interface District {
  code: number;
  name: string;
}

interface Ward {
  code: number;
  name: string;
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
  };
  title?: string;
  showSaveOptions?: boolean;
}

function removeDiacritics(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export default function AddressFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  title = 'Nhập địa chỉ giao hàng',
  showSaveOptions = false
}: AddressFormModalProps) {
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [saveAddressToDb, setSaveAddressToDb] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(false);

  // APIs
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);

  const [provinceCode, setProvinceCode] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [wardCode, setWardCode] = useState('');

  const [provinceName, setProvinceName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [wardName, setWardName] = useState('');
  
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // Initialize form when opening/initialData changes
  useEffect(() => {
    if (isOpen) {
      setReceiverName(initialData?.receiverName || '');
      setReceiverPhone(initialData?.receiverPhone || '');
      setDetail(initialData?.detail || '');
      setProvinceName(initialData?.province || '');
      setDistrictName(initialData?.district || '');
      setWardName(initialData?.ward || '');
      
      setProvinceCode('');
      setDistrictCode('');
      setWardCode('');
      setDistricts([]);
      setWards([]);
    }
  }, [initialData, isOpen]);

  // Load provinces
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchProvinces = async () => {
      setLoadingProvinces(true);
      try {
        const res = await fetch('https://provinces.open-api.vn/api/p/');
        const data = await res.json();
        setProvinces(data);
        
        // If initialData exists, try to find province code by name matching
        if (initialData?.province) {
          const match = data.find((p: Province) => {
            const apiName = removeDiacritics(p.name).toLowerCase();
            const initName = removeDiacritics(initialData.province!).toLowerCase();
            return apiName.includes(initName) || initName.includes(apiName);
          });
          if (match) {
            setProvinceCode(String(match.code));
            setProvinceName(match.name);
          }
        }
      } catch (err) {
        console.error('Failed to load provinces', err);
      } finally {
        setLoadingProvinces(false);
      }
    };
    fetchProvinces();
  }, [isOpen, initialData?.province]);

  // Load districts
  useEffect(() => {
    if (!provinceCode) {
      setDistricts([]);
      setWards([]);
      setDistrictCode('');
      setWardCode('');
      return;
    }

    const fetchDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const res = await fetch(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);
        const data = await res.json();
        const list = data.districts || [];
        setDistricts(list);
        setWards([]);
        setDistrictCode('');
        setWardCode('');
        
        // Auto-match initial district
        if (initialData?.district && list.length > 0) {
          const match = list.find((d: District) => {
            const apiName = removeDiacritics(d.name).toLowerCase();
            const initName = removeDiacritics(initialData.district!).toLowerCase();
            return apiName.includes(initName) || initName.includes(apiName);
          });
          if (match) {
            setDistrictCode(String(match.code));
            setDistrictName(match.name);
          }
        }
      } catch (err) {
        console.error('Failed to load districts', err);
      } finally {
        setLoadingDistricts(false);
      }
    };
    fetchDistricts();
  }, [provinceCode, initialData?.district]);

  // Load wards
  useEffect(() => {
    if (!districtCode) {
      setWards([]);
      setWardCode('');
      return;
    }

    const fetchWards = async () => {
      setLoadingWards(true);
      try {
        const res = await fetch(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`);
        const data = await res.json();
        const list = data.wards || [];
        setWards(list);
        setWardCode('');
        
        // Auto-match initial ward
        if (initialData?.ward && list.length > 0) {
          const match = list.find((w: Ward) => {
            const apiName = removeDiacritics(w.name).toLowerCase();
            const initName = removeDiacritics(initialData.ward!).toLowerCase();
            return apiName.includes(initName) || initName.includes(apiName);
          });
          if (match) {
            setWardCode(String(match.code));
            setWardName(match.name);
          }
        }
      } catch (err) {
        console.error('Failed to load wards', err);
      } finally {
        setLoadingWards(false);
      }
    };
    fetchWards();
  }, [districtCode, initialData?.ward]);

  if (!isOpen) return null;

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setProvinceCode(val);
    const pName = provinces.find((p) => String(p.code) === val)?.name || '';
    setProvinceName(pName);
    setDistrictCode('');
    setWardCode('');
    setDistrictName('');
    setWardName('');
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDistrictCode(val);
    const dName = districts.find((d) => String(d.code) === val)?.name || '';
    setDistrictName(dName);
    setWardCode('');
    setWardName('');
  };

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setWardCode(val);
    const wName = wards.find((w) => String(w.code) === val)?.name || '';
    setWardName(wName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverName.trim() || !receiverPhone.trim() || !detail.trim() || !provinceName || !districtName || !wardName) {
      return;
    }

    onSubmit({
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      provinceName,
      districtName,
      wardName,
      detail: detail.trim(),
      saveAddressToDb,
      setAsDefault
    });
  };

  // Close when clicking overlay
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
        
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
              <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">Tên người nhận *</label>
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
              <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">Số điện thoại *</label>
              <input
                type="tel"
                required
                placeholder="Nhập số điện thoại"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Province Select */}
            <div>
              <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">Tỉnh / Thành *</label>
              <select
                required
                value={provinceCode}
                onChange={handleProvinceChange}
                className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA]"
              >
                <option value="">Chọn tỉnh/thành</option>
                {loadingProvinces ? (
                  <option disabled>Đang tải...</option>
                ) : (
                  provinces.map((prov) => (
                    <option key={prov.code} value={prov.code}>{prov.name}</option>
                  ))
                )}
              </select>
            </div>

            {/* District Select */}
            <div>
              <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">Quận / Huyện *</label>
              <select
                required
                disabled={!provinceCode || loadingDistricts}
                value={districtCode}
                onChange={handleDistrictChange}
                className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA] disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">Chọn quận/huyện</option>
                {loadingDistricts ? (
                  <option disabled>Đang tải...</option>
                ) : (
                  districts.map((dist) => (
                    <option key={dist.code} value={dist.code}>{dist.name}</option>
                  ))
                )}
              </select>
            </div>

            {/* Ward Select */}
            <div>
              <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">Phường / Xã *</label>
              <select
                required
                disabled={!districtCode || loadingWards}
                value={wardCode}
                onChange={handleWardChange}
                className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA] disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">Chọn phường/xã</option>
                {loadingWards ? (
                  <option disabled>Đang tải...</option>
                ) : (
                  wards.map((w) => (
                    <option key={w.code} value={w.code}>{w.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">Địa chỉ chi tiết (số nhà, đường) *</label>
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
                Lưu địa chỉ này cho lần sau
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
