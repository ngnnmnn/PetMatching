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
  X,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import AppHeader from '@/components/layout/AppHeader';
import { useCart } from '@/context/CartContext';
import { usersApi } from '@/lib/api/users';
import { Address } from '@/types';
import AddressFormModal from '@/components/checkout/AddressFormModal';
import PayOSQRModal, { PayOSQRData } from '@/components/checkout/PayOSQRModal';
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

  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    clearCart
  } = useCart();

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Selection and promo code state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [directCheckoutItem, setDirectCheckoutItem] = useState<any | null>(null);
  const [isAddressesExpanded, setIsAddressesExpanded] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedVoucher, setAppliedVoucher] = useState<any | null>(null);

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
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | undefined>(undefined);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | undefined>(undefined);
  const [selectedWardCode, setSelectedWardCode] = useState<string | undefined>(undefined);

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'QR'>('COD');

  // PayOS QR Modal State
  const [payOSQRData, setPayOSQRData] = useState<PayOSQRData | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Checkout Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [finalAddressStr, setFinalAddressStr] = useState('');
  const [recipientNameStr, setRecipientNameStr] = useState('');
  const [recipientPhoneStr, setRecipientPhoneStr] = useState('');

  const handleQRPaymentSuccess = async (orderId: string) => {
    setOrderPlaced(true);
    setIsQRModalOpen(false);
    if (directCheckoutItem) {
      localStorage.removeItem('petmatch_direct_checkout_item');
    } else {
      if (selectedItemIds.length > 0) {
        if (selectedItemIds.length === cartItems.length) {
          await clearCart();
        } else {
          for (const id of selectedItemIds) {
            await removeFromCart(id);
          }
        }
      } else {
        await clearCart();
      }
      localStorage.removeItem('petmatch_selected_cart_items');
    }
    router.push('/orders?status=success');
  };

  const handleCancelQROrder = async (orderId: string) => {
    try {
      await usersApi.deleteOrder(orderId);
      toast.info('Đã hủy giao dịch thanh toán QR. Đơn hàng chưa được lưu.');
    } catch (err) {
      console.error('Failed to delete unpaid QR order', err);
    }
  };

  // Load selected items and direct checkout item from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('petmatch_selected_cart_items');
    if (stored) {
      try {
        setSelectedItemIds(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }

    const storedDirect = localStorage.getItem('petmatch_direct_checkout_item');
    if (storedDirect) {
      try {
        setDirectCheckoutItem(JSON.parse(storedDirect));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleUpdateQty = async (item: any, newQty: number) => {
    if (newQty < 1) {
      toast.error('Số lượng tối thiểu là 1.');
      return;
    }

    const stock = item.variant ? item.variant.stock : item.product.stock;

    if (stock !== undefined && stock !== null && newQty > stock) {
      toast.warning(`Chỉ còn lại ${stock} sản phẩm trong kho`);
      return;
    }

    if (directCheckoutItem && item.id === directCheckoutItem.id) {
      const updated = { ...directCheckoutItem, quantity: newQty };
      setDirectCheckoutItem(updated);
      localStorage.setItem('petmatch_direct_checkout_item', JSON.stringify(updated));
    } else {
      await updateQuantity(item.id, newQty);
    }
  };

  const handleRemoveItem = async (item: any) => {
    if (directCheckoutItem && item.id === directCheckoutItem.id) {
      setDirectCheckoutItem(null);
      localStorage.removeItem('petmatch_direct_checkout_item');
      toast.info('Đã xóa sản phẩm khỏi thanh toán.');
      router.push('/cart');
    } else {
      // Exclude from checkout list, DO NOT remove from cart database/state!
      let updatedSelectedIds: string[] = [];

      if (selectedItemIds.length > 0) {
        updatedSelectedIds = selectedItemIds.filter((id) => id !== item.id);
      } else {
        // If selectedItemIds was empty (checking out all cart items),
        // we initialize it with all cart item IDs except the removed one
        updatedSelectedIds = cartItems.map((i) => i.id).filter((id) => id !== item.id);
      }

      setSelectedItemIds(updatedSelectedIds);
      localStorage.setItem('petmatch_selected_cart_items', JSON.stringify(updatedSelectedIds));
      toast.success(`Đã bỏ sản phẩm "${item.product.name}" khỏi danh sách thanh toán.`);

      // If no items are left to checkout, redirect to cart page
      if (updatedSelectedIds.length === 0) {
        toast.info('Không còn sản phẩm nào trong thanh toán.');
        router.push('/cart');
      }
    }
  };

  // Initialize promo code from query parameter if present
  useEffect(() => {
    const code = searchParams.get('code') || '';
    if (code) {
      const upperCode = code.toUpperCase();
      if (upperCode === 'PETMATCH10') {
        setDiscountPercent(10);
        setDiscountAmount(0);
        setAppliedCode(upperCode);
      } else if (upperCode === 'HELLOWORLD') {
        setDiscountPercent(0);
        setDiscountAmount(50000);
        setAppliedCode(upperCode);
      }
    }
  }, [searchParams]);

  const handleApplyPromoCode = async (e?: React.FormEvent | React.KeyboardEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!promoCode.trim()) return;

    const code = promoCode.trim().toUpperCase();
    if (code === 'PETMATCH10') {
      setDiscountPercent(10);
      setDiscountAmount(0);
      setAppliedVoucher(null);
      setAppliedCode(code);
      toast.success('Áp dụng mã PETMATCH10 thành công! Giảm 10% tổng hóa đơn.');
      setPromoCode('');
      return;
    } 
    
    if (code === 'HELLOWORLD') {
      setDiscountPercent(0);
      setDiscountAmount(50000);
      setAppliedVoucher(null);
      setAppliedCode(code);
      toast.success('Áp dụng mã HELLOWORLD thành công! Giảm 50.000đ.');
      setPromoCode('');
      return;
    }

    try {
      const response = await usersApi.applyVoucher(code, checkoutTotal);
      if (response.data.success) {
        const voucher = response.data;
        setAppliedVoucher(voucher);
        setAppliedCode(voucher.code);
        setDiscountPercent(0);
        setDiscountAmount(0);
        toast.success(voucher.message || 'Áp dụng mã giảm giá thành công!');
      }
    } catch (err: any) {
      console.error('Failed to apply voucher', err);
      const errMsg = err.response?.data?.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.';
      toast.error(errMsg);
    }
    setPromoCode('');
  };

  const handleRemovePromo = () => {
    setDiscountPercent(0);
    setDiscountAmount(0);
    setAppliedVoucher(null);
    setAppliedCode('');
    toast.message('Đã hủy áp dụng mã giảm giá');
  };

  // If we have a direct checkout item, checkout only that item. Otherwise, filter cart items.
  const checkoutItems = directCheckoutItem
    ? [directCheckoutItem]
    : selectedItemIds.length > 0
      ? cartItems.filter((item) => selectedItemIds.includes(item.id))
      : cartItems;

  // Redirect to cart if empty and not loading, unless order has been placed successfully
  useEffect(() => {
    if (!loading && checkoutItems.length === 0 && !orderPlaced) {
      router.push('/cart');
    }
  }, [loading, checkoutItems, router, orderPlaced]);

  const checkoutTotal = checkoutItems.reduce((acc, item) => {
    const price = item.variant
      ? (item.variant.salePrice ?? item.variant.sellingPrice)
      : (item.product.salePrice ?? item.product.sellingPrice);
    return acc + price * item.quantity;
  }, 0);

  const checkoutCount = checkoutItems.reduce((acc, item) => acc + item.quantity, 0);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const [calculatedShippingFee, setCalculatedShippingFee] = useState<number>(30000);
  const [calculatingFee, setCalculatingFee] = useState<boolean>(false);
  const [shippingFeeWarning, setShippingFeeWarning] = useState<string | null>(null);

  // Auto calculate GHN shipping fee when selected address changes
  useEffect(() => {
    let targetDistrictId: number | undefined;
    let targetWardCode: string | undefined;

    if (selectedAddressId === 'new' || !selectedAddressId) {
      targetDistrictId = selectedDistrictId;
      targetWardCode = selectedWardCode;
    } else {
      const addr = savedAddresses.find((a) => a.id === selectedAddressId);
      if (addr) {
        targetDistrictId = addr.districtId ?? undefined;
        targetWardCode = addr.wardCode ?? undefined;
      }
    }

    if (targetDistrictId && targetWardCode) {
      const fetchFee = async () => {
        setCalculatingFee(true);
        try {
          const res = await fetch(`${apiBaseUrl}/shipping/calculate-fee`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toDistrictId: targetDistrictId,
              toWardCode: targetWardCode,
              weight: 500,
            }),
          });
          const data = await res.json();
          if (data.total && typeof data.total === 'number') {
            setCalculatedShippingFee(data.total);
          }
          if (data.isEstimated && data.message) {
            // Check if it is a block warning from GHN or dynamic calculation issue
            if (data.message.includes('ngưng hỗ trợ') || data.message.includes('RECEIVER_WARD_BLOCKED') || data.message.includes('block')) {
              setShippingFeeWarning('Địa chỉ này tạm thời GHN không nhận giao hàng. Bạn vẫn có thể đặt hàng và Shop sẽ chủ động liên hệ giao cho bạn bằng đơn vị vận chuyển khác (ViettelPost, GHTK...).');
            } else {
              setShippingFeeWarning(null);
            }
          } else {
            setShippingFeeWarning(null);
          }
        } catch (err) {
          console.error('Failed to calculate GHN fee', err);
        } finally {
          setCalculatingFee(false);
        }
      };
      fetchFee();
    }
  }, [selectedAddressId, savedAddresses, selectedDistrictId, selectedWardCode, apiBaseUrl]);

  const hasItems = !!directCheckoutItem || selectedItemIds.length > 0;
  const baseShippingFee = (hasItems && checkoutTotal > 500000) ? 0 : calculatedShippingFee;
  const isFreeShip = appliedVoucher?.type === 'FREE_SHIP';
  const shippingFee = isFreeShip ? 0 : baseShippingFee;
  const discountVal = (checkoutTotal * discountPercent) / 100 + discountAmount + (isFreeShip ? baseShippingFee : 0);
  const finalTotal = Math.max(0, checkoutTotal + baseShippingFee - discountVal);

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

  // Handle QR Payment Cancel redirection from PayOS
  useEffect(() => {
    const status = searchParams.get('status');
    const orderId = searchParams.get('orderId');
    if (status === 'cancel' && orderId) {
      const cancelOrder = async () => {
        try {
          await usersApi.cancelOrder(orderId);
          toast.info('Đã hủy thanh toán. Đơn hàng chưa được lưu.');
        } catch (err) {
          console.error('Failed to cancel order on redirect:', err);
        } finally {
          // Clean up search parameters from URL
          window.history.replaceState({}, '', '/checkout');
        }
      };
      cancelOrder();
    }
  }, [searchParams]);

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
    setSelectedProvinceId(data.provinceId);
    setSelectedDistrictId(data.districtId);
    setSelectedWardCode(data.wardCode);
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
          provinceId: data.provinceId,
          districtId: data.districtId,
          wardCode: data.wardCode,
          isDefault: data.setAsDefault,
        });

        // Reload addresses from DB
        const addressesRes = await usersApi.getAddresses();
        const updatedList = addressesRes.data || [];
        setSavedAddresses(updatedList);

        // Select the newly created address
        const newAddr = updatedList.find(
          (a) => a.receiverName === data.receiverName && a.detail === data.detail,
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
          provinceId: data.provinceId,
          districtId: data.districtId,
          wardCode: data.wardCode,
          isDefault: data.setAsDefault,
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
    if (checkoutItems.length === 0) {
      toast.error('Giỏ hàng trống, không thể đặt hàng.');
      return;
    }

    let finalAddress = '';
    let name = '';
    let phoneStr = '';
    let targetDistrictId: number | undefined = undefined;
    let targetWardCode: string | undefined = undefined;

    setSubmitting(true);

    try {
      if (selectedAddressId === 'new' || selectedAddressId === '') {
        // Validate new address fields in state
        if (
          !receiverName ||
          !receiverPhone ||
          !detail ||
          !selectedProvinceName ||
          !selectedDistrictName ||
          !selectedWardName
        ) {
          toast.error('Vui lòng điền thông tin địa chỉ mới bằng cách nhấn vào Sử dụng địa chỉ mới!');
          setSubmitting(false);
          setIsAddressModalOpen(true);
          return;
        }

        name = receiverName.trim();
        phoneStr = receiverPhone.trim();
        finalAddress = `Tên: ${name} | SĐT: ${phoneStr} | Địa chỉ: ${detail.trim()}, ${selectedWardName}, ${selectedDistrictName}, ${selectedProvinceName}`;
        targetDistrictId = selectedDistrictId;
        targetWardCode = selectedWardCode;
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
        targetDistrictId = addr.districtId ?? undefined;
        targetWardCode = addr.wardCode ?? undefined;
      }

      if (userNote.trim()) {
        finalAddress += ` (Ghi chú: ${userNote.trim()})`;
      }

      // Prepare order items
      const orderItems = checkoutItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: Number(item.quantity),
        price: Number(
          item.variant
            ? (item.variant.salePrice ?? item.variant.sellingPrice)
            : (item.product.salePrice ?? item.product.sellingPrice)
        ),
      }));

      // Create Order in DB
      const res = await usersApi.createOrder({
        totalAmount: appliedVoucher
          ? Number(finalTotal) + Number(discountVal)
          : Number(finalTotal),
        shippingFee: Number(baseShippingFee),
        shippingAddress: finalAddress,
        districtId: targetDistrictId,
        wardCode: targetWardCode,
        paymentMethod: paymentMethod,
        voucherCode: appliedVoucher ? appliedVoucher.code : undefined,
        items: orderItems,
      });

      const orderData = res.data;
      setOrderPlaced(true);

      if (paymentMethod === 'QR') {
        if (orderData.status === 'PAYMENT_ERROR' || (!orderData.qrData && !orderData.checkoutUrl)) {
          toast.warning('Đơn hàng đã được tạo thành công nhưng không thể khởi tạo liên kết thanh toán vào lúc này. Vui lòng thử lại trong mục Đơn hàng.');
          // Vẫn cho phép tạo success modal và dọn dẹp giỏ hàng
        } else {
          setPayOSQRData(
            orderData.qrData
              ? { ...orderData.qrData, orderId: orderData.id }
              : {
                  orderId: orderData.id,
                  orderCode: orderData.orderCode,
                  accountNumber: '970422',
                  accountName: 'PETMATCHING',
                  bin: '970422',
                  amount: Number(finalTotal),
                  description: `PM${orderData.orderCode}`,
                  checkoutUrl: orderData.checkoutUrl,
                },
          );
          setIsQRModalOpen(true);
          toast.success('Vui lòng quét mã QR để hoàn tất thanh toán trong 15 phút.');
          return;
        }
      }

      setCreatedOrderId(orderData.id);
      setRecipientNameStr(name);
      setRecipientPhoneStr(phoneStr);
      setFinalAddressStr(finalAddress);

      setOrderPlaced(true);
      setShowSuccessModal(true);
      toast.success('Đã đặt hàng thành công!');
    } catch (err: any) {
      console.error('Failed to place order', err);
      console.error('Order error response details:', err.response?.data);
      const errMsg = Array.isArray(err.response?.data?.message)
        ? err.response.data.message.join(', ')
        : err.response?.data?.message || 'Có lỗi xảy ra trong quá trình đặt hàng.';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSuccessModal = async () => {
    setOrderPlaced(true);
    setShowSuccessModal(false);
    if (directCheckoutItem) {
      // Direct checkout bypassing cart: Do not touch the cart database/state
      localStorage.removeItem('petmatch_direct_checkout_item');
    } else {
      // Cart checkout: Clear only the checked-out items from the cart
      if (selectedItemIds.length > 0) {
        if (selectedItemIds.length === cartItems.length) {
          await clearCart();
        } else {
          for (const id of selectedItemIds) {
            await removeFromCart(id);
          }
        }
      } else {
        await clearCart();
      }
      localStorage.removeItem('petmatch_selected_cart_items');
    }
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
                    {(isAddressesExpanded
                      ? savedAddresses
                      : savedAddresses.filter((addr, index) => index < 2 || addr.id === selectedAddressId)
                    ).map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${selectedAddressId === addr.id
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
                              {(!addr.districtId || !addr.wardCode) && (
                                <span className="rounded bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[9px] font-bold border border-amber-200">Cần cập nhật vùng nhận</span>
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
                          {selectedAddressId === addr.id && (!addr.districtId || !addr.wardCode) && (
                            <p className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                              ⚠️ Địa chỉ cũ/thiếu mã vùng GHN (Phí ship mặc định 30,000₫). Vui lòng bấm "Sửa" để chọn quận/huyện, phường/xã.
                            </p>
                          )}
                        </div>
                      </label>
                    ))}

                    {savedAddresses.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setIsAddressesExpanded(!isAddressesExpanded)}
                        className="text-xs font-bold text-[#0F766E] hover:underline flex items-center gap-1 mt-2 transition cursor-pointer"
                      >
                        {isAddressesExpanded ? 'Thu gọn' : 'Xem thêm địa chỉ khác'}
                      </button>
                    )}
                  </div>
                )}

                {/* Option to use a new address */}
                <div
                  onClick={() => {
                    setSelectedAddressId('new');
                    setEditingAddress(null); // Clear editing state for create
                    setIsAddressModalOpen(true);
                  }}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-4 cursor-pointer transition ${selectedAddressId === 'new' || selectedAddressId === ''
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-[var(--border-color)] bg-[#FCFCFA] hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--text-main)]">
                    <input
                      type="radio"
                      name="saved_address"
                      checked={selectedAddressId === 'new' || selectedAddressId === ''}
                      readOnly
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
                </div>

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

                {shippingFeeWarning && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mt-3 flex items-start gap-2 text-amber-800 text-xs font-bold animate-in fade-in duration-200">
                    <span>⚠️</span>
                    <p className="leading-relaxed">{shippingFeeWarning}</p>
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
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${paymentMethod === 'COD'
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
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${paymentMethod === 'QR'
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
                  <div className="rounded-xl border border-teal-100 bg-[#F0FDF4]/50 p-5 flex items-start gap-4 animate-in fade-in duration-200">
                    <QrCode className="size-8 text-[#0F766E] shrink-0 mt-0.5 animate-pulse" />
                    <div className="text-xs font-semibold text-[var(--text-main)] space-y-1.5 flex-1">
                      <p className="text-sm font-black text-[#0F766E]">Thanh toán tự động qua PayOS</p>
                      <p className="text-[var(--text-muted)] leading-relaxed">
                        Hệ thống sẽ chuyển hướng bạn đến cổng thanh toán bảo mật <strong className="font-black text-[#0F766E]">PayOS</strong> ngay sau khi bạn nhấn nút <strong className="font-black text-[#0F766E]">"Đặt hàng"</strong> bên dưới.
                      </p>
                      <p className="text-[var(--text-muted)] leading-relaxed">
                        Tại đó, PayOS sẽ tạo mã QR động ngân hàng liên kết trực tiếp với tài khoản nhận tiền của bạn với số tiền chính xác là <span className="font-black text-primary">{formatCurrency(finalTotal)}</span> để bạn quét thanh toán tự động và an toàn.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Summary & Submit Button */}
            <div className="lg:col-span-4 space-y-6">

              {/* Promo Code Box */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-white p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-[var(--text-main)] mb-3 flex items-center gap-2">
                  <Tag className="size-4 text-primary" />
                  Mã giảm giá
                </h3>
                {appliedCode ? (
                  <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-200 p-3.5">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-green-500 shrink-0" />
                      <div>
                        <span className="text-sm font-extrabold text-green-800">Đã áp dụng: {appliedCode}</span>
                        <p className="text-[11px] text-green-700 font-semibold mt-0.5">
                          {discountPercent > 0 ? `Giảm ${discountPercent}% tổng đơn hàng` : `Giảm ${formatCurrency(discountAmount)}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập mã (Ví dụ: PETMATCH10, HELLOWORLD)"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyPromoCode(e);
                        }
                      }}
                      className="flex-1 rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm focus-visible:outline-none focus-visible:border-primary bg-[#FCFCFA]"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleApplyPromoCode(e)}
                      className="rounded-xl bg-[#0F766E] px-5 py-2 text-sm font-extrabold text-white hover:bg-[#115E59] transition cursor-pointer"
                    >
                      Áp dụng
                    </button>
                  </div>
                )}
                <div className="mt-2.5 flex flex-wrap gap-2 text-[10px] text-[var(--text-muted)] font-semibold">
                  <span>Mã gợi ý:</span>
                  <button type="button" onClick={() => setPromoCode('PETMATCH10')} className="underline text-[#0F766E] hover:text-[#115E59] cursor-pointer">PETMATCH10 (Giảm 10%)</button>
                  <span>|</span>
                  <button type="button" onClick={() => setPromoCode('HELLOWORLD')} className="underline text-[#0F766E] hover:text-[#115E59] cursor-pointer">HELLOWORLD (Giảm 50k)</button>
                </div>
              </div>

              {/* Order Items Summary */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-[var(--text-main)] pb-2 border-b border-[var(--border-color)]">Đơn hàng của bạn</h3>

                <div className="divide-y divide-[var(--border-color)] max-h-[30rem] overflow-y-auto pr-1">
                  {checkoutItems.map((item) => {
                    const price = item.variant
                      ? (item.variant.salePrice ?? item.variant.sellingPrice)
                      : (item.product.salePrice ?? item.product.sellingPrice);
                    return (
                      <div key={item.id} className="py-4 flex gap-3 items-center border-b border-[var(--border-color)] last:border-b-0">
                        {/* Image */}
                        <div className="aspect-square size-14 rounded-lg overflow-hidden bg-[#FAF9F5] border border-[var(--border-color)] shrink-0 relative">
                          <img
                            src={(item.variant && item.variant.imageUrl) || item.product.imageUrl || '/placeholder.svg'}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Info & Quantity Selector */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <p className="text-xs font-bold text-[var(--text-main)] line-clamp-2 pr-2" title={item.product.name}>
                            {item.product.name}
                          </p>
                          {item.variant && (
                            <p className="text-[10px] text-[#0F766E] font-extrabold mt-0.5 bg-[#EEF8F5] px-1.5 py-0.5 rounded inline-block w-fit">
                              Phân loại: {item.variant.name}
                            </p>
                          )}

                          {/* Mini Quantity Selector */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center rounded-lg border border-[var(--border-color)] bg-white p-0.5 shadow-sm">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item, item.quantity - 1)}
                                className="inline-flex size-5 items-center justify-center rounded bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-black transition active:scale-90 text-[10px] font-black cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-7 text-center text-xs font-black text-[var(--text-main)] select-none">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item, item.quantity + 1)}
                                className="inline-flex size-5 items-center justify-center rounded bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-black transition active:scale-90 text-[10px] font-black cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item)}
                              className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline transition ml-1 cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                          <span className="text-xs font-black text-[var(--text-main)]">
                            {formatCurrency(price * item.quantity)}
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-[9px] text-[var(--text-muted)] font-bold">
                              {formatCurrency(price)} / cái
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2.5 text-xs font-semibold pt-4 border-t border-[var(--border-color)]">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Tạm tính ({checkoutCount} sản phẩm)</span>
                    <span className="text-[var(--text-main)]">{formatCurrency(checkoutTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Phí vận chuyển</span>
                    <span className="text-[var(--text-main)]">
                      {shippingFee === 0 ? 'Miễn phí' : formatCurrency(shippingFee)}
                    </span>
                  </div>
                  {appliedCode && (
                    <div className="flex justify-between text-green-600 animate-in fade-in duration-200">
                      <span>
                        {appliedVoucher?.type === 'FREE_SHIP' 
                          ? `Miễn phí vận chuyển (${appliedCode})` 
                          : `Giảm giá (${appliedCode})`}
                      </span>
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
                    className="w-full mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-6 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#cf5017] disabled:bg-gray-200 disabled:text-gray-400 focus-visible:outline-none cursor-pointer"
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

      {/* PayOS QR Payment Overlay Modal */}
      <PayOSQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        onSuccess={handleQRPaymentSuccess}
        onCancelOrder={handleCancelQROrder}
        qrData={payOSQRData}
      />
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
