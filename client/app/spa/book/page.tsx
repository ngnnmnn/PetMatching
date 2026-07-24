'use client';

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Plus,
  PawPrint,
  CheckCircle,
  Scissors,
  Sparkles
} from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/axios';
import { spaApi } from '@/lib/api/spa';
import { SpaServiceType, AddressSpaType } from '@/types';

interface PetType {
  id: string;
  name: string;
  breed: string;
  species: 'DOG' | 'CAT';
  weight: number;
  avatarUrl?: string;
}

// Helper to check if an addon sub-service is already included in a selected main package / combo
function isSubServiceIncludedInMain(
  sub: SpaServiceType,
  main?: SpaServiceType,
): boolean {
  if (!main) return false;

  const mainName = (main.name || '').toLowerCase();
  const mainDesc = (main.description || '').toLowerCase();
  const mainText = `${mainName} ${mainDesc}`;

  const subName = (sub.name || '').toLowerCase();
  const subDesc = (sub.description || '').toLowerCase();
  const subText = `${subName} ${subDesc}`;

  // Checks for hygiene package inclusion (Vệ sinh combo: cắt móng, cạo bàn, vệ sinh tai, cạo bụng...)
  const isComboWithHygiene =
    mainText.includes('vệ sinh') ||
    mainText.includes('combo') ||
    mainText.includes('spa cắt tỉa') ||
    mainText.includes('full day');

  const isComboWithStyling =
    mainText.includes('cắt tỉa') ||
    mainText.includes('spa') ||
    mainText.includes('full day');

  const isComboWithShaving =
    mainText.includes('cạo') ||
    mainText.includes('cạo lông') ||
    mainText.includes('full day');

  // Sub-service: Cắt móng, cạo bàn
  if (subText.includes('cắt móng') || subText.includes('cạo bàn')) {
    if (isComboWithHygiene || mainText.includes('cắt móng') || mainText.includes('cạo bàn')) {
      return true;
    }
  }

  // Sub-service: Cạo bụng, hậu môn
  if (subText.includes('cạo bụng') || subText.includes('hậu môn')) {
    if (isComboWithHygiene || isComboWithShaving || mainText.includes('cạo bụng')) {
      return true;
    }
  }

  // Sub-service: Vệ sinh tai
  if (subText.includes('vệ sinh tai') || (subText.includes('tai') && !subText.includes('nấm'))) {
    if (isComboWithHygiene || mainText.includes('vệ sinh tai')) {
      return true;
    }
  }

  // Sub-service: Bấm gọn mắt, miệng
  if (subText.includes('bấm gọn') || (subText.includes('mắt') && subText.includes('miệng'))) {
    if (isComboWithStyling || mainText.includes('bấm gọn')) {
      return true;
    }
  }

  // Generic fallback check: if main text explicitly contains the sub-service name
  if (subName.length > 3 && mainText.includes(subName)) {
    return true;
  }

  return false;
}

function SpaBookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialServiceId = searchParams.get('serviceId');

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Protect booking wizard: redirect to login if not authenticated
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để thực hiện đặt lịch Spa.');
      const currentUrl = window.location.pathname + window.location.search;
      router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
    }
  }, [router]);

  // Loaded database records
  const [mainServices, setMainServices] = useState<SpaServiceType[]>([]);
  const [subServices, setSubServices] = useState<SpaServiceType[]>([]);
  const [addresses, setAddresses] = useState<AddressSpaType[]>([]);
  const [pets, setPets] = useState<PetType[]>([]);

  // Selected Booking form state
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [customSpecies, setCustomSpecies] = useState<'DOG' | 'CAT'>('DOG');
  const [customWeight, setCustomWeight] = useState<number>(3);
  const [selectedMainServiceId, setSelectedMainServiceId] = useState<string>('');
  const [selectedSubServiceIds, setSelectedSubServiceIds] = useState<string[]>([]);

  const [selectedAddressSpaId, setSelectedAddressSpaId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState<string>('');
  const [bookingNote, setBookingNote] = useState<string>('');

  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Active pet object
  const activePet = useMemo(() => {
    return pets.find((p) => p.id === selectedPetId);
  }, [pets, selectedPetId]);

  const activeSpecies = activePet ? activePet.species : customSpecies;
  const activeWeight = activePet ? activePet.weight : customWeight;

  // Load services filtered by pet species & weight
  useEffect(() => {
    const fetchFilteredServices = async () => {
      try {
        const res = await spaApi.getServices(activeSpecies, activeWeight);
        const allSvc = Array.isArray(res.data) ? res.data : [];
        const mains = allSvc.filter((s) => s.isMain);
        const subs = allSvc.filter((s) => !s.isMain);

        setMainServices(mains);
        setSubServices(subs);

        if (initialServiceId && mains.some((m) => m.id === initialServiceId)) {
          setSelectedMainServiceId(initialServiceId);
        }
      } catch (err) {
        console.error('Failed to load filtered services', err);
      }
    };
    fetchFilteredServices();
  }, [activeSpecies, activeWeight, initialServiceId]);

  const carouselDays = useMemo(() => {
    if (!bookingDate) return [];
    const base = new Date(bookingDate);
    if (isNaN(base.getTime())) return [];
    
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
      if (!selectedAddressSpaId || !bookingDate || (!selectedMainServiceId && selectedSubServiceIds.length === 0)) return;
      setLoadingSlots(true);
      try {
        const selectedMain = mainServices.find((x) => x.id === selectedMainServiceId);
        const selectedSubs = subServices.filter((x) => selectedSubServiceIds.includes(x.id));
        const durationMain = selectedMain ? (selectedMain.durationMax || selectedMain.durationMin || 30) : 0;
        const durationSubs = selectedSubs.reduce((sum, s) => sum + (s.durationMax || s.durationMin || 15), 0);
        const totalDuration = durationMain + durationSubs;

        const res = await spaApi.getAvailability(selectedAddressSpaId, bookingDate, totalDuration);
        setAvailableSlots(res.data || []);
      } catch (err) {
        console.error('Failed to fetch available slots', err);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [bookingDate, selectedAddressSpaId, selectedMainServiceId, selectedSubServiceIds, mainServices, subServices]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [addressesRes, petsRes] = await Promise.all([
          spaApi.getSpaAddresses(),
          api.get('/pets/my').catch(() => ({ data: [] })),
        ]);

        setAddresses(addressesRes.data || []);

        if (addressesRes.data.length > 0) {
          setSelectedAddressSpaId(addressesRes.data[0].id);
        }

        const myPets = petsRes.data || [];
        setPets(myPets);
        if (myPets.length > 0) {
          setSelectedPetId(myPets[0].id);
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setBookingDate(tomorrow.toISOString().split('T')[0]);
      } catch {
        toast.error('Không thể tải thông tin Spa. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubServiceToggle = (subId: string) => {
    setSelectedSubServiceIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  };

  const selectedMainService = mainServices.find((s) => s.id === selectedMainServiceId);

  // Available sub-services after filtering out those already included in the selected main service / combo
  const availableSubServices = useMemo(() => {
    if (!selectedMainService) return subServices;
    return subServices.filter((sub) => !isSubServiceIncludedInMain(sub, selectedMainService));
  }, [subServices, selectedMainService]);

  // Automatically deselect hidden sub-services
  useEffect(() => {
    const validSubIds = availableSubServices.map((s) => s.id);
    setSelectedSubServiceIds((prev) => prev.filter((id) => validSubIds.includes(id)));
  }, [availableSubServices]);

  const calculatedTotalPrice = useMemo(() => {
    const mainPrice = selectedMainService ? selectedMainService.price : 0;
    const subPriceTotal = availableSubServices
      .filter((s) => selectedSubServiceIds.includes(s.id))
      .reduce((sum, s) => sum + s.price, 0);
    return mainPrice + subPriceTotal;
  }, [selectedMainService, selectedSubServiceIds, availableSubServices]);

  const handleNextStep = () => {
    if (step === 1) {
      if (!selectedMainServiceId && selectedSubServiceIds.length === 0) {
        toast.error('Vui lòng chọn 1 dịch vụ chính HOẶC ít nhất 1 dịch vụ lẻ.');
        return;
      }
      if (!selectedAddressSpaId) {
        toast.error('Vui lòng chọn địa chỉ Spa.');
        return;
      }
      if (pets.length > 0 && !selectedPetId) {
        toast.error('Vui lòng chọn thú cưng.');
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

      await spaApi.createBooking({
        addressSpaId: selectedAddressSpaId,
        mainServiceId: selectedMainServiceId || undefined,
        subServiceIds: selectedSubServiceIds,
        petId: activePet ? activePet.id : undefined,
        petName: activePet ? activePet.name : 'Thú cưng',
        petSpecies: activeSpecies,
        petWeight: activeWeight,
        scheduledAt,
        note: bookingNote,
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

  const selectedSubServiceList = availableSubServices.filter((s) => selectedSubServiceIds.includes(s.id));
  const selectedAddress = addresses.find((a) => a.id === selectedAddressSpaId);

  const formatPrice = (price?: number) => {
    return price ? `${price.toLocaleString('vi-VN')}đ` : '0đ';
  };

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] pb-16">
      <AppHeader sectionLabel="Spa" />

      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div className="flex items-center">
          <Link
            href="/spa"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <ChevronLeft className="size-4" /> Quay lại Spa
          </Link>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-gray-800">Đặt Lịch Spa Grooming Cutepets</h1>
          <p className="text-xs text-gray-500 font-medium">
            Chọn 1 dịch vụ chính phù hợp với loài & cân nặng, kết hợp thêm các dịch vụ phụ tùy chọn.
          </p>
        </div>

        {/* 3-Step Wizard Progress */}
        <div className="flex items-center justify-center max-w-md mx-auto relative pt-4">
          <div className="absolute h-0.5 bg-gray-200 left-10 right-10 top-[2.2rem] z-0" />

          <div className="flex flex-col items-center gap-2 z-10 w-1/3">
            <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 1 ? 'bg-primary text-white scale-110 shadow-sm' : 'bg-gray-200 text-gray-500'}`}>
              1
            </div>
            <span className={`text-[10px] font-bold ${step === 1 ? 'text-primary' : 'text-gray-400'}`}>Chọn dịch vụ chính & phụ</span>
          </div>

          <div className="flex flex-col items-center gap-2 z-10 w-1/3">
            <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 2 ? 'bg-primary text-white scale-110 shadow-sm' : 'bg-gray-200 text-gray-500'}`}>
              2
            </div>
            <span className={`text-[10px] font-bold ${step === 2 ? 'text-primary' : 'text-gray-400'}`}>Chọn ngày & giờ</span>
          </div>

          <div className="flex flex-col items-center gap-2 z-10 w-1/3">
            <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 3 ? 'bg-primary text-white scale-110 shadow-sm' : 'bg-gray-200 text-gray-500'}`}>
              3
            </div>
            <span className={`text-[10px] font-bold ${step === 3 ? 'text-primary' : 'text-gray-400'}`}>Xác nhận đơn</span>
          </div>
        </div>

        {/* Wizard Card Container */}
        <div className="bg-white border border-[var(--border-color)] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
          {loading ? (
            <div className="text-center py-20 text-muted-foreground">
              <div className="inline-block size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 font-semibold text-sm">Đang tải thông tin dịch vụ Spa Cutepets...</p>
            </div>
          ) : (
            <>
              {/* STEP 1: PET & MAIN/SUB SERVICES */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Select Pet */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
                      <PawPrint className="size-4 text-primary" /> Chọn thú cưng *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {pets.map((pet) => (
                        <div
                          key={pet.id}
                          onClick={() => setSelectedPetId(pet.id)}
                          className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition-all ${
                            selectedPetId === pet.id
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
                              {pet.species === 'CAT' ? '🐱' : '🐶'}
                            </div>
                          )}
                          <div>
                            <p className="font-extrabold text-sm text-gray-900 leading-none">{pet.name}</p>
                            <span className="text-[10px] text-gray-500 font-bold block mt-0.5">
                              {pet.breed} • {pet.species === 'CAT' ? 'Mèo' : 'Chó'} ({pet.weight}kg)
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Card styled like pet selection option with '+' icon inside */}
                      <Link href="/my-pets/new">
                        <div className="flex items-center gap-3 p-3 border border-dashed border-primary/50 rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all h-full min-h-[62px]">
                          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shrink-0">
                            <Plus className="size-5 font-bold" />
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-primary leading-none">Thêm thú cưng</p>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {/* Select Address */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-gray-800 tracking-wider">Chọn chi nhánh Spa *</label>
                    <div className="grid grid-cols-1 gap-3">
                      {addresses.map((addr) => (
                        <div
                          key={addr.id}
                          onClick={() => setSelectedAddressSpaId(addr.id)}
                          className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50 transition-all ${
                            selectedAddressSpaId === addr.id
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
                          <div>
                            <p className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                              <MapPin className="size-4 text-primary shrink-0" />
                              {addr.address}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DYNAMIC CALCULATED PRICE NOTICE BANNER */}
                  <div className="p-4 bg-gradient-to-r from-purple-50 via-amber-50 to-orange-50 border border-purple-200 rounded-2xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                        <Sparkles className="size-4 text-purple-600 animate-pulse" />
                        Giá gói chính tự động tính theo bé {activePet ? `"${activePet.name}"` : 'của bạn'}:
                      </p>
                      <span className="text-xs font-black text-purple-800 bg-white px-2.5 py-1 rounded-full border border-purple-200 shadow-2xs">
                        {activeSpecies === 'CAT' ? '🐱 Mèo' : '🐶 Chó'} • {activeWeight} kg
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                      Dựa trên cân nặng <strong className="text-purple-900 font-black">{activeWeight}kg</strong> của bé, hệ thống đã khớp mốc giá chính xác cho các gói bên dưới:
                    </p>
                  </div>

                  {/* MAIN SERVICE SELECTION (RATING EXACTLY 1 MAIN SERVICE OR OPTIONAL FOR SUB SERVICES ONLY) */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-xs font-black uppercase text-purple-950 tracking-wider flex items-center gap-1.5">
                        <Scissors className="size-4 text-purple-600" />
                        Dịch vụ chính (Tùy chọn gói combo hoặc bỏ chọn để làm dịch vụ lẻ)
                      </label>
                      <div className="flex items-center gap-2">
                        {selectedMainServiceId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMainServiceId('');
                            }}
                            className="text-[11px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-0.5 rounded-full border border-red-200 transition shadow-2xs"
                          >
                            ✕ Bỏ chọn gói chính (Chỉ chọn dịch vụ lẻ)
                          </button>
                        )}
                        <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                          {activeSpecies === 'CAT' ? 'Dành cho Mèo' : 'Dành cho Chó'} • {activeWeight}kg
                        </span>
                      </div>
                    </div>

                    {mainServices.length === 0 ? (
                      <p className="text-xs text-gray-500 italic p-4 bg-gray-50 rounded-xl">
                        Không tìm thấy gói dịch vụ chính phù hợp với cân nặng {activeWeight}kg.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {mainServices.map((service) => {
                          const isSelected = selectedMainServiceId === service.id;
                          return (
                            <div
                              key={service.id}
                              onClick={() => setSelectedMainServiceId(isSelected ? '' : service.id)}
                              className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                                isSelected
                                  ? 'border-purple-600 bg-purple-50/80 ring-2 ring-purple-500/30'
                                  : 'border-gray-200 bg-white hover:border-purple-200'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name="mainService"
                                      checked={isSelected}
                                      onChange={() => setSelectedMainServiceId(service.id)}
                                      className="accent-purple-700 size-4"
                                    />
                                    <span className="font-extrabold text-sm text-gray-900">{service.name}</span>
                                  </div>
                                  {service.description && (
                                    <p className="text-[11px] text-gray-500 line-clamp-2 pl-6">{service.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-purple-100/60 text-xs">
                                <span className="text-gray-400 font-semibold">⏱ {service.durationMin} - {service.durationMax || 40}p</span>
                                <span className="font-black text-purple-800 text-sm">{formatPrice(service.price)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SUB SERVICES SELECTION (CHECKBOXES FOR OPTIONAL ADDONS) */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-xs font-black uppercase text-gray-800 tracking-wider flex items-center gap-1.5">
                        <Plus className="size-4 text-green-600" />
                        Dịch vụ phụ / Dịch vụ lẻ (Chọn thêm hoặc không)
                      </label>
                      {selectedMainService && subServices.length > availableSubServices.length && (
                        <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                          ✨ Đã ẩn các dịch vụ lẻ đã có sẵn trong gói combo đã chọn
                        </span>
                      )}
                    </div>

                    {availableSubServices.length === 0 ? (
                      <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl border border-gray-200">
                        Gói bạn chọn đã bao gồm đầy đủ các dịch vụ chăm sóc cơ bản. Không có dịch vụ lẻ cần chọn thêm.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {availableSubServices.map((sub) => {
                          const isChecked = selectedSubServiceIds.includes(sub.id);
                          return (
                            <div
                              key={sub.id}
                              onClick={() => handleSubServiceToggle(sub.id)}
                              className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                                isChecked
                                  ? 'border-green-500 bg-green-50/60 ring-1 ring-green-400'
                                  : 'border-gray-200 bg-white hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleSubServiceToggle(sub.id)}
                                  className="accent-green-600 size-4 rounded"
                                />
                                <div>
                                  <span className="font-bold text-xs text-gray-900 block leading-tight">{sub.name}</span>
                                  <span className="text-[10px] text-gray-400 font-medium">⏱ {sub.durationMin} phút</span>
                                </div>
                              </div>
                              <span className="font-black text-xs text-green-700">{formatPrice(sub.price)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* PRICE SUMMARY PREVIEW */}
                  <div className="bg-purple-950 text-white rounded-xl p-4 flex items-center justify-between shadow-md">
                    <div>
                      <span className="text-[10px] uppercase text-purple-300 font-extrabold tracking-wider block">TỔNG CHI PHÍ SPA DỰ KIẾN</span>
                      <span className="text-xs text-purple-200">
                        {selectedMainService?.name || 'Chưa chọn gói'} + {selectedSubServiceList.length} dịch vụ lẻ
                      </span>
                    </div>
                    <span className="text-xl font-black text-amber-300">{formatPrice(calculatedTotalPrice)}</span>
                  </div>
                </div>
              )}

              {/* STEP 2: DATE & TIME */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-gray-800 tracking-wider">Chọn ngày đặt lịch *</label>
                      <input
                        type="date"
                        min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
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

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-gray-800 tracking-wider">
                      Chọn giờ hẹn ({new Date(bookingDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}) *
                    </label>
                    {loadingSlots ? (
                      <div className="text-center py-10">
                        <div className="inline-block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-xs text-gray-400 font-semibold mt-2">Đang tìm khung giờ khả dụng...</p>
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
                                  {slot.remainingSlots} nhân viên rảnh
                                </span>
                              ) : (
                                <span className="text-[9px] mt-0.5 font-semibold text-gray-300">Đã kín lịch</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-450 italic">Vui lòng chọn ngày để xem giờ hẹn khả dụng.</p>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: CONFIRMATION */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase text-gray-800 tracking-wider">Tóm tắt đơn đặt lịch Spa</h3>
                    <div className="rounded-xl border bg-gray-50 p-5 text-sm space-y-3">
                      <div className="flex justify-between pb-2 border-b border-dashed">
                        <span className="text-gray-500">Dịch vụ chính:</span>
                        <span className="font-extrabold text-purple-950">{selectedMainService?.name}</span>
                      </div>
                      {selectedSubServiceList.length > 0 && (
                        <div className="flex justify-between pb-2 border-b border-dashed">
                          <span className="text-gray-500">Dịch vụ phụ chọn thêm:</span>
                          <div className="text-right">
                            {selectedSubServiceList.map((sub) => (
                              <span key={sub.id} className="block font-bold text-xs text-green-800">
                                + {sub.name} ({formatPrice(sub.price)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between pb-2 border-b border-dashed">
                        <span className="text-gray-500">Địa chỉ Spa:</span>
                        <span className="font-bold text-gray-800">{selectedAddress?.address}</span>
                      </div>
                      <div className="flex justify-between pb-2 border-b border-dashed">
                        <span className="text-gray-500">Thú cưng:</span>
                        <span className="font-bold text-gray-800">
                          {activePet ? `${activePet.name} (${activePet.breed})` : `Bé (${activeSpecies === 'CAT' ? 'Mèo' : 'Chó'} ${activeWeight}kg)`}
                        </span>
                      </div>
                      <div className="flex justify-between pb-2 border-b border-dashed">
                        <span className="text-gray-500">Thời gian hẹn:</span>
                        <span className="font-bold text-gray-800">{bookingTime} - {bookingDate}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t font-extrabold text-base">
                        <span className="text-gray-900">Tổng tiền thanh toán:</span>
                        <span className="text-xl font-black text-purple-700">{formatPrice(calculatedTotalPrice)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="booking-note" className="text-xs font-black uppercase text-gray-800 tracking-wider">Ghi chú cho cửa hàng (Tùy chọn)</Label>
                    <Textarea
                      id="booking-note"
                      placeholder="Nhập yêu cầu đặc biệt (ví dụ: bé nhát sấy, cạo lông chân ngắn...)"
                      value={bookingNote}
                      onChange={(e) => setBookingNote(e.target.value)}
                      className="min-h-[90px] bg-white border-gray-300"
                    />
                  </div>
                </div>
              )}

              {/* Wizard Action Buttons */}
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
                    {submitting ? 'Đang đặt...' : 'Xác Nhận Đặt Lịch'}
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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)]">
          <div className="text-center space-y-4">
            <div className="inline-block size-10 animate-spin rounded-full border-4 border-[#6D28D9] border-t-transparent" />
            <p className="font-semibold text-sm text-gray-500">Đang tải trang đặt lịch...</p>
          </div>
        </div>
      }
    >
      <SpaBookingWizard />
    </Suspense>
  );
}
