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
  ClipboardList
} from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { spaApi } from '@/lib/api/spa';
import { SpaBookingType } from '@/types';

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

    // Default filter date to today
    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedDate(todayStr);
  }, []);

  const fetchBookings = async () => {
    if (!currentUser || currentUser.accessDenied) return;
    setLoading(true);
    try {
      const [bookingsRes, profileRes] = await Promise.all([
        spaApi.getStaffBookings(),
        spaApi.getStaffProfile().catch(() => ({ data: null })),
      ]);

      setBookings(bookingsRes.data || []);
      setStaffProfile(profileRes.data || null);
      
      // Initialize edit states for each booking
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

  const handleUpdateBooking = async (bookingId: string) => {
    const state = editStates[bookingId];
    if (!state) return;

    setActionLoading(bookingId);
    try {
      const res = await spaApi.updateStaffBooking(bookingId, {
        status: state.status,
        petConditionAfter: state.petConditionAfter || null,
        photoAfter: state.photoAfter || null,
        issueReported: state.issueReported || null
      });

      toast.success('Cập nhật thông tin lịch hẹn thành công!');
      // Update local state
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...res.data } : b))
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể cập nhật lịch hẹn.';
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

  // Filter bookings based on status tab and selected date
  const filteredBookings = bookings.filter((b) => {
    // Date filter
    const bookingDate = new Date(b.scheduledAt).toISOString().split('T')[0];
    if (selectedDate && bookingDate !== selectedDate) {
      return false;
    }

    // Status tab filter
    if (activeTab === 'ALL') return true;
    if (activeTab === 'CONFIRMED') return b.status === 'CONFIRMED';
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

  // Today's count
  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookingsCount = bookings.filter((b) => new Date(b.scheduledAt).toISOString().split('T')[0] === todayStr).length;

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-16">
      <AppHeader sectionLabel="Spa Staff" />

      {/* Purple banner section */}
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
              <h1 className="text-2xl font-black tracking-tight">{currentUser?.name || 'Lê Thị Hoa'}</h1>
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

      {/* Main Dashboard Space */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        
        {/* Controls: Date Picker & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-5">
          {/* Left: Date selector */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 rounded-lg border border-[var(--border-color)] bg-white px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700"
              />
            </div>
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

          {/* Right: Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-lg border">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'CONFIRMED', label: 'Đã xác nhận' },
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
              Không tìm thấy lịch hẹn được giao cho bạn vào ngày {selectedDate ? formatDateVietnamese(selectedDate) : 'đang chọn'} với trạng thái này.
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
              const isCancelled = booking.status === 'CANCELLED';
              const isNoShow = booking.status === 'NO_SHOW';
              const statusInfo = getStatusLabelAndStyle(booking.status);

              return (
                <div
                  key={booking.id}
                  className={`bg-white border rounded-2xl p-6 shadow-xs transition hover:shadow-md ${
                    isCompleted ? 'border-green-150' : 'border-purple-100'
                  }`}
                >
                  
                  {/* Top line: Time Slot & Status Badge */}
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
                    <div>
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${statusInfo.class}`}>
                        {statusInfo.text}
                      </span>
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
                          {booking.pet && (
                            <span className="text-[10px] text-gray-500 font-bold block mt-0.5">
                              {booking.pet.breed} • {booking.pet.weight}kg
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

                      {/* Service Package */}
                      <div className="rounded-xl bg-orange-50/70 border border-orange-100 px-4 py-3">
                        <span className="text-[10px] text-orange-600 block uppercase font-extrabold tracking-wider">Gói Dịch Vụ</span>
                        <span className="font-black text-sm text-orange-950">
                          {booking.service?.name || 'Chăm sóc toàn diện'}
                        </span>
                        <span className="text-xs text-orange-700 font-bold block mt-0.5">
                          Chi phí: {booking.priceSnapshot?.toLocaleString('vi-VN') || '0'}đ
                        </span>
                      </div>

                      {/* Customer Notes */}
                      {booking.note && (
                        <div className="bg-gray-50/75 border border-dashed rounded-xl p-3 text-xs text-gray-600">
                          <span className="font-bold block text-gray-700 mb-1">💬 Ghi chú từ khách hàng:</span>
                          <p className="italic">"{booking.note}"</p>
                        </div>
                      )}
                    </div>

                    {/* Right update pane */}
                    <div className="md:col-span-7 space-y-4">
                      {isCompleted ? (
                        /* Completed Booking details Display */
                        <div className="space-y-4 h-full flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-800 space-y-2">
                              <span className="font-bold flex items-center gap-1.5 text-green-950">
                                <CheckCircle className="size-4 text-green-600" />
                                Báo cáo sau dịch vụ
                              </span>
                              <p className="font-medium">
                                <span className="font-bold">Tình trạng:</span> {booking.petConditionAfter || 'Không ghi chú.'}
                              </p>
                              {booking.issueReported && (
                                <p className="bg-red-50 border border-red-200 p-2 rounded-lg text-red-800 mt-2 font-medium">
                                  <span className="font-bold flex items-center gap-1">⚠️ Sự cố:</span> {booking.issueReported}
                                </p>
                              )}
                            </div>
                            
                            {booking.photoAfter && (
                              <div className="space-y-1.5">
                                <span className="text-[11px] text-gray-400 block font-semibold">Ảnh kết quả sau dịch vụ</span>
                                <div className="max-w-[280px] rounded-lg overflow-hidden border">
                                  <img
                                    src={booking.photoAfter}
                                    alt="Result"
                                    className="w-full h-auto object-cover max-h-40"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-[11px] text-gray-400 font-semibold italic text-right">
                            Hoàn thành chăm sóc vào lúc {new Date(booking.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ) : isCancelled ? (
                        /* Cancelled Booking Display */
                        <div className="flex h-full items-center justify-center text-center p-8 bg-red-50/50 rounded-xl border border-red-100">
                          <div>
                            <AlertTriangle className="size-8 text-red-500 mx-auto mb-2" />
                            <span className="font-bold text-sm text-red-950 block">Lịch hẹn đã bị hủy</span>
                            <span className="text-xs text-red-700">Lịch này đã được người dùng hoặc hệ thống hủy bỏ.</span>
                          </div>
                        </div>
                      ) : isNoShow ? (
                        /* No Show Display */
                        <div className="flex h-full items-center justify-center text-center p-8 bg-gray-50 rounded-xl border border-gray-200">
                          <div>
                            <AlertTriangle className="size-8 text-gray-500 mx-auto mb-2" />
                            <span className="font-bold text-sm text-gray-950 block">Khách vắng mặt (No Show)</span>
                            <span className="text-xs text-gray-600">Được đánh dấu là khách không đến đúng hẹn.</span>
                          </div>
                        </div>
                      ) : (
                        /* ACTIVE / EDITABLE FORM FOR STAFF */
                        <div className="space-y-4">
                          <h4 className="text-xs font-black uppercase text-purple-900 tracking-wider flex items-center gap-1.5">
                            <ClipboardList className="size-4" />
                            Cập nhật tiến trình & Báo cáo
                          </h4>

                          {/* Status select input */}
                          <div className="space-y-1">
                            <label className="text-[11px] text-gray-400 font-bold">Trạng thái dịch vụ</label>
                            <Select
                              value={currentEditState.status}
                              onValueChange={(val) => handleFieldChange(booking.id, 'status', val)}
                            >
                              <SelectTrigger className="bg-white border-gray-300">
                                <SelectValue placeholder="Chọn trạng thái" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ASSIGNED">Đã tiếp nhận (Assigned)</SelectItem>
                                <SelectItem value="IN_PROGRESS">Đang thực hiện (In Progress)</SelectItem>
                                <SelectItem value="COMPLETED">Hoàn thành (Done)</SelectItem>
                                <SelectItem value="NO_SHOW">Khách vắng mặt (No Show)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Status specific fields */}
                          {currentEditState.status === 'COMPLETED' && (
                            <>
                              {/* Pet condition field */}
                              <div className="space-y-1 animate-in slide-in-from-top-3 duration-250">
                                <label className="text-[11px] text-gray-400 font-bold">Tình trạng thú cưng sau dịch vụ *</label>
                                <Textarea
                                  placeholder="Ví dụ: Bé ngoan, sấy lông rất tốt, không có vấn đề ngoài da..."
                                  value={currentEditState.petConditionAfter}
                                  onChange={(e) => handleFieldChange(booking.id, 'petConditionAfter', e.target.value)}
                                  className="min-h-[70px] text-xs"
                                  required
                                />
                              </div>

                              {/* Photo URL field */}
                              <div className="space-y-1.5 animate-in slide-in-from-top-3 duration-250">
                                <label className="text-[11px] text-gray-400 font-bold flex items-center gap-1">
                                  <Camera className="size-3" /> Ảnh sau dịch vụ (URL hoặc chọn mẫu dưới)
                                </label>
                                <Input
                                  placeholder="https://example.com/pet.jpg"
                                  value={currentEditState.photoAfter}
                                  onChange={(e) => handleFieldChange(booking.id, 'photoAfter', e.target.value)}
                                  className="text-xs h-9"
                                />
                                
                                {/* Quick Presets */}
                                <div className="flex flex-wrap items-center gap-1 pt-1">
                                  {PRESET_PHOTOS.map((p) => (
                                    <button
                                      key={p.label}
                                      type="button"
                                      onClick={() => handleFieldChange(booking.id, 'photoAfter', p.url)}
                                      className={`px-2 py-1 text-[10px] rounded border font-semibold hover:bg-gray-50 transition ${
                                        currentEditState.photoAfter === p.url
                                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                                          : 'border-gray-200 text-gray-500'
                                      }`}
                                    >
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          {/* Problem report field */}
                          <div className="space-y-1">
                            <label className="text-[11px] text-gray-400 font-bold flex items-center gap-1.5 text-red-700">
                              <AlertTriangle className="size-3" /> Báo cáo sự cố cho Spa Manager (nếu có)
                            </label>
                            <Textarea
                              placeholder="Nhập chi tiết sự cố cần trợ giúp (ví dụ: bé cắn nhân viên, có vết thương trước khi tắm...)"
                              value={currentEditState.issueReported}
                              onChange={(e) => handleFieldChange(booking.id, 'issueReported', e.target.value)}
                              className="min-h-[60px] text-xs"
                            />
                          </div>

                          {/* Submit button */}
                          <div className="flex justify-end pt-1">
                            <Button
                              onClick={() => handleUpdateBooking(booking.id)}
                              disabled={
                                actionLoading === booking.id ||
                                (currentEditState.status === 'COMPLETED' && !currentEditState.petConditionAfter.trim())
                              }
                              className="bg-[#6D28D9] hover:bg-[#5b21b6] text-white font-extrabold text-xs h-9 px-5 rounded-lg"
                            >
                              {actionLoading === booking.id ? 'Đang lưu...' : 'Lưu cập nhật'}
                            </Button>
                          </div>
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
    </main>
  );
}
