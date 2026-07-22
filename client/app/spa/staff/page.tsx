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
  UserCheck
} from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
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

export default function SpaStaffPage() {
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

  // States for the inline forms per booking
  const [editStates, setEditStates] = useState<Record<string, {
    status: string;
    petConditionAfter: string;
    photoAfter: string;
    issueReported: string;
  }>>({});

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

  const handleCompleteBooking = async (bookingId: string) => {
    const state = editStates[bookingId];
    if (!state || !state.petConditionAfter.trim()) {
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

      toast.success('Hoàn thành dịch vụ Spa thành công!');
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...res.data } : b))
      );
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
      <AppHeader sectionLabel="Spa Staff" />

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
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 rounded-lg border border-[var(--border-color)] bg-white px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700"
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
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

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
                  className={`bg-white border rounded-2xl p-6 shadow-xs transition hover:shadow-md ${
                    isCompleted ? 'border-green-150' : 'border-purple-100'
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

                      {/* Service Package & Addons */}
                      <div className="rounded-xl bg-orange-50/70 border border-orange-100 px-4 py-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-orange-600 block uppercase font-extrabold tracking-wider">Gói Dịch Vụ</span>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setAddingSubServicesForId(booking.id);
                              setSelectedAddonIds([]);
                            }}
                            className="text-[10px] text-purple-700 hover:text-purple-900 font-bold p-0 h-auto"
                          >
                            + Thêm dịch vụ lẻ
                          </Button>
                        </div>
                        <span className="font-black text-sm text-orange-950 block">
                          {booking.service?.name || 'Gói Chăm Sóc Spa'}
                        </span>
                        {booking.subServiceIds && booking.subServiceIds.length > 0 && (
                          <div className="text-[11px] text-orange-800 font-medium pt-1">
                            <span className="font-bold">Dịch vụ lẻ đi kèm:</span> {booking.subServiceIds.length} dịch vụ
                          </div>
                        )}
                        <div className="text-xs text-orange-800 font-black pt-1 flex items-center justify-between">
                          <span>Tổng chi phí:</span>
                          <span className="text-sm font-black text-purple-800">
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
                                    className={`px-2 py-0.5 text-[9px] rounded border font-bold hover:bg-gray-50 transition ${
                                      currentEditState.photoAfter === p.url
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
                              onClick={() => handleCompleteBooking(booking.id)}
                              disabled={actionLoading === booking.id || !currentEditState.petConditionAfter.trim()}
                              className="bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs h-9 px-6 rounded-lg shadow-sm"
                            >
                              {actionLoading === booking.id ? 'Đang lưu...' : 'Hoàn thành dịch vụ'}
                            </Button>
                          </div>
                        </div>
                      ) : booking.status === 'COMPLETED' ? (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-4">
                          <h4 className="text-xs font-black uppercase text-green-950 tracking-wider flex items-center gap-1.5">
                            <CheckCircle className="size-4 text-green-600" /> Kết quả dịch vụ (Hoàn thành)
                          </h4>
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
      {addingSubServicesForId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
              <Plus className="size-5 text-purple-600" /> Thêm Dịch Vụ Lẻ Cho Khách Hang
            </h3>
            <p className="text-xs text-gray-500">
              Chọn các dịch vụ lẻ phát sinh trực tiếp tại cửa hàng để cập nhật vào đơn hàng.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {allSubServices.map((sub) => {
                const isSelected = selectedAddonIds.includes(sub.id);
                return (
                  <div
                    key={sub.id}
                    onClick={() =>
                      setSelectedAddonIds((prev) =>
                        prev.includes(sub.id) ? prev.filter((i) => i !== sub.id) : [...prev, sub.id]
                      )
                    }
                    className={`p-3 border rounded-xl cursor-pointer flex items-center justify-between text-xs ${
                      isSelected ? 'border-purple-600 bg-purple-50 font-bold' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{sub.name}</span>
                    <span className="font-black text-purple-700">{sub.price.toLocaleString('vi-VN')}đ</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setAddingSubServicesForId(null)} className="text-xs">
                Hủy
              </Button>
              <Button
                onClick={handleAddSubServices}
                disabled={selectedAddonIds.length === 0 || !!actionLoading}
                className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold"
              >
                Xác nhận thêm ({selectedAddonIds.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
