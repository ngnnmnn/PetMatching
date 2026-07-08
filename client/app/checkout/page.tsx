'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle,
  Truck,
  Plus,
  MapPin,
  QrCode,
  Coins,
  Loader2,
  ShieldCheck,
  RotateCcw,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import AppHeader from '@/components/layout/AppHeader';
import { useCart } from '@/context/CartContext';
import { usersApi } from '@/lib/api/users';
import { Address } from '@/types';
import AddressFormModal from '@/components/checkout/AddressFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appliedCode = searchParams.get('code') || '';

  const {
    cartItems,
    cartTotal,
    cartCount,
    clearCart
  } = useCart();

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Addresses from DB
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(''); // empty means "new address"
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Address delete state
  const [addressToDeleteId, setAddressToDeleteId] = useState<string | null>(null);
  const [deletingAddressLoading, setDeletingAddressLoading] = useState(false);

  // Temporary New Address Form State (if not saving to DB immediately)
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [userNote, setUserNote] = useState('');
  const [saveAddressToDb, setSaveAddressToDb] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(false);
  
  const [selectedProvinceName, setSelectedProvinceName] = useState('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [selectedWardName, setSelectedWardName] = useState('');

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'QR'>('COD');

  // Checkout Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [finalAddressStr, setFinalAddressStr] = useState('');
  const [recipientNameStr, setRecipientNameStr] = useState('');
  const [recipientPhoneStr, setRecipientPhoneStr] = useState('');

  // Discount calculation based on code passed in query
  let discountPercent = 0;
  let discountAmount = 0;
  if (appliedCode === 'PETMATCH10') {
    discountPercent = 10;
  } else if (appliedCode === 'HELLOWORLD') {
    discountAmount = 50000;
  }

  const shippingFee = cartTotal > 500000 || cartTotal === 0 ? 0 : 30000;
  const discountVal = (cartTotal * discountPercent) / 100 + discountAmount;
  const finalTotal = Math.max(0, cartTotal + shippingFee - discountVal);

  const loadAddresses = async () => {
    try {
      const response = await usersApi.getAddresses();
      const data = response.data || [];
      setSavedAddresses(data);
      if (data.length > 0) {
        // Keep current selection if valid, otherwise default or first one
        if (!selectedAddressId || selectedAddressId === 'new') {
          const defaultAddr = data.find((a) => a.isDefault);
          setSelectedAddressId(defaultAddr ? defaultAddr.id : data[0].id);
        }
      } else {
        setSelectedAddressId('new');
      }
    } catch (err) {
      console.error('Failed to load saved addresses', err);
      setSelectedAddressId('new');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadAddresses();
  }, []);

  if (!isMounted) {
    return (
      <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)]">
        <AppHeader sectionLabel="Thanh toán" />
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <div className="size-10 animate-spin rounded-full border-4 border-[var(--primary-color)] border-t-transparent" />
          <p className="text-sm font-semibold text-[var(--text-muted)]">Đang tải trang thanh toán...</p>
        </div>
      </main>
    );
  }

  const handleEditAddressClick = (addr: Address) => {
    setEditingAddress(addr);
    setIsAddressModalOpen(true);
  };

  const handleDeleteAddressConfirm = async () => {
    if (!addressToDeleteId) return;
    setDeletingAddressLoading(true);
    try {
      await usersApi.deleteAddress(addressToDeleteId);
      toast.success('Đã xóa địa chỉ thành công.');
      
      const response = await usersApi.getAddresses();
      const data = response.data || [];
      setSavedAddresses(data);
      if (data.length > 0) {
        setSelectedAddressId(data.find((a) => a.isDefault)?.id || data[0].id);
      } else {
        setSelectedAddressId('new');
      }
    } catch (err) {
      console.error('Failed to delete address', err);
      toast.error('Lỗi khi xóa địa chỉ.');
    } finally {
      setDeletingAddressLoading(false);
      setAddressToDeleteId(null);
    }
  };

  const handleNewAddressSubmit = async (data: any) => {
    // Set temporary address variables
    setReceiverName(data.receiverName);
    setReceiverPhone(data.receiverPhone);
    setDetail(data.detail);
    setSelectedProvinceName(data.provinceName);
    setSelectedDistrictName(data.districtName);
    setSelectedWardName(data.wardName);
    setSaveAddressToDb(data.saveAddressToDb);
    setSetAsDefault(data.setAsDefault);
    
    if (data.saveAddressToDb) {
      setLoading(true);
      try {
        await usersApi.createAddress({
          receiverName: data.receiverName,
          receiverPhone: data.receiverPhone,
          province: data.provinceName,
          district: data.districtName,
          ward: data.wardName,
          detail: data.detail,
          isDefault: data.setAsDefault
        });
        
        // Reload addresses from DB
        const addressesRes = await usersApi.getAddresses();
        const updatedList = addressesRes.data || [];
        setSavedAddresses(updatedList);
        
        // Select the newly created address
        const newAddr = updatedList.find(
          (a) => a.receiverName === data.receiverName && a.detail === data.detail
        );
        if (newAddr) {
          setSelectedAddressId(newAddr.id);
        } else {
          setSelectedAddressId(updatedList[0]?.id || 'new');
        }
        toast.success('Đã thêm và lưu địa chỉ mới thành công.');
      } catch (err) {
        console.error('Failed to save address to DB', err);
        toast.error('Lỗi khi lưu địa chỉ mới vào cơ sở dữ liệu.');
        setSelectedAddressId('new');
      } finally {
        setLoading(false);
      }
    } else {
      // Just use it as temporary state
      setSelectedAddressId('new');
      toast.success('Đã áp dụng địa chỉ giao hàng mới.');
    }
  };

  const handleAddressSubmit = async (data: any) => {
    setIsAddressModalOpen(false);

    if (editingAddress) {
      setLoading(true);
      try {
        await usersApi.updateAddress(editingAddress.id, {
          receiverName: data.receiverName,
          receiverPhone: data.receiverPhone,
          province: data.provinceName,
          district: data.districtName,
          ward: data.wardName,
          detail: data.detail,
          isDefault: data.setAsDefault
        });
        toast.success('Đã cập nhật thông tin địa chỉ thành công.');
        await loadAddresses();
      } catch (err) {
        console.error('Failed to update address', err);
        toast.error('Lỗi khi cập nhật địa chỉ.');
      } finally {
        setEditingAddress(null);
        setLoading(false);
      }
    } else {
      await handleNewAddressSubmit(data);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      toast.error('Giỏ hàng trống, không thể đặt hàng.');
      return;
    }

    let finalAddress = '';
    let name = '';
    let phoneStr = '';

    setSubmitting(true);

    try {
      if (selectedAddressId === 'new' || selectedAddressId === '') {
        // Validate new address fields in state
        if (!receiverName || !receiverPhone || !detail || !selectedProvinceName || !selectedDistrictName || !selectedWardName) {
          toast.error('Vui lòng điền thông tin địa chỉ mới bằng cách nhấn vào Sử dụng địa chỉ mới!');
          setSubmitting(false);
          setIsAddressModalOpen(true);
          return;
        }

        name = receiverName.trim();
        phoneStr = receiverPhone.trim();
        finalAddress = `Tên: ${name} | SĐT: ${phoneStr} | Địa chỉ: ${detail.trim()}, ${selectedWardName}, ${selectedDistrictName}, ${selectedProvinceName}`;
      } else {
        // Use saved address
        const addr = savedAddresses.find((a) => a.id === selectedAddressId);
        if (!addr) {
          toast.error('Địa chỉ đã chọn không hợp lệ.');
          setSubmitting(false);
          return;
        }
        name = addr.receiverName;
        phoneStr = addr.receiverPhone;
        finalAddress = `Tên: ${name} | SĐT: ${phoneStr} | Địa chỉ: ${addr.detail}, ${addr.ward}, ${addr.district}, ${addr.province}`;
      }

      if (userNote.trim()) {
        finalAddress += ` (Ghi chú: ${userNote.trim()})`;
      }

      // Prepare order items
      const orderItems = cartItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.salePrice ?? item.product.originalPrice
      }));

      // Create Order in DB
      const res = await usersApi.createOrder({
        totalAmount: finalTotal,
        shippingAddress: finalAddress,
        items: orderItems
      });

      const orderData = res.data;

      setCreatedOrderId(orderData.id);
      setRecipientNameStr(name);
      setRecipientPhoneStr(phoneStr);
      setFinalAddressStr(finalAddress);
      
      setShowSuccessModal(true);
      toast.success('Đã đặt hàng thành công!');
    } catch (err: any) {
      console.error('Failed to place order', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra trong quá trình đặt hàng.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    clearCart();
    router.push('/orders');
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseSuccessModal();
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-16">
      <AppHeader sectionLabel="Thanh toán" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Back Link */}
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-muted)] hover:text-primary transition mb-6"
        >
          <ArrowLeft className="size-4" />
          Quay lại giỏ hàng
        </Link>

        <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)] sm:text-3xl mb-1">
          Thanh toán
        </h1>
        <p className="text-xs text-[var(--text-muted)] mb-8 font-semibold">
          Kiểm tra thông tin giao hàng và hoàn tất đơn hàng.
        </p>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="size-8 animate-spin text-[var(--primary-color)]" />
          </div>
        ) : (
          <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left side: Address & Payment */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Shipping Address Box */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-[var(--text-main)] border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
                  <MapPin className="size-5 text-[#0F766E]" />
                  Địa chỉ giao hàng
                </h3>

                {/* Saved Addresses List */}
                {savedAddresses.length > 0 && (
                  <div className="space-y-3">
                    {savedAddresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                          selectedAddressId === addr.id
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-[var(--border-color)] bg-[#FCFCFA] hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="saved_address"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-1 accent-[var(--primary-color)]"
                        />
                        <div className="flex-1 text-xs font-semibold">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--text-main)] text-sm">{addr.receiverName}</span>
                              <span className="text-[var(--text-muted)]">•</span>
                              <span className="text-[var(--text-muted)]">{addr.receiverPhone}</span>
                              {addr.isDefault && (
                                <span className="rounded bg-[#EEF8F5] text-[#0F766E] px-1.5 py-0.5 text-[9px] font-extrabold uppercase">Mặc định</span>
                              )}
                            </div>
                            
                            {/* Action Buttons to Edit or Delete Address */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleEditAddressClick(addr);
                                }}
                                className="text-xs text-[#0F766E] hover:underline font-bold transition hover:opacity-80"
                              >
                                Sửa
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAddressToDeleteId(addr.id);
                                }}
                                className="text-xs text-red-500 hover:underline font-bold transition hover:opacity-80"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                          <p className="text-[var(--text-muted)] mt-1.5 leading-relaxed">
                            {addr.detail}, {addr.ward}, {addr.district}, {addr.province}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Option to use a new address */}
                <label
                  className={`flex items-center justify-between gap-3 rounded-xl border p-4 cursor-pointer transition ${
                    selectedAddressId === 'new' || selectedAddressId === ''
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-[var(--border-color)] bg-[#FCFCFA] hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--text-main)]">
                    <input
                      type="radio"
                      name="saved_address"
                      checked={selectedAddressId === 'new' || selectedAddressId === ''}
                      onChange={() => {
                        setSelectedAddressId('new');
                        setEditingAddress(null); // Clear editing state for create
                        setIsAddressModalOpen(true);
                      }}
                      className="accent-[var(--primary-color)]"
                    />
                    <Plus className="size-4 text-primary" />
                    Sử dụng địa chỉ mới
                  </div>
                  {(selectedAddressId === 'new' || selectedAddressId === '') && receiverName && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingAddress(null); // Create mode
                        setIsAddressModalOpen(true);
                      }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Sửa
                    </button>
                  )}
                </label>

                {/* Temporary Address Summary */}
                {(selectedAddressId === 'new' || selectedAddressId === '') && receiverName && (
                  <div className="rounded-xl border border-dashed border-primary bg-primary/5 p-4 text-xs font-semibold animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-main)] text-sm">{receiverName}</span>
                      <span className="text-[var(--text-muted)]">•</span>
                      <span className="text-[var(--text-muted)]">{receiverPhone}</span>
                      <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[9px] font-extrabold uppercase">Tạm thời</span>
                    </div>
                    <p className="text-[var(--text-muted)] mt-1.5 leading-relaxed">
                      {detail}, {selectedWardName}, {selectedDistrictName}, {selectedProvinceName}
                    </p>
                  </div>
                )}

                <div className="border-t border-[var(--border-color)] pt-4 mt-2">
                  <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1">Ghi chú giao hàng (tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Giao ngoài giờ hành chính, gọi trước khi đến 15 phút"
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA]"
                  />
                </div>
              </div>

              {/* Payment Method Box */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-[var(--text-main)] border-b border-[var(--border-color)] pb-2 flex items-center gap-2">
                  <CreditCard className="size-5 text-[#0F766E]" />
                  Phương thức thanh toán
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* COD Option */}
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                      paymentMethod === 'COD'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-[var(--border-color)] bg-[#FCFCFA] hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="mt-1 accent-[var(--primary-color)]"
                    />
                    <div className="text-xs font-semibold">
                      <div className="flex items-center gap-2 font-bold text-[var(--text-main)] text-sm">
                        <Coins className="size-4 text-amber-500" />
                        Thanh toán khi nhận hàng
                      </div>
                      <p className="text-[var(--text-muted)] mt-1 leading-relaxed">
                        Trả tiền mặt khi shipper giao hàng đến nhà bạn.
                      </p>
                    </div>
                  </label>

                  {/* QR Bank Transfer Option */}
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                      paymentMethod === 'QR'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-[var(--border-color)] bg-[#FCFCFA] hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      checked={paymentMethod === 'QR'}
                      onChange={() => setPaymentMethod('QR')}
                      className="mt-1 accent-[var(--primary-color)]"
                    />
                    <div className="text-xs font-semibold">
                      <div className="flex items-center gap-2 font-bold text-[var(--text-main)] text-sm">
                        <QrCode className="size-4 text-[#0F766E]" />
                        Chuyển khoản QR
                      </div>
                      <p className="text-[var(--text-muted)] mt-1 leading-relaxed">
                        Quét mã QR ngân hàng để thanh toán nhanh.
                      </p>
                    </div>
                  </label>
                </div>

                {/* QR Details */}
                {paymentMethod === 'QR' && (
                  <div className="rounded-xl border border-[var(--border-color)] bg-[#FCFCFA] p-5 flex flex-col md:flex-row items-center gap-6 animate-in fade-in duration-200">
                    <div className="shrink-0 aspect-square size-36 bg-white border border-[var(--border-color)] rounded-xl flex items-center justify-center p-2.5 shadow-sm">
                      <img
                        src={`https://api.vietqr.io/image/970415-1133668899-yE9sXpE.jpg?accountName=PETMATCH%20VIETNAM&amount=${finalTotal}`}
                        alt="Mã QR chuyển khoản"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-xs font-bold text-[var(--text-main)] space-y-2 flex-1">
                      <p className="text-sm font-black uppercase text-[#0F766E]">PETMATCH BANKING</p>
                      <div>
                        <span className="text-[var(--text-muted)] font-semibold">Ngân hàng:</span>
                        <p className="mt-0.5">Viettinbank (NHTMCP Công Thương Việt Nam)</p>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] font-semibold">Số tài khoản:</span>
                        <p className="mt-0.5 font-black text-sm tracking-wide text-primary">1133668899</p>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] font-semibold">Chủ tài khoản:</span>
                        <p className="mt-0.5">PETMATCH VIETNAM</p>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] font-semibold">Số tiền cần chuyển:</span>
                        <p className="mt-0.5 font-black text-sm text-primary">{formatCurrency(finalTotal)}</p>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] italic font-semibold pt-1 border-t border-gray-200">
                        * Quét mã QR trên để tự động điền số tài khoản và số tiền chính xác.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Summary & Submit Button */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Order Items Summary */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-[var(--text-main)] pb-2 border-b border-[var(--border-color)]">Đơn hàng của bạn</h3>
                
                <div className="divide-y divide-[var(--border-color)] max-h-56 overflow-y-auto pr-1">
                  {cartItems.map((item) => {
                    const price = item.product.salePrice ?? item.product.originalPrice;
                    return (
                      <div key={item.id} className="py-3 flex gap-3 items-center">
                        <div className="aspect-square size-11 rounded-md overflow-hidden bg-[#FAF9F5] border border-[var(--border-color)] shrink-0">
                          <img
                            src={item.product.imageUrl || '/placeholder.svg'}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[var(--text-main)] line-clamp-1">{item.product.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-semibold mt-0.5">SL: {item.quantity}</p>
                        </div>
                        <span className="text-xs font-black text-[var(--text-main)]">{formatCurrency(price * item.quantity)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2.5 text-xs font-semibold pt-4 border-t border-[var(--border-color)]">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Tạm tính</span>
                    <span className="text-[var(--text-main)]">{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Phí vận chuyển</span>
                    <span className="text-[var(--text-main)]">
                      {shippingFee === 0 ? 'Miễn phí' : formatCurrency(shippingFee)}
                    </span>
                  </div>
                  {appliedCode && (
                    <div className="flex justify-between text-green-600">
                      <span>Giảm giá ({appliedCode})</span>
                      <span>-{formatCurrency(discountVal)}</span>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t border-[var(--border-color)] flex justify-between items-end text-sm">
                    <span className="text-sm font-black text-[var(--text-main)]">Tổng cộng</span>
                    <span className="text-base font-black text-[var(--primary-color)]">{formatCurrency(finalTotal)}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#cf5017] disabled:bg-gray-200 disabled:text-gray-400 focus-visible:outline-none"
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin text-white" />
                    ) : (
                      'Đặt hàng'
                    )}
                  </button>

                  <p className="text-[10px] text-[var(--text-muted)] font-medium text-center mt-2 leading-relaxed">
                    Bấm &quot;Đặt hàng&quot; nghĩa là bạn đồng ý với điều khoản mua hàng của chúng tôi.
                  </p>
                </div>
              </div>

              {/* Badges Box */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-white p-5 shadow-sm grid grid-cols-3 gap-2">
                {[
                  { icon: ShieldCheck, title: 'Chất lượng', desc: '100% chính hãng' },
                  { icon: Truck, title: 'Vận chuyển', desc: 'Giao hàng nhanh' },
                  { icon: RotateCcw, title: 'Đổi trả', desc: 'Hỗ trợ 7 ngày' },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center p-2 rounded-lg bg-[#FAF9F5]">
                    <item.icon className="h-5 w-5 text-[#0F766E] mb-1" />
                    <span className="text-[10px] font-extrabold text-[var(--text-main)]">{item.title}</span>
                    <span className="text-[8px] font-medium text-[var(--text-muted)] mt-0.5 leading-tight">{item.desc}</span>
                  </div>
                ))}
              </div>

            </div>
          </form>
        )}
      </div>

      {/* Reusable Address Input / Edit Popup */}
      <AddressFormModal
        isOpen={isAddressModalOpen}
        onClose={() => {
          setIsAddressModalOpen(false);
          setEditingAddress(null);
          // Reset selection if user closed modal during initial "+ Sử dụng địa chỉ mới" selection
          if (!receiverName && selectedAddressId === 'new' && savedAddresses.length > 0) {
            setSelectedAddressId(savedAddresses.find((a) => a.isDefault)?.id || savedAddresses[0].id);
          }
        }}
        onSubmit={handleAddressSubmit}
        showSaveOptions={editingAddress ? false : true}
        title={editingAddress ? 'Sửa thông tin địa chỉ giao hàng' : 'Nhập thông tin giao hàng mới'}
        initialData={
          editingAddress
            ? {
                receiverName: editingAddress.receiverName,
                receiverPhone: editingAddress.receiverPhone,
                province: editingAddress.province,
                district: editingAddress.district,
                ward: editingAddress.ward,
                detail: editingAddress.detail,
              }
            : undefined
        }
      />

      {/* Shared Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!addressToDeleteId}
        onClose={() => setAddressToDeleteId(null)}
        onConfirm={handleDeleteAddressConfirm}
        title="Xóa địa chỉ"
        message="Bạn có chắc chắn muốn xóa địa chỉ này khỏi tài khoản không? Hành động này không thể hoàn tác."
        confirmText="Xóa địa chỉ"
        isDanger={true}
        loading={deletingAddressLoading}
      />

      {/* Checkout Success Modal */}
      {showSuccessModal && (
        <div
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200 relative">
            
            {/* Close Button X */}
            <button
              type="button"
              onClick={handleCloseSuccessModal}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:text-[var(--text-main)] hover:bg-gray-100 transition"
              aria-label="Đóng"
            >
              <X className="size-5" />
            </button>

            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-50 text-green-500">
              <CheckCircle className="size-10 fill-green-100" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-black text-[var(--text-main)]">Đặt hàng thành công!</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Mã đơn hàng của bạn là: <span className="font-extrabold text-[var(--text-main)]">{createdOrderId}</span>
              </p>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed px-2">
                Cảm ơn bạn đã tin tưởng PetMatch. Đơn hàng của bạn sẽ được xử lý và giao nhận trong thời gian sớm nhất.
              </p>
            </div>

            <div className="rounded-xl bg-[#FAF9F5] border border-[var(--border-color)] p-4 text-left text-xs space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-[var(--text-muted)]">Khách hàng:</span>
                <span className="text-[var(--text-main)]">{recipientNameStr}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-[var(--text-muted)]">Số điện thoại:</span>
                <span className="text-[var(--text-main)]">{recipientPhoneStr}</span>
              </div>
              <div className="flex flex-col gap-0.5 font-semibold">
                <span className="text-[var(--text-muted)]">Địa chỉ nhận hàng:</span>
                <span className="text-[var(--text-main)] mt-0.5 leading-relaxed">{finalAddressStr}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t border-[var(--border-color)] text-sm">
                <span className="text-[var(--text-main)]">Tổng tiền thanh toán:</span>
                <span className="text-[var(--primary-color)]">{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            <button
              onClick={handleCloseSuccessModal}
              className="w-full inline-flex h-11 items-center justify-center rounded-xl bg-[#0F766E] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#115E59]"
            >
              Xem danh sách đơn hàng
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--primary-color)] border-r-transparent" />
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
