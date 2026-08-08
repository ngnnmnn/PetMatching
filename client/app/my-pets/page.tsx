'use client';

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Coins,
  Edit,
  Heart,
  Info,
  PawPrint,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Syringe,
  ToggleLeft,
  ToggleRight,
  Users,
  X,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import AppHeader from '@/components/layout/AppHeader';
import api from '@/lib/axios';
import { useCart } from '@/context/CartContext';
import { productsApi } from '@/lib/api/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Pet = {
  id: string;
  name: string;
  species: 'DOG' | 'CAT';
  breed: string;
  gender: 'MALE' | 'FEMALE';
  weight: number;
  location: string;
  avatarUrl?: string | null;
  gallery: string[];
  hasPedigree: boolean;
  isVaccinated: boolean;
  pedigreeVerified: boolean;
  vaccineVerified: boolean;
  verificationBadge?: 'NONE' | 'PENDING' | 'VERIFIED';
  isAvailableForMatching: boolean;
  breedingOption?: 'CASH' | 'SHARE_LITTER' | 'NEGOTIATE';
  breedingFee?: number | null;
  shareLitterCount?: number | null;
  personality?: string | null;
  status: 'ACTIVE' | 'HIDDEN' | 'INACTIVE';
};

export default function MyPetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSetupPet, setSelectedSetupPet] = useState<Pet | null>(null);

  // Recommendations States
  const { addToCart } = useCart();
  const [selectedRecommendPet, setSelectedRecommendPet] = useState<Pet | null>(null);
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Form setup state for male matching modal
  const [isAvailable, setIsAvailable] = useState(false);
  const [breedingOption, setBreedingOption] = useState<'CASH' | 'SHARE_LITTER' | 'NEGOTIATE'>('NEGOTIATE');
  const [breedingFee, setBreedingFee] = useState<string>('');
  const [shareLitterCount, setShareLitterCount] = useState<string>('1');
  const [personalityNote, setPersonalityNote] = useState<string>('');
  const [savingSetup, setSavingSetup] = useState(false);

  const loadPets = () => {
    setLoading(true);
    api
      .get<Pet[]>('/pets/my')
      .then((response) => setPets(response.data))
      .catch(() => toast.error('Không tải được danh sách hồ sơ thú cưng.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadPets, []);

  const openSetupModal = (pet: Pet) => {
    setSelectedSetupPet(pet);
    setIsAvailable(pet.isAvailableForMatching);
    setBreedingOption(pet.breedingOption || 'NEGOTIATE');
    setBreedingFee(pet.breedingFee ? String(pet.breedingFee) : '');
    setShareLitterCount(pet.shareLitterCount ? String(pet.shareLitterCount) : '1');
    setPersonalityNote(pet.personality || '');
  };

  const handleSaveSetup = async () => {
    if (!selectedSetupPet) return;
    setSavingSetup(true);

    try {
      await api.patch(`/pets/${selectedSetupPet.id}/availability`, {
        isAvailableForMatching: isAvailable,
        breedingOption,
        breedingFee: breedingOption === 'CASH' ? Number(breedingFee) || 0 : undefined,
        shareLitterCount: breedingOption === 'SHARE_LITTER' ? Number(shareLitterCount) || 1 : undefined,
        personality: personalityNote.trim() || undefined,
      });

      toast.success(`Đã cập nhật cấu hình ghép đôi cho ${selectedSetupPet.name}!`);
      setSelectedSetupPet(null);
      loadPets();
    } catch (err: any) {
      const response = err.response?.data;
      toast.error(response?.message || 'Không thể lưu thiết lập.');
    } finally {
      setSavingSetup(false);
    }
  };

  const handleTogglePetStatus = async (pet: Pet) => {
    const nextStatus = pet.status === 'HIDDEN' ? 'ACTIVE' : 'HIDDEN';
    try {
      await api.patch(`/pets/${pet.id}/availability`, {
        isAvailableForMatching: pet.isAvailableForMatching,
        status: nextStatus,
      });
      toast.success(nextStatus === 'HIDDEN' ? `Đã tạm ẩn hồ sơ bé ${pet.name}!` : `Đã hiện lại hồ sơ bé ${pet.name}!`);
      loadPets();
    } catch {
      toast.error('Không cập nhật được trạng thái hồ sơ.');
    }
  };

  const openRecommendationsModal = async (pet: Pet) => {
    setSelectedRecommendPet(pet);
    setLoadingRecommendations(true);
    try {
      const res = await productsApi.getList({ page: 1, limit: 100 });
      const responseData = res.data;
      const allProducts = Array.isArray(responseData) 
        ? responseData 
        : (responseData as any).data || (responseData as any).products || [];
      
      let matched = allProducts.filter((p: any) => {
        if (!p.isActive) return false;
        const target = p.targetSpecies;
        return target === 'ALL' || target === pet.species;
      });

      matched = matched.map((p: any) => {
        let bestVariants = [];
        if (p.variants && p.variants.length > 0) {
          bestVariants = p.variants.filter((v: any) => {
            const nameLower = v.name.toLowerCase();
            const w = pet.weight;
            
            if (w < 5) {
              return nameLower.includes('size s') || nameLower.includes('500g') || nameLower.includes('200g') || nameLower.includes('1kg') || (!nameLower.includes('size m') && !nameLower.includes('size l') && !nameLower.includes('3kg') && !nameLower.includes('5kg'));
            } else if (w >= 5 && w <= 12) {
              return nameLower.includes('size m') || nameLower.includes('1.5kg') || nameLower.includes('2kg') || (!nameLower.includes('size s') && !nameLower.includes('size l'));
            } else {
              return nameLower.includes('size l') || nameLower.includes('3kg') || nameLower.includes('4kg') || nameLower.includes('5kg') || nameLower.includes('10kg') || nameLower.includes('lớn') || (!nameLower.includes('size s') && !nameLower.includes('size m') && !nameLower.includes('500g'));
            }
          });

          if (bestVariants.length === 0) {
            bestVariants = [p.variants[0]];
          }
        }

        return {
          ...p,
          matchedVariants: bestVariants,
          selectedVariant: bestVariants[0] || null,
        };
      });

      const breedLower = pet.breed.toLowerCase();
      matched.sort((a: any, b: any) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aBreedMatch = aName.includes(breedLower) || a.description?.toLowerCase().includes(breedLower);
        const bBreedMatch = bName.includes(breedLower) || b.description?.toLowerCase().includes(breedLower);

        if (aBreedMatch && !bBreedMatch) return -1;
        if (!aBreedMatch && bBreedMatch) return 1;

        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;

        return (b.rating || 0) - (a.rating || 0);
      });

      setRecommendedProducts(matched.slice(0, 8));
    } catch (err) {
      console.error('Failed to get product recommendations', err);
      toast.error('Lỗi khi tải danh sách gợi ý mua sắm.');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleVariantChange = (productId: string, variantId: string) => {
    setRecommendedProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const matched = p.variants?.find((v: any) => v.id === variantId);
          return {
            ...p,
            selectedVariant: matched || p.selectedVariant,
          };
        }
        return p;
      })
    );
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader sectionLabel="Thú cưng của tôi" />

      {/* Hero Section */}
      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-orange-50/50">
        <div className="container mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 py-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-2">
              <PawPrint className="size-3.5" />
              Quản lý Thú cưng
            </div>
            <h1 className="text-3xl font-black">Hồ sơ Thú cưng của tôi</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quản lý hồ sơ, bật trạng thái sẵn sàng ghép đôi và thiết lập điều kiện phối giống.
            </p>
          </div>
          <Button className="gap-2 rounded-xl font-bold shadow-md shadow-primary/20" size="lg" asChild>
            <Link href="/my-pets/new">
              <Plus className="size-5" />
              Tạo hồ sơ mới
            </Link>
          </Button>
        </div>
      </section>

      {/* Main List */}
      <section className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Đang tải danh sách hồ sơ...</div>
        ) : pets.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PawPrint className="size-10" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Chưa có hồ sơ thú cưng</h2>
            <p className="mb-6 text-sm text-muted-foreground">Hãy tạo hồ sơ thú cưng đầu tiên để tham gia cộng đồng ghép đôi.</p>
            <Button asChild className="rounded-xl font-bold shadow-md shadow-primary/20">
              <Link href="/my-pets/new">Tạo hồ sơ mới</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pets.map((pet) => (
              <article
                key={pet.id}
                className={cn(
                  'group overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative',
                  pet.status === 'HIDDEN' && 'opacity-70 bg-muted/40 border-rose-300 dark:border-rose-900',
                )}
              >
                {/* Image */}
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <img
                    src={pet.avatarUrl || pet.gallery?.[0] || '/placeholder.svg'}
                    alt={pet.name}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Gender badge */}
                  <span
                    className={cn(
                      'absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-black text-white shadow-md',
                      pet.gender === 'MALE' ? 'bg-blue-600' : 'bg-pink-600',
                    )}
                  >
                    {pet.gender === 'MALE' ? '♂ Đực' : '♀ Cái'}
                  </span>

                  {/* Matching availability indicator / Status */}
                  {pet.status === 'HIDDEN' ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                      🔴 Đã tạm ẩn
                    </span>
                  ) : pet.gender === 'MALE' ? (
                    <span
                      className={cn(
                        'absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md',
                        pet.isAvailableForMatching ? 'bg-emerald-500' : 'bg-black/60',
                      )}
                    >
                      <span className={cn('size-2 rounded-full', pet.isAvailableForMatching ? 'bg-white animate-pulse' : 'bg-gray-400')} />
                      {pet.isAvailableForMatching ? 'Sẵn sàng phối' : 'Tắt ghép đôi'}
                    </span>
                  ) : null}

                  {/* Bottom title */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h2 className="text-xl font-black drop-shadow-sm">{pet.name}</h2>
                    <p className="text-xs text-white/80 font-medium">{pet.breed} · {pet.location}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4 p-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {pet.verificationBadge === 'VERIFIED' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="size-3.5" />
                        Đã xác thực
                      </span>
                    )}
                    {pet.isVaccinated && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-bold text-blue-700 border border-blue-200">
                        <Syringe className="size-3.5" />
                        Đã tiêm chủng
                      </span>
                    )}
                    {pet.hasPedigree && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-700 border border-amber-200">
                        <BadgeCheck className="size-3.5" />
                        Phả hệ VKA
                      </span>
                    )}
                  </div>

                  {/* Breeding option preview for male */}
                  {pet.gender === 'MALE' && pet.isAvailableForMatching && (
                    <div className="rounded-xl border bg-primary/5 p-3 text-xs space-y-1">
                      <span className="font-bold text-primary uppercase tracking-wider text-[10px]">Hình thức phối giống:</span>
                      <p className="font-extrabold text-foreground">
                        {pet.breedingOption === 'CASH'
                          ? `Thu tiền mặt: ${pet.breedingFee?.toLocaleString('vi-VN')} VNĐ`
                          : pet.breedingOption === 'SHARE_LITTER'
                          ? `Chia con non (${pet.shareLitterCount || 1} con)`
                          : 'Thỏa thuận trực tiếp'}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="pt-2 space-y-2">
                    <div className="flex gap-2">
                      {pet.gender === 'MALE' ? (
                        <Button
                          className="flex-1 gap-1.5 rounded-xl font-bold shadow-md shadow-primary/20 text-xs"
                          onClick={() => openSetupModal(pet)}
                        >
                          <Settings2 className="size-4" />
                          {pet.isAvailableForMatching ? 'Cấu hình Ghép đôi' : 'Bật ghép đôi'}
                        </Button>
                      ) : (
                        <Button className="flex-1 gap-1.5 rounded-xl font-bold shadow-md shadow-primary/20 text-xs" asChild>
                          <Link href="/explore">
                            <Heart className="size-4" />
                            Tìm bạn đời
                          </Link>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        title={pet.status === 'HIDDEN' ? 'Hiện lại hồ sơ' : 'Tạm ẩn hồ sơ'}
                        className={cn(
                          'rounded-xl shrink-0 font-bold text-xs px-3 transition-colors',
                          pet.status === 'HIDDEN'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100',
                        )}
                        onClick={() => handleTogglePetStatus(pet)}
                      >
                        {pet.status === 'HIDDEN'
                          ? '👁️ Hiện hồ sơ'
                          : '🙈 Ẩn hồ sơ'}
                      </Button>
                    </div>

                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => openRecommendationsModal(pet)}
                      className="w-full gap-2 rounded-xl font-bold border-[#EFEAE2] hover:bg-[#FAF9F6] text-xs shadow-sm cursor-pointer"
                    >
                      <Sparkles className="size-4 text-primary fill-primary/10" />
                      Gợi ý mua sắm thông minh
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ============ MALE PET MATCHING SETUP MODAL (MATCHING STITCH SCREEN) ============ */}
      <AnimatePresence>
        {selectedSetupPet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-xl font-black">Thiết lập Cấu hình Ghép đôi</h2>
                  <p className="text-xs text-muted-foreground">Dành cho thú cưng đực: <span className="font-bold text-primary">{selectedSetupPet.name}</span> ({selectedSetupPet.breed})</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedSetupPet(null)}>
                  <X className="size-5" />
                </Button>
              </div>

              {/* Main Toggle Hero Card */}
              <div className={cn(
                'rounded-2xl border-2 p-4 transition-all',
                isAvailable ? 'border-emerald-500 bg-emerald-50/50' : 'border-border bg-muted/30'
              )}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-sm font-black">Trạng thái Sẵn sàng Ghép đôi</span>
                    <p className="text-xs text-muted-foreground">
                      {isAvailable ? 'Hồ sơ đang hiển thị trong hệ thống đề xuất cho pet cái.' : 'Hồ sơ đang ẩn khỏi kết quả tìm kiếm.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAvailable(!isAvailable)}
                    className={cn(
                      'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                      isAvailable ? 'bg-emerald-500' : 'bg-gray-300'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block size-6 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                        isAvailable ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Breeding Options */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Hình thức & Quyền lợi Phối giống
                </label>

                <div className="space-y-2">
                  {/* Option 1: CASH */}
                  <label
                    className={cn(
                      'flex flex-col rounded-xl border-2 p-3.5 cursor-pointer transition-all',
                      breedingOption === 'CASH' ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    )}
                    onClick={() => setBreedingOption('CASH')}
                  >
                    <div className="flex items-center gap-3">
                      <input type="radio" name="breedingOption" checked={breedingOption === 'CASH'} readOnly className="accent-primary" />
                      <div className="flex-1">
                        <span className="text-sm font-bold">Thu tiền mặt (CASH)</span>
                        <p className="text-xs text-muted-foreground">Chủ thú cưng cái sẽ trả phí phối giống theo mức bạn quy định.</p>
                      </div>
                    </div>
                    {breedingOption === 'CASH' && (
                      <div className="mt-3 pl-7">
                        <label className="text-xs font-semibold text-muted-foreground">Mức phí phối giống (VNĐ):</label>
                        <Input
                          type="number"
                          value={breedingFee}
                          onChange={(e) => setBreedingFee(e.target.value)}
                          placeholder="Ví dụ: 3000000"
                          className="mt-1 rounded-xl font-bold"
                        />
                      </div>
                    )}
                  </label>

                  {/* Option 2: SHARE_LITTER */}
                  <label
                    className={cn(
                      'flex flex-col rounded-xl border-2 p-3.5 cursor-pointer transition-all',
                      breedingOption === 'SHARE_LITTER' ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    )}
                    onClick={() => setBreedingOption('SHARE_LITTER')}
                  >
                    <div className="flex items-center gap-3">
                      <input type="radio" name="breedingOption" checked={breedingOption === 'SHARE_LITTER'} readOnly className="accent-primary" />
                      <div className="flex-1">
                        <span className="text-sm font-bold">Chia con non (SHARE_LITTER)</span>
                        <p className="text-xs text-muted-foreground">Chủ thú cưng đực sẽ nhận số lượng con non thỏa thuận trong lứa đẻ.</p>
                      </div>
                    </div>
                    {breedingOption === 'SHARE_LITTER' && (
                      <div className="mt-3 pl-7">
                        <label className="text-xs font-semibold text-muted-foreground">Số con muốn nhận:</label>
                        <select
                          value={shareLitterCount}
                          onChange={(e) => setShareLitterCount(e.target.value)}
                          className="mt-1 w-full rounded-xl border bg-background p-2.5 text-sm font-bold"
                        >
                          <option value="1">1 con (Ưu tiên chọn trước)</option>
                          <option value="2">2 con</option>
                          <option value="3">Thỏa thuận tỷ lệ theo số lượng lứa</option>
                        </select>
                      </div>
                    )}
                  </label>

                  {/* Option 3: NEGOTIATE */}
                  <label
                    className={cn(
                      'flex items-center gap-3 rounded-xl border-2 p-3.5 cursor-pointer transition-all',
                      breedingOption === 'NEGOTIATE' ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    )}
                    onClick={() => setBreedingOption('NEGOTIATE')}
                  >
                    <input type="radio" name="breedingOption" checked={breedingOption === 'NEGOTIATE'} readOnly className="accent-primary" />
                    <div>
                      <span className="text-sm font-bold">Thỏa thuận trực tiếp</span>
                      <p className="text-xs text-muted-foreground">Trao đổi điều kiện cụ thể với đối phương qua tin nhắn sau khi kết nối.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Breeding Requirements / Note */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Điều kiện & Ghi chú đối với thú cưng cái
                </label>
                <textarea
                  rows={3}
                  value={personalityNote}
                  onChange={(e) => setPersonalityNote(e.target.value)}
                  placeholder="Ví dụ: Yêu cầu bé cái tiêm phòng đầy đủ 5 mũi, tắm sạch trước khi mang tới phối tại nhà..."
                  className="w-full rounded-xl border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setSelectedSetupPet(null)}>
                  Hủy
                </Button>
                <Button
                  className="flex-1 rounded-xl font-bold shadow-md shadow-primary/20"
                  onClick={() => handleSaveSetup()}
                  disabled={savingSetup}
                >
                  {savingSetup ? 'Đang lưu...' : 'Lưu cấu hình ghép đôi'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============ SHOPPING RECOMMENDATIONS MODAL ============ */}
      <AnimatePresence>
        {selectedRecommendPet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl space-y-6 relative"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
                    <Sparkles className="size-6 fill-primary/10 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-foreground">Gợi ý mua sắm thông minh</h2>
                    <p className="text-xs text-muted-foreground">
                      Sản phẩm được tối ưu cho bé <span className="font-bold text-primary">{selectedRecommendPet.name}</span> ({selectedRecommendPet.breed} · {selectedRecommendPet.weight}kg)
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100" onClick={() => setSelectedRecommendPet(null)}>
                  <X className="size-5" />
                </Button>
              </div>

              {/* Loader or Content */}
              {loadingRecommendations ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm font-bold text-muted-foreground">Đang nghiên cứu và đối khớp sản phẩm phù hợp...</p>
                </div>
              ) : recommendedProducts.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground text-sm font-medium">
                  Chưa có sản phẩm nào phù hợp được tìm thấy cho bé thú cưng này.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {recommendedProducts.map((p) => {
                    const variant = p.selectedVariant;
                    const price = variant ? (variant.salePrice ?? variant.sellingPrice) : (p.salePrice ?? p.sellingPrice);
                    const originalPrice = variant ? variant.sellingPrice : p.sellingPrice;
                    const isDiscounted = variant ? (!!variant.salePrice && variant.salePrice < variant.sellingPrice) : (!!p.salePrice && p.salePrice < p.sellingPrice);
                    const imageUrl = variant?.imageUrl || p.imageUrl || '/placeholder.svg';

                    return (
                      <div key={p.id} className="group rounded-2xl border bg-card p-3 shadow-sm hover:shadow-md transition duration-300 flex flex-col justify-between space-y-3 relative">
                        {/* Discount Tag */}
                        {isDiscounted && (
                          <span className="absolute left-2.5 top-2.5 z-10 rounded-lg bg-red-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                            KM
                          </span>
                        )}

                        {/* Image */}
                        <div className="aspect-square rounded-xl overflow-hidden bg-muted relative">
                          <img
                            src={imageUrl}
                            alt={p.name}
                            className="size-full object-cover group-hover:scale-105 transition duration-500"
                          />
                        </div>

                        {/* Text Details */}
                        <div className="space-y-1">
                          <span className="text-[9px] bg-slate-100 text-slate-600 font-extrabold uppercase px-1.5 py-0.5 rounded">
                            {p.brand || 'PetMatch'}
                          </span>
                          <h4 className="text-xs font-bold text-foreground line-clamp-2 mt-1 leading-snug group-hover:text-primary transition" title={p.name}>
                            {p.name}
                          </h4>
                          
                          {/* Price */}
                          <div className="flex items-baseline gap-1.5 pt-1">
                            <span className="text-sm font-black text-primary">
                              {price.toLocaleString('vi-VN')}đ
                            </span>
                            {isDiscounted && (
                              <span className="text-[10px] text-muted-foreground line-through font-medium">
                                {originalPrice.toLocaleString('vi-VN')}đ
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Variant Selector Dropdown */}
                        {p.variants && p.variants.length > 0 && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase">Kích cỡ / Phân loại:</label>
                            <select
                              value={variant?.id || ''}
                              onChange={(e) => handleVariantChange(p.id, e.target.value)}
                              className="w-full rounded-lg border bg-background p-1.5 text-[11px] font-bold outline-none cursor-pointer focus:border-primary"
                            >
                              {p.variants.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} ({v.sellingPrice.toLocaleString('vi-VN')}đ)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Action Add To Cart */}
                        <Button
                          size="sm"
                          disabled={variant ? variant.stock <= 0 : p.stock <= 0}
                          className="w-full rounded-xl font-bold text-xs"
                          onClick={() => {
                            const vId = variant?.id || undefined;
                            addToCart(p, 1, false, vId);
                            toast.success(`Đã thêm sản phẩm "${p.name}${variant ? ` (${variant.name})` : ''}" vào giỏ hàng!`);
                          }}
                        >
                          {(variant ? variant.stock <= 0 : p.stock <= 0) ? 'Hết hàng' : 'Thêm vào giỏ'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </main>
  );
}
