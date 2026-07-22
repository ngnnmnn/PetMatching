'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FileSpreadsheet,
  Filter,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { managerApi, ManagerProduct, ManagerOrder, ManagerCustomer, StoreSettings, ManagerDashboardStats } from '@/lib/api/manager';
import { productsApi } from '@/lib/api/products';
import { spaApi } from '@/lib/api/spa';
import { Category } from '@/types';

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
  SHIPPED: 'Đang vận chuyển',
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
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('DEFAULT');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [submittingCategory, setSubmittingCategory] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [submittingSettings, setSubmittingSettings] = useState(false);

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
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'ACCESSORY',
    targetSpecies: 'ALL',
    originalPrice: '',
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
      const [statsRes, productsRes, ordersRes, customersRes, settingsRes, categoriesRes] = await Promise.all([
        managerApi.getDashboardStats(),
        managerApi.getProducts(),
        managerApi.getOrders(),
        managerApi.getCustomers(),
        managerApi.getStoreSettings(),
        productsApi.getCategories(),
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data);
      setOrders(ordersRes.data);
      setCustomers(customersRes.data);
      setStoreInfo(settingsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Failed to fetch manager dashboard data', error);
      toast.error('Lỗi khi tải dữ liệu từ máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentTab]);

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
      const matchesStatus = filterStatus === 'ALL' || order.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, filterStatus]);

  const handleExportExcel = () => {
    toast.success('Xuất danh sách đơn hàng sang Excel thành công!');
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
    setProductForm({
      name: '',
      category: categories[0]?.slug || 'ACCESSORY',
      targetSpecies: 'ALL',
      originalPrice: '',
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
    setProductForm({
      name: product.name,
      category: product.category,
      targetSpecies: product.targetSpecies,
      originalPrice: String(product.originalPrice),
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

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.originalPrice) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    setSubmittingProduct(true);
    try {
      const data: Partial<ManagerProduct> = {
        name: productForm.name.trim(),
        category: productForm.category,
        targetSpecies: productForm.targetSpecies,
        originalPrice: Number(productForm.originalPrice),
        salePrice: productForm.salePrice ? Number(productForm.salePrice) : null,
        stock: productForm.stock ? Number(productForm.stock) : null,
        brand: productForm.brand.trim() || undefined,
        unit: productForm.unit.trim() || undefined,
        imageUrl: productForm.imageUrl.trim() || undefined,
        description: productForm.description.trim() || undefined,
        isFeatured: productForm.isFeatured,
        isActive: productForm.isActive,
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
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-[var(--primary-color)] text-[var(--primary-color)] bg-white px-4 py-2.5 font-bold shadow-sm transition hover:bg-[var(--primary-color)]/5 cursor-pointer"
              >
                <Plus className="size-4" />
                Thêm danh mục mới
              </button>
              <button
                type="button"
                onClick={handleAddClick}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary-color)] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#cf5017] cursor-pointer"
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
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] py-2.5 pl-10 pr-4 text-sm focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
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
                    <th className="px-6 py-4 text-right">Đơn giá</th>
                    <th className="px-6 py-4 text-center">Tồn kho</th>
                    <th className="px-6 py-4 text-center">Đã bán</th>
                    <th className="px-6 py-4 text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2]">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => {
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
                          <td className="px-6 py-4 text-right font-black text-[var(--primary-color)]">{currency.format(p.salePrice ?? p.originalPrice)}</td>
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

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-1">Đơn giá gốc *</label>
                      <input
                        type="number"
                        required
                        placeholder="VND"
                        value={productForm.originalPrice}
                        onChange={(e) => setProductForm({ ...productForm, originalPrice: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Giá khuyến mãi</label>
                      <input
                        type="number"
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
                      <label className="block text-xs font-bold mb-1">Đơn vị tính</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Bao 3kg, Cái"
                        value={productForm.unit}
                        onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                        className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">Đường dẫn ảnh sản phẩm</label>
                    <input
                      type="text"
                      placeholder="https://images.unsplash.com/..."
                      value={productForm.imageUrl}
                      onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                      className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none"
                    />
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

          {/* Category Modal */}
          {isCategoryModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="w-full max-w-md rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-2xl space-y-4 relative text-sm font-semibold">
                <button
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setNewCategoryName('');
                  }}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition animate-none cursor-pointer"
                >
                  <X className="size-5" />
                </button>
                <h3 className="text-lg font-black text-[var(--text-main)] pb-2 border-b">
                  Thêm danh mục sản phẩm mới
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newCategoryName.trim()) return;
                    setSubmittingCategory(true);
                    try {
                      await managerApi.createCategory({ name: newCategoryName });
                      toast.success('Thêm danh mục mới thành công!');
                      setIsCategoryModalOpen(false);
                      setNewCategoryName('');
                      // Refresh categories
                      const catRes = await productsApi.getCategories();
                      setCategories(catRes.data);
                    } catch (error: any) {
                      console.error(error);
                      toast.error(error.response?.data?.message || 'Lỗi khi tạo danh mục mới.');
                    } finally {
                      setSubmittingCategory(false);
                    }
                  }}
                  className="space-y-4 text-xs font-semibold"
                >
                  <div>
                    <label className="block text-xs font-bold mb-1">Tên danh mục *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Bát ăn & Uống"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-3.5 py-2.5 focus:bg-white focus:outline-none text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryModalOpen(false);
                        setNewCategoryName('');
                      }}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 font-bold hover:bg-gray-50 transition cursor-pointer text-sm"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submittingCategory}
                      className="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-4 py-2.5 font-bold text-white transition hover:bg-[#cf5017] disabled:bg-gray-300 cursor-pointer text-sm font-black"
                    >
                      {submittingCategory ? 'Đang tạo...' : 'Xác nhận'}
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
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] py-2.5 pl-10 pr-4 text-sm focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-[#B0B0B0]" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl border border-[#EFEAE2] bg-white px-3 py-2.5 text-sm font-bold text-[var(--text-main)] focus:outline-none"
              >
                <option value="ALL">Tất cả trạng thái</option>
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
                    <th className="px-6 py-4 text-center w-12"></th>
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
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((o) => {
                      const shippingInfo = parseShippingAddress(o.shippingAddress);
                      return (
                        <tr key={o.id} className="transition hover:bg-[#FDFDFD]">
                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderDetails(o)}
                              className="p-1 text-gray-500 hover:text-[var(--primary-color)] transition active:scale-95 cursor-pointer"
                              title="Xem chi tiết đơn hàng"
                            >
                              <Eye className="size-4" />
                            </button>
                          </td>
                          <td className="px-6 py-4 font-mono font-black text-xs text-[#5C5B52]" title={o.id}>
                            {o.id.length > 15 ? o.id.slice(0, 12) + '...' : o.id}
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
                          <td className="px-6 py-4 text-center">
                            <select
                              value={o.status}
                              onChange={(e) => handleOrderStatusChange(o.id, e.target.value)}
                              className={cn(
                                'rounded-full px-2 py-1 text-xs font-black border text-center focus:outline-none cursor-pointer',
                                o.status === 'DELIVERED' && 'bg-green-50 border-green-200 text-green-700',
                                o.status === 'PENDING' && 'bg-yellow-50 border-yellow-200 text-yellow-700',
                                o.status === 'PROCESSING' && 'bg-blue-50 border-blue-200 text-blue-700',
                                o.status === 'SHIPPED' && 'bg-purple-50 border-purple-200 text-purple-700',
                                o.status === 'CANCELLED' && 'bg-red-50 border-red-200 text-red-700',
                              )}
                            >
                              {Object.keys(ORDER_STATUS_MAP).map((status) => (
                                <option key={status} value={status} className="bg-white text-gray-800 font-semibold">
                                  {ORDER_STATUS_MAP[status]}
                                </option>
                              ))}
                            </select>
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
                
                <div className="flex justify-end pt-2 border-t">
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
        </div>
      );

    case 'customers':
      return (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-xl font-black">Danh sách khách hàng</h2>
            <p className="text-sm font-semibold text-[var(--text-muted)]">Danh sách khách hàng thực tế đăng ký tài khoản trên hệ thống.</p>
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
                  {customers.length > 0 ? (
                    customers.map((c) => (
                      <tr key={c.id} className="transition hover:bg-[#FDFDFD]">
                        <td className="px-6 py-4 font-mono font-black text-xs text-[#5C5B52]">{c.id.slice(0, 8)}...</td>
                        <td className="px-6 py-4 font-bold text-[var(--text-main)]">{c.name}</td>
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
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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

  // Assignment states
  const [availableStaffsMap, setAvailableStaffsMap] = useState<Record<string, any[]>>({});
  const [selectedAssignStaffMap, setSelectedAssignStaffMap] = useState<Record<string, string>>({});
  const [assignConfirmBooking, setAssignConfirmBooking] = useState<any | null>(null);
  const [assignConfirmStaff, setAssignConfirmStaff] = useState<{ id: string; name: string } | null>(null);
  const [assigningLoading, setAssigningLoading] = useState<boolean>(false);

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

  useEffect(() => {
    // Set default slot date to today
    setSlotDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Fetch branches and brands managed by this manager
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [branchesRes, brandsRes] = await Promise.all([
          spaApi.getManagerBranches(),
          spaApi.getManagerBrands(),
        ]);
        const bData = branchesRes.data || [];
        setBranches(bData);
        setManagerBrands(brandsRes.data || []);
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
    if (!selectedBranchId) return;
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
        const bookingsRes = await spaApi.getManagerBookings(selectedBranchId);
        setBookings(bookingsRes.data || []);
      } else if (currentTab === 'services') {
        const servicesRes = await spaApi.getManagerServices();
        setServices(servicesRes.data || []);
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

  // Service submit
  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name || !serviceForm.price || !serviceForm.durationMin || !serviceForm.brandId) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc và chọn Thương hiệu Spa.');
      return;
    }
    setSubmittingService(true);
    try {
      const data = {
        brandId: serviceForm.brandId,
        name: serviceForm.name,
        description: serviceForm.description,
        price: Number(serviceForm.price),
        durationMin: Number(serviceForm.durationMin),
        durationMax: serviceForm.durationMax ? Number(serviceForm.durationMax) : undefined,
        isMain: serviceForm.isMain,
        species: serviceForm.species === 'ALL' ? undefined : serviceForm.species,
        petWeightMin: serviceForm.petWeightMin ? Number(serviceForm.petWeightMin) : undefined,
        petWeightMax: serviceForm.petWeightMax ? Number(serviceForm.petWeightMax) : undefined,
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
    let brandId = managerBrands.length > 0 ? managerBrands[0].id : '';
    setServiceForm({
      brandId,
      name: '',
      description: '',
      price: '',
      durationMin: '60',
      durationMax: '',
      isMain: true,
      species: 'ALL',
      petWeightMin: '',
      petWeightMax: '',
      isActive: true
    });
    setServiceModalOpen(true);
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
                  <div>
                    <span className="text-[11px] font-black uppercase text-[#8A8980]">Lịch hẹn hôm nay</span>
                    <p className="text-2xl font-black text-gray-900 mt-1">{stats.todayBookingsCount}</p>
                  </div>
                  <div className="size-10 rounded-full bg-orange-55 shadow-inner flex items-center justify-center text-primary">
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
                <div className="p-5 border-b border-gray-150">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Lịch hẹn hôm nay ({stats.todayBookings?.length || 0})</h3>
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
                      {services.length > 0 ? (
                        services.map((s: any) => {
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
                                  {s.brand?.name || 'Grooming Spa'}
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
                    className="w-full rounded-xl border border-gray-150 bg-gray-50/50 py-2 pl-10 pr-4 text-sm focus:border-primary focus:bg-white focus:outline-none"
                  />
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
                            <tr key={b.id} className="hover:bg-gray-50/30 transition">
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
                                {b.discountAmount ? (
                                  <span className="inline-block text-[9px] bg-red-50 text-red-600 font-black px-1 rounded">Đã giảm 10% (trễ)</span>
                                ) : null}
                              </td>
                              <td className="px-6 py-4 font-semibold text-xs text-gray-700">
                                {b.staff ? `✨ ${b.staff.name}` : <span className="text-gray-400 italic">Chưa phân công</span>}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${statusStyle}`}>
                                  {b.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex flex-col items-center gap-1.5">
                                  {canReschedule && (
                                    <button
                                      onClick={() => {
                                        setRescheduleBooking(b);
                                        setRescheduleDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]); // tomorrow
                                        setSelectedRescheduleSlot('');
                                      }}
                                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-750 border border-purple-200 rounded-lg text-xs font-black flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                    >
                                      <Calendar className="size-3.5" /> Đổi lịch hẹn
                                    </button>
                                  )}

                                  {isLateOfferable && (
                                    <button
                                      onClick={() => handleApplyLateDiscount(b.id)}
                                      className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-extrabold transition cursor-pointer"
                                      title="Khách chờ >30p chưa được làm: Giảm giá 10% tự động"
                                    >
                                      🎁 Giảm 10% (Trễ 30p)
                                    </button>
                                  )}

                                  {!canReschedule && !isLateOfferable && (
                                    <span className="text-gray-400 text-xs italic">—</span>
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
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Chọn thương hiệu --</option>
                    {managerBrands.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.isMain === false ? '(Dịch vụ lẻ)' : '(Gói chính)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Phân loại dịch vụ *</label>
                  <select
                    value={serviceForm.isMain ? 'MAIN' : 'SUB'}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, isMain: e.target.value === 'MAIN' }))}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-primary"
                  >
                    <option value="MAIN">★ Gói dịch vụ chính (bắt buộc chọn 1)</option>
                    <option value="SUB">✦ Dịch vụ lẻ (chọn thêm tùy chọn)</option>
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
                    onChange={(e) => setServiceForm(prev => ({ ...prev, petWeightMin: e.target.value }))}
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
                    onChange={(e) => setServiceForm(prev => ({ ...prev, petWeightMax: e.target.value }))}
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
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
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
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Thời gian tối thiểu (phút) *</label>
                  <input
                    type="number"
                    required
                    min={10}
                    value={serviceForm.durationMin}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, durationMin: e.target.value }))}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white"
                    placeholder="60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500 font-extrabold uppercase">Thời gian tối đa (phút)</label>
                  <input
                    type="number"
                    min={10}
                    value={serviceForm.durationMax}
                    onChange={(e) => setServiceForm(prev => ({ ...prev, durationMax: e.target.value }))}
                    className="w-full h-10 border rounded-xl px-3 py-1.5 text-xs text-gray-800 bg-white"
                    placeholder="90"
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
    </div>
  );
}
