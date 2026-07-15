'use client';

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Scissors,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Award,
  CircleDot,
  Plus
} from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/axios';
import { spaApi } from '@/lib/api/spa';
import { SpaBranchType, SpaServiceType, SpaStaffType, AddressSpaType } from '@/types';

interface PetType {
  id: string;
  name: string;
  breed: string;
  avatarUrl?: string;
}

function SpaBookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialServiceId = searchParams.get('serviceId');

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Loaded database records
  const [services, setServices] = useState<SpaServiceType[]>([]);
  const [addresses, setAddresses] = useState<AddressSpaType[]>([]);
  const [pets, setPets] = useState<PetType[]>([]);
  const [staffs, setStaffs] = useState<SpaStaffType[]>([]);

  // Selected Booking form state
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedAddressSpaId, setSelectedAddressSpaId] = useState<string>('');
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState<string>('');
  const [bookingNote, setBookingNote] = useState<string>('');

  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  const carouselDays = useMemo(() => {
    if (!bookingDate) return [];
    const base = new Date(bookingDate);
    if (isNaN(base.getTime())) return [];
    
    // Find the Monday of the week containing baseDate
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(base.setDate(diff));
    
    const days = [];
    const weekdays = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const weekdayStr = weekdays[d.getDay()];
      const dayNum = d.getDate();
      days.push({ dateStr, weekdayStr, dayNum });
    }
    return days;
  }, [bookingDate]);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedAddressSpaId || !bookingDate || !selectedServiceId) return;
      setLoadingSlots(true);
      try {
        const s = services.find(x => x.id === selectedServiceId);
        const duration = s?.durationMin || 30;
        const res = await spaApi.getAvailability(selectedAddressSpaId, bookingDate, duration);
        setAvailableSlots(res.data || []);
      } catch (err) {
        console.error('Failed to fetch available slots', err);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [bookingDate, selectedAddressSpaId, selectedServiceId, services]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [servicesRes, addressesRes, staffsRes] = await Promise.all([
          spaApi.getServices(),
          spaApi.getSpaAddresses(),
          spaApi.getStaffList(),
        ]);

        setServices(servicesRes.data || []);
        setAddresses(addressesRes.data || []);
        setStaffs(staffsRes.data || []);

        // Pre-select service if passed in query string
        if (initialServiceId) {
          setSelectedServiceId(initialServiceId);
          const s = servicesRes.data.find(x => x.id === initialServiceId);
          if (s) {
            setSelectedBranchId(s.branchId);
          }
        } else if (servicesRes.data.length > 0) {
          setSelectedServiceId(servicesRes.data[0].id);
          setSelectedBranchId(servicesRes.data[0].branchId);
        }

        // Pre-select first address if available
        if (addressesRes.data.length > 0) {
          setSelectedAddressSpaId(addressesRes.data[0].id);
        }

        // Pre-select first staff if available
        if (staffsRes.data.length > 0) {
          setSelectedStaffId(staffsRes.data[0].id);
        }

        // Fetch user's pets
        try {
          const petsRes = await api.get('/pets/my');
          const myPets = petsRes.data || [];
          setPets(myPets);
          if (myPets.length > 0) {
            setSelectedPetId(myPets[0].id);
          }
        } catch {
          // If not logged in or failed, leave empty
        }

        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setBookingDate(tomorrow.toISOString().split('T')[0]);

      } catch (error) {
        toast.error('Không thể tải thông tin Spa. Vui lòng tải lại trang.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initialServiceId]);

  // Update selected branch when service changes to ensure consistency
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const s = services.find(x => x.id === serviceId);
    if (s) {
      setSelectedBranchId(s.branchId);
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!selectedServiceId) {
        toast.error('Vui lòng chọn dịch vụ.');
        return;
      }
      if (!selectedAddressSpaId) {
        toast.error('Vui lòng chọn địa chỉ.');
        return;
      }
      if (pets.length > 0 && !selectedPetId) {
        toast.error('Vui lòng chọn thú cưng.');
        return;
      }
      if (pets.length === 0) {
        toast.error('Bạn cần tạo hồ sơ thú cưng trước khi đặt lịch.');
        return;
      }
    } else if (step === 2) {
      if (!bookingDate) {
        toast.error('Vui lòng chọn ngày hẹn.');
        return;
      }
      if (!bookingTime) {
        toast.error('Vui lòng chọn giờ hẹn.');
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handlePrevStep = () => {
    setStep((s) => s - 1);
  };

  const handleSubmitBooking = async () => {
    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${bookingDate}T${bookingTime}:00`).toISOString();
      const pet = pets.find(p => p.id === selectedPetId);

      await spaApi.createBooking({
        branchId: selectedBranchId,
        addressSpaId: selectedAddressSpaId,
        serviceId: selectedServiceId,
        petId: selectedPetId,
        petName: pet ? pet.name : 'Thú cưng',
        staffId: undefined,
        scheduledAt,
        note: bookingNote
      });

      toast.success('Đặt lịch hẹn Spa thành công!');
      router.push('/spa/bookings');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi đặt lịch. Vui lòng thử lại.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedAddress = addresses.find(a => a.id === selectedAddressSpaId);
  const selectedPet = pets.find(p => p.id === selectedPetId);
  const selectedStaff = staffs.find(st => st.id === selectedStaffId);

  const formatPrice = (price?: number) => {
    return price ? `${price.toLocaleString('vi-VN')}đ` : '0đ';
  };

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-16">
      <AppHeader sectionLabel="Spa" />

      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">

        {/* Navigation back link */}
        <div className="flex items-center">
          <Link
            href="/spa"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <ChevronLeft className="size-4" /> Quay lại Spa
          </Link>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-gray-800">Đặt lịch Spa</h1>
        </div>

        {/* 3-Step Wizard Navigation Indicator */}
        <div className="flex items-center justify-center max-w-md mx-auto relative pt-4">
          <div className="absolute h-0.5 bg-gray-200 left-10 right-10 top-[2.2rem] z-0" />

          {/* Step 1 */}
          <div className="flex flex-col items-center gap-2 z-10 w-1/3">
            <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 1 ? 'bg-primary text-white scale-110 shadow-sm' : 'bg-gray-200 text-gray-500'
              }`}>
              1
            </div>
            <span className={`text-[10px] font-bold ${step === 1 ? 'text-primary' : 'text-gray-400'}`}>Dịch vụ & Chi nhánh</span>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center gap-2 z-10 w-1/3">
            <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 2 ? 'bg-primary text-white scale-110 shadow-sm' : 'bg-gray-200 text-gray-500'
              }`}>
              2
            </div>
            <span className={`text-[10px] font-bold ${step === 2 ? 'text-primary' : 'text-gray-400'}`}>Chọn lịch</span>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center gap-2 z-10 w-1/3">
            <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 3 ? 'bg-primary text-white scale-110 shadow-sm' : 'bg-gray-200 text-gray-500'
              }`}>
              3
            </div>
            <span className={`text-[10px] font-bold ${step === 3 ? 'text-primary' : 'text-gray-400'}`}>Xác nhận</span>
          </div>
        </div>

        {/* Wizard Main Container Card */}
        <div className="bg-white border border-[var(--border-color)] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">

          {loading ? (
            <div className="text-center py-20 text-muted-foreground">
              <div className="inline-block size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 font-semibold text-sm">Đang tải thông tin đặt lịch...</p>
            </div>
          ) : (
            <>
              {/* STEP 1: SERVICE & BRANCH & PET */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Select Service */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-gray-800 tracking-wider">Chọn dịch vụ *</label>
                    <div className="border rounded-xl divide-y overflow-hidden max-h-72 overflow-y-auto bg-gray-50/50">
                      {services.map((service) => (
                        <div
                          key={service.id}
                          onClick={() => handleServiceChange(service.id)}
                          className={`flex items-center justify-between p-4 cursor-pointer hover:bg-purple-50/30 transition-all ${selectedServiceId === service.id ? 'bg-primary/5 border-l-4 border-primary' : ''
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="service"
                              checked={selectedServiceId === service.id}
                              onChange={() => handleServiceChange(service.id)}
                              className="accent-primary size-4"
                            />
                            <div>
                              <p className="font-bold text-sm text-gray-900 leading-snug">{service.name}</p>
                              <span className="text-[11px] text-gray-400 font-medium">⏱ {service.durationMin} phút</span>
                            </div>
                          </div>
                          <span className="font-black text-sm text-primary">{formatPrice(service.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Select Address */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-gray-800 tracking-wider">Chọn địa chỉ *</label>
                    <div className="grid grid-cols-1 gap-3">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddressSpaId(addr.id)}
                          className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-all ${selectedAddressSpaId === addr.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-gray-200 bg-white'
                            }`}
                        >
                          <input
                            type="radio"
                            name="addressSpa"
                            checked={selectedAddressSpaId === addr.id}
                            onChange={() => setSelectedAddressSpaId(addr.id)}
                            className="accent-primary size-4 mt-0.5"
                          />
                          <div className="space-y-1">
                            <p className="font-bold text-sm text-gray-900 leading-snug flex items-center gap-1.5">
                              <MapPin className="size-4 text-primary shrink-0" />
                              {addr.address}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Select Pet */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-gray-800 tracking-wider">Thú cưng *</label>
                    {pets.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {pets.map((pet) => (
                          <div
                            key={pet.id}
                            onClick={() => setSelectedPetId(pet.id)}
                            className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-all ${selectedPetId === pet.id
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-gray-200 bg-white'
                              }`}
                          >
                            <input
                              type="radio"
                              name="pet"
                              checked={selectedPetId === pet.id}
                              onChange={() => setSelectedPetId(pet.id)}
                              className="accent-primary size-4"
                            />
                            {pet.avatarUrl ? (
                              <img
                                src={pet.avatarUrl}
                                alt={pet.name}
                                className="size-10 rounded-full object-cover border"
                              />
                            ) : (
                              <div className="size-10 rounded-full bg-purple-50 flex items-center justify-center border font-bold text-sm text-purple-700">
                                {pet.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-extrabold text-sm text-gray-900 leading-none">{pet.name}</p>
                              <span className="text-[10px] text-gray-400 font-bold">{pet.breed}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Fallback: Create pet profile */
                      <Link
                        href="/my-pets/new"
                        className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-red-300 rounded-xl hover:border-red-500 hover:bg-red-50/50 transition-all group"
                      >
                        <Plus className="size-6 text-red-500 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-extrabold text-sm text-red-600">+ Tạo hồ sơ thú cưng</span>
                        <span className="text-[10px] text-gray-400 mt-1">Bạn cần tạo hồ sơ cho bé trước khi tiến hành đặt dịch vụ.</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: CHOOSE DATE & AVAILABLE SLOTS */}
              {step === 2 && (
                <div className="space-y-6">
                  {/* Select Date Horizontal List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-gray-800 tracking-wider">Chọn ngày *</label>
                      <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                        <Calendar className="size-4 shrink-0" />
                        <span>Chọn ngày khác:</span>
                        <input
                          type="date"
                          min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} // min tomorrow
                          value={bookingDate}
                          onChange={(e) => {
                            if (e.target.value) {
                              setBookingDate(e.target.value);
                              setBookingTime('');
                            }
                          }}
                          className="border border-gray-300 rounded-lg px-2.5 py-1 bg-white text-xs text-gray-850 font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-8"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                      {carouselDays.map((day) => {
                        const active = bookingDate === day.dateStr;
                        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                        const isPast = day.dateStr < tomorrowStr;

                        return (
                          <button
                            key={day.dateStr}
                            type="button"
                            disabled={isPast}
                            onClick={() => {
                              setBookingDate(day.dateStr);
                              setBookingTime('');
                            }}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border min-w-[76px] transition-all cursor-pointer ${
                              isPast
                                ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-50'
                                : active
                                ? 'bg-primary border-primary text-white shadow-md font-bold scale-105'
                                : 'bg-white border-gray-255 text-gray-700 hover:border-primary/50'
                            }`}
                          >
                            <span className="text-[10px] uppercase font-bold tracking-wider">{day.weekdayStr}</span>
                            <span className="text-lg font-black mt-0.5">{day.dayNum}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Select Time Grid */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-gray-800 tracking-wider">
                      Chọn giờ ({new Date(bookingDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}) *
                    </label>
                    {loadingSlots ? (
                      <div className="text-center py-10">
                        <div className="inline-block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-xs text-gray-400 font-semibold mt-2">Đang tìm các khung giờ trống...</p>
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {availableSlots.map((slot) => {
                          const isSelected = bookingTime === slot.time;
                          const hasChuyen = slot.isAvailable;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!hasChuyen}
                              onClick={() => setBookingTime(slot.time)}
                              className={`py-3.5 px-3 border rounded-xl text-center transition flex flex-col items-center justify-center cursor-pointer ${
                                !hasChuyen
                                  ? 'bg-gray-50 border-gray-150 text-gray-300 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-primary border-primary text-white shadow-md font-bold'
                                  : 'bg-white border-gray-250 text-gray-700 hover:border-primary'
                              }`}
                            >
                              <span className="text-sm font-black">{slot.time}</span>
                              {hasChuyen ? (
                                <span className={`text-[9px] mt-0.5 font-semibold ${isSelected ? 'text-white/80' : 'text-gray-450'}`}>
                                  {slot.remainingSlots} chỗ
                                </span>
                              ) : (
                                <span className="text-[9px] mt-0.5 font-semibold text-gray-300">Hết chỗ</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-450 italic">Vui lòng chọn ngày để xem danh sách giờ.</p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: CONFIRMATION & NOTES */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider">Tóm tắt lịch đặt</h3>
                    <div className="rounded-xl border bg-gray-50 p-5 text-sm space-y-3">
                      <div className="flex justify-between pb-2 border-b border-dashed">
                        <span className="text-gray-400">Dịch vụ:</span>
                        <span className="font-bold text-gray-800">{selectedService?.name}</span>
                      </div>
                      <div className="flex justify-between pb-2 border-b border-dashed">
                        <span className="text-gray-400">Địa chỉ:</span>
                        <span className="font-bold text-gray-800">{selectedAddress?.address}</span>
                      </div>
                      <div className="flex justify-between pb-2 border-b border-dashed">
                        <span className="text-gray-400">Thú cưng:</span>
                        <span className="font-bold text-gray-800">{selectedPet?.name} ({selectedPet?.breed})</span>
                      </div>
                       <div className="flex justify-between pb-2 border-b border-dashed">
                        <span className="text-gray-400">Nhân viên:</span>
                        <span className="font-bold text-gray-650">
                          Hệ thống tự động phân công
                        </span>
                      </div>
                      <div className="flex justify-between pb-2 border-b border-dashed">
                        <span className="text-gray-400">Thời gian hẹn:</span>
                        <span className="font-bold text-gray-800">{bookingTime} - {bookingDate}</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="text-gray-950 font-bold">Chi phí thanh toán:</span>
                        <span className="text-base font-black text-primary">{formatPrice(selectedService?.price)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Note input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="booking-note" className="text-xs font-black uppercase text-gray-800 tracking-wider">Ghi chú của bạn (tùy chọn)</Label>
                    <Textarea
                      id="booking-note"
                      placeholder="Nhập yêu cầu đặc biệt (ví dụ: bé nhát sấy, cạo lông chân ngắn...)"
                      value={bookingNote}
                      onChange={(e) => setBookingNote(e.target.value)}
                      className="min-h-[100px] bg-white border-gray-300"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                {step > 1 ? (
                  <Button
                    onClick={handlePrevStep}
                    variant="outline"
                    className="border-gray-300 font-bold text-xs"
                    disabled={submitting}
                  >
                    Quay lại
                  </Button>
                ) : (
                  <div />
                )}

                {step < 3 ? (
                  <Button
                    onClick={handleNextStep}
                    className="bg-primary hover:bg-primary/95 text-white font-extrabold text-xs px-6 h-10 shadow-sm"
                  >
                    Tiếp tục <ChevronRight className="size-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmitBooking}
                    disabled={submitting}
                    className="bg-[#6D28D9] hover:bg-[#5b21b6] text-white font-black text-xs px-8 h-10 shadow-md"
                  >
                    {submitting ? 'Đang gửi...' : 'Xác nhận đặt lịch'}
                  </Button>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </main>
  );
}

export default function SpaBookingWizardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)]">
        <div className="text-center space-y-4">
          <div className="inline-block size-10 animate-spin rounded-full border-4 border-[#6D28D9] border-t-transparent" />
          <p className="font-semibold text-sm text-gray-500">Đang tải biểu mẫu đặt lịch...</p>
        </div>
      </div>
    }>
      <SpaBookingWizard />
    </Suspense>
  );
}
