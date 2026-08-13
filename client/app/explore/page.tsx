'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Crown,
  Filter,
  Grid,
  Heart,
  ImageIcon,
  Inbox,
  Info,
  Layers,
  MapPin,
  MessageCircle,
  MessageSquare,
  Paperclip,
  PawPrint,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Syringe,
  ToggleLeft,
  ToggleRight,
  Weight,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import AppHeader from '@/components/layout/AppHeader';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  verificationBadge?: 'NONE' | 'PENDING' | 'VERIFIED';
  isAvailableForMatching: boolean;
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
  ownerName?: string;
  ownerAvatar?: string | null;
};

type MatchingRequest = {
  id: string;
  note?: string | null;
  createdAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  femalePet: {
    id: string;
    name: string;
    breed: string;
    avatarUrl?: string | null;
    verificationBadge?: string;
    owner: { name: string };
  };
  malePet: {
    id: string;
    name: string;
    breed: string;
    avatarUrl?: string | null;
    verificationBadge?: string;
    breedingOption?: string;
    breedingFee?: number | null;
    owner?: { name: string };
  };
};

type Match = {
  id: string;
  compatibilityScore: number;
  createdAt: string;
  pet1: {
    id: string;
    name: string;
    breed: string;
    avatarUrl?: string | null;
    owner: { name: string };
  };
  pet2: {
    id: string;
    name: string;
    breed: string;
    avatarUrl?: string | null;
    owner: { name: string };
  };
};

type MatchMessage = {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl?: string | null };
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
  distanceRadius: 30,
  coatColor: 'ALL',
  purebredOnly: false,
  vaccinatedOnly: false,
  verifiedOnly: false,
  pedigreeOnly: false,
  sortBy: 'RECOMMENDED',
};

const REASON_LABELS: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  same_breed:             { label: 'Cùng giống',           icon: Crown,       color: 'text-amber-600 bg-amber-50 border-amber-200' },
  breed_compatible:       { label: 'Giống tương thích',    icon: Zap,         color: 'text-violet-600 bg-violet-50 border-violet-200' },
  both_pedigree:          { label: 'Cả hai có phả hệ',    icon: Crown,       color: 'text-amber-600 bg-amber-50 border-amber-200' },
  both_pedigree_verified: { label: 'Phả hệ xác minh',  icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  both_vaccine_verified:  { label: 'Vaccine xác minh',  icon: Syringe,     color: 'text-blue-600 bg-blue-50 border-blue-200' },
  same_location:          { label: 'Cùng khu vực',        icon: MapPin,      color: 'text-teal-600 bg-teal-50 border-teal-200' },
  similar_weight:         { label: 'Cân nặng tương đồng', icon: Weight,      color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

// =============================================================
// Main Unified Matching Hub Page
// =============================================================

export default function UnifiedMatchingHubPage() {
  // Navigation Tabs: EXPLORE (Discovery), REQUESTS (Manage Requests), CHAT (Direct Matches & Messages), SETUP (Male Setup)
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'REQUESTS' | 'CHAT' | 'SETUP'>('EXPLORE');
  const [viewMode, setViewMode] = useState<'SWIPE' | 'GRID'>('SWIPE');

  // User & Pet States
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [loadingPets, setLoadingPets] = useState(true);

  // Candidates & Matching State
  const [candidates, setCandidates] = useState<Pet[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);

  // Requests & Matches Data
  const [incomingRequests, setIncomingRequests] = useState<MatchingRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<MatchingRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [requestsTab, setRequestsTab] = useState<'INCOMING' | 'OUTGOING'>('INCOMING');

  // Filter Drawer & Modals State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<Pet | null>(null);
  const [requestingPet, setRequestingPet] = useState<Pet | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Celebration Match Popup
  const [celebrativeMatch, setCelebrativeMatch] = useState<Match | null>(null);

  // Chat Window State
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [inputText, setInputText] = useState('');
  const [chatMessages, setChatMessages] = useState<Record<string, MatchMessage[]>>({});
  const [currentUserId, setCurrentUserId] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Male Pet Setup State
  const [isAvailable, setIsAvailable] = useState(false);
  const [breedingOption, setBreedingOption] = useState<'CASH' | 'SHARE_LITTER' | 'NEGOTIATE'>('NEGOTIATE');
  const [breedingFee, setBreedingFee] = useState('');
  const [shareLitterCount, setShareLitterCount] = useState('1');
  const [personalityNote, setPersonalityNote] = useState('');
  const [savingSetup, setSavingSetup] = useState(false);

  // Derived selected pet
  const selectedPet = useMemo(() => myPets.find((p) => p.id === selectedPetId), [myPets, selectedPetId]);
  const isSelectedFemale = selectedPet?.gender === 'FEMALE';
  const isSelectedMale = selectedPet?.gender === 'MALE';

  // Load My Pets & Prefetch initial candidates
  useEffect(() => {
    setLoadingPets(true);
    api
      .get<Pet[]>('/pets/my')
      .then(async (res) => {
        const pets = res.data || [];
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

  // When selected pet changes, adapt defaults
  useEffect(() => {
    if (!selectedPet) return;
    if (selectedPet.gender === 'MALE') {
      setIsAvailable(selectedPet.isAvailableForMatching);
      setBreedingOption(selectedPet.breedingOption || 'NEGOTIATE');
      setBreedingFee(selectedPet.breedingFee ? String(selectedPet.breedingFee) : '');
      setShareLitterCount(selectedPet.shareLitterCount ? String(selectedPet.shareLitterCount) : '1');
      setPersonalityNote(selectedPet.personality || '');
    }
  }, [selectedPet]);

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

  const fetchCandidates = useCallback(() => {
    if (!selectedPet) return;
    handleSelectPet(selectedPet);
  }, [selectedPet, handleSelectPet]);

  useEffect(() => {
    if (selectedPetId && isSelectedFemale && candidates.length === 0 && !loadingCandidates) {
      fetchCandidates();
    }
  }, [filters]);

  // Load Requests & Matches
  const loadRequestsAndMatches = useCallback(() => {
    Promise.all([
      api.get<MatchingRequest[]>('/matching/requests/incoming'),
      api.get<Match[]>('/matching/matches'),
    ])
      .then(([reqRes, matchRes]) => {
        setIncomingRequests(reqRes.data || []);
        setMatches(matchRes.data || []);
        if (matchRes.data && matchRes.data.length > 0 && !selectedMatch) {
          setSelectedMatch(matchRes.data[0]);
        }
      })
      .catch(() => {});
  }, [selectedMatch]);

  useEffect(() => {
    loadRequestsAndMatches();
  }, [loadRequestsAndMatches]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    try {
      setCurrentUserId((JSON.parse(storedUser) as { id?: string }).id || '');
    } catch {
      setCurrentUserId('');
    }
  }, []);

  useEffect(() => {
    if (!selectedMatch) return;
    const matchId = selectedMatch.id;
    setLoadingMessages(true);
    const loadMessages = (showError = false) => api.get<MatchMessage[]>(`/matching/matches/${matchId}/messages`)
      .then((res) => setChatMessages((prev) => ({ ...prev, [matchId]: res.data || [] })))
      .catch(() => { if (showError) toast.error('Không tải được lịch sử trò chuyện.'); });
    loadMessages(true).finally(() => setLoadingMessages(false));
    const intervalId = window.setInterval(() => loadMessages(), 5000);
    return () => window.clearInterval(intervalId);
  }, [selectedMatch]);

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
      const res = await api.post(`/matching/requests/${id}/${action}`);
      if (action === 'accept') {
        toast.success('🎉 Đã chấp nhận yêu cầu và tạo Match thành công!');
        if (res.data?.match) setCelebrativeMatch(res.data.match);
      } else {
        toast.success('Đã từ chối yêu cầu.');
      }
      loadRequestsAndMatches();
    } catch {
      toast.error('Không thể xử lý yêu cầu.');
    }
  };

  const handleSaveSetup = async () => {
    if (!selectedPetId) return;
    setSavingSetup(true);
    try {
      await api.patch(`/pets/${selectedPetId}/availability`, {
        isAvailableForMatching: isAvailable,
        breedingOption,
        breedingFee: breedingOption === 'CASH' ? Number(breedingFee) || 0 : undefined,
        shareLitterCount: breedingOption === 'SHARE_LITTER' ? Number(shareLitterCount) || 1 : undefined,
        personality: personalityNote.trim() || undefined,
      });
      toast.success('Đã lưu cấu hình phối giống thành công!');
      // Reload my pets
      const res = await api.get<Pet[]>('/pets/my');
      setMyPets(res.data || []);
    } catch {
      toast.error('Không thể lưu cấu hình.');
    } finally {
      setSavingSetup(false);
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const input = form.querySelector('input');
    const content = input?.value.trim() || inputText.trim();
    if (!selectedMatch || !content || sendingMessage) return;
    const matchId = selectedMatch.id;
    setSendingMessage(true);
    try {
      const res = await api.post<MatchMessage>(`/matching/matches/${matchId}/messages`, { content });
      setChatMessages((prev) => ({ ...prev, [matchId]: [...(prev[matchId] || []), res.data] }));
      setInputText('');
      form.reset();
    } catch {
      toast.error('Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setSendingMessage(false);
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
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all',
                    viewMode === 'SWIPE' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Layers className="size-4" /> Thẻ quẹt (Swipe)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('GRID')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all',
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
            <div className="mt-6 pt-4 border-t flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
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
                      'flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2 text-left transition-all shrink-0',
                      isSelected
                        ? pet.gender === 'FEMALE'
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-border bg-card hover:bg-muted/50',
                    )}
                  >
                    <img
                      src={pet.avatarUrl || pet.gallery?.[0] || '/placeholder.svg'}
                      alt={pet.name}
                      className="size-full max-w-8 max-h-8 rounded-full object-cover border"
                    />
                    <div className="min-w-0 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="font-extrabold truncate">{pet.name}</span>
                        <span className={cn('font-black text-[10px]', pet.gender === 'MALE' ? 'text-blue-600' : 'text-pink-600')}>
                          {pet.gender === 'MALE' ? '♂' : '♀'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{pet.breed}</p>
                    </div>
                  </button>
                );
              })}
              <Button size="sm" variant="ghost" className="rounded-2xl text-xs font-bold shrink-0 gap-1" asChild>
                <Link href="/my-pets/new">
                  <PawPrint className="size-3.5 text-primary" /> + Tạo bé mới
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
                  getAge={getAge}
                  onPass={() => {
                    handlePass(currentSwipeCandidate.id);
                    setCurrentCandidateIndex((prev) => prev + 1);
                  }}
                  onRequestOpen={() => setRequestingPet(currentSwipeCandidate)}
                  onViewDetail={() => setSelectedCandidateDetail(currentSwipeCandidate)}
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
                  getAge={getAge}
                  onPass={() => handlePass(pet.id)}
                  onRequestOpen={() => setRequestingPet(pet)}
                  onViewDetail={() => setSelectedCandidateDetail(pet)}
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
                actionHref="#"
                actionLabel="Cấu hình pet đực ngay"
                onActionClick={() => setActiveTab('SETUP')}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {incomingRequests.map((req) => (
                  <article key={req.id} className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
                    <div className="flex items-start gap-4">
                      <img src={req.femalePet.avatarUrl || '/placeholder.svg'} alt={req.femalePet.name} className="size-16 rounded-2xl object-cover border" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-base">{req.femalePet.name} ({req.femalePet.breed})</h3>
                        <p className="text-xs text-muted-foreground">Chủ sở hữu: <span className="text-foreground font-semibold">{req.femalePet.owner.name}</span></p>
                        <p className="mt-1 text-xs font-bold text-primary">Muốn phối với bé đực: {req.malePet.name}</p>
                      </div>
                    </div>
                    {req.note && <div className="rounded-xl border bg-muted/40 p-3 text-xs italic text-muted-foreground">&ldquo;{req.note}&rdquo;</div>}
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="rounded-xl font-bold" onClick={() => handleRespondRequest(req.id, 'reject')}>
                        <X className="mr-1 size-4" /> Từ chối
                      </Button>
                      <Button className="rounded-xl font-bold shadow-md shadow-primary/20" onClick={() => handleRespondRequest(req.id, 'accept')}>
                        <Check className="mr-1 size-4" /> Chấp nhận ghép đôi
                      </Button>
                    </div>
                  </article>
                ))}
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

      {/* ================= TAB 3: DIRECT MATCH CHAT ================= */}
      {activeTab === 'CHAT' && (
        <section className="container mx-auto flex-1 px-4 py-6">
          {matches.length === 0 ? (
            <EmptyState
              icon={<Heart className="size-10" />}
              title="Chưa có cặp đôi ghép thành công nào"
              description="Sau khi yêu cầu ghép đôi được chấp nhận, phòng chat trực tiếp giữa 2 chủ nuôi sẽ tự động kích hoạt."
              actionHref="#"
              actionLabel="Khám phá bạn đời ngay"
              onActionClick={() => setActiveTab('EXPLORE')}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[680px] rounded-3xl border bg-card overflow-hidden shadow-xl">
              {/* Left matches list */}
              <div className="lg:col-span-4 border-r flex flex-col bg-muted/20">
                <div className="p-4 border-b">
                  <h3 className="font-extrabold text-sm">Cặp đôi thành công ({matches.length})</h3>
                </div>
                <div className="flex-1 overflow-y-auto divide-y">
                  {matches.map((m) => {
                    const isSelected = selectedMatch?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMatch(m)}
                        className={cn('w-full p-3.5 text-left flex items-center gap-3 transition-all hover:bg-muted/50', isSelected && 'bg-primary/10 border-l-4 border-primary')}
                      >
                        <div className="flex -space-x-3 shrink-0">
                          <img src={m.pet1.avatarUrl || '/placeholder.svg'} alt={m.pet1.name} className="size-10 rounded-full border-2 border-background object-cover" />
                          <img src={m.pet2.avatarUrl || '/placeholder.svg'} alt={m.pet2.name} className="size-10 rounded-full border-2 border-background object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-xs truncate">{m.pet1.name} ❤️ {m.pet2.name}</h4>
                          <p className="text-[10px] text-muted-foreground truncate">{m.pet1.breed} & {m.pet2.breed}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chat window */}
              {selectedMatch && (
                <div className="lg:col-span-8 flex flex-col h-full bg-card">
                  <div className="flex items-center justify-between border-b p-4 bg-muted/10">
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-sm">{selectedMatch.pet1.name} & {selectedMatch.pet2.name}</h3>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">Active Match</span>
                    </div>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    <div className="rounded-2xl border bg-primary/5 p-3 text-center text-xs font-bold text-primary">
                      🎉 Hai bên đã ghép đôi thành công! Hãy trao đổi về thời gian và địa điểm phối giống.
                    </div>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto space-y-3">
                    {loadingMessages && <p className="py-4 text-center text-xs text-muted-foreground">Đang tải lịch sử trò chuyện...</p>}
                    {!loadingMessages && (chatMessages[selectedMatch.id] || []).length === 0 && (
                      <p className="py-4 text-center text-xs text-muted-foreground">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện.</p>
                    )}
                    {(chatMessages[selectedMatch.id] || []).map((message) => (
                      <div key={message.id} className={cn('flex flex-col', message.senderId === currentUserId ? 'items-end' : 'items-start')}>
                        <span className="px-1 text-[10px] font-bold text-muted-foreground">
                          {message.senderId === currentUserId ? 'Bạn' : message.sender.name} · {new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className={cn('mt-1 max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm', message.senderId === currentUserId ? 'bg-primary text-primary-foreground rounded-tr-none' : 'border bg-card rounded-tl-none')}>
                          {message.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2">
                    <Input placeholder="Nhập tin nhắn..." className="rounded-xl" />
                    <Button className="rounded-xl font-bold shadow-md shadow-primary/20">Gửi</Button>
                  </form>
                </div>
              )}
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
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bán kính khoảng cách: {filters.distanceRadius} km</label>
                  <input type="range" min="5" max="100" value={filters.distanceRadius} onChange={(e) => setFilters({ ...filters, distanceRadius: Number(e.target.value) })} className="w-full accent-primary" />
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
                <Button className="w-full rounded-xl font-bold py-6" onClick={() => setIsFilterOpen(false)}>Áp dụng bộ lọc</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= CANDIDATE DETAIL MODAL (FULL PROFILE) ================= */}
      <AnimatePresence>
        {selectedCandidateDetail && (
          <div className="fixed inset-0 z-50 flex justify-center p-4 bg-black/80 backdrop-blur-md pt-safe-top overflow-y-auto" onClick={() => setSelectedCandidateDetail(null)}>
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl rounded-[2rem] bg-background shadow-2xl overflow-hidden my-auto border border-white/10"
            >
              {/* Cover Image Container */}
              <div className="relative aspect-square md:aspect-[4/3] bg-muted w-full">
                <img
                  src={selectedCandidateDetail.avatarUrl || selectedCandidateDetail.avatar || selectedCandidateDetail.gallery?.[0] || '/placeholder.svg'}
                  alt={selectedCandidateDetail.name}
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedCandidateDetail(null)}
                  className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 transition-colors z-10"
                >
                  <X className="size-5" />
                </button>

                {/* Overlaid Badges */}
                <div className="absolute left-6 top-4 flex gap-2">
                  {selectedCandidateDetail.verificationBadge === 'VERIFIED' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-black text-white shadow backdrop-blur-md">
                      <ShieldCheck className="size-3.5" /> VERIFIED
                    </span>
                  )}
                  {selectedCandidateDetail.compatibilityScore && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1 text-xs font-black text-white shadow backdrop-blur-md">
                      <Sparkles className="size-3.5" /> {selectedCandidateDetail.compatibilityScore}% Phù hợp
                    </span>
                  )}
                </div>
              </div>

              {/* Profile Details */}
              <div className="px-6 pb-24 pt-2 md:pt-0 md:-mt-10 relative z-10 space-y-6">
                
                {/* Header Info */}
                <div>
                  <div className="flex items-end justify-between">
                    <div>
                      <h2 className="text-4xl md:text-5xl font-black drop-shadow-sm text-foreground">
                        {selectedCandidateDetail.name}
                      </h2>
                      <p className="text-base font-medium text-muted-foreground mt-1">
                        {selectedCandidateDetail.breed} · {selectedCandidateDetail.location}
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center size-14 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0 shadow-sm">
                      <span className="text-lg font-black leading-none">{selectedCandidateDetail.gender === 'MALE' ? '♂' : '♀'}</span>
                    </div>
                  </div>
                  
                  {/* Owner Info */}
                  {selectedCandidateDetail.ownerName && (
                    <div className="mt-4 flex items-center gap-2 rounded-full border bg-card/50 p-1.5 pr-4 w-fit">
                      <img
                        src={selectedCandidateDetail.ownerAvatar || '/placeholder.svg'}
                        alt={selectedCandidateDetail.ownerName}
                        className="size-7 rounded-full border bg-muted object-cover shrink-0"
                      />
                      <span className="text-xs font-semibold text-muted-foreground">
                        Chủ nuôi: <span className="font-bold text-foreground">{selectedCandidateDetail.ownerName}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl bg-muted/50 p-4 border flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-2xl">🎂</span>
                    <span className="text-xs text-muted-foreground font-bold uppercase">Tuổi</span>
                    <span className="text-sm font-black">{getAge(selectedCandidateDetail.birthday)}</span>
                  </div>
                  <div className="rounded-2xl bg-muted/50 p-4 border flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-2xl">⚖️</span>
                    <span className="text-xs text-muted-foreground font-bold uppercase">Cân nặng</span>
                    <span className="text-sm font-black">{selectedCandidateDetail.weight} kg</span>
                  </div>
                  <div className="rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/50 p-4 flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-2xl">🧬</span>
                    <span className="text-xs text-muted-foreground font-bold uppercase text-emerald-600 dark:text-emerald-400">Thuần chủng</span>
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{selectedCandidateDetail.hasPedigree ? 'Có' : 'Không'}</span>
                  </div>
                  <div className="rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/50 p-4 flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-2xl">💉</span>
                    <span className="text-xs text-muted-foreground font-bold uppercase text-blue-600 dark:text-blue-400">Tiêm phòng</span>
                    <span className="text-sm font-black text-blue-700 dark:text-blue-300">{selectedCandidateDetail.isVaccinated ? 'Đầy đủ' : 'Chưa'}</span>
                  </div>
                </div>

                {/* Personality & Breeding Terms */}
                <div className="space-y-4">
                  {selectedCandidateDetail.personality && (
                    <div className="rounded-2xl border p-4 bg-card shadow-sm space-y-2">
                      <h3 className="font-extrabold text-sm flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Tính cách & Đặc điểm</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedCandidateDetail.personality}
                      </p>
                    </div>
                  )}

                  {selectedCandidateDetail.breedingOption && (
                    <div className="rounded-2xl border p-4 bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900 space-y-2">
                      <h3 className="font-extrabold text-sm flex items-center gap-2 text-orange-600 dark:text-orange-400">💍 Yêu cầu Phối giống</h3>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-100 dark:bg-orange-900 px-3 py-1.5 text-xs font-bold text-orange-700 dark:text-orange-300">
                          {selectedCandidateDetail.breedingOption === 'CASH' ? '💰 Trả phí tiền mặt' : '🐾 Chia đàn con'}
                        </span>
                        {selectedCandidateDetail.breedingOption === 'CASH' && selectedCandidateDetail.breedingFee && (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-100 dark:bg-orange-900 px-3 py-1.5 text-xs font-bold text-orange-700 dark:text-orange-300">
                            Phí: {selectedCandidateDetail.breedingFee.toLocaleString('vi-VN')} đ
                          </span>
                        )}
                        {selectedCandidateDetail.breedingOption === 'SHARE_LITTER' && selectedCandidateDetail.shareLitterCount && (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-orange-100 dark:bg-orange-900 px-3 py-1.5 text-xs font-bold text-orange-700 dark:text-orange-300">
                            Chia: {selectedCandidateDetail.shareLitterCount} bé
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-6"></div>
              </div>
              
              {/* Fixed Bottom Action Bar */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t flex gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                <Button variant="outline" size="lg" className="rounded-xl font-bold px-6 shrink-0 h-14" onClick={() => { handlePass(selectedCandidateDetail.id); setSelectedCandidateDetail(null); }}>
                  <X className="mr-2 size-5" /> Bỏ qua
                </Button>
                <Button size="lg" className="flex-1 rounded-xl font-black text-base shadow-lg shadow-primary/20 h-14" onClick={() => { setRequestingPet(selectedCandidateDetail); setSelectedCandidateDetail(null); }}>
                  <Heart className="mr-2 size-5" /> Gửi yêu cầu ghép đôi
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
    </main>
  );
}

// =============================================================
// SWIPE CARD CONTAINER COMPONENT (STITCH SWIPE MODE)
// =============================================================

function SwipeCardContainer({
  pet,
  getAge,
  onPass,
  onRequestOpen,
  onViewDetail,
}: {
  pet: Pet;
  getAge: (b: string) => string;
  onPass: () => void;
  onRequestOpen: () => void;
  onViewDetail: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 120) {
      onRequestOpen();
    } else if (info.offset.x < -120) {
      onPass();
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      className="relative overflow-hidden rounded-3xl border bg-card shadow-2xl cursor-grab active:cursor-grabbing touch-none select-none"
    >
      {/* Aspect 4/5 tall photo */}
      <div className="relative aspect-[4/5] overflow-hidden bg-muted" onClick={onViewDetail}>
        <img
          src={pet.avatarUrl || pet.avatar || pet.gallery?.[0] || '/placeholder.svg'}
          alt={pet.name}
          className="size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          {pet.verificationBadge === 'VERIFIED' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-black text-white shadow-md backdrop-blur-md">
              <ShieldCheck className="size-4" /> VERIFIED
            </span>
          ) : <div />}

          <div className="flex items-center justify-center rounded-2xl bg-black/60 px-3 py-1.5 shadow-md backdrop-blur-md">
            <Sparkles className="mr-1 size-4 text-primary" />
            <span className="text-xs font-black text-primary">{pet.compatibilityScore || 95}% Phù hợp</span>
          </div>
        </div>

        {/* Bottom Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white space-y-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-3xl font-black drop-shadow-md">{pet.name}</h2>
            <span className="text-lg font-bold text-white/90">{getAge(pet.birthday)}</span>
          </div>
          <p className="text-sm font-semibold text-white/90">
            {pet.breed} · {pet.district ? `${pet.district}, ${pet.location}` : pet.location}
          </p>

          <div className="flex flex-wrap gap-2 pt-1 text-xs font-bold">
            <span className="rounded-lg bg-teal-500/90 text-white font-extrabold px-2.5 py-1 backdrop-blur-md shadow">
              📍 Cách {pet.distanceKm ?? 5} km
            </span>
            <span className="rounded-lg bg-black/40 px-2.5 py-1 backdrop-blur-md">
              ⚖️ {pet.weight} kg
            </span>
            {pet.breedingOption && (
              <span className="rounded-lg bg-primary/90 px-2.5 py-1 text-white shadow">
                💰{' '}
                {pet.breedingOption === 'CASH'
                  ? pet.breedingFee ? `${pet.breedingFee.toLocaleString('vi-VN')}đ` : 'Phối thu phí'
                  : pet.breedingOption === 'SHARE_LITTER'
                  ? `Chia ${pet.shareLitterCount || 1} con`
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
  getAge,
  onPass,
  onRequestOpen,
  onViewDetail,
}: {
  pet: Pet;
  getAge: (b: string) => string;
  onPass: () => void;
  onRequestOpen: () => void;
  onViewDetail: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted cursor-pointer" onClick={onViewDetail}>
        <img src={pet.avatarUrl || pet.avatar || pet.gallery?.[0] || '/placeholder.svg'} alt={pet.name} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute right-3 top-3 bg-black/60 backdrop-blur-md rounded-xl px-2.5 py-1 text-xs font-black text-primary">
          {pet.compatibilityScore || 95}%
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h2 className="text-xl font-black">{pet.name}</h2>
          <p className="text-xs font-medium text-white/80">{pet.breed} · {getAge(pet.birthday)}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span className="font-semibold text-foreground">📍 {pet.district ? `${pet.district}, ${pet.location}` : pet.location} ({pet.distanceKm ?? 5} km)</span>
          <span>⚖️ {pet.weight} kg</span>
        </div>
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
