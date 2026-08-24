'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Calendar,
  ChevronLeft,
  CheckCircle,
  Clock,
  Eye,
  MapPin,
  PawPrint,
  Phone,
  RefreshCw,
  Scissors,
  Sparkles,
  Star,
  User,
  X
} from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import AppPagination from '@/components/ui/app-pagination';
import { spaApi } from '@/lib/api/spa';
import { SpaBookingType, SpaServiceType } from '@/types';

export default function SpaHistory() {
  const router = useRouter();
  const [bookings, setBookings] = useState<SpaBookingType[]>([]);
  const [allServices, setAllServices] = useState<SpaServiceType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 6;

  // Detail Modal State
  const [selectedBooking, setSelectedBooking] = useState<SpaBookingType | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  // Feedback Modal State
  const [feedbackBooking, setFeedbackBooking] = useState<SpaBookingType | null>(null);
  const [rateStaff, setRateStaff] = useState<number>(0);
  const [rateServices, setRateServices] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);

  // Reschedule State
  const [rescheduleBooking, setRescheduleBooking] = useState<SpaBookingType | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<any[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState<boolean>(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<string>('');
  const [submittingReschedule, setSubmittingReschedule] = useState<boolean>(false);

  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to resolve subServices for any booking
  const getBookingSubServices = (booking: SpaBookingType) => {
    if (booking.subServices && booking.subServices.length > 0) {
      return booking.subServices;
    }
    if (booking.subServiceIds && booking.subServiceIds.length > 0) {
      return booking.subServiceIds
        .map((id) => allServices.find((s) => s.id === id))
        .filter((s): s is SpaServiceType => Boolean(s));
    }
    return [];
  };

  const canUserReschedule = (booking: SpaBookingType) => {
    if (!['PENDING', 'CONFIRMED', 'ASSIGNED'].includes(booking.status)) return false;
    if ((booking.rescheduleCount || 0) >= 2) return false;
    const timeVal = booking.scheduledAt || booking.timeStartExpected;
    if (!timeVal) return false;
    const scheduledTime = new Date(timeVal).getTime();
    return (scheduledTime - Date.now()) >= 30 * 60 * 1000;
  };

  const canUserCancel = (booking: SpaBookingType) => {
    if (!['PENDING', 'CONFIRMED', 'ASSIGNED'].includes(booking.status)) return false;
    const timeVal = booking.scheduledAt || booking.timeStartExpected;
    if (!timeVal) return false;
    const scheduledTime = new Date(timeVal).getTime();
    return (scheduledTime - Date.now()) >= 30 * 60 * 1000;
  };

  const openRescheduleModal = (booking: SpaBookingType) => {
    setRescheduleBooking(booking);
    const currentDate = new Date(booking.scheduledAt || Date.now());
    const minDate = new Date();
    const initialDate = currentDate >= minDate ? currentDate : minDate;
    setRescheduleDate(getLocalDateString(initialDate));
    setSelectedRescheduleSlot('');
  };

  const rescheduleDurationMinutes = React.useMemo(() => {
    if (!rescheduleBooking) return 30;

    // 1. Prioritize actual expected duration from the booking record (timeEndExpected - timeStartExpected)
    if (rescheduleBooking.timeStartExpected && rescheduleBooking.timeEndExpected) {
      const diffMins = Math.round(
        (new Date(rescheduleBooking.timeEndExpected).getTime() -
          new Date(rescheduleBooking.timeStartExpected).getTime()) /
          (60 * 1000)
      );
      if (diffMins > 0) {
        return diffMins;
      }
    }

    // 2. Compute from booking's main service and sub services
    const mainSvc =
      (rescheduleBooking.service as any) ||
      allServices.find((s) => s.id === rescheduleBooking.serviceId || s.id === (rescheduleBooking as any).mainServiceId);
    const mainDur = mainSvc ? mainSvc.durationMax || mainSvc.durationMin || 30 : 30;
    const subs = getBookingSubServices(rescheduleBooking) as any[];
    const subsDur = subs.reduce((sum, s) => {
      const matchedSub = allServices.find((as) => as.id === s.id) || s;
      return sum + (matchedSub.durationMax || matchedSub.durationMin || 15);
    }, 0);
    return Math.max(15, mainDur + subsDur);
  }, [rescheduleBooking, allServices]);

  useEffect(() => {
    if (!rescheduleBooking || !rescheduleDate) return;
    const branchId = rescheduleBooking.addressSpaId || rescheduleBooking.branchId;
    if (!branchId) return;

    setLoadingRescheduleSlots(true);
    spaApi.getAvailability(branchId, rescheduleDate, rescheduleDurationMinutes)
      .then((res) => {
        setRescheduleSlots(res.data || []);
      })
      .catch(() => {
        setRescheduleSlots([]);
      })
      .finally(() => {
        setLoadingRescheduleSlots(false);
      });
  }, [rescheduleBooking, rescheduleDate, rescheduleDurationMinutes]);

  const filteredRescheduleSlots = React.useMemo(() => {
    const todayStr = getLocalDateString();
    const isToday = rescheduleDate === todayStr;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const curBookingDate = rescheduleBooking?.scheduledAt
      ? getLocalDateString(new Date(rescheduleBooking.scheduledAt))
      : '';
    const curBookingTime = rescheduleBooking?.scheduledAt
      ? (() => {
          const d = new Date(rescheduleBooking.scheduledAt);
          return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        })()
      : '';

    return rescheduleSlots
      .map((slot) => {
        const [h, m] = slot.time.split(':').map(Number);
        const startMins = h * 60 + m;
        const endMins = startMins + rescheduleDurationMinutes;

        // 1. Hide slot if start time < 09:00 or completion time exceeds 18:00
        if (startMins < 9 * 60 || endMins > 18 * 60) {
          return null;
        }

        // 2. Hide slot if selected date is TODAY and start time is in the past
        if (isToday && startMins < currentMins) {
          return null;
        }

        const isCurrentSlot = rescheduleDate === curBookingDate && slot.time === curBookingTime;
        const isOccupied =
          !slot.isAvailable ||
          slot.remainingSlots <= 0 ||
          !slot.availableStaffs ||
          slot.availableStaffs.length === 0;

        return {
          ...slot,
          isCurrentSlot,
          isOccupied,
          isDisabled: isCurrentSlot || isOccupied,
        };
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  }, [rescheduleSlots, rescheduleDate, rescheduleDurationMinutes, rescheduleBooking]);

  // Auto-deselect selected slot if it becomes invalid/disabled
  useEffect(() => {
    if (selectedRescheduleSlot) {
      const isValid = filteredRescheduleSlots.some((s) => s.time === selectedRescheduleSlot && !s.isDisabled);
      if (!isValid) {
        setSelectedRescheduleSlot('');
      }
    }
  }, [filteredRescheduleSlots, selectedRescheduleSlot]);

  const handleRescheduleSubmit = async () => {
    if (!rescheduleBooking || !rescheduleDate || !selectedRescheduleSlot) {
      toast.error('Vui lòng chọn ngày và giờ hẹn mới.');
      return;
    }

    setSubmittingReschedule(true);
    try {
      const scheduledAt = `${rescheduleDate}T${selectedRescheduleSlot}:00`;
      const res = await spaApi.rescheduleUserBooking(rescheduleBooking.id, scheduledAt);
      toast.success('Đổi lịch hẹn Spa thành công!');

      const updatedBooking = res.data;
      const nextCount = typeof updatedBooking?.rescheduleCount === 'number'
        ? updatedBooking.rescheduleCount
        : (rescheduleBooking.rescheduleCount || 0) + 1;

      setBookings((prev) =>
        prev.map((b) =>
          b.id === rescheduleBooking.id
            ? { ...b, ...updatedBooking, scheduledAt, rescheduleCount: nextCount }
            : b
        )
      );
      if (selectedBooking?.id === rescheduleBooking.id) {
        setSelectedBooking((prev) =>
          prev ? { ...prev, ...updatedBooking, scheduledAt, rescheduleCount: nextCount } : null
        );
      }
      setRescheduleBooking(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể đổi lịch hẹn. Vui lòng thử lại.';
      toast.error(msg);
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const openFeedbackModal = (booking: SpaBookingType) => {
    setFeedbackBooking(booking);
    setRateStaff(0);
    setRateServices(0);
    setComment('');
  };

  const handleSubmittingFeedback = async () => {
    if (!feedbackBooking) return;
    if (rateServices <= 0) {
      toast.error('Vui lòng chọn số sao đánh giá dịch vụ Spa.');
      return;
    }
    if (rateStaff <= 0) {
      toast.error('Vui lòng chọn số sao đánh giá nhân viên.');
      return;
    }
    setSubmittingFeedback(true);
    try {
      const res = await spaApi.createFeedback(feedbackBooking.id, {
        rateStaff,
        rateServices,
        comment: comment.trim() || undefined,
      });
      toast.success('Gửi đánh giá thành công! Cảm ơn bạn đã đóng góp ý kiến.');
      const newFeedback = res.data;
      setBookings((prev) =>
        prev.map((b) =>
          b.id === feedbackBooking.id ? { ...b, feedback: newFeedback } : b
        )
      );
      if (selectedBooking?.id === feedbackBooking.id) {
        setSelectedBooking((prev) => (prev ? { ...prev, feedback: newFeedback } : null));
      }
      setFeedbackBooking(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.';
      toast.error(msg);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const [bookingsRes, servicesRes] = await Promise.all([
        spaApi.getMyBookings(),
        spaApi.getServices(),
      ]);
      setBookings(bookingsRes.data || []);
      setAllServices(servicesRes.data || []);
    } catch {
      toast.error('Không thể tải danh sách lịch hẹn Spa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để xem lịch hẹn Spa của bạn.');
      router.push('/login?redirect=/spa/bookings');
      return;
    }
    fetchBookings();
  }, [router]);



  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn Spa này?')) {
      return;
    }

    setCancellingId(bookingId);
    try {
      await spaApi.cancelBooking(bookingId);
      toast.success('Hủy lịch hẹn thành công.');
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' } : b))
      );
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể hủy lịch hẹn. Vui lòng thử lại.';
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const openDetailModal = (booking: SpaBookingType) => {
    setSelectedBooking(booking);
    setDetailModalOpen(true);
  };

  // Helper to format date nicely in Vietnamese
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[d.getDay()];

    return `${time} - ${dayName}, ${date}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800">
            Chờ xác nhận
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-800">
            Đã xác nhận
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-800">
            Đã phân công
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="rounded-full bg-orange-50 border border-orange-200 px-3 py-1 text-xs font-bold text-orange-800">
            Đang thực hiện
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-bold text-green-800">
            Đã hoàn thành
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-red-800">
            Đã hủy
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-bold text-gray-800">
            Khách vắng mặt
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-bold text-gray-800">
            {status}
          </span>
        );
    }
  };

  const sortedBookings = React.useMemo(() => {
    return [...bookings].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [bookings]);

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-12">
      <AppHeader sectionLabel="Spa" />

      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
          <div className="space-y-1">
            <Link
              href="/spa"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <ChevronLeft className="size-3" />
              Quay lại trang Spa
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Lịch Hẹn Spa Của Tôi</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Theo dõi và quản lý lịch hẹn chăm sóc thú cưng của bạn.
            </p>
          </div>

          <Button
            onClick={fetchBookings}
            variant="outline"
            size="icon"
            disabled={loading}
            className="size-9 rounded-md border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Bookings List */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="inline-block size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 font-semibold text-sm">Đang tải lịch hẹn của bạn...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[var(--border-color)] rounded-xl p-8 space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Calendar className="size-6" />
            </div>
            <h3 className="text-lg font-bold">Chưa có lịch hẹn nào</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Bạn chưa đăng ký lịch chăm sóc spa nào cho thú cưng của mình. Hãy đặt lịch hẹn để thú cưng nhận được sự chăm sóc tuyệt vời nhất nhé!
            </p>
            <Button asChild className="bg-primary hover:bg-primary/95 text-white font-bold text-xs">
              <Link href="/spa">Đặt lịch hẹn ngay</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedBookings
              .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
              .map((booking) => (
              <div
                key={booking.id}
                onClick={() => openDetailModal(booking)}
                className="bg-card border border-[var(--border-color)] rounded-xl p-5 shadow-xs space-y-4 transition hover:shadow-md cursor-pointer group"
              >
                {/* Top Section: Status and Price */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(booking.status)}
                    {booking.payment?.status === 'PAID' && (
                      <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 flex items-center gap-1">
                        ✓ Đã thanh toán
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">
                      ID: #{booking.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-[var(--text-muted)] block sm:inline mr-1">Tổng cộng:</span>
                      <span className="text-lg font-black text-primary">
                        {(booking.totalPrice || booking.priceSnapshot || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetailModal(booking);
                      }}
                      className="text-xs font-bold gap-1 text-primary border-primary/30 hover:bg-primary/5"
                    >
                      <Eye className="size-3.5" />
                      Xem chi tiết
                    </Button>
                  </div>
                </div>

                {/* Middle Section: Info details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-color)] text-sm">
                  {/* Service and Pet information */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Scissors className="size-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-gray-400 block leading-none">Dịch vụ chính</span>
                        <span className="font-bold text-[var(--text-main)]">
                          {booking.service?.name || 'Dịch vụ Spa'}
                        </span>
                        {(() => {
                          const subList = getBookingSubServices(booking);
                          if (subList.length === 0) return null;
                          return (
                            <div className="mt-1 space-y-0.5">
                              <span className="text-[11px] font-bold text-gray-500 block">Dịch vụ thêm:</span>
                              <div className="flex flex-wrap gap-1">
                                {subList.map((sub, i) => (
                                  <span
                                    key={i}
                                    className="inline-block rounded bg-gray-100 text-gray-700 text-[10px] font-medium px-1.5 py-0.5"
                                  >
                                    + {sub.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PawPrint className="size-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="text-xs text-gray-400 block leading-none">Thú cưng</span>
                        <span className="font-bold text-[var(--text-main)]">{booking.petName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Scheduled time and Branch info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-primary shrink-0" />
                      <div>
                        <span className="text-xs text-gray-400 block leading-none">Thời gian hẹn</span>
                        <span className="font-bold text-[var(--text-main)]">
                          {formatDateTime(booking.scheduledAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-gray-400 block leading-none">Địa chỉ Spa</span>
                        <span className="font-semibold text-[var(--text-main)]">
                          {booking.addressSpa?.name || 'PetMatch Spa – Quận 1'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Section: Action buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-dashed border-gray-200">
                  {canUserReschedule(booking) && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRescheduleModal(booking);
                      }}
                      variant="outline"
                      className="text-xs text-purple-700 hover:text-purple-800 hover:bg-purple-50 border-purple-200 font-bold px-3.5 h-8 gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="size-3.5" />
                      Đổi lịch
                    </Button>
                  )}

                  {canUserCancel(booking) && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelBooking(booking.id);
                      }}
                      disabled={cancellingId === booking.id}
                      variant="ghost"
                      className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 font-semibold px-4 h-8"
                    >
                      {cancellingId === booking.id ? 'Đang hủy...' : 'Hủy lịch hẹn'}
                    </Button>
                  )}

                  {booking.status === 'COMPLETED' && (
                    booking.feedback ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-xs cursor-default"
                      >
                        <CheckCircle className="size-3.5" />
                        Đã đánh giá
                      </button>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          openFeedbackModal(booking);
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 h-8 gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Star className="size-3.5 fill-white text-white" />
                        Đánh giá
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))}
            <AppPagination
              currentPage={currentPage}
              totalItems={sortedBookings.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="lịch hẹn"
            />
          </div>
        )}
      </div>

      {/* DETAIL MODAL DIALOG */}
      {detailModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8 border border-gray-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold tracking-tight">Chi Tiết Lịch Hẹn Spa</h3>
                  <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded text-white/90">
                    #{selectedBooking.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-purple-200">
                  {formatDateTime(selectedBooking.scheduledAt)}
                </p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="rounded-full p-1.5 text-white/80 hover:text-white hover:bg-white/20 transition"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs font-bold text-gray-600">Trạng thái lịch hẹn:</span>
                {getStatusBadge(selectedBooking.status)}
              </div>

              {/* SERVICES LIST: MAIN SERVICE ON TOP, SUB SERVICES BELOW */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
                  <Scissors className="size-4 text-primary" /> Danh Sách Dịch Vụ Đã Chọn
                </h4>

                <div className="space-y-2.5">
                  {/* MAIN SERVICE (ALWAYS ON TOP) */}
                  <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-purple-800 bg-purple-200/80 px-2 py-0.5 rounded uppercase tracking-wider">
                        <Sparkles className="size-3 text-purple-700" /> Dịch vụ chính
                      </span>
                      <span className="text-sm font-black text-purple-900">
                        {(selectedBooking.service?.price || selectedBooking.priceSnapshot || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-gray-900 pt-1">
                      {selectedBooking.service?.name || 'Gói Spa Chăm Sóc'}
                    </p>
                    {selectedBooking.service?.description && (
                      <p className="text-xs text-gray-600 leading-relaxed pt-0.5">
                        {selectedBooking.service.description}
                      </p>
                    )}
                  </div>

                  {/* SUB SERVICES (BELOW IF ANY) */}
                  {(() => {
                    const modalSubList = getBookingSubServices(selectedBooking);
                    if (modalSubList.length === 0) {
                      return <p className="text-xs text-gray-400 italic px-1">Không có dịch vụ phụ đi kèm.</p>;
                    }
                    return (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-extrabold text-gray-700 block px-1">
                          Dịch vụ phụ chọn thêm ({modalSubList.length}):
                        </span>
                        {modalSubList.map((sub, idx) => (
                          <div
                            key={sub.id || idx}
                            className="flex items-center justify-between p-3.5 bg-green-50/60 border border-green-200 rounded-xl transition"
                          >
                            <div className="space-y-0.5 pr-2">
                              <p className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-green-600 shrink-0" />
                                {sub.name}
                              </p>
                              {sub.description && (
                                <p className="text-[11px] text-gray-600 line-clamp-1 pl-3.5">{sub.description}</p>
                              )}
                            </div>
                            <span className="text-xs font-black text-green-700 bg-white px-2.5 py-1 rounded-lg border border-green-200 shrink-0">
                              + {(sub.price || 0).toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* PET & BRANCH INFO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pet Info */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Thú cưng thực hiện</span>
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 font-bold">
                      🐾
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-gray-900">{selectedBooking.petName}</p>
                      <p className="text-xs text-gray-500">
                        {selectedBooking.petSpecies === 'CAT' ? '🐱 Mèo' : '🐶 Chó'} • {selectedBooking.petWeight || 3} kg
                      </p>
                    </div>
                  </div>
                </div>

                {/* Staff Info (If assigned) */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Nhân viên tiếp nhận</span>
                  {selectedBooking.staff ? (
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0 font-bold">
                        <User className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-gray-900">{selectedBooking.staff.name}</p>
                        <p className="text-xs text-green-600 font-bold">KTV Chăm sóc chính</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic pt-2">Spa sẽ phân công nhân viên khi bạn tới cửa hàng.</p>
                  )}
                </div>
              </div>

              {/* LOCATION & TIME */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Địa điểm & Thời gian</span>
                <div className="space-y-1.5 text-xs text-gray-700">
                  <div className="flex items-start gap-2">
                    <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-900 block">{selectedBooking.addressSpa?.name || 'PetMatch Spa'}</strong>
                      <span>{selectedBooking.addressSpa?.address || 'Hệ thống Spa PetMatching'}</span>
                      {selectedBooking.addressSpa?.phone && (
                        <span className="block text-gray-500 mt-0.5">SĐT: {selectedBooking.addressSpa.phone}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
                    <Clock className="size-4 text-primary shrink-0" />
                    <span>Hẹn lúc: <strong className="text-gray-900">{formatDateTime(selectedBooking.scheduledAt)}</strong></span>
                  </div>
                </div>
              </div>

              {/* CANCELLATION INFO */}
              {selectedBooking.status === 'CANCELLED' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-red-700 font-extrabold text-xs">
                    <X className="size-4" />
                    <span>Lịch hẹn này đã bị hủy</span>
                  </div>
                  {selectedBooking.cancelReason && (
                    <p className="text-xs text-red-950 leading-relaxed font-semibold">
                      <span className="font-bold text-red-900">Lý do:</span> {selectedBooking.cancelReason}
                    </p>
                  )}
                </div>
              )}

              {/* CUSTOMER NOTE */}
              {selectedBooking.note && (
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1">
                  <span className="text-xs font-bold text-amber-900 block">Ghi chú của bạn:</span>
                  <p className="text-xs text-amber-950 leading-relaxed">{selectedBooking.note}</p>
                </div>
              )}

              {/* STAFF CONDITION / AFTER PHOTO */}
              {(selectedBooking.petConditionAfter || selectedBooking.photoAfter) && (
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-blue-900 block">Báo cáo sau khi hoàn tất dịch vụ:</span>
                  {selectedBooking.petConditionAfter && (
                    <p className="text-xs text-blue-950 leading-relaxed">{selectedBooking.petConditionAfter}</p>
                  )}
                  {selectedBooking.photoAfter && (
                    <div className="mt-2 aspect-video max-w-sm rounded-lg overflow-hidden border border-blue-200">
                      <img src={selectedBooking.photoAfter} alt="Ảnh sau spa" className="size-full object-cover" />
                    </div>
                  )}
                </div>
              )}

              {/* USER FEEDBACK SECTION */}
              {selectedBooking.feedback && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                      <Star className="size-4 text-amber-500 fill-amber-500" />
                      Đánh giá của bạn
                    </span>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300">
                      Đã đánh giá
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Rate Service */}
                    <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/60 space-y-1">
                      <span className="text-[11px] font-bold text-gray-600 block">Chất lượng dịch vụ:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`size-3.5 ${
                              star <= (selectedBooking.feedback?.rateServices || 0)
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="text-xs font-black text-amber-700 ml-1">
                          {selectedBooking.feedback.rateServices || 0}/5
                        </span>
                      </div>
                    </div>

                    {/* Rate Staff */}
                    <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/60 space-y-1">
                      <span className="text-[11px] font-bold text-gray-600 block">Thái độ nhân viên:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`size-3.5 ${
                              star <= (selectedBooking.feedback?.rateStaff || 0)
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="text-xs font-black text-amber-700 ml-1">
                          {selectedBooking.feedback.rateStaff || 0}/5
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Comment */}
                  {selectedBooking.feedback.comment && (
                    <div className="bg-white/90 p-3 rounded-lg border border-amber-200/80 space-y-1 text-xs">
                      <span className="font-bold text-gray-700 block">Nhận xét chi tiết:</span>
                      <p className="text-gray-800 italic leading-relaxed">
                        "{selectedBooking.feedback.comment}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TOTAL PRICE SUMMARY */}
              <div className="p-4 bg-gray-900 text-white rounded-xl flex items-center justify-between shadow-md">
                <div>
                  <span className="text-xs text-gray-400 block font-semibold">TỔNG TIỀN THANH TOÁN</span>
                  <span className="text-xs text-emerald-400 font-bold">Thanh toán tại cửa hàng sau khi hoàn tất</span>
                </div>
                <span className="text-2xl font-black text-white">
                  {(selectedBooking.totalPrice || selectedBooking.priceSnapshot || 0).toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center gap-2">
                {selectedBooking.status === 'COMPLETED' && !selectedBooking.feedback && (
                  <Button
                    onClick={() => {
                      const b = selectedBooking;
                      setDetailModalOpen(false);
                      openFeedbackModal(b);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Star className="size-3.5 fill-white text-white" />
                    Đánh giá dịch vụ
                  </Button>
                )}

                {canUserReschedule(selectedBooking) && (
                  <Button
                    onClick={() => {
                      const b = selectedBooking;
                      setDetailModalOpen(false);
                      openRescheduleModal(b);
                    }}
                    variant="outline"
                    className="border-purple-200 text-purple-700 hover:bg-purple-50 text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" />
                    Đổi lịch hẹn
                  </Button>
                )}

                {canUserCancel(selectedBooking) && (
                  <Button
                    onClick={() => handleCancelBooking(selectedBooking.id)}
                    disabled={cancellingId === selectedBooking.id}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold cursor-pointer"
                  >
                    {cancellingId === selectedBooking.id ? 'Đang hủy...' : 'Hủy lịch hẹn này'}
                  </Button>
                )}
              </div>

              <Button
                onClick={() => setDetailModalOpen(false)}
                className="bg-primary hover:bg-primary/95 text-white font-black text-xs px-6 cursor-pointer"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK POPUP MODAL */}
      {feedbackBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <div className="flex items-center gap-2">
                <Star className="size-5 fill-white text-white" />
                <h3 className="text-base font-extrabold">Đánh giá dịch vụ & nhân viên</h3>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackBooking(null)}
                className="rounded-full p-1 text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Booking Summary */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200/70 rounded-xl text-xs space-y-1">
                <p className="font-bold text-amber-900 text-sm">
                  {feedbackBooking.service?.name || 'Dịch vụ Spa'}
                </p>
                <p className="text-amber-800">
                  Thú cưng: <span className="font-semibold">{feedbackBooking.petName}</span> • Chi nhánh: <span className="font-semibold">{feedbackBooking.addressSpa?.name || 'PetMatch Spa'}</span>
                </p>
              </div>

              {/* Service Rating */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wider block">
                  Đánh giá dịch vụ Spa
                </label>
                <div className="flex items-center gap-1 bg-gray-50 p-3 rounded-xl border border-gray-200 justify-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRateServices(star)}
                      className="p-1 text-amber-400 hover:scale-125 transition cursor-pointer"
                    >
                      <Star
                        className={`size-7 ${star <= rateServices ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                          }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Staff Rating */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wider block">
                  Đánh giá nhân viên
                </label>
                <div className="flex items-center gap-1 bg-gray-50 p-3 rounded-xl border border-gray-200 justify-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRateStaff(star)}
                      className="p-1 text-amber-400 hover:scale-125 transition cursor-pointer"
                    >
                      <Star
                        className={`size-7 ${star <= rateStaff ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                          }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment Textarea */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-700 tracking-wider block">
                  Feedback <span className="text-gray-400 font-normal lowercase"></span>
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Nhập phản hồi của bạn"
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                />
              </div>

              {/* Bottom Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFeedbackBooking(null)}
                  disabled={submittingFeedback}
                  className="text-xs font-bold text-gray-600 border-gray-300 hover:bg-gray-100 px-5 h-9 cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmittingFeedback}
                  disabled={submittingFeedback}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-6 h-9 shadow-sm cursor-pointer"
                >
                  {submittingFeedback ? 'Đang lưu...' : 'Đánh giá'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL DIALOG */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 my-8">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-5" />
                <div>
                  <h3 className="text-base font-extrabold">Đổi Lịch Hẹn Spa</h3>
                  <p className="text-xs text-purple-200">
                    Lịch hiện tại: {formatDateTime(rescheduleBooking.scheduledAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleBooking(null)}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Branch & Pet Info */}
              <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3.5 text-xs text-purple-900 space-y-1">
                <p><strong>Thú cưng:</strong> {rescheduleBooking.petName || 'Thú cưng'}</p>
                <p><strong>Chi nhánh:</strong> {rescheduleBooking.addressSpa?.name || 'PetMatch Spa'}</p>
                <p><strong>Dịch vụ:</strong> {rescheduleBooking.service?.name || 'Dịch vụ Spa'}</p>
                <p className="text-purple-700 font-medium">
                  <strong>Thời lượng dự kiến:</strong> {rescheduleDurationMinutes} phút
                  {rescheduleDurationMinutes >= 60 ? ` (~${(rescheduleDurationMinutes / 60).toFixed(1).replace('.0', '')} tiếng)` : ''}
                </p>
              </div>

              {/* Date Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Chọn Ngày Hẹn Mới *
                </label>
                <input
                  type="date"
                  min={getLocalDateString()}
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setSelectedRescheduleSlot('');
                  }}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </div>

              {/* Slot Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Chọn Giờ Hẹn Khả Dụng *
                </label>
                {loadingRescheduleSlots ? (
                  <div className="text-center py-6 text-xs text-gray-400">
                    <div className="inline-block size-5 animate-spin rounded-full border-2 border-primary border-t-transparent mb-1" />
                    <p>Đang tải danh sách khung giờ...</p>
                  </div>
                ) : filteredRescheduleSlots.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto p-1">
                    {filteredRescheduleSlots.map((slot: any) => {
                      const isSelected = selectedRescheduleSlot === slot.time;
                      const isCurrent = slot.isCurrentSlot;
                      const isDisabled = slot.isDisabled;

                      let buttonStyle =
                        'bg-white text-gray-800 border-gray-200 hover:border-primary/50 hover:bg-primary/5 cursor-pointer shadow-2xs';

                      if (isCurrent) {
                        // Slot người dùng đang đặt hiện tại: ô đen/tối màu và không thể chọn
                        buttonStyle =
                          'bg-slate-900 text-slate-300 border-slate-900 cursor-not-allowed opacity-80 shadow-inner';
                      } else if (isDisabled) {
                        buttonStyle =
                          'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50';
                      } else if (isSelected) {
                        buttonStyle =
                          'bg-primary text-white border-primary shadow-sm scale-105 cursor-pointer font-bold';
                      }

                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            if (!isDisabled) {
                              setSelectedRescheduleSlot(slot.time);
                            }
                          }}
                          title={
                            isCurrent
                              ? 'Lịch hẹn hiện tại của bạn (không thể chọn lại trùng giờ)'
                              : isDisabled
                              ? 'Khung giờ này đã kín chỗ'
                              : 'Chọn khung giờ này'
                          }
                          className={`py-2 px-2.5 rounded-xl text-xs border transition-all flex flex-col items-center justify-center gap-0.5 ${buttonStyle}`}
                        >
                          <span className="font-mono font-bold text-xs">{slot.time}</span>
                          {isCurrent ? (
                            <span className="text-[9px] font-semibold text-amber-300">
                              Lịch hiện tại
                            </span>
                          ) : isDisabled ? (
                            <span className="text-[9px] font-medium text-gray-400">
                              Hết chỗ
                            </span>
                          ) : (
                            <span
                              className={`text-[9px] font-medium ${
                                isSelected ? 'text-white/90' : 'text-gray-400'
                              }`}
                            >
                              Còn {slot.remainingSlots} chỗ
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200 font-medium">
                    Không có khung giờ nào còn trống trong ngày này. Vui lòng chọn ngày khác.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRescheduleBooking(null)}
                disabled={submittingReschedule}
                className="text-xs font-bold px-4 cursor-pointer"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                onClick={handleRescheduleSubmit}
                disabled={submittingReschedule || !selectedRescheduleSlot}
                className="bg-primary hover:bg-primary/95 text-white text-xs font-extrabold px-5 gap-1.5 shadow-sm cursor-pointer"
              >
                {submittingReschedule ? 'Đang cập nhật...' : 'Xác nhận đổi lịch'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
