'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Scissors,
  CheckCircle,
  AlertTriangle,
  Camera,
  RefreshCw,
  Phone,
  Plus,
  UserCheck,
  LogOut,
  Sparkles,
  X,
  History,
  Search,
  Banknote,
  QrCode,
  Copy,
  Check,
  Maximize2,
} from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { spaApi } from '@/lib/api/spa';
import { SpaBookingType, SpaServiceType } from '@/types';

// Preset sample photos for easy mock upload
const PRESET_PHOTOS = [
  { label: 'Tắm xà phòng', url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=600&h=400&fit=crop' },
  { label: 'Sấy lông & chải chuốt', url: 'https://images.unsplash.com/photo-1522008411084-601449db82a9?w=600&h=400&fit=crop' },
  { label: 'Cắt tỉa hoàn thành', url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=400&fit=crop' },
  { label: 'Bé mèo sạch sẽ', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&h=400&fit=crop' }
];

export default function SpaStaff() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bookings, setBookings] = useState<SpaBookingType[]>([]);
  const [staffProfile, setStaffProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Sub services selection modal state
  const [addingSubServicesForId, setAddingSubServicesForId] = useState<string | null>(null);
  const [allSubServices, setAllSubServices] = useState<SpaServiceType[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Payment completion modal states
  const [completingBooking, setCompletingBooking] = useState<SpaBookingType | null>(null);
  const [paymentMethodStep, setPaymentMethodStep] = useState<'METHOD_SELECT' | 'CASH' | 'TRANSFER' | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [zoomedQrUrl, setZoomedQrUrl] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-change'));
    router.replace('/login');
  };

  // States for the inline forms per booking
  const [editStates, setEditStates] = useState<Record<string, {
    status: string;
    petConditionAfter: string;
    photoAfter: string;
    issueReported: string;
  }>>({});

  // Helper to resolve subServices for a booking
  const getBookingSubServices = (booking: SpaBookingType) => {
    if (booking.subServices && booking.subServices.length > 0) {
      return booking.subServices;
    }
    if (booking.subServiceIds && booking.subServiceIds.length > 0) {
      return booking.subServiceIds
        .map((id) => allSubServices.find((s) => s.id === id))
        .filter((s): s is SpaServiceType => Boolean(s));
    }
    return [];
  };

  // Helper to get available addons for staff to add
  const getAvailableAddonsForBooking = (booking: SpaBookingType) => {
    if (!booking) return [];

    const petSpecies = booking.petSpecies || booking.pet?.species || null;
    const petWeight = booking.petWeight || booking.pet?.weight || null;
    const numWeight = petWeight ? Number(petWeight) : 0;

    // Already selected subService IDs
    const existingSubServiceIds = new Set(booking.subServiceIds || []);

    // Main service name and description
    const mainServiceName = (booking.service?.name || '').toLowerCase();
    const mainServiceDesc = (booking.service?.description || '').toLowerCase();

    return allSubServices.filter((sub) => {
      // 1. Exclude if already chosen
      if (existingSubServiceIds.has(sub.id)) return false;

      // 2. Exclude if sub-service is already included in main combo package
      const subNameClean = sub.name.replace(/\s*\([^)]*\)/g, '').toLowerCase().trim();
      if (mainServiceName.includes(subNameClean) || mainServiceDesc.includes(subNameClean)) {
        return false;
      }

      // 3. Filter by pet species if specified
      if (sub.species && petSpecies && sub.species !== petSpecies) {
        return false;
      }

      // 4. Filter by pet weight bracket if specified
      if (sub.petWeightMin !== null || sub.petWeightMax !== null) {
        const minW = sub.petWeightMin ?? 0;
        const maxW = sub.petWeightMax ?? 999;

        if (numWeight < minW || (numWeight >= maxW && maxW !== 100)) {
          return false;
        }
      }

      return true;
    });
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      toast.error('Vui lòng đăng nhập trước.');
      router.push('/login');
      return;
    }
    const u = JSON.parse(stored);
    if (u.role !== 'SPA_STAFF') {
      setCurrentUser({ ...u, accessDenied: true });
      setLoading(false);
      return;
    }
    setCurrentUser(u);

    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedDate(todayStr);
  }, []);

  const fetchBookings = async () => {
    if (!currentUser || currentUser.accessDenied) return;
    setLoading(true);
    try {
      const [bookingsRes, profileRes, servicesRes] = await Promise.all([
        spaApi.getStaffBookings(),
        spaApi.getStaffProfile().catch(() => ({ data: null })),
        spaApi.getServices(),
      ]);

      setBookings(bookingsRes.data || []);
      setStaffProfile(profileRes.data || null);
      setAllSubServices((servicesRes.data || []).filter((s) => !s.isMain));

      const initialStates: typeof editStates = {};
      bookingsRes.data.forEach((b) => {
        initialStates[b.id] = {
          status: b.status,
          petConditionAfter: b.petConditionAfter || '',
          photoAfter: b.photoAfter || '',
          issueReported: b.issueReported || ''
        };
      });
      setEditStates(initialStates);
    } catch {
      toast.error('Không thể tải danh sách lịch làm việc của bạn.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && !currentUser.accessDenied) {
      fetchBookings();
    }
  }, [currentUser]);

  const handleCheckIn = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const res = await spaApi.staffCheckIn(bookingId);
      toast.success('Check-in khách hàng thành công!');
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...res.data, status: 'CHECK_IN' } : b))
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể check-in.';
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSubServices = async () => {
    if (!addingSubServicesForId || selectedAddonIds.length === 0) return;
    setActionLoading(addingSubServicesForId);
    try {
      const res = await spaApi.staffAddSubServices(addingSubServicesForId, selectedAddonIds);
      toast.success('Đã bổ sung dịch vụ lẻ vào đơn hàng!');
      setBookings((prev) =>
        prev.map((b) => (b.id === addingSubServicesForId ? { ...b, ...res.data } : b))
      );
      setAddingSubServicesForId(null);
      setSelectedAddonIds([]);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể bổ sung dịch vụ.';
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (bookingId: string, status: string) => {
    setActionLoading(bookingId);
    try {
      const res = await spaApi.updateStaffBooking(bookingId, { status });
      toast.success('Đã xác nhận bắt đầu thực hiện dịch vụ!');
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...res.data } : b))
      );
      setEditStates((prev) => ({
        ...prev,
        [bookingId]: {
          ...prev[bookingId],
          status
        }
      }));
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái.';
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteBooking = (booking: SpaBookingType) => {
    const state = editStates[booking.id];
    if (!state || !state.petConditionAfter?.trim()) {
      toast.error('Vui lòng nhập tình trạng thú cưng sau dịch vụ.');
      return;
    }
    setCompletingBooking(booking);
    setPaymentMethodStep('METHOD_SELECT');
  };

  const handleFinalizeComplete = async (bookingId: string, paymentMethod: 'CASH' | 'TRANSFER') => {
    const state = editStates[bookingId];
    if (!state || !state.petConditionAfter?.trim()) {
      toast.error('Vui lòng nhập tình trạng thú cưng sau dịch vụ.');
      return;
    }

    setActionLoading(bookingId);
    try {
      const res = await spaApi.updateStaffBooking(bookingId, {
        status: 'COMPLETED',
        petConditionAfter: state.petConditionAfter,
        photoAfter: state.photoAfter || null,
        issueReported: state.issueReported || null
      });

      const methodLabel = paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản QR';
      toast.success(`Xác nhận thanh toán (${methodLabel}) & hoàn thành dịch vụ thành công!`);

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...res.data } : b))
      );
      setCompletingBooking(null);
      setPaymentMethodStep(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể hoàn thành dịch vụ.';
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFieldChange = (bookingId: string, field: string, value: string) => {
    setEditStates((prev) => ({
      ...prev,
      [bookingId]: {
        ...prev[bookingId],
        [field]: value
      }
    }));
  };

  const filteredBookings = bookings.filter((b) => {
    const bookingDate = new Date(b.scheduledAt).toISOString().split('T')[0];
    if (selectedDate && bookingDate !== selectedDate) {
      return false;
    }

    if (activeTab === 'ALL') return true;
    if (activeTab === 'CONFIRMED') return b.status === 'CONFIRMED';
    if (activeTab === 'CHECK_IN') return b.status === 'CHECK_IN' || b.status === 'ARRIVED';
    if (activeTab === 'ASSIGNED') return b.status === 'ASSIGNED';
    if (activeTab === 'IN_PROGRESS') return b.status === 'IN_PROGRESS';
    if (activeTab === 'COMPLETED') return b.status === 'COMPLETED';

    return true;
  });

  const getStatusLabelAndStyle = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { text: 'Chờ xác nhận', class: 'bg-amber-100 border-amber-300 text-amber-800' };
      case 'CONFIRMED':
        return { text: 'Đã xác nhận', class: 'bg-blue-100 border-blue-300 text-blue-800' };
      case 'CHECK_IN':
      case 'ARRIVED':
        return { text: 'Đã Check-in (Khách đến)', class: 'bg-teal-100 border-teal-300 text-teal-800' };
      case 'ASSIGNED':
        return { text: 'Đã tiếp nhận', class: 'bg-indigo-100 border-indigo-300 text-indigo-800' };
      case 'IN_PROGRESS':
        return { text: 'Đang thực hiện', class: 'bg-orange-100 border-orange-300 text-orange-800' };
      case 'COMPLETED':
        return { text: 'Hoàn thành', class: 'bg-green-100 border-green-300 text-green-800' };
      case 'CANCELLED':
        return { text: 'Đã hủy', class: 'bg-red-100 border-red-300 text-red-800' };
      case 'NO_SHOW':
        return { text: 'No Show', class: 'bg-gray-100 border-gray-300 text-gray-800' };
      default:
        return { text: status, class: 'bg-gray-100 border-gray-300 text-gray-800' };
    }
  };

  const formatTimeSlot = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '00:00 - 00:00';

    const startHour = d.getHours();
    const endHour = startHour + 1;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(startHour)}:00 – ${pad(endHour)}:00`;
  };

  const formatDateVietnamese = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading && !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)]">
        <div className="text-center space-y-4">
          <div className="inline-block size-10 animate-spin rounded-full border-4 border-[#6D28D9] border-t-transparent" />
          <p className="font-semibold text-sm text-gray-500">Đang tải bảng làm việc...</p>
        </div>
      </div>
    );
  }

  if (currentUser?.accessDenied) {
    return (
      <main className="min-h-screen bg-[var(--bg-page)] pb-12">
        <AppHeader sectionLabel="Spa" />
        <div className="container mx-auto max-w-md px-4 py-20 text-center space-y-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Quyền truy cập bị từ chối</h2>
          <p className="text-sm text-gray-500">
            Trang này chỉ dành cho nhân viên Spa (Spa Staff). Vui lòng đăng nhập bằng tài khoản được cấp quyền để truy cập.
          </p>
          <Button asChild className="bg-primary hover:bg-primary/95 text-white font-bold w-full">
            <Link href="/home">Về trang chủ</Link>
          </Button>
        </div>
      </main>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookingsCount = bookings.filter((b) => new Date(b.scheduledAt).toISOString().split('T')[0] === todayStr).length;

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-16">
      {/* Staff Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-[#EFEAE2] bg-white/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#6D28D9] text-white shadow-sm">
            <Scissors className="size-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#6D28D9]">PetMatching Spa Staff</span>
            <h1 className="text-sm font-black text-[var(--text-main)]">Trang Làm Việc Nhân Viên</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-black text-[var(--text-main)]">{currentUser?.name || 'Nhân viên Spa'}</p>
            <p className="text-[10px] text-[var(--text-muted)] font-bold">{currentUser?.email}</p>
          </div>
          <Button
            onClick={() => setShowLogoutConfirm(true)}
            variant="outline"
            size="sm"
            className="border-purple-200 text-purple-700 hover:bg-purple-50 font-bold gap-2 text-xs h-9"
          >
            <LogOut className="size-3.5" />
            Đăng xuất
          </Button>
        </div>
      </header>

      {/* Purple banner */}
      <section className="bg-[#6D28D9] text-white py-8 px-4 shadow-md">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-white/10 text-white border border-white/20">
              <Scissors className="size-7" />
            </div>
            <div>
              <span className="text-xs text-purple-200 block uppercase tracking-wider font-semibold">
                Nhân viên Spa {staffProfile && `• Mã NV: ${staffProfile.id}`}
              </span>
              <h1 className="text-2xl font-black tracking-tight">{currentUser?.name || 'Nhân viên Spa'}</h1>
              {staffProfile?.addressSpa && (
                <p className="text-xs text-purple-100 mt-1 flex items-center gap-1 font-medium">
                  📍 Nơi làm việc: <span className="font-bold">{staffProfile.addressSpa.address}</span> ({staffProfile.addressSpa.name})
                </p>
              )}
            </div>
          </div>
          <div className="bg-white/10 border border-white/15 rounded-xl px-5 py-3 flex items-center gap-6 self-stretch md:self-auto justify-between md:justify-start">
            <div className="text-left">
              <span className="text-xs text-purple-200 block font-semibold">Lịch hẹn hôm nay</span>
              <span className="text-xl font-extrabold">{todayBookingsCount} lịch hẹn</span>
            </div>
            <Button
              onClick={fetchBookings}
              variant="ghost"
              className="hover:bg-white/10 hover:text-white p-2 rounded-lg text-white"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">

        {/* Controls: Date Picker & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              min={todayStr}
              onKeyDown={(e) => e.preventDefault()}
              onChange={(e) => {
                const val = e.target.value;
                if (!val || val >= todayStr) {
                  setSelectedDate(val);
                } else {
                  setSelectedDate(todayStr);
                }
              }}
              className="h-10 rounded-lg border border-[var(--border-color)] bg-white px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700 cursor-pointer"
            />
            {selectedDate !== todayStr && (
              <Button
                variant="ghost"
                onClick={() => setSelectedDate(todayStr)}
                className="text-xs text-purple-600 hover:text-purple-700 font-bold"
              >
                Hôm nay
              </Button>
            )}

            <Button
              onClick={() => setHistoryModalOpen(true)}
              variant="outline"
              className="h-10 border-purple-300 text-purple-800 hover:bg-purple-50 font-extrabold gap-2 text-xs rounded-lg shadow-2xs"
            >
              <History className="size-4 text-purple-600" />
              Lịch Sử Đơn Cũ ({bookings.filter((b) => b.status === 'COMPLETED').length})
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-lg border">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'CONFIRMED', label: 'Đã xác nhận' },
              { id: 'CHECK_IN', label: 'Đã Check-in' },
              { id: 'ASSIGNED', label: 'Đã tiếp nhận' },
              { id: 'IN_PROGRESS', label: 'Đang thực hiện' },
              { id: 'COMPLETED', label: 'Hoàn thành' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === tab.id
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* History Modal for Completed Bookings */}
        {historyModalOpen && (() => {
          const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
          const filteredHistory = completedBookings.filter((b) => {
            if (!historySearchQuery.trim()) return true;
            const q = historySearchQuery.toLowerCase().trim();
            return (
              (b.petName && b.petName.toLowerCase().includes(q)) ||
              (b.user?.name && b.user.name.toLowerCase().includes(q)) ||
              (b.service?.name && b.service.name.toLowerCase().includes(q)) ||
              b.id.toLowerCase().includes(q)
            );
          });

          const totalRevenue = completedBookings.reduce(
            (sum, b) => sum + (b.totalPrice || b.priceSnapshot || 0),
            0
          );

          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-gray-200 max-h-[85vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg text-purple-950 flex items-center gap-2">
                        <History className="size-5 text-purple-600" /> Lịch Sử Đơn Cũ Đã Hoàn Thành
                      </h3>
                      <span className="text-xs font-bold bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full border border-green-200">
                        {completedBookings.length} ca đã làm
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Tổng doanh thu dịch vụ đã xử lý: <strong className="text-purple-800">{totalRevenue.toLocaleString('vi-VN')}đ</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setHistoryModalOpen(false)}
                    className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Tìm theo tên thú cưng, tên khách hàng hoặc mã đơn..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="pl-10 h-10 text-xs bg-gray-50/80 border-gray-200"
                  />
                </div>

                {/* History items list */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[250px]">
                  {filteredHistory.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed text-gray-400">
                      <p className="text-xs font-semibold">Chưa tìm thấy đơn hoàn thành nào phù hợp.</p>
                    </div>
                  ) : (
                    filteredHistory.map((b) => {
                      const subList = getBookingSubServices(b);
                      return (
                        <div
                          key={b.id}
                          className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-2xs hover:border-purple-300 transition"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-800">
                                📅 {formatDateVietnamese(b.scheduledAt.split('T')[0])} ({formatTimeSlot(b.scheduledAt)})
                              </span>
                              <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border">
                                #{b.id.slice(-6).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-xs font-black text-purple-800">
                              {(b.totalPrice || b.priceSnapshot || 0).toLocaleString('vi-VN')}đ
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {/* Pet & Customer */}
                            <div className="space-y-1">
                              <p className="font-extrabold text-purple-950 flex items-center gap-1.5">
                                🐾 {b.petName} ({b.petSpecies === 'CAT' ? 'Mèo' : 'Chó'} • {b.petWeight || 3}kg)
                              </p>
                              <p className="text-gray-500 flex items-center gap-1">
                                <UserIcon className="size-3 text-gray-400" /> Khách: {b.user?.name || 'Khách hàng'}
                              </p>
                            </div>

                            {/* Services */}
                            <div className="space-y-1">
                              <p className="font-bold text-gray-900">✂️ Gói chính: {b.service?.name || 'Chăm sóc Spa'}</p>
                              {subList.length > 0 && (
                                <div className="text-[11px] text-green-700 font-semibold space-y-0.5">
                                  {subList.map((sub, i) => (
                                    <span key={i} className="block">+ {sub.name} ({(sub.price || 0).toLocaleString('vi-VN')}đ)</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Condition report after grooming */}
                          {b.petConditionAfter && (
                            <div className="p-2.5 bg-green-50/60 border border-green-200 rounded-lg text-xs text-green-950 space-y-1">
                              <span className="font-bold text-green-800 block text-[11px]">Báo cáo kết quả:</span>
                              <p className="text-[11px] leading-relaxed">{b.petConditionAfter}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end pt-3 border-t">
                  <Button
                    onClick={() => setHistoryModalOpen(false)}
                    className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-extrabold px-6"
                  >
                    Đóng
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Dashboard Bookings Listing */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-20 bg-white border border-[var(--border-color)] rounded-2xl p-8 space-y-4 shadow-xs">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-purple-50 text-[#6D28D9]">
              <Calendar className="size-6" />
            </div>
            <h3 className="text-base font-bold text-gray-800">Không có lịch làm việc</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Không tìm thấy lịch hẹn được giao cho bạn vào ngày {selectedDate ? formatDateVietnamese(selectedDate) : 'đang chọn'}.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredBookings.map((booking) => {
              const currentEditState = editStates[booking.id] || {
                status: booking.status,
                petConditionAfter: '',
                photoAfter: '',
                issueReported: ''
              };

              const isCompleted = booking.status === 'COMPLETED';
              const statusInfo = getStatusLabelAndStyle(booking.status);

              return (
                <div
                  key={booking.id}
                  className={`bg-white border rounded-2xl p-6 shadow-xs transition hover:shadow-md ${isCompleted ? 'border-green-150' : 'border-purple-100'
                    }`}
                >

                  {/* Header info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <Clock className="size-4 text-purple-600 shrink-0" />
                      <span className="font-extrabold text-sm text-gray-800">
                        {formatTimeSlot(booking.scheduledAt)}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold px-2 py-0.5 bg-gray-50 rounded border">
                        ID: #{booking.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${statusInfo.class}`}>
                        {statusInfo.text}
                      </span>
                      {/* Check-in button if customer arrived and not yet checked in */}
                      {(booking.status === 'CONFIRMED' || booking.status === 'ASSIGNED') && (
                        <Button
                          onClick={() => handleCheckIn(booking.id)}
                          disabled={actionLoading === booking.id}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs h-8 px-3 rounded-lg shadow-sm"
                        >
                          <UserCheck className="size-3.5 mr-1" />
                          Check-in Khách
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Core details */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-5">

                    {/* Left details pane */}
                    <div className="md:col-span-5 space-y-4 border-r border-gray-150 pr-0 md:pr-6 border-dashed">
                      {/* Pet details */}
                      <div className="flex items-center gap-3">
                        {booking.pet?.avatarUrl ? (
                          <img
                            src={booking.pet.avatarUrl}
                            alt={booking.pet.name}
                            className="size-12 rounded-full object-cover shrink-0 border-2 border-purple-250"
                          />
                        ) : (
                          <div className="size-12 rounded-full overflow-hidden bg-purple-50 flex items-center justify-center shrink-0 border-2 border-purple-100">
                            <span className="text-2xl">🐾</span>
                          </div>
                        )}
                        <div>
                          <span className="text-[11px] text-gray-400 block font-semibold leading-none">Thú cưng</span>
                          <span className="font-extrabold text-base text-purple-950 block leading-tight">
                            {booking.petName || booking.pet?.name || 'Bé cưng'}
                          </span>
                          {(booking.pet || booking.petWeight) && (
                            <span className="text-[10px] text-gray-500 font-bold block mt-0.5">
                              {booking.pet?.breed || 'Thú cưng'} • {booking.petWeight || booking.pet?.weight || '?'}kg
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Customer details */}
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center shrink-0 border border-gray-200">
                          <UserIcon className="size-5 text-gray-500" />
                        </div>
                        <div>
                          <span className="text-[11px] text-gray-400 block font-semibold leading-none">Khách hàng</span>
                          <span className="font-bold text-xs text-gray-800">
                            {booking.user?.name || 'Khách hàng'}
                          </span>
                          {booking.user?.phone && (
                            <span className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                              <Phone className="size-3 text-gray-400" /> {booking.user.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Service Package & All Sub Services */}
                      <div className="rounded-xl bg-orange-50/70 border border-orange-200 p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-orange-200/80 pb-2">
                          <span className="text-[10px] text-orange-700 block uppercase font-black tracking-wider">⚡ Chi Tiết Dịch Vụ</span>
                          {(booking.status === 'ASSIGNED' || booking.status === 'CHECK_IN' || booking.status === 'IN_PROGRESS' || booking.status === 'CONFIRMED') && (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setAddingSubServicesForId(booking.id);
                                setSelectedAddonIds([]);
                              }}
                              className="text-[11px] text-purple-700 hover:text-purple-900 font-extrabold p-0 h-auto cursor-pointer"
                            >
                              + Thêm dịch vụ lẻ
                            </Button>
                          )}
                        </div>

                        {/* Main Service */}
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider block">Dịch vụ chính:</span>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm text-gray-900">
                              {booking.service?.name || 'Gói Chăm Sóc Spa'}
                            </span>
                            <span className="text-xs font-bold text-gray-700">
                              {(booking.service?.price || booking.priceSnapshot || 0).toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        </div>

                        {/* Sub Services (Originally chosen + Added by staff) */}
                        {(() => {
                          const subList = getBookingSubServices(booking);
                          if (subList.length === 0) return null;
                          return (
                            <div className="space-y-1.5 pt-2 border-t border-orange-200/80">
                              <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider block">
                                Dịch vụ lẻ ({subList.length} dịch vụ đã chọn & thêm):
                              </span>
                              <div className="space-y-1">
                                {subList.map((sub, idx) => (
                                  <div key={sub.id || idx} className="flex items-center justify-between text-xs bg-white/80 p-2 rounded-lg border border-orange-100">
                                    <span className="font-bold text-gray-800 flex items-center gap-1.5">
                                      <span className="size-1.5 rounded-full bg-green-500 shrink-0" />
                                      {sub.name}
                                    </span>
                                    <span className="font-extrabold text-green-700">
                                      + {(sub.price || 0).toLocaleString('vi-VN')}đ
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Total Price */}
                        <div className="text-xs text-gray-900 font-black pt-2 border-t border-orange-200 flex items-center justify-between">
                          <span>Tổng chi phí đơn:</span>
                          <span className="text-base font-black text-purple-800">
                            {(booking.totalPrice || booking.priceSnapshot || 0).toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      </div>

                      {booking.note && (
                        <div className="bg-gray-50/75 border border-dashed rounded-xl p-3 text-xs text-gray-600">
                          <span className="font-bold block text-gray-700 mb-1">💬 Ghi chú từ khách:</span>
                          <p className="italic">"{booking.note}"</p>
                        </div>
                      )}
                    </div>

                    {/* Right update pane */}
                    <div className="md:col-span-7 flex flex-col justify-center">
                      {(booking.status === 'ASSIGNED' || booking.status === 'CHECK_IN' || booking.status === 'CONFIRMED' || booking.status === 'LATE') ? (
                        <div className="flex flex-col items-center justify-center p-6 bg-purple-50/50 rounded-2xl border border-purple-100/50 space-y-3">
                          <p className="text-xs text-purple-800 font-bold text-center">
                            Lịch hẹn đã sẵn sàng. Vui lòng bấm "Xác nhận thực hiện" khi bắt đầu ca làm.
                          </p>
                          <Button
                            onClick={() => handleUpdateStatus(booking.id, 'IN_PROGRESS')}
                            disabled={actionLoading === booking.id}
                            className="bg-[#6D28D9] hover:bg-[#5b21b6] text-white font-extrabold text-xs h-10 px-6 rounded-xl shadow-md transition"
                          >
                            {actionLoading === booking.id ? 'Đang cập nhật...' : 'Xác nhận thực hiện ca làm'}
                          </Button>
                        </div>
                      ) : booking.status === 'IN_PROGRESS' ? (
                        <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-5 space-y-4">
                          <div className="space-y-1">
                            <h4 className="text-xs font-black uppercase text-orange-950 tracking-wider">
                              Đang thực hiện dịch vụ
                            </h4>
                            <p className="text-[11px] text-gray-500 font-medium">
                              Báo cáo tình trạng sau khi hoàn tất dịch vụ dưới đây để hoàn thành lịch hẹn.
                            </p>
                          </div>

                          <div className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 font-bold uppercase">Tình trạng thú cưng sau dịch vụ *</label>
                              <Textarea
                                placeholder="Ví dụ: Bé ngoan, sấy lông rất tốt, không có vấn đề ngoài da..."
                                value={currentEditState.petConditionAfter}
                                onChange={(e) => handleFieldChange(booking.id, 'petConditionAfter', e.target.value)}
                                className="min-h-[70px] text-xs bg-white"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                                <Camera className="size-3" /> Ảnh sau dịch vụ (URL hoặc chọn mẫu)
                              </label>
                              <Input
                                placeholder="https://example.com/pet.png"
                                value={currentEditState.photoAfter}
                                onChange={(e) => handleFieldChange(booking.id, 'photoAfter', e.target.value)}
                                className="text-xs h-9 bg-white"
                              />

                              <div className="flex flex-wrap items-center gap-1 pt-1">
                                {PRESET_PHOTOS.map((p) => (
                                  <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => handleFieldChange(booking.id, 'photoAfter', p.url)}
                                    className={`px-2 py-0.5 text-[9px] rounded border font-bold hover:bg-gray-50 transition ${currentEditState.photoAfter === p.url
                                      ? 'border-purple-650 bg-purple-50 text-purple-750 font-black'
                                      : 'border-gray-200 text-gray-500'
                                      }`}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <Button
                              onClick={() => handleCompleteBooking(booking)}
                              disabled={actionLoading === booking.id || !currentEditState.petConditionAfter.trim()}
                              className="bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs h-9 px-6 rounded-lg shadow-sm"
                            >
                              {actionLoading === booking.id ? 'Đang lưu...' : 'Hoàn thành dịch vụ'}
                            </Button>
                          </div>
                        </div>
                      ) : booking.status === 'COMPLETED' ? (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase text-green-950 tracking-wider flex items-center gap-1.5">
                              <CheckCircle className="size-4 text-green-600" /> Kết quả dịch vụ (Hoàn thành)
                            </h4>
                            <span className="px-2.5 py-0.5 text-[10px] font-black bg-green-600 text-white rounded-full shadow-sm">
                              Đã thanh toán
                            </span>
                          </div>
                          <div className="text-xs text-green-900 space-y-2 font-semibold">
                            <p><span className="font-black text-green-950">Tình trạng:</span> {booking.petConditionAfter || 'Được báo cáo tốt.'}</p>
                            {booking.issueReported && (
                              <p className="bg-red-50 border border-red-200 p-2 rounded-lg text-red-800 font-medium">
                                <span className="font-bold flex items-center gap-1">⚠️ Sự cố:</span> {booking.issueReported}
                              </p>
                            )}
                          </div>
                          {booking.photoAfter && (
                            <div className="max-w-[280px] rounded-lg overflow-hidden border border-green-200 shadow-sm bg-white">
                              <img
                                src={booking.photoAfter}
                                alt="Result"
                                className="w-full h-auto object-cover max-h-40"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-center p-8 bg-gray-50 rounded-2xl border border-gray-200">
                          <span className="text-xs font-bold text-gray-400">Trạng thái: {booking.status}</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for adding sub services by staff */}
      {addingSubServicesForId && (() => {
        const currentBooking = bookings.find((b) => b.id === addingSubServicesForId);
        const availableAddons = currentBooking ? getAvailableAddonsForBooking(currentBooking) : [];

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-200">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                    <Plus className="size-5 text-purple-600" /> Thêm Dịch Vụ Lẻ Cho Khách Hàng
                  </h3>
                  {currentBooking && (
                    <p className="text-xs text-purple-700 font-bold mt-0.5">
                      Bé: {currentBooking.petName} ({currentBooking.petSpecies === 'CAT' ? '🐱 Mèo' : '🐶 Chó'} • {currentBooking.petWeight || 3}kg)
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setAddingSubServicesForId(null)}
                  className="text-gray-400 hover:text-gray-600 rounded-full p-1"
                >
                  <X className="size-5" />
                </button>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Dưới đây là các dịch vụ lẻ chưa chọn phù hợp với cân nặng ({currentBooking?.petWeight || 3}kg) và chưa có trong gói:
              </p>

              {availableAddons.length === 0 ? (
                <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-xs text-gray-500 font-medium">
                    Không có dịch vụ lẻ khả dụng nào chưa chọn phù hợp với bé này.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {availableAddons.map((sub) => {
                    const isSelected = selectedAddonIds.includes(sub.id);
                    return (
                      <div
                        key={sub.id}
                        onClick={() =>
                          setSelectedAddonIds((prev) =>
                            prev.includes(sub.id) ? prev.filter((i) => i !== sub.id) : [...prev, sub.id]
                          )
                        }
                        className={`p-3 border rounded-xl cursor-pointer flex items-center justify-between transition ${isSelected
                          ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-500/30'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                      >
                        <div className="space-y-0.5">
                          <span className="font-extrabold text-xs text-gray-900 block">{sub.name}</span>
                          {sub.description && (
                            <p className="text-[11px] text-gray-500 line-clamp-1">{sub.description}</p>
                          )}
                        </div>
                        <span className="font-black text-xs text-purple-700 shrink-0 ml-2">
                          + {sub.price.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="outline" onClick={() => setAddingSubServicesForId(null)} className="text-xs font-bold">
                  Hủy
                </Button>
                <Button
                  onClick={handleAddSubServices}
                  disabled={selectedAddonIds.length === 0 || !!actionLoading}
                  className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-black px-4"
                >
                  {actionLoading ? 'Đang thêm...' : `Xác nhận thêm (${selectedAddonIds.length})`}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment Selection & Confirmation Modal */}
      {completingBooking && paymentMethodStep && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 transition-all transform animate-in fade-in zoom-in duration-200">

            {/* Step 1: SELECT METHOD */}
            {paymentMethodStep === 'METHOD_SELECT' && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <h3 className="text-lg font-black text-gray-900">Xác Nhận Thanh Toán</h3>
                    <p className="text-xs text-gray-500 font-medium">Vui lòng chọn phương thức thanh toán của khách hàng</p>
                  </div>
                  <button
                    onClick={() => { setCompletingBooking(null); setPaymentMethodStep(null); }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-xs text-gray-700">
                    <span className="font-medium text-gray-500">Dịch vụ:</span>
                    <span className="font-bold text-gray-900">{completingBooking.service?.name || 'Dịch vụ Spa'}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-700">
                    <span className="font-medium text-gray-500">Thú cưng:</span>
                    <span className="font-bold text-gray-900">{completingBooking.petName || completingBooking.pet?.name || 'Thú cưng'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-purple-100">
                    <span className="font-bold text-purple-950">Tổng tiền cần thanh toán:</span>
                    <span className="text-base font-black text-purple-700">
                      {(completingBooking.totalPrice || completingBooking.priceSnapshot || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    onClick={() => setPaymentMethodStep('CASH')}
                    className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-green-200 bg-green-50/50 hover:bg-green-100/70 hover:border-green-400 transition-all group"
                  >
                    <div className="p-3 bg-green-600 text-white rounded-2xl mb-3 shadow-md group-hover:scale-110 transition-transform">
                      <Banknote className="size-7" />
                    </div>
                    <span className="font-black text-sm text-green-950">Tiền mặt</span>
                    <span className="text-[11px] text-green-700 font-medium">Thanh toán trực tiếp</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethodStep('TRANSFER')}
                    className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 hover:border-blue-400 transition-all group"
                  >
                    <div className="p-3 bg-blue-600 text-white rounded-2xl mb-3 shadow-md group-hover:scale-110 transition-transform">
                      <QrCode className="size-7" />
                    </div>
                    <span className="font-black text-sm text-blue-950">Chuyển khoản</span>
                    <span className="text-[11px] text-blue-700 font-medium">Quét mã QR VietQR</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: CASH POPUP */}
            {paymentMethodStep === 'CASH' && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 text-green-700 rounded-xl">
                      <Banknote className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900">Thanh Toán Tiền Mặt</h3>
                      <p className="text-xs text-gray-500 font-medium">Thu tiền mặt trực tiếp từ khách hàng</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPaymentMethodStep('METHOD_SELECT')}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Số tiền cần thanh toán</span>
                  <div className="text-3xl font-black text-emerald-700">
                    {(completingBooking.totalPrice || completingBooking.priceSnapshot || 0).toLocaleString('vi-VN')} đ
                  </div>
                  <p className="text-xs text-emerald-600 font-medium pt-1">
                    Nhân viên vui lòng kiểm tra và nhận đủ tiền mặt trước khi bấm xác nhận.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <button
                    onClick={() => setPaymentMethodStep('METHOD_SELECT')}
                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition"
                  >
                    Quay lại
                  </button>
                  <Button
                    onClick={() => handleFinalizeComplete(completingBooking.id, 'CASH')}
                    disabled={actionLoading === completingBooking.id}
                    className="bg-green-600 hover:bg-green-700 text-white font-black text-xs h-10 px-6 rounded-xl shadow-md"
                  >
                    {actionLoading === completingBooking.id ? 'Đang lưu...' : 'Xác nhận'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: TRANSFER POPUP */}
            {paymentMethodStep === 'TRANSFER' && (() => {
              const amount = completingBooking.totalPrice || completingBooking.priceSnapshot || 0;
              const serviceName = completingBooking.service?.name || 'dịch vụ';
              const petName = completingBooking.petName || completingBooking.pet?.name || 'thú cưng';
              const description = `${serviceName} cho thú cưng ${petName}`;
              const bankBin = 'TCB';
              const bankName = 'Techcombank';
              const accountNo = '19070729916012';
              const accountName = 'PETMATCHING SPA';

              const qrUrl = `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;

              const copyToClipboard = (text: string, fieldName: string) => {
                navigator.clipboard.writeText(text);
                setCopiedField(fieldName);
                toast.success(`Đã sao chép ${fieldName}!`);
                setTimeout(() => setCopiedField(null), 2000);
              };

              return (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                        <QrCode className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900">Thanh Toán Chuyển Khoản QR</h3>
                        <p className="text-xs text-gray-500 font-medium">Quét mã QR để hoàn tất thanh toán</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPaymentMethodStep('METHOD_SELECT')}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
                    >
                      <X className="size-5" />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5 bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
                    <div
                      onClick={() => setZoomedQrUrl(qrUrl)}
                      className="w-44 h-44 bg-white p-2 rounded-xl shadow-md border border-blue-200 flex-shrink-0 flex items-center justify-center cursor-pointer hover:border-blue-400 transition group relative"
                      title="Nhấn để phóng to mã QR"
                    >
                      <img
                        src={qrUrl}
                        alt="Mã QR VietQR"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition rounded-xl flex items-center justify-center">
                        <Maximize2 className="size-6 text-blue-700 bg-white/90 p-1 rounded-full shadow-sm" />
                      </div>
                    </div>

                    <div className="flex-1 space-y-2.5 w-full text-xs">
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-gray-500 font-semibold">Ngân hàng:</span>
                        <span className="font-bold text-gray-900">{bankName}</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-gray-500 font-semibold">Số tài khoản:</span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-gray-900">{accountNo}</span>
                          <button
                            onClick={() => copyToClipboard(accountNo, 'Số tài khoản')}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500"
                            title="Sao chép"
                          >
                            {copiedField === 'Số tài khoản' ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-gray-500 font-semibold">Số tiền:</span>
                        <span className="font-black text-blue-700 text-sm">{amount.toLocaleString('vi-VN')} đ</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-100">
                        <span className="text-gray-500 font-semibold">Nội dung:</span>
                        <div className="flex items-center gap-1 max-w-[170px] truncate">
                          <span className="font-bold text-gray-900 truncate" title={description}>{description}</span>
                          <button
                            onClick={() => copyToClipboard(description, 'Nội dung')}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 shrink-0"
                            title="Sao chép"
                          >
                            {copiedField === 'Nội dung' ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <button
                      onClick={() => setPaymentMethodStep('METHOD_SELECT')}
                      className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition"
                    >
                      Quay lại
                    </button>
                    <Button
                      onClick={() => handleFinalizeComplete(completingBooking.id, 'TRANSFER')}
                      disabled={actionLoading === completingBooking.id}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs h-10 px-6 rounded-xl shadow-md"
                    >
                      {actionLoading === completingBooking.id ? 'Đang lưu...' : 'Xác nhận'}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Zoomed QR Code Image Modal */}
      {zoomedQrUrl && (
        <div
          onClick={() => setZoomedQrUrl(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm sm:max-w-md w-full relative border border-gray-100 cursor-default text-center space-y-4"
          >
            <button
              onClick={() => setZoomedQrUrl(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition"
            >
              <X className="size-5" />
            </button>

            <div className="space-y-1 pt-1">
              <h4 className="font-black text-gray-900 text-lg">Mã QR Thanh Toán</h4>
              <p className="text-xs text-gray-500 font-medium">Nhấn ra vùng ngoài để đóng ảnh</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border-2 border-blue-100 shadow-inner flex items-center justify-center max-w-[320px] mx-auto">
              <img
                src={zoomedQrUrl}
                alt="Mã QR Phóng To"
                className="w-full h-auto object-contain rounded-lg"
              />
            </div>

            <div className="text-xs text-gray-600 bg-blue-50/70 p-3 rounded-xl border border-blue-100 font-semibold">
              <span>{completingBooking?.service?.name} • </span>
              <strong className="text-blue-700">{(completingBooking?.totalPrice || completingBooking?.priceSnapshot || 0).toLocaleString('vi-VN')} đ</strong>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Xác nhận đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản nhân viên không?"
        confirmText="Đăng xuất"
        cancelText="Hủy bỏ"
        isDanger={true}
      />
    </main>
  );
}
