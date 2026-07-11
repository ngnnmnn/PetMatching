'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Calendar, ChevronLeft, Clock, MapPin, Phone, RefreshCw, Scissors } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { spaApi } from '@/lib/api/spa';
import { SpaBookingType } from '@/types';

export default function SpaBookingsPage() {
  const [bookings, setBookings] = useState<SpaBookingType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await spaApi.getMyBookings();
      setBookings(res.data || []);
    } catch {
      toast.error('Không thể tải danh sách lịch hẹn Spa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn Spa này?')) {
      return;
    }

    setCancellingId(bookingId);
    try {
      await spaApi.cancelBooking(bookingId);
      toast.success('Hủy lịch hẹn thành công.');
      // Update local state without full reload
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' } : b))
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể hủy lịch hẹn. Vui lòng thử lại.';
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  // Helper to format date nicely in Vietnamese
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    // Day of week
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[d.getDay()];

    return `${time} - ${dayName}, ${date}`;
  };

  // Helper to get status badges styling
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
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-card border border-[var(--border-color)] rounded-xl p-5 shadow-xs space-y-4 transition hover:shadow-sm"
              >
                {/* Top Section: Status and Price */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(booking.status)}
                    <span className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">
                      ID: #{booking.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[var(--text-muted)] block sm:inline mr-1">Chi phí:</span>
                    <span className="text-lg font-black text-primary">
                      {booking.priceSnapshot?.toLocaleString('vi-VN') || '0'}đ
                    </span>
                  </div>
                </div>

                {/* Middle Section: Info details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-color)] text-sm">
                  {/* Service and Pet information */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Scissors className="size-4 text-primary shrink-0" />
                      <div>
                        <span className="text-xs text-gray-400 block leading-none">Dịch vụ</span>
                        <span className="font-bold text-[var(--text-main)]">
                          {booking.service?.name || 'Dịch vụ Spa'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="size-4 flex items-center justify-center shrink-0">
                        <span className="text-xs">🐾</span>
                      </div>
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
                        <span className="text-xs text-gray-400 block leading-none">Địa chỉ</span>
                        <span className="font-semibold text-[var(--text-main)]">
                          {booking.addressSpa?.name || 'Chưa chọn cơ sở'}
                        </span>
                        {booking.addressSpa?.address && (
                          <span className="text-xs text-[var(--text-muted)] block leading-snug">
                            {booking.addressSpa.address}
                          </span>
                        )}
                        {booking.addressSpa?.phone && (
                          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5 leading-none">
                            <Phone className="size-3" /> {booking.addressSpa.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Note section */}
                {booking.note && (
                  <div className="bg-muted/40 rounded-lg p-3 text-xs text-[var(--text-muted)] border border-dashed">
                    <span className="font-bold block text-[var(--text-main)] mb-1">Ghi chú của bạn:</span>
                    {booking.note}
                  </div>
                )}

                {/* Bottom Section: Action cancel */}
                {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => handleOpenBookingCancel(booking.id)}
                      disabled={cancellingId === booking.id}
                      variant="ghost"
                      className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 font-semibold px-4 h-9"
                    >
                      {cancellingId === booking.id ? 'Đang hủy...' : 'Hủy lịch hẹn'}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );

  function handleOpenBookingCancel(id: string) {
    handleCancelBooking(id);
  }
}
