"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Info,
  Loader2,
  MapPin,
  MoreVertical,
  PawPrint,
  Scale,
  ShieldCheck,
  Sparkles,
  Syringe,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { uploadImages, type UploadPurpose } from "@/lib/api/uploads";
import {
  petsApi,
  type Pet,
  type PetDocument,
  type UpdatePetPayload,
} from "@/lib/api/pets";
import { cn } from "@/lib/utils";
import { HanoiWardSelect } from "@/components/hanoi-ward-select";
import { getHanoiWardCoords } from "@/lib/hanoi-wards";
import {
  getPetWeightLimits,
  isPetMatchingWeightEligible,
  isPetProfileWeightValid,
} from "@/lib/pet-options";

type DialogMode = "view" | "edit";

type PetProfileDialogProps = {
  initialPet: Pet;
  open: boolean;
  startInEditMode?: boolean;
  onClose: () => void;
  onPetUpdated: (pet: Pet) => void;
};

type EditForm = {
  name: string;
  weight: string;
  location: string;
  district: string;
  ward: string;
  personality: string;
  isVaccinated: boolean;
  hasPedigree: boolean;
  pedigreeNumber: string;
  avatarUrl: string | null;
  gallery: string[];
  vaccineDocumentUrls: string[];
  pedigreeDocumentUrls: string[];
};

function petDocument(pet: Pet, type: PetDocument["type"]) {
  return (pet.documents ?? []).find((document) => document.type === type);
}

function formFromPet(pet: Pet): EditForm {
  return {
    name: pet.name,
    weight: String(pet.weight),
    location: pet.location,
    district: pet.district ?? "",
    ward: pet.ward ?? "",
    personality: pet.personality ?? "",
    isVaccinated: pet.isVaccinated,
    hasPedigree: pet.hasPedigree,
    pedigreeNumber: pet.pedigreeNumber ?? "",
    avatarUrl: pet.avatarUrl ?? null,
    gallery: pet.gallery ?? [],
    vaccineDocumentUrls: petDocument(pet, "VACCINE_RECORD")?.imageUrls ?? [],
    pedigreeDocumentUrls: petDocument(pet, "PEDIGREE_CERT")?.imageUrls ?? [],
  };
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (
      error as { response?: { data?: { message?: string | string[] } } }
    ).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message[0] ?? fallback;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export function PetProfileDialog({
  initialPet,
  open,
  startInEditMode = false,
  onClose,
  onPetUpdated,
}: PetProfileDialogProps) {
  const [pet, setPet] = useState<Pet>(initialPet);
  const initialMode: DialogMode = startInEditMode ? "edit" : "view";
  const [mode, setMode] = useState<DialogMode>(initialMode);
  const modeRef = useRef<DialogMode>(initialMode);
  const [form, setForm] = useState<EditForm>(() => formFromPet(initialPet));
  const [initialForm, setInitialForm] = useState<EditForm>(() =>
    formFromPet(initialPet),
  );
  const [refreshing, setRefreshing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [discardAction, setDiscardAction] = useState<"close" | "view">("view");

  const dirty = useMemo(
    () =>
      mode === "edit" && JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm, mode],
  );

  useEffect(() => {
    if (!open) return;
    let active = true;

    petsApi
      .getDetail(initialPet.id)
      .then((response) => {
        if (!active) return;
        setPet(response.data);
        if (modeRef.current === "view" || startInEditMode) {
          const nextForm = formFromPet(response.data);
          setForm(nextForm);
          setInitialForm(nextForm);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setRefreshing(false);
      });

    return () => {
      active = false;
    };
  }, [initialPet.id, open, startInEditMode]);

  const requestClose = () => {
    if (dirty) {
      setDiscardAction("close");
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  };

  const beginEdit = () => {
    const nextForm = formFromPet(pet);
    setForm(nextForm);
    setInitialForm(nextForm);
    modeRef.current = "edit";
    setMode("edit");
  };

  const cancelEdit = () => {
    if (dirty) {
      setDiscardAction("view");
      setDiscardConfirmOpen(true);
      return;
    }
    modeRef.current = "view";
    setMode("view");
  };

  const uploadSingleImage = async (
    event: ChangeEvent<HTMLInputElement>,
    purpose: UploadPurpose,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const [uploaded] = await uploadImages([file], purpose);
      setForm((current) => ({ ...current, avatarUrl: uploaded.url }));
    } catch (error) {
      toast.error(
        apiErrorMessage(
          error,
          "Không tải được ảnh. Chỉ chấp nhận JPEG, PNG hoặc WebP tối đa 5 MB.",
        ),
      );
    } finally {
      setUploading(false);
    }
  };

  const uploadGallery = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const remaining = 6 - form.gallery.length;
    if (remaining <= 0) {
      toast.error("Thư viện ảnh chỉ được chứa tối đa 6 ảnh.");
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadImages(
        files.slice(0, remaining),
        "pet-gallery",
      );
      setForm((current) => ({
        ...current,
        gallery: [
          ...current.gallery,
          ...uploaded.map((image) => image.url),
        ].slice(0, 6),
      }));
    } catch (error) {
      toast.error(
        apiErrorMessage(error, "Không tải được thư viện ảnh thú cưng."),
      );
    } finally {
      setUploading(false);
    }
  };

  const uploadDocuments = async (
    event: ChangeEvent<HTMLInputElement>,
    purpose: "vaccine-document" | "pedigree-document",
    field: "vaccineDocumentUrls" | "pedigreeDocumentUrls",
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const remaining = 6 - form[field].length;
    if (remaining <= 0) {
      toast.error("Mỗi loại giấy tờ chỉ được chứa tối đa 6 ảnh.");
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadImages(files.slice(0, remaining), purpose);
      setForm((current) => ({
        ...current,
        [field]: [
          ...current[field],
          ...uploaded.map((image) => image.url),
        ].slice(0, 6),
      }));
    } catch (error) {
      toast.error(apiErrorMessage(error, "Không tải được ảnh giấy tờ."));
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    if (!form.name.trim()) return "Vui lòng nhập tên thú cưng.";
    const weight = Number(form.weight);
    const weightLimits = getPetWeightLimits(pet.species);
    if (!weightLimits || !isPetProfileWeightValid(pet.species, weight)) {
      return `Cân nặng của ${pet.species === "DOG" ? "chó" : "mèo"} phải nằm trong khoảng ${weightLimits?.profileMin ?? 0.2}–${weightLimits?.profileMax ?? 160} kg.`;
    }
    if (!form.location.trim() && !form.ward.trim()) return "Vui lòng chọn Phường / Xã tại Hà Nội.";
    if (!form.avatarUrl && (!form.gallery || form.gallery.length === 0)) {
      return "Hồ sơ thú cưng phải có tối thiểu ít nhất 1 ảnh đại diện hoặc ảnh bộ sưu tập.";
    }
    if (form.personality.length > 500) return "Tính cách tối đa 500 ký tự.";
    return null;
  };

  const saveProfile = async () => {
    if (saving || uploading) return;
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const wardCoords = getHanoiWardCoords(form.ward);

    const payload: UpdatePetPayload = {
      name: form.name.trim(),
      weight: Number(form.weight),
      location: "Hà Nội",
      district: null,
      ward: form.ward.trim() || "Phường Hoàn Kiếm",
      latitude: wardCoords.lat,
      longitude: wardCoords.lng,
      personality: form.personality.trim() || null,
      isVaccinated: form.isVaccinated,
      hasPedigree: form.hasPedigree,
      pedigreeNumber:
        form.hasPedigree && form.pedigreeNumber.trim()
          ? form.pedigreeNumber.trim()
          : null,
      avatarUrl: form.avatarUrl,
      gallery: form.gallery,
      ...(JSON.stringify(form.vaccineDocumentUrls) !==
      JSON.stringify(initialForm.vaccineDocumentUrls)
        ? { vaccineDocumentUrls: form.vaccineDocumentUrls }
        : {}),
      ...(JSON.stringify(form.pedigreeDocumentUrls) !==
      JSON.stringify(initialForm.pedigreeDocumentUrls)
        ? { pedigreeDocumentUrls: form.pedigreeDocumentUrls }
        : {}),
    };

    setSaving(true);
    try {
      const response = await petsApi.update(pet.id, payload);
      setPet(response.data);
      const nextForm = formFromPet(response.data);
      setForm(nextForm);
      setInitialForm(nextForm);
      modeRef.current = "view";
      setMode("view");
      onPetUpdated(response.data);
      toast.success(`Đã cập nhật hồ sơ của ${response.data.name}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Không thể cập nhật hồ sơ thú cưng."));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    const nextStatus: Pet["status"] =
      pet.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";

    try {
      const response = await petsApi.updateAvailability(pet.id, {
        status: nextStatus,
      });
      setPet(response.data);
      const nextForm = formFromPet(response.data);
      setForm(nextForm);
      setInitialForm(nextForm);
      onPetUpdated(response.data);
      toast.success(
        nextStatus === "INACTIVE"
          ? `Đã ẩn hồ sơ của ${pet.name}.`
          : `Đã hiện lại hồ sơ của ${pet.name}.`,
      );
    } catch (error) {
      toast.error(
        apiErrorMessage(error, "Không thể cập nhật trạng thái hồ sơ."),
      );
    } finally {
      setStatusConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => !nextOpen && requestClose()}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[940px] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[940px]"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-xl font-black">
                  <PawPrint className="size-5 text-primary" />
                  {mode === "view"
                    ? "Chi tiết hồ sơ thú cưng"
                    : "Chỉnh sửa hồ sơ thú cưng"}
                </DialogTitle>
                <div className="mt-1 flex items-center gap-2">
                  <DialogDescription>
                    {mode === "view"
                      ? "Thông tin hồ sơ do bạn quản lý."
                      : "Cập nhật thông tin và hình ảnh của thú cưng."}
                  </DialogDescription>
                  {refreshing && mode === "view" && (
                    <Loader2
                      className="size-3.5 animate-spin text-muted-foreground"
                      aria-label="Đang đồng bộ thông tin mới nhất"
                    />
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {mode === "view" && pet.status !== "HIDDEN" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Tùy chọn hồ sơ"
                      >
                        <MoreVertical className="size-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="z-[100] min-w-44"
                    >
                      <DropdownMenuItem
                        variant={
                          pet.status === "INACTIVE" ? "default" : "destructive"
                        }
                        onSelect={() => setStatusConfirmOpen(true)}
                      >
                        {pet.status === "INACTIVE" ? (
                          <Eye className="size-4" />
                        ) : (
                          <EyeOff className="size-4" />
                        )}
                        {pet.status === "INACTIVE"
                          ? "Hiện lại hồ sơ"
                          : "Ẩn hồ sơ"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={requestClose}
                  aria-label="Đóng"
                >
                  <X className="size-5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {mode === "view" ? (
              <PetDetails pet={pet} onPreviewImage={setPreviewImage} />
            ) : (
              <PetEditForm
                pet={pet}
                form={form}
                setForm={setForm}
                uploading={uploading}
                onAvatarUpload={uploadSingleImage}
                onGalleryUpload={uploadGallery}
                onDocumentUpload={uploadDocuments}
                onPreviewImage={setPreviewImage}
              />
            )}
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
            {mode === "view" ? (
              <>
                <Button variant="outline" onClick={requestClose}>
                  Đóng
                </Button>
                <Button className="gap-2 font-bold" onClick={beginEdit}>
                  <Edit3 className="size-4" />
                  Chỉnh sửa hồ sơ
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Hủy chỉnh sửa
                </Button>
                <Button
                  className="gap-2 font-bold"
                  onClick={saveProfile}
                  disabled={saving || uploading || !dirty}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  {saving
                    ? "Đang lưu..."
                    : uploading
                      ? "Đang tải ảnh..."
                      : "Lưu thay đổi"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={statusConfirmOpen} onOpenChange={setStatusConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pet.status === "INACTIVE"
                ? "Hiện lại hồ sơ?"
                : "Ẩn hồ sơ thú cưng?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pet.status === "INACTIVE"
                ? `Hồ sơ của ${pet.name} sẽ xuất hiện trở lại. Trạng thái sẵn sàng ghép đôi vẫn được giữ ở chế độ tắt.`
                : `Hồ sơ của ${pet.name} sẽ không xuất hiện trong kết quả khám phá và không nhận yêu cầu ghép đôi mới. Bạn vẫn có thể xem, chỉnh sửa và hiện lại sau.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={toggleStatus}
              className={cn(
                pet.status !== "INACTIVE" &&
                  "bg-destructive text-white hover:bg-destructive/90",
              )}
            >
              {pet.status === "INACTIVE" ? "Hiện lại hồ sơ" : "Ẩn hồ sơ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ các thay đổi chưa lưu?</AlertDialogTitle>
            <AlertDialogDescription>
              Những thay đổi trong biểu mẫu sẽ không được lưu vào hồ sơ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tiếp tục chỉnh sửa</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardConfirmOpen(false);
                if (discardAction === "close") {
                  onClose();
                  return;
                }
                modeRef.current = "view";
                setMode("view");
                const nextForm = formFromPet(pet);
                setForm(nextForm);
                setInitialForm(nextForm);
              }}
            >
              Bỏ thay đổi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageLightbox
        imageUrl={previewImage}
        alt={`Ảnh của ${pet.name}`}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}

function PetDetails({
  pet,
  onPreviewImage,
}: {
  pet: Pet;
  onPreviewImage: (url: string) => void;
}) {
  const gallery = pet.gallery ?? [];
  const address = [pet.ward, pet.district, pet.location]
    .filter(Boolean)
    .join(", ");
  const vaccineDocument = petDocument(pet, "VACCINE_RECORD");
  const pedigreeDocument = petDocument(pet, "PEDIGREE_CERT");

  const minMonths = pet.species === "CAT" ? 8 : 12;
  const birthday = new Date(pet.birthday);
  const now = new Date();
  let ageMonths = (now.getFullYear() - birthday.getFullYear()) * 12 + now.getMonth() - birthday.getMonth();
  if (now.getDate() < birthday.getDate()) ageMonths -= 1;
  ageMonths = Math.max(0, ageMonths);
  const isUnderage = ageMonths < minMonths;
  const weightLimits = getPetWeightLimits(pet.species);
  const isMatchingWeightEligible = isPetMatchingWeightEligible(
    pet.species,
    pet.weight,
  );
  const eligibleDate = new Date(birthday);
  eligibleDate.setMonth(eligibleDate.getMonth() + minMonths);
  const eligibleDateStr = eligibleDate.toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" });

  return (
    <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => pet.avatarUrl && onPreviewImage(pet.avatarUrl)}
          disabled={!pet.avatarUrl}
          className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-muted text-left disabled:cursor-default"
        >
          <img
            src={pet.avatarUrl || gallery[0] || "/placeholder.svg"}
            alt={pet.name}
            className="size-full object-cover transition-transform group-enabled:hover:scale-105"
          />
          {pet.avatarUrl && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white">
              Xem ảnh
            </span>
          )}
        </button>

        {gallery.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
              Thư viện ảnh ({gallery.length}/6)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((url, index) => (
                <button
                  type="button"
                  key={`${url}-${index}`}
                  onClick={() => onPreviewImage(url)}
                  className="aspect-square overflow-hidden rounded-xl bg-muted ring-primary transition hover:ring-2"
                >
                  <img
                    src={url}
                    alt={`Ảnh ${index + 1} của ${pet.name}`}
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-5">
        {pet.status === "HIDDEN" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-black">Hồ sơ bị quản trị viên ẩn</p>
            <p className="mt-1 font-medium">
              Thú cưng đang tạm dừng hiển thị công khai, ghép đôi và gửi tin nhắn do vi phạm tiêu chuẩn cộng đồng. Chỉ quản trị viên có thể khôi phục hồ sơ.
            </p>
          </div>
        )}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-black">{pet.name}</h2>
            <StatusBadge status={pet.status} />
            {isUnderage ? (
              <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 px-2.5 py-1 text-xs font-black">
                🌱 Đang lớn ({ageMonths} tháng)
              </span>
            ) : !isMatchingWeightEligible ? (
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                ⚖️ Chưa đủ điều kiện cân nặng
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 px-2.5 py-1 text-xs font-black">
                ✨ Đủ tuổi phối giống
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {pet.breed} · {pet.species === "DOG" ? "Chó" : "Mèo"} ·{" "}
            {pet.gender === "MALE" ? "Đực" : "Cái"}
          </p>
        </div>

        {isUnderage ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30 text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2.5">
            <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-extrabold">Độ tuổi an toàn sinh sản</p>
              <p className="mt-0.5 text-blue-700/90 dark:text-blue-300/90 font-medium">
                Bé chưa đạt tuổi phối giống tối thiểu ({minMonths} tháng). Tính năng tìm bạn đời sẽ tự động sẵn sàng vào <strong>Tháng {eligibleDateStr}</strong>.
              </p>
            </div>
          </div>
        ) : !isMatchingWeightEligible && weightLimits ? (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <Scale className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-extrabold">Chưa đủ điều kiện cân nặng để phối giống</p>
              <p className="mt-0.5 font-medium text-amber-700/90 dark:text-amber-300/90">
                Hồ sơ vẫn hoạt động bình thường, nhưng {pet.species === "DOG" ? "chó" : "mèo"} cần từ {weightLimits.matchingMin}-{weightLimits.matchingMax} kg để tham gia matching.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-bold">
            <Sparkles className="size-4 text-emerald-600 shrink-0" />
            <span>Đủ điều kiện tham gia ghép đôi ({breedingSummary(pet)})</span>
          </div>
        )}

        <section className="grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2">
          <DetailItem
            icon={CalendarDays}
            label="Ngày sinh"
            value={`${formatDate(pet.birthday)} (${formatAge(pet.birthday)})`}
          />
          <DetailItem
            icon={Scale}
            label="Cân nặng"
            value={`${pet.weight.toLocaleString("vi-VN")} kg`}
          />
          <DetailItem
            icon={MapPin}
            label="Địa chỉ"
            value={address || "Chưa cập nhật"}
            className="sm:col-span-2"
          />
        </section>

        <section>
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider">
            Sức khỏe và xác minh
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <HealthCard
              icon={Syringe}
              title="Tiêm chủng"
              declared={pet.isVaccinated}
              verified={vaccineDocument?.status === "APPROVED"}
              documentStatus={vaccineDocument?.status}
            />
            <HealthCard
              icon={BadgeCheck}
              title="Phả hệ"
              declared={pet.hasPedigree}
              verified={pedigreeDocument?.status === "APPROVED"}
              documentStatus={pedigreeDocument?.status}
              detail={pet.pedigreeNumber || undefined}
            />
          </div>
        </section>

        <section className="rounded-2xl border p-4">
          <h3 className="mb-2 text-sm font-black uppercase tracking-wider">
            Tính cách
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {pet.personality || "Chưa có mô tả tính cách."}
          </p>
        </section>

        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-primary">
                Cấu hình ghép đôi
              </h3>
              <p className="mt-1 text-sm font-bold">
                {pet.gender === "FEMALE"
                  ? "Tìm bạn đời trong khu vực khám phá"
                  : pet.isAvailableForMatching
                    ? breedingSummary(pet)
                    : "Đang tắt ghép đôi"}
              </p>
            </div>
            <span
              className={cn(
                "size-3 shrink-0 rounded-full",
                pet.isAvailableForMatching ? "bg-emerald-500" : "bg-slate-300",
              )}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function PetEditForm({
  pet,
  form,
  setForm,
  uploading,
  onAvatarUpload,
  onGalleryUpload,
  onDocumentUpload,
  onPreviewImage,
}: {
  pet: Pet;
  form: EditForm;
  setForm: Dispatch<SetStateAction<EditForm>>;
  uploading: boolean;
  onAvatarUpload: (
    event: ChangeEvent<HTMLInputElement>,
    purpose: UploadPurpose,
  ) => void;
  onGalleryUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentUpload: (
    event: ChangeEvent<HTMLInputElement>,
    purpose: "vaccine-document" | "pedigree-document",
    field: "vaccineDocumentUrls" | "pedigreeDocumentUrls",
  ) => void;
  onPreviewImage: (url: string) => void;
}) {
  const vaccineDocument = petDocument(pet, "VACCINE_RECORD");
  const pedigreeDocument = petDocument(pet, "PEDIGREE_CERT");
  const weightLimits = getPetWeightLimits(pet.species);
  const weightNumber = Number(form.weight);
  const hasWeight = form.weight.trim() !== "";
  const profileWeightIsValid =
    hasWeight && isPetProfileWeightValid(pet.species, weightNumber);
  const matchingWeightIsEligible =
    hasWeight && isPetMatchingWeightEligible(pet.species, weightNumber);
  const update = <Key extends keyof EditForm>(key: Key, value: EditForm[Key]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-7 p-5 sm:p-6">
      <section>
        <SectionTitle icon={Camera} title="Hình ảnh thú cưng" />
        <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
          <div>
            <Label className="mb-2 block">Ảnh đại diện</Label>
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
              <button
                type="button"
                onClick={() => form.avatarUrl && onPreviewImage(form.avatarUrl)}
                disabled={!form.avatarUrl}
                className="size-full disabled:cursor-default"
              >
                <img
                  src={form.avatarUrl || "/placeholder.svg"}
                  alt="Ảnh đại diện"
                  className="size-full object-cover"
                />
              </button>
              {form.avatarUrl && (
                <button
                  type="button"
                  onClick={() => update("avatarUrl", null)}
                  className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-destructive text-white shadow"
                  aria-label="Xóa ảnh đại diện"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <label className="mt-2 flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent">
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              Thay ảnh
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(event) => onAvatarUpload(event, "pet-avatar")}
              />
            </label>
          </div>

          <div>
            <Label className="mb-2 block">
              Thư viện ảnh ({form.gallery.length}/6)
            </Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {form.gallery.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
                >
                  <button
                    type="button"
                    className="size-full"
                    onClick={() => onPreviewImage(url)}
                  >
                    <img
                      src={url}
                      alt={`Ảnh thư viện ${index + 1}`}
                      className="size-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "gallery",
                        form.gallery.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                    }
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-destructive text-white shadow"
                    aria-label={`Xóa ảnh ${index + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {form.gallery.length < 6 && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/30 text-xs font-bold text-muted-foreground transition hover:border-primary hover:bg-primary/5">
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ImagePlus className="size-6" />
                  )}
                  Thêm ảnh
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    disabled={uploading}
                    onChange={onGalleryUpload}
                  />
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              JPEG, PNG hoặc WebP; tối đa 5 MB mỗi ảnh.
            </p>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle icon={PawPrint} title="Thông tin cơ bản" />
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Loài, giống, giới tính và ngày sinh là thông tin định danh gắn với
            giấy tờ xác minh nên không thể tự chỉnh sửa. Nếu thông tin sai, vui
            lòng liên hệ hỗ trợ.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên thú cưng" required>
            <Input
              value={form.name}
              maxLength={100}
              onChange={(event) => update("name", event.target.value)}
            />
          </Field>
          <Field label="Giống">
            <Input
              value={pet.breed}
              disabled
              aria-label="Giống thú cưng không thể chỉnh sửa"
            />
          </Field>
          <Field label="Loài">
            <Select
              value={pet.species}
              disabled
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DOG">Chó</SelectItem>
                <SelectItem value="CAT">Mèo</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Giới tính">
            <Select
              value={pet.gender}
              disabled
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Đực</SelectItem>
                <SelectItem value="FEMALE">Cái</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ngày sinh">
            <Input
              type="date"
              value={pet.birthday.slice(0, 10)}
              disabled
              aria-label="Ngày sinh thú cưng không thể chỉnh sửa"
            />
          </Field>
          <Field label="Cân nặng (kg)" required>
            <Input
              type="number"
              min={weightLimits?.profileMin ?? 0.2}
              max={weightLimits?.profileMax ?? 160}
              step="0.1"
              value={form.weight}
              onChange={(event) => update("weight", event.target.value)}
            />
            {hasWeight && weightLimits && !profileWeightIsValid && (
              <p className="text-xs font-bold text-destructive">
                Cân nặng phải từ {weightLimits.profileMin}-{weightLimits.profileMax} kg để lưu hồ sơ.
              </p>
            )}
            {profileWeightIsValid && weightLimits && !matchingWeightIsEligible && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-black">⚠️ Chưa đủ điều kiện cân nặng để phối giống</p>
                <p className="mt-1 font-medium">
                  Thay đổi vẫn được lưu, nhưng thú cưng cần từ {weightLimits.matchingMin}-{weightLimits.matchingMax} kg để tham gia matching. Nếu đang bật ghép đôi, hệ thống sẽ tự tắt.
                </p>
              </div>
            )}
            {matchingWeightIsEligible && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Cân nặng đạt điều kiện tham gia matching.
              </p>
            )}
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle icon={MapPin} title="Địa chỉ & Khu vực tại Hà Nội" />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Phường / Xã nơi bé đang ở (Hệ thống tự động cập nhật toạ độ GPS)
          </Label>
          <HanoiWardSelect
            value={form.ward || form.location}
            onChange={(ward) => {
              update("location", "Hà Nội");
              update("district", "");
              update("ward", ward.name);
            }}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon={ShieldCheck} title="Sức khỏe và tính cách" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <Label htmlFor="edit-vaccinated" className="font-bold">
                Đã tiêm chủng
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Thông tin do chủ nuôi khai báo
              </p>
            </div>
            <Switch
              id="edit-vaccinated"
              checked={form.isVaccinated}
              disabled={vaccineDocument?.status === "APPROVED"}
              onCheckedChange={(checked) => {
                update("isVaccinated", checked);
                if (!checked) update("vaccineDocumentUrls", []);
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <Label htmlFor="edit-pedigree" className="font-bold">
                Có giấy phả hệ
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                VKA, TICA hoặc tương đương
              </p>
            </div>
            <Switch
              id="edit-pedigree"
              checked={form.hasPedigree}
              disabled={pedigreeDocument?.status === "APPROVED"}
              onCheckedChange={(checked) => {
                update("hasPedigree", checked);
                if (!checked) {
                  update("pedigreeNumber", "");
                  update("pedigreeDocumentUrls", []);
                }
              }}
            />
          </div>
          {form.isVaccinated && (
            <DocumentImagesEditor
              title="Ảnh sổ tiêm phòng"
              urls={form.vaccineDocumentUrls}
              document={vaccineDocument}
              verified={vaccineDocument?.status === "APPROVED"}
              uploading={uploading}
              onPreviewImage={onPreviewImage}
              onRemove={(index) =>
                update(
                  "vaccineDocumentUrls",
                  form.vaccineDocumentUrls.filter(
                    (_, currentIndex) => currentIndex !== index,
                  ),
                )
              }
              onUpload={(event) =>
                onDocumentUpload(
                  event,
                  "vaccine-document",
                  "vaccineDocumentUrls",
                )
              }
            />
          )}
          {form.hasPedigree && (
            <>
              <Field label="Mã số phả hệ" className="sm:col-span-2">
                <Input
                  value={form.pedigreeNumber}
                  maxLength={100}
                  disabled={pedigreeDocument?.status === "APPROVED"}
                  onChange={(event) =>
                    update("pedigreeNumber", event.target.value)
                  }
                />
              </Field>
              <DocumentImagesEditor
                title="Ảnh giấy chứng nhận phả hệ"
                urls={form.pedigreeDocumentUrls}
                document={pedigreeDocument}
                verified={pedigreeDocument?.status === "APPROVED"}
                uploading={uploading}
                onPreviewImage={onPreviewImage}
                onRemove={(index) =>
                  update(
                    "pedigreeDocumentUrls",
                    form.pedigreeDocumentUrls.filter(
                      (_, currentIndex) => currentIndex !== index,
                    ),
                  )
                }
                onUpload={(event) =>
                  onDocumentUpload(
                    event,
                    "pedigree-document",
                    "pedigreeDocumentUrls",
                  )
                }
              />
            </>
          )}
          <Field label="Mô tả tính cách" className="sm:col-span-2">
            <Textarea
              rows={4}
              maxLength={500}
              value={form.personality}
              onChange={(event) => update("personality", event.target.value)}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {form.personality.length}/500 ký tự
            </p>
          </Field>
        </div>
      </section>
    </div>
  );
}

function DocumentImagesEditor({
  title,
  urls,
  document,
  verified,
  uploading,
  onPreviewImage,
  onRemove,
  onUpload,
}: {
  title: string;
  urls: string[];
  document?: PetDocument;
  verified: boolean;
  uploading: boolean;
  onPreviewImage: (url: string) => void;
  onRemove: (index: number) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const status = verified ? "APPROVED" : document?.status;
  const statusLabel =
    status === "APPROVED"
      ? "Đã xác minh"
      : status === "REVIEWING"
        ? "Đang xét duyệt"
        : status === "REJECTED"
          ? "Bị từ chối — hãy thay ảnh và gửi lại"
          : status === "NEED_MORE_INFO"
            ? "Cần tải lại giấy tờ"
            : status === "PENDING"
              ? "Đang chờ duyệt"
              : "Chưa gửi xét duyệt";

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4 sm:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="font-bold">{title}</Label>
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              status === "APPROVED"
                ? "text-emerald-600"
                : status === "REJECTED"
                  ? "text-destructive"
                  : status === "NEED_MORE_INFO"
                    ? "text-slate-500"
                    : "text-muted-foreground",
            )}
          >
            {statusLabel}
          </p>
        </div>
        {verified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <BadgeCheck className="size-3.5" />
            Đã khóa sau xác minh
          </span>
        )}
      </div>

      {document?.reviewNote && !verified && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Phản hồi từ người xét duyệt: {document.reviewNote}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {urls.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="relative aspect-square overflow-hidden rounded-xl border bg-background"
          >
            <button
              type="button"
              className="size-full"
              onClick={() => onPreviewImage(url)}
            >
              <img
                src={url}
                alt={`${title} ${index + 1}`}
                className={cn(
                  "size-full object-cover",
                  status !== "APPROVED" && "grayscale opacity-70",
                )}
              />
            </button>
            {!verified && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-destructive text-white shadow"
                aria-label={`Xóa ảnh giấy tờ ${index + 1}`}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}

        {!verified && urls.length < 6 && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/30 px-2 text-center text-xs font-bold text-muted-foreground transition hover:border-primary hover:bg-primary/5">
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-6" />
            )}
            {urls.length ? "Thêm trang" : "Tải giấy tờ"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={onUpload}
            />
          </label>
        )}
      </div>

      {!verified && (
        <p className="text-xs text-muted-foreground">
          Có thể thay hoặc bổ sung tối đa 6 ảnh. Khi lưu, giấy tờ sẽ được gửi
          lại để xét duyệt.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>
        {label}
        {required && <span className="text-destructive font-bold ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof PawPrint;
  title: string;
}) {
  return (
    <h3 className="mb-4 flex items-center gap-2 border-b pb-2 text-base font-black">
      <Icon className="size-4 text-primary" />
      {title}
    </h3>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof PawPrint;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function HealthCard({
  icon: Icon,
  title,
  declared,
  verified,
  documentStatus,
  detail,
}: {
  icon: typeof PawPrint;
  title: string;
  declared: boolean;
  verified: boolean;
  documentStatus?: PetDocument["status"];
  detail?: string;
}) {
  const needsReupload = documentStatus === "NEED_MORE_INFO";
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-black">{title}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">
        {declared ? "Đã khai báo" : "Chưa khai báo"}
      </p>
      {(declared || needsReupload) && (
        <p
          className={cn(
            "mt-1 text-xs font-bold",
            verified
              ? "text-emerald-600"
              : needsReupload
                ? "text-slate-500"
                : "text-amber-600",
          )}
        >
          {verified
            ? "Đã xác minh"
            : needsReupload
              ? "Cần tải lại giấy tờ"
              : "Đang chờ xác minh"}
        </p>
      )}
      {detail && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          Mã: {detail}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Pet["status"] }) {
  const label =
    status === "HIDDEN"
      ? "Bị quản trị viên ẩn"
      : status === "ACTIVE"
        ? "Hoạt động"
        : "Đã tự ẩn";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-black",
        status === "ACTIVE" && "bg-emerald-100 text-emerald-700",
        status === "HIDDEN" && "bg-rose-100 text-rose-700",
        status === "INACTIVE" && "bg-slate-100 text-slate-600",
      )}
    >
      {label}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function formatAge(value: string) {
  const birthday = new Date(value);
  const now = new Date();
  if (birthday > now) return "Ngày không hợp lệ";
  let months =
    (now.getFullYear() - birthday.getFullYear()) * 12 +
    now.getMonth() -
    birthday.getMonth();
  if (now.getDate() < birthday.getDate()) months -= 1;
  months = Math.max(0, months);
  if (months === 0) {
    const diffDays = Math.floor(
      (now.getTime() - birthday.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 0) return "Hôm nay";
    return `${diffDays} ngày tuổi (Sơ sinh)`;
  }
  if (months < 12) return `${months} tháng tuổi`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths
    ? `${years} tuổi ${remainingMonths} tháng`
    : `${years} tuổi`;
}

function breedingSummary(pet: Pet) {
  if (pet.breedingOption === "CASH") {
    return `Thu tiền mặt · ${(pet.breedingFee ?? 0).toLocaleString("vi-VN")} VNĐ`;
  }
  if (pet.breedingOption === "SHARE_LITTER") {
    return `Chia con non · ${pet.shareLitterCount ?? 1} con`;
  }
  return "Thỏa thuận trực tiếp";
}
