'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
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
  PROCESSING: 'Đang chuẩn bị',
  SHIPPED: 'Đã gửi bên giao hàng',
  DELIVERED: 'Đã hoàn thành',
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
  const router = useRouter();
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

  useEffect(() => {
    if (role === 'SPA_MANAGER') {
      router.replace('/managerSpa');
    }
  }, [role, router]);

  if (!role || role === 'SPA_MANAGER') {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--primary-color)]" />
        <span className="ml-2 text-sm font-bold text-[var(--text-muted)]">
          {role === 'SPA_MANAGER' ? 'Đang chuyển tới trang Quản lý Spa...' : 'Đang tải...'}
        </span>
      </div>
    );
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
    onConfirm: () => { },
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

  // Excel Import & Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportOnlyPendingGhn, setExportOnlyPendingGhn] = useState(false);
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
      const [statsRes, productsRes, ordersRes, customersRes, settingsRes, categoriesRes, unitsRes] = await Promise.all([
        managerApi.getDashboardStats(),
        managerApi.getProducts(),
        managerApi.getOrders(),
        managerApi.getCustomers(),
        managerApi.getStoreSettings(),
        productsApi.getCategories(),
        managerApi.getProductUnits(),
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data);
      setOrders(ordersRes.data);
      setCustomers(customersRes.data);
      setStoreInfo(settingsRes.data);
      setCategories(categoriesRes.data);
      setUnits(unitsRes.data);
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
        (filterStatus === 'IN_STOCK' && (product.stock ?? 0) > 0) ||
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
  }, [searchQuery, filterStatus]);

  useEffect(() => {
    setCustomersPage(1);
  }, [customerSearch, customerSortBy, customerFilterNew]);

  useEffect(() => {
    setProductsPage(1);
  }, [searchQuery, filterStatus, filterCategory, sortBy]);

  const eligibleOrdersForGhn = useMemo(() => {
    return filteredOrders.filter(
      (o) =>
        !o.ghnOrderCode &&
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
    setExportOnlyPendingGhn(false);
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
        onlyPendingGhn: exportOnlyPendingGhn || undefined,
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
      if (exportOnlyPendingGhn) {
        filename += '_chua_gui_ghn';
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

  const handleOrderStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await managerApi.updateOrderStatus(orderId, newStatus);
      toast.success('Cập nhật trạng thái đơn hàng thành công!');
      // Refresh only orders
      const res = await managerApi.getOrders();
      setOrders(res.data);
    } catch (error) {
      console.error('Failed to update order status', error);
      toast.error('Lỗi khi cập nhật trạng thái đơn hàng.');
    }
  };

  const [sendingGhnId, setSendingGhnId] = useState<string | null>(null);

  const handleSendToGhn = async (orderId: string) => {
    setSendingGhnId(orderId);
    try {
      await managerApi.createShippingOrder(orderId);
      toast.success('Gửi đơn hàng sang GHN thành công!');
      const res = await managerApi.getOrders();
      setOrders(res.data);
    } catch (error: any) {
      console.error('Failed to create shipping order', error);
      toast.error(error.response?.data?.message || 'Lỗi khi tạo vận đơn GHN.');
    } finally {
      setSendingGhnId(null);
    }
  };

  const [refundingId, setRefundingId] = useState<string | null>(null);

  const handleApproveRefund = async (orderId: string) => {
    setRefundingId(orderId);
    try {
      await managerApi.approveRefund(orderId);
      toast.success('Đã duyệt yêu cầu hoàn tiền thành công! Tiền đã được chuyển khoản qua PayOS.');
      const res = await managerApi.getOrders();
      setOrders(res.data);
      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails(res.data.find((o) => o.id === orderId) || null);
      }
    } catch (error: any) {
      console.error('Failed to approve refund', error);
      toast.error(error.response?.data?.message || 'Lỗi khi phê duyệt hoàn tiền qua PayOS.');
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

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkShipping, setIsBulkShipping] = useState<boolean>(false);

  const handleBulkSendToGhn = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkShipping(true);
    let successCount = 0;
    let failCount = 0;

    for (const orderId of selectedOrderIds) {
      try {
        await managerApi.createShippingOrder(orderId);
        successCount++;
      } catch (err) {
        console.error(`Failed to send order ${orderId} to GHN`, err);
        failCount++;
      }
    }

    setIsBulkShipping(false);
    setSelectedOrderIds([]);

    if (successCount > 0) {
      toast.success(`Đã gửi thành công ${successCount} đơn hàng sang GHN! Trạng thái: "Đã gửi bên giao hàng"`);
    }
    if (failCount > 0) {
      toast.error(`Có ${failCount} đơn hàng không gửi được do thiếu thông tin địa chỉ GHN.`);
    }

    // Refresh orders
    const res = await managerApi.getOrders();
    setOrders(res.data);
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

  const handleAddClick = () => {
    setEditingProduct(null);
    setSpecList([{ key: '', value: '' }, { key: '', value: '' }]);
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

      const data: Partial<ManagerProduct> = {
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
                  <option value="IN_STOCK">Còn hàng</option>
                  <option value="OUT_OF_STOCK">Hết hàng</option>
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
                        <tr key={p.id} className="transition hover:bg-[#FDFDFD]">
                          <td className="px-6 py-4 font-mono font-black text-xs text-[#5C5B52]">{p.id.slice(0, 8)}...</td>
                          <td className="px-6 py-4 font-bold text-[var(--text-main)]">
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
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleViewFeedback(p)}
                                className="p-1 text-gray-500 hover:text-blue-600 transition"
                                title="Xem đánh giá & feedback"
                              >
                                <MessageSquare className="size-4" />
                              </button>
                              <button
                                onClick={() => handleEditClick(p)}
                                className="p-1 text-gray-500 hover:text-primary transition"
                                title="Sửa sản phẩm"
                              >
                                <Edit2 className="size-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1 text-gray-500 hover:text-red-600 transition"
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="w-full max-w-lg rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-4 my-8 relative">
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="size-5" />
                </button>
                <h3 className="text-lg font-black text-[var(--text-main)] pb-2 border-b">
                  {editingProduct ? 'Sửa thông tin sản phẩm' : 'Thêm sản phẩm mới'}
                </h3>
                <form onSubmit={handleProductSubmit} className="space-y-4 text-xs font-semibold">
                  <div>
                    <label className="block text-xs font-bold mb-1">Tên sản phẩm *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Royal Canin Corgi Adult 3kg"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-1">Danh mục *</label>
                      <select
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.slug}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Thú cưng mục tiêu</label>
                      <select
                        value={productForm.targetSpecies}
                        onChange={(e) => setProductForm({ ...productForm, targetSpecies: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      >
                        <option value="ALL">Tất cả loài</option>
                        <option value="DOG">Chó</option>
                        <option value="CAT">Mèo</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-1">Giá nhập</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="VND (khuyên dùng)"
                        value={productForm.importPrice}
                        onChange={(e) => setProductForm({ ...productForm, importPrice: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Giá bán *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="VND"
                        value={productForm.sellingPrice}
                        onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Giá khuyến mãi</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="VND (nếu có)"
                        value={productForm.salePrice}
                        onChange={(e) => setProductForm({ ...productForm, salePrice: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Số lượng tồn kho</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Hết hàng nếu trống"
                        value={productForm.stock}
                        onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                    <div>
                      <label className="block text-xs font-bold mb-1">Đơn vị tính *</label>
                      <select
                        required
                        value={productForm.unit || ''}
                        onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                        className="w-full h-[46px] rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none text-xs font-semibold"
                      >
                        <option value="">-- Chọn đơn vị tính --</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">Ảnh sản phẩm</label>

                    {/* Live Preview Box */}
                    {productForm.imageUrl && (
                      <div className="relative mb-3 aspect-video w-full max-w-[200px] overflow-hidden rounded-xl border border-[#EFEAE2] bg-gray-50">
                        <img
                          src={productForm.imageUrl}
                          alt="Product Preview"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, imageUrl: '' })}
                          className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                          aria-label="Xóa ảnh"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="file"
                        id="product-image-file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingImage(true);
                          try {
                            const [uploaded] = await uploadImages([file], 'product');
                            setProductForm({ ...productForm, imageUrl: uploaded.url });
                            toast.success('Tải ảnh lên thành công!');
                          } catch (err) {
                            console.error('Failed to upload product image', err);
                            toast.error('Tải ảnh lên thất bại.');
                          } finally {
                            setUploadingImage(false);
                            // Clear input file value so selecting same file works again
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => document.getElementById('product-image-file')?.click()}
                        className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--primary-color)] px-4 font-bold text-[var(--primary-color)] transition hover:bg-[var(--primary-color)]/5 disabled:opacity-50"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Đang tải lên...
                          </>
                        ) : (
                          <>
                            <Plus className="size-4" />
                            Tải ảnh lên từ thiết bị
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-2.5">
                      <p className="text-[10px] text-[var(--text-muted)] mb-1">Hoặc điền trực tiếp đường dẫn ảnh (URL):</p>
                      <input
                        type="text"
                        placeholder="https://images.unsplash.com/..."
                        value={productForm.imageUrl}
                        onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Specifications Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-[var(--text-main)]">Thông số kỹ thuật sản phẩm (Tùy chọn)</label>
                      <button
                        type="button"
                        onClick={() => setSpecList([...specList, { key: '', value: '' }])}
                        className="text-xs font-bold text-[var(--primary-color)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="size-3" /> Thêm dòng mới
                      </button>
                    </div>

                    {specList.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto p-1 border border-dashed border-gray-200 rounded-xl bg-[#F9F8F6]/50">
                        {specList.map((spec, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Tên thông số (ví dụ: Chiều dài)"
                              value={spec.key}
                              onChange={(e) => {
                                const newList = [...specList];
                                newList[idx].key = e.target.value;
                                setSpecList(newList);
                              }}
                              className="flex-1 rounded-xl border border-[#EFEAE2] bg-white px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] text-xs font-semibold"
                            />
                            <input
                              type="text"
                              placeholder="Giá trị (ví dụ: 100cm)"
                              value={spec.value}
                              onChange={(e) => {
                                const newList = [...specList];
                                newList[idx].value = e.target.value;
                                setSpecList(newList);
                              }}
                              className="flex-1 rounded-xl border border-[#EFEAE2] bg-white px-3.5 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--primary-color)] text-xs font-semibold"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newList = specList.filter((_, sIdx) => sIdx !== idx);
                                setSpecList(newList.length > 0 ? newList : [{ key: '', value: '' }, { key: '', value: '' }]);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 transition cursor-pointer"
                              title="Xóa thông số này"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-450 italic">Chưa có thông số kỹ thuật nào. Click "Thêm dòng mới" để tạo.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">Mô tả sản phẩm</label>
                    <textarea
                      placeholder="Mô tả công dụng, thành phần, cách sử dụng..."
                      rows={3}
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-4 items-center pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={productForm.isFeatured}
                        onChange={(e) => setProductForm({ ...productForm, isFeatured: e.target.checked })}
                        className="accent-[var(--primary-color)]"
                      />
                      Sản phẩm nổi bật (Featured)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={productForm.isActive}
                        onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                        className="accent-[var(--primary-color)]"
                      />
                      Mở bán sản phẩm (Active)
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setIsProductModalOpen(false)}
                      className="rounded-xl border px-5 py-2.5 font-bold hover:bg-gray-50 transition"
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
                                                const catRes = await productsApi.getCategories();
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
                                const catRes = await productsApi.getCategories();
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

          {/* Bulk Action Bar */}
          {selectedOrderIds.length > 0 && (
            <div className="flex items-center justify-between bg-[#0F766E]/10 border border-[#0F766E]/30 rounded-xl px-4 py-3 animate-in fade-in duration-150">
              <div className="text-xs font-bold text-[#0F766E] flex items-center gap-2">
                <span>Đã chọn <strong>{selectedOrderIds.length}</strong> đơn hàng chưa gửi GHN</span>
              </div>
              <button
                type="button"
                disabled={isBulkShipping}
                onClick={handleBulkSendToGhn}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-white bg-[#0F766E] hover:bg-[#115E59] rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isBulkShipping ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Đang gửi GHN...
                  </>
                ) : (
                  <>
                    🚚 Gửi {selectedOrderIds.length} đơn sang GHN
                  </>
                )}
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-[#EFEAE2] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EFEAE2] bg-[#F9F8F6] text-xs font-black uppercase text-[#8A8980]">
                    <th className="px-4 py-4 text-center w-10">
                      <input
                        type="checkbox"
                        disabled={eligibleOrdersForGhn.length === 0}
                        checked={
                          eligibleOrdersForGhn.length > 0 &&
                          eligibleOrdersForGhn.every((o) => selectedOrderIds.includes(o.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrderIds(eligibleOrdersForGhn.map((o) => o.id));
                          } else {
                            setSelectedOrderIds([]);
                          }
                        }}
                        className="size-4 accent-[#0F766E] rounded cursor-pointer disabled:cursor-not-allowed"
                        title="Chọn tất cả đơn chưa gửi GHN"
                      />
                    </th>

                    <th className="px-6 py-4">Mã đơn</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">SĐT</th>
                    <th className="px-6 py-4">Địa chỉ giao hàng</th>
                    <th className="px-6 py-4">Sản phẩm mua</th>
                    <th className="px-6 py-4">Ngày đặt</th>
                    <th className="px-6 py-4 text-right">Tổng thanh toán</th>
                    <th className="px-6 py-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2]">
                  {paginatedOrders.length > 0 ? (
                    paginatedOrders.map((o) => {
                      const shippingInfo = parseShippingAddress(o.shippingAddress);
                      return (
                        <tr
                          key={o.id}
                          onClick={() => setSelectedOrderDetails(o)}
                          className="transition hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            {!o.ghnOrderCode &&
                              o.status !== 'CANCELLED' &&
                              o.status !== 'SHIPPED' &&
                              o.status !== 'DELIVERED' &&
                              o.refundStatus !== 'PENDING' &&
                              o.refundStatus !== 'REFUNDED' ? (
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.includes(o.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedOrderIds((prev) => [...prev, o.id]);
                                  } else {
                                    setSelectedOrderIds((prev) => prev.filter((id) => id !== o.id));
                                  }
                                }}
                                className="size-4 accent-[#0F766E] rounded cursor-pointer"
                              />
                            ) : null}
                          </td>
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
                            ) : o.ghnOrderCode || o.status === 'SHIPPED' ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                                Đã gửi GHN {o.ghnOrderCode ? `(${o.ghnOrderCode})` : ''}
                              </span>
                            ) : o.status === 'DELIVERED' ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm">
                                🎉 Đã hoàn thành
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={sendingGhnId === o.id}
                                onClick={() => handleSendToGhn(o.id)}
                                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-black text-white bg-[#0F766E] rounded-xl hover:bg-[#115E59] shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                {sendingGhnId === o.id ? (
                                  <Loader2 className="size-3 animate-spin text-white" />
                                ) : (
                                  '🚚 '
                                )}
                                Gửi GHN
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-gray-400">Không tìm thấy đơn hàng nào.</td>
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
                          {selectedOrderDetails.refundStatus === 'PENDING' ? 'Chờ duyệt' : selectedOrderDetails.refundStatus === 'REFUNDED' ? 'Đã duyệt hoàn tiền' : 'Thất bại'}
                        </span>
                      </div>
                    </div>
                    {selectedOrderDetails.refundReason && (
                      <div className="pt-1.5 border-t border-amber-100 text-xs text-[#5C5B52]">
                        <span className="text-[10px] text-gray-500 block">Lý do hoàn:</span>
                        <span className="italic">"{selectedOrderDetails.refundReason}"</span>
                      </div>
                    )}
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
                      selectedOrderDetails.status === 'PROCESSING' && 'bg-blue-50 text-blue-700',
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
                        onClick={() => handleRejectRefund(selectedOrderDetails.id)}
                        className="rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-2 font-bold hover:bg-red-100 transition text-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        disabled={refundingId === selectedOrderDetails.id}
                        onClick={() => handleApproveRefund(selectedOrderDetails.id)}
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
                        checked={exportOnlyPendingGhn}
                        onChange={(e) => {
                          setExportOnlyPendingGhn(e.target.checked);
                          if (e.target.checked) setExportOnlyRefunded(false);
                        }}
                        className="size-4 rounded border-gray-300 text-[var(--primary-color)] focus:ring-[var(--primary-color)] accent-[var(--primary-color)] cursor-pointer"
                      />
                      <span className="text-xs text-gray-700 font-bold">
                        Chỉ xuất các đơn hàng chưa gửi cho GHN
                      </span>
                    </label>
                    <p className="text-[10px] text-gray-400 font-medium pl-6 leading-relaxed mb-3">
                      (Bỏ qua các đơn hàng đã bị hủy, đang giao hàng hoặc đã giao hàng thành công bằng đối tác khác).
                    </p>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={exportOnlyRefunded}
                        onChange={(e) => {
                          setExportOnlyRefunded(e.target.checked);
                          if (e.target.checked) setExportOnlyPendingGhn(false);
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