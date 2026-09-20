'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { downloadExcelFile } from '@/lib/download-file';
import {
  FileSpreadsheet,
  Filter,
  Upload,
  Folder,
  Package,
  Plus,
  Search,
  ShoppingBag,
  TrendingUp,
  Users,
  Edit2,
  Trash2,
  X,
  Loader2,
  Calendar,
  Check,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ChevronsRight,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FolderKanban,
  Camera,
  ImageIcon,
  PieChart,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  managerApi,
  ManagerActivitySnapshot,
  ManagerCustomer,
  ManagerDashboardStats,
  ManagerOrder,
  ManagerProduct,
  ManagerProductInput,
  ManagerProductVariant,
  ManagerProductVariantInput,
} from '@/lib/api/manager';
import { shippingApi } from '@/lib/api/shipping';

/**
 * Định dạng số thành chuỗi phân cách hàng nghìn bằng dấu chấm chuẩn tiền Việt (ví dụ: 3000 -> "3.000")
 */
function formatNumberWithDots(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  const raw = String(val).replace(/\D/g, '');
  if (!raw) return '';
  return Number(raw).toLocaleString('vi-VN');
}

/**
 * Trích xuất chuỗi số nguyên thô từ chuỗi có dấu chấm phân cách (ví dụ: "3.000" -> "3000")
 */
function parseRawNumber(val: string): string {
  return val.replace(/\D/g, '');
}

/**
 * Chuyển đổi và làm sạch giá trị trọng lượng nhập vào (chấp nhận cả dấu phẩy "1,2" và dấu chấm "1.2")
 */
function parseWeightKg(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0.5;
  const str = String(val).replace(',', '.').trim();
  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) return 0.5;
  return num;
}

/**
 * Tính toán giá sau giảm giá từ loại giảm (NONE / AMOUNT / PERCENT) và giá trị giảm
 * Trả về giá bán thực tế salePrice hoặc thông báo lỗi nếu nhập không hợp lệ
 */
function computeSalePrice(
  sellingPriceNum: number,
  discountType: 'NONE' | 'AMOUNT' | 'PERCENT',
  discountValueStr: string,
  importPriceNum?: number,
): { salePrice: number | null; error?: string } {
  if (discountType === 'NONE' || !discountValueStr || discountValueStr.trim() === '') {
    return { salePrice: null };
  }
  const val = Number(discountValueStr);
  if (isNaN(val) || val < 0) {
    return { salePrice: null, error: 'Mức giảm giá không hợp lệ.' };
  }
  if (val === 0) {
    return { salePrice: null }; // 0đ hoặc 0% nghĩa là chưa áp dụng giảm giá, không báo lỗi
  }

  if (discountType === 'AMOUNT') {
    if (importPriceNum && importPriceNum > 0 && val > importPriceNum) {
      return {
        salePrice: null,
        error: `Số tiền giảm giá phải ≤ giá nhập hàng (${importPriceNum.toLocaleString('vi-VN')}đ).`,
      };
    }
    if (val >= sellingPriceNum) {
      return { salePrice: null, error: 'Số tiền giảm phải nhỏ hơn giá bán niêm yết.' };
    }
    return { salePrice: sellingPriceNum - val };
  } else {
    if (val >= 100) {
      return { salePrice: null, error: 'Phần trăm giảm giá phải nhỏ hơn 100%.' };
    }
    const discountAmount = Math.round((sellingPriceNum * val) / 100);
    return { salePrice: sellingPriceNum - discountAmount };
  }
}
import { productsApi } from '@/lib/api/products';
import { Category } from '@/types';
import { uploadImages } from '@/lib/api/uploads';
import dynamic from 'next/dynamic';

/**
 * Tải lười các Modal chỉ khi người dùng click mở để giảm tải bundle JS ban đầu
 */
const ConfirmDialog = dynamic(() => import('@/components/ui/ConfirmDialog'), { ssr: false });
const OrderTrackingModal = dynamic(() => import('@/components/orders/OrderTrackingModal'), { ssr: false });
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

// Currency Formatter
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

const CATEGORY_MAP: Record<string, string> = {
  DOG_FOOD: 'Thức ăn cho chó',
  CAT_FOOD: 'Thức ăn cho mèo',
  TOY: 'Đồ chơi',
  ACCESSORY: 'Phụ kiện',
  GROOMING: 'Vệ sinh & Chăm sóc',
  CAGE_BED: 'Chuồng & Đệm nằm',
  LEASH_COLLAR: 'Vòng cổ & Dây dắt',
};

// Mapping nhãn hiển thị trạng thái đơn hàng chuẩn hóa: PENDING -> CONFIRMED -> SHIPPED -> DELIVERED -> CANCELLED
const ORDER_STATUS_MAP: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  SHIPPED: 'Đang giao hàng',
  DELIVERED: 'Giao hàng thành công',
  CANCELLED: 'Đã hủy',
};


/**
 * Định dạng ẩn 6 số đầu của số điện thoại và giữ lại 4 chữ số cuối: ******1234
 */
function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return 'Chưa cung cấp';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '******' + digits;
  return '******' + digits.slice(-4);
}

/**
 * Kiểm tra xem sản phẩm có biến thể nào có số lượng tồn kho < 5 (hoặc hết hàng = 0) không
 */
function hasLowStockWarning(p: ManagerProduct): boolean {
  if (p.variants && p.variants.length > 0) {
    return p.variants.some((v) => (v.stock ?? 0) < 5);
  }
  return (p.stock ?? 0) < 5;
}

/**
 * Lấy giá bán hiệu lực của sản phẩm (nếu có biến thể thì lấy giá nhỏ nhất trong các biến thể, ngược lại lấy giá bán/khuyến mãi chính)
 * Phục vụ cho tính năng sắp xếp danh sách sản phẩm theo giá tăng dần hoặc giảm dần
 */
function getProductEffectivePrice(p: ManagerProduct): number {
  if (p.variants && p.variants.length > 0) {
    const variantPrices = p.variants
      .map((v) => (v.salePrice !== undefined && v.salePrice !== null && v.salePrice > 0 ? v.salePrice : v.sellingPrice))
      .filter((price): price is number => price !== undefined && price !== null && !isNaN(price));
    if (variantPrices.length > 0) {
      return Math.min(...variantPrices);
    }
  }
  return p.salePrice !== undefined && p.salePrice !== null && p.salePrice > 0
    ? p.salePrice
    : (p.sellingPrice || 0);
}

/**
 * Phát âm thanh chuông thông báo cho Store Manager sử dụng Web Audio API tích hợp
 */
function playStoreNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.15);
    gain2.gain.setValueAtTime(0.35, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  } catch {
    // Audio context có thể bị trình duyệt tạm khóa nếu người dùng chưa tương tác với trang
  }
}

/**
 * 7 thuộc tính thông số kỹ thuật cố định cho sản phẩm
 */
interface FixedSpecDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  unitLabel?: string;
  options?: string[];
}

const FIXED_SPECIFICATIONS: FixedSpecDefinition[] = [
  { key: 'origin', label: 'Xuất xứ / Nơi sản xuất', type: 'text', placeholder: 'Ví dụ: Việt Nam, Thái Lan, Pháp...' },
  { key: 'ingredients', label: 'Thành phần & Chất liệu', type: 'text', placeholder: 'Ví dụ: Thịt gà, cá hồi, nhựa PP cao cấp...' },
  { key: 'netWeight', label: 'Trọng lượng tịnh', type: 'number', placeholder: 'Chỉ điền số', unitLabel: 'g / kg' },
  { key: 'volume', label: 'Thể tích / Dung tích', type: 'number', placeholder: 'Chỉ điền số', unitLabel: 'ml / L' },
  { key: 'dimensions', label: 'Kích thước (Dài x Rộng x Cao)', type: 'text', placeholder: 'Ví dụ: 40 x 25 x 30 cm' },
  {
    key: 'targetAge',
    label: 'Độ tuổi thú cưng phù hợp',
    type: 'select',
    options: ['Mọi lứa tuổi', 'Sơ sinh / con < 12 tháng', 'Trưởng thành', 'Cao tuổi'],
  },
  { key: 'shelfLifeAndStorage', label: 'Hạn sử dụng & Bảo quản', type: 'text', placeholder: 'Ví dụ: 24 tháng từ NSX, bảo quản nơi thoáng mát...' },
];

/**
 * Biểu đồ tròn dạng Donut: Ở giữa để trống hoàn toàn (hollow circle).
 * Khi người dùng bấm vào các phân khúc trạng thái (hoặc danh sách), thông số chi tiết hiển thị bên dưới hình ảnh vòng tròn.
 */
const DONUT_STATUS_CONFIG = [
  { key: 'PENDING', label: 'Chờ xác nhận', color: '#F59E0B', bgClass: 'bg-amber-500' },
  { key: 'CONFIRMED', label: 'Đã xác nhận', color: '#3B82F6', bgClass: 'bg-blue-500' },
  { key: 'SHIPPED', label: 'Đang giao', color: '#8B5CF6', bgClass: 'bg-purple-500' },
  { key: 'DELIVERED', label: 'Giao thành công', color: '#10B981', bgClass: 'bg-emerald-500' },
  { key: 'CANCELLED', label: 'Đã hủy', color: '#F43F5E', bgClass: 'bg-rose-500' },
] as const;

function OrderStatusDonutChart({
  distribution,
  totalOrders,
}: {
  distribution?: Record<string, number>;
  totalOrders: number;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const dist = distribution || {};

  // Tính tổng số lượng đơn thực tế từ 5 trạng thái để đảm bảo vòng ngoài điền đủ 100% (không bị hở góc)
  const total = (
    (dist.PENDING ?? 0) +
    (dist.CONFIRMED ?? 0) +
    (dist.SHIPPED ?? 0) +
    (dist.DELIVERED ?? 0) +
    (dist.CANCELLED ?? 0)
  ) || totalOrders || 0;

  const radius = 38;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  let accumulatedLength = 0;
  const segments = DONUT_STATUS_CONFIG.map((cfg) => {
    const count = dist[cfg.key] ?? 0;
    const percent = total > 0 ? (count / total) * 100 : 0;
    const dashLength = total > 0 ? (count / total) * circumference : 0;
    const offset = -accumulatedLength;
    accumulatedLength += dashLength;

    return {
      ...cfg,
      count,
      percent: Math.round(percent),
      dashLength,
      offset,
    };
  });

  const selectedSegment = selectedKey ? segments.find((s) => s.key === selectedKey) : null;
  const activeSegmentsCount = segments.filter((s) => s.count > 0).length;
  const singleFullSegment = segments.find((s) => s.count > 0 && s.count === total);

  // Hàm chọn hoặc bỏ chọn trạng thái khi bấm
  const handleToggleSelect = (key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
      {/* Cột trái: Hình tròn Donut (ở giữa để trống hoàn toàn) & Khung thông số chi tiết cố định kích thước bên dưới */}
      <div className="flex flex-col items-center shrink-0 w-36">
        {/* Vòng tròn Donut: kích thước cố định, tâm vòng tròn để trống hoàn toàn */}
        <div className="relative size-28 shrink-0 flex items-center justify-center">
          <svg className="size-28 -rotate-90 overflow-visible" viewBox="0 0 100 100">
            {/* Vòng nền viền nhạt */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#F3F4F6"
              strokeWidth={strokeWidth}
            />
            {total === 0 ? (
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#E5E7EB"
                strokeWidth={strokeWidth}
              />
            ) : singleFullSegment ? (
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={singleFullSegment.color}
                strokeWidth={strokeWidth}
                className="transition-opacity duration-200 cursor-pointer"
                onClick={() => handleToggleSelect(singleFullSegment.key)}
              >
                <title>{`${singleFullSegment.label}: ${singleFullSegment.count} đơn (100%)`}</title>
              </circle>
            ) : (
              segments.map((s) => {
                if (s.count <= 0) return null;
                const isSelected = selectedKey === s.key;
                return (
                  <circle
                    key={s.key}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={s.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${s.dashLength + (activeSegmentsCount > 1 ? 0.6 : 0)} ${circumference}`}
                    strokeDashoffset={s.offset}
                    strokeLinecap="butt"
                    className="transition-opacity duration-200 cursor-pointer hover:opacity-90"
                    style={{
                      opacity: selectedKey && !isSelected ? 0.3 : 1,
                      filter: isSelected ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none',
                    }}
                    onClick={() => handleToggleSelect(s.key)}
                  >
                    <title>{`${s.label}: ${s.count} đơn (${s.percent}%)`}</title>
                  </circle>
                );
              })
            )}
          </svg>
          {/* Bên giữa để trống hoàn toàn (hollow center) theo yêu cầu */}
        </div>

        {/* Khung thông số chi tiết CỐ ĐỊNH KÍCH THƯỚC (h-[54px]) bên dưới hình ảnh - không bị co giãn nhảy khung */}
        <div className="mt-2 w-full h-[54px] rounded-xl bg-gray-50/80 border border-gray-200/80 px-2 flex flex-col justify-center text-center select-none">
          {selectedSegment ? (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-center gap-1.5 leading-none mb-1">
                <span className={`size-2 rounded-full shrink-0 ${selectedSegment.bgClass}`} />
                <span className="text-xs font-black text-gray-800 truncate">
                  {selectedSegment.label}
                </span>
              </div>
              <div className="text-xs font-black text-gray-900 leading-none">
                {selectedSegment.count} <span className="text-[11px] font-bold text-gray-500">đơn ({selectedSegment.percent}%)</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-tight leading-none mb-1">
                Tổng đơn hàng
              </div>
              <div className="text-xs font-black text-gray-900 leading-none">
                <span className="text-primary font-black">{total}</span> đơn
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cột phải: Danh sách 5 trạng thái CỐ ĐỊNH VỊ TRÍ, không bị nhảy khi người dùng di chuột */}
      <div className="flex flex-col gap-1 w-full text-xs font-semibold select-none">
        {segments.map((s) => {
          const isSelected = selectedKey === s.key;
          return (
            <div
              key={s.key}
              onClick={() => handleToggleSelect(s.key)}
              className={cn(
                "flex items-center justify-between h-8 px-2.5 rounded-xl transition-colors cursor-pointer border",
                isSelected
                  ? "bg-gray-100/90 border-gray-300 font-black shadow-2xs"
                  : "bg-white/60 border-transparent hover:bg-gray-50 hover:border-gray-200"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`size-2.5 rounded-full shrink-0 ${s.bgClass}`} />
                <span
                  className={cn(
                    "text-xs transition-colors truncate",
                    isSelected ? "font-black text-gray-900" : "font-semibold text-gray-700"
                  )}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Floating Inline Validation Error Tooltip (Matching HTML5 validation popup style with Orange Icon)
const FormErrorTooltip = ({
  message,
  align = 'left',
  direction = 'bottom',
}: {
  message?: string;
  align?: 'left' | 'right' | 'center';
  direction?: 'bottom' | 'top';
}) => {
  if (!message) return null;
  return (
    <div
      className={cn(
        'absolute z-50 animate-scaleIn pointer-events-none transition-all duration-200',
        direction === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
        align === 'left' ? 'left-4' : align === 'right' ? 'right-4' : 'left-1/2 -translate-x-1/2'
      )}
    >
      {/* Arrow Pointer */}
      {direction === 'bottom' ? (
        <>
          <div className="absolute -top-2 left-5 h-0 w-0 border-x-[6px] border-x-transparent border-b-[8px] border-b-[#DCD6CD]" />
          <div className="absolute -top-[7px] left-[21px] h-0 w-0 border-x-[5px] border-x-transparent border-b-[7px] border-b-white" />
        </>
      ) : (
        <>
          <div className="absolute -bottom-2 left-5 h-0 w-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-[#DCD6CD]" />
          <div className="absolute -bottom-[7px] left-[21px] h-0 w-0 border-x-[5px] border-x-transparent border-t-[7px] border-t-white" />
        </>
      )}

      {/* Tooltip Card Box */}
      <div className="flex items-center gap-2.5 rounded-xl border border-[#DCD6CD] bg-white px-3.5 py-2 shadow-2xl text-xs">
        <div className="flex size-5.5 shrink-0 items-center justify-center rounded-lg bg-[#E45D1C] font-black text-white text-xs shadow-xs">
          !
        </div>
        <span className="font-extrabold text-[#2C2B28] whitespace-nowrap text-xs">
          {message}
        </span>
      </div>
    </div>
  );
};

// Parse shipping address helper
function parseShippingAddress(addressStr: string) {
  const parts = addressStr ? addressStr.split(' | ') : [];
  let name = 'Chưa rõ';
  let phone = 'Chưa rõ';
  let address = addressStr || 'Chưa rõ';
  let note = '';

  for (const part of parts) {
    if (part.startsWith('Tên: ')) {
      name = part.replace('Tên: ', '');
    } else if (part.startsWith('SĐT: ')) {
      phone = part.replace('SĐT: ', '');
    } else if (part.startsWith('Địa chỉ: ')) {
      address = part.replace('Địa chỉ: ', '');
    }
  }

  if (address.includes(' (Ghi chú: ')) {
    const noteStart = address.indexOf(' (Ghi chú: ');
    note = address.slice(noteStart + 11, -1);
    address = address.slice(0, noteStart);
  }

  return { name, phone, address, note };
}

export default function ManagerDashboard() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'dashboard';
  return <StoreManagerConsole currentTab={currentTab} />;
}

function StoreManagerConsole({ currentTab }: { currentTab: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ManagerDashboardStats | null>(null);
  const [products, setProducts] = useState<ManagerProduct[]>([]);
  const [orders, setOrders] = useState<ManagerOrder[]>([]);
  const [customers, setCustomers] = useState<ManagerCustomer[]>([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<ManagerOrder | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterActiveStatus, setFilterActiveStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('DEFAULT');
  const [productsPage, setProductsPage] = useState<number>(1);
  const [ordersPage, setOrdersPage] = useState<number>(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSortBy, setCustomerSortBy] = useState('none');
  const [customerFilterNew, setCustomerFilterNew] = useState('all');
  const [customersPage, setCustomersPage] = useState<number>(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategorySidebarOpen, setIsCategorySidebarOpen] = useState(false);
  const [isCategorySidebarClosing, setIsCategorySidebarClosing] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [productSpecs, setProductSpecs] = useState<Record<string, string>>({
    origin: '',
    ingredients: '',
    netWeight: '',
    volume: '',
    dimensions: '',
    targetAge: 'Mọi lứa tuổi',
    shelfLifeAndStorage: '',
  });
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
    loading: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    loading: false,
  });
  const [feedbackProduct, setFeedbackProduct] = useState<ManagerProduct | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [isFeedbackSidebarClosing, setIsFeedbackSidebarClosing] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ManagerCustomer | null>(null);
  const [isCustomerOrdersSidebarOpen, setIsCustomerOrdersSidebarOpen] = useState<boolean>(false);
  const [isCustomerOrdersSidebarClosing, setIsCustomerOrdersSidebarClosing] = useState<boolean>(false);

  const dynamicCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((cat) => {
      map[cat.slug] = cat.name;
    });
    return map;
  }, [categories]);

  // Product Add/Edit Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ManagerProduct | null>(null);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Variant Management States
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<ManagerProduct | null>(null);
  const [variants, setVariants] = useState<ManagerProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ManagerProductVariant | null>(null);
  const [submittingVariant, setSubmittingVariant] = useState(false);
  const [variantForm, setVariantForm] = useState({
    name: '',
    sellingPrice: '',
    importPrice: '',
    discountType: 'NONE' as 'NONE' | 'AMOUNT' | 'PERCENT',
    discountValue: '',
    stock: '',
    weightKg: '0.5',
    imageUrl: '',
    isActive: true,
  });

  const [localVariants, setLocalVariants] = useState<ManagerProductVariantInput[]>([]);
  const [editingLocalVariantIndex, setEditingLocalVariantIndex] = useState<number | null>(null);
  const [uploadingVariantImage, setUploadingVariantImage] = useState(false);
  const [expandedProductGroups, setExpandedProductGroups] = useState<Record<string, boolean>>({});

  /**
   * Đóng/mở xem danh sách các biến thể phân loại của từng sản phẩm trong bảng
   */
  const toggleProductGroup = (productId: string) => {
    setExpandedProductGroups((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  // Excel Import & Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportOnlyRefunded, setExportOnlyRefunded] = useState(false);
  const [exportAllTime, setExportAllTime] = useState(false);
  const [exportingOrders, setExportingOrders] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importImages, setImportImages] = useState<File[]>([]);
  const [importMode, setImportMode] = useState<'file' | 'folder'>('file');
  const [isDuplicateFolder, setIsDuplicateFolder] = useState(false);

  const [banks, setBanks] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    updatedCount: number;
    createdCount: number;
    errors: string[];
  } | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'ACCESSORY',
    targetSpecies: 'ALL',
    sellingPrice: '',
    importPrice: '',
    discountType: 'NONE' as 'NONE' | 'AMOUNT' | 'PERCENT',
    discountValue: '',
    stock: '',
    weightKg: '0.5',
    brand: '',
    imageUrl: '',
    images: [] as string[],
    description: '',
    isFeatured: false,
    isActive: true,
  });

  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});

  // Realtime Polling Refs
  const previousOrderIdsRef = React.useRef<Set<string> | null>(null);
  const ordersVersionRef = React.useRef<string | null>(null);
  const inventoryVersionRef = React.useRef<string | null>(null);
  const isPollingRef = React.useRef(false);
  const banksRequestedRef = React.useRef(false);

  const applyLatestOrders = useCallback((latestOrders: ManagerOrder[]) => {
    previousOrderIdsRef.current = new Set(latestOrders.map((order) => order.id));
    setOrders(latestOrders);
    setSelectedOrderDetails((current) => {
      if (!current) return current;
      return latestOrders.find((order) => order.id === current.id) ?? current;
    });
  }, []);

  const applyActivitySnapshot = useCallback((
    snapshot: ManagerActivitySnapshot,
    notifyNewOrders: boolean,
  ) => {
    if (notifyNewOrders && previousOrderIdsRef.current !== null) {
      const newOrderIds = snapshot.orderIds.filter(
        (orderId) => !previousOrderIdsRef.current!.has(orderId),
      );
      if (newOrderIds.length > 0) {
        playStoreNotificationChime();
        toast.success(`Có ${newOrderIds.length} đơn hàng mới vừa được đặt!`, {
          description: `Mã đơn: #${newOrderIds[0].slice(-6).toUpperCase()}`,
        });
      }
    }

    previousOrderIdsRef.current = new Set(snapshot.orderIds);
  }, []);

  const fetchTabData = useCallback(async (
    tab: string,
    showLoading = true,
    signal?: AbortSignal,
  ) => {
    if (showLoading) setLoading(true);
    try {
      if (tab === 'products') {
        const [productsRes, categoriesRes] = await Promise.allSettled([
          managerApi.getProducts(signal),
          productsApi.getCategories(),
        ]);
        if (signal?.aborted) return;
        if (productsRes.status === 'fulfilled') setProducts(productsRes.value.data);
        if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value.data);
        return;
      }

      if (tab === 'orders') {
        const ordersRes = await managerApi.getOrders(signal);
        if (signal?.aborted) return;
        applyLatestOrders(ordersRes.data);
        return;
      }

      if (tab === 'customers') {
        const customersRes = await managerApi.getCustomers(signal);
        if (signal?.aborted) return;
        setCustomers(customersRes.data);
        return;
      }

      const statsRes = await managerApi.getDashboardStats(signal);
      if (signal?.aborted) return;
      setStats(statsRes.data);
      setCategories(statsRes.data.categories);
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Failed to fetch manager dashboard data', error);
      toast.error('Lỗi khi tải dữ liệu từ máy chủ.');
    } finally {
      if (showLoading && !signal?.aborted) setLoading(false);
    }
  }, [applyLatestOrders]);

  const refreshOrders = async () => {
    const response = await managerApi.getOrders();
    applyLatestOrders(response.data);
    return response.data;
  };

  const refreshProducts = async () => {
    const response = await managerApi.getProducts();
    setProducts(response.data);
    return response.data;
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadTimer = window.setTimeout(
      () => void fetchTabData(currentTab, true, controller.signal),
      0,
    );
    return () => {
      controller.abort();
      window.clearTimeout(loadTimer);
    };
  }, [currentTab, fetchTabData]);

  // Chỉ tải danh sách ngân hàng khi Manager mở tab đơn hàng.
  useEffect(() => {
    if (currentTab !== 'orders' || banksRequestedRef.current) return;

    banksRequestedRef.current = true;
    fetch('https://api.vietqr.io/v2/banks')
      .then((res) => res.json())
      .then((data) => {
        if (data.code === '00') setBanks(data.data || []);
      })
      .catch((error) => {
        banksRequestedRef.current = false;
        console.error('Failed to fetch banks', error);
      });
  }, [currentTab]);

  // Poll snapshot nhẹ, chỉ tải lại payload đầy đủ khi dữ liệu của tab hiện tại thay đổi.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const pollManagerData = async (notify = true) => {
      if (
        cancelled ||
        document.visibilityState !== 'visible' ||
        isPollingRef.current
      ) return;

      isPollingRef.current = true;
      try {
        if (notify && currentTab === 'orders') {
          await shippingApi.syncActiveAhamoveOrders().catch(() => undefined);
        }

        const snapshotResponse = await managerApi.getActivitySnapshot(
          controller.signal,
        );
        if (cancelled) return;

        const snapshot = snapshotResponse.data;
        const ordersChanged =
          ordersVersionRef.current !== null &&
          ordersVersionRef.current !== snapshot.ordersVersion;
        const inventoryChanged =
          inventoryVersionRef.current !== null &&
          inventoryVersionRef.current !== snapshot.inventoryVersion;

        applyActivitySnapshot(snapshot, notify);
        ordersVersionRef.current = snapshot.ordersVersion;
        inventoryVersionRef.current = snapshot.inventoryVersion;

        const shouldRefresh = currentTab === 'orders' || currentTab === 'customers'
          ? ordersChanged
          : ordersChanged || inventoryChanged;
        if (notify && shouldRefresh) {
          await fetchTabData(currentTab, false, controller.signal);
        }
      } catch {
        // silent polling
      } finally {
        isPollingRef.current = false;
      }
    };

    const interval = window.setInterval(
      () => void pollManagerData(),
      currentTab === 'orders' ? 8000 : 15000,
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void pollManagerData();
      }
    };

    void pollManagerData(false);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyActivitySnapshot, currentTab, fetchTabData]);

  // Filtered lists based on search and status filters
  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.brand && product.brand.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'IN_STOCK' && (product.stock ?? 0) >= 5) ||
        (filterStatus === 'LOW_STOCK' && (product.stock ?? 0) > 0 && (product.stock ?? 0) < 5) ||
        (filterStatus === 'OUT_OF_STOCK' && (product.stock ?? 0) === 0);
      const matchesCategory =
        filterCategory === 'ALL' ||
        product.category === filterCategory;
      const pHasVariants = product.variants && product.variants.length > 0;
      const pHasActiveVar = pHasVariants ? product.variants!.some((v: any) => v.isActive !== false) : true;
      const pEffectiveActive = pHasVariants && !pHasActiveVar ? false : (product.isActive !== false);

      const matchesActiveStatus =
        filterActiveStatus === 'ALL' ||
        (filterActiveStatus === 'ACTIVE' && pEffectiveActive) ||
        (filterActiveStatus === 'INACTIVE' && !pEffectiveActive);
      return matchesSearch && matchesStatus && matchesCategory && matchesActiveStatus;
    });

    if (sortBy === 'BEST_SELLER') {
      result = [...result].sort((a, b) => {
        const aWarn = hasLowStockWarning(a);
        const bWarn = hasLowStockWarning(b);
        if (aWarn && !bWarn) return -1;
        if (!aWarn && bWarn) return 1;
        return (b.sales ?? 0) - (a.sales ?? 0);
      });
    } else if (sortBy === 'PRICE_ASC') {
      // Sắp xếp danh sách sản phẩm theo giá bán tăng dần (từ thấp đến cao)
      result = [...result].sort((a, b) => getProductEffectivePrice(a) - getProductEffectivePrice(b));
    } else if (sortBy === 'PRICE_DESC') {
      // Sắp xếp danh sách sản phẩm theo giá bán giảm dần (từ cao đến thấp)
      result = [...result].sort((a, b) => getProductEffectivePrice(b) - getProductEffectivePrice(a));
    } else {
      // Mặc định: Sản phẩm có cảnh báo tồn kho (< 5 hoặc = 0) đẩy lên đầu danh sách; các sản phẩm còn lại sắp xếp theo thứ tự bảng chữ cái A-Z
      result = [...result].sort((a, b) => {
        const aWarn = hasLowStockWarning(a);
        const bWarn = hasLowStockWarning(b);
        if (aWarn && !bWarn) return -1;
        if (!aWarn && bWarn) return 1;
        return a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });
      });
    }

    return result;
  }, [products, searchQuery, filterStatus, filterCategory, filterActiveStatus, sortBy]);

  const filteredOrders = useMemo(() => {
    const list = orders.filter((order) => {
      const customerName = order.user?.name || '';
      const matchesSearch =
        customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesStatus = false;
      if (filterStatus === 'ALL') {
        matchesStatus = true;
      } else if (filterStatus === 'REFUND_PENDING') {
        matchesStatus = order.refundStatus === 'PENDING';
      } else if (filterStatus === 'REFUND_APPROVED') {
        matchesStatus = order.refundStatus === 'REFUNDED';
      } else {
        matchesStatus = order.status === filterStatus;
      }

      return matchesSearch && matchesStatus;
    });

    // Sắp xếp danh sách đơn hàng hiển thị theo các đơn mới nhất (createdAt giảm dần)
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [orders, searchQuery, filterStatus]);

  const filteredCustomers = useMemo(() => {
    // Chỉ hiển thị khách hàng đã từng mua hàng (totalOrders > 0)
    let result = customers.filter((c) => (c.totalOrders ?? 0) > 0);

    // 1. Filter new customers
    if (customerFilterNew === 'new') {
      result = result.filter((c) => c.isNewCustomer);
    }

    // 2. Search query (chỉ tìm theo tên và số điện thoại, do email đã bị ẩn)
    if (customerSearch.trim()) {
      const query = customerSearch.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(query) ||
        (c.phone && c.phone.includes(query))
      );
    }

    // 3. Sorting
    if (customerSortBy === 'spent_desc') {
      result.sort((a, b) => b.spent - a.spent);
    } else if (customerSortBy === 'spent_asc') {
      result.sort((a, b) => a.spent - b.spent);
    } else if (customerSortBy === 'orders_desc') {
      result.sort((a, b) => b.totalOrders - a.totalOrders);
    } else if (customerSortBy === 'cancelled_desc') {
      result.sort((a, b) => b.totalCancelled - a.totalCancelled);
    }

    return result;
  }, [customers, customerSortBy, customerFilterNew, customerSearch]);

  const paginatedCustomers = useMemo(() => {
    const start = (customersPage - 1) * 10;
    return filteredCustomers.slice(start, start + 10);
  }, [filteredCustomers, customersPage]);

  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * 10;
    return filteredOrders.slice(start, start + 10);
  }, [filteredOrders, ordersPage]);

  const paginatedProducts = useMemo(() => {
    const start = (productsPage - 1) * 10;
    return filteredProducts.slice(start, start + 10);
  }, [filteredProducts, productsPage]);

  // Page resetting on filter changes
  useEffect(() => {
    setOrdersPage(1);
    setSelectedOrderIds([]);
  }, [searchQuery, filterStatus]);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [ordersPage]);

  useEffect(() => {
    setCustomersPage(1);
  }, [customerSearch, customerSortBy, customerFilterNew]);

  useEffect(() => {
    setProductsPage(1);
  }, [searchQuery, filterStatus, filterCategory, sortBy]);

  const handleExportExcel = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setExportStartDate(formatDate(firstDay));
    setExportEndDate(formatDate(now));
    setExportOnlyRefunded(false);
    setExportAllTime(false);
    setIsExportModalOpen(true);
  };

  const executeExportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportingOrders(true);
    try {
      const res = await managerApi.exportOrders({
        startDate: exportAllTime ? undefined : (exportStartDate || undefined),
        endDate: exportAllTime ? undefined : (exportEndDate || undefined),
        onlyRefunded: exportOnlyRefunded || undefined,
      });

      let filename = 'danh_sach_don_hang';
      if (exportAllTime) {
        filename += '_toan_bo_thoi_gian';
      } else if (exportStartDate && exportEndDate) {
        filename += `_${exportStartDate}_den_${exportEndDate}`;
      }
      if (exportOnlyRefunded) {
        filename += '_da_duyet_hoan_tien';
      }
      filename += '.xlsx';
      downloadExcelFile(res.data, filename);

      toast.success('Xuất file Excel thành công!');
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error('Failed to export orders to excel', err);
      toast.error('Lỗi khi xuất file Excel.');
    } finally {
      setExportingOrders(false);
    }
  };

  // Hàm cập nhật trạng thái đơn hàng dành cho Manager
  const handleOrderStatusChange = async (
    orderId: string,
    newStatus: string,
  ) => {
    if (newStatus === 'DELIVERED') {
      toast.error('Trạng thái Đã nhận hàng chỉ được cập nhật tự động từ đối tác vận chuyển AhaMove Sandbox khi tài xế giao thành công!');
      return;
    }
    try {
      await managerApi.updateOrderStatus(orderId, newStatus);
      toast.success('Cập nhật trạng thái đơn hàng thành công!');
      await refreshOrders();
    } catch (error: any) {
      console.error('Failed to update order status', error);
      toast.error(error.response?.data?.message || 'Lỗi khi cập nhật trạng thái đơn hàng.');
    }
  };

  const [submittingBatch, setSubmittingBatch] = useState<boolean>(false);

  const handleBatchStatusChange = async (targetStatus: string, actionLabel: string) => {
    if (targetStatus === 'DELIVERED') {
      toast.error('Không thể đổi trạng thái Đã nhận hàng thủ công. Trạng thái này được đồng bộ tự động từ AhaMove Sandbox!');
      return;
    }
    if (selectedOrderIds.length === 0) return;
    setSubmittingBatch(true);
    try {
      await Promise.all(
        selectedOrderIds.map((id) => managerApi.updateOrderStatus(id, targetStatus))
      );
      toast.success(`Đã chuyển trạng thái "${actionLabel}" cho ${selectedOrderIds.length} đơn hàng!`);
      setSelectedOrderIds([]);
      await refreshOrders();
    } catch (err: any) {
      console.error('Failed batch status update', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi chuyển trạng thái hàng loạt.');
    } finally {
      setSubmittingBatch(false);
    }
  };

  const handleBatchApproveRefund = async () => {
    if (selectedOrderIds.length === 0) return;
    setSubmittingBatch(true);
    try {
      await Promise.all(
        selectedOrderIds.map((id) => managerApi.approveRefund(id))
      );
      toast.success(`Đã duyệt hoàn tiền thành công cho ${selectedOrderIds.length} đơn hàng!`);
      setSelectedOrderIds([]);
      await refreshOrders();
    } catch (err: any) {
      console.error('Failed batch refund approval', err);
      toast.error('Có lỗi xảy ra khi duyệt hoàn tiền hàng loạt.');
    } finally {
      setSubmittingBatch(false);
    }
  };



  // State và hàm xử lý tạo vận đơn AhaMove Hỏa Tốc dành cho Manager
  const [creatingAhamoveOrder, setCreatingAhamoveOrder] = useState<string | null>(null);
  const [trackingAhamoveCode, setTrackingAhamoveCode] = useState<string | null>(null);

  const handleCreateAhamoveShippingOrder = async (orderId: string) => {
    setCreatingAhamoveOrder(orderId);
    try {
      const res = await shippingApi.createAhamoveShippingOrder(orderId);
      if (res.data?.success) {
        toast.success(`Đã tạo đơn giao hỏa tốc AhaMove thành công! Mã: ${res.data.ahamoveOrderCode}`);
        await refreshOrders();
      }
    } catch (err: any) {
      console.error('Failed to create AhaMove order', err);
      toast.error(err.response?.data?.message || 'Có lỗi khi tạo vận đơn AhaMove.');
      setCreatingAhamoveOrder(null);
    }
  };

  const [syncingAhamove, setSyncingAhamove] = useState<boolean>(false);

  /**
   * Đồng bộ trực tiếp trạng thái thực tế từ AhaMove Staging Portal cho toàn bộ đơn hàng đang giao
   */
  const handleSyncAhamoveOrders = async () => {
    setSyncingAhamove(true);
    try {
      await shippingApi.syncActiveAhamoveOrders();
      await refreshOrders();
      toast.success('Đã đồng bộ trạng thái mới nhất từ AhaMove!');
    } catch (err: any) {
      console.error('Failed to sync AhaMove orders', err);
    } finally {
      setSyncingAhamove(false);
    }
  };

  const [uploadingRefundProof, setUploadingRefundProof] = useState<boolean>(false);
  const [pendingRefundProofUrl, setPendingRefundProofUrl] = useState<string>('');

  const handleRefundProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrderDetails) return;
    setUploadingRefundProof(true);
    try {
      const uploadRes = await managerApi.uploadRefundProof(file);
      const url = uploadRes.data.url;
      setPendingRefundProofUrl(url);

      // Save to database immediately so it is persisted
      await managerApi.updateRefundProof(selectedOrderDetails.id, url);

      setSelectedOrderDetails((prev) =>
        prev ? { ...prev, refundProofUrl: url } : null,
      );
      await refreshOrders();
      toast.success('Đã tải và lưu ảnh chuyển khoản hoàn tiền thành công!');
    } catch (err: any) {
      console.error('Failed to upload refund proof', err);
      toast.error(err.response?.data?.message || 'Lỗi khi tải ảnh chuyển khoản hoàn tiền.');
    } finally {
      setUploadingRefundProof(false);
    }
  };

  const handleRemoveRefundProof = async () => {
    if (!selectedOrderDetails) return;
    setUploadingRefundProof(true);
    try {
      await managerApi.updateRefundProof(selectedOrderDetails.id, '');
      setPendingRefundProofUrl('');
      setSelectedOrderDetails((prev) =>
        prev ? { ...prev, refundProofUrl: null } : null,
      );
      await refreshOrders();
      toast.success('Đã gỡ bỏ ảnh chuyển khoản hoàn tiền!');
    } catch (err: any) {
      console.error('Failed to remove refund proof', err);
      toast.error('Lỗi khi gỡ ảnh chuyển khoản hoàn tiền.');
    } finally {
      setUploadingRefundProof(false);
    }
  };

  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [confirmApproveRefundOrder, setConfirmApproveRefundOrder] = useState<ManagerOrder | null>(null);
  const [confirmRejectRefundOrder, setConfirmRejectRefundOrder] = useState<ManagerOrder | null>(null);

  const handleApproveRefund = async (orderId: string, proofUrl?: string) => {
    setRefundingId(orderId);
    try {
      const finalProofUrl = proofUrl || pendingRefundProofUrl || undefined;
      await managerApi.approveRefund(orderId, finalProofUrl);
      toast.success('Đã duyệt yêu cầu hoàn tiền thành công!');
      setPendingRefundProofUrl('');
      await refreshOrders();
    } catch (error: any) {
      console.error('Failed to approve refund', error);
      toast.error(error.response?.data?.message || 'Lỗi khi phê duyệt hoàn tiền.');
    } finally {
      setRefundingId(null);
    }
  };

  const handleRejectRefund = async (orderId: string) => {
    setRefundingId(orderId);
    try {
      await managerApi.rejectRefund(orderId);
      toast.info('Đã từ chối hoàn tiền cho đơn hàng này.');
      await refreshOrders();
    } catch (error: any) {
      console.error('Failed to reject refund', error);
      toast.error('Lỗi khi từ chối yêu cầu hoàn tiền.');
    } finally {
      setRefundingId(null);
    }
  };

  const resetVariantState = () => {
    setVariantForm({
      name: '',
      sellingPrice: '',
      importPrice: '',
      discountType: 'NONE',
      discountValue: '',
      stock: '',
      weightKg: '0.5',
      imageUrl: '',
      isActive: true,
    });
    setEditingVariant(null);
    setEditingLocalVariantIndex(null);
    setUploadingVariantImage(false);
  };

  const handleCloseProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    resetVariantState();
  };

  const handleCloseVariantsModal = () => {
    setIsVariantModalOpen(false);
    setSelectedProductForVariants(null);
    setVariants([]);
    resetVariantState();
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setProductSpecs({
      origin: '',
      ingredients: '',
      netWeight: '',
      volume: '',
      dimensions: '',
      targetAge: 'Mọi lứa tuổi',
      shelfLifeAndStorage: '',
    });
    setLocalVariants([]);
    resetVariantState();
    setProductForm({
      name: '',
      category: categories[0]?.slug || 'ACCESSORY',
      targetSpecies: 'ALL',
      sellingPrice: '',
      importPrice: '',
      discountType: 'NONE',
      discountValue: '',
      stock: '',
      weightKg: '0.5',
      brand: '',
      imageUrl: '',
      images: [],
      description: '',
      isFeatured: false,
      isActive: true,
    });
    setIsProductModalOpen(true);
  };

  /**
   * Mở modal chỉnh sửa sản phẩm: nạp lại đầy đủ toàn bộ dữ liệu cũ (bao gồm toàn bộ ảnh và biến thể phân loại)
   */
  const handleEditClick = (product: ManagerProduct) => {
    setEditingProduct(product);
    resetVariantState();

    // Lấy lại đầy đủ danh sách ảnh cũ của sản phẩm (hỗ trợ cả mảng images và trường imageUrl cũ)
    const existingImages: string[] = (product as any).images && Array.isArray((product as any).images) && (product as any).images.length > 0
      ? (product as any).images
      : (product.imageUrl ? [product.imageUrl] : []);

    if (product.variants && product.variants.length > 0) {
      setVariants(product.variants);
    } else {
      setVariants([]);
      // Tải lại danh sách biến thể từ database nếu chưa có sẵn trong state
      loadVariants(product.id);
    }

    const defaultSpecs = {
      origin: '',
      ingredients: '',
      netWeight: '',
      volume: '',
      dimensions: '',
      targetAge: 'Mọi lứa tuổi',
      shelfLifeAndStorage: '',
    };
    if (product.specifications) {
      try {
        const specs = typeof product.specifications === 'string'
          ? JSON.parse(product.specifications)
          : product.specifications;
        setProductSpecs({ ...defaultSpecs, ...specs });
      } catch (e) {
        console.error('Failed to parse specifications', e);
        setProductSpecs(defaultSpecs);
      }
    } else {
      setProductSpecs(defaultSpecs);
    }

    const pSelling = Number(product.sellingPrice) || 0;
    const pSale = product.salePrice ? Number(product.salePrice) : null;
    let initialDiscountVal = '';
    let initialDiscountType: 'NONE' | 'AMOUNT' | 'PERCENT' = 'NONE';
    if (pSale && pSale < pSelling) {
      const diff = pSelling - pSale;
      const pct = Math.round((diff / pSelling) * 100);
      if (pct > 0 && Math.round((pSelling * (100 - pct)) / 100) === pSale) {
        initialDiscountType = 'PERCENT';
        initialDiscountVal = String(pct);
      } else {
        initialDiscountType = 'AMOUNT';
        initialDiscountVal = String(diff);
      }
    }

    setProductForm({
      name: product.name,
      category: product.category,
      targetSpecies: product.targetSpecies || 'ALL',
      sellingPrice: String(product.sellingPrice || ''),
      importPrice: product.importPrice ? String(product.importPrice) : '',
      discountType: initialDiscountType,
      discountValue: initialDiscountVal,
      stock: product.stock !== undefined && product.stock !== null ? String(product.stock) : '',
      weightKg: product.weightKg !== undefined && product.weightKg !== null ? String(product.weightKg) : '0.5',
      brand: product.brand || '',
      imageUrl: product.imageUrl || existingImages[0] || '',
      images: existingImages,
      description: product.description || '',
      isFeatured: !!product.isFeatured,
      isActive: product.isActive !== false,
    });
    setIsProductModalOpen(true);
  };

  /**
   * Bật hoặc tắt trạng thái kinh doanh của sản phẩm
   * Nếu tất cả phân loại (variants) đều bị tắt, không cho phép mở bán sản phẩm và yêu cầu kích hoạt ít nhất 1 phân loại.
   */
  const handleToggleProductActive = async (product: ManagerProduct) => {
    const newActive = product.isActive === false ? true : false;

    // Nếu Store Manager muốn bật mở bán sản phẩm (newActive === true)
    if (newActive && product.variants && product.variants.length > 0) {
      const hasActiveVariant = product.variants.some((v: any) => v.isActive !== false);
      if (!hasActiveVariant) {
        toast.error('Không thể mở bán sản phẩm! Vui lòng mở bán ít nhất 1 phân loại (variant) của sản phẩm.');
        return;
      }
    }

    try {
      await managerApi.updateProduct(product.id, { isActive: newActive });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: newActive } : p))
      );
      toast.success(newActive ? `Đã mở bán sản phẩm "${product.name}"` : `Đã tạm ngưng bán "${product.name}"`);
    } catch (err: any) {
      console.error('Failed to toggle product active status', err);
      const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái sản phẩm.';
      toast.error(msg);
    }
  };

  /**
   * Bật hoặc tắt trạng thái của từng biến thể phân loại.
   * Nếu việc tắt phân loại dẫn đến tất cả phân loại của sản phẩm đều bị tắt, tự động ngưng bán sản phẩm cha.
   */
  const handleToggleVariantActive = async (variant: any, parentProduct: ManagerProduct) => {
    const newActive = variant.isActive === false ? true : false;
    try {
      await managerApi.updateProductVariant(variant.id, { isActive: newActive });

      let allInactiveAfterToggle = false;

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== parentProduct.id) return p;
          const updatedVariants = (p.variants || []).map((v: any) =>
            v.id === variant.id ? { ...v, isActive: newActive } : v
          );
          const hasActive = updatedVariants.some((v: any) => v.isActive !== false);
          if (!hasActive) allInactiveAfterToggle = true;

          return {
            ...p,
            variants: updatedVariants,
            // Tự động chuyển sản phẩm cha sang ngừng bán nếu tất cả phân loại con đều bị tắt
            isActive: !hasActive ? false : p.isActive,
          };
        })
      );

      if (allInactiveAfterToggle) {
        toast.warning(`Tất cả phân loại của "${parentProduct.name}" đều bị tắt. Sản phẩm đã tự động chuyển sang Tạm ngưng bán.`);
      } else {
        toast.success(newActive ? `Đã mở bán phân loại "${variant.name}"` : `Đã tắt phân loại "${variant.name}"`);
      }
    } catch (err) {
      console.error('Failed to toggle variant active status', err);
      toast.error('Không thể cập nhật trạng thái phân loại.');
    }
  };

  // Load variants from API
  const loadVariants = async (productId: string) => {
    setLoadingVariants(true);
    try {
      const res = await managerApi.getProductVariants(productId);
      setVariants(res.data || []);
    } catch (error) {
      console.error('Failed to load product variants', error);
      toast.error('Lỗi khi tải danh sách biến thể.');
    } finally {
      setLoadingVariants(false);
    }
  };

  /**
   * Mở modal chỉnh sửa hoặc tạo mới từng biến thể phân loại riêng biệt của sản phẩm
   * Luôn hiển thị danh sách các phân loại sản phẩm của sản phẩm đó ở cột phía bên phải
   */
  const handleOpenVariantModal = (product: ManagerProduct, variant?: any) => {
    setSelectedProductForVariants(product);
    setVariantErrors({});

    // Nạp ngay danh sách phân loại hiện có của sản phẩm đó để hiển thị ngay lập tức ở cột bên phải
    if (product.variants && product.variants.length > 0) {
      setVariants(product.variants);
    } else {
      setVariants([]);
    }
    // Đồng thời gọi API để lấy dữ liệu biến thể mới nhất từ cơ sở dữ liệu
    loadVariants(product.id);

    if (variant) {
      setEditingVariant(variant);
      const vSelling = Number(variant.sellingPrice) || 0;
      let vDiscountVal = '';
      let vDiscountType: 'NONE' | 'AMOUNT' | 'PERCENT' = 'NONE';
      if (variant.salePrice && variant.salePrice < vSelling) {
        vDiscountType = 'AMOUNT';
        vDiscountVal = String(vSelling - variant.salePrice);
      }
      setVariantForm({
        name: variant.name || '',
        sellingPrice: String(variant.sellingPrice || ''),
        importPrice: variant.importPrice ? String(variant.importPrice) : '',
        discountType: vDiscountType,
        discountValue: vDiscountVal,
        stock: variant.stock !== undefined && variant.stock !== null ? String(variant.stock) : '',
        weightKg: variant.weightKg !== undefined && variant.weightKg !== null ? String(variant.weightKg) : (product.weightKg ? String(product.weightKg) : '0.5'),
        imageUrl: variant.imageUrl || '',
        isActive: variant.isActive !== false,
      });
    } else {
      resetVariantState();
      setVariantForm({
        name: '',
        sellingPrice: '',
        importPrice: '',
        discountType: 'NONE',
        discountValue: '',
        stock: '',
        weightKg: product.weightKg ? String(product.weightKg) : '0.5',
        imageUrl: '',
        isActive: true,
      });
    }
    setIsVariantModalOpen(true);
  };

  const handleEditVariantClick = (variant: ManagerProductVariant) => {
    setEditingVariant(variant);
    const vSelling = Number(variant.sellingPrice) || 0;
    let vDiscountVal = '';
    let vDiscountType: 'NONE' | 'AMOUNT' | 'PERCENT' = 'NONE';
    if (variant.salePrice && variant.salePrice < vSelling) {
      vDiscountType = 'AMOUNT';
      vDiscountVal = String(vSelling - variant.salePrice);
    }
    setVariantForm({
      name: variant.name,
      sellingPrice: String(variant.sellingPrice),
      importPrice: variant.importPrice ? String(variant.importPrice) : '',
      discountType: vDiscountType,
      discountValue: vDiscountVal,
      stock: String(variant.stock),
      weightKg: variant.weightKg !== undefined && variant.weightKg !== null ? String(variant.weightKg) : '0.5',
      imageUrl: variant.imageUrl || '',
      isActive: variant.isActive !== false,
    });
  };

  const handleCancelEditVariant = () => {
    setEditingVariant(null);
    setVariantForm({
      name: '',
      sellingPrice: '',
      importPrice: '',
      discountType: 'NONE',
      discountValue: '',
      stock: '',
      weightKg: '0.5',
      imageUrl: '',
      isActive: true,
    });
  };

  /**
   * Xử lý lưu (thêm mới hoặc cập nhật) biến thể phân loại của sản phẩm vào cơ sở dữ liệu
   */
  const handleVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVariantErrors({});
    const currentProduct = selectedProductForVariants || editingProduct;
    if (!currentProduct) return;

    const errors: Record<string, string> = {};
    if (!variantForm.name.trim()) {
      errors.name = 'Vui lòng điền tên phân loại.';
    }
    const ip = Number(variantForm.importPrice);
    if (!variantForm.importPrice || isNaN(ip) || ip <= 0) {
      errors.importPrice = 'Giá nhập là bắt buộc và phải lớn hơn 0.';
    }
    const stockNum = Number(variantForm.stock);
    if (variantForm.stock === '' || variantForm.stock === undefined || isNaN(stockNum) || stockNum < 0) {
      errors.stock = 'Số lượng tồn kho là bắt buộc và không được âm.';
    }
    if (!variantForm.imageUrl || !variantForm.imageUrl.trim()) {
      errors.imageUrl = 'Vui lòng tải ảnh phân loại từ thiết bị.';
    }

    if (Object.keys(errors).length > 0) {
      setVariantErrors(errors);
      return;
    }

    // Giá bán: nếu để trống -> tự động lấy bằng Giá nhập!
    let sellingPrice = variantForm.sellingPrice ? Number(variantForm.sellingPrice) : ip;
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      sellingPrice = ip;
    }
    if (sellingPrice < ip) {
      toast.error('Giá bán lẻ không được nhỏ hơn giá nhập.');
      return;
    }

    let salePrice: number | null = null;
    if (variantForm.discountType === 'AMOUNT' && variantForm.discountValue) {
      const val = Number(variantForm.discountValue);
      if (isNaN(val) || val <= 0) {
        toast.error('Số tiền giảm giá phải lớn hơn 0.');
        return;
      }
      if (val > ip) {
        toast.error(`Số tiền giảm giá tối đa không được vượt quá giá nhập (${ip.toLocaleString('vi-VN')}đ).`);
        return;
      }
      salePrice = sellingPrice - val;
    } else if (variantForm.discountType === 'PERCENT' && variantForm.discountValue) {
      const pct = Number(variantForm.discountValue);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        toast.error('Phần trăm giảm giá phải từ 0% đến 100%.');
        return;
      }
      salePrice = sellingPrice - Math.round((sellingPrice * pct) / 100);
    }

    setSubmittingVariant(true);
    try {
      const data = {
        name: variantForm.name.trim(),
        sellingPrice,
        salePrice,
        importPrice: ip,
        stock: stockNum,
        weightKg: parseWeightKg(variantForm.weightKg),
        imageUrl: variantForm.imageUrl.trim(),
        isActive: variantForm.isActive,
      };

      if (editingVariant) {
        await managerApi.updateProductVariant(editingVariant.id, data);
        toast.success('Cập nhật phân loại thành công!');
      } else {
        await managerApi.createProductVariant(currentProduct.id, data);
        toast.success('Thêm phân loại mới thành công!');
      }

      handleCancelEditVariant();
      const [, refreshedProducts] = await Promise.all([
        loadVariants(currentProduct.id),
        refreshProducts(),
      ]);
      const updatedProduct = refreshedProducts.find((product) => product.id === currentProduct.id);
      if (updatedProduct) {
        setSelectedProductForVariants(updatedProduct);
      }
    } catch (error) {
      console.error('Failed to submit variant form', error);
      toast.error('Lỗi khi lưu phân loại.');
    } finally {
      setSubmittingVariant(false);
    }
  };

  /**
   * Xóa một biến thể phân loại khỏi cơ sở dữ liệu
   */
  const handleDeleteVariant = async (variantId: string, customProduct?: ManagerProduct) => {
    const currentProduct = customProduct || selectedProductForVariants || editingProduct;
    if (!currentProduct) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa phân loại này?')) return;

    try {
      await managerApi.deleteProductVariant(variantId);
      toast.success('Xóa phân loại thành công!');
      const [, refreshedProducts] = await Promise.all([
        loadVariants(currentProduct.id),
        refreshProducts(),
      ]);
      const updatedProduct = refreshedProducts.find((product) => product.id === currentProduct.id);
      if (updatedProduct) {
        setSelectedProductForVariants(updatedProduct);
      }
    } catch (error: any) {
      console.error('Failed to delete variant', error);
      const msg = error.response?.data?.message || 'Lỗi khi xóa phân loại.';
      toast.error(msg);
    }
  };

  /**
   * Xử lý thêm mới hoặc cập nhật biến thể tạm thời cho sản phẩm mới đang được tạo
   */
  const handleLocalVariantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVariantErrors({});

    const errors: Record<string, string> = {};
    if (!variantForm.name.trim()) {
      errors.name = 'Vui lòng điền tên phân loại.';
    }
    const ip = Number(variantForm.importPrice);
    if (!variantForm.importPrice || isNaN(ip) || ip <= 0) {
      errors.importPrice = 'Giá nhập là bắt buộc và phải lớn hơn 0.';
    }
    const stockNum = Number(variantForm.stock);
    if (variantForm.stock === '' || variantForm.stock === undefined || isNaN(stockNum) || stockNum < 0) {
      errors.stock = 'Số lượng tồn kho là bắt buộc và không được âm.';
    }
    if (!variantForm.imageUrl || !variantForm.imageUrl.trim()) {
      errors.imageUrl = 'Vui lòng tải ảnh phân loại từ thiết bị.';
    }

    if (Object.keys(errors).length > 0) {
      setVariantErrors(errors);
      return;
    }

    // Giá bán: nếu để trống -> tự động lấy bằng Giá nhập!
    let sellingPrice = variantForm.sellingPrice ? Number(variantForm.sellingPrice) : ip;
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      sellingPrice = ip;
    }
    if (sellingPrice < ip) {
      toast.error('Giá bán lẻ không được nhỏ hơn giá nhập.');
      return;
    }

    let salePrice: number | null = null;
    if (variantForm.discountType === 'AMOUNT' && variantForm.discountValue) {
      const val = Number(variantForm.discountValue);
      if (isNaN(val) || val <= 0) {
        toast.error('Số tiền giảm giá phải lớn hơn 0.');
        return;
      }
      if (val > ip) {
        toast.error(`Số tiền giảm giá tối đa không được vượt quá giá nhập (${ip.toLocaleString('vi-VN')}đ).`);
        return;
      }
      salePrice = sellingPrice - val;
    } else if (variantForm.discountType === 'PERCENT' && variantForm.discountValue) {
      const pct = Number(variantForm.discountValue);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        toast.error('Phần trăm giảm giá phải từ 0% đến 100%.');
        return;
      }
      salePrice = sellingPrice - Math.round((sellingPrice * pct) / 100);
    }

    const newVar = {
      name: variantForm.name.trim(),
      sellingPrice,
      salePrice,
      importPrice: ip,
      stock: stockNum,
      weightKg: parseWeightKg(variantForm.weightKg),
      imageUrl: variantForm.imageUrl.trim(),
      isActive: variantForm.isActive,
    };

    if (editingLocalVariantIndex !== null) {
      const updated = [...localVariants];
      updated[editingLocalVariantIndex] = newVar;
      setLocalVariants(updated);
      toast.success('Cập nhật phân loại thành công!');
      setEditingLocalVariantIndex(null);
    } else {
      setLocalVariants([...localVariants, newVar]);
      toast.success('Thêm phân loại thành công!');
    }

    setVariantForm({
      name: '',
      sellingPrice: '',
      importPrice: '',
      discountType: 'NONE',
      discountValue: '',
      stock: '',
      weightKg: '0.5',
      imageUrl: '',
      isActive: true,
    });
  };

  const handleEditLocalVariant = (index: number) => {
    const v = localVariants[index];
    setEditingLocalVariantIndex(index);
    let vDiscountType: 'NONE' | 'AMOUNT' | 'PERCENT' = 'NONE';
    let vDiscountVal = '';
    if (v.salePrice && v.salePrice < v.sellingPrice) {
      vDiscountType = 'AMOUNT';
      vDiscountVal = String(v.sellingPrice - v.salePrice);
    }
    setVariantForm({
      name: v.name,
      sellingPrice: String(v.sellingPrice),
      importPrice: v.importPrice ? String(v.importPrice) : '',
      discountType: vDiscountType,
      discountValue: vDiscountVal,
      stock: String(v.stock),
      weightKg: (v as any).weightKg !== undefined && (v as any).weightKg !== null ? String((v as any).weightKg) : '0.5',
      imageUrl: v.imageUrl || '',
      isActive: v.isActive !== false,
    });
  };

  const handleDeleteLocalVariant = (index: number) => {
    const updated = localVariants.filter((_, idx) => idx !== index);
    setLocalVariants(updated);
    toast.success('Xóa biến thể thành công!');
    if (editingLocalVariantIndex === index) {
      resetVariantState();
    }
  };

  const handleViewFeedback = async (product: ManagerProduct) => {
    setFeedbackProduct(product);
    setIsFeedbackModalOpen(true);
    setFeedbackLoading(true);
    try {
      const res = await productsApi.getReviews(product.id);
      setFeedbacks(res.data || []);
    } catch (err) {
      console.error('Lỗi tải đánh giá sản phẩm', err);
      toast.error('Lỗi khi tải thông tin đánh giá.');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleCloseFeedbackSidebar = () => {
    setIsFeedbackSidebarClosing(true);
    setTimeout(() => {
      setIsFeedbackModalOpen(false);
      setFeedbackProduct(null);
      setFeedbacks([]);
      setIsFeedbackSidebarClosing(false);
    }, 300);
  };

  const handleViewCustomerOrders = (customer: ManagerCustomer) => {
    setSelectedCustomer(customer);
    setIsCustomerOrdersSidebarOpen(true);
  };

  const handleCloseCustomerOrdersSidebar = () => {
    setIsCustomerOrdersSidebarClosing(true);
    setTimeout(() => {
      setIsCustomerOrdersSidebarOpen(false);
      setSelectedCustomer(null);
      setIsCustomerOrdersSidebarClosing(false);
    }, 300);
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toast.error('Vui lòng chọn file Excel.');
      return;
    }

    let folderName = '';
    if (importMode === 'folder') {
      const pathParts = (importFile as any).webkitRelativePath?.split('/');
      folderName = pathParts && pathParts.length > 0 ? pathParts[0] : '';
    }

    setImporting(true);
    setImportResult(null);
    try {
      const res = await managerApi.importProducts(importFile, importImages);
      const result = res.data;
      setImportResult(result);
      if (result.success) {
        toast.success(`Nhập hàng thành công! Đã cập nhật ${result.updatedCount} sản phẩm, tạo mới ${result.createdCount} sản phẩm.`);
        void fetchTabData('products', false);
        if (result.errors.length === 0) {
          setIsImportModalOpen(false);
          setImportFile(null);
          setImportImages([]);

          if (folderName) {
            const importedFolders = JSON.parse(localStorage.getItem('imported_folders') || '[]');
            if (!importedFolders.includes(folderName)) {
              importedFolders.push(folderName);
              localStorage.setItem('imported_folders', JSON.stringify(importedFolders));
            }
          }
        }
      } else {
        toast.error('Có lỗi xảy ra khi nhập hàng.');
      }
    } catch (err: any) {
      console.error('Import error', err);
      const errMsg = err.response?.data?.message || 'Có lỗi xảy ra khi tải file lên.';
      toast.error(errMsg);
    } finally {
      setImporting(false);
    }
  };

  const handleCloseCategorySidebar = () => {
    setIsCategorySidebarClosing(true);
    setTimeout(() => {
      setIsCategorySidebarOpen(false);
      setIsCategorySidebarClosing(false);
      setNewCategoryName('');
      setEditingCategoryId(null);
    }, 300);
  };

  /**
   * Xử lý lưu thông tin sản phẩm (thêm mới hoặc cập nhật thông tin đã chỉnh sửa)
   */
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductErrors({});
    const errors: Record<string, string> = {};

    // Khi thêm mới sản phẩm: bắt buộc phải có ít nhất 1 phân loại
    if (!editingProduct && localVariants.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 phân loại cho sản phẩm.');
      return;
    }

    if (!productForm.name.trim()) {
      errors.name = 'Vui lòng điền vào trường này.';
    }

    if (!productForm.category) {
      errors.category = 'Vui lòng điền vào trường này.';
    }

    if (!productForm.targetSpecies) {
      errors.targetSpecies = 'Vui lòng điền vào trường này.';
    }

    if (!editingProduct && localVariants.length === 0) {
      toast.error('Sản phẩm phải có ít nhất 1 phân loại. Vui lòng thêm biến thể bên dưới để nhập giá, tồn kho và trọng lượng.');
      return;
    }

    const imageList = (productForm.images && productForm.images.length > 0)
      ? productForm.images
      : (productForm.imageUrl.trim() ? [productForm.imageUrl.trim()] : []);

    if (imageList.length === 0) {
      errors.imageUrl = 'Vui lòng tải ít nhất 1 ảnh sản phẩm từ thiết bị.';
    }

    if (Object.keys(errors).length > 0) {
      setProductErrors(errors);
      return;
    }

    const allVariants = editingProduct ? variants : localVariants;

    // Nếu chọn mở bán sản phẩm (isActive === true) nhưng tất cả phân loại đều đang bị ngưng bán
    if (productForm.isActive && allVariants.length > 0) {
      const hasActiveVariant = allVariants.some((v: any) => v.isActive !== false);
      if (!hasActiveVariant) {
        toast.error('Không thể mở bán sản phẩm! Vui lòng mở bán ít nhất 1 phân loại (variant) của sản phẩm.');
        return;
      }
    }

    // Lấy giá bán nhỏ nhất và giá nhập nhỏ nhất từ các phân loại con
    const sellingPrices = allVariants.map((v: any) => Number(v.sellingPrice) || 0).filter((p: number) => p > 0);
    const effectiveSellingPrice = sellingPrices.length > 0
      ? Math.min(...sellingPrices)
      : Number(editingProduct?.sellingPrice || 1);

    const importPrices = allVariants.map((v: any) => Number(v.importPrice) || 0).filter((p: number) => p > 0);
    const minImportPrice = importPrices.length > 0
      ? Math.min(...importPrices)
      : (editingProduct?.importPrice ? Number(editingProduct.importPrice) : null);

    const salePrices = allVariants.map((v: any) => v.salePrice ? Number(v.salePrice) : null).filter((p: number | null): p is number => p !== null && p > 0);
    const calculatedSalePrice = salePrices.length > 0 ? Math.min(...salePrices) : null;

    const weights = allVariants.map((v: any) => v.weightKg ? Number(v.weightKg) : 0.5);
    const productWeightKg = weights.length > 0 ? Math.min(...weights) : 0.5;

    setSubmittingProduct(true);
    try {
      const specifications: Record<string, string> = {};
      Object.entries(productSpecs).forEach(([key, val]) => {
        if (val && String(val).trim()) {
          specifications[key] = String(val).trim();
        }
      });

      const totalCalculatedStock = allVariants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);

      const data: ManagerProductInput = {
        name: productForm.name.trim(),
        category: productForm.category,
        targetSpecies: productForm.targetSpecies,
        sellingPrice: effectiveSellingPrice,
        importPrice: minImportPrice,
        salePrice: calculatedSalePrice,
        stock: totalCalculatedStock,
        weightKg: productWeightKg,
        imageUrl: imageList[0] || undefined,
        images: imageList,
        description: productForm.description.trim() || undefined,
        isFeatured: productForm.isFeatured,
        isActive: productForm.isActive,
        specifications: Object.keys(specifications).length > 0 ? specifications : null,
        variants: !editingProduct && localVariants.length > 0 ? localVariants : undefined,
      };

      if (editingProduct) {
        await managerApi.updateProduct(editingProduct.id, data);
        toast.success('Cập nhật sản phẩm thành công!');
      } else {
        await managerApi.createProduct(data);
        toast.success('Thêm sản phẩm mới thành công!');
      }
      setIsProductModalOpen(false);
      await refreshProducts();
    } catch (error) {
      console.error('Failed to submit product form', error);
      toast.error('Lỗi khi lưu sản phẩm.');
    } finally {
      setSubmittingProduct(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--primary-color)]" />
        <span className="ml-2 text-sm font-bold text-[var(--text-muted)]">Đang tải dữ liệu cửa hàng...</span>
      </div>
    );
  }

  switch (currentTab) {
    case 'products':
      return (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Danh sách sản phẩm</h2>
              <p className="text-sm font-semibold text-[var(--text-muted)]">Quản lý danh mục, kho hàng và các phân loại thực tế.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCategorySidebarOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-[var(--primary-color)] text-[var(--primary-color)] bg-white px-4 py-2.5 font-bold shadow-sm transition hover:bg-[var(--primary-color)]/5 cursor-pointer text-xs"
              >
                <FolderKanban className="size-4" />
                Quản lý danh mục
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportFile(null);
                  setImportResult(null);
                  setIsImportModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl border border-green-600 text-green-700 bg-white px-4 py-2.5 font-bold shadow-sm transition hover:bg-green-50 cursor-pointer text-xs"
              >
                <FileSpreadsheet className="size-4 text-green-600" />
                Nhập Excel
              </button>
              <button
                type="button"
                onClick={handleAddClick}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary-color)] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#cf5017] cursor-pointer text-xs"
              >
                <Plus className="size-4" />
                Thêm sản phẩm mới
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[#EFEAE2] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#B0B0B0]" />
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm theo tên, thương hiệu hoặc mã..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] py-2.5 pl-10 pr-10 text-sm focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="size-4 text-[#B0B0B0]" />

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 rounded-xl border border-[#EFEAE2] bg-white px-3 py-2 text-sm font-bold text-[var(--text-main)]">
                <span className="text-gray-400">Danh mục:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sorting Filter */}
              <div className="flex items-center gap-1.5 rounded-xl border border-[#EFEAE2] bg-white px-3 py-2 text-sm font-bold text-[var(--text-main)]">
                <span className="text-gray-400">Sắp xếp:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="DEFAULT">Mặc định</option>
                  <option value="BEST_SELLER">Bán chạy nhất</option>
                  <option value="PRICE_ASC">Giá tăng dần</option>
                  <option value="PRICE_DESC">Giá giảm dần</option>
                </select>
              </div>

              {/* Stock Filter */}
              <div className="flex items-center gap-1.5 rounded-xl border border-[#EFEAE2] bg-white px-3 py-2 text-sm font-bold text-[var(--text-main)]">
                <span className="text-gray-400">Tồn kho:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="IN_STOCK">Còn hàng (&gt;10)</option>
                  <option value="LOW_STOCK">Sắp hết hàng (&le;10)</option>
                  <option value="OUT_OF_STOCK">Hết hàng (0)</option>
                </select>
              </div>

              {/* Active / Sale Status Filter */}
              <div className="flex items-center gap-1.5 rounded-xl border border-[#EFEAE2] bg-white px-3 py-2 text-sm font-bold text-[var(--text-main)]">
                <span className="text-gray-400">Mở bán:</span>
                <select
                  value={filterActiveStatus}
                  onChange={(e) => setFilterActiveStatus(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">🟢 Đang mở bán</option>
                  <option value="INACTIVE">🔴 Tạm ngưng bán</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-[#EFEAE2] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EFEAE2] bg-[#F9F8F6] text-xs font-black uppercase text-[#8A8980]">
                    <th className="px-4 py-4">Tên sản phẩm</th>
                    <th className="px-4 py-4">Danh mục</th>
                    <th className="px-4 py-4 text-center">Trạng thái</th>
                    <th className="px-4 py-4 text-right">Giá bán</th>
                    <th className="px-4 py-4 text-center">Đã bán</th>
                    <th className="px-4 py-4 text-center">Phân loại</th>
                    <th className="px-4 py-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2]">
                  {paginatedProducts.length > 0 ? (
                    paginatedProducts.map((p) => {
                      const hasVariants = p.variants && p.variants.length > 0;
                      const isExpanded = !!expandedProductGroups[p.id];
                      const totalStock = hasVariants
                        ? p.variants!.reduce((sum: number, v: any) => sum + (v.stock ?? 0), 0)
                        : (p.stock ?? 0);
                      const isLowStock = hasLowStockWarning(p);
                      const hasActiveVariant = hasVariants
                        ? p.variants!.some((v: any) => v.isActive !== false)
                        : true;
                      const isProductActive = hasVariants && !hasActiveVariant ? false : (p.isActive !== false);

                      // Tính khoảng giá min - max từ các biến thể phân loại
                      let priceDisplay = currency.format(p.salePrice ?? p.sellingPrice);
                      if (hasVariants && p.variants!.length > 0) {
                        const sellingPrices = p.variants!.map((v: any) => v.salePrice ?? v.sellingPrice).filter((pr: any) => pr !== undefined && pr !== null);
                        if (sellingPrices.length > 0) {
                          const minP = Math.min(...sellingPrices);
                          const maxP = Math.max(...sellingPrices);
                          priceDisplay = minP === maxP ? currency.format(minP) : `${currency.format(minP)} – ${currency.format(maxP)}`;
                        }
                      }

                      return (
                        <React.Fragment key={p.id}>
                          {/* DÒNG SẢN PHẨM CHÍNH */}
                          <tr
                            onClick={() => toggleProductGroup(p.id)}
                            className="transition hover:bg-orange-50/40 cursor-pointer group bg-white"
                          >
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleProductGroup(p.id);
                                  }}
                                  className="p-1 rounded-md text-gray-400 group-hover:text-primary hover:bg-orange-100/50 transition cursor-pointer"
                                  title={isExpanded ? 'Thu gọn phân loại' : 'Xem các phân loại của sản phẩm'}
                                >
                                  {isExpanded ? <ChevronDown className="size-4 text-primary" /> : <ChevronRight className="size-4" />}
                                </button>
                                {p.imageUrl && (
                                  <img src={p.imageUrl} alt={p.name} className="size-9 object-cover rounded-lg border border-gray-200 shrink-0" />
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-gray-900 group-hover:text-primary transition-colors text-sm">{p.name}</span>
                                    {p.isFeatured && (
                                      <span
                                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-800 shadow-2xs shrink-0"
                                        title="Sản phẩm nổi bật"
                                      >
                                        ⭐ Nổi bật
                                      </span>
                                    )}
                                    {isLowStock && (
                                      <span
                                        className="inline-flex items-center justify-center size-5 rounded-full bg-rose-500 text-white font-black text-xs shadow-xs shrink-0"
                                        title={totalStock === 0 ? "Sản phẩm đã hết hàng!" : "Có phân loại sắp hết hàng (tồn kho < 5)!"}
                                      >
                                        !
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono text-[10px] text-gray-400">#{p.id.slice(0, 8)}</span>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 text-xs text-gray-600 font-semibold">
                              <span className="inline-flex rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                                {dynamicCategoryMap[p.category] || CATEGORY_MAP[p.category] || p.category}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleToggleProductActive(p)}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border transition cursor-pointer',
                                  isProductActive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                )}
                                title={isProductActive ? 'Bấm để tạm ngưng bán' : 'Bấm để mở bán lại'}
                              >
                                {isProductActive ? '🟢 Đang mở bán' : '🔴 Tạm ngưng'}
                              </button>
                            </td>

                            <td className="px-4 py-3.5 text-right font-black text-primary text-xs">{priceDisplay}</td>
                            <td className="px-4 py-3.5 text-center font-bold text-[#0F766E] text-xs">{(p as any).sales ?? 0} sp</td>

                            {/* Số lượng phân loại (Badge văn bản - không phải nút bấm) */}
                            <td className="px-4 py-3.5 text-center">
                              <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 border border-purple-200/60">
                                {hasVariants ? `${p.variants!.length} phân loại` : '0 phân loại'}
                              </span>
                            </td>

                            {/* Cột Thao tác: Comment + Sửa */}
                            <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewFeedback(p);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100/70 transition font-bold text-xs cursor-pointer shadow-2xs"
                                  title="Xem đánh giá & bình luận sản phẩm"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>{(p as any).reviewCount ?? 0}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditClick(p);
                                  }}
                                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-primary hover:bg-orange-50 hover:border-orange-200 transition cursor-pointer"
                                  title="Chỉnh sửa sản phẩm"
                                >
                                  <Edit2 className="size-4" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* BẢNG PHÂN LOẠI / BIẾN THỂ CON MỞ RỘNG */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="bg-slate-50/70 px-4 py-3 border-y border-slate-200/80">
                                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
                                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-[11px] font-extrabold uppercase text-gray-700 tracking-wider flex items-center gap-1.5">
                                        ⚖️ Danh sách phân loại: <span className="text-primary font-black">{p.name}</span>
                                      </h4>
                                      <span className="text-[10px] text-gray-400 font-medium">
                                        ({hasVariants ? p.variants!.length : 0} phân loại)
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenVariantModal(p)}
                                      className="px-2.5 py-1 rounded-lg bg-primary text-white font-bold text-[11px] hover:bg-[#cf5017] transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <Plus className="size-3.5" /> Thêm phân loại mới
                                    </button>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-gray-50/80 text-gray-500 font-bold uppercase text-[10px] border-b border-gray-150">
                                          <th className="py-2 px-3">Hình ảnh</th>
                                          <th className="py-2 px-3">Tên phân loại</th>
                                          <th className="py-2 px-3 text-right">Giá nhập</th>
                                          <th className="py-2 px-3 text-right">Giá bán</th>
                                          <th className="py-2 px-3 text-center">Tồn kho</th>
                                          <th className="py-2 px-3 text-center">Đã bán</th>
                                          <th className="py-2 px-3 text-center">Trạng thái</th>
                                          <th className="py-2 px-3 text-center">Thao tác</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {hasVariants && p.variants!.length > 0 ? (
                                          p.variants!.map((v: any) => {
                                            const vPrice = v.salePrice ?? v.sellingPrice;
                                            return (
                                              <tr key={v.id} className="hover:bg-orange-50/30 transition">
                                                <td className="py-2 px-3">
                                                  {v.imageUrl ? (
                                                    <img src={v.imageUrl} alt="" className="size-8 rounded-lg object-cover border border-gray-200" />
                                                  ) : (
                                                    <div className="size-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-primary">
                                                      <ImageIcon className="size-4" />
                                                    </div>
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 font-bold text-gray-900 text-xs">
                                                  {v.name}
                                                </td>
                                                <td className="py-2 px-3 text-right font-semibold text-gray-600">
                                                  {v.importPrice ? currency.format(v.importPrice) : '-'}
                                                </td>
                                                <td className="py-2 px-3 text-right font-black text-primary">
                                                  {currency.format(vPrice)}
                                                  {v.salePrice && v.salePrice < v.sellingPrice && (
                                                    <span className="block text-[10px] text-gray-400 line-through font-normal">
                                                      {currency.format(v.sellingPrice)}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 text-center font-bold text-gray-800">
                                                  {v.stock}
                                                </td>
                                                <td className="py-2 px-3 text-center font-bold text-teal-700">
                                                  {v.sales ?? 0}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                  <div className="flex flex-col items-center gap-1">
                                                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border", v.isActive !== false ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                                                      {v.isActive !== false ? 'Đang bật' : 'Đang tắt'}
                                                    </span>
                                                    {v.stock === 0 ? (
                                                      <span className="inline-flex rounded-full px-1.5 py-0.2 text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                                        Hết hàng
                                                      </span>
                                                    ) : v.stock < 5 ? (
                                                      <span className="inline-flex rounded-full px-1.5 py-0.2 text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                        Sắp hết ({v.stock})
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                </td>
                                                <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                  <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenVariantModal(p, v)}
                                                      className="p-1 rounded-md border border-gray-200 text-gray-500 hover:text-primary hover:bg-orange-50 transition cursor-pointer"
                                                      title="Chỉnh sửa phân loại này"
                                                    >
                                                      <Edit2 className="size-3.5" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleToggleVariantActive(v, p)}
                                                      className={cn(
                                                        'px-2 py-0.5 rounded-md border text-[10px] font-bold transition cursor-pointer',
                                                        v.isActive !== false
                                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                          : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                                      )}
                                                      title={v.isActive !== false ? 'Bấm để tắt' : 'Bấm để bật'}
                                                    >
                                                      {v.isActive !== false ? '🟢 Bật' : '🔴 Tắt'}
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteVariant(v.id, p)}
                                                      className="p-1 rounded-md border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                      title="Xóa phân loại"
                                                    >
                                                      <Trash2 className="size-3.5" />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })
                                        ) : (
                                          <tr>
                                            <td colSpan={8} className="py-4 text-center text-gray-400 italic">
                                              Chưa có phân loại nào. Nhấn "+ Thêm phân loại mới" để cấu hình.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-400">Không tìm thấy sản phẩm phù hợp.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Products Pagination Controls */}
          {filteredProducts.length > 10 && (
            <div className="flex items-center justify-between border-t border-[#EFEAE2] bg-white px-4 py-3 sm:px-6 mt-4 rounded-2xl shadow-sm">
              <div className="hidden sm:block">
                <p className="text-xs text-gray-500 font-bold">
                  Hiển thị từ <span className="font-black text-[var(--primary-color)]">{(productsPage - 1) * 10 + 1}</span> tới{' '}
                  <span className="font-black text-[var(--primary-color)]">
                    {Math.min(productsPage * 10, filteredProducts.length)}
                  </span>{' '}
                  trong tổng số <span className="font-black text-[var(--primary-color)]">{filteredProducts.length}</span> sản phẩm
                </p>
              </div>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (productsPage > 1) setProductsPage(productsPage - 1);
                      }}
                      className={productsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.ceil(filteredProducts.length / 10) }).map((_, idx) => (
                    <PaginationItem key={idx}>
                      <PaginationLink
                        href="#"
                        isActive={productsPage === idx + 1}
                        onClick={(e) => {
                          e.preventDefault();
                          setProductsPage(idx + 1);
                        }}
                        className="cursor-pointer"
                      >
                        {idx + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (productsPage < Math.ceil(filteredProducts.length / 10)) setProductsPage(productsPage + 1);
                      }}
                      className={productsPage === Math.ceil(filteredProducts.length / 10) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {/* PRODUCT MODAL (ADD / EDIT) - Modal thêm mới và chỉnh sửa sản phẩm */}
          {isProductModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
              onClick={handleCloseProductModal}
            >
              <div
                className={cn(
                  "w-full max-h-[92vh] flex flex-col rounded-2xl border border-gray-150 bg-white p-6 shadow-2xl space-y-4 my-auto relative animate-in zoom-in-95 duration-150",
                  editingProduct ? "max-w-2xl" : "max-w-3xl"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Modal với tiêu đề & nút đóng tròn */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0">
                  <div>
                    <h3 className="text-base font-black text-gray-900">
                      {editingProduct ? 'Chỉnh sửa thông tin sản phẩm' : 'Thêm sản phẩm mới'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 font-semibold">
                      {editingProduct
                        ? 'Cập nhật thông tin chi tiết, khuyến mãi và thông số kỹ thuật của sản phẩm.'
                        : 'Tạo sản phẩm mới, thiết lập giá bán, tồn kho và các biến thể phân loại.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseProductModal}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer shrink-0"
                    title="Đóng modal"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Duy nhất 1 thanh cuộn dọc cho toàn bộ modal, tuyệt đối không chia 2 cột và không cuộn ngang */}
                <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 pr-1.5 space-y-5">
                  {/* Form thông tin sản phẩm chính */}
                  <form id="product-modal-form" noValidate onSubmit={handleProductSubmit} className="space-y-4">
                    {/* Nút submit ẩn hỗ trợ người dùng nhấn phím Enter trên bàn phím */}
                    <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
                    {/* Tên sản phẩm */}
                    <div className="space-y-1 relative">
                      <label className="text-[11px] text-gray-500 font-extrabold uppercase">Tên sản phẩm *</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Thức ăn hạt cho mèo lớn vị cá ngừ"
                        value={productForm.name}
                        onChange={(e) => {
                          setProductForm({ ...productForm, name: e.target.value });
                          if (productErrors.name) setProductErrors({ ...productErrors, name: '' });
                        }}
                        className={cn(
                          "w-full h-10 border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-bold focus:ring-1 focus:ring-primary focus:border-primary transition shadow-2xs",
                          productErrors.name ? "border-rose-400 ring-2 ring-rose-100" : "hover:border-gray-400"
                        )}
                      />
                      <FormErrorTooltip message={productErrors.name} />
                    </div>

                    {/* Danh mục & Loài mục tiêu */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 relative">
                        <label className="text-[11px] text-gray-500 font-extrabold uppercase">Danh mục *</label>
                        <select
                          value={productForm.category}
                          onChange={(e) => {
                            setProductForm({ ...productForm, category: e.target.value });
                            if (productErrors.category) setProductErrors({ ...productErrors, category: '' });
                          }}
                          className={cn(
                            "w-full h-10 border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 bg-white focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer transition shadow-2xs",
                            productErrors.category ? "border-rose-400 ring-2 ring-rose-100" : "hover:border-gray-400"
                          )}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.slug}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <FormErrorTooltip message={productErrors.category} />
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[11px] text-gray-500 font-extrabold uppercase">Loài mục tiêu *</label>
                        <select
                          value={productForm.targetSpecies}
                          onChange={(e) => {
                            setProductForm({ ...productForm, targetSpecies: e.target.value });
                            if (productErrors.targetSpecies) setProductErrors({ ...productErrors, targetSpecies: '' });
                          }}
                          className={cn(
                            "w-full h-10 border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 bg-white focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer transition shadow-2xs",
                            productErrors.targetSpecies ? "border-rose-400 ring-2 ring-rose-100" : "hover:border-gray-400"
                          )}
                        >
                          <option value="ALL">🐾 Tất cả loài</option>
                          <option value="DOG">🐕 Chó</option>
                          <option value="CAT">🐈 Mèo</option>
                        </select>
                        <FormErrorTooltip message={productErrors.targetSpecies} />
                      </div>
                    </div>

                    {/* Thông báo hướng dẫn: Giá cả, khuyến mãi và khối lượng được quản lý tập trung theo Phân loại (Variant) */}
                    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3.5 flex items-start gap-3 text-xs text-orange-900 font-semibold shadow-2xs">
                      <span className="text-base shrink-0">💡</span>
                      <div>
                        <p className="font-bold text-orange-950">Thông tin Giá bán, Khuyến mãi & Trọng lượng</p>
                        <p className="text-[11px] text-orange-800/90 mt-0.5 leading-relaxed">
                          Giá nhập, giá bán lẻ, khuyến mãi và khối lượng đóng gói được quản lý riêng theo từng <strong>Phân loại (Variant)</strong> ở mục ⚖️ <em>Cấu hình phân loại sản phẩm</em> bên dưới.
                        </p>
                      </div>
                    </div>

                    {/* Tải ảnh sản phẩm (CHỈ TẢI TỆP ẢNH TỪ MÁY, KHÔNG NHẬP LINK URL) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-gray-500 font-extrabold uppercase flex items-center gap-1">
                          <Camera className="size-3.5 text-primary" /> Ảnh sản phẩm * <span className="text-gray-400 font-normal lowercase">(tối đa 4 ảnh, ảnh đầu là bìa chính)</span>
                        </label>
                        <span className="text-[11px] font-bold text-primary">
                          {((productForm.images && productForm.images.length > 0) ? productForm.images.length : (productForm.imageUrl ? 1 : 0))}/4 ảnh
                        </span>
                      </div>

                      {/* Grid 4 Thumbnail ảnh */}
                      <div className="grid grid-cols-4 gap-2.5">
                        {Array.from({ length: 4 }).map((_, idx) => {
                          const imageList = (productForm.images && productForm.images.length > 0)
                            ? productForm.images
                            : (productForm.imageUrl ? [productForm.imageUrl] : []);
                          const imgUrl = imageList[idx];

                          return (
                            <div
                              key={idx}
                              className={cn(
                                "relative aspect-square rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center bg-gray-50 transition-all group",
                                imgUrl ? "border-primary/40 shadow-xs bg-white" : "border-dashed border-gray-200 hover:border-primary/60 hover:bg-orange-50/20"
                              )}
                            >
                              {imgUrl ? (
                                <>
                                  <img src={imgUrl} alt={`Ảnh ${idx + 1}`} className="h-full w-full object-cover rounded-lg" />
                                  {idx === 0 && (
                                    <span className="absolute left-1 top-1 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-black text-white shadow-xs">
                                      ★ Bìa
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = imageList.filter((_, i) => i !== idx);
                                      setProductForm({
                                        ...productForm,
                                        images: updated,
                                        imageUrl: updated[0] || '',
                                      });
                                    }}
                                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition cursor-pointer shadow-sm"
                                    title="Xóa ảnh này"
                                  >
                                    <X className="size-3" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => document.getElementById('integrated-product-image-file')?.click()}
                                  className="size-full flex flex-col items-center justify-center text-gray-400 hover:text-primary transition cursor-pointer p-1"
                                >
                                  <Plus className="size-4 mb-0.5" />
                                  <span className="text-[9px] font-bold">Ảnh {idx + 1}</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Khung tải ảnh trực tiếp từ máy (loại bỏ hoàn toàn ô dán link URL) */}
                      {(() => {
                        const imageList = (productForm.images && productForm.images.length > 0)
                          ? productForm.images
                          : (productForm.imageUrl ? [productForm.imageUrl] : []);
                        if (imageList.length >= 4) return null;

                        return (
                          <div>
                            <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-orange-200 hover:border-orange-400 rounded-xl bg-orange-50/40 hover:bg-orange-50 cursor-pointer transition text-xs text-orange-700 font-bold">
                              {uploadingImage ? (
                                <>
                                  <Loader2 className="size-4 animate-spin text-orange-600" />
                                  <span>Đang tải ảnh lên...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="size-4 text-orange-600" />
                                  <span>Tải ảnh từ thiết bị (Chọn tối đa 4 ảnh, chỉ tệp ảnh)</span>
                                </>
                              )}
                              <input
                                id="integrated-product-image-file"
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={uploadingImage}
                                className="hidden"
                                onChange={async (e) => {
                                  const files = e.target.files;
                                  if (files && files.length > 0) {
                                    const fileList = Array.from(files);
                                    const currentList = (productForm.images && productForm.images.length > 0)
                                      ? productForm.images
                                      : (productForm.imageUrl ? [productForm.imageUrl] : []);
                                    const remainingSlots = 4 - currentList.length;
                                    if (remainingSlots <= 0) {
                                      toast.warning('Đã đủ 4 ảnh tối đa cho sản phẩm.');
                                      return;
                                    }
                                    const toUpload = fileList.slice(0, remainingSlots);
                                    setUploadingImage(true);
                                    try {
                                      const res = await uploadImages(toUpload, 'product');
                                      const newUrls = res.map((r: any) => r.url);
                                      const updated = [...currentList, ...newUrls].slice(0, 4);
                                      setProductForm({
                                        ...productForm,
                                        images: updated,
                                        imageUrl: updated[0] || '',
                                      });
                                      if (productErrors.imageUrl) setProductErrors({ ...productErrors, imageUrl: '' });
                                      toast.success(`Đã tải thành công ${newUrls.length} ảnh sản phẩm!`);
                                    } catch (err: any) {
                                      toast.error(err.message || 'Lỗi khi tải ảnh lên.');
                                    } finally {
                                      setUploadingImage(false);
                                    }
                                  }
                                }}
                              />
                            </label>
                            <FormErrorTooltip message={productErrors.imageUrl} />
                          </div>
                        );
                      })()}
                    </div>

                    {/* 7 Thông số kỹ thuật sản phẩm cố định (Thiết kế 2 cột: Tên thuộc tính bên trái, Ô nhập bên phải) */}
                    <div className="space-y-2.5 rounded-xl border border-gray-200 bg-gray-50/50 p-3.5">
                      <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
                        <label className="text-[11px] text-gray-700 font-black uppercase tracking-wider">
                          Thông số kỹ thuật sản phẩm
                        </label>
                      </div>
                      <div className="space-y-2">
                        {FIXED_SPECIFICATIONS.map((spec) => (
                          <div key={spec.key} className="grid grid-cols-12 gap-2 items-center">
                            <span className="col-span-4 text-[11px] font-bold text-gray-600 truncate" title={spec.label}>
                              {spec.label}
                            </span>
                            <div className="col-span-8 relative">
                              {spec.type === 'select' ? (
                                <select
                                  value={productSpecs[spec.key] || ''}
                                  onChange={(e) => setProductSpecs({ ...productSpecs, [spec.key]: e.target.value })}
                                  className="w-full h-8.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-primary cursor-pointer shadow-2xs hover:border-gray-400"
                                >
                                  <option value="">-- Chọn {spec.label.toLowerCase()} --</option>
                                  {spec.options?.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <div className="relative flex items-center">
                                  <input
                                    type={spec.type === 'number' ? 'number' : 'text'}
                                    min={spec.type === 'number' ? '0' : undefined}
                                    placeholder={spec.placeholder}
                                    value={productSpecs[spec.key] || ''}
                                    onChange={(e) => setProductSpecs({ ...productSpecs, [spec.key]: e.target.value })}
                                    className="w-full h-8.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-primary shadow-2xs hover:border-gray-400"
                                  />
                                  {spec.unitLabel && (
                                    <span className="absolute right-2 text-[10px] font-bold text-gray-400">
                                      {spec.unitLabel}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mô tả chi tiết sản phẩm */}
                    <div className="space-y-1 relative">
                      <label className="text-[11px] text-gray-500 font-extrabold uppercase">Mô tả sản phẩm *</label>
                      <textarea
                        rows={3}
                        placeholder="Nhập thông tin mô tả chi tiết về sản phẩm..."
                        value={productForm.description}
                        onChange={(e) => {
                          setProductForm({ ...productForm, description: e.target.value });
                          if (productErrors.description) setProductErrors({ ...productErrors, description: '' });
                        }}
                        className={cn(
                          "w-full border border-gray-300 rounded-xl p-3 text-xs font-bold text-gray-800 bg-white focus:ring-1 focus:ring-primary focus:border-primary transition resize-none shadow-2xs",
                          productErrors.description ? "border-rose-400 ring-2 ring-rose-100" : "hover:border-gray-400"
                        )}
                      />
                      <FormErrorTooltip message={productErrors.description} />
                    </div>

                    {/* Nổi bật & Mở bán */}
                    <div className="flex items-center gap-6 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                        <input
                          type="checkbox"
                          checked={productForm.isFeatured}
                          onChange={(e) => setProductForm({ ...productForm, isFeatured: e.target.checked })}
                          className="size-4 accent-primary rounded cursor-pointer"
                        />
                        ⭐ Sản phẩm nổi bật
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                        <input
                          type="checkbox"
                          checked={productForm.isActive}
                          onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                          className="size-4 accent-primary rounded cursor-pointer"
                        />
                        🟢 Mở bán sản phẩm
                      </label>
                    </div>

                    {/* Khi đang chỉnh sửa sản phẩm: Hiển thị thanh truy cập nhanh quản lý các phân loại sản phẩm */}
                    {editingProduct && (
                      <div className="border border-orange-200 rounded-2xl bg-orange-50/40 p-4 flex items-center justify-between shadow-2xs">
                        <div>
                          <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
                            ⚖️ Phân loại sản phẩm ({variants.length > 0 ? variants.length : (editingProduct.variants?.length || 0)} phân loại)
                          </h4>
                          <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                            Quản lý các phân loại kích thước, màu sắc, trọng lượng đóng gói của sản phẩm này.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenVariantModal(editingProduct)}
                          className="px-3 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-[#cf5017] transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                        >
                          <Edit2 className="size-3.5" /> Chỉnh sửa phân loại
                        </button>
                      </div>
                    )}

                    {/* Khối Cấu hình phân loại / Biến thể sản phẩm (Chỉ hiển thị khi Thêm sản phẩm mới) */}
                    {!editingProduct && (
                      <div className="border border-gray-200 rounded-2xl bg-gray-50/60 p-4 space-y-4 shadow-2xs">
                        <div className="pb-2 border-b border-gray-200">
                          <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider">
                            ⚖️ Cấu hình phân loại sản phẩm
                          </h4>
                          <p className="text-[11px] text-gray-400 font-semibold mt-0.5">
                            Thêm kích thước, màu sắc, hương vị, trọng lượng đóng gói riêng biệt.
                          </p>
                        </div>

                        {/* Mini Variant Form */}
                        <div className="p-3.5 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-2xs">
                          <p className="font-extrabold text-[11px] uppercase tracking-wider text-primary">
                            {editingVariant || editingLocalVariantIndex !== null ? 'Chỉnh sửa biến thể' : '+ Thêm biến thể mới'}
                          </p>

                          <div className="space-y-1 relative">
                            <label className="text-[11px] text-gray-500 font-extrabold uppercase">Tên phân loại *</label>
                            <input
                              type="text"
                              placeholder="Ví dụ: Lon 80g, Gói 1kg, Màu Xanh..."
                              value={variantForm.name}
                              onChange={(e) => {
                                setVariantForm({ ...variantForm, name: e.target.value });
                                if (variantErrors.name) setVariantErrors({ ...variantErrors, name: '' });
                              }}
                              className={cn(
                                "w-full h-9 border border-gray-300 rounded-xl bg-white px-3 text-xs font-bold text-gray-800 focus:outline-none transition shadow-2xs",
                                variantErrors.name ? "border-rose-400 ring-2 ring-rose-100" : "hover:border-gray-400 focus:border-primary"
                              )}
                            />
                            <FormErrorTooltip message={variantErrors.name} />
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1 relative">
                              <label className="text-[11px] text-gray-500 font-extrabold uppercase">Giá nhập (VND) *</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="10.000"
                                value={formatNumberWithDots(variantForm.importPrice)}
                                onChange={(e) => {
                                  const raw = parseRawNumber(e.target.value);
                                  setVariantForm((prev) => {
                                    const shouldAutoFill = !prev.sellingPrice || prev.sellingPrice === prev.importPrice;
                                    return {
                                      ...prev,
                                      importPrice: raw,
                                      sellingPrice: shouldAutoFill ? raw : prev.sellingPrice,
                                    };
                                  });
                                  if (variantErrors.importPrice) setVariantErrors({ ...variantErrors, importPrice: '' });
                                }}
                                className={cn(
                                  "w-full h-9 border border-gray-300 bg-white rounded-xl px-3 text-xs font-bold text-gray-800 focus:outline-none transition shadow-2xs",
                                  variantErrors.importPrice ? "border-rose-400 ring-2 ring-rose-100" : "hover:border-gray-400 focus:border-primary"
                                )}
                              />
                              <FormErrorTooltip message={variantErrors.importPrice} />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-gray-500 font-extrabold uppercase">Giá bán lẻ (VND)</label>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder={variantForm.importPrice ? formatNumberWithDots(variantForm.importPrice) : "15.000"}
                                value={formatNumberWithDots(variantForm.sellingPrice)}
                                onChange={(e) => {
                                  const raw = parseRawNumber(e.target.value);
                                  setVariantForm({ ...variantForm, sellingPrice: raw });
                                }}
                                onBlur={() => {
                                  if (!variantForm.sellingPrice && variantForm.importPrice) {
                                    setVariantForm((prev) => ({ ...prev, sellingPrice: prev.importPrice }));
                                  }
                                }}
                                className="w-full h-9 border border-gray-300 bg-white rounded-xl px-3 text-xs font-bold text-primary hover:border-gray-400 focus:outline-none focus:border-primary shadow-2xs"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <label className="text-[11px] text-gray-500 font-extrabold uppercase">Giảm giá khuyến mãi</label>
                              <div className="flex gap-1.5">
                                <select
                                  value={variantForm.discountType}
                                  onChange={(e) => {
                                    const nextType = e.target.value as 'NONE' | 'AMOUNT' | 'PERCENT';
                                    setVariantForm({
                                      ...variantForm,
                                      discountType: nextType,
                                      discountValue: nextType === 'NONE' ? '' : variantForm.discountValue,
                                    });
                                  }}
                                  className="w-1/2 h-9 border border-gray-300 bg-white rounded-xl px-1.5 text-[10px] font-bold text-gray-800 focus:outline-none focus:border-primary hover:border-gray-400 cursor-pointer shadow-2xs"
                                >
                                  <option value="NONE">Không giảm</option>
                                  <option value="AMOUNT">Số tiền (-đ)</option>
                                  <option value="PERCENT">Phần trăm (-%)</option>
                                </select>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={variantForm.discountType === 'NONE'}
                                  placeholder={variantForm.discountType === 'NONE' ? '— Không giảm —' : (variantForm.discountType === 'AMOUNT' ? 'Ví dụ: 15.000' : 'Ví dụ: 15 (%)')}
                                  value={variantForm.discountType === 'NONE' ? '' : (variantForm.discountType === 'AMOUNT' ? formatNumberWithDots(variantForm.discountValue) : variantForm.discountValue)}
                                  onChange={(e) => {
                                    const raw = variantForm.discountType === 'AMOUNT' ? parseRawNumber(e.target.value) : e.target.value;
                                    setVariantForm({ ...variantForm, discountValue: raw });
                                  }}
                                  className={cn(
                                    "w-1/2 h-9 border rounded-xl px-2 text-xs font-bold transition shadow-2xs",
                                    variantForm.discountType === 'NONE'
                                      ? "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed select-none"
                                      : "border-gray-300 bg-white text-gray-800 hover:border-gray-400 focus:outline-none focus:border-primary"
                                  )}
                                />
                              </div>
                              {(() => {
                                const sp = variantForm.sellingPrice
                                  ? Number(variantForm.sellingPrice)
                                  : Number(productForm.sellingPrice || productForm.importPrice || 0);
                                const ip = Number(variantForm.importPrice) || Number(productForm.importPrice) || 0;
                                if (sp > 0 && variantForm.discountType !== 'NONE' && variantForm.discountValue) {
                                  const res = computeSalePrice(sp, variantForm.discountType, variantForm.discountValue, ip);
                                  if (res.error) {
                                    return <p className="mt-1 text-[10px] font-bold text-red-500">{res.error}</p>;
                                  }
                                  if (res.salePrice !== null) {
                                    const diff = sp - res.salePrice;
                                    return (
                                      <p className="mt-1 text-[10px] font-bold text-emerald-600">
                                        ✓ Hiển thị: {res.salePrice.toLocaleString('vi-VN')}đ (-{diff.toLocaleString('vi-VN')}đ)
                                      </p>
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </div>
                            <div className="space-y-1 relative">
                              <label className="text-[11px] text-gray-500 font-extrabold uppercase">Số lượng kho *</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="Ví dụ: 10"
                                value={variantForm.stock}
                                onChange={(e) => {
                                  setVariantForm({ ...variantForm, stock: e.target.value });
                                  if (variantErrors.stock) setVariantErrors({ ...variantErrors, stock: '' });
                                }}
                                className={cn(
                                  "w-full h-9 border rounded-xl bg-white px-3 text-xs font-semibold focus:outline-none transition",
                                  variantErrors.stock ? "border-rose-400 ring-2 ring-rose-100" : "border-gray-200 focus:border-primary"
                                )}
                              />
                              <FormErrorTooltip message={variantErrors.stock} />
                            </div>
                          </div>

                          <div className="space-y-1 relative">
                            <label className="text-[11px] text-gray-500 font-extrabold uppercase">Trọng lượng biến thể (kg)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Mặc định: 0.5 (kg)"
                              value={variantForm.weightKg}
                              onChange={(e) => {
                                const sanitized = e.target.value.replace(',', '.');
                                if (sanitized === '' || /^\d*\.?\d*$/.test(sanitized)) {
                                  setVariantForm({ ...variantForm, weightKg: sanitized });
                                }
                              }}
                              className="w-full h-9 border border-gray-300 rounded-xl bg-white px-3 text-xs font-bold text-gray-800 focus:outline-none hover:border-gray-400 focus:border-primary transition shadow-2xs"
                            />
                          </div>

                          {/* Tải ảnh biến thể */}
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-500 font-extrabold uppercase flex items-center gap-1">
                              <Camera className="size-3.5 text-primary" /> Ảnh phân loại
                            </label>

                            {variantForm.imageUrl ? (
                              <div className="relative inline-block group rounded-xl overflow-hidden border border-gray-200 shadow-xs max-w-[140px] bg-white">
                                <img
                                  src={variantForm.imageUrl}
                                  alt="Ảnh biến thể"
                                  className="w-full h-20 object-cover rounded-xl"
                                />
                                <button
                                  type="button"
                                  onClick={() => setVariantForm({ ...variantForm, imageUrl: '' })}
                                  className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 transition cursor-pointer"
                                  title="Xóa ảnh phân loại"
                                >
                                  <X className="size-3" />
                                </button>
                              </div>
                            ) : (
                              <div>
                                <label className="flex items-center justify-center gap-2 w-full p-2.5 border-2 border-dashed border-gray-300 hover:border-primary rounded-xl bg-white hover:bg-orange-50/30 cursor-pointer transition text-xs text-gray-600 font-bold">
                                  {uploadingVariantImage ? (
                                    <>
                                      <Loader2 className="size-3.5 animate-spin text-primary" />
                                      <span>Đang tải...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="size-3.5 text-primary" />
                                      <span>Tải 1 ảnh phân loại từ thiết bị</span>
                                    </>
                                  )}
                                  <input
                                    id="integrated-variant-image-file"
                                    type="file"
                                    accept="image/*"
                                    disabled={uploadingVariantImage}
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        setUploadingVariantImage(true);
                                        try {
                                          const res = await uploadImages([file], 'product');
                                          setVariantForm({ ...variantForm, imageUrl: res[0].url });
                                          toast.success('Tải ảnh biến thể thành công!');
                                        } catch (err: any) {
                                          toast.error(err.message || 'Lỗi khi tải ảnh lên.');
                                        } finally {
                                          setUploadingVariantImage(false);
                                        }
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            )}

                            <div className="pt-1">
                              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={variantForm.isActive}
                                  onChange={(e) => setVariantForm({ ...variantForm, isActive: e.target.checked })}
                                  className="size-4 accent-primary rounded cursor-pointer"
                                />
                                <span>🟢 Mở bán phân loại này</span>
                              </label>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1 border-t border-gray-200/60">
                            {(editingLocalVariantIndex !== null || editingVariant) && (
                              <button
                                type="button"
                                onClick={editingProduct ? handleCancelEditVariant : () => {
                                  setEditingLocalVariantIndex(null);
                                  setVariantForm({
                                    name: '',
                                    sellingPrice: '',
                                    importPrice: '',
                                    discountType: 'NONE',
                                    discountValue: '',
                                    stock: '',
                                    weightKg: '0.5',
                                    imageUrl: '',
                                    isActive: true,
                                  });
                                }}
                                className="rounded-xl border border-gray-300 px-3 py-1.5 font-bold hover:bg-gray-100 transition text-[11px] cursor-pointer"
                              >
                                Hủy bỏ
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={editingProduct ? handleVariantSubmit : handleLocalVariantSubmit}
                              disabled={submittingVariant}
                              className="rounded-xl bg-primary px-4 py-1.5 font-bold text-white hover:bg-[#cf5017] transition text-[11px] cursor-pointer flex items-center gap-1"
                            >
                              {submittingVariant && <Loader2 className="size-3 animate-spin text-white" />}
                              {editingVariant || editingLocalVariantIndex !== null ? 'Cập nhật biến thể' : 'Thêm biến thể'}
                            </button>
                          </div>
                        </div>

                        {/* Danh sách biến thể đã có */}
                        <div className="space-y-2">
                          <p className="font-extrabold text-[11px] uppercase tracking-wider text-gray-500">
                            Danh sách biến thể đã thêm ({editingProduct ? variants.length : localVariants.length})
                          </p>
                          {loadingVariants ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="size-5 animate-spin text-primary" />
                            </div>
                          ) : (editingProduct ? variants : localVariants).length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-2">Chưa cấu hình biến thể nào. Sản phẩm sẽ sử dụng phân loại mặc định chính.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(editingProduct ? variants : localVariants).map((v: any, index: number) => (
                                <div key={v.id || index} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-150 bg-white text-xs shadow-2xs hover:border-primary/40 transition">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {v.imageUrl ? (
                                      <img src={v.imageUrl} alt="" className="size-9 rounded-lg object-cover border border-gray-200 shrink-0" />
                                    ) : (
                                      <div className="size-9 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-primary shrink-0">
                                        <ImageIcon className="size-4" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-gray-900 truncate">{v.name}</p>
                                        <span className={cn("text-[9px] font-black px-1.5 py-0.2 rounded border shrink-0", v.isActive !== false ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
                                          {v.isActive !== false ? 'Đang bán' : 'Tạm ngưng'}
                                        </span>
                                      </div>
                                      <p className="text-gray-500 text-[11px] truncate">
                                        Giá: <span className="font-bold text-primary">{v.sellingPrice ? Number(v.sellingPrice).toLocaleString('vi-VN') : 'Mặc định'}đ</span> | Kho: <span className="font-bold">{v.stock}</span> | TL: <span className="font-bold text-gray-700">{v.weightKg ?? 0.5}kg</span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0 ml-1">
                                    <button
                                      type="button"
                                      onClick={() => editingProduct ? handleEditVariantClick(v) : handleEditLocalVariant(index)}
                                      className="p-1.5 text-gray-400 hover:text-primary transition cursor-pointer"
                                      title="Chỉnh sửa biến thể"
                                    >
                                      <Edit2 className="size-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => editingProduct ? handleDeleteVariant(v.id) : handleDeleteLocalVariant(index)}
                                      className="p-1.5 text-gray-400 hover:text-red-500 transition cursor-pointer"
                                      title="Xóa biến thể"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </form>
                </div>

                {/* Footer Modal: Luôn cố định ở chân modal, hiển thị nút Hủy & Cập nhật/Tạo sản phẩm không cần cuộn chuột */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 shrink-0 bg-white">
                  <div className="text-xs text-gray-500 font-medium">
                    {editingProduct ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full bg-emerald-500"></span>
                        Đang chỉnh sửa: <strong className="text-gray-800 font-bold">{editingProduct.name}</strong>
                      </span>
                    ) : (
                      <span className="text-gray-500">
                        {localVariants.length > 0 ? (
                          <span className="text-primary font-bold">✓ Đã thiết lập {localVariants.length} biến thể phân loại</span>
                        ) : (
                          <span>Chưa thêm phân loại riêng (sử dụng phân loại mặc định)</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCloseProductModal}
                      className="px-4 py-2 border border-gray-200 rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer transition text-gray-700"
                    >
                      Hủy
                    </button>
                    <button
                      form="product-modal-form"
                      type="submit"
                      disabled={submittingProduct}
                      onClick={() => {
                        const form = document.getElementById('product-modal-form') as HTMLFormElement;
                        if (form) form.requestSubmit();
                      }}
                      className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#cf5017] transition flex items-center gap-2 cursor-pointer shadow-sm shadow-primary/20 active:scale-98 disabled:opacity-50"
                    >
                      {submittingProduct && <Loader2 className="size-4 animate-spin text-white" />}
                      {editingProduct ? 'Cập nhật sản phẩm' : 'Tạo sản phẩm mới'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}





          {/* Category Sidebar */}
          {isCategorySidebarOpen && (
            <div className="fixed inset-0 z-50 overflow-hidden font-semibold text-xs">
              {/* Backdrop Overlay */}
              <div
                className={cn(
                  "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
                  isCategorySidebarClosing ? "opacity-0" : "opacity-100"
                )}
                onClick={handleCloseCategorySidebar}
              />

              {/* Sidebar Panel */}
              <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex sm:pl-16">
                <div
                  className={cn(
                    "w-screen max-w-xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform relative",
                    isCategorySidebarClosing ? "translate-x-full" : "translate-x-0 animate-in slide-in-from-right"
                  )}
                >
                  {/* Floating Collapse Pull-tab */}
                  <button
                    type="button"
                    onClick={handleCloseCategorySidebar}
                    className="absolute top-1/2 -left-10 -translate-y-1/2 w-10 h-20 bg-white border border-r-0 border-[#EFEAE2] shadow-[-6px_0_15px_rgba(0,0,0,0.06)] rounded-l-2xl flex items-center justify-center text-gray-400 hover:text-[var(--primary-color)] hover:bg-gray-50 transition active:scale-95 cursor-pointer z-50 group"
                    title="Thu gọn Sidebar"
                  >
                    <ChevronsRight className="size-5 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Header */}
                  <div className="px-6 py-5 border-b border-[#EFEAE2] bg-[#F9F8F6]">
                    <h3 className="text-lg font-black text-[var(--text-main)]">
                      Quản lý danh mục sản phẩm
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] font-semibold mt-1">
                      Thêm mới, sửa tên hoặc xóa các danh mục sản phẩm hiện có.
                    </p>
                  </div>

                  {/* Category List Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

                    {/* List of existing categories */}
                    <div className="border border-[#EFEAE2] rounded-2xl overflow-hidden bg-[#FAF9F7]">
                      <table className="w-full text-left text-xs font-semibold">
                        <thead className="bg-[#F0EEEB] text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Tên danh mục</th>
                            <th className="px-4 py-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFEAE2]">
                          {categories.map((cat) => {
                            const isEditing = editingCategoryId === cat.id;
                            return (
                              <tr key={cat.id} className="hover:bg-white transition duration-150">
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editingCategoryName}
                                      onChange={(e) => setEditingCategoryName(e.target.value)}
                                      className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3 py-2 focus:bg-white focus:outline-none text-xs"
                                    />
                                  ) : (
                                    <span className="text-sm font-bold text-[var(--text-main)]">{cat.name}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {isEditing ? (
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!editingCategoryName.trim()) return;
                                          setConfirmState({
                                            isOpen: true,
                                            title: 'Cập nhật danh mục',
                                            message: `Bạn có chắc chắn muốn đổi tên danh mục này thành "${editingCategoryName}"?`,
                                            confirmText: 'Lưu thay đổi',
                                            isDanger: false,
                                            loading: false,
                                            onConfirm: async () => {
                                              setConfirmState((prev) => ({ ...prev, loading: true }));
                                              try {
                                                await managerApi.updateCategory(cat.id, { name: editingCategoryName });
                                                toast.success('Cập nhật danh mục thành công!');
                                                setEditingCategoryId(null);
                                                const catRes = await productsApi.getCategories({ force: true });
                                                setCategories(catRes.data);
                                              } catch (err: any) {
                                                console.error(err);
                                                toast.error(err.response?.data?.message || 'Lỗi khi cập nhật danh mục.');
                                              } finally {
                                                setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => { }, loading: false });
                                              }
                                            }
                                          });
                                        }}
                                        className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition cursor-pointer"
                                        title="Lưu"
                                      >
                                        <Check className="size-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingCategoryId(null)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition cursor-pointer"
                                        title="Hủy"
                                      >
                                        <X className="size-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCategoryId(cat.id);
                                          setEditingCategoryName(cat.name);
                                        }}
                                        className="p-1.5 rounded-lg text-[#0F766E] hover:bg-teal-50 transition cursor-pointer"
                                        title="Sửa"
                                      >
                                        <Edit2 className="size-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setConfirmState({
                                            isOpen: true,
                                            title: 'Xóa danh mục sản phẩm',
                                            message: `Bạn có chắc chắn muốn xóa danh mục "${cat.name}"? Hành động này không thể hoàn tác.`,
                                            confirmText: 'Xóa danh mục',
                                            isDanger: true,
                                            loading: false,
                                            onConfirm: async () => {
                                              setConfirmState((prev) => ({ ...prev, loading: true }));
                                              try {
                                                await managerApi.deleteCategory(cat.id);
                                                toast.success('Xóa danh mục thành công!');
                                                const catRes = await productsApi.getCategories({ force: true });
                                                setCategories(catRes.data);
                                              } catch (err: any) {
                                                console.error(err);
                                                toast.error(err.response?.data?.message || 'Không thể xóa danh mục.');
                                              } finally {
                                                setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => { }, loading: false });
                                              }
                                            }
                                          });
                                        }}
                                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition cursor-pointer"
                                        title="Xóa"
                                      >
                                        <Trash2 className="size-4" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Add New Section */}
                    <div className="rounded-2xl border border-[#EFEAE2] p-5 space-y-3 bg-[#FAF9F7]">
                      <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Thêm danh mục mới</h4>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!newCategoryName.trim()) return;

                          setConfirmState({
                            isOpen: true,
                            title: 'Thêm danh mục mới',
                            message: `Bạn có chắc chắn muốn thêm danh mục mới với tên "${newCategoryName}"?`,
                            confirmText: 'Thêm mới',
                            isDanger: false,
                            loading: false,
                            onConfirm: async () => {
                              setConfirmState((prev) => ({ ...prev, loading: true }));
                              try {
                                await managerApi.createCategory({ name: newCategoryName });
                                toast.success('Thêm danh mục mới thành công!');
                                setNewCategoryName('');
                                const catRes = await productsApi.getCategories({ force: true });
                                setCategories(catRes.data);
                              } catch (error: any) {
                                console.error(error);
                                toast.error(error.response?.data?.message || 'Lỗi khi tạo danh mục mới.');
                              } finally {
                                setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => { }, loading: false });
                              }
                            }
                          });
                        }}
                        className="flex gap-2 text-xs font-semibold"
                      >
                        <input
                          type="text"
                          required
                          placeholder="Ví dụ: Bát ăn & Uống"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="flex-1 rounded-xl border border-[#EFEAE2] bg-white px-3.5 py-2.5 focus:outline-none text-xs focus:ring-2 focus:ring-[var(--primary-color)]"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-[#0F766E] px-4 py-2.5 font-bold text-white hover:bg-[#115E59] transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                        >
                          <Plus className="size-4" />
                          Thêm
                        </button>
                      </form>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Centralized Confirmation Dialog */}
          <ConfirmDialog
            isOpen={confirmState.isOpen}
            onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
            onConfirm={confirmState.onConfirm}
            title={confirmState.title}
            message={confirmState.message}
            confirmText={confirmState.confirmText}
            cancelText={confirmState.cancelText}
            isDanger={confirmState.isDanger}
            loading={confirmState.loading}
          />

          {/* Product Feedback Right Sidebar */}
          {isFeedbackModalOpen && feedbackProduct && (
            <div className="fixed inset-0 z-50 overflow-hidden">
              {/* Backdrop Overlay */}
              <div
                className={cn(
                  "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
                  isFeedbackSidebarClosing ? "opacity-0" : "opacity-100"
                )}
                onClick={handleCloseFeedbackSidebar}
              />

              {/* Sidebar Panel */}
              <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex sm:pl-16">
                <div
                  className={cn(
                    "w-screen max-w-2xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform relative",
                    isFeedbackSidebarClosing ? "translate-x-full" : "translate-x-0 animate-in slide-in-from-right"
                  )}
                >
                  {/* Floating Collapse Pull-tab on the left vertical center edge */}
                  <button
                    type="button"
                    onClick={handleCloseFeedbackSidebar}
                    className="absolute top-1/2 -left-10 -translate-y-1/2 w-10 h-20 bg-white border border-r-0 border-[#EFEAE2] shadow-[-6px_0_15px_rgba(0,0,0,0.06)] rounded-l-2xl flex items-center justify-center text-gray-400 hover:text-[var(--primary-color)] hover:bg-gray-50 transition active:scale-95 cursor-pointer z-50 group"
                    title="Thu gọn Sidebar"
                  >
                    <ChevronsRight className="size-5 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Header */}
                  <div className="px-6 py-5 border-b border-[#EFEAE2] flex items-center justify-between bg-[#F9F8F6]">
                    <div className="flex items-center gap-3">
                      {feedbackProduct.imageUrl ? (
                        <img
                          src={feedbackProduct.imageUrl}
                          alt={feedbackProduct.name}
                          className="size-12 object-cover rounded-xl border border-gray-200 shadow-sm"
                        />
                      ) : (
                        <div className="size-12 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-400">
                          <Package className="size-5" />
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] bg-[var(--primary-color)]/10 text-[var(--primary-color)] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                          {dynamicCategoryMap[feedbackProduct.category] || CATEGORY_MAP[feedbackProduct.category] || feedbackProduct.category}
                        </span>
                        <h3 className="text-base font-black text-[var(--text-main)] mt-1 line-clamp-1">
                          {feedbackProduct.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {feedbackLoading ? (
                      <div className="flex h-60 flex-col items-center justify-center gap-2">
                        <Loader2 className="size-8 animate-spin text-[var(--primary-color)]" />
                        <span className="text-xs font-bold text-gray-500">Đang tải toàn bộ đánh giá...</span>
                      </div>
                    ) : feedbacks.length > 0 ? (
                      <div className="space-y-6">
                        {/* Rating Statistics Summary card */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-2xl bg-orange-50/40 border border-orange-100/60 p-5 items-center">
                          <div className="text-center md:border-r md:border-orange-100/80">
                            <div className="text-4xl font-black text-orange-600">
                              {(feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1)}
                            </div>
                            <div className="flex items-center justify-center mt-1 text-orange-400 text-sm">
                              {"★".repeat(Math.round(feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length))}
                              {"☆".repeat(5 - Math.round(feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length))}
                            </div>
                            <span className="text-[11px] text-gray-400 font-extrabold block mt-1.5">{feedbacks.length} đánh giá khách hàng</span>
                          </div>

                          <div className="md:col-span-2 text-xs text-gray-500 space-y-1.5 font-bold">
                            {[5, 4, 3, 2, 1].map((stars) => {
                              const count = feedbacks.filter((f) => f.rating === stars).length;
                              const pct = feedbacks.length > 0 ? (count / feedbacks.length) * 100 : 0;
                              return (
                                <div key={stars} className="flex items-center gap-3">
                                  <span className="w-10 text-right text-gray-600">{stars} sao</span>
                                  <div className="h-2 flex-1 rounded bg-gray-100 overflow-hidden">
                                    <div className="h-full bg-orange-500 rounded" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="w-8 text-left font-black text-gray-700">{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Reviews list */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-black text-[#8A8980] uppercase tracking-wider">
                            Chi tiết đánh giá ({feedbacks.length})
                          </h4>
                          <div className="divide-y divide-[#EFEAE2]">
                            {feedbacks.map((item) => (
                              <div key={item.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-3">
                                    {item.user?.avatarUrl ? (
                                      <img
                                        src={item.user.avatarUrl}
                                        alt={item.user.name}
                                        className="size-9 rounded-full object-cover border border-gray-200"
                                      />
                                    ) : (
                                      <div className="flex size-9 items-center justify-center rounded-full bg-[var(--primary-color)]/5 border border-[var(--primary-color)]/10 text-xs font-black text-[var(--primary-color)]">
                                        {item.user?.name ? item.user.name.charAt(0).toUpperCase() : '?'}
                                      </div>
                                    )}
                                    <div>
                                      <h5 className="text-xs font-black text-[var(--text-main)]">
                                        {item.user?.name || 'Khách hàng PetMatching'}
                                      </h5>
                                      <div className="flex items-center gap-2 flex-wrap text-orange-400 text-[10px] mt-0.5">
                                        <span>
                                          {"★".repeat(item.rating)}
                                          {"☆".repeat(5 - item.rating)}
                                        </span>
                                        {(item.variantName || item.variant?.name) && (
                                          <span className="text-gray-700 bg-gray-100 border border-gray-200/80 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                            Phân loại: {item.variantName || item.variant?.name}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-black text-gray-400">
                                    {new Date(item.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-gray-700 pl-12 leading-relaxed">
                                  {item.comment ? (
                                    item.comment
                                  ) : (
                                    <span className="italic text-gray-400">Khách hàng không viết nhận xét bằng văn bản.</span>
                                  )}
                                </p>
                                {(item.images?.length ?? 0) > 0 && (
                                  <div className="flex flex-wrap gap-2 pl-12 pt-1">
                                    {item.images.map((imgUrl: string, imgIdx: number) => (
                                      <img
                                        key={imgIdx}
                                        src={imgUrl}
                                        alt={`Review photo ${imgIdx + 1}`}
                                        className="size-14 rounded-lg object-cover border border-gray-200 shadow-2xs hover:scale-105 transition cursor-pointer"
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                        <span className="text-5xl animate-bounce">💬</span>
                        <div>
                          <h4 className="text-sm font-black text-gray-700">Chưa có đánh giá nào</h4>
                          <p className="text-xs text-gray-400 mt-1 max-w-sm">
                            Sản phẩm này chưa nhận được lượt đánh giá hoặc feedback nào từ người mua hàng.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Variant Management Modal */}
          {isVariantModalOpen && selectedProductForVariants && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
              onClick={handleCloseVariantsModal}
            >
              <div
                className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-4 relative animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Sticky Header with Title and Fixed Close Button */}
                <div className="sticky top-0 z-50 flex items-center justify-between pb-3 border-b bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black text-[var(--text-main)] truncate max-w-xl">
                      Quản lý phân loại: <span className="text-primary font-bold">{selectedProductForVariants.name}</span>
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseVariantsModal}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition flex items-center justify-center cursor-pointer shrink-0"
                    title="Đóng modal"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 pr-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left panel: Add/Edit Variant Form */}
                  <form onSubmit={handleVariantSubmit} className="space-y-4 text-xs font-semibold">
                    <p className="font-bold text-[11px] uppercase tracking-wider text-gray-500 pb-1 border-b">
                      {editingVariant ? 'Chỉnh sửa phân loại' : 'Thêm phân loại mới'}
                    </p>

                    <div className="relative">
                      <label className="block text-[11px] font-bold mb-1">Tên phân loại *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Size S - Màu Đỏ, Hộp 500g"
                        value={variantForm.name}
                        onChange={(e) => {
                          setVariantForm({ ...variantForm, name: e.target.value });
                          if (variantErrors.name) setVariantErrors({ ...variantErrors, name: '' });
                        }}
                        className={cn(
                          "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-800 hover:border-gray-400 focus:bg-white focus:border-primary focus:outline-none shadow-2xs transition",
                          variantErrors.name ? "border-rose-400 ring-2 ring-rose-100" : ""
                        )}
                      />
                      <FormErrorTooltip message={variantErrors.name} />
                    </div>

                    {/* Giá nhập & Giá bán lẻ: convert sang tiền Việt (3000 -> 3.000) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 relative">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-bold">
                            Giá nhập (VND) {!editingVariant && '*'}
                          </label>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={!!editingVariant}
                          placeholder="Ví dụ: 100.000"
                          value={formatNumberWithDots(variantForm.importPrice)}
                          onChange={(e) => {
                            const raw = parseRawNumber(e.target.value);
                            setVariantForm((prev) => {
                              const shouldAutoFill = !prev.sellingPrice || prev.sellingPrice === prev.importPrice;
                              return {
                                ...prev,
                                importPrice: raw,
                                sellingPrice: shouldAutoFill ? raw : prev.sellingPrice,
                              };
                            });
                            if (variantErrors.importPrice) setVariantErrors({ ...variantErrors, importPrice: '' });
                          }}
                          className={cn(
                            "w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs font-bold focus:bg-white focus:outline-none transition shadow-2xs",
                            editingVariant ? "bg-gray-100 text-gray-500 cursor-not-allowed select-none" : "bg-white text-gray-800 hover:border-gray-400 focus:border-primary",
                            variantErrors.importPrice ? "border-rose-400 ring-2 ring-rose-100" : ""
                          )}
                        />
                        <FormErrorTooltip message={variantErrors.importPrice} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-bold">Giá bán lẻ (VND)</label>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder={variantForm.importPrice ? formatNumberWithDots(variantForm.importPrice) : "Ví dụ: 150.000"}
                          value={formatNumberWithDots(variantForm.sellingPrice)}
                          onChange={(e) => {
                            const raw = parseRawNumber(e.target.value);
                            setVariantForm({ ...variantForm, sellingPrice: raw });
                          }}
                          onBlur={() => {
                            if (!variantForm.sellingPrice && variantForm.importPrice) {
                              setVariantForm((prev) => ({ ...prev, sellingPrice: prev.importPrice }));
                            }
                          }}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-primary hover:border-gray-400 focus:bg-white focus:border-primary focus:outline-none shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Giảm giá khuyến mãi & Số lượng kho */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold mb-1">Giảm giá khuyến mãi</label>
                        <div className="flex gap-1.5">
                          <select
                            value={variantForm.discountType}
                            onChange={(e) => {
                              const nextType = e.target.value as 'NONE' | 'AMOUNT' | 'PERCENT';
                              setVariantForm({
                                ...variantForm,
                                discountType: nextType,
                                discountValue: nextType === 'NONE' ? '' : variantForm.discountValue,
                              });
                            }}
                            className="w-1/2 rounded-xl border border-gray-300 bg-white px-2 py-2 text-[10px] font-bold text-gray-800 focus:bg-white focus:border-primary hover:border-gray-400 focus:outline-none cursor-pointer shadow-2xs"
                          >
                            <option value="NONE">Không giảm</option>
                            <option value="AMOUNT">Số tiền</option>
                            <option value="PERCENT">Phần trăm</option>
                          </select>
                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={variantForm.discountType === 'NONE'}
                            placeholder={variantForm.discountType === 'NONE' ? '— Không giảm —' : (variantForm.discountType === 'AMOUNT' ? 'Ví dụ: 15.000' : 'Ví dụ: 15')}
                            value={variantForm.discountType === 'NONE' ? '' : (variantForm.discountType === 'AMOUNT' ? formatNumberWithDots(variantForm.discountValue) : variantForm.discountValue)}
                            onChange={(e) => {
                              const raw = variantForm.discountType === 'AMOUNT' ? parseRawNumber(e.target.value) : e.target.value;
                              setVariantForm({ ...variantForm, discountValue: raw });
                            }}
                            className={cn(
                              "w-1/2 rounded-xl border px-2.5 py-2 text-[10px] transition font-bold shadow-2xs",
                              variantForm.discountType === 'NONE'
                                ? "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed select-none"
                                : "border-gray-300 bg-white text-gray-800 hover:border-gray-400 focus:bg-white focus:border-primary focus:outline-none"
                            )}
                          />
                        </div>
                        {(() => {
                          const sp = variantForm.sellingPrice
                            ? Number(variantForm.sellingPrice)
                            : (selectedProductForVariants ? selectedProductForVariants.sellingPrice : Number(productForm.sellingPrice || 0));
                          const ip = Number(variantForm.importPrice) || Number(selectedProductForVariants?.importPrice) || 0;
                          if (sp > 0 && variantForm.discountValue) {
                            const res = computeSalePrice(sp, variantForm.discountType, variantForm.discountValue, ip);
                            if (res.error) {
                              return <p className="mt-1 text-[10px] font-bold text-red-500">{res.error}</p>;
                            }
                          }
                          return null;
                        })()}
                      </div>

                      <div className="relative">
                        <label className="block text-[11px] font-bold mb-1">Số lượng kho *</label>
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="Ví dụ: 10"
                          value={variantForm.stock}
                          onChange={(e) => {
                            setVariantForm({ ...variantForm, stock: e.target.value });
                            if (variantErrors.stock) setVariantErrors({ ...variantErrors, stock: '' });
                          }}
                          className={cn(
                            "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-800 hover:border-gray-400 focus:bg-white focus:border-primary focus:outline-none shadow-2xs transition",
                            variantErrors.stock ? "border-rose-400 ring-2 ring-rose-100" : ""
                          )}
                        />
                        <FormErrorTooltip message={variantErrors.stock} />
                      </div>
                    </div>

                    {/* Ô nhập Trọng lượng (khối lượng kg) cho phân loại biến thể */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold mb-1">Trọng lượng phân loại (kg)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Mặc định: 0.5 (kg)"
                        value={variantForm.weightKg}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(',', '.');
                          if (sanitized === '' || /^\d*\.?\d*$/.test(sanitized)) {
                            setVariantForm({ ...variantForm, weightKg: sanitized });
                          }
                        }}
                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-800 hover:border-gray-400 focus:bg-white focus:border-primary focus:outline-none shadow-2xs transition"
                      />
                    </div>

                    {/* Tải ảnh phân loại biến thể từ thiết bị (không cho nhập link URL) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold flex items-center gap-1">
                        <Camera className="size-3.5 text-primary" /> Ảnh phân loại * <span className="text-gray-400 font-normal lowercase">(chọn tệp từ thiết bị)</span>
                      </label>

                      {variantForm.imageUrl ? (
                        <div className="relative inline-block group rounded-xl overflow-hidden border border-gray-200 shadow-xs max-w-[160px] bg-white">
                          <img
                            src={variantForm.imageUrl}
                            alt="Ảnh biến thể"
                            className="w-full h-24 object-cover rounded-xl"
                          />
                          <button
                            type="button"
                            onClick={() => setVariantForm({ ...variantForm, imageUrl: '' })}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 transition cursor-pointer"
                            title="Xóa ảnh phân loại"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <label className={cn(
                            "flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed rounded-xl bg-white hover:bg-orange-50/30 cursor-pointer transition text-xs font-bold",
                            variantErrors.imageUrl ? "border-rose-400 bg-rose-50/20 text-rose-600" : "border-gray-300 hover:border-primary text-gray-600"
                          )}>
                            {uploadingVariantImage ? (
                              <>
                                <Loader2 className="size-4 animate-spin text-primary" />
                                <span>Đang tải ảnh lên...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="size-4 text-primary" />
                                <span>Tải 1 ảnh phân loại từ thiết bị</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingVariantImage}
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setUploadingVariantImage(true);
                                  try {
                                    const res = await uploadImages([file], 'product');
                                    setVariantForm({ ...variantForm, imageUrl: res[0].url });
                                    if (variantErrors.imageUrl) setVariantErrors({ ...variantErrors, imageUrl: '' });
                                    toast.success('Tải ảnh biến thể thành công!');
                                  } catch (err: any) {
                                    toast.error(err.message || 'Lỗi khi tải ảnh lên.');
                                  } finally {
                                    setUploadingVariantImage(false);
                                  }
                                }
                              }}
                            />
                          </label>
                          <FormErrorTooltip message={variantErrors.imageUrl} />
                        </div>
                      )}

                      <div className="pt-1">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={variantForm.isActive}
                            onChange={(e) => setVariantForm({ ...variantForm, isActive: e.target.checked })}
                            className="size-4 accent-primary rounded cursor-pointer"
                          />
                          <span>🟢 Mở bán phân loại này</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      {editingVariant && (
                        <button
                          type="button"
                          onClick={handleCancelEditVariant}
                          className="rounded-xl border px-4 py-2 font-bold hover:bg-gray-50 transition text-xs"
                        >
                          Hủy bỏ
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={submittingVariant}
                        className="rounded-xl bg-[#0F766E] px-5 py-2 font-bold text-white hover:bg-[#115E59] transition flex items-center gap-1.5 text-xs disabled:opacity-50"
                      >
                        {submittingVariant && <Loader2 className="size-3.5 animate-spin" />}
                        {editingVariant ? 'Cập nhật' : 'Thêm mới'}
                      </button>
                    </div>
                  </form>

                  {/* Right panel: Variants List - Hiển thị toàn bộ các phân loại của sản phẩm đó phía bên phải */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between pb-1 border-b mb-3">
                      <p className="font-bold text-[11px] uppercase tracking-wider text-gray-700">
                        Danh sách phân loại ({variants.length})
                      </p>
                      {editingVariant && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCancelEditVariant();
                          }}
                          className="text-[11px] text-primary hover:underline font-bold cursor-pointer"
                        >
                          + Thêm phân loại mới
                        </button>
                      )}
                    </div>
                    {loadingVariants && variants.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center py-10">
                        <Loader2 className="size-6 animate-spin text-[var(--primary-color)]" />
                      </div>
                    ) : variants.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center text-gray-400 italic text-xs py-10">
                        Sản phẩm này chưa cấu hình phân loại nào.
                      </div>
                    ) : (
                      <div className="space-y-2.5 pr-1 max-h-[60vh] overflow-y-auto">
                        {variants.map((v) => {
                          const isCurrent = editingVariant && editingVariant.id === v.id;
                          const vSelling = v.sellingPrice ? Number(v.sellingPrice) : 0;
                          const vSale = v.salePrice ? Number(v.salePrice) : null;
                          return (
                            <div
                              key={v.id}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border transition text-xs",
                                isCurrent
                                  ? "border-primary bg-orange-50/60 shadow-xs ring-1 ring-primary/40"
                                  : "border-[#EFEAE2] bg-[#F9F8F6]/40 hover:bg-[#F9F8F6]/80"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {v.imageUrl ? (
                                  <img src={v.imageUrl} alt="" className="size-11 rounded-lg object-cover border border-[#EFEAE2] shadow-2xs shrink-0" />
                                ) : (
                                  <div className="size-11 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-primary shrink-0">
                                    <ImageIcon className="size-5" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-[var(--text-main)] text-sm truncate">{v.name}</p>
                                    {isCurrent && (
                                      <span className="text-[9px] font-black bg-primary text-white px-1.5 py-0.2 rounded-md shrink-0">
                                        Đang sửa
                                      </span>
                                    )}
                                    <span className={cn(
                                      "text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0",
                                      v.isActive !== false ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                                    )}>
                                      {v.isActive !== false ? 'Đang bật' : 'Đang tắt'}
                                    </span>
                                  </div>
                                  <p className="text-gray-500 text-[11px] mt-0.5">
                                    Giá nhập: {v.importPrice ? Number(v.importPrice).toLocaleString('vi-VN') + 'đ' : '-'} | Giá bán: <span className="font-bold text-primary">{vSelling.toLocaleString('vi-VN')}đ</span>
                                    {vSale && vSale < vSelling && ` | KM: ${vSale.toLocaleString('vi-VN')}đ`}
                                    {` | Kho: `}<span className={cn("font-bold", v.stock === 0 ? "text-rose-600" : v.stock < 5 ? "text-amber-600" : "text-gray-700")}>{v.stock}</span>
                                    {` | TL: `}<span className="font-bold text-gray-700">{v.weightKg ?? 0.5}kg</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditVariantClick(v)}
                                  className={cn(
                                    "p-1.5 transition rounded-lg border cursor-pointer",
                                    isCurrent ? "bg-primary text-white border-primary" : "text-gray-500 hover:text-primary hover:bg-white border-transparent hover:border-[#EFEAE2]"
                                  )}
                                  title="Chỉnh sửa phân loại này"
                                >
                                  <Edit2 className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariant(v.id)}
                                  className="p-1.5 text-gray-500 hover:text-red-500 transition hover:bg-white rounded-lg border border-transparent hover:border-[#EFEAE2] cursor-pointer"
                                  title="Xóa phân loại"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Excel Import Modal */}
          {isImportModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
              <div className="w-full max-w-lg rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-2xl animate-scaleIn">
                <div className="flex items-center justify-between border-b border-[#EFEAE2] pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="size-5 text-green-600" />
                    <h3 className="text-lg font-black text-gray-800">Nhập hàng bằng file Excel</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleImportExcel} className="space-y-4">
                  {/* Khối hướng dẫn quy tắc nhập Excel và cấu trúc thư mục */}
                  <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 space-y-2.5">
                    <p className="text-xs font-bold text-orange-950 leading-relaxed">
                      📋 <strong>Cơ chế Nhập hàng & Cập nhật Tồn kho:</strong>
                    </p>
                    <ul className="text-[11px] text-orange-900 space-y-1 list-disc pl-4 font-medium leading-relaxed">
                      <li><strong>Cập nhật SP cũ / Nhập thêm tồn kho:</strong> Nhập <em>Mã sản phẩm</em> hoặc <em>Tên sản phẩm</em> sẵn có. Hệ thống sẽ cập nhật thông tin và <strong>cộng dồn</strong> số lượng nhập vào tồn kho hiện tại.</li>
                      <li><strong>Thêm SP mới:</strong> Để trống <em>Mã sản phẩm</em> và điền thông tin SP mới. Hệ thống sẽ tự động khởi tạo SP & phân loại tương ứng.</li>
                      <li><strong>Nhập kèm ảnh tự động:</strong> Chọn tab <strong>Nhập trọn thư mục</strong>. Đặt file Excel tại thư mục gốc, kèm theo các thư mục con đặt tên dạng <code>[Mã_SP]</code> (ảnh chính) hoặc <code>[Mã_SP]-[Tên_Phân_Loại]</code> (ảnh phân loại).</li>
                    </ul>
                    <div className="pt-1 border-t border-orange-200/60">
                      <a
                        href="/import_template.xlsx"
                        download="import_products_template.xlsx"
                        className="inline-flex items-center gap-1.5 text-xs font-black text-[#0F766E] hover:underline"
                      >
                        📥 Tải file Excel mẫu chuẩn (.xlsx có sẵn dữ liệu mẫu)
                      </a>
                    </div>
                  </div>

                  <div className="flex border-b border-[#EFEAE2] mb-3 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode('file');
                        setImportFile(null);
                        setImportImages([]);
                      }}
                      className={cn(
                        "flex-1 pb-2 border-b-2 transition-all cursor-pointer text-center",
                        importMode === 'file' ? "border-[var(--primary-color)] text-[var(--primary-color)]" : "border-transparent text-gray-400"
                      )}
                    >
                      📄 Chỉ nhập file Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode('folder');
                        setImportFile(null);
                        setImportImages([]);
                      }}
                      className={cn(
                        "flex-1 pb-2 border-b-2 transition-all cursor-pointer text-center",
                        importMode === 'folder' ? "border-[var(--primary-color)] text-[var(--primary-color)]" : "border-transparent text-gray-400"
                      )}
                    >
                      📁 Nhập trọn thư mục (Kèm Ảnh)
                    </button>
                  </div>

                  {importMode === 'file' ? (
                    <div className="space-y-2 animate-fadeIn">
                      <label className="text-[11px] text-gray-500 font-extrabold uppercase block">Chọn file Excel nhập hàng *</label>
                      <div className="relative border-2 border-dashed border-[#EFEAE2] hover:border-green-500 rounded-2xl bg-[#F9F8F6] p-6 text-center cursor-pointer transition">
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          required
                          onChange={(e) => {
                            setImportFile(e.target.files?.[0] || null);
                            setImportImages([]);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="space-y-2">
                          {importFile ? (
                            <FileSpreadsheet className="size-8 text-green-600 mx-auto" />
                          ) : (
                            <Upload className="size-8 text-gray-400 mx-auto animate-bounce" />
                          )}
                          <p className="text-sm font-bold text-gray-600">
                            {importFile ? importFile.name : 'Tải lên file Excel nhập hàng'}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium">Hỗ trợ định dạng .xlsx, .xls tối đa 10MB</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 animate-fadeIn">
                      <label className="text-[11px] text-gray-500 font-extrabold uppercase block">Chọn thư mục nhà cung cấp *</label>
                      <div className="relative border-2 border-dashed border-[#EFEAE2] hover:border-green-500 rounded-2xl bg-[#F9F8F6] p-6 text-center cursor-pointer transition">
                        <input
                          type="file"
                          {...{
                            webkitdirectory: "",
                            directory: ""
                          } as any}
                          multiple
                          required
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            const excel = files.find(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
                            const images = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name));

                            if (!excel) {
                              toast.error('Không tìm thấy file Excel (.xlsx hoặc .xls) trong thư mục bạn chọn!');
                              setImportFile(null);
                              setImportImages([]);
                              setIsDuplicateFolder(false);
                              return;
                            }
                            setImportFile(excel);
                            setImportImages(images);
                            toast.success(`Nhận diện file Excel: ${excel.name} và ${images.length} tệp ảnh sản phẩm.`);

                            const pathParts = excel.webkitRelativePath?.split('/');
                            const folderName = pathParts && pathParts.length > 0 ? pathParts[0] : '';
                            if (folderName) {
                              const importedFolders = JSON.parse(localStorage.getItem('imported_folders') || '[]');
                              setIsDuplicateFolder(importedFolders.includes(folderName));
                            } else {
                              setIsDuplicateFolder(false);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="space-y-2">
                          {importFile ? (
                            <Folder className="size-8 text-green-600 mx-auto" />
                          ) : (
                            <Upload className="size-8 text-gray-400 mx-auto animate-bounce" />
                          )}
                          <p className="text-sm font-bold text-gray-600">
                            {importFile
                              ? `Thư mục: ${(importFile as any).webkitRelativePath?.split('/')[0] || ''}`
                              : 'Tải lên thư mục hóa đơn tương ứng'}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium">
                            {importImages.length > 0
                              ? `Đã nhận diện file Excel: ${importFile?.name} và ${importImages.length} ảnh sản phẩm`
                              : 'Chọn thư mục chứa file Excel và các thư mục ảnh con'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {importMode === 'folder' && isDuplicateFolder && (
                    <div className="rounded-xl bg-red-50 border border-red-100 p-3.5 flex items-start gap-2.5 text-xs font-semibold text-red-800 animate-fadeIn">
                      <AlertCircle className="size-4.5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Cảnh báo trùng thư mục:</strong> Thư mục này đã từng được nhập hàng trước đó. Nhập tiếp sẽ tiếp tục cộng dồn số lượng tồn kho của các sản phẩm.
                      </div>
                    </div>
                  )}

                  {/* Show errors or results */}
                  {importResult && (
                    <div className="rounded-xl border border-gray-100 bg-[#FAF9F6] p-4 max-h-[12rem] overflow-y-auto space-y-2 animate-fadeIn">
                      <p className="text-xs font-extrabold text-gray-700">Kết quả xử lý:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                        <div className="bg-green-50 text-green-700 p-2 rounded-lg text-center">
                          Cập nhật: {importResult.updatedCount} SP
                        </div>
                        <div className="bg-blue-50 text-blue-700 p-2 rounded-lg text-center">
                          Tạo mới: {importResult.createdCount} SP
                        </div>
                      </div>
                      {importResult.errors.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-gray-200">
                          <p className="text-[10px] font-black text-red-600">Một số dòng bị bỏ qua hoặc gặp lỗi:</p>
                          <ul className="list-disc pl-4 text-[10px] font-bold text-red-500 space-y-0.5">
                            {importResult.errors.map((err: any, idx: number) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(false)}
                      className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={importing || !importFile}
                      className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 cursor-pointer flex items-center gap-1.5"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Đang nhập hàng...
                        </>
                      ) : (
                        'Bắt đầu nhập'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}


        </div>
      );

    case 'orders':
      const showBatchCheckboxes =
        filterStatus !== 'ALL' &&
        filterStatus !== 'DELIVERED' &&
        filterStatus !== 'SHIPPED' &&
        filterStatus !== 'CANCELLED';
      return (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Danh sách đơn hàng</h2>
              <p className="text-sm font-semibold text-[var(--text-muted)]">Danh sách hóa đơn mua sắm thực tế của khách hàng.</p>
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 rounded-xl border border-[#EFEAE2] bg-white hover:bg-[#F9F8F6] px-4 py-2.5 font-extrabold text-sm text-[var(--text-main)] shadow-sm transition-all"
            >
              <FileSpreadsheet className="size-4 text-green-600" />
              Xuất sang Excel
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[#EFEAE2] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#B0B0B0]" />
              <input
                type="text"
                placeholder="Tìm theo khách hàng hoặc mã đơn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] py-2.5 pl-10 pr-10 text-sm focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {showBatchCheckboxes && selectedOrderIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 bg-teal-50 border border-teal-200 text-teal-900 px-3 py-1.5 rounded-xl text-xs font-bold animate-fadeIn">
                  <span>Đã chọn {selectedOrderIds.length} đơn</span>

                  {(filterStatus === 'PENDING' || filterStatus === 'PROCESSING') && (
                    <button
                      type="button"
                      disabled={submittingBatch}
                      onClick={() => handleBatchStatusChange('CONFIRMED', 'Đã xác nhận')}
                      className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {submittingBatch ? <Loader2 className="size-3 animate-spin text-white" /> : '✓'}
                      Xác nhận hàng loạt ({selectedOrderIds.length})
                    </button>
                  )}

                  {filterStatus === 'CONFIRMED' && (
                    <button
                      type="button"
                      disabled={submittingBatch}
                      onClick={() => handleBatchStatusChange('SHIPPED', 'Đã gửi vận chuyển')}
                      className="inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {submittingBatch ? <Loader2 className="size-3 animate-spin text-white" /> : '🚚'}
                      Gửi vận chuyển tất cả ({selectedOrderIds.length})
                    </button>
                  )}

                  {filterStatus === 'REFUND_PENDING' && (
                    <button
                      type="button"
                      disabled={submittingBatch}
                      onClick={handleBatchApproveRefund}
                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {submittingBatch ? <Loader2 className="size-3 animate-spin text-white" /> : '✅'}
                      Duyệt hoàn tiền tất cả ({selectedOrderIds.length})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds([])}
                    className="text-teal-700 hover:text-teal-950 font-extrabold underline text-[11px] cursor-pointer ml-1"
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}

              {/* Thông báo hướng dẫn tự động đồng bộ khi ở tab Đang giao */}
              {filterStatus === 'SHIPPED' && (
                <div className="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs font-bold">
                  <span>🛵 Đơn đang giao được tự động cập nhật "Giao thành công" từ AhaMove Sandbox khi hoàn tất</span>
                </div>
              )}

              {/* Nút bấm làm mới và đồng bộ trực tiếp trạng thái các vận đơn AhaMove */}
              <button
                type="button"
                disabled={syncingAhamove}
                onClick={() => void handleSyncAhamoveOrders()}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                title="Đồng bộ ngay lập tức các trạng thái mới nhất từ AhaMove Portal"
              >
                <RefreshCw className={`size-3.5 text-rose-700 ${syncingAhamove ? 'animate-spin' : ''}`} />
                <span>Đồng bộ AhaMove</span>
              </button>
              <Filter className="size-4 text-[#B0B0B0]" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl border border-[#EFEAE2] bg-white px-3 py-2.5 text-sm font-bold text-[var(--text-main)] focus:outline-none"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="REFUND_PENDING">⏳ Yêu cầu hoàn tiền</option>
                <option value="REFUND_APPROVED">✅ Đã duyệt hoàn tiền</option>
                {Object.keys(ORDER_STATUS_MAP).map((status) => (
                  <option key={status} value={status}>{ORDER_STATUS_MAP[status]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-[#EFEAE2] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EFEAE2] bg-[#F9F8F6] text-xs font-black uppercase text-[#8A8980]">
                    {showBatchCheckboxes && (
                      <th className="px-4 py-4 text-center w-12">
                        <input
                          type="checkbox"
                          checked={
                            paginatedOrders.length > 0 &&
                            paginatedOrders.every((o) => selectedOrderIds.includes(o.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              const pageIds = paginatedOrders.map((o) => o.id);
                              setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                            } else {
                              const pageIds = new Set(paginatedOrders.map((o) => o.id));
                              setSelectedOrderIds((prev) => prev.filter((id) => !pageIds.has(id)));
                            }
                          }}
                          title="Chọn tất cả đơn hàng trên trang này"
                          className="size-4 rounded border-gray-300 text-[#0F766E] focus:ring-[#0F766E] cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-6 py-4">Mã đơn</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">SĐT</th>
                    <th className="px-6 py-4">Địa chỉ giao hàng</th>
                    <th className="px-6 py-4">Sản phẩm mua</th>
                    <th className="px-6 py-4">Ngày đặt</th>
                    <th className="px-6 py-4 text-right">Tổng thanh toán</th>
                    <th className="px-6 py-4 text-center">Thao tác / Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2]">
                  {paginatedOrders.length > 0 ? (
                    paginatedOrders.map((o) => {
                      const shippingInfo = parseShippingAddress(o.shippingAddress);
                      const customerFullName = (shippingInfo.name && shippingInfo.name !== 'Chưa rõ')
                        ? shippingInfo.name
                        : (o.customerNameSnapshot?.trim() || o.user?.name?.trim() || 'Khách hàng');
                      const customerFullPhone = (shippingInfo.phone && shippingInfo.phone !== 'Chưa rõ')
                        ? shippingInfo.phone
                        : (o.customerPhoneSnapshot?.trim() || o.user?.phone?.trim() || 'Chưa cung cấp');
                      const isSelected = selectedOrderIds.includes(o.id);
                      return (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedOrderDetails(o)}
                          className={cn(
                            "transition hover:bg-gray-50 cursor-pointer",
                            isSelected && "bg-teal-50/50 hover:bg-teal-50/70"
                          )}
                        >
                          {showBatchCheckboxes && (
                            <td className="px-4 py-4 text-center w-12" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedOrderIds((prev) => [...prev, o.id]);
                                  } else {
                                    setSelectedOrderIds((prev) => prev.filter((id) => id !== o.id));
                                  }
                                }}
                                className="size-4 rounded border-gray-300 text-[#0F766E] focus:ring-[#0F766E] cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="px-6 py-4 font-mono font-black text-xs text-[#5C5B52]" title={o.id}>
                            <div className="flex flex-col gap-1">
                              <span>{o.id.length > 15 ? o.id.slice(0, 12) + '...' : o.id}</span>
                              {o.refundStatus === 'PENDING' && (
                                <span className="inline-flex items-center w-fit rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-black text-amber-800 animate-pulse">
                                  ⏳ Y/C Hoàn tiền
                                </span>
                              )}
                              {o.refundStatus === 'REFUNDED' && (
                                <span className="inline-flex items-center w-fit rounded bg-green-50 border border-green-200 px-1.5 py-0.5 text-[9px] font-black text-green-800">
                                  ✅ Đã duyệt hoàn tiền
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-[var(--text-main)]">
                            {customerFullName}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-[#5C5B52]">
                            {customerFullPhone}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-[#5C5B52] max-w-xs truncate" title={shippingInfo.address}>
                            {shippingInfo.address}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-[#5C5B52]">
                            <div className="space-y-1.5">
                              {o.items.map((i, idx) => (
                                <div key={idx} className="line-clamp-1">
                                  {i.quantity}x {i.product.name}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#8A8980]">
                            <div className="font-semibold text-xs text-[var(--text-main)]">
                              {new Date(o.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                            <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                              {new Date(o.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-[var(--primary-color)]">{currency.format(o.totalAmount)}</td>
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            {/* Ưu tiên hiển thị mã AhaMove và nút Theo dõi AhaMove ngay khi có ahamoveOrderCode */}
                            {o.refundStatus === 'REFUNDED' ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black bg-green-50 border border-green-200 text-green-700 shadow-sm">
                                ✅ Đã duyệt hoàn tiền
                              </span>
                            ) : o.refundStatus === 'PENDING' ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black bg-amber-50 border border-amber-200 text-amber-700 shadow-sm">
                                ⏳ Chờ duyệt hoàn tiền
                              </span>
                            ) : o.status === 'CANCELLED' ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black bg-red-50 border border-red-200 text-red-700 shadow-sm">
                                ❌ Đã hủy
                              </span>
                            ) : o.status === 'DELIVERED' ? (
                              // Đã hoàn thành -> Giao hàng thành công
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm">
                                  🎉 Giao hàng thành công
                                </span>
                                {o.ahamoveOrderCode && (
                                  <button
                                    type="button"
                                    onClick={() => setTrackingAhamoveCode(o.ahamoveOrderCode!)}
                                    className="text-[10px] font-bold text-gray-500 hover:text-rose-600 underline cursor-pointer"
                                  >
                                    Xem hành trình
                                  </button>
                                )}
                              </div>
                            ) : o.ahamoveOrderCode || o.status === 'SHIPPED' ? (
                              // Đã gửi AhaMove thành công (có mã ahamoveOrderCode) -> Hiển thị mã AhaMove & Nút theo dõi
                              <div className="flex flex-col items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black bg-purple-50 border border-purple-200 text-purple-700 shadow-sm">
                                  🛵 {o.shippingStatus === 'ACCEPTED' || o.shippingStatus === 'IN_PROCESS' ? 'Đang giao' : 'Đã gửi VC'}
                                </span>
                                {o.ahamoveOrderCode && (
                                  <button
                                    type="button"
                                    onClick={() => setTrackingAhamoveCode(o.ahamoveOrderCode!)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 shadow-2xs transition cursor-pointer"
                                    title="Click xem chi tiết hành trình AhaMove"
                                  >
                                    ⚡ AhaMove: {o.ahamoveOrderCode}
                                  </button>
                                )}
                              </div>
                            ) : o.status === 'CONFIRMED' ? (
                              // Đã xác nhận -> Manager bấm nút "Gửi AhaMove"
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 shadow-2xs">
                                  ✓ Đã xác nhận
                                </span>
                                <button
                                  type="button"
                                  disabled={creatingAhamoveOrder === o.id}
                                  onClick={() => handleCreateAhamoveShippingOrder(o.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-rose-600 rounded-xl hover:bg-rose-700 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                                  title="Gửi hỏa tốc 1-2h qua AhaMove Sandbox"
                                >
                                  {creatingAhamoveOrder === o.id ? (
                                    <Loader2 className="size-3.5 animate-spin text-white" />
                                  ) : (
                                    '⚡'
                                  )}
                                  <span>Gửi AhaMove</span>
                                </button>
                              </div>
                            ) : (
                              // Đơn mới (PENDING) -> Manager bấm nút "Xác nhận đơn"
                              <div className="flex flex-col items-center gap-1.5">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black",
                                  o.payment?.method === 'QR' && o.payment?.status === 'PAID'
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                )}>
                                  {o.payment?.method === 'QR' && o.payment?.status === 'PAID' ? '💳 Đã thanh toán' : '⏳ Chờ xác nhận'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOrderStatusChange(o.id, 'CONFIRMED')}
                                  className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-extrabold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md transition active:scale-95 cursor-pointer"
                                >
                                  ✓ Xác nhận đơn
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={showBatchCheckboxes ? 9 : 8} className="px-6 py-12 text-center text-gray-400">Không tìm thấy đơn hàng nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Orders Pagination Controls */}
          {filteredOrders.length > 10 && (
            <div className="flex items-center justify-between border-t border-[#EFEAE2] bg-white px-4 py-3 sm:px-6 mt-4 rounded-2xl shadow-sm">
              <div className="hidden sm:block">
                <p className="text-xs text-gray-500 font-bold">
                  Hiển thị từ <span className="font-black text-[var(--primary-color)]">{(ordersPage - 1) * 10 + 1}</span> tới{' '}
                  <span className="font-black text-[var(--primary-color)]">
                    {Math.min(ordersPage * 10, filteredOrders.length)}
                  </span>{' '}
                  trong tổng số <span className="font-black text-[var(--primary-color)]">{filteredOrders.length}</span> đơn hàng
                </p>
              </div>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (ordersPage > 1) setOrdersPage(ordersPage - 1);
                      }}
                      className={ordersPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.ceil(filteredOrders.length / 10) }).map((_, idx) => (
                    <PaginationItem key={idx}>
                      <PaginationLink
                        href="#"
                        isActive={ordersPage === idx + 1}
                        onClick={(e) => {
                          e.preventDefault();
                          setOrdersPage(idx + 1);
                        }}
                        className="cursor-pointer"
                      >
                        {idx + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (ordersPage < Math.ceil(filteredOrders.length / 10)) setOrdersPage(ordersPage + 1);
                      }}
                      className={ordersPage === Math.ceil(filteredOrders.length / 10) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {selectedOrderDetails && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
              onClick={() => setSelectedOrderDetails(null)}
            >
              <div
                className="w-full max-w-2xl rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-4 my-8 relative animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  <X className="size-5" />
                </button>

                <h3 className="text-lg font-black text-[var(--text-main)] pb-2 border-b">
                  Chi tiết đơn hàng: {selectedOrderDetails.id}
                </h3>

                {/* Hiển thị Mã vận đơn AhaMove Hỏa Tốc và nút tra cứu trong Modal chi tiết đơn */}
                {selectedOrderDetails.ahamoveOrderCode && (
                  <div className="flex items-center justify-between bg-rose-50/80 p-3 rounded-xl border border-rose-200 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-rose-900">⚡ Mã vận đơn AhaMove Hỏa Tốc:</span>
                      <span className="font-mono font-black text-rose-900 bg-white px-2 py-0.5 rounded border border-rose-200">
                        {selectedOrderDetails.ahamoveOrderCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTrackingAhamoveCode(selectedOrderDetails.ahamoveOrderCode!)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition shadow-xs cursor-pointer"
                    >
                      Xem lịch sử tracking AhaMove ➔
                    </button>
                  </div>
                )}

                {/* Delivery Info */}
                {(() => {
                  const info = parseShippingAddress(selectedOrderDetails.shippingAddress);
                  const customerFullName = (info.name && info.name !== 'Chưa rõ')
                    ? info.name
                    : (selectedOrderDetails.customerNameSnapshot?.trim() || selectedOrderDetails.user?.name?.trim() || 'Khách hàng');
                  const customerFullPhone = (info.phone && info.phone !== 'Chưa rõ')
                    ? info.phone
                    : (selectedOrderDetails.customerPhoneSnapshot?.trim() || selectedOrderDetails.user?.phone?.trim() || 'Chưa cung cấp');
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                      <div className="space-y-1 bg-[#F9F8F6] p-3 rounded-xl border border-[#EFEAE2]">
                        <p className="font-black text-[#8A8980] uppercase tracking-wider text-[10px]">Thông tin người nhận</p>
                        <p className="text-sm font-bold text-[var(--text-main)]">{customerFullName}</p>
                        <p className="text-[var(--text-muted)] mt-0.5 font-mono">SĐT: {customerFullPhone}</p>
                      </div>
                      <div className="space-y-1 bg-[#F9F8F6] p-3 rounded-xl border border-[#EFEAE2]">
                        <p className="font-black text-[#8A8980] uppercase tracking-wider text-[10px]">Địa chỉ giao hàng</p>
                        <p className="text-sm font-bold text-[var(--text-main)] leading-relaxed">{info.address}</p>
                        {info.note && (
                          <p className="text-amber-700 italic text-[11px] mt-1.5 font-bold">Ghi chú: {info.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Order Items Table */}
                <div className="overflow-hidden rounded-xl border border-[#EFEAE2]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#EFEAE2] bg-[#F9F8F6] text-xs font-black uppercase text-[#8A8980]">
                        <th className="px-4 py-2.5">Sản phẩm</th>
                        <th className="px-4 py-2.5 text-center w-20">Số lượng</th>
                        <th className="px-4 py-2.5 text-right w-28">Đơn giá</th>
                        <th className="px-4 py-2.5 text-right w-32">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFEAE2]">
                      {selectedOrderDetails.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 font-semibold text-[var(--text-main)]">
                          <td className="px-4 py-3 flex items-center gap-3">
                            {item.product.imageUrl && (
                              <img src={item.product.imageUrl} alt={item.product.name} className="size-10 object-cover rounded border bg-white shrink-0" />
                            )}
                            <span className="line-clamp-2">{item.product.name}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-sm">{item.quantity}</td>
                          <td className="px-4 py-3 text-right">{currency.format(item.price)}</td>
                          <td className="px-4 py-3 text-right font-bold text-[var(--primary-color)]">
                            {currency.format(item.price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Refund Details Section */}
                {selectedOrderDetails.refundStatus && (
                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 text-xs space-y-2 animate-fadeIn font-semibold mt-4">
                    <p className="font-black text-amber-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <RefreshCw className="size-3.5 text-amber-700 animate-spin-slow" />
                      Yêu cầu hoàn tiền từ khách hàng
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-[#5C5B52] mt-1 pt-1.5 border-t border-amber-100">
                      <div>
                        <span className="text-[10px] text-gray-500 block">Số tài khoản:</span>
                        <span className="font-bold text-sm text-[var(--text-main)] font-mono">{selectedOrderDetails.refundAccountNumber}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Chủ tài khoản:</span>
                        <span className="font-bold text-sm text-[var(--text-main)]">{selectedOrderDetails.refundAccountName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Ngân hàng:</span>
                        <span className="font-bold text-xs text-[var(--text-main)]">
                          {(() => {
                            const bank = banks.find(b => b.bin === selectedOrderDetails.refundBankCode);
                            return bank ? `${bank.shortName} - ${bank.name}` : selectedOrderDetails.refundBankCode;
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Trạng thái hoàn:</span>
                        <span className={cn(
                          "font-bold uppercase text-[10px] px-1.5 py-0.5 rounded",
                          selectedOrderDetails.refundStatus === 'PENDING' && 'bg-amber-100 text-amber-800',
                          selectedOrderDetails.refundStatus === 'REFUNDED' && 'bg-green-100 text-green-800',
                          selectedOrderDetails.refundStatus === 'FAILED' && 'bg-red-100 text-red-800'
                        )}>
                          {selectedOrderDetails.refundStatus === 'PENDING' ? 'Chờ duyệt' : selectedOrderDetails.refundStatus === 'REFUNDED' ? 'Đã duyệt hoàn tiền' : 'Đã từ chối'}
                        </span>
                      </div>
                    </div>
                    {selectedOrderDetails.refundReason && (
                      <div className="pt-1.5 border-t border-amber-100 text-xs text-[#5C5B52]">
                        <span className="text-[10px] text-gray-500 block">Lý do hoàn:</span>
                        <span className="italic">"{selectedOrderDetails.refundReason}"</span>
                      </div>
                    )}

                    {/* Refund Proof Image Upload & Display - Chỉ hiển thị khi đã duyệt hoàn tiền */}
                    {selectedOrderDetails.refundStatus === 'REFUNDED' && (
                      <div className="pt-2 border-t border-amber-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-black text-amber-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5 text-amber-700" />
                            Ảnh chuyển khoản hoàn tiền
                          </p>
                          <label className="text-[10px] font-bold text-amber-900 hover:text-amber-950 bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1">
                            {uploadingRefundProof ? (
                              <Loader2 className="size-3 animate-spin text-amber-900" />
                            ) : (
                              <Upload className="size-3 text-amber-900" />
                            )}
                            {selectedOrderDetails.refundProofUrl || pendingRefundProofUrl ? 'Cập nhật / Thay ảnh' : 'Tải ảnh chuyển khoản'}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingRefundProof}
                              onChange={handleRefundProofUpload}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {(selectedOrderDetails.refundProofUrl || pendingRefundProofUrl) ? (
                          <div className="relative mt-1 group">
                            <a href={selectedOrderDetails.refundProofUrl || pendingRefundProofUrl || '#'} target="_blank" rel="noreferrer" className="block">
                              <img
                                src={selectedOrderDetails.refundProofUrl || pendingRefundProofUrl || ''}
                                alt="Ảnh chuyển khoản hoàn tiền"
                                className="w-full max-h-52 object-cover rounded-lg border border-amber-300 hover:opacity-95 transition cursor-pointer shadow-xs"
                              />
                            </a>
                            <button
                              type="button"
                              onClick={handleRemoveRefundProof}
                              disabled={uploadingRefundProof}
                              className="absolute top-2 right-2 size-7 rounded-full bg-red-600/90 text-white flex items-center justify-center hover:bg-red-700 shadow-md transition cursor-pointer"
                              title="Xóa ảnh chuyển khoản hoàn tiền"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-700/80 italic font-normal">
                            Chưa có ảnh chuyển khoản hoàn tiền được lưu. Vui lòng chọn tải ảnh bill chuyển khoản để lưu làm bằng chứng cho khách hàng.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Status Step Tracker */}
                {selectedOrderDetails.status !== 'CANCELLED' && (
                  <div className="bg-[#F9F8F6] p-3.5 rounded-xl border border-[#EFEAE2] space-y-2">
                    <p className="font-black text-[#8A8980] uppercase tracking-wider text-[10px]">Tiến trình đơn hàng (AhaMove 5 bước)</p>
                    <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-extrabold">
                      {(() => {
                        // Tính toán bước hiện tại của đơn hàng theo 5 bước AhaMove chuẩn mới (bỏ Đang xử lý)
                        let currentIdx = 0;
                        const shipStatusUpper = (selectedOrderDetails.shippingStatus || '').toUpperCase();
                        // Chỉ khi tài xế AhaMove chấp nhận đơn (ACCEPTED) hoặc đang di chuyển giao hàng mới chuyển sang bước "Đang giao"
                        const isDriverAccepted = [
                          'ACCEPTED',
                          'IN_PROCESS',
                          'IN PROCESS',
                          'DELIVERING',
                          'ON_TRIP',
                          'TRIP_START',
                        ].includes(shipStatusUpper);

                        if (selectedOrderDetails.status === 'DELIVERED') {
                          currentIdx = 4; // Giao hàng thành công
                        } else if (selectedOrderDetails.status === 'SHIPPED') {
                          if (isDriverAccepted) {
                            currentIdx = 3; // Đang giao (Tài xế đã nhận đơn & đang di chuyển)
                          } else {
                            currentIdx = 2; // Đã gửi VC (Đã tạo đơn AhaMove, đang tìm/gán tài xế)
                          }
                        } else if (selectedOrderDetails.status === 'CONFIRMED') {
                          currentIdx = 1; // Đã xác nhận
                        } else {
                          currentIdx = 0; // Chờ xác nhận
                        }

                        const steps = [
                          {
                            label:
                              selectedOrderDetails.payment?.method === 'QR' && selectedOrderDetails.payment?.status === 'PAID'
                                ? 'Đã thanh toán'
                                : 'Chờ xác nhận',
                            icon: '1',
                          },
                          { label: 'Đã xác nhận', icon: '2' },
                          { label: 'Đã gửi VC', icon: '3' },
                          { label: 'Đang giao', icon: '4' },
                          { label: 'Thành công', icon: '5' },
                        ];

                        return steps.map((step, idx) => {
                          const isDone = idx <= currentIdx;
                          const isCurrent = idx === currentIdx;
                          return (
                            <div
                              key={idx}
                              className={cn(
                                'flex flex-col items-center gap-1 p-1.5 rounded-lg border transition',
                                isDone ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' : 'bg-white border-gray-200 text-gray-400',
                                isCurrent && 'ring-2 ring-[#0F766E] shadow-sm',
                              )}
                            >
                              <span className={cn('size-4 rounded-full flex items-center justify-center text-[9px]', isDone ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600')}>
                                {isDone ? '✓' : step.icon}
                              </span>
                              <span className="line-clamp-1">{step.label}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {/* Order Status & Financial Summary */}
                <div className="flex justify-between items-center pt-2 border-t text-xs font-semibold">
                  <div>
                    <span className="text-[#8A8980] block text-[10px] font-black uppercase tracking-wider">Trạng thái</span>
                    <span className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-black uppercase mt-1.5',
                      selectedOrderDetails.status === 'DELIVERED' && 'bg-green-50 text-green-700',
                      selectedOrderDetails.status === 'PENDING' && 'bg-yellow-50 text-yellow-700',
                      selectedOrderDetails.status === 'CONFIRMED' && 'bg-blue-50 text-blue-700 border border-blue-200',
                      selectedOrderDetails.status === 'SHIPPED' && 'bg-purple-50 text-purple-700',
                      selectedOrderDetails.status === 'CANCELLED' && 'bg-red-50 text-red-700',
                    )}>
                      {ORDER_STATUS_MAP[selectedOrderDetails.status] || selectedOrderDetails.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#8A8980] block text-[10px] font-black uppercase tracking-wider">Tổng cộng</span>
                    <span className="text-lg font-black text-[var(--primary-color)] mt-1 block">
                      {currency.format(selectedOrderDetails.totalAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  {selectedOrderDetails.refundStatus === 'PENDING' || selectedOrderDetails.refundStatus === 'FAILED' ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={refundingId === selectedOrderDetails.id}
                        onClick={() => setConfirmRejectRefundOrder(selectedOrderDetails)}
                        className="rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-2 font-bold hover:bg-red-100 transition text-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        disabled={refundingId === selectedOrderDetails.id}
                        onClick={() => setConfirmApproveRefundOrder(selectedOrderDetails)}
                        className="rounded-xl bg-emerald-600 text-white px-4 py-2 font-bold hover:bg-emerald-700 transition text-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        {refundingId === selectedOrderDetails.id && <Loader2 className="size-3 animate-spin text-white" />}
                        Duyệt hoàn tiền
                      </button>
                    </div>
                  ) : (
                    <div />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedOrderDetails(null)}
                    className="rounded-xl border px-5 py-2 font-bold hover:bg-gray-50 transition text-xs cursor-pointer animate-scaleIn"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Modals for Refund Approval / Rejection */}
          <ConfirmDialog
            isOpen={!!confirmApproveRefundOrder}
            onClose={() => setConfirmApproveRefundOrder(null)}
            onConfirm={async () => {
              if (confirmApproveRefundOrder) {
                await handleApproveRefund(confirmApproveRefundOrder.id);
                setConfirmApproveRefundOrder(null);
              }
            }}
            title="Xác nhận duyệt hoàn tiền"
            message={`Bạn có chắc chắn muốn DUYỆT hoàn tiền cho đơn hàng #${confirmApproveRefundOrder?.id}? Đơn hàng sẽ được cập nhật trạng thái đã hoàn tiền và mở phần tải ảnh bill chuyển khoản.`}
            confirmText="Xác nhận duyệt"
            loading={refundingId === confirmApproveRefundOrder?.id}
          />

          <ConfirmDialog
            isOpen={!!confirmRejectRefundOrder}
            onClose={() => setConfirmRejectRefundOrder(null)}
            onConfirm={async () => {
              if (confirmRejectRefundOrder) {
                await handleRejectRefund(confirmRejectRefundOrder.id);
                setConfirmRejectRefundOrder(null);
              }
            }}
            title="Xác nhận từ chối hoàn tiền"
            message={`Bạn có chắc chắn muốn TỪ CHỐI yêu cầu hoàn tiền cho đơn hàng #${confirmRejectRefundOrder?.id}?`}
            confirmText="Xác nhận từ chối"
            isDanger={true}
            loading={refundingId === confirmRejectRefundOrder?.id}
          />




          {/* Excel Export Modal */}
          {isExportModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-left">
              <div className="w-full max-w-md rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-2xl animate-scaleIn">
                <div className="flex items-center justify-between border-b border-[#EFEAE2] pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="size-5 text-[var(--primary-color)]" />
                    <h3 className="text-lg font-black text-gray-800">Xuất đơn hàng sang Excel</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <form onSubmit={executeExportExcel} className="space-y-4 text-xs font-semibold">
                  <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 space-y-2">
                    <p className="text-xs font-semibold text-orange-800 leading-relaxed">
                      <strong>Tính năng:</strong> Trích xuất danh sách hóa đơn bán hàng theo thời gian được lựa chọn. Tự động tính toán chi phí và tổng thanh toán bán lẻ thực tế.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={exportAllTime}
                        onChange={(e) => setExportAllTime(e.target.checked)}
                        className="size-4 rounded border-gray-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)] accent-[var(--primary-color)] cursor-pointer"
                      />
                      <span className="text-xs text-gray-700 font-bold">
                        Xuất toàn bộ lịch sử đơn hàng (Không giới hạn ngày)
                      </span>
                    </label>
                  </div>

                  <div className={cn("grid grid-cols-2 gap-4 transition-all duration-300", exportAllTime && "opacity-50 pointer-events-none")}>
                    <div>
                      <label className="block text-[11px] text-gray-500 font-extrabold uppercase mb-1">Từ ngày</label>
                      <input
                        type="date"
                        disabled={exportAllTime}
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 font-extrabold uppercase mb-1">Đến ngày</label>
                      <input
                        type="date"
                        disabled={exportAllTime}
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={exportOnlyRefunded}
                        onChange={(e) => {
                          setExportOnlyRefunded(e.target.checked);
                        }}
                        className="size-4 rounded border-gray-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)] accent-[var(--primary-color)] cursor-pointer"
                      />
                      <span className="text-xs text-gray-700 font-bold">
                        Chỉ xuất các đơn hàng đã duyệt hoàn tiền
                      </span>
                    </label>
                    <p className="text-[10px] text-gray-400 font-medium pl-6 leading-relaxed">
                      (Xuất danh sách các hóa đơn có trạng thái hoàn tiền thành công, đi kèm đầy đủ số tài khoản và ngân hàng nhận).
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setIsExportModalOpen(false)}
                      className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={exportingOrders}
                      className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-xl font-bold text-xs hover:bg-[var(--primary-color)]/90 cursor-pointer flex items-center gap-1.5"
                    >
                      {exportingOrders ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Đang trích xuất...
                        </>
                      ) : (
                        'Tải file Excel'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal xem chi tiết hành trình AhaMove Hỏa Tốc */}
          <OrderTrackingModal
            isOpen={!!trackingAhamoveCode}
            code={trackingAhamoveCode}
            carrier="AHAMOVE"
            onClose={() => setTrackingAhamoveCode(null)}
          />
        </div>
      );


    case 'customers':
      return (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-xl font-black">Danh sách khách hàng</h2>
            <p className="text-sm font-semibold text-[var(--text-muted)]">Danh sách khách hàng thực tế đăng ký tài khoản trên hệ thống.</p>
          </div>

          {/* Filters & Statistics */}
          <div className="flex flex-col gap-4 rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#B0B0B0]" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, email hoặc số điện thoại khách hàng..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] py-2.5 pl-10 pr-10 text-sm focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-[#B0B0B0]" />
                <select
                  value={customerSortBy}
                  onChange={(e) => setCustomerSortBy(e.target.value)}
                  className="rounded-xl border border-[#EFEAE2] bg-white px-3 py-2.5 text-sm font-bold text-[var(--text-main)] focus:outline-none"
                >
                  <option value="none">Sắp xếp mặc định</option>
                  <option value="spent_desc">Chi tiêu: Cao nhất</option>
                  <option value="spent_asc">Chi tiêu: Thấp nhất</option>
                  <option value="orders_desc">Số đơn thành công: Nhiều nhất</option>
                  <option value="cancelled_desc">Số đơn đã hủy: Nhiều nhất</option>
                </select>
              </div>

              {/* Filter New Customer */}
              <div>
                <select
                  value={customerFilterNew}
                  onChange={(e) => setCustomerFilterNew(e.target.value)}
                  className="rounded-xl border border-[#EFEAE2] bg-white px-3 py-2.5 text-sm font-bold text-[var(--text-main)] focus:outline-none w-full"
                >
                  <option value="all">Tất cả khách hàng</option>
                  <option value="new">Chỉ khách hàng mới</option>
                </select>
              </div>
            </div>

            {/* Total count badge */}
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] border-t border-[#F4EFE6] pt-3">
              <span>
                Tìm thấy <strong className="text-[var(--primary-color)]">{filteredCustomers.length}</strong> khách hàng phù hợp
              </span>
              <span>
                Tổng số: <strong className="text-gray-700">{customers.length}</strong> khách hàng • Mới: <strong className="text-green-600">{customers.filter(c => c.isNewCustomer).length}</strong>
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-[#EFEAE2] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EFEAE2] bg-[#F9F8F6] text-xs font-black uppercase text-[#8A8980]">
                    <th className="px-6 py-4">Họ và tên</th>
                    <th className="px-6 py-4">Số điện thoại</th>
                    <th className="px-6 py-4 text-center">Số đơn đặt thành công</th>
                    <th className="px-6 py-4 text-center">Số đơn đã hủy</th>
                    <th className="px-6 py-4 text-right">Tổng chi tiêu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2]">
                  {paginatedCustomers.length > 0 ? (
                    paginatedCustomers.map((c) => (
                      <tr
                        key={c.id}
                        className="transition hover:bg-[#F9F8F6] cursor-pointer"
                        onClick={() => handleViewCustomerOrders(c)}
                        title="Click để xem chi tiết các đơn hàng"
                      >
                        <td className="px-6 py-4 font-bold text-[var(--text-main)]">
                          {c.name}
                          {c.isNewCustomer && (
                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 font-extrabold px-2 py-0.5 rounded-full ml-2">
                              (Mới)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-[#5C5B52]">{maskPhoneNumber(c.phone)}</td>
                        <td className="px-6 py-4 text-center font-bold text-[#0F766E]">{c.totalOrders} đơn</td>
                        <td className="px-6 py-4 text-center font-bold text-red-600">{c.totalCancelled} đơn</td>
                        <td className="px-6 py-4 text-right font-black text-[var(--primary-color)]">{currency.format(c.spent)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">Chưa có dữ liệu khách hàng nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customers Pagination Controls */}
          {filteredCustomers.length > 10 && (
            <div className="flex items-center justify-between border-t border-[#EFEAE2] bg-white px-4 py-3 sm:px-6 mt-4 rounded-2xl shadow-sm">
              <div className="hidden sm:block">
                <p className="text-xs text-gray-500 font-bold">
                  Hiển thị từ <span className="font-black text-[var(--primary-color)]">{(customersPage - 1) * 10 + 1}</span> tới{' '}
                  <span className="font-black text-[var(--primary-color)]">
                    {Math.min(customersPage * 10, filteredCustomers.length)}
                  </span>{' '}
                  trong tổng số <span className="font-black text-[var(--primary-color)]">{filteredCustomers.length}</span> khách hàng
                </p>
              </div>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (customersPage > 1) setCustomersPage(customersPage - 1);
                      }}
                      className={customersPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.ceil(filteredCustomers.length / 10) }).map((_, idx) => (
                    <PaginationItem key={idx}>
                      <PaginationLink
                        href="#"
                        isActive={customersPage === idx + 1}
                        onClick={(e) => {
                          e.preventDefault();
                          setCustomersPage(idx + 1);
                        }}
                        className="cursor-pointer"
                      >
                        {idx + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (customersPage < Math.ceil(filteredCustomers.length / 10)) setCustomersPage(customersPage + 1);
                      }}
                      className={customersPage === Math.ceil(filteredCustomers.length / 10) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {/* Customer Orders Right Sidebar */}
          {isCustomerOrdersSidebarOpen && selectedCustomer && (
            <div className="fixed inset-0 z-50 overflow-hidden">
              {/* Backdrop Overlay */}
              <div
                className={cn(
                  "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
                  isCustomerOrdersSidebarClosing ? "opacity-0" : "opacity-100"
                )}
                onClick={handleCloseCustomerOrdersSidebar}
              />

              {/* Sidebar Panel */}
              <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex sm:pl-16">
                <div
                  className={cn(
                    "w-screen max-w-2xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform relative",
                    isCustomerOrdersSidebarClosing ? "translate-x-full" : "translate-x-0 animate-in slide-in-from-right"
                  )}
                >
                  {/* Floating Collapse Pull-tab */}
                  <button
                    type="button"
                    onClick={handleCloseCustomerOrdersSidebar}
                    className="absolute top-1/2 -left-10 -translate-y-1/2 w-10 h-20 bg-white border border-r-0 border-[#EFEAE2] shadow-[-6px_0_15px_rgba(0,0,0,0.06)] rounded-l-2xl flex items-center justify-center text-gray-400 hover:text-[var(--primary-color)] hover:bg-gray-50 transition active:scale-95 cursor-pointer z-50 group"
                    title="Thu gọn Sidebar"
                  >
                    <ChevronsRight className="size-5 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Header */}
                  <div className="px-6 py-5 border-b border-[#EFEAE2] flex items-center justify-between bg-[#F9F8F6]">
                    <div className="flex items-center gap-3">
                      <div className="size-12 rounded-xl bg-[var(--primary-color)]/10 flex items-center justify-center border border-[var(--primary-color)]/20 text-[var(--primary-color)]">
                        <Users className="size-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-black text-[var(--text-main)]">
                            {selectedCustomer.name}
                          </h3>
                          {selectedCustomer.isNewCustomer && (
                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 font-extrabold px-2 py-0.5 rounded-full">
                              Khách hàng mới
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] font-semibold mt-0.5">
                          SĐT: {maskPhoneNumber(selectedCustomer.phone)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Stats Card */}
                    <div className="grid grid-cols-3 gap-4 rounded-2xl bg-[#FAF9F5] border border-[#EFEAE2] p-4 text-center">
                      <div>
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider block">Tổng chi tiêu</span>
                        <span className="text-base font-black text-[var(--primary-color)] mt-1 block">
                          {currency.format(selectedCustomer.spent)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider block">Đơn thành công</span>
                        <span className="text-base font-black text-[#0F766E] mt-1 block">
                          {selectedCustomer.totalOrders} đơn
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider block">Đơn đã hủy</span>
                        <span className="text-base font-black text-red-600 mt-1 block">
                          {selectedCustomer.totalCancelled} đơn
                        </span>
                      </div>
                    </div>

                    {/* Orders list */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-[#8A8980] uppercase tracking-wider">
                        Lịch sử đơn hàng ({selectedCustomer.orders?.length || 0})
                      </h4>

                      {selectedCustomer.orders && selectedCustomer.orders.length > 0 ? (
                        <div className="space-y-4">
                          {[...(selectedCustomer.orders || [])]
                            .sort((a: any, b: any) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0))
                            .map((order: any) => (
                            <div key={order.id} className="rounded-xl border border-[#EFEAE2] p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-center justify-between border-b border-[#F4EFE6] pb-2">
                                <div>
                                  <span className="text-xs font-black text-[var(--text-main)] block">
                                    Đơn hàng #{order.id.slice(0, 8).toUpperCase()}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-bold mt-0.5 block flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <div>
                                  <span className={cn(
                                    "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                    order.status === 'DELIVERED' ? "bg-green-50 text-green-700 border-green-100" :
                                      order.status === 'CANCELLED' ? "bg-red-50 text-red-700 border-red-100" :
                                        order.status === 'PROCESSING' ? "bg-blue-50 text-blue-700 border-blue-100" :
                                          order.status === 'SHIPPED' ? "bg-purple-50 text-purple-700 border-purple-100" :
                                            "bg-gray-50 text-gray-700 border-gray-100"
                                  )}>
                                    {order.status === 'DELIVERED' ? 'Hoàn thành' :
                                      order.status === 'CANCELLED' ? 'Đã hủy' :
                                        order.status === 'PROCESSING' ? 'Đang xử lý' :
                                          order.status === 'SHIPPED' ? 'Đang giao' :
                                            order.status === 'EXPIRED' ? 'Hết hạn' :
                                              order.status === 'PAYMENT_ERROR' ? 'Lỗi thanh toán' :
                                                order.status === 'PENDING' ? 'Chờ thanh toán' :
                                                  order.status}
                                  </span>
                                </div>
                              </div>

                              {/* Items */}
                              <div className="space-y-2">
                                {order.items.map((item: any) => (
                                  <div key={item.id} className="flex justify-between items-start text-xs font-semibold">
                                    <div className="text-[var(--text-main)] flex-1 pr-4 line-clamp-1">
                                      {item.productName} <span className="text-gray-400 ml-1">x {item.quantity}</span>
                                    </div>
                                    <div className="text-right font-black text-gray-700 shrink-0">
                                      {currency.format(item.price * item.quantity)}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="flex justify-between items-center pt-2 border-t border-[#F4EFE6] text-xs">
                                <span className="font-extrabold text-gray-400">Thành tiền</span>
                                <span className="font-black text-[var(--primary-color)]">
                                  {currency.format(order.totalAmount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex h-32 flex-col items-center justify-center gap-1 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                          <ShoppingBag className="size-6 text-gray-300" />
                          <span className="text-xs font-bold text-gray-400">Chưa có đơn hàng nào được đặt.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );

    case 'dashboard':
    default:
      return (
        <div className="space-y-8 animate-fadeIn">
          {/* Greeting Banner */}
          <section className="overflow-hidden rounded-2xl border border-[#EFEAE2] bg-[#1E1D19] text-white shadow-md relative">
            <div className="absolute right-0 top-0 size-24 bg-[var(--primary-color)] opacity-20 blur-2xl" />
            <div className="p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-wider text-[var(--primary-color)]">Hệ thống quản lý</p>
              <h2 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">
                Chào mừng trở lại, Quản lý Cửa hàng!
              </h2>
              <p className="mt-2 max-w-xl text-sm font-semibold text-[#A3A299]">
                Theo dõi hoạt động bán hàng, kiểm soát tồn kho sản phẩm thú cưng và tối ưu doanh số cửa hàng trong thời gian thực.
              </p>
            </div>
          </section>

          {/* Metrics & Biểu đồ phân bổ trạng thái đơn hàng */}
          <section className="grid gap-4 lg:grid-cols-12">
            {/* 3 Thẻ Chỉ số chính */}
            <div className="lg:col-span-7 grid gap-4 sm:grid-cols-3">
              {/* Thẻ Tổng doanh thu */}
              <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-[#8A8980]">Tổng doanh thu</span>
                    <span className="p-2 rounded-lg bg-[rgba(228,93,28,0.1)] text-[var(--primary-color)]">
                      <TrendingUp className="size-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-black text-gray-900">{currency.format(stats?.totalRevenue ?? 0)}</p>
                </div>
              </div>

              {/* Thẻ Đơn hàng (Bấm vào chuyển sang tab Quản lý đơn hàng: /manager?tab=orders) */}
              <div
                onClick={() => router.push('/manager?tab=orders')}
                className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md hover:border-[var(--primary-color)]/60 transition cursor-pointer group flex flex-col justify-between"
                title="Bấm để chuyển sang Quản lý đơn hàng"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-[#8A8980] group-hover:text-[var(--primary-color)] transition-colors">
                      Đơn hàng
                    </span>
                    <span className="p-2 rounded-lg bg-teal-50 text-teal-600 group-hover:bg-[var(--primary-color)] group-hover:text-white transition-colors">
                      <Package className="size-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-black text-gray-900">{stats?.totalOrders ?? 0} đơn</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#8A8980]">
                    {stats?.pendingOrders ?? 0} đơn chờ xử lý
                  </span>
                  <span className="text-xs font-black text-[var(--primary-color)] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Xem &rarr;
                  </span>
                </div>
              </div>

              {/* Thẻ Sản phẩm đã bán */}
              <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-[#8A8980]">Sản phẩm đã bán</span>
                    <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                      <ShoppingBag className="size-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-black text-gray-900">{stats?.totalProductsSold ?? 0} món</p>
                </div>
              </div>
            </div>

            {/* Thẻ Phân bổ 5 trạng thái đơn hàng dạng biểu đồ tròn Donut SVG */}
            <div className="lg:col-span-5 rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PieChart className="size-4 text-[var(--primary-color)]" />
                  <h3 className="text-xs font-black uppercase text-[#8A8980] tracking-wider">Trạng thái đơn hàng</h3>
                </div>
              </div>
              <OrderStatusDonutChart
                distribution={stats?.statusDistribution}
                totalOrders={stats?.totalOrders ?? 0}
              />
            </div>
          </section>

          {/* Dashboard Lists */}
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Product Status Alert: Hiển thị sản phẩm có biến thể hoặc số lượng tồn kho < 5 tương tự như trong quản lý sản phẩm */}
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black">Sản phẩm sắp hết hàng & cần bổ sung</h3>
              </div>
              <div className="mt-4 divide-y divide-[#EFEAE2]">
                {(() => {
                  // Lọc các sản phẩm có phân loại tồn kho < 5 hoặc cha tồn kho < 5 (đồng bộ hoàn toàn với Quản lý sản phẩm)
                  const lowStockProducts = stats?.lowStockProducts ?? [];
                  if (lowStockProducts.length === 0) {
                    return <p className="text-xs text-gray-400 py-4">Kho hàng dồi dào, không có sản phẩm nào sắp hết hàng.</p>;
                  }

                  return lowStockProducts.slice(0, 6).map((p) => {
                    const hasVars = p.variants && p.variants.length > 0;
                    const lowVars = hasVars ? p.variants!.filter((v: any) => (v.stock ?? 0) < 5) : [];
                    const minStock = hasVars
                      ? Math.min(...p.variants!.map((v: any) => v.stock ?? 0))
                      : (p.stock ?? 0);

                    return (
                      <div
                        key={p.id}
                        onClick={() => router.push('/manager?tab=products')}
                        className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-orange-50/30 p-1 rounded-xl transition cursor-pointer group"
                        title="Bấm để chuyển sang Quản lý sản phẩm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="size-9 rounded-lg object-cover border border-gray-200 shrink-0"
                            />
                          ) : (
                            <div className="size-9 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-primary shrink-0">
                              <Package className="size-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[var(--text-main)] group-hover:text-primary transition-colors truncate">
                              {p.name}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap text-xs text-[#8A8980]">
                              <span>{dynamicCategoryMap[p.category] || CATEGORY_MAP[p.category] || p.category}</span>
                              {hasVars && lowVars.length > 0 && (
                                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  {lowVars.length === 1 ? `Phân loại: ${lowVars[0].name}` : `${lowVars.length} phân loại < 5`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-black',
                              minStock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
                            )}
                          >
                            {minStock === 0 ? 'Hết hàng (0)' : `Tồn: ${minStock}`}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Best Sellers */}
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm">
              <h3 className="text-base font-black">Sản phẩm bán chạy nhất</h3>
              <div className="mt-4 divide-y divide-[#EFEAE2]">
                {(stats?.topSellingProducts?.length ?? 0) > 0 ? (
                  stats!.topSellingProducts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-main)]">{p.name}</p>
                        <p className="text-xs font-semibold text-[#8A8980]">Danh mục: {dynamicCategoryMap[p.category] || CATEGORY_MAP[p.category] || p.category}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-black">
                          Đã bán: {p.sales ?? 0}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 py-4">Chưa có dữ liệu bán hàng.</p>
                )}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm">
              <h3 className="text-base font-black">Đơn đặt hàng gần đây nhất</h3>
              <div className="mt-4 divide-y divide-[#EFEAE2]">
                {(stats?.recentOrders?.length ?? 0) > 0 ? (
                  stats!.recentOrders.map((o) => {
                    const itemsStr = o.items.map((i) => `${i.quantity}x ${i.product.name}`).join(', ');
                    return (
                      <div key={o.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="max-w-[70%]">
                          <p className="text-sm font-bold text-[var(--text-main)]">{o.userName}</p>
                          <p className="text-xs font-semibold text-[#8A8980] truncate" title={itemsStr}>
                            {itemsStr}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[var(--primary-color)]">{currency.format(o.totalAmount)}</p>
                          <p className="text-[10px] font-semibold text-[#8A8980]">
                            {new Date(o.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-400 py-4">Chưa có đơn đặt hàng nào phát sinh trên hệ thống.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      );
  }
}
