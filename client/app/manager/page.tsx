'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
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
  Eye,
  Calendar,
  Clock,
  Scissors,
  Check,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Award,
  MessageSquare,
  ChevronsRight,
  RefreshCw,
  DollarSign,
  Percent,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { managerApi, ManagerProduct, ManagerOrder, ManagerCustomer, StoreSettings, ManagerDashboardStats, ProductUnit } from '@/lib/api/manager';
import { productsApi } from '@/lib/api/products';
import { spaApi } from '@/lib/api/spa';
import { Category } from '@/types';
import { uploadImages } from '@/lib/api/uploads';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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
  MEDICAL: 'Y tế & Thuốc',
};

const ORDER_STATUS_MAP: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  PROCESSING: 'Đã thanh toán (Chờ gói)',
  PACKED: 'Đã gói hàng',
  SHIPPED: 'Đã gửi bên vận chuyển',
  DELIVERED: 'Đã nhận hàng',
  CANCELLED: 'Đã hủy',
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

  const [role, setRole] = useState<string>('');
  const [managerUser, setManagerUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const u = JSON.parse(stored);
      setRole(u.role || '');
      setManagerUser(u);
    }
  }, []);

  if (!role) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--primary-color)]" />
        <span className="ml-2 text-sm font-bold text-[var(--text-muted)]">Đang tải...</span>
      </div>
    );
  }

  if (role === 'SPA_MANAGER') {
    return <SpaManagerConsole currentTab={currentTab} managerUser={managerUser} />;
  }

  return <StoreManagerConsole currentTab={currentTab} />;
}

function StoreManagerConsole({ currentTab }: { currentTab: string }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ManagerDashboardStats | null>(null);
  const [products, setProducts] = useState<ManagerProduct[]>([]);
  const [orders, setOrders] = useState<ManagerOrder[]>([]);
  const [customers, setCustomers] = useState<ManagerCustomer[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreSettings | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<ManagerOrder | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const showBatchCheckboxes = filterStatus !== 'ALL' && filterStatus !== 'DELIVERED';
  const [filterCategory, setFilterCategory] = useState('ALL');
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
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [isUnitSidebarOpen, setIsUnitSidebarOpen] = useState(false);
  const [isUnitSidebarClosing, setIsUnitSidebarClosing] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitName, setEditingUnitName] = useState('');
  const [specList, setSpecList] = useState<{ key: string; value: string }[]>([]);
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
    onConfirm: () => {},
    loading: false,
  });
  const [isSaved, setIsSaved] = useState(false);
  const [submittingSettings, setSubmittingSettings] = useState(false);
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
  const [variants, setVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<any | null>(null);
  const [submittingVariant, setSubmittingVariant] = useState(false);
  const [variantForm, setVariantForm] = useState({
    name: '',
    sellingPrice: '',
    salePrice: '',
    stock: '',
    imageUrl: '',
  });

  const [showVariantsEditor, setShowVariantsEditor] = useState(false);
  const [localVariants, setLocalVariants] = useState<any[]>([]);
  const [editingLocalVariantIndex, setEditingLocalVariantIndex] = useState<number | null>(null);
  const [uploadingVariantImage, setUploadingVariantImage] = useState(false);

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
    salePrice: '',
    stock: '',
    brand: '',
    unit: '',
    imageUrl: '',
    description: '',
    isFeatured: false,
    isActive: true,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, productsRes, ordersRes, customersRes, settingsRes, categoriesRes, unitsRes] =
        await Promise.allSettled([
          managerApi.getDashboardStats(),
          managerApi.getProducts(),
          managerApi.getOrders(),
          managerApi.getCustomers(),
          managerApi.getStoreSettings(),
          productsApi.getCategories(),
          managerApi.getProductUnits(),
        ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (productsRes.status === 'fulfilled') setProducts(productsRes.value.data);
      if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value.data);
      if (customersRes.status === 'fulfilled') setCustomers(customersRes.value.data);
      if (settingsRes.status === 'fulfilled') setStoreInfo(settingsRes.value.data);
      if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value.data);
      if (unitsRes.status === 'fulfilled') setUnits(unitsRes.value.data);
    } catch (error) {
      console.error('Failed to fetch manager dashboard data', error);
      toast.error('Lỗi khi tải dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (banks.length === 0) {
      fetch('https://api.vietqr.io/v2/banks')
        .then((res) => res.json())
        .then((data) => {
          if (data.code === '00') {
            setBanks(data.data || []);
          }
        })
        .catch((err) => console.error('Failed to fetch banks', err));
    }
  }, [currentTab, banks.length]);

  // Filtered lists based on search and status filters
  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.brand && product.brand.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'IN_STOCK' && (product.stock ?? 0) > 10) ||
        (filterStatus === 'LOW_STOCK' && (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 10) ||
        (filterStatus === 'OUT_OF_STOCK' && (product.stock ?? 0) === 0);
      const matchesCategory =
        filterCategory === 'ALL' ||
        product.category === filterCategory;
      return matchesSearch && matchesStatus && matchesCategory;
    });

    if (sortBy === 'BEST_SELLER') {
      result = [...result].sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0));
    }

    return result;
  }, [products, searchQuery, filterStatus, filterCategory, sortBy]);

  const topSellingProducts = useMemo(() => {
    return [...products]
      .filter((p) => (p.sales ?? 0) > 0)
      .sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0))
      .slice(0, 5);
  }, [products]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
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
  }, [orders, searchQuery, filterStatus]);

  const filteredCustomers = useMemo(() => {
    let result = [...customers];
    
    // 1. Filter new customers (0 total orders, even if cancelled)
    if (customerFilterNew === 'new') {
      result = result.filter(c => c.isNewCustomer);
    }

    // 2. Search query (name, email, phone)
    if (customerSearch.trim()) {
      const query = customerSearch.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.phone.includes(query)
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

  const eligibleOrdersForGhn = useMemo(() => {
    return filteredOrders.filter(
      (o) =>
        o.status !== 'CANCELLED' &&
        o.status !== 'SHIPPED' &&
        o.status !== 'DELIVERED' &&
        o.refundStatus !== 'PENDING' &&
        o.refundStatus !== 'REFUNDED'
    );
  }, [filteredOrders]);

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

      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
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

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Xuất file Excel thành công!');
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error('Failed to export orders to excel', err);
      toast.error('Lỗi khi xuất file Excel.');
    } finally {
      setExportingOrders(false);
    }
  };

  // Shipping & Delivery Modal States
  const [shipModalOrder, setShipModalOrder] = useState<ManagerOrder | null>(null);
  const [shippingNoteInput, setShippingNoteInput] = useState<string>('');
  const [submittingShipNote, setSubmittingShipNote] = useState<boolean>(false);

  const [deliveryModalOrder, setDeliveryModalOrder] = useState<ManagerOrder | null>(null);
  const [deliveryProofFile, setDeliveryProofFile] = useState<File | null>(null);
  const [deliveryProofPreview, setDeliveryProofPreview] = useState<string | null>(null);
  const [deliveryNoteInput, setDeliveryNoteInput] = useState<string>('');
  const [submittingDeliveryProof, setSubmittingDeliveryProof] = useState<boolean>(false);

  const handleOrderStatusChange = async (
    orderId: string,
    newStatus: string,
    deliveryProofUrl?: string,
    shippingNote?: string,
  ) => {
    try {
      await managerApi.updateOrderStatus(orderId, newStatus, deliveryProofUrl, shippingNote);
      toast.success('Cập nhật trạng thái đơn hàng thành công!');
      const res = await managerApi.getOrders();
      setOrders(res.data);
      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails(res.data.find((o) => o.id === orderId) || null);
      }
    } catch (error) {
      console.error('Failed to update order status', error);
      toast.error('Lỗi khi cập nhật trạng thái đơn hàng.');
    }
  };

  const [submittingBatch, setSubmittingBatch] = useState<boolean>(false);

  const handleBatchStatusChange = async (targetStatus: string, actionLabel: string) => {
    if (selectedOrderIds.length === 0) return;
    setSubmittingBatch(true);
    try {
      await Promise.all(
        selectedOrderIds.map((id) => managerApi.updateOrderStatus(id, targetStatus))
      );
      toast.success(`Đã chuyển trạng thái "${actionLabel}" cho ${selectedOrderIds.length} đơn hàng!`);
      setSelectedOrderIds([]);
      const res = await managerApi.getOrders();
      setOrders(res.data);
    } catch (err: any) {
      console.error('Failed batch status update', err);
      toast.error('Có lỗi xảy ra khi chuyển trạng thái hàng loạt.');
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
      const res = await managerApi.getOrders();
      setOrders(res.data);
    } catch (err: any) {
      console.error('Failed batch refund approval', err);
      toast.error('Có lỗi xảy ra khi duyệt hoàn tiền hàng loạt.');
    } finally {
      setSubmittingBatch(false);
    }
  };

  const handleConfirmShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipModalOrder) return;
    setSubmittingShipNote(true);
    try {
      await handleOrderStatusChange(
        shipModalOrder.id,
        'SHIPPED',
        undefined,
        shippingNoteInput.trim() || undefined,
      );
      setShipModalOrder(null);
      setShippingNoteInput('');
    } catch (err) {
      // handled
    } finally {
      setSubmittingShipNote(false);
    }
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalOrder) return;
    setSubmittingDeliveryProof(true);
    try {
      let imageUrl: string | undefined = undefined;
      if (deliveryProofFile) {
        const uploadRes = await managerApi.uploadDeliveryProof(deliveryProofFile);
        imageUrl = uploadRes.data.url;
      }
      await handleOrderStatusChange(
        deliveryModalOrder.id,
        'DELIVERED',
        imageUrl,
        deliveryNoteInput.trim() || undefined,
      );
      setDeliveryModalOrder(null);
      setDeliveryProofFile(null);
      setDeliveryProofPreview(null);
      setDeliveryNoteInput('');
    } catch (err: any) {
      console.error('Failed to confirm delivery', err);
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật giao hàng.');
    } finally {
      setSubmittingDeliveryProof(false);
    }
  };

  const [uploadingDetailProof, setUploadingDetailProof] = useState<boolean>(false);

  const handleDetailProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrderDetails) return;
    setUploadingDetailProof(true);
    try {
      const uploadRes = await managerApi.uploadDeliveryProof(file);
      const newProofUrl = uploadRes.data.url;
      await managerApi.updateOrderStatus(
        selectedOrderDetails.id,
        selectedOrderDetails.status,
        newProofUrl,
        selectedOrderDetails.shippingNote || undefined,
      );
      toast.success('Đã cập nhật ảnh bằng chứng giao hàng thành công!');
      setSelectedOrderDetails((prev: any) => (prev ? { ...prev, deliveryProofUrl: newProofUrl } : null));
      const res = await managerApi.getOrders();
      setOrders(res.data);
    } catch (err: any) {
      console.error('Failed to upload delivery proof', err);
      toast.error(err.response?.data?.message || 'Lỗi khi tải ảnh bằng chứng giao hàng.');
    } finally {
      setUploadingDetailProof(false);
    }
  };

  const handleRemoveDetailProof = async () => {
    if (!selectedOrderDetails) return;
    setUploadingDetailProof(true);
    try {
      await managerApi.updateOrderStatus(
        selectedOrderDetails.id,
        selectedOrderDetails.status,
        '',
        selectedOrderDetails.shippingNote || undefined,
      );
      toast.success('Đã gỡ bỏ ảnh bằng chứng giao hàng!');
      setSelectedOrderDetails((prev: any) => (prev ? { ...prev, deliveryProofUrl: null } : null));
      const res = await managerApi.getOrders();
      setOrders(res.data);
    } catch (err: any) {
      console.error('Failed to remove delivery proof', err);
      toast.error('Lỗi khi gỡ ảnh bằng chứng giao hàng.');
    } finally {
      setUploadingDetailProof(false);
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

      setSelectedOrderDetails((prev: any) => (prev ? { ...prev, refundProofUrl: url } : null));
      const res = await managerApi.getOrders();
      setOrders(res.data);
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
      setSelectedOrderDetails((prev: any) => (prev ? { ...prev, refundProofUrl: null } : null));
      const res = await managerApi.getOrders();
      setOrders(res.data);
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
      const res = await managerApi.getOrders();
      setOrders(res.data);
      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails(res.data.find((o) => o.id === orderId) || null);
      }
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
      const res = await managerApi.getOrders();
      setOrders(res.data);
      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails(res.data.find((o) => o.id === orderId) || null);
      }
    } catch (error: any) {
      console.error('Failed to reject refund', error);
      toast.error('Lỗi khi từ chối yêu cầu hoàn tiền.');
    } finally {
      setRefundingId(null);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeInfo) return;
    setSubmittingSettings(true);
    try {
      await managerApi.updateStoreSettings(storeInfo);
      setIsSaved(true);
      toast.success('Lưu cấu hình cửa hàng thành công!');
    } catch (error) {
      console.error('Failed to save store settings', error);
      toast.error('Lỗi khi cập nhật cấu hình cửa hàng.');
    } finally {
      setSubmittingSettings(false);
    }
  };

  const resetVariantState = () => {
    setVariantForm({
      name: '',
      sellingPrice: '',
      salePrice: '',
      stock: '',
      imageUrl: '',
    });
    setEditingVariant(null);
    setEditingLocalVariantIndex(null);
    setUploadingVariantImage(false);
  };

  const handleCloseProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setShowVariantsEditor(false);
    resetVariantState();
  };

  const handleCloseVariantsModal = () => {
    setIsVariantModalOpen(false);
    setSelectedProductForVariants(null);
    resetVariantState();
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setSpecList([{ key: '', value: '' }, { key: '', value: '' }]);
    setShowVariantsEditor(false);
    setLocalVariants([]);
    resetVariantState();
    setProductForm({
      name: '',
      category: categories[0]?.slug || 'ACCESSORY',
      targetSpecies: 'ALL',
      sellingPrice: '',
      importPrice: '',
      salePrice: '',
      stock: '',
      brand: '',
      unit: '',
      imageUrl: '',
      description: '',
      isFeatured: false,
      isActive: true,
    });
    setIsProductModalOpen(true);
  };

  const handleEditClick = (product: ManagerProduct) => {
    setEditingProduct(product);
    setShowVariantsEditor(false);
    resetVariantState();
    if (product.variants) {
      setVariants(product.variants);
    } else {
      setVariants([]);
      // Load database variants
      loadVariants(product.id);
    }
    if (product.specifications) {
      try {
        const specs = typeof product.specifications === 'string' 
          ? JSON.parse(product.specifications) 
          : product.specifications;
        const list = Object.entries(specs).map(([key, val]) => ({
          key,
          value: String(val),
        }));
        setSpecList(list.length > 0 ? list : [{ key: '', value: '' }, { key: '', value: '' }]);
      } catch (e) {
        console.error('Failed to parse specifications', e);
        setSpecList([{ key: '', value: '' }, { key: '', value: '' }]);
      }
    } else {
      setSpecList([{ key: '', value: '' }, { key: '', value: '' }]);
    }
    setProductForm({
      name: product.name,
      category: product.category,
      targetSpecies: product.targetSpecies,
      sellingPrice: String(product.sellingPrice),
      importPrice: product.importPrice ? String(product.importPrice) : '',
      salePrice: product.salePrice ? String(product.salePrice) : '',
      stock: product.stock ? String(product.stock) : '',
      brand: product.brand || '',
      unit: product.unit || '',
      imageUrl: product.imageUrl || '',
      description: product.description || '',
      isFeatured: product.isFeatured,
      isActive: product.isActive,
    });
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này khỏi cơ sở dữ liệu?')) return;
    try {
      await managerApi.deleteProduct(id);
      toast.success('Xóa sản phẩm thành công!');
      const res = await managerApi.getProducts();
      setProducts(res.data);
    } catch (error) {
      console.error('Failed to delete product', error);
      toast.error('Lỗi khi xóa sản phẩm.');
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

  const handleOpenVariantsModal = (product: ManagerProduct) => {
    setSelectedProductForVariants(product);
    resetVariantState();
    setIsVariantModalOpen(true);
    loadVariants(product.id);
  };

  const handleEditVariantClick = (variant: any) => {
    setEditingVariant(variant);
    setVariantForm({
      name: variant.name,
      sellingPrice: String(variant.sellingPrice),
      salePrice: variant.salePrice ? String(variant.salePrice) : '',
      stock: String(variant.stock),
      imageUrl: variant.imageUrl || '',
    });
  };

  const handleCancelEditVariant = () => {
    setEditingVariant(null);
    setVariantForm({
      name: '',
      sellingPrice: '',
      salePrice: '',
      stock: '',
      imageUrl: '',
    });
  };

  // Submit Variant Form (for existing product variants)
  const handleVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentProduct = selectedProductForVariants || editingProduct;
    if (!currentProduct) return;

    if (!variantForm.name.trim() || !variantForm.stock) {
      toast.error('Vui lòng nhập tên phân loại và số lượng kho.');
      return;
    }

    const sellingPrice = variantForm.sellingPrice ? Number(variantForm.sellingPrice) : currentProduct.sellingPrice;
    const stock = Number(variantForm.stock);
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      toast.error('Giá bán phải lớn hơn 0.');
      return;
    }
    if (isNaN(stock) || stock < 0) {
      toast.error('Số lượng tồn kho không được âm.');
      return;
    }

    let salePrice: number | null = null;
    if (variantForm.salePrice) {
      salePrice = Number(variantForm.salePrice);
      if (isNaN(salePrice) || salePrice <= 0) {
        toast.error('Giá khuyến mãi phải lớn hơn 0.');
        return;
      }
      if (salePrice > sellingPrice) {
        toast.error('Giá khuyến mãi không được lớn hơn giá bán.');
        return;
      }
    }

    setSubmittingVariant(true);
    try {
      const data = {
        name: variantForm.name.trim(),
        sellingPrice,
        salePrice,
        stock,
        imageUrl: variantForm.imageUrl.trim() || null,
        isActive: true,
      };

      if (editingVariant) {
        await managerApi.updateProductVariant(editingVariant.id, data);
        toast.success('Cập nhật biến thể thành công!');
      } else {
        await managerApi.createProductVariant(currentProduct.id, data);
        toast.success('Thêm biến thể mới thành công!');
      }

      handleCancelEditVariant();
      loadVariants(currentProduct.id);
      const prodRes = await managerApi.getProducts();
      setProducts(prodRes.data);
    } catch (error) {
      console.error('Failed to submit variant form', error);
      toast.error('Lỗi khi lưu biến thể.');
    } finally {
      setSubmittingVariant(false);
    }
  };

  // Delete Variant
  const handleDeleteVariant = async (variantId: string) => {
    const currentProduct = selectedProductForVariants || editingProduct;
    if (!currentProduct) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa biến thể này?')) return;

    try {
      await managerApi.deleteProductVariant(variantId);
      toast.success('Xóa biến thể thành công!');
      loadVariants(currentProduct.id);
      const prodRes = await managerApi.getProducts();
      setProducts(prodRes.data);
    } catch (error) {
      console.error('Failed to delete variant', error);
      toast.error('Lỗi khi xóa biến thể.');
    }
  };

  // Submit Local Variant Form (for new product creation)
  const handleLocalVariantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantForm.name.trim() || !variantForm.stock) {
      toast.error('Vui lòng nhập tên phân loại và số lượng kho.');
      return;
    }

    const sellingPrice = variantForm.sellingPrice 
      ? Number(variantForm.sellingPrice) 
      : Number(productForm.sellingPrice || 0);
    const stock = Number(variantForm.stock);

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      toast.error('Giá bán phải lớn hơn 0 (Hãy điền giá bán sản phẩm chính trước hoặc điền giá biến thể).');
      return;
    }
    if (isNaN(stock) || stock < 0) {
      toast.error('Số lượng tồn kho không được âm.');
      return;
    }

    let salePrice: number | null = null;
    if (variantForm.salePrice) {
      salePrice = Number(variantForm.salePrice);
      if (isNaN(salePrice) || salePrice <= 0) {
        toast.error('Giá khuyến mãi phải lớn hơn 0.');
        return;
      }
      if (salePrice > sellingPrice) {
        toast.error('Giá khuyến mãi không được lớn hơn giá bán.');
        return;
      }
    }

    const newVar = {
      name: variantForm.name.trim(),
      sellingPrice,
      salePrice,
      stock,
      imageUrl: variantForm.imageUrl.trim() || null,
    };

    if (editingLocalVariantIndex !== null) {
      const updated = [...localVariants];
      updated[editingLocalVariantIndex] = newVar;
      setLocalVariants(updated);
      toast.success('Cập nhật biến thể thành công!');
      setEditingLocalVariantIndex(null);
    } else {
      setLocalVariants([...localVariants, newVar]);
      toast.success('Thêm biến thể thành công!');
    }

    setVariantForm({
      name: '',
      sellingPrice: '',
      salePrice: '',
      stock: '',
      imageUrl: '',
    });
  };

  const handleEditLocalVariant = (index: number) => {
    const v = localVariants[index];
    setEditingLocalVariantIndex(index);
    setVariantForm({
      name: v.name,
      sellingPrice: String(v.sellingPrice),
      salePrice: v.salePrice ? String(v.salePrice) : '',
      stock: String(v.stock),
      imageUrl: v.imageUrl || '',
    });
  };

  const handleDeleteLocalVariant = (index: number) => {
    const updated = localVariants.filter((_, idx) => idx !== index);
    setLocalVariants(updated);
    toast.success('Xóa biến thể thành công!');
    if (editingLocalVariantIndex === index) {
      setEditingLocalVariantIndex(null);
      setVariantForm({
        name: '',
        sellingPrice: '',
        salePrice: '',
        stock: '',
        imageUrl: '',
      });
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
        fetchData();
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

  const handleCloseUnitSidebar = () => {
    setIsUnitSidebarClosing(true);
    setTimeout(() => {
      setIsUnitSidebarOpen(false);
      setIsUnitSidebarClosing(false);
      setNewUnitName('');
      setEditingUnitId(null);
    }, 300);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.sellingPrice) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    const sellingPrice = Number(productForm.sellingPrice);
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      toast.error('Giá bán phải lớn hơn 0.');
      return;
    }
    if (productForm.importPrice) {
      const importPrice = Number(productForm.importPrice);
      if (isNaN(importPrice) || importPrice <= 0) {
        toast.error('Giá nhập phải lớn hơn 0.');
        return;
      }
      if (importPrice > sellingPrice) {
        toast.error('Giá nhập không được lớn hơn giá bán.');
        return;
      }
    }
    if (productForm.salePrice) {
      const salePrice = Number(productForm.salePrice);
      if (isNaN(salePrice) || salePrice <= 0) {
        toast.error('Giá khuyến mãi phải lớn hơn 0.');
        return;
      }
      if (salePrice > sellingPrice) {
        toast.error('Giá khuyến mãi không được lớn hơn giá bán.');
        return;
      }
    }
    if (productForm.stock) {
      const stock = Number(productForm.stock);
      if (isNaN(stock) || stock < 0) {
        toast.error('Số lượng tồn kho không được âm.');
        return;
      }
    }
    setSubmittingProduct(true);
    try {
      const specifications: Record<string, string> = {};
      specList.forEach((spec) => {
        if (spec.key.trim() && spec.value.trim()) {
          specifications[spec.key.trim()] = spec.value.trim();
        }
      });

      const data: Partial<ManagerProduct> & { variants?: any[] } = {
        name: productForm.name.trim(),
        category: productForm.category,
        targetSpecies: productForm.targetSpecies,
        sellingPrice: Number(productForm.sellingPrice),
        importPrice: productForm.importPrice ? Number(productForm.importPrice) : null,
        salePrice: productForm.salePrice ? Number(productForm.salePrice) : null,
        stock: productForm.stock ? Number(productForm.stock) : null,
        brand: productForm.brand.trim() || undefined,
        unit: productForm.unit.trim() || undefined,
        imageUrl: productForm.imageUrl.trim() || undefined,
        description: productForm.description.trim() || undefined,
        isFeatured: productForm.isFeatured,
        isActive: productForm.isActive,
        specifications: Object.keys(specifications).length > 0 ? specifications : null,
        variants: localVariants.length > 0 ? localVariants : undefined,
      };

      if (editingProduct) {
        await managerApi.updateProduct(editingProduct.id, data);
        toast.success('Cập nhật sản phẩm thành công!');
      } else {
        await managerApi.createProduct(data);
        toast.success('Thêm sản phẩm mới thành công!');
      }
      setIsProductModalOpen(false);
      const res = await managerApi.getProducts();
      setProducts(res.data);
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
              <p className="text-sm font-semibold text-[var(--text-muted)]">Quản lý kho hàng và trạng thái bán hàng thực tế.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsUnitSidebarOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-[var(--primary-color)] text-[var(--primary-color)] bg-white px-4 py-2.5 font-bold shadow-sm transition hover:bg-[var(--primary-color)]/5 cursor-pointer text-xs"
              >
                <Plus className="size-4" />
                Quản lý đơn vị tính
              </button>
              <button
                type="button"
                onClick={() => setIsCategorySidebarOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-[var(--primary-color)] text-[var(--primary-color)] bg-white px-4 py-2.5 font-bold shadow-sm transition hover:bg-[var(--primary-color)]/5 cursor-pointer text-xs"
              >
                <Plus className="size-4" />
                Thêm danh mục mới
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
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-[#EFEAE2] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EFEAE2] bg-[#F9F8F6] text-xs font-black uppercase text-[#8A8980]">
                    <th className="px-6 py-4">Mã SP</th>
                    <th className="px-6 py-4">Tên sản phẩm</th>
                    <th className="px-6 py-4">Danh mục</th>
                    <th className="px-6 py-4 text-right">Giá bán</th>
                    <th className="px-6 py-4 text-right">Giá nhập</th>
                    <th className="px-6 py-4 text-right">Lợi nhuận đơn vị</th>
                    <th className="px-6 py-4 text-center">Tồn kho</th>
                    <th className="px-6 py-4 text-center">Đã bán</th>
                    <th className="px-6 py-4 text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2]">
                  {paginatedProducts.length > 0 ? (
                    paginatedProducts.map((p) => {
                      const stockVal = p.stock ?? 0;
                      const statusStr = stockVal === 0 ? 'Hết hàng' : stockVal <= 10 ? 'Sắp hết hàng' : 'Còn hàng';
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleEditClick(p)}
                          className="transition hover:bg-orange-50/40 cursor-pointer group"
                        >
                          <td className="px-6 py-4 font-mono font-black text-xs text-[#5C5B52]">{p.id.slice(0, 8)}...</td>
                          <td className="px-6 py-4 font-bold text-[var(--text-main)] group-hover:text-[var(--primary-color)] transition-colors">
                            <div className="flex items-center gap-3">
                              {p.imageUrl && (
                                <img src={p.imageUrl} alt={p.name} className="size-8 object-cover rounded border" />
                              )}
                              <span>{p.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#5C5B52]">{dynamicCategoryMap[p.category] || CATEGORY_MAP[p.category] || p.category}</td>
                          <td className="px-6 py-4 text-right font-black text-[var(--primary-color)]">{currency.format(p.salePrice ?? p.sellingPrice)}</td>
                          <td className="px-6 py-4 text-right font-semibold text-[#5C5B52]">{p.importPrice ? currency.format(p.importPrice) : '-'}</td>
                          <td className="px-6 py-4 text-right">
                            {(() => {
                              const currentPrice = p.salePrice ?? p.sellingPrice;
                              const unitProfit = p.importPrice 
                                ? currentPrice - p.importPrice 
                                : currentPrice * 0.5;
                              const margin = ((unitProfit / currentPrice) * 100).toFixed(0) + '%';
                              return (
                                <div>
                                  <div className="font-bold text-green-600">{currency.format(unitProfit)}</div>
                                  <div className="text-[10px] text-gray-400 font-bold">Biên: {margin}</div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-center font-bold">{stockVal}</td>
                          <td className="px-6 py-4 text-center font-bold text-[#0F766E]">{(p as any).sales ?? 0}</td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-black',
                                statusStr === 'Còn hàng' && 'bg-green-50 text-green-700',
                                statusStr === 'Sắp hết hàng' && 'bg-amber-50 text-amber-700',
                                statusStr === 'Hết hàng' && 'bg-red-50 text-red-700',
                              )}
                            >
                              {statusStr}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewFeedback(p);
                                }}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                title="Xem đánh giá & feedback"
                              >
                                <MessageSquare className="size-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(p);
                                }}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-primary hover:bg-orange-50 transition cursor-pointer"
                                title="Sửa sản phẩm"
                              >
                                <Edit2 className="size-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProduct(p.id);
                                }}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                title="Xóa sản phẩm"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400">Không tìm thấy sản phẩm phù hợp.</td>
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

          {/* Product Modal */}
          {isProductModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
              onClick={handleCloseProductModal}
            >
              <div
                className="w-full max-h-[92vh] flex flex-col rounded-3xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-4 relative transition-all duration-300 animate-scaleIn max-w-5xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Sticky Header with Title and Fixed Close Button */}
                <div className="sticky top-0 z-50 flex items-center justify-between pb-3 border-b bg-white shrink-0">
                  <h3 className="text-lg font-black text-[var(--text-main)]">
                    {editingProduct ? 'Sửa thông tin sản phẩm' : 'Thêm sản phẩm mới'}
                  </h3>
                  <button
                    type="button"
                    onClick={handleCloseProductModal}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition cursor-pointer shrink-0"
                    title="Đóng modal"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 pr-1 grid gap-6 grid-cols-1 md:grid-cols-2">
                  {/* Left Column: Product Form */}
                  <form onSubmit={handleProductSubmit} className="space-y-4 text-xs font-semibold">
                    <div>
                      <label className="block text-xs font-bold mb-1">Tên sản phẩm *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Thức ăn hạt cho mèo lớn vị cá ngừ"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1">Danh mục *</label>
                        <select
                          required
                          value={productForm.category}
                          onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                          className="w-full h-[46px] rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none text-xs font-semibold"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.slug}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">Loài mục tiêu *</label>
                        <select
                          required
                          value={productForm.targetSpecies}
                          onChange={(e) => setProductForm({ ...productForm, targetSpecies: e.target.value })}
                          className="w-full h-[46px] rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none text-xs font-semibold"
                        >
                          <option value="ALL">🐾 Tất cả loài</option>
                          <option value="DOG">🐕 Chó</option>
                          <option value="CAT">🐈 Mèo</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1">Giá bán lẻ (VND) *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="Ví dụ: 120000"
                          value={productForm.sellingPrice}
                          onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                          className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">Giá nhập (VND)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Ví dụ: 90000"
                          value={productForm.importPrice}
                          onChange={(e) => setProductForm({ ...productForm, importPrice: e.target.value })}
                          className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">Số lượng kho *</label>
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="Ví dụ: 100"
                          value={productForm.stock}
                          onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                          className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1">Giá khuyến mãi (VND)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Ví dụ: 99000"
                          value={productForm.salePrice}
                          onChange={(e) => setProductForm({ ...productForm, salePrice: e.target.value })}
                          className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-1">Thương hiệu</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Royal Canin"
                          value={productForm.brand}
                          onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                          className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">Đơn vị tính</label>
                      <select
                        value={productForm.unit}
                        onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                        className="w-full h-[46px] rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none text-xs font-semibold"
                      >
                        <option value="">Chưa chọn đơn vị</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">Ảnh chính sản phẩm *</label>
                      
                      {/* Live Image Preview Box */}
                      {productForm.imageUrl && (
                        <div className="relative aspect-video w-full max-w-[200px] overflow-hidden rounded-2xl border border-[#EFEAE2] bg-[#FAF9F7] mb-2.5 shadow-sm group">
                          <img
                            src={productForm.imageUrl}
                            alt="Product Main Preview"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setProductForm({ ...productForm, imageUrl: '' })}
                            className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition shadow-md cursor-pointer"
                            title="Xóa ảnh"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Link URL ảnh hoặc tải file..."
                          value={productForm.imageUrl}
                          onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                          className="flex-1 rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById('integrated-product-image-file')?.click()}
                          disabled={uploadingImage}
                          className="px-4 rounded-xl border border-[#0F766E] font-bold text-[#0F766E] hover:bg-[#0F766E]/5 transition flex items-center justify-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer text-xs"
                        >
                          {uploadingImage ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <>
                              <Upload className="size-4" />
                              Tải file
                            </>
                          )}
                        </button>
                        <input
                          id="integrated-product-image-file"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadingImage(true);
                              try {
                                const res = await uploadImages([file], 'product');
                                setProductForm({ ...productForm, imageUrl: res[0].url });
                                toast.success('Tải ảnh sản phẩm thành công!');
                              } catch (err: any) {
                                toast.error(err.message || 'Lỗi khi tải ảnh lên.');
                              } finally {
                                setUploadingImage(false);
                              }
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold">Thông số kỹ thuật</label>
                        <button
                          type="button"
                          onClick={() => setSpecList([...specList, { key: '', value: '' }])}
                          className="text-[11px] font-bold text-[#0F766E] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="size-3" /> Thêm thông số
                        </button>
                      </div>
                      <div className="space-y-2">
                        {specList.map((spec, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Thuộc tính (Hạn dùng, Xuất xứ...)"
                              value={spec.key}
                              onChange={(e) => {
                                const newList = [...specList];
                                newList[idx].key = e.target.value;
                                setSpecList(newList);
                              }}
                              className="flex-1 rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3 py-1.5 focus:bg-white focus:outline-none text-xs"
                            />
                            <input
                              type="text"
                              placeholder="Giá trị (12 tháng, Pháp...)"
                              value={spec.value}
                              onChange={(e) => {
                                const newList = [...specList];
                                newList[idx].value = e.target.value;
                                setSpecList(newList);
                              }}
                              className="flex-1 rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3 py-1.5 focus:bg-white focus:outline-none text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newList = specList.filter((_, i) => i !== idx);
                                setSpecList(newList);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 transition"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">Mô tả sản phẩm</label>
                      <textarea
                        rows={3}
                        placeholder="Nhập mô tả chi tiết sản phẩm..."
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={productForm.isFeatured}
                          onChange={(e) => setProductForm({ ...productForm, isFeatured: e.target.checked })}
                          className="accent-[var(--primary-color)]"
                        />
                        Nổi bật
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={productForm.isActive}
                          onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                          className="accent-[var(--primary-color)]"
                        />
                        Mở bán
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t">
                      <button
                        type="button"
                        onClick={handleCloseProductModal}
                        className="rounded-xl border px-5 py-2.5 font-bold hover:bg-gray-50 transition cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={submittingProduct}
                        className="rounded-xl bg-[#0F766E] px-5 py-2.5 font-bold text-white hover:bg-[#115E59] transition flex items-center gap-2"
                      >
                        {submittingProduct && <Loader2 className="size-4 animate-spin text-white" />}
                        Xác nhận
                      </button>
                    </div>
                  </form>

                  {/* Right Column: Variant Management Panel (Always Open) */}
                  <div className="border-t md:border-t-0 md:border-l border-[#EFEAE2] pt-6 md:pt-0 md:pl-6 space-y-4 flex flex-col h-[550px] overflow-y-auto">
                    <h4 className="text-sm font-black text-[var(--text-main)] pb-2 border-b">
                      Cấu hình phân loại / biến thể
                    </h4>

                      {/* Mini Variant Form */}
                      <div className="p-3 border border-[#EFEAE2] rounded-2xl bg-[#F9F8F6]/50 space-y-3">
                        <p className="font-bold text-[10px] uppercase tracking-wider text-gray-500">
                          {editingVariant || editingLocalVariantIndex !== null ? 'Chỉnh sửa biến thể' : 'Thêm biến thể mới'}
                        </p>
                        
                        <div>
                          <label className="block text-[10px] font-bold mb-1">Tên phân loại *</label>
                          <input
                            type="text"
                            placeholder="Ví dụ: Size S, Màu Đỏ, Hộp 500g"
                            value={variantForm.name}
                            onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                            className="w-full rounded-xl border border-[#EFEAE2] bg-white px-3 py-2 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold mb-1">Giá bán lẻ (Để trống = Giá chính)</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="VND"
                              value={variantForm.sellingPrice}
                              onChange={(e) => setVariantForm({ ...variantForm, sellingPrice: e.target.value })}
                              className="w-full rounded-xl border border-[#EFEAE2] bg-white px-3 py-2 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold mb-1">Giá khuyến mãi</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="VND"
                              value={variantForm.salePrice}
                              onChange={(e) => setVariantForm({ ...variantForm, salePrice: e.target.value })}
                              className="w-full rounded-xl border border-[#EFEAE2] bg-white px-3 py-2 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold mb-1">Số lượng kho *</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="Ví dụ: 10"
                              value={variantForm.stock}
                              onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })}
                              className="w-full rounded-xl border border-[#EFEAE2] bg-white px-3 py-2 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Separate block for variant image with live preview */}
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold mb-1">Ảnh biến thể (Tải file hoặc điền URL)</label>
                          {variantForm.imageUrl && (
                            <div className="relative aspect-video w-full max-w-[120px] overflow-hidden rounded-xl border border-[#EFEAE2] bg-gray-50 mb-2">
                              <img
                                src={variantForm.imageUrl}
                                alt="Variant Preview"
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => setVariantForm({ ...variantForm, imageUrl: '' })}
                                className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                                aria-label="Xóa ảnh"
                              >
                                <X className="size-3" />
                              </button>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              id="integrated-variant-image-file"
                              type="file"
                              accept="image/*"
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
                            <input
                              type="text"
                              placeholder="URL ảnh hoặc tải file..."
                              value={variantForm.imageUrl}
                              onChange={(e) => setVariantForm({ ...variantForm, imageUrl: e.target.value })}
                              className="flex-1 rounded-xl border border-[#EFEAE2] bg-white px-3 py-2 focus:outline-none text-[11px]"
                            />
                            <button
                              type="button"
                              disabled={uploadingVariantImage}
                              onClick={() => document.getElementById('integrated-variant-image-file')?.click()}
                              className="px-3 rounded-xl border border-[#0F766E] font-bold text-[#0F766E] hover:bg-[#0F766E]/5 transition flex items-center justify-center text-[10px] shrink-0 disabled:opacity-50"
                            >
                              {uploadingVariantImage ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                'Tải ảnh'
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1.5">
                          {(editingLocalVariantIndex !== null || editingVariant) && (
                            <button
                              type="button"
                              onClick={editingProduct ? handleCancelEditVariant : () => {
                                setEditingLocalVariantIndex(null);
                                setVariantForm({ name: '', sellingPrice: '', salePrice: '', stock: '', imageUrl: '' });
                              }}
                              className="rounded-xl border px-3 py-1.5 font-bold hover:bg-gray-50 transition text-[10px]"
                            >
                              Hủy bỏ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={editingProduct ? handleVariantSubmit : handleLocalVariantSubmit}
                            className="rounded-xl bg-[#0F766E] px-4 py-1.5 font-bold text-white hover:bg-[#115E59] transition text-[10px]"
                          >
                            {editingVariant || editingLocalVariantIndex !== null ? 'Cập nhật' : 'Thêm mới'}
                          </button>
                        </div>
                      </div>

                      {/* Variants List */}
                      <div className="flex-1 space-y-2">
                        <p className="font-bold text-[10px] uppercase tracking-wider text-gray-500">
                          Danh sách biến thể ({editingProduct ? variants.length : localVariants.length})
                        </p>
                        {loadingVariants ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="size-5 animate-spin text-[var(--primary-color)]" />
                          </div>
                        ) : (editingProduct ? variants : localVariants).length === 0 ? (
                          <p className="text-[10px] text-gray-400 italic py-2">Chưa cấu hình biến thể nào. Sản phẩm sẽ sử dụng phân loại mặc định chính.</p>
                        ) : (
                          (editingProduct ? variants : localVariants).map((v: any, index: number) => (
                            <div key={v.id || index} className="flex items-center justify-between p-2 rounded-xl border border-[#EFEAE2] bg-white text-[11px]">
                              <div className="flex items-center gap-2">
                                {v.imageUrl && (
                                  <img src={v.imageUrl} alt="" className="size-8 rounded-lg object-cover border border-[#EFEAE2]" />
                                )}
                                <div>
                                  <p className="font-bold text-[var(--text-main)]">{v.name}</p>
                                  <p className="text-gray-400 text-[10px]">
                                    Giá: {v.sellingPrice ? Number(v.sellingPrice).toLocaleString('vi-VN') : 'Mặc định'}đ | Kho: {v.stock}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => editingProduct ? handleEditVariantClick(v) : handleEditLocalVariant(index)}
                                  className="p-1 text-gray-500 hover:text-primary transition cursor-pointer"
                                >
                                  <Edit2 className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => editingProduct ? handleDeleteVariant(v.id) : handleDeleteLocalVariant(index)}
                                  className="p-1 text-gray-500 hover:text-red-500 transition cursor-pointer"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                </div>
              </div>
            </div>
          )}

          {/* Unit Sidebar */}
          {isUnitSidebarOpen && (
            <div className="fixed inset-0 z-50 overflow-hidden font-semibold text-xs">
              {/* Backdrop Overlay */}
              <div
                className={cn(
                  "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
                  isUnitSidebarClosing ? "opacity-0" : "opacity-100"
                )}
                onClick={handleCloseUnitSidebar}
              />

              {/* Sidebar Panel */}
              <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex sm:pl-16">
                <div
                  className={cn(
                    "w-screen max-w-xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform relative",
                    isUnitSidebarClosing ? "translate-x-full" : "translate-x-0 animate-in slide-in-from-right"
                  )}
                >
                  {/* Floating Collapse Pull-tab */}
                  <button
                    type="button"
                    onClick={handleCloseUnitSidebar}
                    className="absolute top-1/2 -left-10 -translate-y-1/2 w-10 h-20 bg-white border border-r-0 border-[#EFEAE2] shadow-[-6px_0_15px_rgba(0,0,0,0.06)] rounded-l-2xl flex items-center justify-center text-gray-400 hover:text-[var(--primary-color)] hover:bg-gray-50 transition active:scale-95 cursor-pointer z-50 group"
                    title="Thu gọn Sidebar"
                  >
                    <ChevronsRight className="size-5 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {/* Header */}
                  <div className="px-6 py-5 border-b border-[#EFEAE2] flex items-center justify-between bg-[#F9F8F6]">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-[var(--primary-color)]/10 flex items-center justify-center border border-[var(--primary-color)]/20 text-[var(--primary-color)]">
                        <Award className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-[var(--text-main)]">Quản lý Đơn vị tính</h3>
                        <p className="text-[10px] text-[var(--text-muted)] font-semibold mt-0.5">
                          Tạo hoặc cập nhật các đơn vị tính sản phẩm (bao, hộp, kg, cái...).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Units Table */}
                    <div className="rounded-2xl border border-[#EFEAE2] overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left text-xs font-semibold">
                        <thead>
                          <tr className="border-b border-[#EFEAE2] bg-[#FAF9F7] text-gray-500 font-extrabold">
                            <th className="px-4 py-3">Tên đơn vị tính</th>
                            <th className="px-4 py-3 text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFEAE2]">
                          {units.map((unit) => {
                            const isEditing = editingUnitId === unit.id;
                            return (
                              <tr key={unit.id} className="hover:bg-gray-50/50 transition">
                                <td className="px-4 py-3 font-bold">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editingUnitName}
                                      onChange={(e) => setEditingUnitName(e.target.value)}
                                      className="rounded-xl border border-[#EFEAE2] bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] w-full text-xs font-bold"
                                    />
                                  ) : (
                                    unit.name
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {isEditing ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!editingUnitName.trim()) return;
                                          try {
                                            await managerApi.updateProductUnit(unit.id, { name: editingUnitName });
                                            toast.success('Cập nhật đơn vị tính thành công!');
                                            setEditingUnitId(null);
                                            // Refresh units list
                                            const res = await managerApi.getProductUnits();
                                            setUnits(res.data);
                                          } catch (err: any) {
                                            toast.error(err.response?.data?.message || 'Lỗi khi cập nhật đơn vị tính.');
                                          }
                                        }}
                                        className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition cursor-pointer"
                                        title="Lưu"
                                      >
                                        <Check className="size-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingUnitId(null)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition cursor-pointer"
                                        title="Hủy"
                                      >
                                        <X className="size-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingUnitId(unit.id);
                                          setEditingUnitName(unit.name);
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
                                            title: 'Xóa đơn vị tính',
                                            message: `Bạn có chắc chắn muốn xóa đơn vị tính "${unit.name}"? Hành động này không thể hoàn tác.`,
                                            confirmText: 'Xóa',
                                            isDanger: true,
                                            loading: false,
                                            onConfirm: async () => {
                                              setConfirmState((prev) => ({ ...prev, loading: true }));
                                              try {
                                                await managerApi.deleteProductUnit(unit.id);
                                                toast.success('Xóa đơn vị tính thành công!');
                                                const res = await managerApi.getProductUnits();
                                                setUnits(res.data);
                                              } catch (err: any) {
                                                toast.error(err.response?.data?.message || 'Không thể xóa đơn vị tính.');
                                              } finally {
                                                setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false });
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
                          {units.length === 0 && (
                            <tr>
                              <td colSpan={2} className="px-4 py-8 text-center text-gray-400">
                                Chưa có đơn vị tính nào được thêm.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Add New Unit Section */}
                    <div className="rounded-2xl border border-[#EFEAE2] p-5 space-y-3 bg-[#FAF9F7]">
                      <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Thêm đơn vị tính mới</h4>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!newUnitName.trim()) return;
                          try {
                            await managerApi.createProductUnit({ name: newUnitName });
                            toast.success('Thêm đơn vị tính mới thành công!');
                            setNewUnitName('');
                            const res = await managerApi.getProductUnits();
                            setUnits(res.data);
                          } catch (err: any) {
                            toast.error(err.response?.data?.message || 'Lỗi khi tạo đơn vị tính.');
                          }
                        }}
                        className="flex gap-2 text-xs font-semibold"
                      >
                        <input
                          type="text"
                          required
                          placeholder="Ví dụ: Lon, Bao 5kg, Tuýp"
                          value={newUnitName}
                          onChange={(e) => setNewUnitName(e.target.value)}
                          className="flex-1 rounded-xl border border-[#EFEAE2] bg-white px-3.5 py-2.5 focus:outline-none text-xs focus:ring-1 focus:ring-[var(--primary-color)]"
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
                                                const catRes = await productsApi.getCategories();
                                                setCategories(catRes.data);
                                              } catch (err: any) {
                                                console.error(err);
                                                toast.error(err.response?.data?.message || 'Lỗi khi cập nhật danh mục.');
                                              } finally {
                                                setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false });
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
                                                const catRes = await productsApi.getCategories();
                                                setCategories(catRes.data);
                                              } catch (err: any) {
                                                console.error(err);
                                                toast.error(err.response?.data?.message || 'Không thể xóa danh mục.');
                                              } finally {
                                                setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false });
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
                                const catRes = await productsApi.getCategories();
                                setCategories(catRes.data);
                              } catch (error: any) {
                                console.error(error);
                                toast.error(error.response?.data?.message || 'Lỗi khi tạo danh mục mới.');
                              } finally {
                                setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false });
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
                                      <div className="flex items-center text-orange-400 text-[10px] mt-0.5">
                                        {"★".repeat(item.rating)}
                                        {"☆".repeat(5 - item.rating)}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-black text-gray-400">
                                    {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-gray-700 pl-12 leading-relaxed">
                                  {item.comment ? (
                                    item.comment
                                  ) : (
                                    <span className="italic text-gray-400">Khách hàng không viết nhận xét bằng văn bản.</span>
                                  )}
                                </p>
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
                    <span className="text-[10px] bg-[var(--primary-color)]/10 text-[var(--primary-color)] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                      Phân loại biến thể
                    </span>
                    <h3 className="text-lg font-black text-[var(--text-main)] truncate max-w-md">
                      Quản lý biến thể: {selectedProductForVariants.name}
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
                      {editingVariant ? 'Chỉnh sửa biến thể' : 'Thêm biến thể mới'}
                    </p>

                    <div>
                      <label className="block text-[11px] font-bold mb-1">Tên phân loại *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Size S - Màu Đỏ, Hộp 500g"
                        value={variantForm.name}
                        onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold mb-1">Giá bán lẻ (Để trống = Giá chính)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="VND"
                          value={variantForm.sellingPrice}
                          onChange={(e) => setVariantForm({ ...variantForm, sellingPrice: e.target.value })}
                          className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold mb-1">Giá khuyến mãi</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="VND"
                          value={variantForm.salePrice}
                          onChange={(e) => setVariantForm({ ...variantForm, salePrice: e.target.value })}
                          className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold mb-1">Số lượng kho *</label>
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="Ví dụ: 10"
                          value={variantForm.stock}
                          onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })}
                          className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Separate line for Image */}
                    <div>
                      <label className="block text-[11px] font-bold mb-1">Ảnh biến thể (Tải file hoặc điền URL)</label>
                      {variantForm.imageUrl && (
                        <div className="relative mb-2 aspect-video w-full max-w-[150px] overflow-hidden rounded-xl border border-[#EFEAE2] bg-gray-50">
                          <img
                            src={variantForm.imageUrl}
                            alt="Variant Preview"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setVariantForm({ ...variantForm, imageUrl: '' })}
                            className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                            aria-label="Xóa ảnh"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          id="standalone-variant-image-file"
                          type="file"
                          accept="image/*"
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
                        <input
                          type="text"
                          placeholder="URL ảnh..."
                          value={variantForm.imageUrl}
                          onChange={(e) => setVariantForm({ ...variantForm, imageUrl: e.target.value })}
                          className="flex-1 rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2 focus:bg-white focus:outline-none text-[11px]"
                        />
                        <button
                          type="button"
                          disabled={uploadingVariantImage}
                          onClick={() => document.getElementById('standalone-variant-image-file')?.click()}
                          className="px-3 rounded-xl border border-[#0F766E] font-bold text-[#0F766E] hover:bg-[#0F766E]/5 transition flex items-center justify-center text-[10px] shrink-0 disabled:opacity-50"
                        >
                          {uploadingVariantImage ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            'Tải ảnh'
                          )}
                        </button>
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

                  {/* Right panel: Variants List */}
                  <div className="flex flex-col">
                    <p className="font-bold text-[11px] uppercase tracking-wider text-gray-500 pb-1 border-b mb-3">
                      Danh sách các biến thể ({variants.length})
                    </p>
                    {loadingVariants ? (
                      <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-[var(--primary-color)]" />
                      </div>
                    ) : variants.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center text-gray-400 italic text-xs">
                        Sản phẩm này chưa cấu hình biến thể nào.
                      </div>
                    ) : (
                      <div className="space-y-2.5 pr-1">
                        {variants.map((v) => (
                          <div key={v.id} className="flex items-center justify-between p-3 rounded-xl border border-[#EFEAE2] bg-[#F9F8F6]/30 hover:bg-[#F9F8F6]/60 transition text-xs">
                            <div className="flex items-center gap-3">
                              {v.imageUrl && (
                                <img src={v.imageUrl} alt="" className="size-10 rounded-lg object-cover border border-[#EFEAE2] shadow-sm" />
                              )}
                              <div>
                                <p className="font-bold text-[var(--text-main)] text-sm">{v.name}</p>
                                <p className="text-gray-500 text-[11px] mt-0.5">
                                  Giá bán lẻ: {v.sellingPrice ? v.sellingPrice.toLocaleString('vi-VN') : 'Mặc định'}đ 
                                  {v.salePrice && ` | Khuyến mãi: ${v.salePrice.toLocaleString('vi-VN')}đ`}
                                  {` | Kho: ${v.stock}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditVariantClick(v)}
                                className="p-1.5 text-gray-500 hover:text-primary transition hover:bg-white rounded-lg border border-transparent hover:border-[#EFEAE2]"
                              >
                                <Edit2 className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVariant(v.id)}
                                className="p-1.5 text-gray-500 hover:text-red-500 transition hover:bg-white rounded-lg border border-transparent hover:border-[#EFEAE2]"
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
                  <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 space-y-2">
                    <p className="text-xs font-semibold text-orange-800 leading-relaxed">
                      <strong>Cơ chế nhập hàng:</strong> Hệ thống cộng dồn tồn kho. Tự động tạo sản phẩm mới + tự tạo danh mục và đơn vị nếu chưa có. Để nạp kèm ảnh tự động, chọn tab **Nhập trọn thư mục** và chọn thư mục chứa file Excel + các thư mục con đặt tên theo ID sản phẩm chứa ảnh của sản phẩm đó.
                    </p>
                    <a
                      href="/import_template.xlsx"
                      download="import_products_template.xlsx"
                      className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--primary-color)] hover:underline"
                    >
                      📥 Tải file Excel mẫu (.xlsx) tại đây
                    </a>
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
      const showBatchCheckboxes = filterStatus !== 'ALL' && filterStatus !== 'DELIVERED';
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
                      onClick={() => handleBatchStatusChange('PACKED', 'Đã gói hàng')}
                      className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {submittingBatch ? <Loader2 className="size-3 animate-spin text-white" /> : '📦'}
                      Đánh dấu Đã gói hàng ({selectedOrderIds.length})
                    </button>
                  )}

                  {filterStatus === 'PACKED' && (
                    <button
                      type="button"
                      disabled={submittingBatch}
                      onClick={() => handleBatchStatusChange('SHIPPED', 'Đã gửi vận chuyển')}
                      className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {submittingBatch ? <Loader2 className="size-3 animate-spin text-white" /> : '🚚'}
                      Gửi vận chuyển tất cả ({selectedOrderIds.length})
                    </button>
                  )}

                  {filterStatus === 'SHIPPED' && (
                    <button
                      type="button"
                      disabled={submittingBatch}
                      onClick={() => handleBatchStatusChange('DELIVERED', 'Đã nhận hàng')}
                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {submittingBatch ? <Loader2 className="size-3 animate-spin text-white" /> : '✅'}
                      Đánh dấu Đã nhận hàng ({selectedOrderIds.length})
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
                            {shippingInfo.name}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-[#5C5B52]">
                            {shippingInfo.phone}
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
                            {new Date(o.createdAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-6 py-4 text-right font-black text-[var(--primary-color)]">{currency.format(o.totalAmount)}</td>
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
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
                            ) : o.status === 'PENDING' || o.status === 'PROCESSING' ? (
                              <button
                                type="button"
                                onClick={() => handleOrderStatusChange(o.id, 'PACKED')}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-extrabold text-white bg-amber-600 rounded-xl hover:bg-amber-700 shadow-md transition active:scale-95 cursor-pointer"
                              >
                                📦 Đã gói hàng
                              </button>
                            ) : o.status === 'PACKED' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setShipModalOrder(o);
                                  setShippingNoteInput(o.shippingNote || '');
                                }}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-extrabold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md transition active:scale-95 cursor-pointer"
                              >
                                🚚 Gửi vận chuyển
                              </button>
                            ) : o.status === 'SHIPPED' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeliveryModalOrder(o);
                                  setDeliveryNoteInput(o.shippingNote || '');
                                }}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-extrabold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-md transition active:scale-95 cursor-pointer"
                              >
                                ✅ Đã nhận hàng
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm">
                                🎉 Đã nhận hàng
                              </span>
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
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="size-5" />
                </button>
                
                <h3 className="text-lg font-black text-[var(--text-main)] pb-2 border-b">
                  Chi tiết đơn hàng: {selectedOrderDetails.id}
                </h3>
                
                {/* Delivery Info */}
                {(() => {
                  const info = parseShippingAddress(selectedOrderDetails.shippingAddress);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                      <div className="space-y-1 bg-[#F9F8F6] p-3 rounded-xl border border-[#EFEAE2]">
                        <p className="font-black text-[#8A8980] uppercase tracking-wider text-[10px]">Thông tin người nhận</p>
                        <p className="text-sm font-bold text-[var(--text-main)]">{info.name}</p>
                        <p className="text-[var(--text-muted)] mt-0.5">SĐT: {info.phone}</p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{selectedOrderDetails.user?.email}</p>
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
                    <p className="font-black text-[#8A8980] uppercase tracking-wider text-[10px]">Tiến trình đơn hàng</p>
                    <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-extrabold">
                      {(() => {
                        const statusOrder = ['PENDING', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'];
                        let currentIdx = statusOrder.indexOf(selectedOrderDetails.status);

                        const steps = [
                          { label: 'Chờ xác nhận', icon: '1' },
                          { label: 'Đang xử lý', icon: '2' },
                          { label: 'Đã gói hàng', icon: '3' },
                          { label: 'Đã gửi VC', icon: '4' },
                          { label: 'Đã nhận hàng', icon: '5' },
                        ];

                        return steps.map((step, idx) => {
                          const isDone = idx <= currentIdx;
                          const isCurrent = idx === currentIdx;
                          return (
                            <div
                              key={idx}
                              className={cn(
                                'flex flex-col items-center gap-1 p-1 rounded-lg border transition',
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

                {/* Delivery Proof Image Section - Only for DELIVERED status */}
                {selectedOrderDetails.status === 'DELIVERED' && (
                  <div className="space-y-2 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 text-xs shadow-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-black text-emerald-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        Ảnh bằng chứng giao hàng (Shipper chụp)
                      </p>
                      <label className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-200/80 hover:bg-emerald-300 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1">
                        {uploadingDetailProof ? (
                          <Loader2 className="size-3 animate-spin text-emerald-800" />
                        ) : (
                          <Upload className="size-3 text-emerald-800" />
                        )}
                        {selectedOrderDetails.deliveryProofUrl ? 'Cập nhật / Thay ảnh' : 'Tải ảnh lên'}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingDetailProof}
                          onChange={handleDetailProofUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {selectedOrderDetails.deliveryProofUrl ? (
                      <div className="relative mt-1 group">
                        <a href={selectedOrderDetails.deliveryProofUrl} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={selectedOrderDetails.deliveryProofUrl}
                            alt="Bằng chứng giao hàng"
                            className="w-full max-h-52 object-cover rounded-lg border border-emerald-300 hover:opacity-95 transition cursor-pointer shadow-xs"
                          />
                        </a>
                        <button
                          type="button"
                          onClick={handleRemoveDetailProof}
                          disabled={uploadingDetailProof}
                          className="absolute top-2 right-2 size-7 rounded-full bg-red-600/90 text-white flex items-center justify-center hover:bg-red-700 shadow-md transition cursor-pointer"
                          title="Bỏ / Xóa ảnh bằng chứng giao hàng"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-4 border border-dashed border-emerald-300/80 bg-white/60 rounded-lg text-emerald-700 font-medium text-xs">
                        Chưa có ảnh bằng chứng giao hàng. Bấm "Tải ảnh lên" ở trên để lưu ảnh do Shipper chụp.
                      </div>
                    )}
                  </div>
                )}

                {selectedOrderDetails.shippingNote && (
                  <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs">
                    <p className="font-black text-blue-800 uppercase tracking-wider text-[10px]">Ghi chú vận chuyển</p>
                    <p className="text-xs font-bold text-blue-900 mt-0.5">{selectedOrderDetails.shippingNote}</p>
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
                      selectedOrderDetails.status === 'PROCESSING' && 'bg-teal-50 text-teal-700 border border-teal-200',
                      selectedOrderDetails.status === 'PACKED' && 'bg-amber-50 text-amber-700',
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

          {/* Modal Gửi bên vận chuyển */}
          {shipModalOrder && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => setShipModalOrder(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-4 animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
                    🚚 Gửi bên vận chuyển
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShipModalOrder(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleConfirmShip} className="space-y-4 text-xs font-semibold">
                  <p className="text-gray-600">
                    Chuyển trạng thái đơn hàng <strong className="font-mono text-black">{shipModalOrder.id.slice(0, 12)}...</strong> sang <strong>"Đã gửi bên vận chuyển"</strong>.
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8A8980] mb-1">
                      Ghi chú Shipper / Đơn vị giao hàng (Không bắt buộc)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Shipper Zalo Nam - 0901234567 hoặc Grab Express"
                      value={shippingNoteInput}
                      onChange={(e) => setShippingNoteInput(e.target.value)}
                      className="w-full rounded-xl border border-[#EFEAE2] px-3 py-2 text-xs focus:outline-none focus:border-[#0F766E]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShipModalOrder(null)}
                      className="px-4 py-2 rounded-xl border font-bold text-gray-600 hover:bg-gray-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submittingShipNote}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {submittingShipNote && <Loader2 className="size-3.5 animate-spin" />}
                      Xác nhận đã gửi hàng
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Đã nhận hàng & Upload Ảnh bằng chứng */}
          {deliveryModalOrder && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
              onClick={() => setDeliveryModalOrder(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-4 animate-scaleIn my-8 relative text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
                    ✅ Xác nhận Đã nhận hàng
                  </h3>
                  <button
                    type="button"
                    onClick={() => setDeliveryModalOrder(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <form onSubmit={handleConfirmDelivery} className="space-y-4 text-xs font-semibold">
                  <p className="text-gray-600">
                    Chuyển trạng thái đơn hàng <strong className="font-mono text-black">{deliveryModalOrder.id.slice(0, 12)}...</strong> sang <strong>"Đã nhận hàng"</strong> (Hoàn thành).
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8A8980] mb-1">
                      Ảnh bằng chứng giao hàng từ Shipper/Zalo (Không bắt buộc)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setDeliveryProofFile(file);
                        if (file) {
                          setDeliveryProofPreview(URL.createObjectURL(file));
                        } else {
                          setDeliveryProofPreview(null);
                        }
                      }}
                      className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#0F766E]/10 file:text-[#0F766E] hover:file:bg-[#0F766E]/20"
                    />
                    {deliveryProofPreview && (
                      <div className="mt-2 relative rounded-xl overflow-hidden border">
                        <img src={deliveryProofPreview} alt="Preview ảnh giao hàng" className="w-full h-40 object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryProofFile(null);
                            setDeliveryProofPreview(null);
                          }}
                          className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full hover:bg-black"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8A8980] mb-1">
                      Ghi chú hoàn thành (Không bắt buộc)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Khách đã nhận đủ 2 sản phẩm và thanh toán COD"
                      value={deliveryNoteInput}
                      onChange={(e) => setDeliveryNoteInput(e.target.value)}
                      className="w-full rounded-xl border border-[#EFEAE2] px-3 py-2 text-xs focus:outline-none focus:border-[#0F766E]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setDeliveryModalOrder(null)}
                      className="px-4 py-2 rounded-xl border font-bold text-gray-600 hover:bg-gray-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submittingDeliveryProof}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {submittingDeliveryProof && <Loader2 className="size-3.5 animate-spin text-white" />}
                      Xác nhận Đã nhận hàng
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
                      <strong>Tính năng:</strong> Trích xuất danh sách hóa đơn bán hàng theo thời gian được lựa chọn. Tự động tính toán chi phí, tổng thanh toán và lợi nhuận bán lẻ thực tế.
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
                    <th className="px-6 py-4">Mã KH</th>
                    <th className="px-6 py-4">Họ và tên</th>
                    <th className="px-6 py-4">Email</th>
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
                        <td className="px-6 py-4 font-mono font-black text-xs text-[#5C5B52]">{c.id.slice(0, 8)}...</td>
                        <td className="px-6 py-4 font-bold text-[var(--text-main)]">
                          {c.name}
                          {c.isNewCustomer && (
                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 font-extrabold px-2 py-0.5 rounded-full ml-2">
                              (Mới)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-[#5C5B52]">{c.email}</td>
                        <td className="px-6 py-4 font-mono text-[#5C5B52]">{c.phone}</td>
                        <td className="px-6 py-4 text-center font-bold text-[#0F766E]">{c.totalOrders} đơn</td>
                        <td className="px-6 py-4 text-center font-bold text-red-600">{c.totalCancelled} đơn</td>
                        <td className="px-6 py-4 text-right font-black text-[var(--primary-color)]">{currency.format(c.spent)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">Chưa có dữ liệu khách hàng nào.</td>
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
                          {selectedCustomer.email} • {selectedCustomer.phone}
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
                          {selectedCustomer.orders.map((order: any) => (
                            <div key={order.id} className="rounded-xl border border-[#EFEAE2] p-4 bg-white shadow-sm space-y-3">
                              <div className="flex items-center justify-between border-b border-[#F4EFE6] pb-2">
                                <div>
                                  <span className="text-xs font-black text-[var(--text-main)] block">
                                    Đơn hàng #{order.id.slice(0, 8).toUpperCase()}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-bold mt-0.5 block flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
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

    case 'settings':
      return (
        <div className="max-w-2xl space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-xl font-black">Cấu hình chi nhánh cửa hàng</h2>
            <p className="text-sm font-semibold text-[var(--text-muted)]">Thiết lập các thông tin chi nhánh cửa hàng thực tế hiển thị lên ứng dụng.</p>
          </div>

          <form onSubmit={handleUpdateSettings} className="rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-sm space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">Tên cửa hàng *</label>
              <input
                type="text"
                required
                value={storeInfo?.name || ''}
                onChange={(e) => {
                  if (storeInfo) {
                    setStoreInfo({ ...storeInfo, name: e.target.value });
                    setIsSaved(false);
                  }
                }}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">Số điện thoại liên hệ *</label>
              <input
                type="text"
                required
                value={storeInfo?.phone || ''}
                onChange={(e) => {
                  if (storeInfo) {
                    setStoreInfo({ ...storeInfo, phone: e.target.value });
                    setIsSaved(false);
                  }
                }}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">Địa chỉ chi nhánh *</label>
              <input
                type="text"
                required
                value={storeInfo?.address || ''}
                onChange={(e) => {
                  if (storeInfo) {
                    setStoreInfo({ ...storeInfo, address: e.target.value });
                    setIsSaved(false);
                  }
                }}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">Mô tả cửa hàng</label>
              <textarea
                value={storeInfo?.description || ''}
                rows={3}
                onChange={(e) => {
                  if (storeInfo) {
                    setStoreInfo({ ...storeInfo, description: e.target.value });
                    setIsSaved(false);
                  }
                }}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
            </div>

            {isSaved && (
              <div className="rounded-xl bg-green-50 p-3.5 text-sm font-bold text-green-700 animate-fadeIn">
                Lưu cấu hình cửa hàng thành công!
              </div>
            )}

            <button
              type="submit"
              disabled={submittingSettings}
              className="w-full rounded-xl bg-[var(--primary-color)] py-3.5 font-bold text-white transition hover:bg-[#cf5017] flex items-center justify-center gap-2"
            >
              {submittingSettings && <Loader2 className="size-4 animate-spin text-white" />}
              Lưu cấu hình
            </button>
          </form>
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
                Theo dõi hoạt động bán hàng, kiểm soát tồn kho sản phẩm thú cưng và tối ưu doanh số chi nhánh trong thời gian thực.
              </p>
            </div>
          </section>

          {/* Metrics */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Tổng doanh thu</span>
                <span className="p-2 rounded-lg bg-[rgba(228,93,28,0.1)] text-[var(--primary-color)]">
                  <TrendingUp className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">{currency.format(stats?.totalRevenue ?? 0)}</p>
              <p className="mt-1 text-xs font-bold text-green-600">Dữ liệu thực từ đơn đặt hàng</p>
            </div>

            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Tổng lợi nhuận</span>
                <span className="p-2 rounded-lg bg-green-50 text-green-600">
                  <DollarSign className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">{currency.format(stats?.totalProfit ?? 0)}</p>
              <p className="mt-1 text-xs font-bold text-green-600">Giá bán trừ giá nhập kho</p>
            </div>

            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Biên lợi nhuận</span>
                <span className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Percent className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">{(stats?.profitMargin ?? 0).toFixed(1)}%</p>
              <p className="mt-1 text-xs font-bold text-purple-600">Tỷ số Lợi nhuận / Doanh thu</p>
            </div>

            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Đơn hàng thực tế</span>
                <span className="p-2 rounded-lg bg-teal-50 text-teal-600">
                  <Package className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">{stats?.totalOrders ?? 0} đơn</p>
              <p className="mt-1 text-xs font-bold text-[#8A8980]">
                {orders.filter((o) => o.status === 'PENDING').length} đơn đang chờ xử lý
              </p>
            </div>

            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Sản phẩm đã bán</span>
                <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <ShoppingBag className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">{stats?.totalProductsSold ?? 0} món</p>
              <p className="mt-1 text-xs font-bold text-blue-600">Tổng doanh số toàn chi nhánh</p>
            </div>

            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Tỷ lệ hủy đơn</span>
                <span className="p-2 rounded-lg bg-red-50 text-red-600">
                  <X className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">{(stats?.cancellationRate ?? 0).toFixed(1)}%</p>
              <p className="mt-1 text-xs font-bold text-red-600">
                {orders.filter((o) => o.status === 'CANCELLED').length} đơn đã bị hủy
              </p>
            </div>

            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Khách hàng đăng ký</span>
                <span className="p-2 rounded-lg bg-orange-50 text-orange-600">
                  <Users className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">{stats?.totalCustomers ?? 0} tài khoản</p>
              <p className="mt-1 text-xs font-bold text-green-600">Người dùng có role là USER</p>
            </div>
          </section>

          {/* Dashboard Lists */}
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Product Status Alert */}
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm">
              <h3 className="text-base font-black">Sản phẩm sắp hết hàng & cần bổ sung</h3>
              <div className="mt-4 divide-y divide-[#EFEAE2]">
                {products.filter((p) => (p.stock ?? 0) <= 10).length > 0 ? (
                  products
                    .filter((p) => (p.stock ?? 0) <= 10)
                    .slice(0, 5)
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div>
                          <p className="text-sm font-bold text-[var(--text-main)]">{p.name}</p>
                          <p className="text-xs font-semibold text-[#8A8980]">Danh mục: {dynamicCategoryMap[p.category] || CATEGORY_MAP[p.category] || p.category}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={cn(
                              'inline-flex rounded px-2 py-0.5 text-xs font-black',
                              (p.stock ?? 0) === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600',
                            )}
                          >
                            Tồn: {p.stock ?? 0}
                          </span>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-gray-400 py-4">Kho hàng dồi dào, không có sản phẩm nào sắp hết hàng.</p>
                )}
              </div>
            </div>

            {/* Best Sellers */}
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm">
              <h3 className="text-base font-black">Sản phẩm bán chạy nhất</h3>
              <div className="mt-4 divide-y divide-[#EFEAE2]">
                {topSellingProducts.length > 0 ? (
                  topSellingProducts.map((p) => (
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
                {orders.length > 0 ? (
                  orders.slice(0, 5).map((o) => {
                    const itemsStr = o.items.map((i) => `${i.quantity}x ${i.product.name}`).join(', ');
                    return (
                      <div key={o.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="max-w-[70%]">
                          <p className="text-sm font-bold text-[var(--text-main)]">{o.user?.name || 'Khách vãng lai'}</p>
                          <p className="text-xs font-semibold text-[#8A8980] truncate" title={itemsStr}>
                            {itemsStr}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[var(--primary-color)]">{currency.format(o.totalAmount)}</p>
                          <p className="text-[10px] font-semibold text-[#8A8980]">
                            {new Date(o.createdAt).toLocaleDateString('vi-VN')}
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

// =============================================================
// SPA MANAGER CONSOLE COMPONENT
// =============================================================

function SpaManagerConsole({ currentTab, managerUser }: { currentTab: string; managerUser: any }) {
  // states
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [staffs, setStaffs] = useState<any[]>([]);
  const [managerBrands, setManagerBrands] = useState<any[]>([]);
  
  // Date and slot states
  const [slotDate, setSlotDate] = useState<string>('');
  const [slotsData, setSlotsData] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Assignment & Detail states
  const [selectedBookingDetail, setSelectedBookingDetail] = useState<any | null>(null);
  const [managerStaffs, setManagerStaffs] = useState<any[]>([]);
  const [availableStaffsMap, setAvailableStaffsMap] = useState<Record<string, any[]>>({});
  const [selectedAssignStaffMap, setSelectedAssignStaffMap] = useState<Record<string, string>>({});
  const [assignConfirmBooking, setAssignConfirmBooking] = useState<any | null>(null);
  const [assignConfirmStaff, setAssignConfirmStaff] = useState<{ id: string; name: string } | null>(null);
  const [assigningLoading, setAssigningLoading] = useState<boolean>(false);

  // Helper to resolve subServices for any booking in Manager view
  const getManagerBookingSubServices = (b: any) => {
    if (!b) return [];
    if (b.subServices && b.subServices.length > 0) {
      return b.subServices;
    }
    if (b.subServiceIds && b.subServiceIds.length > 0 && services.length > 0) {
      return b.subServiceIds
        .map((id: string) => services.find((s: any) => s.id === id))
        .filter(Boolean);
    }
    return [];
  };

  // Reschedule states
  const [rescheduleBooking, setRescheduleBooking] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<any[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState<boolean>(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<string>('');
  const [submittingReschedule, setSubmittingReschedule] = useState<boolean>(false);

  // Service modal states
  const [serviceModalOpen, setServiceModalOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [serviceForm, setServiceForm] = useState({
    brandId: '',
    name: '',
    description: '',
    price: '',
    durationMin: '60',
    durationMax: '',
    isMain: true,
    species: 'ALL' as 'ALL' | 'DOG' | 'CAT',
    petWeightMin: '',
    petWeightMax: '',
    isActive: true
  });
  const [submittingService, setSubmittingService] = useState<boolean>(false);

  // Booking search and filters
  const [bookingSearch, setBookingSearch] = useState<string>('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');

  // Service filters
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('ALL');
  const [serviceBrandFilter, setServiceBrandFilter] = useState<string>('ALL');

  // Category modal & filter states
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    isMain: true,
    status: 'ACTIVE' as 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED'
  });
  const [submittingCategory, setSubmittingCategory] = useState<boolean>(false);
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<string>('ALL');

  const filteredServices = useMemo(() => {
    return services.filter((s: any) => {
      if (serviceTypeFilter === 'MAIN' && !s.isMain) return false;
      if (serviceTypeFilter === 'SUB' && s.isMain) return false;
      if (serviceBrandFilter !== 'ALL' && (s.categoryId || s.brandId) !== serviceBrandFilter) return false;
      return true;
    });
  }, [services, serviceTypeFilter, serviceBrandFilter]);

  // Filter SpaBrand options in form based on selected classification (isMain)
  const filteredBrandsForForm = useMemo(() => {
    return managerBrands.filter((b: any) => {
      if (serviceForm.isMain) {
        return b.isMain !== false;
      } else {
        return b.isMain === false;
      }
    });
  }, [managerBrands, serviceForm.isMain]);

  const handleClassificationChange = (isMainSelected: boolean) => {
    const matchingBrands = managerBrands.filter((b: any) =>
      isMainSelected ? b.isMain !== false : b.isMain === false
    );

    const currentBrandValid = matchingBrands.some((b: any) => b.id === serviceForm.brandId);
    const newBrandId = currentBrandValid ? serviceForm.brandId : (matchingBrands[0]?.id || '');

    setServiceForm((prev) => ({
      ...prev,
      isMain: isMainSelected,
      brandId: newBrandId,
    }));
  };

  useEffect(() => {
    // Set default slot date to today
    setSlotDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Fetch branches and categories managed by this manager
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [branchesRes, categoriesRes] = await Promise.all([
          spaApi.getManagerBranches(),
          spaApi.getManagerCategories(),
        ]);
        const bData = branchesRes.data || [];
        setBranches(bData);
        setManagerBrands(categoriesRes.data || []);
        if (bData.length > 0) {
          setSelectedBranchId(bData[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        toast.error('Lỗi khi tải thông tin quản lý.');
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch data based on active tab and selected branch
  const refreshData = async () => {
    // For tabs that don't need a branch (categories, services), don't block on selectedBranchId
    const needsBranch = ['dashboard', 'bookings', 'staffs', 'slots'].includes(currentTab);
    if (needsBranch && !selectedBranchId) return;
    setLoading(true);
    try {
      if (currentTab === 'dashboard') {
        const statsRes = await spaApi.getManagerDashboardStats(selectedBranchId);
        setStats(statsRes.data);
        
        // Auto fetch available staffs for confirmed bookings
        const todayBookings = statsRes.data?.todayBookings || [];
        const confirmed = todayBookings.filter((b: any) => b.status === 'CONFIRMED');
        const staffMap: Record<string, any[]> = {};
        for (const b of confirmed) {
          try {
            const stRes = await spaApi.getAvailableStaffForBooking(b.id);
            staffMap[b.id] = stRes.data || [];
          } catch (e) {
            console.error(e);
          }
        }
        setAvailableStaffsMap(staffMap);

      } else if (currentTab === 'bookings') {
        const [bookingsRes, staffsRes, servicesRes] = await Promise.all([
          spaApi.getManagerBookings(selectedBranchId),
          spaApi.getManagerStaffs(selectedBranchId).catch(() => ({ data: [] })),
          spaApi.getServices().catch(() => ({ data: [] })),
        ]);
        setBookings(bookingsRes.data || []);
        setManagerStaffs(staffsRes.data || []);
        if (servicesRes.data) setServices(servicesRes.data);
      } else if (currentTab === 'services') {
        const servicesRes = await spaApi.getManagerServices();
        setServices(servicesRes.data || []);
      } else if (currentTab === 'categories') {
        const categoriesRes = await spaApi.getManagerCategories();
        setManagerBrands(categoriesRes.data || []);
      } else if (currentTab === 'staffs') {
        const staffsRes = await spaApi.getManagerStaffs(selectedBranchId);
        setStaffs(staffsRes.data || []);
      }
    } catch (err) {
      toast.error('Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [selectedBranchId, currentTab]);

  // Fetch slots data when slots tab date changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedBranchId || !slotDate || currentTab !== 'slots') return;
      setLoadingSlots(true);
      try {
        const res = await spaApi.getAvailability(selectedBranchId, slotDate);
        setSlotsData(res.data || []);
      } catch (err) {
        toast.error('Lỗi khi tải danh sách khung giờ.');
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [selectedBranchId, slotDate, currentTab]);

  // Fetch slots for reschedule when date changes
  useEffect(() => {
    const fetchRescheduleSlots = async () => {
      if (!rescheduleBooking || !rescheduleDate) return;
      setLoadingRescheduleSlots(true);
      try {
        const duration = rescheduleBooking.service?.durationMin || 30;
        const res = await spaApi.getAvailability(selectedBranchId, rescheduleDate, duration);
        setRescheduleSlots(res.data || []);
      } catch (err) {
        toast.error('Lỗi khi tải khung giờ khả dụng.');
      } finally {
        setLoadingRescheduleSlots(false);
      }
    };
    fetchRescheduleSlots();
  }, [rescheduleBooking, rescheduleDate]);

  // Confirm booking to CONFIRMED
  const handleConfirmBooking = async (bookingId: string) => {
    try {
      await spaApi.confirmBooking(bookingId);
      toast.success('Xác nhận lịch hẹn thành công!');
      
      // Load available staff immediately
      const stRes = await spaApi.getAvailableStaffForBooking(bookingId);
      setAvailableStaffsMap(prev => ({ ...prev, [bookingId]: stRes.data || [] }));

      // Refresh page data
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xác nhận lịch hẹn.');
    }
  };

  // Assign staff to booking
  const handleAssignStaff = async () => {
    if (!assignConfirmBooking || !assignConfirmStaff) return;
    setAssigningLoading(true);
    try {
      await spaApi.assignStaff(assignConfirmBooking.id, assignConfirmStaff.id);
      toast.success(`Đã phân công lịch hẹn cho ${assignConfirmStaff.name}!`);
      setAssignConfirmBooking(null);
      setAssignConfirmStaff(null);
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi phân công nhân viên.');
    } finally {
      setAssigningLoading(false);
    }
  };

  // Reschedule booking submission
  const handleRescheduleSubmit = async () => {
    if (!rescheduleBooking || !rescheduleDate || !selectedRescheduleSlot) {
      toast.error('Vui lòng chọn đầy đủ ngày và giờ.');
      return;
    }
    setSubmittingReschedule(true);
    try {
      const scheduledAt = `${rescheduleDate}T${selectedRescheduleSlot}:00`;
      await spaApi.rescheduleBooking(rescheduleBooking.id, scheduledAt);
      toast.success('Đổi lịch hẹn của khách hàng thành công!');
      setRescheduleBooking(null);
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi đổi lịch hẹn.');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // Apply late discount 10%
  const handleApplyLateDiscount = async (bookingId: string) => {
    try {
      await spaApi.applyLateDiscount(bookingId);
      toast.success('Đã tự động giảm 10% giá đơn hàng do trễ hẹn!');
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi áp dụng giảm giá.');
    }
  };

  // Weight change handlers with instant validation and auto-adjust
  const handleMinWeightChange = (val: string) => {
    if (val === '') {
      setServiceForm((prev) => ({ ...prev, petWeightMin: '' }));
      return;
    }
    const minNum = parseFloat(val);
    const maxNum = parseFloat(serviceForm.petWeightMax);

    if (!isNaN(minNum) && !isNaN(maxNum) && minNum > maxNum) {
      toast.error('Cân nặng tối thiểu (min) phải nhỏ hơn cân nặng tối đa (max)! Đã tự động điều chỉnh max = min');
      setServiceForm((prev) => ({
        ...prev,
        petWeightMin: val,
        petWeightMax: val,
      }));
      return;
    }

    setServiceForm((prev) => ({ ...prev, petWeightMin: val }));
  };

  const handleMaxWeightChange = (val: string) => {
    if (val === '') {
      setServiceForm((prev) => ({ ...prev, petWeightMax: '' }));
      return;
    }
    const maxNum = parseFloat(val);
    const minNum = parseFloat(serviceForm.petWeightMin);

    if (!isNaN(minNum) && !isNaN(maxNum) && maxNum < minNum) {
      toast.error(`Cân nặng tối đa (${maxNum}kg) phải lớn hơn hoặc bằng cân nặng tối thiểu (${minNum}kg)!`);
      setServiceForm((prev) => ({ ...prev, petWeightMax: String(minNum) }));
      return;
    }

    setServiceForm((prev) => ({ ...prev, petWeightMax: val }));
  };

  // Service submit with complete field validation
  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate Brand
    if (!serviceForm.brandId) {
      toast.error('Vui lòng chọn Thương hiệu Spa!');
      return;
    }

    // 2. Validate Service Name
    if (!serviceForm.name || serviceForm.name.trim().length < 2) {
      toast.error('Vui lòng nhập Tên dịch vụ (tối thiểu 2 ký tự)!');
      return;
    }

    // 3. Validate Price
    const priceNum = Number(serviceForm.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Vui lòng nhập Giá dịch vụ hợp lệ (lớn hơn 0đ)!');
      return;
    }

    // 4. Validate Single Duration
    const durationNum = Number(serviceForm.durationMin);
    if (isNaN(durationNum) || durationNum < 10) {
      toast.error('Thời gian thực hiện phải từ 10 phút trở lên!');
      return;
    }

    // 5. Validate Weight Range
    const weightMinNum = serviceForm.petWeightMin ? Number(serviceForm.petWeightMin) : null;
    const weightMaxNum = serviceForm.petWeightMax ? Number(serviceForm.petWeightMax) : null;

    if (weightMinNum !== null && weightMinNum < 0) {
      toast.error('Cân nặng tối thiểu không được nhỏ hơn 0kg!');
      return;
    }

    if (weightMinNum !== null && weightMaxNum !== null && weightMinNum > weightMaxNum) {
      toast.error('Cân nặng tối thiểu (min) phải nhỏ hơn hoặc bằng cân nặng tối đa (max)!');
      return;
    }

    setSubmittingService(true);
    try {
      const data = {
        brandId: serviceForm.brandId,
        name: serviceForm.name.trim(),
        description: serviceForm.description ? serviceForm.description.trim() : undefined,
        price: priceNum,
        durationMin: durationNum,
        durationMax: durationNum,
        isMain: serviceForm.isMain,
        species: serviceForm.species === 'ALL' ? undefined : serviceForm.species,
        petWeightMin: weightMinNum !== null ? weightMinNum : undefined,
        petWeightMax: weightMaxNum !== null ? weightMaxNum : undefined,
        isActive: serviceForm.isActive
      };

      if (editingService) {
        await spaApi.updateManagerService(editingService.id, data);
        toast.success('Cập nhật dịch vụ thành công!');
      } else {
        await spaApi.createManagerService(data);
        toast.success('Thêm dịch vụ mới thành công!');
      }
      setServiceModalOpen(false);
      setEditingService(null);
      refreshData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu dịch vụ.');
    } finally {
      setSubmittingService(false);
    }
  };

  // Open edit service modal
  const handleEditServiceClick = (service: any) => {
    setEditingService(service);
    setServiceForm({
      brandId: service.brandId || (managerBrands[0]?.id || ''),
      name: service.name,
      description: service.description || '',
      price: String(service.price),
      durationMin: String(service.durationMin || 60),
      durationMax: service.durationMax ? String(service.durationMax) : '',
      isMain: service.isMain ?? true,
      species: service.species || 'ALL',
      petWeightMin: service.petWeightMin !== null && service.petWeightMin !== undefined ? String(service.petWeightMin) : '',
      petWeightMax: service.petWeightMax !== null && service.petWeightMax !== undefined ? String(service.petWeightMax) : '',
      isActive: service.isActive ?? true
    });
    setServiceModalOpen(true);
  };

  // Open add service modal
  const handleAddServiceClick = () => {
    setEditingService(null);
    const defaultMainBrand = managerBrands.find((b: any) => b.isMain !== false);
    const brandId = defaultMainBrand ? defaultMainBrand.id : (managerBrands[0]?.id || '');
    setServiceForm({
      brandId,
      name: '',
      description: '',
      price: '',
      durationMin: '60',
      durationMax: '60',
      isMain: true,
      species: 'ALL',
      petWeightMin: '',
      petWeightMax: '',
      isActive: true
    });
    setServiceModalOpen(true);
  };

  // Category Handlers
  const handleAddCategoryClick = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      description: '',
      isMain: true,
      status: 'ACTIVE',
    });
    setCategoryModalOpen(true);
  };

  const handleEditCategoryClick = (cat: any) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name || '',
      description: cat.description || '',
      isMain: cat.isMain ?? true,
      status: cat.status || 'ACTIVE',
    });
    setCategoryModalOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name || categoryForm.name.trim().length < 2) {
      toast.error('Vui lòng nhập Tên danh mục (tối thiểu 2 ký tự)!');
      return;
    }

    setSubmittingCategory(true);
    try {
      const data = {
        name: categoryForm.name.trim(),
        description: categoryForm.description ? categoryForm.description.trim() : undefined,
        isMain: categoryForm.isMain,
        status: categoryForm.status,
      };

      if (editingCategory) {
        await spaApi.updateManagerCategory(editingCategory.id, data);
        toast.success('Cập nhật danh mục thành công!');
      } else {
        await spaApi.createManagerCategory(data);
        toast.success('Thêm danh mục mới thành công!');
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      const res = await spaApi.getManagerCategories();
      setManagerBrands(res.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu danh mục.');
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleDeleteCategoryClick = async (cat: any) => {
    if (cat._count?.services > 0) {
      toast.error(`Không thể xóa danh mục đang có ${cat._count.services} dịch vụ!`);
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${cat.name}"?`)) return;

    try {
      await spaApi.deleteManagerCategory(cat.id);
      toast.success('Xóa danh mục thành công!');
      const res = await spaApi.getManagerCategories();
      setManagerBrands(res.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xóa danh mục.');
    }
  };

  // Filter bookings list
  const filteredBookings = bookings.filter(b => {
    const sName = b.service?.name || '';
    const cName = b.user?.name || '';
    const matchesSearch = sName.toLowerCase().includes(bookingSearch.toLowerCase()) || 
                          cName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
                          b.id.toLowerCase().includes(bookingSearch.toLowerCase());
    
    const matchesStatus = bookingStatusFilter === 'ALL' || b.status === bookingStatusFilter;
    return matchesSearch && matchesStatus;
  });

  if (branches.length === 0 && !loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <AlertCircle className="size-12 text-red-500" />
        <p className="text-sm font-black text-gray-700">Tài khoản này chưa được phân công quản lý chi nhánh Spa nào.</p>
        <p className="text-xs text-gray-500">Vui lòng liên hệ Admin để gán quản lý chi nhánh trong AddressSpa.</p>
      </div>
    );
  }

  // Display branches names under name
  const branchNames = branches.map(b => b.name).join(', ');

  return (
    <div className="space-y-6">
      
      {/* Dynamic Purple Header */}
      <section className="bg-primary text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs text-orange-200 block uppercase tracking-wider font-extrabold">Spa Manager</span>
          <h2 className="text-2xl font-black">{managerUser?.name || 'Nguyễn Thị Mai'}</h2>
          <p className="text-xs text-orange-100 mt-1 font-medium flex items-center gap-1">
            📍 Quản lý: <span className="font-bold">{branchNames || 'Chi nhánh Spa'}</span>
          </p>
        </div>
        
        {/* Branch switcher dropdown if multiple branches */}
        {branches.length > 1 && (
          <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs font-bold text-orange-100">Chi nhánh hiển thị:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent border-0 font-bold text-white text-xs focus:ring-0 focus:outline-none cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id} className="text-gray-900 font-semibold">{b.name}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="ml-2 text-sm font-bold text-gray-500">Đang tải dữ liệu Spa...</span>
        </div>
      ) : (
        <>
          {/* TAB CONTENT: DASHBOARD */}
          {(currentTab === 'dashboard' || !currentTab) && stats && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Metrics cards row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1 */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase text-[#8A8980]">Lịch hẹn hôm nay</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-black text-gray-900">{stats.todayBookingsCount}</p>
                      {stats.unconfirmedBookingsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = new URL(window.location.href);
                            url.searchParams.set('tab', 'bookings');
                            window.history.pushState({}, '', url.toString());
                            window.dispatchEvent(new Event('popstate'));
                          }}
                          className="text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded-full shadow-2xs transition cursor-pointer flex items-center gap-1"
                        >
                          🚨 {stats.unconfirmedBookingsCount} cần xác nhận ➔
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="size-10 rounded-full bg-orange-55 shadow-inner flex items-center justify-center text-primary shrink-0">
                    <Calendar className="size-5" />
                  </div>
                </div>
                {/* Metric 2 */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase text-[#8A8980]">Hoàn thành</span>
                    <p className="text-2xl font-black text-gray-900 mt-1">{stats.completedBookingsCount}</p>
                  </div>
                  <div className="size-10 rounded-full bg-green-50 shadow-inner flex items-center justify-center text-green-600">
                    <CheckCircle2 className="size-5" />
                  </div>
                </div>
                {/* Metric 3 */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase text-[#8A8980]">Doanh thu</span>
                    <p className="text-2xl font-black text-gray-900 mt-1">{(stats.totalRevenue).toLocaleString('vi-VN')}đ</p>
                  </div>
                  <div className="size-10 rounded-full bg-purple-50 shadow-inner flex items-center justify-center text-purple-700">
                    <TrendingUp className="size-5" />
                  </div>
                </div>
                {/* Metric 4 */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase text-[#8A8980]">Nhân viên</span>
                    <p className="text-2xl font-black text-gray-900 mt-1">{stats.staffCount}</p>
                  </div>
                  <div className="size-10 rounded-full bg-blue-50 shadow-inner flex items-center justify-center text-blue-600">
                    <Users className="size-5" />
                  </div>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Revenue by Service custom chart */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs lg:col-span-7 space-y-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Doanh thu theo dịch vụ</h3>
                  <div className="space-y-3.5 pt-2">
                    {stats.revenueByService && stats.revenueByService.length > 0 ? (
                      stats.revenueByService.map((item: any, idx: number) => {
                        const maxVal = Math.max(...stats.revenueByService.map((x: any) => x.value), 1);
                        const percent = (item.value / maxVal) * 100;
                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-gray-700">
                              <span>{item.name}</span>
                              <span className="text-primary">{item.value.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div className="h-6 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${percent}%` }}
                                className="h-full bg-primary rounded-full transition-all duration-500 shadow-sm"
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-400 py-6 text-center">Chưa có doanh thu nào để vẽ biểu đồ.</p>
                    )}
                  </div>
                </div>

                {/* Status distribution custom chart */}
                <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs lg:col-span-5 space-y-4">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Phân bổ trạng thái lịch hẹn</h3>
                  <div className="space-y-3 pt-2">
                    {stats.statusDistribution && stats.statusDistribution.length > 0 ? (
                      stats.statusDistribution.map((item: any, idx: number) => {
                        const total = stats.statusDistribution.reduce((acc: number, x: any) => acc + x.value, 0);
                        const percent = ((item.value / total) * 100).toFixed(0);
                        const displayStatus = {
                          PENDING: { label: 'Đang xử lý', color: 'bg-amber-500' },
                          CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-500' },
                          ASSIGNED: { label: 'Đã phân công', color: 'bg-indigo-500' },
                          IN_PROGRESS: { label: 'Đang thực hiện', color: 'bg-orange-500' },
                          COMPLETED: { label: 'Hoàn thành', color: 'bg-green-500' },
                          CANCELLED: { label: 'Đã hủy', color: 'bg-red-500' },
                          NO_SHOW: { label: 'No Show', color: 'bg-gray-500' },
                          LATE: { label: 'Trễ hẹn', color: 'bg-rose-500' }
                        }[item.status as string] || { label: item.status, color: 'bg-gray-400' };

                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-gray-700">
                              <span className="flex items-center gap-1.5">
                                <span className={`size-2.5 rounded-full ${displayStatus.color}`} />
                                {displayStatus.label}
                              </span>
                              <span>{item.value} ({percent}%)</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${percent}%` }}
                                className={`h-full ${displayStatus.color} rounded-full`}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-gray-400 py-6 text-center">Chưa có dữ liệu phân bổ trạng thái.</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Today's Booking table */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Lịch hẹn hôm nay ({stats.todayBookings?.length || 0})</h3>
                  {stats.unconfirmedBookingsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('tab', 'bookings');
                        window.history.pushState({}, '', url.toString());
                        window.dispatchEvent(new Event('popstate'));
                      }}
                      className="text-xs font-black bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1 rounded-full transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <AlertCircle className="size-3.5 text-amber-600" />
                      {stats.unconfirmedBookingsCount} lịch hẹn cần xác nhận (Chuyển qua trang lịch hẹn ➔)
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-xs font-black uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-3.5">Giờ</th>
                        <th className="px-6 py-3.5">Khách hàng / Bé</th>
                        <th className="px-6 py-3.5">Dịch vụ</th>
                        <th className="px-6 py-3.5">Ghi chú</th>
                        <th className="px-6 py-3.5 text-center">Trạng thái</th>
                        <th className="px-6 py-3.5 text-center">Phân công nhân viên</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats.todayBookings && stats.todayBookings.length > 0 ? (
                        stats.todayBookings.map((b: any) => {
                          const timeStr = new Date(b.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                          const statusStyle = {
                            PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
                            CONFIRMED: 'bg-blue-55 text-blue-700 border-blue-200',
                            ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                            IN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
                            COMPLETED: 'bg-green-50 text-green-700 border-green-200',
                            CANCELLED: 'bg-red-50 text-red-700 border-red-200',
                            NO_SHOW: 'bg-gray-50 text-gray-700 border-gray-250',
                            LATE: 'bg-rose-50 text-rose-705 border-rose-200'
                          }[b.status as string] || 'bg-gray-50 text-gray-700 border-gray-200';

                          return (
                            <tr key={b.id} className="hover:bg-gray-50/30 transition">
                              <td className="px-6 py-4 font-extrabold text-gray-900 whitespace-nowrap">{timeStr}</td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-gray-800 text-xs">{b.customerName}</p>
                                  <p className="text-[10px] text-gray-405 font-semibold">Pet: <span className="text-gray-600 font-extrabold">{b.petName}</span></p>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-bold text-gray-800 text-xs">{b.serviceName}</td>
                              <td className="px-6 py-4 text-xs italic text-gray-500 max-w-[200px] truncate" title={b.note}>
                                {b.note ? `"${b.note}"` : '—'}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusStyle}`}>
                                  {b.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex justify-center items-center">
                                  {b.status === 'PENDING' && (
                                    <button
                                      onClick={() => handleConfirmBooking(b.id)}
                                      className="bg-primary hover:bg-primary/95 text-white px-3 py-1 text-xs font-bold rounded-lg shadow-sm transition"
                                    >
                                      Xác nhận
                                    </button>
                                  )}

                                  {b.status === 'CONFIRMED' && (
                                    <div className="flex items-center gap-1.5">
                                      <select
                                        value={selectedAssignStaffMap[b.id] || ''}
                                        onChange={(e) => setSelectedAssignStaffMap(prev => ({ ...prev, [b.id]: e.target.value }))}
                                        className="border border-gray-300 rounded-lg text-xs font-semibold px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary h-8"
                                      >
                                        <option value="">-- Chọn nhân viên --</option>
                                        {(availableStaffsMap[b.id] || []).map((st: any) => (
                                          <option key={st.id} value={st.id}>{st.name}</option>
                                        ))}
                                      </select>
                                      
                                      {selectedAssignStaffMap[b.id] && (
                                        <button
                                          onClick={() => {
                                            const stId = selectedAssignStaffMap[b.id];
                                            const staffName = (availableStaffsMap[b.id] || []).find((s: any) => s.id === stId)?.name || 'Nhân viên';
                                            setAssignConfirmBooking(b);
                                            setAssignConfirmStaff({ id: stId, name: staffName });
                                          }}
                                          className="bg-purple-600 hover:bg-purple-750 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm transition h-8"
                                        >
                                          Phân công
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {b.status === 'ASSIGNED' && (
                                    <span className="text-[11px] font-bold text-gray-500 leading-tight">
                                      Nhân viên: <span className="font-black text-purple-700">✨ {b.staffName}</span>
                                    </span>
                                  )}

                                  {['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'LATE'].includes(b.status) && (
                                    <span className="text-[11px] text-gray-400 font-semibold italic">
                                      {b.staffName ? `Đã giao: ${b.staffName}` : 'Không phân công'}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Không có lịch hẹn nào phát sinh hôm nay.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB CONTENT: SERVICES */}
          {currentTab === 'services' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Quản lý dịch vụ Spa</h2>
                  <p className="text-sm font-semibold text-gray-500">Thêm, chỉnh sửa dịch vụ spa, phân loại gói chính / dịch vụ lẻ và thiết lập mốc cân nặng.</p>
                </div>
                <button
                  onClick={handleAddServiceClick}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#cf5017]"
                >
                  <Plus className="size-4" /> Thêm dịch vụ
                </button>
              </div>

              {/* Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-150 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="size-4 text-gray-400" />
                    <span className="text-xs font-bold text-gray-500">Phân loại dịch vụ:</span>
                    <select
                      value={serviceTypeFilter}
                      onChange={(e) => setServiceTypeFilter(e.target.value)}
                      className="rounded-xl border border-gray-150 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="ALL">🌐 Tất cả dịch vụ ({services.length})</option>
                      <option value="MAIN">★ Chỉ gói dịch vụ chính ({services.filter((s: any) => s.isMain).length})</option>
                      <option value="SUB">✦ Chỉ dịch vụ lẻ chọn thêm ({services.filter((s: any) => !s.isMain).length})</option>
                    </select>
                  </div>

                  {managerBrands.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500">Thương hiệu Spa:</span>
                      <select
                        value={serviceBrandFilter}
                        onChange={(e) => setServiceBrandFilter(e.target.value)}
                        className="rounded-xl border border-gray-150 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                        <option value="ALL">Tất cả thương hiệu</option>
                        {managerBrands.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Services Table */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-xs font-black uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-4">Tên dịch vụ & Phân loại</th>
                        <th className="px-6 py-4">Thương hiệu / Nhóm</th>
                        <th className="px-6 py-4">Đối tượng & Cân nặng</th>
                        <th className="px-6 py-4 text-center">Thời gian</th>
                        <th className="px-6 py-4 text-right">Giá</th>
                        <th className="px-6 py-4 text-center">Số lượt đặt</th>
                        <th className="px-6 py-4 text-center">Trạng thái</th>
                        <th className="px-6 py-4 text-center">Chỉnh sửa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredServices.length > 0 ? (
                        filteredServices.map((s: any) => {
                          const speciesBadge = s.species === 'DOG' ? '🐕 Chó' : s.species === 'CAT' ? '🐈 Mèo' : '🐾 Tất cả';
                          const weightText = s.petWeightMin !== null && s.petWeightMax !== null
                            ? `${s.petWeightMin}kg - ${s.petWeightMax}kg`
                            : 'Tất cả cân nặng';

                          return (
                            <tr key={s.id} className="hover:bg-gray-50/30 transition">
                              <td className="px-6 py-4 space-y-1">
                                <span className="font-extrabold text-gray-900 block text-sm">{s.name}</span>
                                <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded ${
                                  s.isMain ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                  {s.isMain ? '★ Gói dịch vụ chính' : '✦ Dịch vụ lẻ chọn thêm'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                                  {s.category?.name || s.brand?.name || 'Grooming Spa'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs font-semibold text-gray-700 space-y-0.5">
                                <span className="block font-bold text-gray-800">{speciesBadge}</span>
                                <span className="block text-gray-450 font-medium">{weightText}</span>
                              </td>
                              <td className="px-6 py-4 text-center font-semibold text-gray-700">{s.durationMin} phút</td>
                              <td className="px-6 py-4 text-right font-black text-primary">{s.price.toLocaleString('vi-VN')}đ</td>
                              <td className="px-6 py-4 text-center font-extrabold text-purple-700">{s._count?.bookings || 0} lượt</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${
                                  s.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                }`}>
                                  {s.isActive ? 'Đang hoạt động' : 'Tắt'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  onClick={() => handleEditServiceClick(s)}
                                  className="p-1.5 rounded-lg border text-gray-600 hover:text-primary hover:bg-orange-50 transition"
                                  title="Chỉnh sửa dịch vụ"
                                >
                                  <Edit2 className="size-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-gray-400">Không tìm thấy dịch vụ nào.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: CATEGORIES */}
          {currentTab === 'categories' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Quản lý Danh mục Spa</h2>
                  <p className="text-sm font-semibold text-gray-500">Thêm, chỉnh sửa và thiết lập phân loại danh mục (Gói chính / Dịch vụ lẻ).</p>
                </div>
                <button
                  onClick={handleAddCategoryClick}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#cf5017]"
                >
                  <Plus className="size-4" /> Thêm danh mục
                </button>
              </div>

              {/* Filter Toolbar */}
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-150 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-500">Phân loại danh mục:</span>
                  <select
                    value={categoryTypeFilter}
                    onChange={(e) => setCategoryTypeFilter(e.target.value)}
                    className="rounded-xl border border-gray-150 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="ALL">🌐 Tất cả danh mục ({managerBrands.length})</option>
                    <option value="MAIN">★ Chỉ gói dịch vụ chính ({managerBrands.filter((c: any) => c.isMain).length})</option>
                    <option value="SUB">✦ Chỉ dịch vụ lẻ chọn thêm ({managerBrands.filter((c: any) => !c.isMain).length})</option>
                  </select>
                </div>
              </div>

              {/* Categories Table */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-xs font-black uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-4">Tên danh mục & Phân loại</th>
                        <th className="px-6 py-4">Mô tả</th>
                        <th className="px-6 py-4 text-center">Số dịch vụ</th>
                        <th className="px-6 py-4 text-center">Số lượt đặt</th>
                        <th className="px-6 py-4 text-center">Trạng thái</th>
                        <th className="px-6 py-4 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {managerBrands
                        .filter((c: any) => {
                          if (categoryTypeFilter === 'MAIN' && !c.isMain) return false;
                          if (categoryTypeFilter === 'SUB' && c.isMain) return false;
                          return true;
                        })
                        .map((c: any) => (
                          <tr key={c.id} className="hover:bg-gray-50/30 transition">
                            <td className="px-6 py-4 space-y-1">
                              <span className="font-extrabold text-gray-900 block text-sm">{c.name}</span>
                              <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded ${
                                c.isMain ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {c.isMain ? '★ Gói dịch vụ chính' : '✦ Dịch vụ lẻ chọn thêm'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-gray-600 max-w-[250px] truncate" title={c.description || 'Chưa có mô tả'}>
                              {c.description || <span className="italic text-gray-400">Không có mô tả</span>}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-gray-800">
                              <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                                {c._count?.services || 0} dịch vụ
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-extrabold text-purple-700">
                              {c._count?.bookings || 0} lượt
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${
                                c.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                              }`}>
                                {c.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tắt'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleEditCategoryClick(c)}
                                  className="p-1.5 rounded-lg border text-gray-600 hover:text-primary hover:bg-orange-50 transition"
                                  title="Chỉnh sửa danh mục"
                                >
                                  <Edit2 className="size-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCategoryClick(c)}
                                  className="p-1.5 rounded-lg border text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                                  title="Xóa danh mục"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: BOOKINGS */}
          {currentTab === 'bookings' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-black text-gray-900">Danh sách tất cả lịch hẹn</h2>
                <p className="text-sm font-semibold text-gray-500">Quản lý, đổi lịch hẹn, phân công nhân viên và áp dụng giảm giá trễ hẹn 10%.</p>
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-3 rounded-2xl border border-gray-150 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo tên khách hàng, tên dịch vụ hoặc mã..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="w-full rounded-xl border border-gray-150 bg-gray-50/50 py-2 pl-10 pr-10 text-sm focus:border-primary focus:bg-white focus:outline-none"
                  />
                  {bookingSearch && (
                    <button
                      type="button"
                      onClick={() => setBookingSearch('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-gray-400" />
                  <select
                    value={bookingStatusFilter}
                    onChange={(e) => setBookingStatusFilter(e.target.value)}
                    className="rounded-xl border border-gray-150 bg-white px-3 py-2 text-sm font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="PENDING">Pending (Chờ xác nhận)</option>
                    <option value="CONFIRMED">Confirmed (Đã xác nhận)</option>
                    <option value="CHECK_IN">Check-in (Khách đã đến)</option>
                    <option value="ASSIGNED">Assigned (Đã giao việc)</option>
                    <option value="IN_PROGRESS">In Progress (Đang làm)</option>
                    <option value="COMPLETED">Completed (Hoàn thành)</option>
                    <option value="CANCELLED">Cancelled (Đã hủy)</option>
                    <option value="NO_SHOW">No Show (Vắng mặt)</option>
                    <option value="LATE">Late (Trễ hẹn)</option>
                  </select>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-xs font-black uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-4">Mã lịch</th>
                        <th className="px-6 py-4">Thời gian hẹn</th>
                        <th className="px-6 py-4">Khách hàng / Thú cưng</th>
                        <th className="px-6 py-4">Dịch vụ</th>
                        <th className="px-6 py-4">Nhân viên</th>
                        <th className="px-6 py-4 text-center">Trạng thái</th>
                        <th className="px-6 py-4 text-center">Thao tác quản lý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredBookings.length > 0 ? (
                        filteredBookings.map((b: any) => {
                          const dateObj = new Date(b.scheduledAt);
                          const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                          const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                          const statusStyle = {
                            PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
                            CONFIRMED: 'bg-blue-55 text-blue-700 border-blue-200',
                            CHECK_IN: 'bg-teal-50 text-teal-700 border-teal-200',
                            ARRIVED: 'bg-teal-50 text-teal-700 border-teal-200',
                            ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                            IN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
                            COMPLETED: 'bg-green-50 text-green-700 border-green-200',
                            CANCELLED: 'bg-red-50 text-red-700 border-red-200',
                            NO_SHOW: 'bg-gray-50 text-gray-700 border-gray-250',
                            LATE: 'bg-rose-50 text-rose-700 border-rose-250'
                          }[b.status as string] || 'bg-gray-50 text-gray-700 border-gray-200';

                          const canReschedule = ['PENDING', 'CONFIRMED', 'CHECK_IN', 'ARRIVED', 'ASSIGNED', 'LATE'].includes(b.status);
                          const isLateOfferable = (b.status === 'CHECK_IN' || b.status === 'ARRIVED' || b.status === 'LATE') && !b.discountAmount;

                          return (
                            <tr
                              key={b.id}
                              onClick={() => setSelectedBookingDetail(b)}
                              className="hover:bg-gray-50/70 transition cursor-pointer"
                            >
                              <td className="px-6 py-4 font-mono font-bold text-xs text-gray-500">#{b.id.slice(-6).toUpperCase()}</td>
                              <td className="px-6 py-4">
                                <span className="font-extrabold text-gray-900 block">{timeStr}</span>
                                <span className="text-[10px] text-gray-400 font-semibold block">{dateStr}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-gray-800 text-xs">{b.user?.name || 'Khách hàng'}</p>
                                  <p className="text-[10px] text-gray-500 font-semibold">Pet: <span className="text-gray-700 font-extrabold">{b.petName || b.pet?.name || 'Thú cưng'}</span></p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-gray-800 text-xs">{b.service?.name || 'Dịch vụ Spa'}</p>
                                <p className="text-[10px] text-gray-400 font-semibold">{(b.totalPrice || b.priceSnapshot || 0).toLocaleString('vi-VN')}đ</p>
                                {(() => {
                                  const subList = getManagerBookingSubServices(b);
                                  if (subList.length === 0) return null;
                                  return (
                                    <div className="text-[10px] text-purple-700 font-bold pt-0.5 line-clamp-1" title={subList.map((s: any) => s.name).join(', ')}>
                                      + {subList.length} dịch vụ lẻ
                                    </div>
                                  );
                                })()}
                                {b.discountAmount ? (
                                  <span className="inline-block text-[9px] bg-red-50 text-red-600 font-black px-1 rounded">Đã giảm 10% (trễ)</span>
                                ) : null}
                              </td>
                              <td className="px-6 py-4 font-semibold text-xs text-gray-700">
                                {b.staff ? `✨ ${b.staff.name}` : <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Chưa phân công</span>}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${statusStyle}`}>
                                  {b.status === 'PENDING' ? '🚨 Chờ xác nhận' : b.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-col items-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedBookingDetail(b)}
                                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <Eye className="size-3.5" /> Xem chi tiết
                                  </button>

                                  {b.status === 'PENDING' && (
                                    <button
                                      onClick={() => setSelectedBookingDetail(b)}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-extrabold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                    >
                                      ✓ Xác nhận & Gán NV
                                    </button>
                                  )}

                                  {canReschedule && (
                                    <button
                                      onClick={() => {
                                        setRescheduleBooking(b);
                                        setRescheduleDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
                                        setSelectedRescheduleSlot('');
                                      }}
                                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-750 border border-purple-200 rounded-lg text-xs font-black flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                    >
                                      <Calendar className="size-3.5" /> Đổi lịch
                                    </button>
                                  )}

                                  {isLateOfferable && (
                                    <button
                                      onClick={() => handleApplyLateDiscount(b.id)}
                                      className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-extrabold transition cursor-pointer"
                                      title="Khách chờ >30p chưa được làm: Giảm giá 10% tự động"
                                    >
                                      🎁 Giảm 10%
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-gray-400">Không tìm thấy lịch hẹn phù hợp.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: SLOTS (TIME SLOTS MANAGEMENT) */}
          {currentTab === 'slots' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900">Quản lý thời gian & Nhân viên khả dụng</h2>
                  <p className="text-sm font-semibold text-gray-500">Xem tất cả mốc thời gian 30p của ngày và danh sách kỹ thuật viên rảnh rỗi.</p>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    className="h-10 rounded-xl border border-gray-150 bg-white px-3 py-1.5 text-sm font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  />
                </div>
              </div>

              {loadingSlots ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <span className="ml-2 text-sm font-bold text-gray-500">Đang tải lịch rảnh nhân viên...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Slots Table */}
                  <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden p-5 space-y-4">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Khung giờ buổi sáng (9:00 - 12:00)</h3>
                    <div className="divide-y">
                      {slotsData.slice(0, 6).map((slot: any) => (
                        <div key={slot.time} className="py-3 flex items-center justify-between">
                          <span className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                            <Clock className="size-4 text-primary" />
                            {slot.time}
                          </span>
                          <div className="text-right">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${
                              slot.isAvailable ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {slot.isAvailable ? `${slot.remainingSlots} nhân viên rảnh` : 'Bận hết'}
                            </span>
                            <p className="text-[10px] text-gray-400 font-semibold mt-1">
                              {slot.isAvailable ? slot.availableStaffs.map((s: any) => s.name).join(', ') : 'Tất cả nhân viên bận lịch'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden p-5 space-y-4">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Khung giờ buổi chiều (14:00 - 18:00)</h3>
                    <div className="divide-y">
                      {slotsData.slice(6).map((slot: any) => (
                        <div key={slot.time} className="py-3 flex items-center justify-between">
                          <span className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                            <Clock className="size-4 text-primary" />
                            {slot.time}
                          </span>
                          <div className="text-right">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${
                              slot.isAvailable ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {slot.isAvailable ? `${slot.remainingSlots} nhân viên rảnh` : 'Bận hết'}
                            </span>
                            <p className="text-[10px] text-gray-400 font-semibold mt-1">
                              {slot.isAvailable ? slot.availableStaffs.map((s: any) => s.name).join(', ') : 'Tất cả nhân viên bận lịch'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: STAFFS */}
          {currentTab === 'staffs' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-black text-gray-900">Quản lý nhân viên chi nhánh & Hiệu suất ca làm</h2>
                <p className="text-sm font-semibold text-gray-500">Theo dõi tỷ lệ hoàn thành Đúng hạn / Trễ hạn và tổng doanh thu của từng kỹ thuật viên.</p>
              </div>

              {/* Staffs Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staffs.length > 0 ? (
                  staffs.map((s: any) => (
                    <div
                      key={s.id}
                      className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col justify-between h-full space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        {s.avatarUrl ? (
                          <img
                            src={s.avatarUrl}
                            alt={s.name}
                            className="size-12 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="size-12 rounded-full bg-purple-100 flex items-center justify-center font-black text-purple-750 text-sm border border-purple-200">
                            {s.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-extrabold text-sm text-gray-900 leading-tight">{s.name}</h4>
                          <p className="text-[11px] text-gray-450 font-bold leading-normal">{s.email}</p>
                          <span className="inline-block mt-1 text-[9px] bg-purple-50 text-purple-700 font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Nhân viên Spa</span>
                        </div>
                      </div>

                      {/* Performance metrics breakdown */}
                      <div className="space-y-2 border-t pt-4">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-gray-500">Tỷ lệ đúng hẹn:</span>
                          <span className={`font-black ${s.onTimeRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {s.onTimeRate ?? 100}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${s.onTimeRate ?? 100}%` }}
                            className={`h-full rounded-full transition-all ${s.onTimeRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-emerald-700 block font-bold">✅ Đúng hẹn</span>
                            <span className="text-base font-black text-emerald-800 block mt-0.5">{s.onTimeCount || 0} ca</span>
                          </div>
                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-rose-700 block font-bold">⚠️ Trễ hẹn</span>
                            <span className="text-base font-black text-rose-800 block mt-0.5">{s.lateCount || 0} ca</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-gray-400 block font-bold">Đã hoàn thành</span>
                            <span className="text-sm font-black text-gray-800 block mt-0.5">{s.completedCount}</span>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] text-gray-400 block font-bold">Đang xử lý</span>
                            <span className="text-sm font-black text-amber-600 block mt-0.5">{s.activeCount}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-3 flex justify-between items-center">
                        <span className="text-[11px] text-gray-400 font-bold uppercase">Doanh thu tạo ra:</span>
                        <span className="text-base font-black text-primary">{(s.revenue || 0).toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-16 text-center text-gray-400 bg-white border rounded-2xl">
                    Không tìm thấy nhân viên nào ở chi nhánh này.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* CONFIRMATION POPUP FOR STAFF ASSIGNMENT */}
      {assignConfirmBooking && assignConfirmStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-150 p-6 shadow-2xl space-y-4 relative animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Xác nhận phân công</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn phân công lịch hẹn dịch vụ <span className="font-extrabold text-primary">{assignConfirmBooking.serviceName}</span> cho kỹ thuật viên <span className="font-extrabold text-purple-700">{assignConfirmStaff.name}</span> không?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={assigningLoading}
                onClick={() => {
                  setAssignConfirmBooking(null);
                  setAssignConfirmStaff(null);
                }}
                className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                disabled={assigningLoading}
                onClick={handleAssignStaff}
                className="px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#cf5017]"
              >
                {assigningLoading ? 'Đang giao...' : 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-150 p-6 shadow-2xl space-y-5 my-8 relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setRescheduleBooking(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="size-5" />
            </button>
            
            <div>
              <h3 className="text-base font-black text-gray-900">Đổi lịch hẹn Spa</h3>
              <p className="text-xs text-gray-450 mt-1 font-semibold">Khách hàng: {rescheduleBooking.user?.name || 'Khách hàng'} ({rescheduleBooking.petName || 'Bé cưng'}) • Dịch vụ: {rescheduleBooking.service?.name}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] text-gray-400 font-bold uppercase">1. Chọn ngày mới</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setSelectedRescheduleSlot('');
                  }}
                  className="w-full h-10 border rounded-xl px-3 py-1.5 text-sm font-bold text-gray-700 bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-gray-400 font-bold uppercase">2. Chọn khung giờ khả dụng</label>
                {loadingRescheduleSlots ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                ) : rescheduleSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {rescheduleSlots.map((slot: any) => (
                      <button
                        key={slot.time}
                        disabled={!slot.isAvailable}
                        onClick={() => setSelectedRescheduleSlot(slot.time)}
                        className={`py-2 px-1 border rounded-lg text-center transition flex flex-col items-center justify-center ${
                          !slot.isAvailable
                            ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                            : selectedRescheduleSlot === slot.time
                            ? 'bg-primary border-primary text-white shadow-sm font-bold'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-primary'
                        }`}
                      >
                        <span className="text-xs font-black">{slot.time}</span>
                        {slot.isAvailable && (
                          <span className={`text-[9px] mt-0.5 ${selectedRescheduleSlot === slot.time ? 'text-white' : 'text-gray-400'}`}>
                            {slot.remainingSlots} chỗ
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-450 italic py-2">Chọn ngày để xem các khung giờ.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                disabled={submittingReschedule}
                onClick={() => setRescheduleBooking(null)}
                className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50"
              >
                Hủy bỏ
              </button>
              <button
                disabled={submittingReschedule || !selectedRescheduleSlot}
                onClick={handleRescheduleSubmit}
                className="px-5 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#cf5017] disabled:opacity-50"
              >
                {submittingReschedule ? 'Đang đổi...' : 'Xác nhận đổi lịch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SERVICE MODAL (ADD / EDIT) */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-150 p-6 shadow-2xl space-y-4 my-8 relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setServiceModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-base font-black text-gray-900">{editingService ? 'Chỉnh sửa dịch vụ Spa' : 'Thêm dịch vụ Spa mới'}</h3>
              <p className="text-xs text-gray-450 mt-1 font-semibold">Tạo hoặc cập nhật mốc cân nặng, giá và nhóm thương hiệu dịch vụ.</p>
            </div>

            <form onSubmit={handleServiceSubmit} className="space-y-4">
              
              {/* Brand & Main/Sub Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Thương hiệu Spa (SpaBrand) *</label>
                  <select
                    required
                    value={serviceForm.brandId}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, brandId: e.target.value }))}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">-- Chọn thương hiệu --</option>
                    {filteredBrandsForForm.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Phân loại dịch vụ *</label>
                  <select
                    value={serviceForm.isMain ? 'MAIN' : 'SUB'}
                    onChange={(e) => handleClassificationChange(e.target.value === 'MAIN')}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="MAIN">Dịch vụ chính</option>
                    <option value="SUB">Dịch vụ lẻ</option>
                  </select>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Tên dịch vụ *</label>
                <input
                  type="text"
                  required
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-bold"
                  placeholder="Ví dụ: SPA Cắt tỉa lông (Chó 3-6kg)"
                />
              </div>

              {/* Species & Weight Bracket */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Loài áp dụng</label>
                  <select
                    value={serviceForm.species}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, species: e.target.value as any }))}
                    className="w-full h-10 border rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-800 bg-white"
                  >
                    <option value="ALL">🐾 Tất cả loài</option>
                    <option value="DOG">🐕 Chó</option>
                    <option value="CAT">🐈 Mèo</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Cân nặng từ (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={serviceForm.petWeightMin}
                    onChange={(e) => handleMinWeightChange(e.target.value)}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-semibold"
                    placeholder="Ví dụ: 1.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Cân nặng đến (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={serviceForm.petWeightMax}
                    onChange={(e) => handleMaxWeightChange(e.target.value)}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-semibold"
                    placeholder="Ví dụ: 3.0"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Mô tả chi tiết</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full min-h-[60px] border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white"
                  placeholder="Mô tả công việc và ưu đãi dịch vụ..."
                />
              </div>

              {/* Price & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Giá dịch vụ (đ) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-black text-primary bg-white"
                    placeholder="150000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Thời gian thực hiện (phút) *</label>
                  <input
                    type="number"
                    required
                    min={10}
                    value={serviceForm.durationMin}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, durationMin: e.target.value, durationMax: e.target.value }))}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-bold"
                    placeholder="60"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="service-active"
                  checked={serviceForm.isActive}
                  onChange={(e) => setServiceForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="accent-primary size-4"
                />
                <label htmlFor="service-active" className="text-xs font-bold text-gray-700">Dịch vụ đang hoạt động khả dụng</label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingService}
                  className="px-6 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#cf5017] cursor-pointer"
                >
                  {submittingService ? 'Đang lưu...' : 'Lưu dịch vụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Booking Detail & Management Modal */}
      {selectedBookingDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-mono text-gray-400 block font-bold">MÃ LỊCH: #{selectedBookingDetail.id.slice(-6).toUpperCase()}</span>
                <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                  <Scissors className="size-5 text-primary" /> Chi Tiết Lịch Hẹn Spa
                </h3>
              </div>
              <button onClick={() => setSelectedBookingDetail(null)} className="rounded-full p-1 text-gray-400 hover:text-gray-600">
                <X className="size-5" />
              </button>
            </div>

            {/* Customer & Pet Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50 p-3.5 rounded-xl border border-gray-150">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Khách hàng</span>
                <p className="font-extrabold text-gray-900">{selectedBookingDetail.user?.name || 'Khách hàng'}</p>
                {selectedBookingDetail.user?.phone && (
                  <p className="text-gray-600 font-semibold">📞 SĐT: {selectedBookingDetail.user.phone}</p>
                )}
                {selectedBookingDetail.user?.email && (
                  <p className="text-gray-500 font-medium truncate">{selectedBookingDetail.user.email}</p>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Thú cưng</span>
                <p className="font-extrabold text-purple-950">🐾 {selectedBookingDetail.petName || selectedBookingDetail.pet?.name || 'Thú cưng'}</p>
                <p className="text-gray-600 font-semibold">
                  {selectedBookingDetail.petSpecies === 'CAT' ? '🐱 Mèo' : '🐶 Chó'} • {selectedBookingDetail.petWeight || 3}kg
                </p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-bold text-purple-800 uppercase block">Thời gian hẹn</span>
                <span className="font-black text-sm text-purple-950">
                  {new Date(selectedBookingDetail.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — {new Date(selectedBookingDetail.scheduledAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
                {
                  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
                  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-300',
                  ASSIGNED: 'bg-indigo-100 text-indigo-800 border-indigo-300',
                  IN_PROGRESS: 'bg-orange-100 text-orange-800 border-orange-300',
                  COMPLETED: 'bg-green-100 text-green-800 border-green-300',
                  CANCELLED: 'bg-red-100 text-red-800 border-red-300',
                  NO_SHOW: 'bg-gray-100 text-gray-800 border-gray-300',
                  LATE: 'bg-rose-100 text-rose-800 border-rose-300',
                }[selectedBookingDetail.status as string] || 'bg-gray-100 text-gray-800'
              }`}>
                {selectedBookingDetail.status === 'PENDING' ? '🚨 Chờ xác nhận' : selectedBookingDetail.status}
              </span>
            </div>

            {/* Services List */}
            <div className="space-y-2 text-xs">
              <span className="font-extrabold text-gray-800 uppercase text-[10px] tracking-wider block">Dịch vụ chính & Dịch vụ phụ:</span>
              <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center font-black text-gray-900">
                  <span>✂️ Dịch vụ chính: {selectedBookingDetail.service?.name || 'Gói Chăm Sóc Spa'}</span>
                  <span>{(selectedBookingDetail.service?.price || selectedBookingDetail.priceSnapshot || 0).toLocaleString('vi-VN')}đ</span>
                </div>

                {(() => {
                  const subList = getManagerBookingSubServices(selectedBookingDetail);
                  if (subList.length === 0) {
                    return <p className="text-[11px] text-gray-400 italic pt-1.5 border-t border-gray-150">Không có dịch vụ lẻ đi kèm.</p>;
                  }
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-gray-150">
                      <span className="text-[10px] font-extrabold text-purple-900 block uppercase">
                        Dịch vụ lẻ chọn thêm ({subList.length}):
                      </span>
                      <div className="space-y-1">
                        {subList.map((sub: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-green-50/70 p-2 rounded-lg border border-green-150 text-xs">
                            <span className="font-extrabold text-gray-900 flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-green-600 shrink-0" />
                              {sub.name}
                            </span>
                            <span className="text-green-700 font-black">+ {(sub.price || 0).toLocaleString('vi-VN')}đ</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-2 border-t border-gray-200 flex justify-between items-center font-black text-sm text-purple-950">
                  <span>Tổng thanh toán:</span>
                  <span>{(selectedBookingDetail.totalPrice || selectedBookingDetail.priceSnapshot || 0).toLocaleString('vi-VN')}đ</span>
                </div>
              </div>
            </div>

            {/* Staff Assignment Section inside Modal */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
              <span className="font-extrabold text-gray-800 block text-[10px] uppercase">Nhân viên phụ trách:</span>
              {selectedBookingDetail.staff ? (
                <div className="flex items-center gap-2 font-bold text-gray-900 bg-white p-2 rounded-lg border">
                  <span className="size-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-black text-xs">
                    {selectedBookingDetail.staff.name.slice(0, 1)}
                  </span>
                  <div>
                    <p>{selectedBookingDetail.staff.name}</p>
                    <p className="text-[10px] text-gray-500 font-normal">{selectedBookingDetail.staff.email}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-amber-800 font-bold italic text-[11px]">⚠️ Đơn chưa được phân công nhân viên phụ trách ca làm.</p>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedAssignStaffMap[selectedBookingDetail.id] || ''}
                      onChange={(e) => setSelectedAssignStaffMap(prev => ({ ...prev, [selectedBookingDetail.id]: e.target.value }))}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                    >
                      <option value="">-- Chọn nhân viên phụ trách --</option>
                      {managerStaffs.map((st: any) => (
                        <option key={st.id} value={st.id}>
                          👤 {st.user?.name || st.name} ({st.user?.phone || 'NV Spa'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t">
              {selectedBookingDetail.status === 'PENDING' && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await spaApi.confirmBooking(selectedBookingDetail.id);
                      const staffIdToAssign = selectedAssignStaffMap[selectedBookingDetail.id];
                      if (staffIdToAssign) {
                        await spaApi.assignStaff(selectedBookingDetail.id, staffIdToAssign);
                        toast.success('Đã xác nhận đơn hàng và phân công nhân viên!');
                      } else {
                        toast.success('Đã xác nhận đơn hàng thành công!');
                      }
                      setSelectedBookingDetail(null);
                      refreshData();
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || 'Lỗi xác nhận.');
                    }
                  }}
                  className="bg-primary hover:bg-primary/90 text-white font-black text-xs h-9 px-4 rounded-lg shadow-sm transition cursor-pointer"
                >
                  ✓ Xác nhận đơn & Phân công
                </button>
              )}

              {selectedBookingDetail.status === 'CONFIRMED' && !selectedBookingDetail.staffId && (
                <button
                  type="button"
                  onClick={async () => {
                    const staffIdToAssign = selectedAssignStaffMap[selectedBookingDetail.id];
                    if (!staffIdToAssign) {
                      toast.error('Vui lòng chọn nhân viên trước khi xác nhận.');
                      return;
                    }
                    try {
                      await spaApi.assignStaff(selectedBookingDetail.id, staffIdToAssign);
                      toast.success('Đã phân công nhân viên thành công!');
                      setSelectedBookingDetail(null);
                      refreshData();
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || 'Lỗi phân công.');
                    }
                  }}
                  disabled={!selectedAssignStaffMap[selectedBookingDetail.id]}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs h-9 px-4 rounded-lg shadow-sm transition cursor-pointer"
                >
                  👤 Phân công Nhân viên
                </button>
              )}

              {['PENDING', 'CONFIRMED', 'CHECK_IN', 'ARRIVED', 'ASSIGNED', 'LATE'].includes(selectedBookingDetail.status) && (
                <button
                  type="button"
                  onClick={() => {
                    const b = selectedBookingDetail;
                    setSelectedBookingDetail(null);
                    setRescheduleBooking(b);
                    setRescheduleDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
                    setSelectedRescheduleSlot('');
                  }}
                  className="border border-purple-300 text-purple-800 hover:bg-purple-50 font-black text-xs h-9 px-3 gap-1 rounded-lg transition cursor-pointer flex items-center"
                >
                  <Calendar className="size-3.5 mr-1" /> Đổi lịch hẹn
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedBookingDetail(null)}
                className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL (ADD / EDIT) */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-150 p-6 shadow-2xl space-y-4 my-8 relative animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setCategoryModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-base font-black text-gray-900">{editingCategory ? 'Chỉnh sửa danh mục Spa' : 'Thêm danh mục Spa mới'}</h3>
              <p className="text-xs text-gray-450 mt-1 font-semibold">Tạo nhóm phân loại cho các gói dịch vụ chính hoặc dịch vụ lẻ.</p>
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Tên danh mục *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white font-bold"
                  placeholder="Ví dụ: Tắm & Sấy, Cắt tỉa lông..."
                />
              </div>

              {/* Classification */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Phân loại danh mục *</label>
                <select
                  value={categoryForm.isMain ? 'MAIN' : 'SUB'}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, isMain: e.target.value === 'MAIN' }))}
                  className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="MAIN">Dịch vụ chính</option>
                  <option value="SUB">Dịch vụ lẻ</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 font-extrabold uppercase">Mô tả danh mục</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full min-h-[60px] border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white"
                  placeholder="Mô tả nhóm danh mục..."
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="catIsActive"
                  checked={categoryForm.status === 'ACTIVE'}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, status: e.target.checked ? 'ACTIVE' : 'SUSPENDED' }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary size-4"
                />
                <label htmlFor="catIsActive" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Danh mục đang hoạt động khả dụng
                </label>
              </div>

              {/* Submit buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingCategory}
                  className="px-5 py-2 bg-primary text-white rounded-xl font-bold text-xs hover:bg-[#cf5017] disabled:opacity-50"
                >
                  {submittingCategory ? 'Đang lưu...' : (editingCategory ? 'Cập nhật' : 'Lưu danh mục')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}