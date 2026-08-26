"use client";

import { useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  Eye,
  Heart,
  Info,
  MapPin,
  PawPrint,
  Scale,
  ShieldCheck,
  Sparkles,
  Syringe,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import type { Pet, PetDocument } from "@/lib/api/pets";
import { cn } from "@/lib/utils";

export type PetWithOwner = Pet & {
  owner?: {
    id?: string;
    name: string;
    avatarUrl?: string | null;
  };
};

type PetPublicProfileDialogProps = {
  pet: PetWithOwner | null;
  open: boolean;
  onClose: () => void;
  requestNote?: string | null;
  requestAction?: {
    onAccept?: () => void;
    onReject?: () => void;
    acceptDisabled?: boolean;
  };
};

function petDocument(pet: PetWithOwner, type: PetDocument["type"]) {
  return (pet.documents ?? []).find((document) => document.type === type);
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function formatAge(value?: string | null) {
  if (!value) return "Chưa rõ";
  const birthday = new Date(value);
  const now = new Date();
  let months =
    (now.getFullYear() - birthday.getFullYear()) * 12 +
    now.getMonth() -
    birthday.getMonth();
  if (now.getDate() < birthday.getDate()) months -= 1;
  months = Math.max(0, months);
  if (months < 12) return `${months} tháng tuổi`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths
    ? `${years} tuổi ${remainingMonths} tháng`
    : `${years} tuổi`;
}

function getPetBreedingStatus(pet: PetWithOwner) {
  const minMonths = pet.species === "CAT" ? 8 : 12;
  const birthday = new Date(pet.birthday);
  const now = new Date();
  let ageMonths =
    (now.getFullYear() - birthday.getFullYear()) * 12 +
    now.getMonth() -
    birthday.getMonth();
  if (now.getDate() < birthday.getDate()) ageMonths -= 1;
  ageMonths = Math.max(0, ageMonths);
  const isUnderage = ageMonths < minMonths;
  const eligibleDate = new Date(birthday);
  eligibleDate.setMonth(eligibleDate.getMonth() + minMonths);
  const eligibleDateStr = eligibleDate.toLocaleDateString("vi-VN", {
    month: "2-digit",
    year: "numeric",
  });
  return { isUnderage, ageMonths, minMonths, eligibleDateStr };
}

export function PetPublicProfileDialog({
  pet,
  open,
  onClose,
  requestNote,
  requestAction,
}: PetPublicProfileDialogProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!pet) return null;

  const gallery = pet.gallery ?? [];
  const heroImage = pet.avatarUrl || gallery[0] || "/placeholder.svg";
  const address = [pet.ward, pet.district, pet.location]
    .filter(Boolean)
    .join(", ");
  const vaccineDoc = petDocument(pet, "VACCINE_RECORD");
  const pedigreeDoc = petDocument(pet, "PEDIGREE_CERT");
  const breedingStatus = getPetBreedingStatus(pet);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[880px] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[880px]"
        >
          {/* Header */}
          <DialogHeader className="shrink-0 border-b bg-background/80 backdrop-blur-md px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-xl font-black">
                  <PawPrint className="size-5 text-primary" />
                  Hồ sơ Thú cưng · {pet.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Xem thông tin chi tiết, thể trạng, tiêm chủng và phả hệ của bé.
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="size-8 rounded-full"
                aria-label="Đóng"
              >
                <X className="size-5" />
              </Button>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
              {/* Left Column: Photos */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setPreviewImage(heroImage)}
                  className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-muted text-left cursor-pointer"
                >
                  <img
                    src={heroImage}
                    alt={pet.name}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-xs">
                    🔍 Xem ảnh lớn
                  </span>
                </button>

                {gallery.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Thư viện ảnh ({gallery.length})
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {gallery.map((url, idx) => (
                        <button
                          key={`${url}-${idx}`}
                          type="button"
                          onClick={() => setPreviewImage(url)}
                          className="aspect-square overflow-hidden rounded-xl bg-muted ring-primary transition hover:ring-2 cursor-pointer"
                        >
                          <img
                            src={url}
                            alt={`Ảnh ${idx + 1} của ${pet.name}`}
                            className="size-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Owner Information Card */}
                {pet.owner && (
                  <div className="rounded-2xl border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <User className="size-3.5 text-primary" /> Chủ sở hữu
                    </div>
                    <div className="flex items-center gap-3">
                      <img
                        src={pet.owner.avatarUrl || "/placeholder.svg"}
                        alt={pet.owner.name}
                        className="size-10 rounded-full border object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-sm truncate">
                          {pet.owner.name}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          Thành viên PetMatch
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Bio & Vital Stats */}
              <div className="min-w-0 space-y-5">
                {/* Pet Name & Badges */}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl sm:text-3xl font-black">{pet.name}</h2>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-black text-white",
                        pet.gender === "MALE" ? "bg-blue-600" : "bg-pink-600",
                      )}
                    >
                      {pet.gender === "MALE" ? "♂ Đực" : "♀ Cái"}
                    </span>
                    {breedingStatus.isUnderage ? (
                      <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 px-2.5 py-0.5 text-xs font-black">
                        🌱 Đang lớn ({breedingStatus.ageMonths} th)
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 px-2.5 py-0.5 text-xs font-black">
                        ✨ Sẵn sàng phối giống
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    {pet.breed} · {pet.species === "DOG" ? "Chó" : "Mèo"}
                  </p>
                </div>

                {/* Request Note Box if provided */}
                {requestNote && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-black text-primary uppercase tracking-wider">
                      💌 Lời nhắn ghép đôi
                    </div>
                    <p className="text-sm italic text-foreground font-medium">
                      &ldquo;{requestNote}&rdquo;
                    </p>
                  </div>
                )}

                {/* Breeding Age Notice if underage */}
                {breedingStatus.isUnderage && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30 text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2.5">
                    <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-extrabold">Độ tuổi an toàn sinh sản</p>
                      <p className="mt-0.5 text-blue-700/90 dark:text-blue-300/90 font-medium">
                        Bé hiện {formatAge(pet.birthday)} (chưa đạt {breedingStatus.minMonths} tháng tuổi). Dự kiến đủ tuổi an toàn vào <strong>Tháng {breedingStatus.eligibleDateStr}</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Vital Stats Grid */}
                <section className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
                      <CalendarDays className="size-3.5 text-primary" /> Ngày sinh / Độ tuổi
                    </span>
                    <p className="text-sm font-black">
                      {formatDate(pet.birthday)} ({formatAge(pet.birthday)})
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
                      <Scale className="size-3.5 text-primary" /> Cân nặng
                    </span>
                    <p className="text-sm font-black">
                      {pet.weight ? `${pet.weight.toLocaleString("vi-VN")} kg` : "Chưa rõ"}
                    </p>
                  </div>

                  <div className="sm:col-span-2 space-y-0.5">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground">
                      <MapPin className="size-3.5 text-primary" /> Khu vực sinh sống
                    </span>
                    <p className="text-sm font-bold text-foreground">
                      {address || "Hà Nội"}
                    </p>
                  </div>
                </section>

                {/* Health & Verification */}
                <section className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Sức khỏe & Phả hệ
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Vaccination Card */}
                    <div className="rounded-2xl border p-3.5 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-extrabold">
                          <Syringe className="size-4 text-blue-600" /> Tiêm chủng y tế
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-black",
                            vaccineDoc?.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : pet.isVaccinated
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600",
                          )}
                        >
                          {vaccineDoc?.status === "APPROVED"
                            ? "Đã kiểm định"
                            : pet.isVaccinated
                            ? "Đã khai báo"
                            : "Chưa tiêm"}
                        </span>
                      </div>
                      {vaccineDoc?.imageUrls && vaccineDoc.imageUrls.length > 0 && (
                        <div className="pt-1 flex items-center gap-2">
                          {vaccineDoc.imageUrls.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setPreviewImage(url)}
                              className="size-10 rounded-lg border overflow-hidden hover:opacity-80 transition cursor-pointer"
                            >
                              <img src={url} alt="Sổ tiêm" className="size-full object-cover" />
                            </button>
                          ))}
                          <span className="text-[11px] text-muted-foreground font-semibold">Xem sổ tiêm</span>
                        </div>
                      )}
                    </div>

                    {/* Pedigree Card */}
                    <div className="rounded-2xl border p-3.5 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-extrabold">
                          <BadgeCheck className="size-4 text-amber-600" /> Giấy phả hệ VKA
                        </span>
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-black",
                            pedigreeDoc?.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : pet.hasPedigree
                              ? "bg-amber-50 text-amber-800"
                              : "bg-gray-100 text-gray-600",
                          )}
                        >
                          {pedigreeDoc?.status === "APPROVED"
                            ? "Đã kiểm định VKA"
                            : pet.hasPedigree
                            ? "Có giấy VKA"
                            : "Không có giấy"}
                        </span>
                      </div>
                      {pet.pedigreeNumber && (
                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                          Mã số: {pet.pedigreeNumber}
                        </p>
                      )}
                      {pedigreeDoc?.imageUrls && pedigreeDoc.imageUrls.length > 0 && (
                        <div className="pt-1 flex items-center gap-2">
                          {pedigreeDoc.imageUrls.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setPreviewImage(url)}
                              className="size-10 rounded-lg border overflow-hidden hover:opacity-80 transition cursor-pointer"
                            >
                              <img src={url} alt="Phả hệ" className="size-full object-cover" />
                            </button>
                          ))}
                          <span className="text-[11px] text-muted-foreground font-semibold">Xem giấy phả hệ</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Personality */}
                {pet.personality && (
                  <section className="rounded-2xl border p-4 bg-muted/10 space-y-1.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Tính cách & Thói quen
                    </h3>
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {pet.personality}
                    </p>
                  </section>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
            <div className="flex w-full items-center justify-between gap-3">
              <Button variant="outline" className="rounded-xl font-bold" onClick={onClose}>
                Đóng
              </Button>

              {requestAction && (
                <div className="flex items-center gap-2">
                  {requestAction.onReject && (
                    <Button
                      variant="outline"
                      className="rounded-xl font-bold text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        requestAction.onReject?.();
                        onClose();
                      }}
                    >
                      <X className="mr-1.5 size-4" /> Từ chối
                    </Button>
                  )}
                  {requestAction.onAccept && (
                    <Button
                      disabled={requestAction.acceptDisabled}
                      className="rounded-xl font-bold shadow-md shadow-primary/20"
                      onClick={() => {
                        requestAction.onAccept?.();
                        onClose();
                      }}
                    >
                      <Check className="mr-1.5 size-4" /> Chấp nhận ghép đôi
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageLightbox
        imageUrl={previewImage}
        alt={`Ảnh của ${pet.name}`}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}
