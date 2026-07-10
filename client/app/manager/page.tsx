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
} from 'lucide-react';
import { toast } from 'sonner';

// Currency Formatter
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

// Mock Data for Store Manager
const MOCK_PRODUCTS = [
  { id: 'P001', name: 'Thức ăn hạt cho chó Royal Canin Corgi', category: 'Thức ăn', price: 420000, stock: 45, status: 'Còn hàng', sales: 124 },
  { id: 'P002', name: 'Đồ chơi xương gặm cao su cao cấp', category: 'Đồ chơi', price: 85000, stock: 120, status: 'Còn hàng', sales: 88 },
  { id: 'P003', name: 'Sữa tắm mượt lông cho mèo 500ml', category: 'Vệ sinh', price: 195000, stock: 8, status: 'Sắp hết hàng', sales: 65 },
  { id: 'P004', name: 'Đệm nằm ấm áp hình dấu chân chó', category: 'Phụ kiện', price: 350000, stock: 15, status: 'Còn hàng', sales: 32 },
  { id: 'P005', name: 'Cát vệ sinh đậu nành cho mèo 6L', category: 'Vệ sinh', price: 115000, stock: 0, status: 'Hết hàng', sales: 210 },
];

const MOCK_ORDERS = [
  { id: 'DH8841', customer: 'Trần Văn An', date: '2026-07-10', total: 605000, status: 'Đang chuẩn bị', items: '2x Royal Canin, 1x Đồ chơi' },
  { id: 'DH8840', customer: 'Nguyễn Thị Bình', date: '2026-07-09', total: 195000, status: 'Đã hoàn thành', items: '1x Sữa tắm mượt lông' },
  { id: 'DH8839', customer: 'Lê Minh Cường', date: '2026-07-09', total: 1150000, status: 'Đang vận chuyển', items: '3x Đệm nằm hình dấu chân' },
  { id: 'DH8838', customer: 'Phạm Hồng Đăng', date: '2026-07-08', total: 230000, status: 'Đã hủy', items: '2x Cát đậu nành' },
];

const MOCK_CUSTOMERS = [
  { id: 'C001', name: 'Trần Văn An', email: 'an.tran@gmail.com', phone: '0901234567', totalOrders: 5, spent: 2450000 },
  { id: 'C002', name: 'Nguyễn Thị Bình', email: 'binh.nguyen@gmail.com', phone: '0912345678', totalOrders: 3, spent: 890000 },
  { id: 'C003', name: 'Lê Minh Cường', email: 'cuong.le@gmail.com', phone: '0987654321', totalOrders: 12, spent: 9800000 },
  { id: 'C004', name: 'Phạm Hồng Đăng', email: 'dang.pham@gmail.com', phone: '0934567890', totalOrders: 1, spent: 230000 },
];

export default function ManagerDashboard() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'dashboard';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Input states for mock editing / adding
  const [storeName, setStoreName] = useState('Cửa hàng PetMatching Quận 1');
  const [storePhone, setStorePhone] = useState('028.3822.4455');
  const [storeAddress, setStoreAddress] = useState('120 Lê Lợi, Phường Bến Thành, Quận 1, TP. HCM');
  const [storeHours, setStoreHours] = useState('08:00 - 21:00');
  const [isSaved, setIsSaved] = useState(false);

  // Filtered lists based on search and status filters
  const filteredProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || product.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || (filterStatus === 'IN_STOCK' && product.stock > 0) || (filterStatus === 'OUT_OF_STOCK' && product.stock === 0);
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, filterStatus]);

  const filteredOrders = useMemo(() => {
    return MOCK_ORDERS.filter((order) => {
      const matchesSearch = order.customer.toLowerCase().includes(searchQuery.toLowerCase()) || order.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || order.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, filterStatus]);

  const handleExportExcel = () => {
    toast.success('Xuất danh sách đơn hàng sang Excel thành công!');
  };

  switch (currentTab) {
    case 'products':
      return (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Danh sách sản phẩm</h2>
              <p className="text-sm font-semibold text-[var(--text-muted)]">Quản lý kho hàng và trạng thái bán hàng.</p>
            </div>
            <button
              type="button"
              onClick={() => toast.info('Tính năng Thêm sản phẩm mới đang được phát triển.')}
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
                placeholder="Tìm kiếm sản phẩm theo tên hoặc mã..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] py-2.5 pl-10 pr-4 text-sm focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(228,93,28,0.1)]"
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
                <option value="IN_STOCK">Còn hàng</option>
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
                    <th className="px-6 py-4 text-center">Doanh số</th>
                    <th className="px-6 py-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2]">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <tr key={p.id} className="transition hover:bg-[#FDFDFD]">
                        <td className="px-6 py-4 font-mono font-black text-[#5C5B52]">{p.id}</td>
                        <td className="px-6 py-4 font-bold text-[var(--text-main)]">{p.name}</td>
                        <td className="px-6 py-4 text-[#5C5B52]">{p.category}</td>
                        <td className="px-6 py-4 text-right font-black text-[var(--primary-color)]">{currency.format(p.price)}</td>
                        <td className="px-6 py-4 text-center font-bold">{p.stock}</td>
                        <td className="px-6 py-4 text-center font-bold text-[#0F766E]">{p.sales}</td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-black',
                              p.status === 'Còn hàng' && 'bg-green-50 text-green-700',
                              p.status === 'Sắp hết hàng' && 'bg-amber-50 text-amber-700',
                              p.status === 'Hết hàng' && 'bg-red-50 text-red-700',
                            )}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">Không tìm thấy sản phẩm phù hợp.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );

    case 'orders':
      return (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Danh sách đơn hàng</h2>
              <p className="text-sm font-semibold text-[var(--text-muted)]">Danh sách hóa đơn mua sắm của khách hàng tại chi nhánh.</p>
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
                <option value="Đang chuẩn bị">Đang chuẩn bị</option>
                <option value="Đang vận chuyển">Đang vận chuyển</option>
                <option value="Đã hoàn thành">Đã hoàn thành</option>
                <option value="Đã hủy">Đã hủy</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-[#EFEAE2] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EFEAE2] bg-[#F9F8F6] text-xs font-black uppercase text-[#8A8980]">
                    <th className="px-6 py-4">Mã đơn</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Sản phẩm mua</th>
                    <th className="px-6 py-4">Ngày đặt</th>
                    <th className="px-6 py-4 text-right">Tổng thanh toán</th>
                    <th className="px-6 py-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2]">
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((o) => (
                      <tr key={o.id} className="transition hover:bg-[#FDFDFD]">
                        <td className="px-6 py-4 font-mono font-black text-[#5C5B52]">{o.id}</td>
                        <td className="px-6 py-4 font-bold text-[var(--text-main)]">{o.customer}</td>
                        <td className="px-6 py-4 text-xs font-semibold text-[#5C5B52]">{o.items}</td>
                        <td className="px-6 py-4 text-[#8A8980]">{o.date}</td>
                        <td className="px-6 py-4 text-right font-black text-[var(--primary-color)]">{currency.format(o.total)}</td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-black',
                              o.status === 'Đã hoàn thành' && 'bg-green-50 text-green-700',
                              o.status === 'Đang chuẩn bị' && 'bg-blue-50 text-blue-700',
                              o.status === 'Đang vận chuyển' && 'bg-amber-50 text-amber-700',
                              o.status === 'Đã hủy' && 'bg-red-50 text-red-700',
                            )}
                          >
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Không tìm thấy đơn hàng nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );

    case 'customers':
      return (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-xl font-black">Danh sách khách hàng</h2>
            <p className="text-sm font-semibold text-[var(--text-muted)]">Danh sách khách hàng đã mua sản phẩm tại cửa hàng.</p>
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
                    <th className="px-6 py-4 text-center">Số đơn đã đặt</th>
                    <th className="px-6 py-4 text-right">Tổng chi tiêu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEAE2]">
                  {MOCK_CUSTOMERS.map((c) => (
                    <tr key={c.id} className="transition hover:bg-[#FDFDFD]">
                      <td className="px-6 py-4 font-mono font-black text-[#5C5B52]">{c.id}</td>
                      <td className="px-6 py-4 font-bold text-[var(--text-main)]">{c.name}</td>
                      <td className="px-6 py-4 text-[#5C5B52]">{c.email}</td>
                      <td className="px-6 py-4 font-mono text-[#5C5B52]">{c.phone}</td>
                      <td className="px-6 py-4 text-center font-bold text-[#0F766E]">{c.totalOrders} đơn</td>
                      <td className="px-6 py-4 text-right font-black text-[var(--primary-color)]">{currency.format(c.spent)}</td>
                    </tr>
                  ))}
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
            <h2 className="text-xl font-black">Cấu hình cửa hàng</h2>
            <p className="text-sm font-semibold text-[var(--text-muted)]">Thiết lập các thông tin chi nhánh cửa hàng hiển thị lên ứng dụng.</p>
          </div>

          <div className="rounded-2xl border border-[#EFEAE2] bg-white p-6 shadow-sm space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">Tên cửa hàng</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => { setStoreName(e.target.value); setIsSaved(false); }}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">Số điện thoại liên hệ</label>
              <input
                type="text"
                value={storePhone}
                onChange={(e) => { setStorePhone(e.target.value); setIsSaved(false); }}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">Địa chỉ chi nhánh</label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => { setStoreAddress(e.target.value); setIsSaved(false); }}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">Giờ hoạt động</label>
              <input
                type="text"
                value={storeHours}
                onChange={(e) => { setStoreHours(e.target.value); setIsSaved(false); }}
                className="w-full rounded-xl border border-[#EFEAE2] bg-[#F9F8F6] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none"
              />
            </div>

            {isSaved && (
              <div className="rounded-xl bg-green-50 p-3.5 text-sm font-bold text-green-700 animate-fadeIn">
                Lưu cấu hình cửa hàng thành công!
              </div>
            )}

            <button
              type="button"
              onClick={() => { setIsSaved(true); toast.success('Lưu cấu hình thành công!'); }}
              className="w-full rounded-xl bg-[var(--primary-color)] py-3.5 font-bold text-white transition hover:bg-[#cf5017]"
            >
              Lưu cấu hình
            </button>
          </div>
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
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Doanh thu tháng</span>
                <span className="p-2 rounded-lg bg-[rgba(228,93,28,0.1)] text-[var(--primary-color)]">
                  <TrendingUp className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">{currency.format(19500000)}</p>
              <p className="mt-1 text-xs font-bold text-green-600">+12.5% so với tháng trước</p>
            </div>

            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Đơn hàng mới</span>
                <span className="p-2 rounded-lg bg-teal-50 text-teal-600">
                  <Package className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">28 đơn</p>
              <p className="mt-1 text-xs font-bold text-[#8A8980]">4 đơn đang chờ xử lý</p>
            </div>

            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Sản phẩm bán chạy</span>
                <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <ShoppingBag className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">124 hạt</p>
              <p className="mt-1 text-xs font-bold text-blue-600">Royal Canin Corgi dẫn đầu</p>
            </div>

            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#8A8980]">Khách hàng mới</span>
                <span className="p-2 rounded-lg bg-orange-50 text-orange-600">
                  <Users className="size-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black">+14 khách</p>
              <p className="mt-1 text-xs font-bold text-green-600">+8% đăng ký mới tuần này</p>
            </div>
          </section>

          {/* Dashboard Lists */}
          <section className="grid gap-6 lg:grid-cols-2">
            {/* Product Status Alert */}
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm">
              <h3 className="text-base font-black">Sản phẩm sắp hết hàng & cần bổ sung</h3>
              <div className="mt-4 divide-y divide-[#EFEAE2]">
                {MOCK_PRODUCTS.filter(p => p.stock <= 10).map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-main)]">{p.name}</p>
                      <p className="text-xs font-semibold text-[#8A8980]">Danh mục: {p.category}</p>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        'inline-flex rounded px-2 py-0.5 text-xs font-black',
                        p.stock === 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                      )}>
                        Tồn: {p.stock}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="rounded-2xl border border-[#EFEAE2] bg-white p-5 shadow-sm">
              <h3 className="text-base font-black">Đơn đặt hàng gần đây</h3>
              <div className="mt-4 divide-y divide-[#EFEAE2]">
                {MOCK_ORDERS.slice(0, 3).map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-main)]">{o.customer}</p>
                      <p className="text-xs font-semibold text-[#8A8980]">{o.items}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[var(--primary-color)]">{currency.format(o.total)}</p>
                      <p className="text-xs font-semibold text-[#8A8980]">{o.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      );
  }
}
