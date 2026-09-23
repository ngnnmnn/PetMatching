'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { shippingApi, type HanoiWardOption } from '@/lib/api/shipping';
import type { Address } from '@/types';
import AddressAutocompleteInput, { LocationSearchResult } from './AddressAutocompleteInput';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
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

export interface AddressFormData {
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
  lat: number;
  lng: number;
}

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddressFormData) => void;

  savedAddresses?: Address[];
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
    latitude?: number | null;
    longitude?: number | null;
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
  const [selectedLat, setSelectedLat] = useState<number | undefined>();
  const [selectedLng, setSelectedLng] = useState<number | undefined>();
  const [saveAddressToDb, setSaveAddressToDb] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(false);

  // Address data is currently limited to Hanoi.
  const [wards, setWards] = useState<HanoiWardOption[]>([]);
  const [wardCode, setWardCode] = useState<string | undefined>(initialData?.wardCode);
  const [wardName, setWardName] = useState<string>(initialData?.ward || '');

  // Cước phí giao hỏa tốc AhaMove tính toán thời gian thực (nếu chưa có địa chỉ thì để null)
  const [dynamicShippingFee, setDynamicShippingFee] = useState<number | null>(null);
  const calculatedShippingFee = showShippingFee
    ? itemsSubtotal !== undefined && itemsSubtotal > 500000
      ? 0
      : dynamicShippingFee
    : null;
  // Ref ghi nhớ trạng thái đã khởi tạo form để chỉ chạy 1 lần khi mở Modal, tránh tự động reset tab khi re-render hoặc auto-polling
  const hasInitializedRef = useRef(false);

  /**
   * Hàm khởi tạo dữ liệu ban đầu cho form địa chỉ khi Modal được mở (isOpen = true).
   * Phân loại:
   * - Nếu có initialData (Sửa địa chỉ đơn hàng): Mở sẵn tab 'new' và điền địa chỉ hiện tại của đơn hàng.
   * - Nếu không có initialData nhưng có địa chỉ đã lưu: Mở tab 'saved' và chọn địa chỉ mặc định.
   * - Nếu không có gì: Mở tab 'new' trống.
   */
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    if (hasInitializedRef.current) return;

    const timer = window.setTimeout(() => {
      hasInitializedRef.current = true;
      if (initialData?.receiverName || initialData?.detail) {
        setAddressTab('new');
        setReceiverName(initialData.receiverName || '');
        setReceiverPhone(initialData.receiverPhone || '');
        setDetail(initialData.detail || '');
        setWardName(initialData.ward || '');
        setWardCode(initialData.wardCode);
        setSelectedLat(initialData.latitude ?? undefined);
        setSelectedLng(initialData.longitude ?? undefined);
      } else if (savedAddresses && savedAddresses.length > 0) {
        setAddressTab('saved');
        const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
        setSelectedSavedAddressId(defaultAddr.id);
        setReceiverName(defaultAddr.receiverName || '');
        setReceiverPhone(defaultAddr.receiverPhone || '');
        setDetail(defaultAddr.detail || '');
        setWardName(defaultAddr.ward || '');
        setWardCode(defaultAddr.wardCode || undefined);
        setSelectedLat(defaultAddr.latitude ?? undefined);
        setSelectedLng(defaultAddr.longitude ?? undefined);
      } else {
        setAddressTab('new');
        setReceiverName('');
        setReceiverPhone('');
        setDetail('');
        setWardName('');
        setWardCode(undefined);
        setSelectedLat(undefined);
        setSelectedLng(undefined);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen, initialData, savedAddresses]);

  // Fetch Wards for Hanoi (province_id = 1) when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const fetchWards = async () => {
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
      }
    };

    fetchWards();
  }, [isOpen, initialData?.ward, initialData?.wardCode]);

  // Tự động tính cước phí giao hỏa tốc AhaMove thời gian thực khi người dùng gõ/chọn địa chỉ mới trong Modal
  useEffect(() => {
    if (!isOpen) return;

    if (!detail || detail.trim().length < 5) {
      const resetTimer = window.setTimeout(() => setDynamicShippingFee(null), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const fullAddress = [detail, wardName, 'Thành phố Hà Nội'].filter(Boolean).join(', ');
    let isCurrentRequest = true;

    const timer = setTimeout(() => {
      shippingApi
        .estimateAhamoveShippingFee({
          dropoffLat: selectedLat,
          dropoffLng: selectedLng,
          addressStr: fullAddress,
        })
        .then((res) => {
          if (isCurrentRequest && typeof res.data?.feeVnd === 'number') {
            setDynamicShippingFee(res.data.feeVnd);
          }
        })
        .catch(() => {});
    }, 400);

    return () => {
      isCurrentRequest = false;
      clearTimeout(timer);
    };
  }, [isOpen, detail, wardName, selectedLat, selectedLng]);

  // Nạp đầy đủ địa chỉ và tọa độ đã lưu để không phải suy đoán lại vị trí giao hàng.
  const handleSelectSavedAddress = (addr: Address) => {
    setSelectedSavedAddressId(addr.id);
    setReceiverName(addr.receiverName || '');
    setReceiverPhone(addr.receiverPhone || '');
    setDetail(addr.detail || '');
    setWardName(addr.ward || '');
    setWardCode(addr.wardCode || undefined);
    setSelectedLat(addr.latitude ?? undefined);
    setSelectedLng(addr.longitude ?? undefined);
  };

  /**
   * Xử lý xác nhận form địa chỉ: Kiểm tra ràng buộc Tên, SĐT và Địa chỉ giao hàng từ OpenStreetMap
   * @param e Sự kiện Submit form
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalWardCode = wardCode;
    let finalWardName = wardName;
    if (!finalWardCode && wards.length > 0) {
      finalWardCode = wards[0].wardCode;
      finalWardName = wards[0].wardName;
    }

    if (!receiverName.trim() || !receiverPhone.trim() || !detail.trim()) {
      toast.error('Vui lòng nhập tên, số điện thoại và địa chỉ giao hàng.');
      return;
    }

    if (detail.trim().length < 5) {
      toast.error('Vui lòng nhập địa chỉ cụ thể (tối thiểu 5 ký tự) để AhaMove giao hàng chính xác.');
      return;
    }

    let finalLat = selectedLat;
    let finalLng = selectedLng;

    // Tự động sử dụng tọa độ mặc định nếu chọn địa chỉ đã lưu trong quá khứ chưa có GPS
    if (finalLat == null || finalLng == null) {
      finalLat = 21.0285;
      finalLng = 105.8542;
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
      districtName: finalWardName || HANOI_PROVINCE_NAME,
      wardName: finalWardName || HANOI_PROVINCE_NAME,
      detail: detail.trim(),
      provinceId: HANOI_PROVINCE_ID,
      districtId: Number(finalWardCode) || 1,
      wardCode: finalWardCode || '10101',
      saveAddressToDb,
      setAsDefault,
      lat: finalLat,
      lng: finalLng,
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-6"
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl space-y-5 overflow-y-auto overscroll-contain rounded-3xl border border-[var(--border-color)] bg-white p-5 text-left shadow-2xl animate-in zoom-in-95 duration-200 sm:p-7 xl:overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
          <h2 className="flex items-center gap-2.5 text-lg font-black text-[var(--text-main)] sm:text-xl">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0F766E]/10">
              <MapPin className="size-5 text-[#0F766E]" />
            </span>
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
            {/* Tab 1: Sửa địa chỉ hiện tại / Nhập địa chỉ mới (đặt lên trước theo yêu cầu người dùng) */}
            <button
              type="button"
              onClick={() => {
                setAddressTab('new');
                setSelectedSavedAddressId(null);
              }}
              className={`pb-2 transition border-b-2 ${addressTab === 'new'
                  ? 'border-[#0F766E] text-[#0F766E]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
            >
              {initialData?.receiverName || initialData?.detail ? '✏️ Sửa địa chỉ hiện tại' : '✍️ Nhập địa chỉ mới'}
            </button>
            {/* Tab 2: Danh sách địa chỉ đã lưu trong tài khoản */}
            <button
              type="button"
              onClick={() => {
                setAddressTab('saved');
                if (savedAddresses.length > 0) {
                  handleSelectSavedAddress(savedAddresses[0]);
                }
              }}
              className={`pb-2 transition border-b-2 ${addressTab === 'saved'
                  ? 'border-[#0F766E] text-[#0F766E]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
            >
              📋 Địa chỉ đã lưu ({savedAddresses.length})
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
                      <span className="font-extrabold text-sm text-[var(--text-main)]">{addr.receiverName}</span>
                      <span className="text-gray-400">•</span>
                      <span className="font-mono text-gray-600">{addr.receiverPhone}</span>
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
        <form onSubmit={handleSubmit} className="space-y-5">
          {addressTab === 'new' && (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-extrabold text-[var(--text-main)]">
                    Tên người nhận *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên người nhận"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="min-h-12 w-full rounded-xl border border-[var(--border-color)] bg-[#FCFCFA] px-4 py-3 text-sm focus-visible:border-primary focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-extrabold text-[var(--text-main)]">
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Nhập số điện thoại"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="min-h-12 w-full rounded-xl border border-[var(--border-color)] bg-[#FCFCFA] px-4 py-3 text-sm focus-visible:border-primary focus-visible:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-[#0F766E]/20 bg-teal-50/70 px-4 py-3 text-xs font-semibold leading-5 text-[#0F766E]">
                <MapPin className="size-4 shrink-0" />
                <span>Hệ thống hiện tại chỉ áp dụng giao hàng cho các khu vực thuộc <strong>Thành phố Hà Nội</strong>.</span>
              </div>

              {/* Ô Tìm kiếm / Nhập địa chỉ tự động bằng OpenStreetMap Autocomplete duy nhất */}
              <div className="rounded-2xl border border-teal-200 bg-emerald-50/40 p-4 space-y-2">
                <AddressAutocompleteInput
                  label="📍 Nhập hoặc tìm kiếm địa chỉ giao hàng trên bản đồ OpenStreetMap"
                  placeholder="Gõ số nhà, tên đường, tòa nhà hoặc địa danh tại Hà Nội..."
                  initialValue={detail}
                  required
                  onChangeText={(val) => {
                    setDetail(val);
                    if (!wardCode && wards.length > 0) {
                      setWardCode(wards[0].wardCode);
                      setWardName(wards[0].wardName);
                    }
                  }}
                  onSelectLocation={(loc: LocationSearchResult) => {
                    const chosenAddrStr = loc.address || loc.detail;
                    setDetail(chosenAddrStr);
                    if (loc.ward) {
                      const cleanLoc = cleanWardName(loc.ward);
                      const match = wards.find(
                        (w) =>
                          cleanWardName(w.wardName).includes(cleanLoc) ||
                          cleanLoc.includes(cleanWardName(w.wardName)),
                      );
                      if (match) {
                        setWardCode(match.wardCode);
                        setWardName(match.wardName);
                      } else if (wards.length > 0) {
                        setWardCode(wards[0].wardCode);
                        setWardName(wards[0].wardName);
                      }
                    } else if (wards.length > 0) {
                      setWardCode(wards[0].wardCode);
                      setWardName(wards[0].wardName);
                    }
                    setSelectedLat(loc.lat);
                    setSelectedLng(loc.lng);
                    // Effect báo giá có debounce sẽ xử lý một lần sau khi tọa độ được cập nhật.
                    toast.success(`Đã chọn vị trí: ${chosenAddrStr}`);
                  }}
                />
                <p className="text-[11px] font-semibold text-teal-800">
                  ⚡ <strong>Hệ thống tự động định vị bản đồ OpenStreetMap</strong> để tính toán khoảng cách và phí giao hàng AhaMove!
                </p>
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

          {/* Hiển thị cước phí vận chuyển mới khi đổi địa chỉ. Tổng tiền chính thức do backend tính. */}
          {showShippingFee && (
            <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-3.5 text-xs space-y-1.5 animate-fadeIn">
              <div className="flex justify-between items-center font-extrabold text-emerald-900">
                <span>Phí vận chuyển mới:</span>
                <span className="text-sm font-black text-[#0F766E]">
                  {calculatedShippingFee !== null ? (
                    formatCurrency(calculatedShippingFee)
                  ) : (
                    <span className="text-xs text-amber-700 font-medium font-sans">Chưa chọn địa chỉ</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-[var(--border-color)] px-6 py-2.5 text-sm font-extrabold text-[var(--text-main)] transition hover:bg-gray-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-xl bg-[#0F766E] px-7 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#115E59]"
            >
              {actionButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
