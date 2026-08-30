"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  Heart,
  Info,
  PawPrint,
  Plus,
  Settings2,
  Sparkles,
  Syringe,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "@/components/layout/AppHeader";
import { useCart } from "@/context/CartContext";
import { productsApi } from "@/lib/api/products";
import { petsApi, type Pet } from "@/lib/api/pets";
import { PetProfileDialog } from "@/components/pets/PetProfileDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Product, ProductVariant } from "@/types";
import {
  getPetWeightLimits,
  isPetMatchingWeightEligible,
} from "@/lib/pet-options";

type RecommendedProduct = Product & {
  matchedVariants: ProductVariant[];
  selectedVariant: ProductVariant | null;
};

function getPetBreedingStatus(pet: Pet) {
  const minMonths = pet.species === "CAT" ? 8 : 12;
  const birthday = new Date(pet.birthday);
  const now = new Date();
  let months = (now.getFullYear() - birthday.getFullYear()) * 12 + now.getMonth() - birthday.getMonth();
  if (now.getDate() < birthday.getDate()) months -= 1;
  months = Math.max(0, months);
  const isUnderage = months < minMonths;
  const weightLimits = getPetWeightLimits(pet.species);
  const isWeightEligible = isPetMatchingWeightEligible(
    pet.species,
    pet.weight,
  );
  const isEligible = !isUnderage && isWeightEligible;
  const eligibleDate = new Date(birthday);
  eligibleDate.setMonth(eligibleDate.getMonth() + minMonths);
  const eligibleDateStr = eligibleDate.toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" });
  return {
    isUnderage,
    isWeightEligible,
    isEligible,
    months,
    minMonths,
    eligibleDateStr,
    weightLimits,
  };
}

export default function MyPetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSetupPet, setSelectedSetupPet] = useState<Pet | null>(null);
  const [selectedDetailPetId, setSelectedDetailPetId] = useState<string | null>(
    null,
  );
  const [editModePetId, setEditModePetId] = useState<string | null>(null);

  // Recommendations States
  const { addToCart } = useCart();
  const [selectedRecommendPet, setSelectedRecommendPet] = useState<Pet | null>(
    null,
  );
  const [recommendedProducts, setRecommendedProducts] = useState<
    RecommendedProduct[]
  >([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Form setup state for male matching modal
  const [isAvailable, setIsAvailable] = useState(false);
  const [breedingOption, setBreedingOption] = useState<
    "CASH" | "SHARE_LITTER" | "NEGOTIATE"
  >("NEGOTIATE");
  const [breedingFee, setBreedingFee] = useState<string>("");
  const [shareLitterCount, setShareLitterCount] = useState<string>("1");
  const [personalityNote, setPersonalityNote] = useState<string>("");
  const [savingSetup, setSavingSetup] = useState(false);
  const selectedSetupStatus = selectedSetupPet
    ? getPetBreedingStatus(selectedSetupPet)
    : null;

  const loadPets = async () => {
    try {
      const response = await petsApi.getMine();
      setPets(response.data);
    } catch {
      toast.error("Không tải được danh sách hồ sơ thú cưng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    petsApi
      .getMine()
      .then((response) => {
        if (!active) return;
        setPets(response.data);
        const petId = new URLSearchParams(window.location.search).get("editPet");
        if (petId && response.data.some((pet) => pet.id === petId)) {
          setEditModePetId(petId);
          setSelectedDetailPetId(petId);
        }
      })
      .catch(() => {
        if (active) toast.error("Không tải được danh sách hồ sơ thú cưng.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openSetupModal = (pet: Pet) => {
    setSelectedSetupPet(pet);
    setIsAvailable(pet.isAvailableForMatching);
    setBreedingOption(pet.breedingOption || "NEGOTIATE");
    setBreedingFee(pet.breedingFee ? String(pet.breedingFee) : "");
    setShareLitterCount(
      pet.shareLitterCount ? String(pet.shareLitterCount) : "1",
    );
    setPersonalityNote(pet.personality || "");
  };

  const handleSaveSetup = async () => {
    if (!selectedSetupPet) return;
    setSavingSetup(true);

    try {
      await petsApi.updateAvailability(selectedSetupPet.id, {
        isAvailableForMatching: isAvailable,
        breedingOption,
        breedingFee:
          breedingOption === "CASH" ? Number(breedingFee) || 0 : undefined,
        shareLitterCount:
          breedingOption === "SHARE_LITTER"
            ? Number(shareLitterCount) || 1
            : undefined,
        personality: personalityNote.trim() || undefined,
      });

      toast.success(
        `Đã cập nhật cấu hình ghép đôi cho ${selectedSetupPet.name}!`,
      );
      setSelectedSetupPet(null);
      loadPets();
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      toast.error(message || "Không thể lưu thiết lập.");
    } finally {
      setSavingSetup(false);
    }
  };

  const handlePetUpdated = (updatedPet: Pet) => {
    setPets((current) =>
      current.map((pet) => (pet.id === updatedPet.id ? updatedPet : pet)),
    );
    setSelectedSetupPet((current) =>
      current?.id === updatedPet.id ? updatedPet : current,
    );
  };

  const openRecommendationsModal = async (pet: Pet) => {
    setSelectedRecommendPet(pet);
    setLoadingRecommendations(true);
    try {
      const res = await productsApi.getList({ page: 1, limit: 100 });
      const allProducts = res.data.data;

      const matched = allProducts.filter((p) => {
        if (!p.isActive) return false;
        const target = p.targetSpecies;
        return target === "ALL" || target === pet.species;
      });

      const recommendations: RecommendedProduct[] = matched.map((p) => {
        let bestVariants: ProductVariant[] = [];
        if (p.variants && p.variants.length > 0) {
          bestVariants = p.variants.filter((v) => {
            const nameLower = v.name.toLowerCase();
            const w = pet.weight;

            if (w < 5) {
              return (
                nameLower.includes("size s") ||
                nameLower.includes("500g") ||
                nameLower.includes("200g") ||
                nameLower.includes("1kg") ||
                (!nameLower.includes("size m") &&
                  !nameLower.includes("size l") &&
                  !nameLower.includes("3kg") &&
                  !nameLower.includes("5kg"))
              );
            } else if (w >= 5 && w <= 12) {
              return (
                nameLower.includes("size m") ||
                nameLower.includes("1.5kg") ||
                nameLower.includes("2kg") ||
                (!nameLower.includes("size s") && !nameLower.includes("size l"))
              );
            } else {
              return (
                nameLower.includes("size l") ||
                nameLower.includes("3kg") ||
                nameLower.includes("4kg") ||
                nameLower.includes("5kg") ||
                nameLower.includes("10kg") ||
                nameLower.includes("lớn") ||
                (!nameLower.includes("size s") &&
                  !nameLower.includes("size m") &&
                  !nameLower.includes("500g"))
              );
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
      recommendations.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aBreedMatch =
          aName.includes(breedLower) ||
          a.description?.toLowerCase().includes(breedLower);
        const bBreedMatch =
          bName.includes(breedLower) ||
          b.description?.toLowerCase().includes(breedLower);

        if (aBreedMatch && !bBreedMatch) return -1;
        if (!aBreedMatch && bBreedMatch) return 1;

        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;

        return (b.rating || 0) - (a.rating || 0);
      });

      setRecommendedProducts(recommendations.slice(0, 8));
    } catch (err) {
      console.error("Failed to get product recommendations", err);
      toast.error("Lỗi khi tải danh sách gợi ý mua sắm.");
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleVariantChange = (productId: string, variantId: string) => {
    setRecommendedProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const matched = p.variants?.find((v) => v.id === variantId);
          return {
            ...p,
            selectedVariant: matched || p.selectedVariant,
          };
        }
        return p;
      }),
    );
  };

  const selectedDetailPet = selectedDetailPetId
    ? (pets.find((pet) => pet.id === selectedDetailPetId) ?? null)
    : null;

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
              Quản lý hồ sơ, bật trạng thái sẵn sàng ghép đôi và thiết lập điều
              kiện phối giống.
            </p>
          </div>
          <Button
            className="gap-2 rounded-xl font-bold shadow-md shadow-primary/20"
            size="lg"
            asChild
          >
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
          <div className="py-20 text-center text-muted-foreground">
            Đang tải danh sách hồ sơ...
          </div>
        ) : pets.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PawPrint className="size-10" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Chưa có hồ sơ thú cưng</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Hãy tạo hồ sơ thú cưng đầu tiên để tham gia cộng đồng ghép đôi.
            </p>
            <Button
              asChild
              className="rounded-xl font-bold shadow-md shadow-primary/20"
            >
              <Link href="/my-pets/new">Tạo hồ sơ mới</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pets.map((pet) => {
              const {
                isUnderage,
                isWeightEligible,
                isEligible,
                months: ageMonths,
                minMonths,
                eligibleDateStr,
              } = getPetBreedingStatus(pet);

              return (
              <article
                key={pet.id}
                className={cn(
                  "group relative flex h-full min-h-[455px] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                  pet.status === "HIDDEN" &&
                    "opacity-70 bg-muted/40 border-rose-300 dark:border-rose-900",
                )}
              >
                {/* Image */}
                <button
                  type="button"
                  onClick={() => setSelectedDetailPetId(pet.id)}
                  aria-label={`Xem chi tiết hồ sơ của ${pet.name}`}
                  title="Xem chi tiết hồ sơ"
                  className="relative aspect-video w-full cursor-pointer overflow-hidden bg-muted text-left outline-none focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:ring-inset"
                >
                  <img
                    src={
                      pet.avatarUrl || pet.gallery?.[0] || "/placeholder.svg"
                    }
                    alt={pet.name}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Gender badge */}
                  <span
                    className={cn(
                      "absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-black text-white shadow-md",
                      pet.gender === "MALE" ? "bg-blue-600" : "bg-pink-600",
                    )}
                  >
                    {pet.gender === "MALE" ? "♂ Đực" : "♀ Cái"}
                  </span>

                  {/* Matching availability indicator / Status */}
                  {pet.status === "HIDDEN" ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                      🔒 Bị quản trị viên ẩn
                    </span>
                  ) : pet.status === "INACTIVE" ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                      Đã tự ẩn
                    </span>
                  ) : isUnderage ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg bg-blue-600/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-white shadow-md">
                      🌱 Đang lớn ({ageMonths} th)
                    </span>
                  ) : !isWeightEligible ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg bg-amber-600/90 px-2.5 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md">
                      ⚖️ Chưa đủ cân phối giống
                    </span>
                  ) : pet.gender === "MALE" ? (
                    <span
                      className={cn(
                        "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md",
                        pet.isAvailableForMatching
                          ? "bg-emerald-500"
                          : "bg-black/60",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          pet.isAvailableForMatching
                            ? "bg-white animate-pulse"
                            : "bg-gray-400",
                        )}
                      />
                      {pet.isAvailableForMatching
                        ? "Sẵn sàng phối"
                        : "Tắt ghép đôi"}
                    </span>
                  ) : (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg bg-emerald-600/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-white shadow-md">
                      ✨ Đủ tuổi ghép đôi
                    </span>
                  )}

                  {/* Bottom title */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h2 className="text-xl font-black drop-shadow-sm">
                      {pet.name}
                    </h2>
                    <p className="text-xs text-white/80 font-medium">
                      {pet.breed} · {pet.location}
                    </p>
                  </div>
                </button>

                {/* Details */}
                <div className="flex flex-1 flex-col p-4">
                  {/* Badges */}
                  <div className="flex min-h-6 flex-wrap content-start gap-1.5 text-xs">
                    {isUnderage && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 font-bold">
                        🌱 Đang phát triển ({ageMonths}/{minMonths} th)
                      </span>
                    )}
                    {!isWeightEligible && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                        ⚖️ Chưa đạt cân nặng matching
                      </span>
                    )}
                    {pet.isVaccinated && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold",
                          pet.documents.some(
                            (document) => document.type === "VACCINE_RECORD" && document.status === "APPROVED",
                          )
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-gray-300 bg-white text-gray-600",
                        )}
                      >
                        <Syringe className="size-3.5" />
                        Đã tiêm chủng
                      </span>
                    )}
                    {pet.hasPedigree && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold",
                          pet.documents.some(
                            (document) => document.type === "PEDIGREE_CERT" && document.status === "APPROVED",
                          )
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-gray-300 bg-white text-gray-600",
                        )}
                      >
                        <BadgeCheck className="size-3.5" />
                        Phả hệ VKA
                      </span>
                    )}
                  </div>

                  {/* Breeding option preview for male */}
                  {pet.gender === "MALE" && pet.isAvailableForMatching && isEligible && (
                    <div className="mt-3 min-h-[54px] rounded-xl border bg-primary/5 p-3 text-xs space-y-1">
                      <span className="font-bold text-primary uppercase tracking-wider text-[10px]">
                        Hình thức phối giống:
                      </span>
                      <p className="font-extrabold text-foreground">
                        {pet.breedingOption === "CASH"
                          ? `Thu tiền mặt: ${pet.breedingFee?.toLocaleString("vi-VN")} VNĐ`
                          : pet.breedingOption === "SHARE_LITTER"
                            ? `Chia con non (${pet.shareLitterCount || 1} con)`
                            : "Thỏa thuận trực tiếp"}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-auto space-y-2 pt-4">
                    <div className="flex gap-2">
                      {pet.gender === "MALE" ? (
                        !isEligible ? (
                          <Button
                            variant="outline"
                            onClick={() => setSelectedDetailPetId(pet.id)}
                            className="h-10 flex-1 gap-1.5 rounded-xl border-amber-200 bg-amber-50/60 text-xs font-bold text-amber-700 shadow-xs dark:bg-amber-950/40 dark:text-amber-300"
                            title="Bé chưa đủ điều kiện phối giống"
                          >
                            {isUnderage
                              ? `🌱 Đang lớn (T${eligibleDateStr})`
                              : "⚖️ Chưa đủ cân phối giống"}
                          </Button>
                        ) : (
                          <Button
                            className="h-10 flex-1 gap-1.5 rounded-xl font-bold shadow-md shadow-primary/20 text-xs"
                            onClick={() => openSetupModal(pet)}
                            disabled={pet.status !== "ACTIVE"}
                          >
                            <Settings2 className="size-4" />
                            {pet.status !== "ACTIVE"
                              ? "Không thể ghép đôi"
                              : pet.isAvailableForMatching
                              ? "Cấu hình Ghép đôi"
                              : "Bật ghép đôi"}
                          </Button>
                        )
                      ) : pet.status !== "ACTIVE" ? (
                        <Button
                          className="h-10 flex-1 gap-1.5 rounded-xl font-bold text-xs"
                          disabled
                        >
                          <Heart className="size-4" />
                          Không thể ghép đôi
                        </Button>
                      ) : !isEligible ? (
                        <Button
                          className="h-10 flex-1 gap-1.5 rounded-xl border-amber-200 bg-amber-50/60 text-xs font-bold text-amber-700 shadow-xs dark:bg-amber-950/40 dark:text-amber-300"
                          onClick={() => setSelectedDetailPetId(pet.id)}
                        >
                          <Heart className="size-4" />
                          {isUnderage ? "Chưa đủ tuổi" : "Chưa đủ cân phối giống"}
                        </Button>
                      ) : (
                        <Button
                          className="h-10 flex-1 gap-1.5 rounded-xl font-bold shadow-md shadow-primary/20 text-xs"
                          asChild
                        >
                          <Link href="/explore">
                            <Heart className="size-4" />
                            Tìm bạn đời
                          </Link>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        title="Xem chi tiết hồ sơ"
                        className="h-10 shrink-0 gap-1.5 rounded-xl border-slate-200 px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
                        onClick={() => setSelectedDetailPetId(pet.id)}
                      >
                        <Eye className="size-4" />
                        Xem chi tiết
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openRecommendationsModal(pet)}
                      className="h-10 w-full gap-2 rounded-xl font-bold border-[#EFEAE2] hover:bg-[#FAF9F6] text-xs shadow-sm cursor-pointer"
                    >
                      <Sparkles className="size-4 text-primary fill-primary/10" />
                      Gợi ý mua sắm thông minh
                    </Button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedDetailPet && (
        <PetProfileDialog
          key={selectedDetailPet.id}
          initialPet={selectedDetailPet}
          open
          startInEditMode={editModePetId === selectedDetailPet.id}
          onClose={() => {
            setSelectedDetailPetId(null);
            setEditModePetId(null);
          }}
          onPetUpdated={handlePetUpdated}
        />
      )}

      {/* ============ MALE PET MATCHING SETUP MODAL (MATCHING STITCH SCREEN) ============ */}
      <AnimatePresence>
        {selectedSetupPet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg rounded-[2rem] bg-card shadow-2xl border border-border/70 overflow-hidden flex flex-col max-h-[90vh] my-auto"
            >
              {/* 1. Fixed Header */}
              <div className="flex items-center justify-between border-b px-6 py-4.5 shrink-0 bg-card">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedSetupPet.avatarUrl || "/placeholder.svg"}
                    alt={selectedSetupPet.name}
                    className="size-11 rounded-2xl border-2 border-primary/20 object-cover bg-muted shrink-0 shadow-xs"
                  />
                  <div>
                    <h2 className="text-lg font-black text-foreground tracking-tight">
                      Cấu hình Ghép đôi
                    </h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-foreground">{selectedSetupPet.name}</span>
                      <span>·</span>
                      <span className="font-semibold">{selectedSetupPet.breed}</span>
                      <span>·</span>
                      <span className="text-blue-600 dark:text-blue-400 font-black">♂ Đực</span>
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-muted size-9"
                  onClick={() => setSelectedSetupPet(null)}
                >
                  <X className="size-5" />
                </Button>
              </div>

              {/* 2. Scrollable Body Content */}
              <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4.5">
                
                {/* Underage Notice if applicable */}
                {(() => {
                  if (!selectedSetupStatus?.isUnderage) return null;
                  return (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/90 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/40 flex items-start gap-3 shadow-xs">
                      <Info className="size-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-blue-900 dark:text-blue-200">
                          Bé chưa đạt tuổi phối giống an toàn ({selectedSetupStatus.months}/{selectedSetupStatus.minMonths} tháng)
                        </h4>
                        <p className="text-xs text-blue-700/90 dark:text-blue-300/90 leading-relaxed font-medium">
                          Bé cần tối thiểu {selectedSetupStatus.minMonths} tháng tuổi. Bạn có thể bật ghép đôi từ <strong>Tháng {selectedSetupStatus.eligibleDateStr}</strong>.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {selectedSetupStatus && !selectedSetupStatus.isWeightEligible && selectedSetupStatus.weightLimits && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 shadow-xs dark:border-amber-900/50 dark:bg-amber-950/40">
                    <Info className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-amber-900 dark:text-amber-200">
                        Bé chưa đạt cân nặng để phối giống
                      </h4>
                      <p className="text-xs font-medium leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                        {selectedSetupPet?.species === "DOG" ? "Chó" : "Mèo"} cần từ {selectedSetupStatus.weightLimits.matchingMin}-{selectedSetupStatus.weightLimits.matchingMax} kg để bật matching; hiện tại bé nặng {selectedSetupPet?.weight} kg.
                      </p>
                    </div>
                  </div>
                )}

                {/* Main Toggle Switch Card */}
                <div
                  className={cn(
                    "rounded-2xl border-2 p-4 transition-all shadow-xs",
                    isAvailable
                      ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30"
                      : "border-border bg-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl shrink-0 transition-colors",
                          isAvailable
                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isAvailable ? <CheckCircle2 className="size-5" /> : <EyeOff className="size-5" />}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-foreground">
                            {isAvailable ? "Sẵn sàng Ghép đôi" : "Tạm ẩn hồ sơ ghép đôi"}
                          </span>
                          {isAvailable && (
                            <span className="rounded-full bg-emerald-500 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-xs">
                              Đang công khai
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {isAvailable
                            ? "Hồ sơ bé đực đang hiển thị trong đề xuất ghép đôi cho pet cái."
                            : "Bé đực sẽ tạm ẩn khỏi bảng tin tìm kiếm ghép đôi."}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(selectedSetupStatus && !selectedSetupStatus.isEligible)}
                      onClick={() => setIsAvailable(!isAvailable)}
                      className={cn(
                        "relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer",
                        Boolean(selectedSetupStatus && !selectedSetupStatus.isEligible)
                          ? "cursor-not-allowed opacity-50 bg-gray-200 dark:bg-gray-800"
                          : isAvailable
                          ? "bg-emerald-500"
                          : "bg-gray-300 dark:bg-gray-700",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-6 rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                          isAvailable ? "translate-x-5" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Breeding Options */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Coins className="size-3.5 text-primary" /> Hình thức & Quyền lợi Phối giống
                  </label>

                  <div className="space-y-2">
                    {/* Option 1: CASH */}
                    <div
                      className={cn(
                        "flex flex-col rounded-2xl border-2 p-3.5 cursor-pointer transition-all shadow-2xs",
                        breedingOption === "CASH"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/70 bg-card hover:border-primary/40",
                      )}
                      onClick={() => setBreedingOption("CASH")}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex size-10 items-center justify-center rounded-xl shrink-0 text-xl font-bold transition-transform",
                          breedingOption === "CASH"
                            ? "bg-primary/15 text-primary scale-105"
                            : "bg-muted text-muted-foreground",
                        )}>
                          💰
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-foreground">
                              Thu phí phối giống (Tiền mặt)
                            </span>
                            <div className={cn(
                              "size-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              breedingOption === "CASH" ? "border-primary bg-primary text-white" : "border-muted-foreground/40",
                            )}>
                              {breedingOption === "CASH" && <Check className="size-3 stroke-[3]" />}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Chủ thú cưng cái sẽ thanh toán phí phối trực tiếp cho bạn.
                          </p>
                        </div>
                      </div>

                      {breedingOption === "CASH" && (
                        <div className="mt-3 pt-3 border-t border-primary/15 space-y-2 pl-2 sm:pl-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-foreground">
                              Mức phí phối giống (VNĐ):
                            </label>
                            {breedingFee && Number(breedingFee) > 0 && (
                              <span className="text-xs font-black text-primary font-mono">
                                {Number(breedingFee).toLocaleString("vi-VN")} đ
                              </span>
                            )}
                          </div>

                          <Input
                            type="number"
                            value={breedingFee}
                            onChange={(e) => setBreedingFee(e.target.value)}
                            placeholder="Nhập số tiền (ví dụ: 3000000)"
                            className="rounded-xl font-bold bg-background text-base h-10"
                          />

                          {/* Quick Preset Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span className="text-[11px] font-semibold text-muted-foreground mr-1">Mức phổ biến:</span>
                            {[1000000, 2000000, 3000000, 5000000, 10000000].map((fee) => (
                              <button
                                key={fee}
                                type="button"
                                onClick={() => setBreedingFee(String(fee))}
                                className={cn(
                                  "rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all cursor-pointer",
                                  Number(breedingFee) === fee
                                    ? "bg-primary text-white border-primary shadow-xs"
                                    : "bg-muted/60 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground",
                                )}
                              >
                                {(fee / 1000000).toLocaleString("vi-VN")}tr
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Option 2: SHARE_LITTER */}
                    <div
                      className={cn(
                        "flex flex-col rounded-2xl border-2 p-3.5 cursor-pointer transition-all shadow-2xs",
                        breedingOption === "SHARE_LITTER"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/70 bg-card hover:border-primary/40",
                      )}
                      onClick={() => setBreedingOption("SHARE_LITTER")}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex size-10 items-center justify-center rounded-xl shrink-0 text-xl font-bold transition-transform",
                          breedingOption === "SHARE_LITTER"
                            ? "bg-primary/15 text-primary scale-105"
                            : "bg-muted text-muted-foreground",
                        )}>
                          🐾
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-foreground">
                              Chia đàn con non (Bắt con)
                            </span>
                            <div className={cn(
                              "size-5 rounded-full border-2 flex items-center justify-center transition-colors",
                              breedingOption === "SHARE_LITTER" ? "border-primary bg-primary text-white" : "border-muted-foreground/40",
                            )}>
                              {breedingOption === "SHARE_LITTER" && <Check className="size-3 stroke-[3]" />}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Nhận số lượng chó/mèo con theo thỏa thuận trong lứa đẻ.
                          </p>
                        </div>
                      </div>

                      {breedingOption === "SHARE_LITTER" && (
                        <div className="mt-3 pt-3 border-t border-primary/15 space-y-2 pl-2 sm:pl-3" onClick={(e) => e.stopPropagation()}>
                          <label className="text-xs font-bold text-foreground">
                            Số con muốn nhận:
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: "1", label: "1 bé", desc: "Ưu tiên chọn trước" },
                              { value: "2", label: "2 bé", desc: "Lứa từ 5 bé trở lên" },
                              { value: "3", label: "Thỏa thuận", desc: "Theo quy mô lứa" },
                            ].map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setShareLitterCount(opt.value)}
                                className={cn(
                                  "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer",
                                  shareLitterCount === opt.value
                                    ? "border-primary bg-primary text-white shadow-xs font-bold"
                                    : "border-border bg-background text-muted-foreground hover:border-primary/40",
                                )}
                              >
                                <span className="text-xs font-black">{opt.label}</span>
                                <span className={cn("text-[10px] mt-0.5", shareLitterCount === opt.value ? "text-white/80" : "text-muted-foreground")}>
                                  {opt.desc}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Option 3: NEGOTIATE */}
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border-2 p-3.5 cursor-pointer transition-all shadow-2xs",
                        breedingOption === "NEGOTIATE"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/70 bg-card hover:border-primary/40",
                      )}
                      onClick={() => setBreedingOption("NEGOTIATE")}
                    >
                      <div className={cn(
                        "flex size-10 items-center justify-center rounded-xl shrink-0 text-xl font-bold transition-transform",
                        breedingOption === "NEGOTIATE"
                          ? "bg-primary/15 text-primary scale-105"
                          : "bg-muted text-muted-foreground",
                      )}>
                        🤝
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">
                            Thỏa thuận đôi bên
                          </span>
                          <div className={cn(
                            "size-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            breedingOption === "NEGOTIATE" ? "border-primary bg-primary text-white" : "border-muted-foreground/40",
                          )}>
                            {breedingOption === "NEGOTIATE" && <Check className="size-3 stroke-[3]" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Trao đổi điều kiện cụ thể với đối phương qua tin nhắn sau khi kết nối.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ghi chú & Điều kiện phối giống */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Điều kiện & Ghi chú đối với thú cưng cái
                    </label>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      {personalityNote.length}/300 ký tự
                    </span>
                  </div>

                  {/* Quick Tag Suggestions (Above Textarea for instant access) */}
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {[
                      "Bao đậu / Bảo hành phối lại 1 lần",
                      "Yêu cầu bé cái tiêm phòng đủ vắc-xin",
                      "Hỗ trợ phối tại nhà đực",
                      "Tắm sạch & tẩy giun trước khi phối",
                      "Gửi video/ảnh nhật ký phối giống",
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (personalityNote.includes(tag)) return;
                          setPersonalityNote((prev) => {
                            const trimmed = prev.trim();
                            if (!trimmed) return tag;
                            return `${trimmed}\n• ${tag}`;
                          });
                        }}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all cursor-pointer",
                          personalityNote.includes(tag)
                            ? "bg-primary/10 text-primary border-primary/30 font-bold"
                            : "bg-muted/50 text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground",
                        )}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2.5}
                    maxLength={300}
                    value={personalityNote}
                    onChange={(e) => setPersonalityNote(e.target.value)}
                    placeholder="Ví dụ: Bé cái tiêm phòng đầy đủ, bao đậu 1 lần phối lại, hỗ trợ phối tại nhà..."
                    className="w-full rounded-2xl border bg-background p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed"
                  />
                </div>
              </div>

              {/* 3. Fixed Sticky Footer */}
              <div className="flex gap-3 px-6 py-4 border-t bg-muted/15 shrink-0">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 rounded-xl font-bold h-11 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedSetupPet(null)}
                >
                  Hủy bỏ
                </Button>
                <Button
                  size="lg"
                  className="flex-1 rounded-xl font-black text-sm shadow-lg shadow-primary/20 h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => handleSaveSetup()}
                  disabled={savingSetup}
                >
                  {savingSetup ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Đang lưu...
                    </span>
                  ) : (
                    "Lưu cấu hình ngay"
                  )}
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
                    <h2 className="text-xl font-black text-foreground">
                      Gợi ý mua sắm thông minh
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Sản phẩm được tối ưu cho bé{" "}
                      <span className="font-bold text-primary">
                        {selectedRecommendPet.name}
                      </span>{" "}
                      ({selectedRecommendPet.breed} ·{" "}
                      {selectedRecommendPet.weight}kg)
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-slate-100"
                  onClick={() => setSelectedRecommendPet(null)}
                >
                  <X className="size-5" />
                </Button>
              </div>

              {/* Loader or Content */}
              {loadingRecommendations ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm font-bold text-muted-foreground">
                    Đang nghiên cứu và đối khớp sản phẩm phù hợp...
                  </p>
                </div>
              ) : recommendedProducts.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground text-sm font-medium">
                  Chưa có sản phẩm nào phù hợp được tìm thấy cho bé thú cưng
                  này.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {recommendedProducts.map((p) => {
                    const variant = p.selectedVariant;
                    const price = variant
                      ? (variant.salePrice ?? variant.sellingPrice)
                      : (p.salePrice ?? p.sellingPrice);
                    const originalPrice = variant
                      ? variant.sellingPrice
                      : p.sellingPrice;
                    const isDiscounted = variant
                      ? !!variant.salePrice &&
                        variant.salePrice < variant.sellingPrice
                      : !!p.salePrice && p.salePrice < p.sellingPrice;
                    const imageUrl =
                      variant?.imageUrl || p.imageUrl || "/placeholder.svg";

                    return (
                      <div
                        key={p.id}
                        className="group rounded-2xl border bg-card p-3 shadow-sm hover:shadow-md transition duration-300 flex flex-col justify-between space-y-3 relative"
                      >
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
                            {p.brand || "PetMatch"}
                          </span>
                          <h4
                            className="text-xs font-bold text-foreground line-clamp-2 mt-1 leading-snug group-hover:text-primary transition"
                            title={p.name}
                          >
                            {p.name}
                          </h4>

                          {/* Price */}
                          <div className="flex items-baseline gap-1.5 pt-1">
                            <span className="text-sm font-black text-primary">
                              {price.toLocaleString("vi-VN")}đ
                            </span>
                            {isDiscounted && (
                              <span className="text-[10px] text-muted-foreground line-through font-medium">
                                {originalPrice.toLocaleString("vi-VN")}đ
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Variant Selector Dropdown */}
                        {p.variants && p.variants.length > 0 && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase">
                              Kích cỡ / Phân loại:
                            </label>
                            <select
                              value={variant?.id || ""}
                              onChange={(e) =>
                                handleVariantChange(p.id, e.target.value)
                              }
                              className="w-full rounded-lg border bg-background p-1.5 text-[11px] font-bold outline-none cursor-pointer focus:border-primary"
                            >
                              {p.variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} (
                                  {v.sellingPrice.toLocaleString("vi-VN")}đ)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Action Add To Cart */}
                        <Button
                          size="sm"
                          disabled={
                            variant ? variant.stock <= 0 : (p.stock ?? 0) <= 0
                          }
                          className="w-full rounded-xl font-bold text-xs"
                          onClick={() => {
                            const vId = variant?.id || undefined;
                            addToCart(p, 1, false, vId);
                            toast.success(
                              `Đã thêm sản phẩm "${p.name}${variant ? ` (${variant.name})` : ""}" vào giỏ hàng!`,
                            );
                          }}
                        >
                          {(variant ? variant.stock <= 0 : (p.stock ?? 0) <= 0)
                            ? "Hết hàng"
                            : "Thêm vào giỏ"}
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
