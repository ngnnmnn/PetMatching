'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Package,
  CheckCircle,
  Truck,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
  Edit2,
  QrCode,
  RefreshCw,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AppHeader from '@/components/layout/AppHeader';
import { usersApi } from '@/lib/api/users';
import AddressFormModal from '@/components/checkout/AddressFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PayOSQRModal, { PayOSQRData } from '@/components/checkout/PayOSQRModal';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    imageUrl?: string | null;
  };
  variantId?: string | null;
  variant?: {
    id: string;
    name: string;
  } | null;
}

interface Order {
  id: string;
  status: 'PENDING' | 'PACKED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED' | 'PAYMENT_ERROR';
  totalAmount: number;
  shippingFee?: number;
  shippingAddress: string;
  payment?: {
    method: 'COD' | 'QR';
    status: 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'PAYMENT_ERROR' | 'REFUNDED';
    orderCode?: number | null;
    paymentUrl?: string | null;
  } | null;
  shippingStatus?: string | null;
  deliveryProofUrl?: string | null;
  shippingNote?: string | null;
  refundStatus?: string | null;
  refundBankCode?: string | null;
  refundAccountNumber?: string | null;
  refundAccountName?: string | null;
  refundReason?: string | null;
  refundedAt?: string | null;
  refundProofUrl?: string | null;
  createdAt: string;
  items: OrderItem[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

// Parses stored address string back to fields with fallback support
function parseAddressString(addrStr: string) {
  let name = '';
  let phone = '';
  let address = addrStr;
  let note = '';

  // Get fallback values from localstorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        name = parsed.name || '';
        phone = parsed.phone || '';
      } catch (e) { }
    }
  }

  // Extract notes if present
  const noteMatch = addrStr.match(/\(Ghi chú:\s*(.*?)\)/i);
  if (noteMatch) {
    note = noteMatch[1];
    address = addrStr.replace(/\(Ghi chú:\s*(.*?)\)/i, '').trim();
  }

  // Try to match format: "Tên: ... | SĐT: ... | Địa chỉ: ..."
  const formatMatch = address.match(/Tên:\s*(.*?)\s*\|\s*SĐT:\s*(.*?)\s*\|\s*Địa chỉ:\s*(.*)/i);
  if (formatMatch) {
    name = formatMatch[1];
    phone = formatMatch[2];
    address = formatMatch[3];
  }

  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 4) {
    const province = parts[parts.length - 1];
    const district = parts[parts.length - 2];
    const ward = parts[parts.length - 3];
    const detail = parts.slice(0, parts.length - 3).join(', ');
    return {
      receiverName: name,
      receiverPhone: phone,
      province,
      district,
      ward,
      detail,
      note
    };
  }

  return {
    receiverName: name,
    receiverPhone: phone,
    province: '',
    district: '',
    ward: '',
    detail: address,
    note
  };
}

// Formats shippingAddress db string into a beautiful line
function formatAddressForDisplay(addrStr: string) {
  const parsed = parseAddressString(addrStr);
  if (parsed.receiverName || parsed.receiverPhone) {
    const contact = [parsed.receiverName, parsed.receiverPhone].filter(Boolean).join(' - ');
    const addressParts = [parsed.detail, parsed.ward, parsed.district, parsed.province]
      .map((p) => p?.trim())
      .filter(Boolean);
    let base = contact;
    if (addressParts.length > 0) {
      base += ` | ${addressParts.join(', ')}`;
    }
    if (parsed.note) {
      base += ` (Ghi chú: ${parsed.note})`;
    }
    return base;
  }
  return addrStr;
}

const removeAccentsAndUpperCase = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
};

const ORDER_STATUS_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'PENDING', label: 'Chờ xác nhận', statuses: ['PENDING'] },
  { id: 'PROCESSING', label: 'Đang xử lý / Đã thanh toán', statuses: ['PROCESSING'] },
  { id: 'PACKED', label: 'Đã đóng gói', statuses: ['PACKED'] },
  { id: 'SHIPPED', label: 'Đang giao', statuses: ['SHIPPED'] },
  { id: 'DELIVERED', label: 'Đã giao thành công', statuses: ['DELIVERED'] },
  { id: 'CANCELLED', label: 'Đã hủy / Thất bại', statuses: ['CANCELLED', 'EXPIRED', 'PAYMENT_ERROR'] },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'ALL') return true;
    const tabObj = ORDER_STATUS_TABS.find((t) => t.id === activeTab);
    return tabObj?.statuses ? tabObj.statuses.includes(order.status) : true;
  });

  // Modal & Actions State
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);

  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [tempAddressData, setTempAddressData] = useState<any>(null);

  const [showAddressConfirmModal, setShowAddressConfirmModal] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);

  // PayOS QR Modal State
  const [payOSQRData, setPayOSQRData] = useState<PayOSQRData | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [retryLoadingId, setRetryLoadingId] = useState<string | null>(null);

  // PayOS Payout States
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [refundBankCode, setRefundBankCode] = useState('');
  const [refundAccountNumber, setRefundAccountNumber] = useState('');
  const [isLookingUpAccount, setIsLookingUpAccount] = useState(false);
  const [refundAccountName, setRefundAccountName] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [banks, setBanks] = useState<{ bin: string; name: string; shortName: string; logo: string }[]>([]);

  // Delivery Proof Inline Toggle State
  const [showProofOrderId, setShowProofOrderId] = useState<string | null>(null);
  const [showRefundProofOrderId, setShowRefundProofOrderId] = useState<string | null>(null);

  const handleRetryPayment = async (order: Order) => {
    setRetryLoadingId(order.id);
    try {
      const res = await usersApi.retryPayment(order.id);
      const data = res.data;
      if (data.qrData || data.checkoutUrl) {
        setPayOSQRData(
          data.qrData
            ? { ...data.qrData, orderId: data.id }
            : {
              orderId: data.id,
              orderCode: data.orderCode,
              accountNumber: '970422',
              accountName: 'PETMATCHING',
              bin: '970422',
              amount: Number(data.totalAmount),
              description: `PM${data.orderCode}`,
              checkoutUrl: data.checkoutUrl,
            },
        );
        setIsQRModalOpen(true);
      } else {
        toast.error('Không thể tạo mã QR thanh toán vào lúc này. Vui lòng thử lại sau.');
      }
    } catch (err: any) {
      console.error('Failed to retry payment', err);
      const errMsg = err.response?.data?.message || 'Lỗi khi kết nối đến cổng thanh toán PayOS.';
      toast.error(errMsg);
    } finally {
      setRetryLoadingId(null);
    }
  };

  const handleCancelQROrder = async (orderId: string) => {
    try {
      await usersApi.deleteOrder(orderId);
      loadOrders();
      toast.info('Đã hủy thanh toán.');
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
  };

  const handleQRSuccess = (orderId: string) => {
    setIsQRModalOpen(false);
    setPayOSQRData(null);
    loadOrders();
  };

  const loadOrders = async () => {
    try {
      const res = await usersApi.getOrders();
      setOrders(res.data || []);
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (refundOrderId && banks.length === 0) {
      fetch('https://api.vietqr.io/v2/banks')
        .then((res) => res.json())
        .then((data) => {
          if (data.code === '00') {
            setBanks(data.data || []);
          }
        })
        .catch((err) => console.error('Failed to fetch banks', err));
    }
  }, [refundOrderId, banks.length]);

  const handleOpenRefundModal = (order: Order) => {
    setRefundOrderId(order.id);
    setRefundBankCode(order.refundBankCode || '');
    setRefundAccountNumber(order.refundAccountNumber || '');
    setRefundAccountName(order.refundAccountName || '');
    setRefundReason(order.refundReason || '');
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrderId || !refundBankCode || !refundAccountNumber || !refundAccountName) {
      toast.error('Vui lòng điền đầy đủ thông tin tài khoản nhận.');
      return;
    }

    setSubmittingRefund(true);
    try {
      await usersApi.requestRefund(refundOrderId, {
        bankCode: refundBankCode,
        accountNumber: refundAccountNumber,
        accountName: refundAccountName,
        reason: refundReason,
      });
      toast.success('Gửi yêu cầu hoàn tiền thành công! Admin sẽ duyệt yêu cầu của bạn.');
      setRefundOrderId(null);
      setRefundBankCode('');
      setRefundAccountNumber('');
      setRefundAccountName('');
      setRefundReason('');
      await loadOrders();
    } catch (err: any) {
      console.error('Failed to submit refund request', err);
      toast.error(err.response?.data?.message || 'Lỗi gửi yêu cầu hoàn tiền.');
    } finally {
      setSubmittingRefund(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadOrders();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      if (status === 'success') {
        toast.success('Thanh toán đơn hàng thành công!');
        window.history.replaceState({}, '', '/orders');
      } else if (status === 'cancel') {
        toast.error('Thanh toán đã bị hủy.');
        window.history.replaceState({}, '', '/orders');
      }
    }
  }, []);

  if (!isMounted) {
    return (
      <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
        <AppHeader sectionLabel="Đơn hàng" />
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-[var(--primary-color)] border-t-transparent" />
          <p className="text-sm font-semibold text-[var(--text-muted)]">Đang tải đơn hàng...</p>
        </div>
      </main>
    );
  }

  const handleCancelOrderConfirm = async () => {
    if (!cancelOrderId) return;
    setCancelling(true);

    try {
      const targetOrder = orders.find((o) => o.id === cancelOrderId);
      if (targetOrder?.payment?.method === 'QR' && targetOrder.payment.status === 'PENDING') {
        await usersApi.deleteOrder(cancelOrderId);
        toast.success('Đơn hàng QR chưa hoàn tất đã được xóa khỏi hệ thống.');
      } else {
        await usersApi.cancelOrder(cancelOrderId);
        toast.success('Đơn hàng đã được hủy thành công.');
      }
      setCancelOrderId(null);
      await loadOrders();
    } catch (err: any) {
      console.error('Failed to cancel order', err);
      toast.error(err.response?.data?.message || 'Lỗi khi hủy đơn hàng.');
    } finally {
      setCancelling(false);
    }
  };

  const handleAddressEditClick = async (order: Order) => {
    setEditOrder(order);
    try {
      const res = await usersApi.getAddresses();
      setSavedAddresses(res.data || []);
    } catch (e) {
      console.error('Failed to load saved addresses', e);
      setSavedAddresses([]);
    }
    setIsAddressModalOpen(true);
  };

  const handleReviewOrderClick = (order: Order) => {
    const validItems = order.items.filter(item => item.product);
    if (validItems.length === 0) {
      toast.error('Không tìm thấy sản phẩm trong đơn hàng này.');
      return;
    }

    if (validItems.length === 1) {
      router.push(`/product/${validItems[0].product!.id}?review=true`);
    } else {
      setReviewOrder(order);
    }
  };

  const handleAddressFormSubmit = async (data: any) => {
    if (!editOrder) return;
    setIsAddressModalOpen(false);

    let addressStr = `Tên: ${data.receiverName} | SĐT: ${data.receiverPhone} | Địa chỉ: ${data.detail}, ${data.wardName}, ${data.districtName}, ${data.provinceName}`;

    const parsedOld = parseAddressString(editOrder.shippingAddress);
    if (parsedOld.note) {
      addressStr += ` (Ghi chú: ${parsedOld.note})`;
    }

    setUpdatingAddress(true);
    try {
      await usersApi.updateOrderShipping(editOrder.id, {
        shippingAddress: addressStr,
        districtId: data.districtId,
        wardCode: data.wardCode,
      });
      toast.success('Đã cập nhật địa chỉ giao hàng và tính lại phí ship mới thành công!');
      setEditOrder(null);
      await loadOrders();
    } catch (err: any) {
      console.error('Failed to update address', err);
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật địa chỉ giao hàng.');
    } finally {
      setUpdatingAddress(false);
    }
  };

  const handleUpdateAddressConfirm = async () => {
    if (!editOrder || !tempAddressData) return;
    setUpdatingAddress(true);

    try {
      await usersApi.updateOrderShipping(editOrder.id, tempAddressData.addressStr);
      toast.success('Đã cập nhật địa chỉ giao hàng thành công.');
      setShowAddressConfirmModal(false);
      setEditOrder(null);
      setTempAddressData(null);
      await loadOrders();
    } catch (err: any) {
      console.error('Failed to update address', err);
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật địa chỉ giao hàng.');
    } finally {
      setUpdatingAddress(false);
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1 text-xs font-extrabold text-green-700">
            <CheckCircle className="size-3.5" />
            Đã nhận hàng
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2.5 py-1 text-xs font-extrabold text-teal-700 border border-teal-200">
            <Clock className="size-3.5" />
            Đang xử lý
          </span>
        );
      case 'PACKED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700">
            <Package className="size-3.5" />
            Đã gói hàng
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700">
            <Truck className="size-3.5" />
            Đã gửi bên vận chuyển
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-700">
            <XCircle className="size-3.5" />
            Đã hủy đơn
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2.5 py-1 text-xs font-extrabold text-gray-600 border border-gray-200">
            <Clock className="size-3.5" />
            Hết hạn thanh toán
          </span>
        );
      case 'PAYMENT_ERROR':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-600 border border-red-200">
            <AlertTriangle className="size-3.5" />
            Lỗi thanh toán
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700">
            <Clock className="size-3.5" />
            Chờ xác nhận
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (order: Order) => {
    if (order.status === 'CANCELLED' && !order.refundStatus) {
      return null;
    }
    if (order.refundStatus) {
      if (order.refundStatus === 'PENDING') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
            Đang chờ hoàn tiền
          </span>
        );
      } else if (order.refundStatus === 'REFUNDED') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1 text-xs font-extrabold text-green-700 border border-green-200">
            Đã duyệt hoàn tiền
          </span>
        );
      } else if (order.refundStatus === 'FAILED') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-600 border border-red-200">
            Từ chối hoàn tiền
          </span>
        );
      }
    }

    if (order.payment?.method === 'QR') {
      if (order.payment.status === 'PENDING') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
            Chờ thanh toán QR
          </span>
        );
      } else if (order.payment.status === 'CANCELLED') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-700 border border-red-200">
            Đã hủy
          </span>
        );
      } else if (order.payment.status === 'EXPIRED') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2.5 py-1 text-xs font-extrabold text-gray-500 border border-gray-200">
            Hết hạn QR
          </span>
        );
      } else if (order.payment.status === 'PAYMENT_ERROR') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-600 border border-red-200">
            Lỗi thanh toán QR
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
            Đã thanh toán (PayOS)
          </span>
        );
      }
    } else {
      // COD method
      if (order.payment?.status === 'PAID') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
            Đã thanh toán (COD)
          </span>
        );
      } else if (order.status === 'CANCELLED') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-700 border border-red-200">
            Đã hủy
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2.5 py-1 text-xs font-extrabold text-slate-600 border border-slate-200">
            Thanh toán khi nhận hàng (COD)
          </span>
        );
      }
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-16">
      <AppHeader sectionLabel="Đơn hàng" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Back Link */}
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-muted)] hover:text-primary transition mb-6"
        >
          <ArrowLeft className="size-4" />
          Quay lại cửa hàng
        </Link>

        <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] sm:text-3xl mb-6">
          Lịch sử đặt hàng
        </h1>

        {/* Horizontal Status Filter Tab Bar */}
        {!loading && orders.length > 0 && (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-3 mb-6 scrollbar-none border-b border-gray-100">
            {ORDER_STATUS_TABS.map((tab) => {
              const count = orders.filter((order) => {
                if (tab.id === 'ALL') return true;
                return tab.statuses?.includes(order.status);
              }).length;

              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all duration-200 cursor-pointer shadow-2xs",
                    isActive
                      ? "bg-orange-500 text-white shadow-orange-500/20 shadow-md"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-black",
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="size-8 animate-spin text-[var(--primary-color)]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Package className="size-10" />
            </div>
            <h3 className="mb-2 text-xl font-black text-[var(--text-main)]">Bạn chưa có đơn hàng nào</h3>
            <p className="mx-auto mb-8 max-w-md text-sm text-[var(--text-muted)] leading-relaxed">
              Hãy tiếp tục khám phá cửa hàng của chúng tôi để mua sắm những sản phẩm tuyệt vời nhất dành cho thú cưng yêu quý của bạn nhé!
            </p>
            <Link
              href="/home"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#cf5017]"
            >
              Ghé thăm cửa hàng
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <Package className="size-8" />
            </div>
            <h3 className="mb-2 text-lg font-black text-[var(--text-main)]">Không có đơn hàng nào ở trạng thái này</h3>
            <p className="mx-auto mb-6 max-w-md text-xs text-[var(--text-muted)] font-medium">
              Bạn không có đơn hàng nào khớp với bộ lọc đã chọn. Hãy chuyển về danh sách tất cả để xem chi tiết.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-xs font-black text-white shadow-sm transition hover:bg-orange-600 cursor-pointer"
            >
              Xem tất cả đơn hàng ({orders.length})
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-[var(--border-color)] bg-white overflow-hidden shadow-sm hover:shadow-md transition duration-200"
              >
                {/* Order Card Header */}
                <div className="bg-[#FAF9F5] px-6 py-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-[var(--text-main)] uppercase tracking-wide">Mã: {order.id}</span>
                      <span className="text-[var(--text-muted)] hidden sm:inline">•</span>
                      <div className="flex items-center gap-1 text-[var(--text-muted)] font-semibold">
                        <Calendar className="size-3.5" />
                        {formatDate(order.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(order.status)}
                    {getPaymentStatusBadge(order)}

                    {/* Action buttons for PENDING / PAYMENT_ERROR / EXPIRED orders */}
                    {(order.status === 'PENDING' || order.status === 'PAYMENT_ERROR' || order.status === 'EXPIRED') && (
                      <div className="flex flex-wrap items-center gap-2">
                        {order.payment?.method === 'QR' && (
                          <>
                            {(order.status === 'PAYMENT_ERROR' || order.status === 'EXPIRED') ? (
                              <button
                                type="button"
                                disabled={retryLoadingId === order.id}
                                onClick={() => handleRetryPayment(order)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#0F766E] bg-[#0F766E] text-white px-2.5 py-1 text-xs font-bold hover:bg-[#115E59] transition shadow-sm cursor-pointer disabled:opacity-50"
                              >
                                {retryLoadingId === order.id ? (
                                  <Loader2 className="size-3 animate-spin text-white" />
                                ) : (
                                  <QrCode className="size-3 text-white" />
                                )}
                                Thanh toán lại
                              </button>
                            ) : (
                              // PENDING state
                              order.payment.paymentUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Mở lại modal QR bằng data order đã lưu
                                    setPayOSQRData({
                                      orderId: order.id,
                                      orderCode: order.payment?.orderCode || 0,
                                      accountNumber: '970422',
                                      accountName: 'PETMATCHING',
                                      bin: '970422',
                                      amount: Number(order.totalAmount),
                                      description: `PM${order.payment?.orderCode || ''}`,
                                      checkoutUrl: order.payment?.paymentUrl || undefined,
                                    });
                                    setIsQRModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#0F766E] bg-[#0F766E] text-white px-2.5 py-1 text-xs font-bold hover:bg-[#115E59] transition shadow-sm cursor-pointer"
                                >
                                  <QrCode className="size-3 text-white" />
                                  Thanh toán ngay
                                </button>
                              ) : (
                                // QR payment but somehow failed to generate url initially, allow retry
                                <button
                                  type="button"
                                  disabled={retryLoadingId === order.id}
                                  onClick={() => handleRetryPayment(order)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#0F766E] bg-[#0F766E] text-white px-2.5 py-1 text-xs font-bold hover:bg-[#115E59] transition shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                  {retryLoadingId === order.id ? (
                                    <Loader2 className="size-3 animate-spin text-white" />
                                  ) : (
                                    <QrCode className="size-3 text-white" />
                                  )}
                                  Tạo mã thanh toán
                                </button>
                              )
                            )}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAddressEditClick(order)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-white px-2.5 py-1 text-xs font-bold hover:text-primary transition shadow-sm hover:bg-gray-50 cursor-pointer"
                        >
                          <Edit2 className="size-3" />
                          Sửa địa chỉ
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelOrderId(order.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 text-red-600 px-2.5 py-1 text-xs font-bold hover:bg-red-100 transition shadow-sm cursor-pointer"
                        >
                          <XCircle className="size-3" />
                          Hủy đơn
                        </button>
                      </div>
                    )}

                    {(order.status === 'PROCESSING' || order.status === 'CANCELLED') && order.refundStatus !== 'REFUNDED' && (
                      <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRefundOrderId(order.id);
                            setRefundBankCode(order.refundBankCode || '');
                            setRefundAccountNumber(order.refundAccountNumber || '');
                            setRefundAccountName(order.refundAccountName || '');
                            setRefundReason(order.refundReason || '');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-2.5 py-1 text-xs font-bold hover:bg-amber-100 transition shadow-sm cursor-pointer"
                        >
                          <RefreshCw className="size-3" />
                          {order.refundStatus === 'FAILED'
                            ? 'Gửi lại yêu cầu hoàn tiền'
                            : order.refundStatus === 'PENDING'
                            ? 'Sửa thông tin hoàn tiền'
                            : 'Yêu cầu hoàn tiền'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="divide-y divide-[var(--border-color)] px-6">
                  {order.items.map((item) => (
                    <div key={item.id} className="py-4 flex gap-4 items-center">
                      <div className="aspect-square size-14 rounded-lg overflow-hidden bg-[#FAF9F5] border border-[var(--border-color)] shrink-0">
                        <img
                          src={item.product?.imageUrl || '/placeholder.svg'}
                          alt={item.product?.name || 'Sản phẩm'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-[var(--text-main)] line-clamp-1">
                          {item.product?.name || 'Sản phẩm'}
                        </h4>
                        {item.variant && (
                          <p className="text-[10px] text-[#0F766E] font-extrabold mt-0.5 bg-[#EEF8F5] px-1.5 py-0.5 rounded inline-block w-fit">
                            Phân loại: {item.variant.name}
                          </p>
                        )}
                        <p className="text-xs text-[var(--text-muted)] font-semibold mt-1">
                          Giá mua: {formatCurrency(item.price)}
                        </p>
                      </div>
                      <div className="text-right text-xs font-semibold">
                        <p className="text-[var(--text-muted)] font-bold">SL: {item.quantity}</p>
                        <p className="text-sm font-black text-[var(--text-main)] mt-1">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Footer Info */}
                <div className="bg-[#FAF9F5]/40 px-6 py-4 border-t border-[var(--border-color)] space-y-3 text-xs">
                  {/* Status Step Tracker */}
                  {order.status !== 'CANCELLED' && order.status !== 'EXPIRED' && order.status !== 'PAYMENT_ERROR' && (
                    <div className="bg-white p-3 rounded-xl border border-[var(--border-color)] space-y-1.5">
                      <p className="font-extrabold text-[var(--text-muted)] uppercase tracking-wider text-[9px]">Tiến trình vận chuyển</p>
                      <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-black">
                        {(() => {
                          const statusOrder = ['PENDING', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'];
                          let currentIdx = statusOrder.indexOf(order.status);

                          const steps = [
                            { label: 'Chờ xác nhận', icon: '1' },
                            { label: 'Đang xử lý', icon: '2' },
                            { label: 'Đã gói hàng', icon: '3' },
                            { label: 'Đang giao', icon: '4' },
                            { label: 'Đã nhận', icon: '5' },
                          ];

                          return steps.map((step, idx) => {
                            const isDone = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  'flex flex-col items-center gap-1 p-1.5 rounded-lg border transition',
                                  isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-gray-50 border-gray-100 text-gray-400',
                                  isCurrent && 'ring-1 ring-[#0F766E]',
                                )}
                              >
                                <span className={cn('size-3.5 rounded-full flex items-center justify-center text-[8px]', isDone ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-600')}>
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

                  {order.shippingNote && (
                    <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 text-xs">
                      <span className="font-black text-blue-800 uppercase tracking-wider text-[9px] block">Ghi chú giao hàng:</span>
                      <p className="text-xs font-bold text-blue-900 mt-0.5">{order.shippingNote}</p>
                    </div>
                  )}

                  {order.status === 'DELIVERED' && order.deliveryProofUrl && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowProofOrderId((prev) => (prev === order.id ? null : order.id))}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold text-xs transition cursor-pointer shadow-2xs"
                      >
                        <CheckCircle className="size-4 text-emerald-600" />
                        <span>{showProofOrderId === order.id ? 'Ẩn ảnh' : 'Xem ảnh giao hàng'}</span>
                        <Eye className="size-3.5 text-emerald-600 ml-0.5" />
                      </button>

                      {showProofOrderId === order.id && (
                        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-xs space-y-1.5 animate-fadeIn">
                          <span className="font-black text-emerald-800 uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <CheckCircle className="size-3.5 text-emerald-600" />
                            Ảnh bằng chứng giao hàng từ Shop (Shipper chụp)
                          </span>
                          <a href={order.deliveryProofUrl} target="_blank" rel="noreferrer" className="block mt-1">
                            <img
                              src={order.deliveryProofUrl}
                              alt="Ảnh xác nhận giao hàng"
                              className="w-full max-h-56 object-cover rounded-lg border border-emerald-300 hover:opacity-95 transition cursor-pointer shadow-xs"
                            />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {order.refundProofUrl && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowRefundProofOrderId((prev) => (prev === order.id ? null : order.id))}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-extrabold text-xs transition cursor-pointer shadow-2xs"
                      >
                        <RefreshCw className="size-4 text-amber-700" />
                        <span>{showRefundProofOrderId === order.id ? 'Ẩn ảnh' : 'Xem ảnh chuyển khoản hoàn tiền'}</span>
                        <Eye className="size-3.5 text-amber-700 ml-0.5" />
                      </button>

                      {showRefundProofOrderId === order.id && (
                        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-xs space-y-1.5 animate-fadeIn">
                          <span className="font-black text-amber-800 uppercase tracking-wider text-[10px] flex items-center gap-1">
                            <CheckCircle className="size-3.5 text-amber-600" />
                            Ảnh chuyển khoản hoàn tiền từ Shop (Bill chuyển khoản)
                          </span>
                          <a href={order.refundProofUrl} target="_blank" rel="noreferrer" className="block mt-1">
                            <img
                              src={order.refundProofUrl}
                              alt="Ảnh xác nhận hoàn tiền"
                              className="w-full max-h-56 object-cover rounded-lg border border-amber-300 hover:opacity-95 transition cursor-pointer shadow-xs"
                            />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-1">
                    <div className="flex items-start gap-2 max-w-lg font-semibold">
                      <MapPin className="size-4 text-[#0F766E] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[var(--text-muted)]">Địa chỉ giao hàng:</span>
                        <p className="text-[var(--text-main)] mt-0.5 leading-relaxed">
                          {formatAddressForDisplay(order.shippingAddress)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-black flex items-center gap-4">
                      <div>
                        <span className="text-xs text-[var(--text-muted)] font-bold block sm:inline mr-1">Tổng cộng:</span>
                        <span className="text-lg text-[var(--primary-color)]">{formatCurrency(order.totalAmount)}</span>
                      </div>
                      {order.status === 'DELIVERED' && (
                        <button
                          type="button"
                          onClick={() => handleReviewOrderClick(order)}
                          className="rounded-xl bg-[var(--primary-color)] px-4 py-2 font-black text-white hover:bg-[#cf5017] transition shadow-sm cursor-pointer text-xs"
                        >
                          Viết đánh giá
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Address Form Popup for Pending Orders */}
      {editOrder && (
        <AddressFormModal
          isOpen={isAddressModalOpen}
          onClose={() => {
            setIsAddressModalOpen(false);
            setEditOrder(null);
          }}
          savedAddresses={savedAddresses}
          itemsSubtotal={editOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0)}
          onSubmit={handleAddressFormSubmit}
          showSaveOptions={false}
          showShippingFee={true}
          submitButtonText="Xác nhận đổi địa chỉ"
          title={`Sửa địa chỉ giao hàng - Đơn hàng #${editOrder.id}`}
          initialData={parseAddressString(editOrder.shippingAddress)}
        />
      )}

      {/* Shared Confirmation Modal for Address Update */}
      {showAddressConfirmModal && tempAddressData && (
        <ConfirmDialog
          isOpen={showAddressConfirmModal}
          onClose={() => setShowAddressConfirmModal(false)}
          onConfirm={handleUpdateAddressConfirm}
          title="Xác nhận thay đổi địa chỉ"
          message="Bạn có chắc chắn muốn thay đổi thông tin nhận hàng của đơn hàng này sang địa chỉ mới không?"
          confirmText="Xác nhận đổi"
          loading={updatingAddress}
        />
      )}

      {/* Shared Confirmation Modal for Order Cancellation */}
      <ConfirmDialog
        isOpen={!!cancelOrderId}
        onClose={() => setCancelOrderId(null)}
        onConfirm={handleCancelOrderConfirm}
        title="Hủy đơn hàng"
        message={`Bạn có chắc chắn muốn hủy đơn hàng #${cancelOrderId} không? Hành động này không thể hoàn tác.`}
        confirmText="Xác nhận hủy"
        isDanger={true}
        loading={cancelling}
      />

      {/* Product Selector Modal for Review */}
      {reviewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-4 relative text-sm font-semibold text-[var(--text-main)]">
            <button
              onClick={() => setReviewOrder(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <X className="size-5" />
            </button>
            <h3 className="text-lg font-black text-[var(--text-main)] pb-2 border-b">
              Chọn sản phẩm để viết đánh giá
            </h3>
            <div className="space-y-3 pt-2">
              {reviewOrder.items
                .filter((item) => item.product)
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setReviewOrder(null);
                      router.push(`/product/${item.product!.id}?review=true`);
                    }}
                    className="w-full flex items-center gap-4 rounded-xl border border-gray-100 bg-[#FAF9F5] p-3 hover:bg-gray-50 hover:border-[var(--primary-color)] transition text-left cursor-pointer font-semibold"
                  >
                    <div className="aspect-square size-12 rounded-lg overflow-hidden bg-white border shrink-0">
                      <img
                        src={item.product!.imageUrl || '/placeholder.svg'}
                        alt={item.product!.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 font-bold">
                      <h4 className="text-sm font-black text-[var(--text-main)] line-clamp-2 leading-snug">
                        {item.product!.name}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] font-bold mt-1">
                        Số lượng mua: {item.quantity}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
      {/* PayOS QR Payment Overlay Modal */}
      <PayOSQRModal
        isOpen={isQRModalOpen}
        onClose={() => {
          setIsQRModalOpen(false);
          setPayOSQRData(null);
        }}
        onSuccess={handleQRSuccess}
        onCancelOrder={handleCancelQROrder}
        qrData={payOSQRData}
      />

      {/* PayOS Payout (Refund) Request Form Modal */}
      {refundOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-4 relative text-sm text-[var(--text-main)] font-semibold">
            <button
              onClick={() => setRefundOrderId(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <X className="size-5" />
            </button>

            <div className="text-center pb-2 border-b">
              <h3 className="text-lg font-black text-[var(--text-main)] flex items-center justify-center gap-2">
                <RefreshCw className="size-5 text-[var(--primary-color)] animate-spin-slow" />
                Yêu cầu hoàn tiền đơn hàng
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-bold">Mã đơn: #{refundOrderId}</p>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="block text-xs font-black uppercase text-[var(--text-muted)]">Ngân hàng nhận</label>
                <select
                  required
                  value={refundBankCode}
                  onChange={(e) => setRefundBankCode(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-[#FAF9F5] px-3.5 py-2.5 outline-none focus:border-[var(--primary-color)] font-bold text-xs"
                >
                  <option value="">-- Chọn ngân hàng --</option>
                  {banks.map((bank) => (
                    <option key={bank.bin} value={bank.bin}>
                      {bank.shortName} - {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black uppercase text-[var(--text-muted)]">Số tài khoản nhận</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập số tài khoản ngân hàng của bạn"
                  value={refundAccountNumber}
                  onChange={(e) => setRefundAccountNumber(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-[#FAF9F5] px-3.5 py-2.5 outline-none focus:border-[var(--primary-color)] font-bold text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black uppercase text-[var(--text-muted)]">Tên chủ tài khoản (Viết hoa không dấu)</label>
                  {isLookingUpAccount && (
                    <span className="text-[10px] text-amber-600 font-bold animate-pulse">Đang tra cứu...</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder={isLookingUpAccount ? "Đang truy vấn ngân hàng..." : "Ví dụ: TRAN NGOC DUC"}
                  value={refundAccountName}
                  onChange={(e) => setRefundAccountName(removeAccentsAndUpperCase(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 bg-[#FAF9F5] px-3.5 py-2.5 outline-none focus:border-[var(--primary-color)] font-bold text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-black uppercase text-[var(--text-muted)]">Lý do hoàn tiền</label>
                <textarea
                  placeholder="Nhập lý do hoàn tiền (không bắt buộc)"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 bg-[#FAF9F5] px-3.5 py-2.5 outline-none focus:border-[var(--primary-color)] font-bold text-xs resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundOrderId(null)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-black text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submittingRefund}
                  className="flex-1 rounded-xl bg-[var(--primary-color)] py-2.5 text-xs font-black text-white hover:bg-[var(--primary-hover)] transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {submittingRefund && <Loader2 className="size-3 animate-spin text-white" />}
                  Gửi yêu cầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
