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
  QrCode
} from 'lucide-react';
import { toast } from 'sonner';
import AppHeader from '@/components/layout/AppHeader';
import { usersApi } from '@/lib/api/users';
import AddressFormModal from '@/components/checkout/AddressFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    imageUrl?: string | null;
  };
}

interface Order {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  shippingAddress: string;
  paymentMethod?: string;
  paymentUrl?: string | null;
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
      } catch (e) {}
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
    let base = `${contact} | ${parsed.detail}, ${parsed.ward}, ${parsed.district}, ${parsed.province}`;
    if (parsed.note) {
      base += ` (Ghi chú: ${parsed.note})`;
    }
    return base;
  }
  return addrStr;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  // Modal & Actions State
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);

  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [tempAddressData, setTempAddressData] = useState<any>(null);
  
  const [showAddressConfirmModal, setShowAddressConfirmModal] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);

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
      await usersApi.cancelOrder(cancelOrderId);
      toast.success('Đơn hàng đã được hủy thành công.');
      setCancelOrderId(null);
      await loadOrders();
    } catch (err: any) {
      console.error('Failed to cancel order', err);
      toast.error(err.response?.data?.message || 'Lỗi khi hủy đơn hàng.');
    } finally {
      setCancelling(false);
    }
  };

  const handleAddressEditClick = (order: Order) => {
    setEditOrder(order);
    setIsAddressModalOpen(true);
  };

  const handleReviewOrderClick = (order: Order) => {
    const validItems = order.items.filter(item => item.product);
    if (validItems.length === 0) {
      toast.error('Không tìm thấy sản phẩm trong đơn hàng này.');
      return;
    }
    
    if (validItems.length === 1) {
      router.push(`/home/product/${validItems[0].product!.id}?review=true`);
    } else {
      setReviewOrder(order);
    }
  };

  const handleAddressFormSubmit = (data: any) => {
    setIsAddressModalOpen(false);
    
    // Construct final address string with prefixes so it can be parsed next time
    let addressStr = `Tên: ${data.receiverName} | SĐT: ${data.receiverPhone} | Địa chỉ: ${data.detail}, ${data.wardName}, ${data.districtName}, ${data.provinceName}`;
    
    // Carry over user notes if present
    const parsedOld = editOrder ? parseAddressString(editOrder.shippingAddress) : { note: '' };
    if (parsedOld.note) {
      addressStr += ` (Ghi chú: ${parsedOld.note})`;
    }
    
    setTempAddressData({
      addressStr,
      receiverName: data.receiverName,
      receiverPhone: data.receiverPhone,
      displayAddress: `${data.detail}, ${data.wardName}, ${data.districtName}, ${data.provinceName}`
    });
    setShowAddressConfirmModal(true);
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
            Đã giao hàng
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2.5 py-1 text-xs font-extrabold text-orange-700">
            <Clock className="size-3.5" />
            Đang chuẩn bị
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700">
            <Truck className="size-3.5" />
            Đang vận chuyển
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-extrabold text-red-700">
            <XCircle className="size-3.5" />
            Đã hủy đơn
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700">
            <AlertTriangle className="size-3.5" />
            Chờ xác nhận
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (order: Order) => {
    if (order.paymentMethod === 'QR') {
      if (order.status === 'PENDING') {
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-700 border border-amber-200">
            Chờ thanh toán QR
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
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 border border-emerald-200">
            Đã thanh toán (PayOS)
          </span>
        );
      }
    } else {
      // COD method
      if (order.status === 'DELIVERED') {
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

        <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] sm:text-3xl mb-8">
          Lịch sử đặt hàng
        </h1>

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
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
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
                    
                    {/* Action buttons for PENDING orders */}
                    {order.status === 'PENDING' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {order.paymentMethod === 'QR' && order.paymentUrl && (
                          <a
                            href={order.paymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-[#0F766E] bg-[#0F766E] text-white px-2.5 py-1 text-xs font-bold hover:bg-[#115E59] transition shadow-sm cursor-pointer"
                          >
                            <QrCode className="size-3 text-white" />
                            Thanh toán ngay
                          </a>
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
                <div className="bg-[#FAF9F5]/40 px-6 py-4 border-t border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
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
          onSubmit={handleAddressFormSubmit}
          showSaveOptions={false}
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
                      router.push(`/home/product/${item.product!.id}?review=true`);
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
    </main>
  );
}
