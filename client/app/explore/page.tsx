'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid,
  Heart,
  Inbox,
  Info,
  Layers,
  Maximize2,
  PawPrint,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import AppHeader from '@/components/layout/AppHeader';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PetStatus } from '@/lib/api/pets';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CompatibilityBreakdown } from '@/components/matching/compatibility-breakdown';
import {
  PetPublicProfileDialog,
  type PetWithOwner,
} from '@/components/pets/PetPublicProfileDialog';
import { ImageLightbox } from '@/components/ui/image-lightbox';


// =============================================================
// Types
// =============================================================

type Pet = {
  id: string;
  name: string;
  species: 'DOG' | 'CAT';
  breed: string;
  gender: 'MALE' | 'FEMALE';
  birthday: string;
  weight: number;
  location: string;
  district?: string | null;
  ward?: string | null;
  distanceKm?: number;
  avatarUrl?: string | null;
  avatar?: string | null;
  gallery: string[];
  personality?: string | null;
  hasPedigree: boolean;
  isVaccinated: boolean;
  pedigreeNumber?: string | null;
  pedigreeVerified: boolean;
  vaccineVerified: boolean;
  verificationBadge: 'NONE' | 'PENDING' | 'VERIFIED';
  status: PetStatus;
  breedingOption?: 'CASH' | 'SHARE_LITTER' | 'NEGOTIATE';
  breedingFee?: number | null;
  shareLitterCount?: number | null;
  compatibilityScore?: number;
  matchReasons?: string[];
  breedWarnings?: string[];
  breedInfo?: {
    offspringName: string | null;
    warningNote: string | null;
    isCompatible: boolean;
  };
  crossBreeding?: {
    offspringName: string | null;
    warningNote: string | null;
    isCompatible: boolean;
  };
  ownerName?: string;
  ownerAvatar?: string | null;
};

type MatchingRequest = {
  id: string;
  note?: string | null;
  createdAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  femalePet: PetWithOwner;
  malePet: PetWithOwner;
};

type FilterState = {
  species: 'ALL' | 'DOG' | 'CAT';
  breed: string;
  ageMin: number;
  ageMax: number;
  distanceRadius: number;
  coatColor: string;
  purebredOnly: boolean;
  vaccinatedOnly: boolean;
  verifiedOnly: boolean;
  pedigreeOnly: boolean;
  sortBy: 'RECOMMENDED' | 'NEARBY' | 'NEWEST';
};

const initialFilters: FilterState = {
  species: 'ALL',
  breed: 'ALL',
  ageMin: 1,
  ageMax: 5,
  distanceRadius: 0,
  coatColor: 'ALL',
  purebredOnly: false,
  vaccinatedOnly: false,
  verifiedOnly: false,
  pedigreeOnly: false,
  sortBy: 'RECOMMENDED',
};

// =============================================================
// Main Unified Matching Hub Page
// =============================================================

export default function UnifiedMatchingHubPage() {
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'REQUESTS'>('EXPLORE');
  const [viewMode, setViewMode] = useState<'SWIPE' | 'GRID'>('SWIPE');

  // User & Pet States
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [loadingPets, setLoadingPets] = useState(true);

  // Candidates & Matching State
  const [candidates, setCandidates] = useState<Pet[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);

  // Requests Data
  const [incomingRequests, setIncomingRequests] = useState<MatchingRequest[]>([]);
  const [requestsTab, setRequestsTab] = useState<'INCOMING' | 'OUTGOING'>('INCOMING');

  // Filter Drawer & Modals State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<Pet | null>(null);
  const [candidateImageIndex, setCandidateImageIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [autoExpandCompatibility, setAutoExpandCompatibility] = useState(false);
  const [requestingPet, setRequestingPet] = useState<Pet | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [viewingPetProfile, setViewingPetProfile] = useState<{
    pet: PetWithOwner;
    requestNote?: string | null;
    requestId?: string;
    matchingLocked?: boolean;
  } | null>(null);

  // Extract all distinct images for selected candidate
  const candidateImages = useMemo(() => {
    if (!selectedCandidateDetail) return [];
    const list = [
      selectedCandidateDetail.avatarUrl,
      selectedCandidateDetail.avatar,
      ...(selectedCandidateDetail.gallery || []),
    ].filter((url): url is string => Boolean(url && typeof url === 'string' && url.trim()));
    return Array.from(new Set(list));
  }, [selectedCandidateDetail]);


  // Derived selected pet & Breeding Eligibility
  const selectedPet = useMemo(() => myPets.find((p) => p.id === selectedPetId), [myPets, selectedPetId]);
  const isSelectedFemale = selectedPet?.gender === 'FEMALE';
  const isSelectedMale = selectedPet?.gender === 'MALE';

  const getPetAgeMonths = (birthdayStr?: string) => {
    if (!birthdayStr) return 0;
    const birthday = new Date(birthdayStr);
    const now = new Date();
    let months = (now.getFullYear() - birthday.getFullYear()) * 12 + now.getMonth() - birthday.getMonth();
    if (now.getDate() < birthday.getDate()) months -= 1;
    return Math.max(0, months);
  };

  const isSelectedPetUnderage = useMemo(() => {
    if (!selectedPet) return false;
    const minMonths = selectedPet.species === 'CAT' ? 8 : 12;
    return getPetAgeMonths(selectedPet.birthday) < minMonths;
  }, [selectedPet]);

  const selectedPetEligibleDate = useMemo(() => {
    if (!selectedPet) return '';
    const minMonths = selectedPet.species === 'CAT' ? 8 : 12;
    const birthday = new Date(selectedPet.birthday);
    const eligibleDate = new Date(birthday);
    eligibleDate.setMonth(eligibleDate.getMonth() + minMonths);
    return eligibleDate.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
  }, [selectedPet]);

  // Load My Pets & Prefetch initial candidates
  useEffect(() => {
    api
      .get<Pet[]>('/pets/my')
      .then(async (res) => {
        const pets = (res.data || []).filter((pet) => pet.status === 'ACTIVE');
        setMyPets(pets);
        if (pets.length > 0) {
          const firstPet = pets[0];
          setSelectedPetId(firstPet.id);
          if (firstPet.gender === 'FEMALE') {
            setLoadingCandidates(true);
            try {
              const candRes = await api.get<{ data: Pet[] }>('/matching/candidates', {
                params: { femalePetId: firstPet.id },
              });
              setCandidates(candRes.data?.data || []);
            } catch {
              // silent catch
            } finally {
              setLoadingCandidates(false);
            }
          }
        }
      })
      .catch(() => toast.error('Không tải được danh sách thú cưng.'))
      .finally(() => setLoadingPets(false));
  }, []);

  // Load Candidates for female pet
  const handleSelectPet = useCallback(
    async (targetPet: Pet) => {
      setSelectedPetId(targetPet.id);
      if (targetPet.gender === 'FEMALE') {
        setLoadingCandidates(true);
        try {
          const candRes = await api.get<{ data: Pet[] }>('/matching/candidates', {
            params: {
              femalePetId: targetPet.id,
              species: filters.species !== 'ALL' ? filters.species : undefined,
              breed: filters.breed !== 'ALL' ? filters.breed : undefined,
              purebredOnly: filters.purebredOnly || undefined,
              vaccinatedOnly: filters.vaccinatedOnly || undefined,
              verifiedOnly: filters.verifiedOnly || undefined,
              maxDistanceKm: filters.distanceRadius > 0 ? String(filters.distanceRadius) : undefined,
            },
          });
          setCandidates(candRes.data?.data || []);
          setCurrentCandidateIndex(0);
        } catch {
          toast.error('Không tải được danh sách ứng viên đề xuất.');
        } finally {
          setLoadingCandidates(false);
        }
      } else {
        setCandidates([]);
      }
    },
    [filters],
  );

  const loadIncomingRequests = useCallback(() => {
    api.get<MatchingRequest[]>('/matching/requests/incoming')
      .then((res) => setIncomingRequests(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadIncomingRequests();
  }, [loadIncomingRequests]);

  // Actions
  const handlePass = useCallback(async (candidateId: string) => {
    if (!selectedPetId) return;
    try {
      await api.post('/matching/pass', { femalePetId: selectedPetId, malePetId: candidateId });
      setCandidates((curr) => curr.filter((p) => p.id !== candidateId));
      if (selectedCandidateDetail?.id === candidateId) setSelectedCandidateDetail(null);
      toast.success('Đã ẩn hồ sơ này.');
    } catch {
      toast.error('Không thể bỏ qua.');
    }
  }, [selectedPetId, selectedCandidateDetail]);

  const handleSendRequestSubmit = async () => {
    if (!selectedPetId || !requestingPet) return;
    if (isSelectedPetUnderage) {
      toast.error(`Bé ${selectedPet?.name} chưa đủ tuổi phối giống (cần tối thiểu ${selectedPet?.species === 'CAT' ? 8 : 12} tháng tuổi). Dự kiến mở vào Tháng ${selectedPetEligibleDate}.`);
      return;
    }
    setSendingRequest(true);
    try {
      await api.post('/matching/requests', {
        femalePetId: selectedPetId,
        malePetId: requestingPet.id,
        note: requestNote.trim() || undefined,
      });
      setCandidates((curr) => curr.filter((p) => p.id !== requestingPet.id));
      if (selectedCandidateDetail?.id === requestingPet.id) setSelectedCandidateDetail(null);
      setRequestingPet(null);
      setRequestNote('');
      toast.success(`Đã gửi lời mời ghép đôi tới ${requestingPet.name}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể gửi yêu cầu.');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRespondRequest = async (id: string, action: 'accept' | 'reject') => {
    try {
      await api.post(`/matching/requests/${id}/${action}`);
      if (action === 'accept') {
        toast.success('🎉 Đã chấp nhận yêu cầu và tạo Match thành công!');
      } else {
        toast.success('Đã từ chối yêu cầu.');
      }
      loadIncomingRequests();
    } catch {
      toast.error('Không thể xử lý yêu cầu.');
    }
  };

  const getAge = (birthday: string) => {
    const diff = Date.now() - new Date(birthday).getTime();
    const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
    if (months < 12) return `${months} tháng`;
    const years = Math.floor(months / 12);
    return `${years} tuổi`;
  };

  const currentSwipeCandidate = candidates[currentCandidateIndex];

  if (loadingPets) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col">
        <AppHeader sectionLabel="Ghép đôi Thú cưng" />
        <section className="border-b bg-gradient-to-br from-primary/10 via-background to-orange-50/50 shadow-sm">
          <div className="container mx-auto px-4 py-6 space-y-4">
            <div className="h-8 w-64 bg-muted animate-pulse rounded-xl" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded-lg" />
            <div className="flex gap-3 pt-4 border-t">
              <div className="h-10 w-32 bg-muted animate-pulse rounded-2xl" />
              <div className="h-10 w-32 bg-muted animate-pulse rounded-2xl" />
            </div>
          </div>
        </section>
        <section className="container mx-auto flex-1 px-4 py-16 flex flex-col items-center justify-center space-y-4">
          <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">
            Đang tải dữ liệu thú cưng...
          </p>
        </section>
      </main>
    );
  }

  if (myPets.length === 0) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col">
        <AppHeader sectionLabel="Ghép đôi Thú cưng" />
        <section className="container mx-auto flex-1 px-4 py-16 flex justify-center items-center">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PawPrint className="size-10" />
            </div>
            <h2 className="text-2xl font-black">Bạn chưa có hồ sơ thú cưng nào</h2>
            <p className="text-sm text-muted-foreground">
              Vui lòng tạo hồ sơ thú cưng của bạn để bắt đầu sử dụng tính năng ghép đôi thông minh.
            </p>
            <Button asChild className="rounded-xl font-bold shadow-md shadow-primary/20">
              <Link href="/my-pets/new">Tạo bé mới ngay</Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <AppHeader sectionLabel="Ghép đôi Thú cưng" />

      {/* ================= HERO & SMART CONTEXT SELECTOR BAR ================= */}
      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-orange-50/50 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Context Title */}
            <div>
              <h1 className="text-2xl md:text-3xl font-black">
                {isSelectedFemale ? (
                  <>Tìm bạn đời cho bé <span className="text-primary">{selectedPet.name}</span> (♀)</>
                ) : isSelectedMale ? (
                  <>Cấu hình phối giống cho bé <span className="text-blue-600">{selectedPet.name}</span> (♂)</>
                ) : (
                  'Khám phá & Ghép đôi Thú cưng'
                )}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                {isSelectedFemale
                  ? 'Xem danh sách các bé đực phù hợp, lọc theo phả hệ, vị trí và gửi lời mời ghép đôi.'
                  : isSelectedMale
                  ? 'Quản lý trạng thái sẵn sàng phối giống, thiết lập chi phí và duyệt yêu cầu nhận được.'
                  : 'Hãy chọn hồ sơ thú cưng bên dưới để bắt đầu.'}
              </p>
            </div>

            {/* View Mode Toggle (For Exploration) */}
            {activeTab === 'EXPLORE' && isSelectedFemale && (
              <div className="flex items-center gap-2 bg-card border rounded-2xl p-1 shadow-sm shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('SWIPE')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer',
                    viewMode === 'SWIPE' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Layers className="size-4" /> Thẻ quẹt (Swipe)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('GRID')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer',
                    viewMode === 'GRID' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Grid className="size-4" /> Dạng lưới (Grid)
                </button>
              </div>
            )}
          </div>

          {/* SMART PET SELECTOR */}
          {!loadingPets && myPets.length > 0 && (
            <div
              className="mt-6 pt-4 border-t flex items-center gap-3 overflow-x-auto pb-3"
              style={{
                scrollbarWidth: 'thin',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground shrink-0">
                Chọn thú cưng:
              </span>
              {myPets.map((pet) => {
                const isSelected = selectedPetId === pet.id;
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => handleSelectPet(pet)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2 text-left transition-all shrink-0 cursor-pointer',
                      isSelected
                        ? pet.gender === 'FEMALE'
                          ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20'
                          : 'border-blue-500 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-border bg-card hover:bg-muted/50',
                    )}
                  >
                    <img
                      src={pet.avatarUrl || pet.gallery?.[0] || '/placeholder.svg'}
                      alt={pet.name}
                      className="size-8 rounded-full object-cover border"
                    />
                    <div className="min-w-0 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="font-extrabold truncate max-w-[120px]">{pet.name}</span>
                        <span
                          className={cn(
                            'font-black text-[10px]',
                            pet.gender === 'MALE' ? 'text-blue-600' : 'text-pink-600',
                          )}
                        >
                          {pet.gender === 'MALE' ? '♂' : '♀'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{pet.breed}</p>
                    </div>
                  </button>
                );
              })}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-2xl text-xs font-bold shrink-0 gap-1 text-primary hover:bg-primary/10"
                asChild
              >
                <Link href="/my-pets/new">
                  <PawPrint className="size-3.5" /> + Tạo bé mới
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ================= TAB 1: EXPLORE (DISCOVERY & SWIPE CARD) ================= */}
      {activeTab === 'EXPLORE' && (
        <section className="container mx-auto flex-1 px-4 py-6">
          {/* Male Pet Alert */}
          {isSelectedMale ? (
            <div className="py-16 text-center space-y-4">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                <Info className="size-10" />
              </div>
              <h3 className="text-xl font-extrabold text-blue-900">Tính năng Khám phá dành cho thú cưng cái</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Bạn đang chọn bé đực <span className="font-bold text-foreground">{selectedPet?.name}</span>. Theo quy định, các bé đực sẽ được hiển thị trên hệ thống để bé cái tìm kiếm.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" className="rounded-xl font-bold border-blue-200 text-blue-700 hover:bg-blue-50" asChild>
                  <Link href="/my-pets">Cấu hình ghép đôi</Link>
                </Button>
                <Button className="rounded-xl font-bold bg-blue-600 shadow-md shadow-blue-500/20" onClick={() => setActiveTab('REQUESTS')}>
                  Xem Yêu cầu nhận được
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Underage Notice Banner for Selected Female Pet */}
              {selectedPet && isSelectedPetUnderage && (
                <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900/50 dark:bg-blue-950/30 flex items-start gap-3 shadow-xs">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-bold">
                    🌱
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-extrabold text-blue-900 dark:text-blue-100">
                        Bé {selectedPet.name} đang trong giai đoạn phát triển ({getPetAgeMonths(selectedPet.birthday)} tháng tuổi)
                      </h3>
                      <span className="rounded-full bg-blue-200/80 dark:bg-blue-800 text-blue-900 dark:text-blue-100 px-2.5 py-0.5 text-[11px] font-black">
                        Dự kiến mở ghép đôi: Tháng {selectedPetEligibleDate}
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300/90 leading-relaxed">
                      Theo chuẩn thú y, {selectedPet.species === 'CAT' ? 'mèo' : 'chó'} cần tối thiểu {selectedPet.species === 'CAT' ? 8 : 12} tháng tuổi để đảm bảo an toàn sinh sản. Bạn hiện tại có thể xem trước danh sách các ứng viên phù hợp!
                    </p>
                  </div>
                </div>
              )}

              {/* Quick Filter Bar */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold gap-2 border-2"
                    onClick={() => setIsFilterOpen(true)}
                  >
                    <SlidersHorizontal className="size-4 text-primary" /> Bộ lọc nâng cao
                  </Button>

            </div>

            <p className="text-xs font-bold text-muted-foreground">
              Tìm thấy <span className="text-foreground font-black">{candidates.length}</span> ứng viên phù hợp
            </p>
          </div>

          {/* SWIPE CARD MODE */}
          {viewMode === 'SWIPE' && (
            <div className="mx-auto max-w-md py-4">
              {loadingCandidates ? (
                <CandidateCardSkeleton />
              ) : candidates.length === 0 ? (
                <EmptyState
                  icon={<Search className="size-10" />}
                  title="Không có hồ sơ phù hợp"
                  description="Thử thay đổi bộ lọc hoặc mở rộng bán kính tìm kiếm."
                  actionHref="#"
                  actionLabel="Reset bộ lọc"
                  onActionClick={() => setFilters(initialFilters)}
                />
              ) : currentCandidateIndex >= candidates.length ? (
                <div className="py-16 text-center space-y-4">
                  <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-10" />
                  </div>
                  <h3 className="text-xl font-extrabold">Đã xem hết danh sách đề xuất!</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Bạn đã lướt hết các hồ sơ đực phù hợp hiện tại. Hãy quay lại sau hoặc thử thay đổi tiêu chí bộ lọc.
                  </p>
                  <Button onClick={() => setCurrentCandidateIndex(0)} className="rounded-xl font-bold">
                    Xem lại từ đầu
                  </Button>
                </div>
              ) : (
                <SwipeCardContainer
                  pet={currentSwipeCandidate}
                  femalePet={selectedPet}
                  getAge={getAge}
                  onPass={() => {
                    handlePass(currentSwipeCandidate.id);
                    setCurrentCandidateIndex((prev) => prev + 1);
                  }}
                  onRequestOpen={() => setRequestingPet(currentSwipeCandidate)}
                  onViewDetail={() => {
                    setAutoExpandCompatibility(false);
                    setSelectedCandidateDetail(currentSwipeCandidate);
                  }}
                  onViewScoreDetail={() => {
                    setAutoExpandCompatibility(true);
                    setSelectedCandidateDetail(currentSwipeCandidate);
                  }}
                />
              )}
            </div>
          )}

          {/* GRID MODE */}
          {viewMode === 'GRID' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {candidates.map((pet) => (
                <CandidateCardGrid
                  key={pet.id}
                  pet={pet}
                  femalePet={selectedPet}
                  getAge={getAge}
                  onPass={() => handlePass(pet.id)}
                  onRequestOpen={() => setRequestingPet(pet)}
                  onViewDetail={() => {
                    setAutoExpandCompatibility(false);
                    setSelectedCandidateDetail(pet);
                  }}
                  onViewScoreDetail={() => {
                    setAutoExpandCompatibility(true);
                    setSelectedCandidateDetail(pet);
                  }}
                />
              ))}
            </div>
          )}
            </>
          )}
        </section>
      )}

      {/* ================= TAB 2: REQUESTS (INCOMING & OUTGOING) ================= */}
      {activeTab === 'REQUESTS' && (
        <section className="container mx-auto flex-1 px-4 py-6 space-y-6">
          <div className="flex gap-2 border-b">
            <button
              type="button"
              onClick={() => setRequestsTab('INCOMING')}
              className={cn(
                'px-4 py-2 text-xs font-extrabold border-b-2 transition-all',
                requestsTab === 'INCOMING' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
              )}
            >
              Yêu cầu Nhận được (Pet Đực) ({incomingRequests.length})
            </button>
            <button
              type="button"
              onClick={() => setRequestsTab('OUTGOING')}
              className={cn(
                'px-4 py-2 text-xs font-extrabold border-b-2 transition-all',
                requestsTab === 'OUTGOING' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
              )}
            >
              Yêu cầu Đã gửi (Pet Cái)
            </button>
          </div>

          {requestsTab === 'INCOMING' ? (
            incomingRequests.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-10" />}
                title="Chưa có yêu cầu ghép đôi mới nào"
                description="Khi các thú cưng cái gửi lời mời phối giống cho bé đực của bạn, yêu cầu sẽ xuất hiện tại đây."
                actionHref="/my-pets"
                actionLabel="Cấu hình pet đực ngay"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {incomingRequests.map((req) => {
                  const matchingLocked = req.femalePet.status !== 'ACTIVE' || req.malePet.status !== 'ACTIVE';
                  const femaleImage = req.femalePet.avatarUrl || req.femalePet.gallery?.[0] || '/placeholder.svg';
                  return (
                    <article key={req.id} className="rounded-2xl border bg-card p-5 shadow-sm space-y-4 hover:border-primary/40 transition-all">
                    <div className="flex items-start gap-4">
                      <button
                        type="button"
                        onClick={() => setViewingPetProfile({
                          pet: req.femalePet,
                          requestNote: req.note,
                          requestId: req.id,
                          matchingLocked,
                        })}
                        className="group relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-2xl border bg-muted"
                        title="Bấm để xem chi tiết hồ sơ bé cái"
                      >
                        <img src={femaleImage} alt={req.femalePet.name} className="size-full object-cover transition-transform group-hover:scale-110" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingPetProfile({
                              pet: req.femalePet,
                              requestNote: req.note,
                              requestId: req.id,
                              matchingLocked,
                            })}
                            className="text-left group cursor-pointer truncate"
                          >
                            <h3 className="font-extrabold text-base text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5 truncate">
                              {req.femalePet.name}
                              <span className="text-xs font-bold text-pink-600 shrink-0">(♀)</span>
                            </h3>
                          </button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingPetProfile({
                              pet: req.femalePet,
                              requestNote: req.note,
                              requestId: req.id,
                              matchingLocked,
                            })}
                            className="rounded-xl text-xs font-bold h-8 shrink-0 hover:bg-primary/10 hover:text-primary"
                          >
                            Xem hồ sơ
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">Chủ sở hữu: <span className="text-foreground font-semibold">{req.femalePet.owner?.name}</span></p>
                        <p className="mt-1 text-xs font-bold text-primary truncate">Muốn phối với bé đực: {req.malePet.name}</p>
                      </div>
                    </div>
                    {req.note && <div className="rounded-xl border bg-muted/40 p-3 text-xs italic text-muted-foreground">&ldquo;{req.note}&rdquo;</div>}
                    {matchingLocked && (
                      <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
                        Yêu cầu tạm khóa vì một hồ sơ thú cưng không khả dụng.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="rounded-xl font-bold" onClick={() => handleRespondRequest(req.id, 'reject')}>
                        <X className="mr-1 size-4" /> Từ chối
                      </Button>
                      <Button disabled={matchingLocked} className="rounded-xl font-bold shadow-md shadow-primary/20" onClick={() => handleRespondRequest(req.id, 'accept')}>
                        <Check className="mr-1 size-4" /> Chấp nhận ghép đôi
                      </Button>
                    </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <Button asChild className="rounded-xl font-bold">
                <Link href="/messages">Xem toàn bộ Lịch sử Yêu cầu Đã gửi</Link>
              </Button>
            </div>
          )}
        </section>
      )}

      {/* ================= ADVANCED FILTER DRAWER ================= */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="w-full max-w-md bg-card shadow-2xl flex flex-col h-full">
              <div className="flex items-center justify-between border-b p-4">
                <h3 className="font-extrabold text-base">Bộ lọc Tìm kiếm Nâng cao</h3>
                <Button variant="ghost" size="icon" onClick={() => setIsFilterOpen(false)}><X className="size-5" /></Button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Bán kính khoảng cách: {filters.distanceRadius > 0 ? `${filters.distanceRadius} km` : 'Tất cả (Toàn Hà Nội)'}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={filters.distanceRadius}
                    onChange={(e) => setFilters({ ...filters, distanceRadius: Number(e.target.value) })}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>Gần nhất</span>
                    <span>15 km</span>
                    <span>30 km</span>
                    <span>Toàn Hà Nội</span>
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t">
                  <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                    <span>Chỉ hiển thị Thuần chủng</span>
                    <input type="checkbox" checked={filters.purebredOnly} onChange={(e) => setFilters({ ...filters, purebredOnly: e.target.checked })} className="size-4 accent-primary" />
                  </label>
                  <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                    <span>Chỉ hiển thị đã Tiêm chủng</span>
                    <input type="checkbox" checked={filters.vaccinatedOnly} onChange={(e) => setFilters({ ...filters, vaccinatedOnly: e.target.checked })} className="size-4 accent-primary" />
                  </label>
                  <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                    <span>Chỉ hiển thị Hồ sơ Đã xác thực (Verified)</span>
                    <input type="checkbox" checked={filters.verifiedOnly} onChange={(e) => setFilters({ ...filters, verifiedOnly: e.target.checked })} className="size-4 accent-primary" />
                  </label>
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full rounded-xl font-bold py-6" onClick={() => { setIsFilterOpen(false); if (selectedPet) handleSelectPet(selectedPet); }}>Áp dụng bộ lọc</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= CANDIDATE DETAIL MODAL (FULL PROFILE) ================= */}
      <AnimatePresence>
        {selectedCandidateDetail && (
          <div
            className="fixed inset-0 z-50 flex justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md pt-safe-top overflow-y-auto"
            onClick={() => setSelectedCandidateDetail(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl rounded-[2rem] bg-background shadow-2xl overflow-hidden my-auto border border-border/60 flex flex-col max-h-[92vh]"
            >
              {/* Scrollable Content Container */}
              <div className="overflow-y-auto flex-1 pb-24">
                
                {/* 1. Cover Image Container with Gallery Carousel */}
                <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-muted w-full select-none overflow-hidden group">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={candidateImages[candidateImageIndex] || selectedCandidateDetail.avatarUrl}
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0.6 }}
                      transition={{ duration: 0.2 }}
                      src={
                        candidateImages[candidateImageIndex] ||
                        selectedCandidateDetail.avatarUrl ||
                        selectedCandidateDetail.avatar ||
                        selectedCandidateDetail.gallery?.[0] ||
                        '/placeholder.svg'
                      }
                      alt={`${selectedCandidateDetail.name} - Ảnh ${candidateImageIndex + 1}`}
                      className="size-full object-cover"
                    />
                  </AnimatePresence>
                  
                  {/* Subtle top & bottom shadow gradient for badges */}
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                  {/* Story-style Segment Bars (when > 1 images) */}
                  {candidateImages.length > 1 && (
                    <div className="absolute top-3 left-4 right-16 z-20 flex gap-1.5 pointer-events-auto">
                      {candidateImages.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCandidateImageIndex(idx);
                          }}
                          className="h-1.5 flex-1 rounded-full bg-black/40 overflow-hidden backdrop-blur-xs transition-all hover:h-2 cursor-pointer"
                          title={`Xem ảnh ${idx + 1}`}
                        >
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-300',
                              idx === candidateImageIndex
                                ? 'bg-white shadow-sm'
                                : idx < candidateImageIndex
                                ? 'bg-white/60'
                                : 'bg-transparent',
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Prev / Next Tap Zones */}
                  {candidateImages.length > 1 && (
                    <>
                      <div
                        className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCandidateImageIndex((prev) =>
                            prev > 0 ? prev - 1 : candidateImages.length - 1,
                          );
                        }}
                        title="Ảnh trước"
                      />
                      <div
                        className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCandidateImageIndex((prev) =>
                            prev < candidateImages.length - 1 ? prev + 1 : 0,
                          );
                        }}
                        title="Ảnh tiếp theo"
                      />

                      {/* Glassmorphic Prev Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCandidateImageIndex((prev) =>
                            prev > 0 ? prev - 1 : candidateImages.length - 1,
                          );
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/70 transition-all cursor-pointer hover:scale-105 shadow-xl border border-white/20"
                        aria-label="Ảnh trước"
                      >
                        <ChevronLeft className="size-6" />
                      </button>

                      {/* Glassmorphic Next Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCandidateImageIndex((prev) =>
                            prev < candidateImages.length - 1 ? prev + 1 : 0,
                          );
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/70 transition-all cursor-pointer hover:scale-105 shadow-xl border border-white/20"
                        aria-label="Ảnh tiếp theo"
                      >
                        <ChevronRight className="size-6" />
                      </button>
                    </>
                  )}

                  {/* Top-Right Close Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateDetail(null)}
                    className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/75 transition-colors z-20 cursor-pointer shadow-md border border-white/10"
                    title="Đóng hồ sơ"
                  >
                    <X className="size-5" />
                  </button>

                  {/* Top-Left Badges (Score & Verification) */}
                  <div className="absolute left-4 top-8 md:top-6 flex flex-wrap gap-2 z-10 pointer-events-none">
                    {selectedCandidateDetail.compatibilityScore && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/95 px-3 py-1 text-xs font-black text-white shadow-lg backdrop-blur-md">
                        <Sparkles className="size-3.5" /> {selectedCandidateDetail.compatibilityScore}% Phù hợp
                      </span>
                    )}
                    {selectedCandidateDetail.pedigreeVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-xs font-black text-white shadow-lg backdrop-blur-md">
                        🧬 Phả hệ VKA
                      </span>
                    )}
                    {selectedCandidateDetail.vaccineVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/95 px-2.5 py-1 text-xs font-black text-white shadow-lg backdrop-blur-md">
                        💉 Đã tiêm ngừa
                      </span>
                    )}
                  </div>

                  {/* Bottom-Right Zoom / Lightbox Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const activeUrl =
                        candidateImages[candidateImageIndex] ||
                        selectedCandidateDetail.avatarUrl ||
                        selectedCandidateDetail.avatar;
                      if (activeUrl) setLightboxImage(activeUrl);
                    }}
                    className="absolute right-3.5 bottom-3.5 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md hover:bg-black/80 transition-all shadow-md border border-white/15 cursor-pointer hover:scale-105"
                    title="Bấm để xem ảnh phóng to toàn màn hình"
                  >
                    <Maximize2 className="size-3.5" />
                    <span>{candidateImages.length > 1 ? `Xem lớn (${candidateImageIndex + 1}/${candidateImages.length})` : 'Xem lớn'}</span>
                  </button>
                </div>

                {/* 2. Main Profile Details Section */}
                <div className="px-5 sm:px-7 pt-5 space-y-6">
                  
                  {/* Header Title & Badges Bar */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight">
                          {selectedCandidateDetail.name}
                        </h2>
                        
                        {/* Gender Pill Badge */}
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black border shadow-xs',
                            selectedCandidateDetail.gender === 'MALE'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              : 'bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800',
                          )}
                        >
                          {selectedCandidateDetail.gender === 'MALE' ? '♂ Đực' : '♀ Cái'}
                        </span>

                        {/* Breeding Ready Tag */}
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-xs font-black">
                          ✨ Sẵn sàng phối giống
                        </span>
                      </div>
                    </div>

                    {/* Breed & Location Subtitle */}
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <span className="text-foreground font-bold">{selectedCandidateDetail.breed}</span>
                      <span>·</span>
                      <span>{selectedCandidateDetail.species === 'DOG' ? 'Chó' : 'Mèo'}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-primary">
                        📍 {selectedCandidateDetail.ward || selectedCandidateDetail.location}
                        {selectedCandidateDetail.distanceKm != null && (
                          <span className="text-muted-foreground font-medium">
                            ({selectedCandidateDetail.distanceKm <= 1 ? '< 1 km' : `cách ~${selectedCandidateDetail.distanceKm} km`})
                          </span>
                        )}
                      </span>
                    </div>
                    
                    {/* Owner Info Capsule */}
                    {selectedCandidateDetail.ownerName && (
                      <div className="flex items-center gap-2.5 rounded-2xl border bg-muted/30 p-2 pr-4 w-fit shadow-xs">
                        <img
                          src={selectedCandidateDetail.ownerAvatar || '/placeholder.svg'}
                          alt={selectedCandidateDetail.ownerName}
                          className="size-8 rounded-full border bg-muted object-cover shrink-0"
                        />
                        <div className="text-xs">
                          <span className="text-muted-foreground">Chủ sở hữu: </span>
                          <span className="font-bold text-foreground">{selectedCandidateDetail.ownerName}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Compatibility Breakdown Section (Collapsible Accordion) */}
                  {selectedPet && (
                    <CompatibilityBreakdown
                      key={`${selectedCandidateDetail.id}-${autoExpandCompatibility}`}
                      defaultExpanded={autoExpandCompatibility}
                      myPet={{
                        name: selectedPet.name,
                        breed: selectedPet.breed,
                        gender: selectedPet.gender,
                        weight: selectedPet.weight,
                        location: selectedPet.location,
                        ward: selectedPet.ward,
                        hasPedigree: selectedPet.hasPedigree,
                        pedigreeVerified: selectedPet.pedigreeVerified,
                        isVaccinated: selectedPet.isVaccinated,
                        vaccineVerified: selectedPet.vaccineVerified,
                      }}
                      candidatePet={{
                        name: selectedCandidateDetail.name,
                        breed: selectedCandidateDetail.breed,
                        gender: selectedCandidateDetail.gender,
                        weight: selectedCandidateDetail.weight,
                        location: selectedCandidateDetail.location,
                        ward: selectedCandidateDetail.ward,
                        hasPedigree: selectedCandidateDetail.hasPedigree,
                        pedigreeVerified: selectedCandidateDetail.pedigreeVerified,
                        isVaccinated: selectedCandidateDetail.isVaccinated,
                        vaccineVerified: selectedCandidateDetail.vaccineVerified,
                        distanceKm: selectedCandidateDetail.distanceKm,
                        compatibilityScore: selectedCandidateDetail.compatibilityScore,
                        matchReasons: selectedCandidateDetail.matchReasons,
                        breedWarnings: selectedCandidateDetail.breedWarnings,
                        breedInfo: selectedCandidateDetail.breedInfo,
                      }}
                    />
                  )}

                  {/* 5. 4-Key Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl bg-muted/40 p-3.5 border flex flex-col items-center justify-center text-center space-y-1 shadow-xs">
                      <span className="text-2xl">🎂</span>
                      <span className="text-[11px] text-muted-foreground font-bold uppercase">Tuổi</span>
                      <span className="text-sm font-black">{getAge(selectedCandidateDetail.birthday)}</span>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3.5 border flex flex-col items-center justify-center text-center space-y-1 shadow-xs">
                      <span className="text-2xl">⚖️</span>
                      <span className="text-[11px] text-muted-foreground font-bold uppercase">Cân nặng</span>
                      <span className="text-sm font-black">{selectedCandidateDetail.weight} kg</span>
                    </div>
                    <div className={cn(
                      'rounded-2xl border p-3.5 flex flex-col items-center justify-center text-center space-y-1 shadow-xs',
                      selectedCandidateDetail.pedigreeVerified
                        ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20'
                        : 'border-gray-200 bg-muted/40 dark:border-gray-800',
                    )}>
                      <span className="text-2xl">🧬</span>
                      <span className={cn('text-[11px] font-bold uppercase', selectedCandidateDetail.pedigreeVerified ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>Phả hệ VKA</span>
                      <span className={cn('text-sm font-black', selectedCandidateDetail.pedigreeVerified ? 'text-amber-700 dark:text-amber-300' : 'text-foreground')}>
                        {selectedCandidateDetail.hasPedigree ? (selectedCandidateDetail.pedigreeVerified ? 'Đã xác minh' : 'Chờ xác minh') : 'Chưa có'}
                      </span>
                    </div>
                    <div className={cn(
                      'rounded-2xl border p-3.5 flex flex-col items-center justify-center text-center space-y-1 shadow-xs',
                      selectedCandidateDetail.vaccineVerified
                        ? 'border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20'
                        : 'border-gray-200 bg-muted/40 dark:border-gray-800',
                    )}>
                      <span className="text-2xl">💉</span>
                      <span className={cn('text-[11px] font-bold uppercase', selectedCandidateDetail.vaccineVerified ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground')}>Tiêm chủng</span>
                      <span className={cn('text-sm font-black', selectedCandidateDetail.vaccineVerified ? 'text-blue-700 dark:text-blue-300' : 'text-foreground')}>
                        {selectedCandidateDetail.isVaccinated ? (selectedCandidateDetail.vaccineVerified ? 'Đã xác minh' : 'Chờ xác minh') : 'Chưa có'}
                      </span>
                    </div>
                  </div>

                  {/* 6. Personality & Breeding Requirements */}
                  <div className="space-y-4">
                    {selectedCandidateDetail.breedingOption && (
                      <div className="rounded-2xl border p-4 bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/70 dark:border-orange-900 space-y-2 shadow-xs">
                        <h3 className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 text-orange-700 dark:text-orange-400">
                          💍 Điều kiện phối giống từ chủ nuôi
                        </h3>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-100 dark:bg-orange-900/80 px-3 py-1.5 text-xs font-bold text-orange-800 dark:text-orange-200">
                            {selectedCandidateDetail.breedingOption === 'CASH' ? '💰 Thu phí phối giống' : selectedCandidateDetail.breedingOption === 'SHARE_LITTER' ? '🐾 Thỏa thuận chia đàn con' : '🤝 Thỏa thuận đôi bên'}
                          </span>
                          {selectedCandidateDetail.breedingOption === 'CASH' && selectedCandidateDetail.breedingFee && (
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-100 dark:bg-orange-900/80 px-3 py-1.5 text-xs font-black text-orange-900 dark:text-orange-100">
                              Mức phí: {selectedCandidateDetail.breedingFee.toLocaleString('vi-VN')} VNĐ
                            </span>
                          )}
                          {selectedCandidateDetail.breedingOption === 'SHARE_LITTER' && selectedCandidateDetail.shareLitterCount && (
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-100 dark:bg-orange-900/80 px-3 py-1.5 text-xs font-black text-orange-900 dark:text-orange-100">
                              Chia: {selectedCandidateDetail.shareLitterCount} bé con
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedCandidateDetail.personality && (
                      <div className="rounded-2xl border p-4 bg-card shadow-xs space-y-2">
                        <h3 className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 text-muted-foreground">
                          <Sparkles className="size-3.5 text-primary" /> Tính cách & Đặc điểm
                        </h3>
                        <p className="text-sm text-foreground leading-relaxed font-medium">
                          {selectedCandidateDetail.personality}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="h-4"></div>
                </div>
              </div>
              
              {/* Fixed Bottom Action Bar */}
              <div className="sticky bottom-0 inset-x-0 p-4 bg-background/95 backdrop-blur-lg border-t flex gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] z-30">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-xl font-bold px-6 shrink-0 h-13 text-muted-foreground hover:text-destructive hover:border-destructive"
                  onClick={() => {
                    handlePass(selectedCandidateDetail.id);
                    setSelectedCandidateDetail(null);
                  }}
                >
                  <X className="mr-2 size-5" /> Bỏ qua
                </Button>
                <Button
                  size="lg"
                  className="flex-1 rounded-xl font-black text-base shadow-lg shadow-primary/25 h-13 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => {
                    setRequestingPet(selectedCandidateDetail);
                    setSelectedCandidateDetail(null);
                  }}
                >
                  <Heart className="mr-2 size-5 fill-current" /> Gửi yêu cầu ghép đôi
                </Button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* ================= SEND REQUEST MODAL ================= */}
      <AnimatePresence>
        {requestingPet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base">Gửi lời nhắn cho chủ {requestingPet.name}</h3>
                <Button variant="ghost" size="icon" onClick={() => setRequestingPet(null)}><X className="size-5" /></Button>
              </div>
              <textarea
                rows={3}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="Nhập lời nhắn ngắn..."
                className="w-full rounded-xl border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setRequestingPet(null)}>Hủy</Button>
                <Button className="flex-1 rounded-xl font-bold shadow-md shadow-primary/20" onClick={handleSendRequestSubmit} disabled={sendingRequest}>
                  {sendingRequest ? 'Đang gửi...' : 'Gửi yêu cầu ngay'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {viewingPetProfile && (
        <PetPublicProfileDialog
          pet={viewingPetProfile.pet}
          open={Boolean(viewingPetProfile)}
          onClose={() => setViewingPetProfile(null)}
          requestNote={viewingPetProfile.requestNote}
          requestAction={
            viewingPetProfile.requestId
              ? {
                  onAccept: () => handleRespondRequest(viewingPetProfile.requestId!, 'accept'),
                  onReject: () => handleRespondRequest(viewingPetProfile.requestId!, 'reject'),
                  acceptDisabled: viewingPetProfile.matchingLocked,
                }
              : undefined
          }
        />
      )}

      {/* Lightbox for Fullscreen Image View */}
      <ImageLightbox
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </main>
  );
}

// =============================================================
// SWIPE CARD CONTAINER COMPONENT (STITCH SWIPE MODE)
// =============================================================

function SwipeCardContainer({
  pet,
  femalePet,
  getAge,
  onPass,
  onRequestOpen,
  onViewDetail,
  onViewScoreDetail,
}: {
  pet: Pet;
  femalePet?: Pet;
  getAge: (b: string) => string;
  onPass: () => void;
  onRequestOpen: () => void;
  onViewDetail: () => void;
  onViewScoreDetail?: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const petImages = useMemo(() => {
    const list = [pet.avatarUrl, pet.avatar, ...(pet.gallery || [])].filter(
      (url): url is string => Boolean(url && typeof url === 'string' && url.trim()),
    );
    return Array.from(new Set(list));
  }, [pet]);

  const isDraggingRef = useRef(false);

  // Tính độ chênh lệch cân nặng giữa đực và cái để đánh giá an toàn sinh nở
  const weightDiff = femalePet?.weight ? Number((pet.weight - femalePet.weight).toFixed(1)) : null;

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [pet.id]);

  /**
   * Xử lý kết thúc kéo thẻ: nếu kéo sang phải > 100px thì mở modal gửi yêu cầu,
   * kéo sang trái < -100px thì bỏ qua (pass) ứng viên.
   */
  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      onRequestOpen();
    } else if (info.offset.x < -100) {
      onPass();
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragStart={() => {
        isDraggingRef.current = true;
      }}
      onDragEnd={(_e, info) => {
        handleDragEnd(_e, info);
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 120);
      }}
      className="relative overflow-hidden rounded-3xl border bg-card shadow-2xl cursor-grab active:cursor-grabbing touch-none select-none"
    >
      {/* Aspect 4/5 tall photo - bọc ảnh và xử lý click xem chi tiết chỉ khi không kéo thẻ */}
      <div
        className="relative aspect-[4/5] overflow-hidden bg-muted cursor-pointer group select-none"
        onClick={() => {
          if (!isDraggingRef.current) {
            onViewDetail();
          }
        }}
      >
        <img
          src={petImages[activePhotoIdx] || pet.avatarUrl || pet.avatar || pet.gallery?.[0] || '/placeholder.svg'}
          alt={`${pet.name} - Ảnh ${activePhotoIdx + 1}`}
          className="size-full object-cover transition-all duration-300 pointer-events-none select-none"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Story Progress Bars (when > 1 photos) */}
        {petImages.length > 1 && (
          <div className="absolute top-2.5 left-4 right-4 z-20 flex gap-1.5 pointer-events-auto">
            {petImages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDraggingRef.current) {
                    setActivePhotoIdx(idx);
                  }
                }}
                className="h-1 flex-1 rounded-full bg-black/40 overflow-hidden backdrop-blur-xs transition-all hover:h-1.5"
                title={`Xem ảnh ${idx + 1}`}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    idx === activePhotoIdx
                      ? 'bg-white shadow-sm'
                      : idx < activePhotoIdx
                      ? 'bg-white/60'
                      : 'bg-transparent',
                  )}
                />
              </button>
            ))}
          </div>
        )}

        {/* Tap zones to quickly browse photos on swipe card */}
        {petImages.length > 1 && (
          <>
            <div
              className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (!isDraggingRef.current) {
                  setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : petImages.length - 1));
                }
              }}
              title="Ảnh trước"
            />
            <div
              className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (!isDraggingRef.current) {
                  setActivePhotoIdx((prev) => (prev < petImages.length - 1 ? prev + 1 : 0));
                }
              }}
              title="Ảnh tiếp theo"
            />
          </>
        )}

        {/* Top Badges - Huy hiệu xác minh & Điểm tương thích */}
        <div className="absolute top-5 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
          <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
            {petImages.length > 1 && (
              <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur-md border border-white/10">
                📷 {activePhotoIdx + 1}/{petImages.length}
              </span>
            )}

            {/* Chỉ hiển thị trực tiếp loại giấy tờ đã được duyệt */}
            {pet.pedigreeVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 text-white px-2.5 py-1 text-[11px] font-black backdrop-blur-md shadow border border-amber-400/30">
                🧬 Phả hệ VKA
              </span>
            )}
            {pet.vaccineVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/90 text-white px-2.5 py-1 text-[11px] font-black backdrop-blur-md shadow border border-blue-400/30">
                💉 Đã tiêm ngừa
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onViewScoreDetail) onViewScoreDetail();
              else onViewDetail();
            }}
            className="pointer-events-auto flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3.5 py-1.5 shadow-lg shadow-orange-500/30 border border-white/25 hover:brightness-110 transition-all cursor-pointer group/score hover:scale-105"
            title="Bấm để xem phân tích chi tiết độ phù hợp"
          >
            <Sparkles className="mr-1.5 size-4 text-white fill-white/20 group-hover/score:rotate-12 transition-transform" />
            <span className="text-xs font-black text-white tracking-wide">{pet.compatibilityScore || 95}% Phù hợp</span>
          </button>
        </div>

        {/* Bottom Content Overlay - Thông tin quan trọng cho chủ pet cái */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white space-y-2.5 pointer-events-none z-10">
          <div className="flex items-baseline gap-3">
            <h2 className="text-3xl font-black drop-shadow-md">{pet.name}</h2>
            <span className="text-lg font-bold text-white/90">{getAge(pet.birthday)}</span>
          </div>
          <p className="text-sm font-semibold text-white/90">
            {pet.breed} · {pet.ward || pet.location}
          </p>

          <div className="flex flex-wrap gap-2 pt-1 text-xs font-bold">
            {/* Khoảng cách di chuyển */}
            <span className="rounded-lg bg-teal-500/90 text-white font-extrabold px-2.5 py-1 backdrop-blur-md shadow">
              📍 {pet.distanceKm != null && pet.distanceKm <= 1 ? `Cùng khu vực (${pet.distanceKm} km)` : `Cách ${pet.distanceKm ?? 5} km`}
            </span>

            {/* Cân nặng & chỉ báo mức độ an toàn sinh nở */}
            <span className={cn(
              "rounded-lg px-2.5 py-1 backdrop-blur-md shadow flex items-center gap-1",
              weightDiff != null && Math.abs(weightDiff) <= 2
                ? "bg-emerald-600/90 text-white font-black"
                : weightDiff != null && weightDiff > 5
                ? "bg-rose-600/90 text-white font-black"
                : "bg-black/50 text-white font-bold",
            )}>
              ⚖️ {pet.weight} kg
              {weightDiff != null && (
                <span className="text-[10px] font-extrabold opacity-95">
                  ({Math.abs(weightDiff) <= 1
                    ? 'Cùng cỡ · An toàn'
                    : weightDiff > 0 && weightDiff <= 3
                    ? `+${weightDiff}kg · An toàn`
                    : weightDiff < 0 && weightDiff >= -3
                    ? `${weightDiff}kg · An toàn`
                    : weightDiff > 5
                    ? `+${weightDiff}kg · Cần lưu ý`
                    : `${weightDiff > 0 ? '+' : ''}${weightDiff}kg`})
                </span>
              )}
            </span>

            {/* Điều kiện & chi phí phối giống */}
            {pet.breedingOption && (
              <span className="rounded-lg bg-primary/95 px-2.5 py-1 text-white shadow font-black">
                💰{' '}
                {pet.breedingOption === 'CASH'
                  ? pet.breedingFee ? `${pet.breedingFee.toLocaleString('vi-VN')}đ` : 'Phối thu phí'
                  : pet.breedingOption === 'SHARE_LITTER'
                  ? `Chia ${pet.shareLitterCount || 1} con non`
                  : 'Thỏa thuận'}
              </span>
            )}
          </div>
        </div>
      </div>


      {/* Big Action Floating Buttons */}
      <div className="p-4 bg-card flex items-center justify-around gap-4 border-t">
        <button
          type="button"
          onClick={onPass}
          className="flex size-14 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground shadow-lg transition-transform hover:scale-110 hover:border-destructive hover:text-destructive active:scale-95"
        >
          <X className="size-7" />
        </button>

        <Button
          onClick={onViewDetail}
          variant="outline"
          className="rounded-2xl font-extrabold text-xs px-4"
        >
          Chi tiết
        </Button>

        <button
          type="button"
          onClick={onRequestOpen}
          className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-110 active:scale-95"
        >
          <Heart className="size-7 fill-current" />
        </button>
      </div>
    </motion.div>
  );
}

// =============================================================
// CANDIDATE CARD GRID COMPONENT (GRID MODE)
// =============================================================

function CandidateCardGrid({
  pet,
  femalePet,
  getAge,
  onPass,
  onRequestOpen,
  onViewDetail,
  onViewScoreDetail,
}: {
  pet: Pet;
  femalePet?: Pet;
  getAge: (b: string) => string;
  onPass: () => void;
  onRequestOpen: () => void;
  onViewDetail: () => void;
  onViewScoreDetail?: () => void;
}) {
  const weightDiff = femalePet?.weight ? Number((pet.weight - femalePet.weight).toFixed(1)) : null;

  return (
    <article className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted cursor-pointer" onClick={onViewDetail}>
        <img src={pet.avatarUrl || pet.avatar || pet.gallery?.[0] || '/placeholder.svg'} alt={pet.name} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Top Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 pointer-events-none">
          {pet.pedigreeVerified && (
            <span className="rounded-md bg-amber-500/90 text-white px-2 py-0.5 text-[10px] font-black backdrop-blur-md shadow">
              🧬 VKA
            </span>
          )}
          {pet.vaccineVerified && (
            <span className="rounded-md bg-blue-600/90 text-white px-2 py-0.5 text-[10px] font-black backdrop-blur-md shadow">
              💉 Đã tiêm
            </span>
          )}
        </div>

        <div
          className="absolute right-3 top-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl px-2.5 py-1 text-xs font-black shadow-md border border-white/25 hover:scale-105 transition-transform cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if (onViewScoreDetail) onViewScoreDetail();
            else onViewDetail();
          }}
          title="Bấm để xem phân tích chi tiết độ phù hợp"
        >
          ✨ {pet.compatibilityScore || 95}%
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h2 className="text-xl font-black">{pet.name}</h2>
          <p className="text-xs font-medium text-white/80">{pet.breed} · {getAge(pet.birthday)}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="font-semibold text-foreground">📍 {pet.ward || pet.location} ({pet.distanceKm != null && pet.distanceKm <= 1 ? `< 1 km` : `${pet.distanceKm ?? 5} km`})</span>
          <span className={cn(
            "px-2 py-0.5 rounded-md font-bold text-xs",
            weightDiff != null && Math.abs(weightDiff) <= 2
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "text-foreground font-semibold",
          )}>
            ⚖️ {pet.weight} kg {weightDiff != null && `(${weightDiff > 0 ? '+' : ''}${weightDiff}kg)`}
          </span>
        </div>

        {/* Breeding option in Grid */}
        {pet.breedingOption && (
          <div className="text-xs font-bold text-primary flex items-center gap-1.5">
            <span>💰</span>
            <span>
              {pet.breedingOption === 'CASH'
                ? pet.breedingFee ? `Phí: ${pet.breedingFee.toLocaleString('vi-VN')}đ` : 'Phối thu phí'
                : pet.breedingOption === 'SHARE_LITTER'
                ? `Chia đàn: ${pet.shareLitterCount || 1} con non`
                : 'Hình thức: Thỏa thuận đôi bên'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="outline" className="rounded-xl font-bold" onClick={onPass}><X className="mr-1 size-4" /> Bỏ qua</Button>
          <Button className="rounded-xl font-bold shadow-md shadow-primary/20" onClick={onRequestOpen}><Heart className="mr-1 size-4" /> Yêu cầu</Button>
        </div>
      </div>
    </article>
  );
}

function CandidateCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-sm animate-pulse aspect-[4/5] bg-muted" />
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
  onActionClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  onActionClick?: () => void;
}) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <h2 className="mb-2 text-2xl font-bold">{title}</h2>
      <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">{description}</p>
      {onActionClick ? (
        <Button onClick={onActionClick} className="rounded-xl font-bold">{actionLabel}</Button>
      ) : (
        <Button asChild className="rounded-xl font-bold"><Link href={actionHref}>{actionLabel}</Link></Button>
      )}
    </div>
  );
}
