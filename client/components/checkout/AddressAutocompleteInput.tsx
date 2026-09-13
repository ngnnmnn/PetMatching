'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2, X, Check } from 'lucide-react';
import { shippingApi } from '@/lib/api/shipping';

export interface LocationSearchResult {
  address: string;
  detail: string;
  ward: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteInputProps {
  label?: string;
  placeholder?: string;
  initialValue?: string;
  onSelectLocation: (result: LocationSearchResult) => void;
  // Callback theo dõi thay đổi trực tiếp văn bản nhập địa chỉ
  onChangeText?: (text: string) => void;
  required?: boolean;
}

/**
 * Hàm gọi API Backend để tìm kiếm gợi ý địa chỉ khu vực Hà Nội từ OpenStreetMap (với cơ chế Fallback trực tiếp nếu Server chưa reload)
 * @param query Từ khóa địa chỉ người dùng gõ
 */
async function fetchHanoiAddressSuggestions(query: string): Promise<LocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();

  // 1. Ưu tiên gọi API Backend PetMatching
  try {
    const res = await shippingApi.searchAddressAutocomplete(q);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data;
    }
  } catch (err) {
    console.warn('Backend Autocomplete API chưa hồi đáp, chuyển sang Client Fallback:', err);
  }

  // 2. Client Fallback gọi trực tiếp Photon OpenStreetMap API nếu Backend chưa reload
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ' Ha Noi')}&limit=12`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      const features = data?.features || [];
      const results: LocationSearchResult[] = [];

      for (const feat of features) {
        const props = feat.properties || {};
        const coords = feat.geometry?.coordinates || [0, 0];
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);

        // Lọc nghiêm ngặt khung tọa độ GPS Hà Nội
        const isStrictHanoiGPS = lat >= 20.53 && lat <= 21.39 && lng >= 105.28 && lng <= 106.02;
        if (!isStrictHanoiGPS) continue;

        const name = props.name || '';
        const street = props.street || props.name || '';
        const houseNumber = props.housenumber ? `Số ${props.housenumber}, ` : '';
        const district = props.district || props.suburb || props.city || 'Hà Nội';
        const city = 'Thành phố Hà Nội';

        let fullAddress = '';
        if (houseNumber) fullAddress += houseNumber;
        if (street) fullAddress += street;
        if (name && name !== street) fullAddress += ` (${name})`;
        if (district && !fullAddress.includes(district)) fullAddress += `, ${district}`;
        if (!fullAddress.includes('Hà Nội')) fullAddress += ', Thành phố Hà Nội';

        const lowerAddr = fullAddress.toLowerCase();
        if (
          lowerAddr.includes('hồ chí minh') ||
          lowerAddr.includes('sài gòn') ||
          lowerAddr.includes('đà nẵng') ||
          lowerAddr.includes('bình dương')
        ) {
          continue;
        }

        results.push({
          address: fullAddress,
          detail: `${houseNumber}${street || name}`.trim() || fullAddress,
          ward: district,
          district: district,
          province: city,
          lng: lng,
          lat: lat,
        });
      }

      return results;
    }
  } catch (err) {
    console.error('Client Fallback Photon API error:', err);
  }

  return [];
}

/**
 * Component ô nhập địa chỉ thông minh với gợi ý bản đồ tự động OpenStreetMap (Autocomplete)
 */
export default function AddressAutocompleteInput({
  label = '📍 Tìm địa chỉ tự động trên bản đồ *',
  placeholder = 'Gõ tên đường, số nhà hoặc địa danh (Ví dụ: 32 Đội Cấn, Duy Tân...)',
  initialValue = '',
  onSelectLocation,
  onChangeText,
  required = false,
}: AddressAutocompleteInputProps) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<LocationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(initialValue || null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ghi nhớ giá trị initialValue từ props để cập nhật searchTerm khi initialValue thay đổi từ bên ngoài
  const prevInitialValueRef = useRef(initialValue);
  useEffect(() => {
    if (initialValue !== prevInitialValueRef.current) {
      prevInitialValueRef.current = initialValue;
      setSearchTerm(initialValue || '');
    }
  }, [initialValue]);

  // Đóng danh sách gợi ý khi click ra ngoài ô nhập
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Đèn đếm thời gian Debounce 350ms: Chờ người dùng ngừng gõ chữ mới phát yêu cầu tìm kiếm
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2 || searchTerm === selectedAddress) {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const results = await fetchHanoiAddressSuggestions(searchTerm);
      setSuggestions(results);
      setLoading(false);
      if (results.length > 0) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedAddress]);

  /**
   * Hàm xử lý khi người dùng chọn 1 địa chỉ gợi ý từ bản đồ OpenStreetMap
   * @param item Đối tượng thông tin vị trí địa chỉ
   */
  const handleSelect = (item: LocationSearchResult) => {
    const chosenAddressStr = item.address || item.detail;
    setSearchTerm(chosenAddressStr);
    setSelectedAddress(chosenAddressStr);
    setSuggestions([]);
    setIsOpen(false);
    onSelectLocation(item);
  };

  /**
   * Hàm xóa sạch từ khóa tìm kiếm địa chỉ và đưa ô nhập về trạng thái ban đầu
   */
  const handleClear = () => {
    setSearchTerm('');
    setSelectedAddress(null);
    setSuggestions([]);
    setIsOpen(false);
    if (onChangeText) onChangeText('');
  };

  return (
    <div className="relative flex flex-col space-y-1.5" ref={containerRef}>
      {label && (
        <label className="text-xs font-extrabold text-[var(--text-main)] flex items-center gap-1.5">
          <MapPin className="size-4 text-[#0F766E]" />
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            setSelectedAddress(null);
            if (onChangeText) onChangeText(val);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="min-h-12 w-full rounded-xl border border-[var(--border-color)] bg-[#FCFCFA] pl-10 pr-10 py-3 text-sm font-medium focus-visible:border-[#0F766E] focus-visible:outline-none shadow-sm transition"
        />

        <Search className="absolute left-3 size-4.5 text-gray-400 pointer-events-none" />

        {loading && (
          <Loader2 className="absolute right-3 size-4.5 animate-spin text-[#0F766E]" />
        )}

        {!loading && searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Menu danh sách các địa chỉ gợi ý từ bản đồ OpenStreetMap */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-[80] mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-white p-2 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
          {suggestions.length === 0 ? (
            <div className="py-4 text-center text-xs text-gray-500 font-medium">
              Không tìm thấy địa chỉ phù hợp. Vui lòng nhập rõ hơn tên đường/phố.
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[11px] font-black text-[#0F766E] uppercase tracking-wider bg-teal-50/60 rounded-lg flex items-center justify-between">
                <span>📍 Gợi ý địa chỉ chuẩn trên bản đồ OpenStreetMap:</span>
              </div>
              {suggestions.map((item, idx) => {
                const isSelected = selectedAddress === item.address || selectedAddress === item.detail;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-start gap-3 p-2.5 text-xs rounded-xl transition text-left ${
                      isSelected
                        ? 'bg-[#0F766E]/10 text-[#0F766E] font-bold'
                        : 'text-[var(--text-main)] hover:bg-teal-50/50 font-medium'
                    }`}
                  >
                    <MapPin className="size-4 text-[#0F766E] shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-0.5">
                      <p className="font-bold text-sm text-[var(--text-main)] leading-snug">
                        {item.address}
                      </p>
                      <p className="text-[11px] text-gray-500 font-mono">
                        Tọa độ GPS: {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                      </p>
                    </div>
                    {isSelected && <Check className="size-4 text-[#0F766E] shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
