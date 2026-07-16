'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronDown,
  Crown,
  Heart,
  MapPin,
  PawPrint,
  Search,
  ShieldCheck,
  Sparkles,
  Syringe,
  Weight,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import AppHeader from '@/components/layout/AppHeader';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
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
  avatarUrl?: string | null;
  avatar?: string | null;
  gallery: string[];
  personality?: string | null;
  hasPedigree: boolean;
  pedigreeVerified: boolean;
  vaccineVerified: boolean;
  verified?: boolean;
  verificationBadge?: string;
  isAvailableForMatching: boolean;
  compatibilityScore?: number;
  matchReasons?: string[];
  breedWarnings?: string[];
  breedInfo?: {
    offspringName: string | null;
    warningNote: string | null;
    isCompatible: boolean;
  };
  ownerName?: string;
};

// =============================================================
// Constants
// =============================================================

const REASON_LABELS: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  same_breed:          { label: 'Cùng giống',           icon: Crown,      color: 'text-amber-600 bg-amber-50 border-amber-200' },
  breed_compatible:    { label: 'Giống tương thích',    icon: Zap,        color: 'text-violet-600 bg-violet-50 border-violet-200' },
  both_pedigree:       { label: 'Cả hai có phả hệ',    icon: Crown,      color: 'text-amber-600 bg-amber-50 border-amber-200' },
  both_pedigree_verified: { label: 'Phả hệ xác minh',  icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  both_vaccine_verified:  { label: 'Vaccine xác minh',  icon: Syringe,    color: 'text-blue-600 bg-blue-50 border-blue-200' },
  same_location:       { label: 'Cùng khu vực',        icon: MapPin,     color: 'text-teal-600 bg-teal-50 border-teal-200' },
  similar_weight:      { label: 'Cân nặng tương đồng', icon: Weight,     color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
  exit: {
    opacity: 0,
    scale: 0.92,
    y: -10,
    transition: { duration: 0.25 },
  },
};

// =============================================================
// Main Page
// =============================================================

export default function ExplorePage() {
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [candidates, setCandidates] = useState<Pet[]>([]);
  const [loadingPets, setLoadingPets] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [petSelectorOpen, setPetSelectorOpen] = useState(false);

  const femalePets = useMemo(() => myPets.filter((pet) => pet.gender === 'FEMALE'), [myPets]);
  const selectedPet = useMemo(() => femalePets.find((p) => p.id === selectedPetId), [femalePets, selectedPetId]);

  useEffect(() => {
    api
      .get<Pet[]>('/pets/my')
      .then((response) => {
        setMyPets(response.data);
        const firstFemale = response.data.find((pet) => pet.gender === 'FEMALE');
        if (firstFemale) setSelectedPetId(firstFemale.id);
      })
      .catch(() => toast.error('Không tải được hồ sơ thú cưng của bạn.'))
      .finally(() => setLoadingPets(false));
  }, []);

  useEffect(() => {
    if (!selectedPetId) {
      setCandidates([]);
      return;
    }

    setLoadingCandidates(true);
    api
      .get<{ data: Pet[] }>('/matching/candidates', {
        params: { femalePetId: selectedPetId },
      })
      .then((response) => setCandidates(response.data.data))
      .catch((err) => {
        const msg = err.response?.data?.message || 'Không tải được danh sách gợi ý.';
        toast.error(msg);
      })
      .finally(() => setLoadingCandidates(false));
  }, [selectedPetId]);

  const passCandidate = useCallback(async (candidateId: string) => {
    if (!selectedPetId) return;
    try {
      await api.post('/matching/pass', { femalePetId: selectedPetId, malePetId: candidateId });
      setCandidates((current) => current.filter((pet) => pet.id !== candidateId));
      toast.success('Đã ẩn hồ sơ này khỏi gợi ý.');
    } catch {
      toast.error('Không thể bỏ qua hồ sơ này.');
    }
  }, [selectedPetId]);

  const requestCandidate = useCallback(async (candidateId: string) => {
    if (!selectedPetId) return;
    try {
      await api.post('/matching/requests', { femalePetId: selectedPetId, malePetId: candidateId });
      setCandidates((current) => current.filter((pet) => pet.id !== candidateId));
      toast.success('Đã gửi yêu cầu ghép đôi thành công!');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể gửi yêu cầu.';
      toast.error(msg);
    }
  }, [selectedPetId]);

  const getAge = (birthday: string) => {
    const diff = Date.now() - new Date(birthday).getTime();
    const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
    if (months < 12) return `${months} tháng`;
    const years = Math.floor(months / 12);
    const remainMonths = months % 12;
    return remainMonths > 0 ? `${years} tuổi ${remainMonths} tháng` : `${years} tuổi`;
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader sectionLabel="Ghép đôi" />

      {/* ============ HERO SECTION ============ */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/8 via-background to-accent/5">
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-accent/8 blur-3xl" />

        <div className="container relative mx-auto px-4 py-8 md:py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Left: Title & Description */}
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">
                <Sparkles className="size-3.5" />
                Ghép đôi thông minh
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                Tìm bạn đời cho
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> thú cưng</span>
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                Chọn hồ sơ thú cưng cái của bạn bên dưới, hệ thống sẽ gợi ý các hồ sơ đực phù hợp nhất dựa trên giống, phả hệ, vị trí và sức khỏe.
              </p>
            </div>

            {/* Right: Stats (if has pets) */}
            {!loadingPets && femalePets.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-4 md:gap-6"
              >
                <StatPill label="Thú cưng cái" value={femalePets.length} />
                <StatPill label="Gợi ý phù hợp" value={candidates.length} />
              </motion.div>
            )}
          </div>

          {/* ============ PET SELECTOR ============ */}
          {loadingPets ? (
            <div className="mt-8 flex gap-4 overflow-x-auto pb-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm" style={{ minWidth: 220 }}>
                  <div className="size-12 shrink-0 rounded-full bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : femalePets.length > 0 ? (
            <div className="mt-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Chọn thú cưng cái để ghép đôi
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {femalePets.map((pet) => (
                  <PetSelectorCard
                    key={pet.id}
                    pet={pet}
                    selected={selectedPetId === pet.id}
                    onClick={() => setSelectedPetId(pet.id)}
                    getAge={getAge}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ============ MAIN CONTENT ============ */}
      <section className="container mx-auto px-4 py-6 md:py-8">
        {/* No female pets empty state */}
        {!loadingPets && femalePets.length === 0 && (
          <EmptyState
            icon={<PawPrint className="size-12" />}
            title="Chưa có hồ sơ thú cưng cái"
            description="Bạn cần tạo hồ sơ thú cưng cái trước khi sử dụng tính năng ghép đôi. Hãy thêm hồ sơ thú cưng để bắt đầu tìm bạn đời cho bé."
            actionHref="/my-pets"
            actionLabel="Quản lý thú cưng"
          />
        )}

        {/* Loading state */}
        {loadingCandidates && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <CandidateCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* No candidates */}
        {!loadingCandidates && candidates.length === 0 && femalePets.length > 0 && (
          <EmptyState
            icon={<Search className="size-12" />}
            title="Chưa có gợi ý phù hợp"
            description="Hiện tại chưa có hồ sơ đực nào phù hợp với thú cưng của bạn. Các hồ sơ đã pass hoặc đang chờ xử lý sẽ được ẩn khỏi danh sách."
            actionHref="/my-pets"
            actionLabel="Xem hồ sơ của tôi"
          />
        )}

        {/* Candidate cards grid */}
        {!loadingCandidates && candidates.length > 0 && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">
                <span className="font-extrabold text-foreground">{candidates.length}</span> hồ sơ phù hợp
                {selectedPet && (
                  <span> cho <span className="font-bold text-primary">{selectedPet.name}</span></span>
                )}
              </p>
            </div>

            <motion.div
              className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
              layout
            >
              <AnimatePresence mode="popLayout">
                {candidates.map((pet, i) => (
                  <motion.div
                    key={pet.id}
                    custom={i}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                  >
                    <CandidateCard
                      pet={pet}
                      getAge={getAge}
                      onPass={() => passCandidate(pet.id)}
                      onRequest={() => requestCandidate(pet.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </section>
    </main>
  );
}

// =============================================================
// Stat Pill
// =============================================================

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border bg-card px-5 py-3 shadow-sm">
      <span className="text-2xl font-black text-foreground">{value}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

// =============================================================
// Pet Selector Card
// =============================================================

function PetSelectorCard({
  pet,
  selected,
  onClick,
  getAge,
}: {
  pet: Pet;
  selected: boolean;
  onClick: () => void;
  getAge: (birthday: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex shrink-0 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all duration-200',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        selected
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-border bg-card hover:border-primary/30 hover:bg-card',
      )}
      style={{ minWidth: 230 }}
    >
      {/* Selected indicator */}
      {selected && (
        <motion.div
          layoutId="pet-selector-indicator"
          className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </motion.div>
      )}

      {/* Avatar */}
      <div className={cn(
        'size-12 shrink-0 overflow-hidden rounded-full border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
      )}>
        <img
          src={pet.avatarUrl || pet.avatar || pet.gallery?.[0] || '/placeholder.svg'}
          alt={pet.name}
          className="size-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="min-w-0">
        <h3 className={cn(
          'truncate text-sm font-bold transition-colors',
          selected ? 'text-primary' : 'text-foreground',
        )}>
          {pet.name}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{pet.breed}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {getAge(pet.birthday)} · {pet.weight}kg
        </p>
      </div>
    </button>
  );
}

// =============================================================
// Circular Score Component
// =============================================================

function CompatibilityScore({ score }: { score: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 80) return { stroke: 'stroke-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 60) return { stroke: 'stroke-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
    return { stroke: 'stroke-rose-500', text: 'text-rose-600', bg: 'bg-rose-50' };
  };

  const colors = getScoreColor();

  return (
    <div className={cn('relative flex items-center justify-center rounded-xl p-1.5', colors.bg)}>
      <svg width="54" height="54" viewBox="0 0 54 54" className="-rotate-90">
        <circle
          cx="27"
          cy="27"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-black/5"
        />
        <motion.circle
          cx="27"
          cy="27"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={colors.stroke}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <span className={cn('absolute text-sm font-black', colors.text)}>
        {score}
      </span>
    </div>
  );
}

// =============================================================
// Candidate Card Component
// =============================================================

function CandidateCard({
  pet,
  getAge,
  onPass,
  onRequest,
}: {
  pet: Pet;
  getAge: (birthday: string) => string;
  onPass: () => void;
  onRequest: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<'pass' | 'request' | null>(null);
  const hasWarnings = pet.breedWarnings && pet.breedWarnings.length > 0;
  const hasReasons = pet.matchReasons && pet.matchReasons.length > 0;
  const score = pet.compatibilityScore ?? 0;

  const handlePass = async () => {
    setActionLoading('pass');
    await onPass();
    setActionLoading(null);
  };

  const handleRequest = async () => {
    setActionLoading('request');
    await onRequest();
    setActionLoading(null);
  };

  return (
    <article className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      {/* Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={pet.avatarUrl || pet.avatar || pet.gallery?.[0] || '/placeholder.svg'}
          alt={pet.name}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Top: Score badge */}
        <div className="absolute right-3 top-3">
          <CompatibilityScore score={score} />
        </div>

        {/* Top left: Verification badges */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {pet.pedigreeVerified && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-card/90 px-2 py-1 text-[10px] font-bold text-emerald-600 shadow-sm backdrop-blur-sm">
              <BadgeCheck className="size-3" />
              Phả hệ
            </span>
          )}
          {pet.vaccineVerified && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-card/90 px-2 py-1 text-[10px] font-bold text-blue-600 shadow-sm backdrop-blur-sm">
              <Syringe className="size-3" />
              Vaccine
            </span>
          )}
        </div>

        {/* Bottom: Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-white drop-shadow-sm">{pet.name}</h2>
              <p className="text-sm font-medium text-white/80">{pet.breed}</p>
            </div>

            {/* Breed offspring tag */}
            {pet.breedInfo?.offspringName && pet.breedInfo.isCompatible && (
              <span className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-md">
                {pet.breedInfo.offspringName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="space-y-3.5 p-4">
        {/* Quick stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 text-primary/70" />
            {pet.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Weight className="size-3.5 text-primary/70" />
            {pet.weight} kg
          </span>
          {pet.birthday && (
            <span className="inline-flex items-center gap-1.5">
              <PawPrint className="size-3.5 text-primary/70" />
              {getAge(pet.birthday)}
            </span>
          )}
        </div>

        {/* Match reason badges */}
        {hasReasons && (
          <div className="flex flex-wrap gap-1.5">
            {pet.matchReasons!
              .filter((r) => REASON_LABELS[r])
              .slice(0, 4)
              .map((reason) => {
                const info = REASON_LABELS[reason];
                const Icon = info.icon;
                return (
                  <span
                    key={reason}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold',
                      info.color,
                    )}
                  >
                    <Icon className="size-3" />
                    {info.label}
                  </span>
                );
              })}
          </div>
        )}

        {/* Breed warnings */}
        {hasWarnings && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            {pet.breedWarnings!.map((warning, idx) => (
              <p key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {warning}
              </p>
            ))}
          </div>
        )}

        {/* Personality excerpt */}
        {pet.personality && (
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
            &ldquo;{pet.personality}&rdquo;
          </p>
        )}

        {/* Owner */}
        {pet.ownerName && (
          <p className="text-xs text-muted-foreground">
            Chủ nhân: <span className="font-semibold text-foreground">{pet.ownerName}</span>
          </p>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-2 font-bold transition-all hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
            onClick={handlePass}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'pass' ? (
              <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <X className="size-4" />
            )}
            Bỏ qua
          </Button>
          <Button
            className="gap-2 rounded-xl font-bold shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30"
            onClick={handleRequest}
            disabled={actionLoading !== null}
          >
            {actionLoading === 'request' ? (
              <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Heart className="size-4" />
            )}
            Gửi yêu cầu
          </Button>
        </div>
      </div>
    </article>
  );
}

// =============================================================
// Skeleton Loading Card
// =============================================================

function CandidateCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-3.5 p-4">
        <div className="flex gap-4">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 animate-pulse rounded-xl bg-muted" />
          <div className="h-10 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Empty State Component
// =============================================================

function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="py-20 text-center"
    >
      <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 text-muted-foreground">
        {icon}
      </div>
      <h2 className="mb-3 text-2xl font-extrabold">{title}</h2>
      <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Button asChild size="lg" className="rounded-xl font-bold shadow-md shadow-primary/20">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </motion.div>
  );
}
