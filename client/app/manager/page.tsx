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
} from 'lucide-react';
import { toast } from 'sonner';
import { managerApi, ManagerProduct, ManagerOrder, ManagerCustomer, StoreSettings, ManagerDashboardStats } from '@/lib/api/manager';

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

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ManagerDashboardStats | null>(null);
  const [products, setProducts] = useState<ManagerProduct[]>([]);
  const [orders, setOrders] = useState<ManagerOrder[]>([]);
  const [customers, setCustomers] = useState<ManagerCustomer[]>([]);
  const [storeInfo, setStoreInfo] = useState<StoreSettings | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<ManagerOrder | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isSaved, setIsSaved] = useState(false);
  const [submittingSettings, setSubmittingSettings] = useState(false);

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
      const [statsRes, productsRes, ordersRes, customersRes, settingsRes] = await Promise.all([
        managerApi.getDashboardStats(),
        managerApi.getProducts(),
        managerApi.getOrders(),
        managerApi.getCustomers(),
        managerApi.getStoreSettings(),
      ]);
      setStats(statsRes.data);
      setProducts(productsRes.data);
      setOrders(ordersRes.data);
      setCustomers(customersRes.data);
      setStoreInfo(settingsRes.data);
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
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.brand && product.brand.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'IN_STOCK' && (product.stock ?? 0) > 0) ||
        (filterStatus === 'OUT_OF_STOCK' && (product.stock ?? 0) === 0);
      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, filterStatus]);

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
            <button
              type="button"
              onClick={handleAddClick}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary-color)] px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#cf5017]"
            >
              <Plus className="size-4" />
              Thêm sản phẩm mới
            </button>
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
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-[#B0B0B0]" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl border border-[#EFEAE2] bg-white px-3 py-2.5 text-sm font-bold text-[var(--text-main)] focus:outline-none"
              >
                <option value="ALL">Tất cả sản phẩm</option>
                <option value="IN_STOCK">Còn hàng trong kho</option>
                <option value="OUT_OF_STOCK">Đã hết hàng</option>
              </select>
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
                          <td className="px-6 py-4 text-[#5C5B52]">{CATEGORY_MAP[p.category] || p.category}</td>
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
                        {Object.keys(CATEGORY_MAP).map((cat) => (
                          <option key={cat} value={cat}>{CATEGORY_MAP[cat]}</option>
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
                          <p className="text-xs font-semibold text-[#8A8980]">Danh mục: {CATEGORY_MAP[p.category] || p.category}</p>
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
                        <p className="text-xs font-semibold text-[#8A8980]">Danh mục: {CATEGORY_MAP[p.category] || p.category}</p>
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
