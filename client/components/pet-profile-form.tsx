"use client"

import { useState, useEffect } from "react"
import { Award, Camera, Cat, Check, ChevronLeft, ChevronRight, Dog, ImagePlus, Info, Minus, Plus, Scale, Sparkles, Syringe, X, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import api from "@/lib/axios"
import {
  breedingOptions,
  catBreeds,
  dogBreeds,
  getPetWeightLimits,
  isPetMatchingWeightEligible,
  isPetProfileWeightValid,
} from "@/lib/pet-options"
import { cn } from "@/lib/utils"
import { uploadImages, type UploadPurpose } from "@/lib/api/uploads"
import { HanoiWardSelect } from "@/components/hanoi-ward-select"

interface PetProfileFormProps {
  onComplete?: () => void
}

export function PetProfileForm({ onComplete }: PetProfileFormProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: "",
    species: "" as "dog" | "cat" | "",
    breed: "",
    gender: "" as "male" | "female" | "",
    birthday: "",
    weight: "",
    isVaccinated: false,
    hasPedigree: false,
    pedigreeNumber: "",
    personality: "",
    breedingOption: "",
    breedingPrice: "",
    location: "",
  })
  const [avatar, setAvatar] = useState<string | null>(null)
  const [gallery, setGallery] = useState<string[]>([])
  const [vaccinePhotos, setVaccinePhotos] = useState<string[]>([])
  const [pedigreePhotos, setPedigreePhotos] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [submitError, setSubmitError] = useState("")

  // Location state (Hà Nội Wards)
  const [selectedWard, setSelectedWard] = useState<{ name: string; lat: number; lng: number } | null>({
    name: 'Phường Hoàn Kiếm',
    lat: 21.0285,
    lng: 105.8542,
  })

  const [dbBreeds, setDbBreeds] = useState<string[]>([])
  const [isCustomBreed, setIsCustomBreed] = useState(false)
  const [customBreedInput, setCustomBreedInput] = useState("")

  useEffect(() => {
    if (!formData.species) return
    const species = formData.species.toUpperCase()
    api
      .get<{ id: string; name: string }[]>('/breeds', { params: { species } })
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setDbBreeds(res.data.map((b) => b.name))
        } else {
          setDbBreeds(formData.species === "dog" ? dogBreeds : catBreeds)
        }
      })
      .catch(() => {
        setDbBreeds(formData.species === "dog" ? dogBreeds : catBreeds)
      })
  }, [formData.species])

  const breeds = dbBreeds.length > 0 ? dbBreeds : (formData.species === "dog" ? dogBreeds : formData.species === "cat" ? catBreeds : [])

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
    purpose: UploadPurpose,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setSubmitError("")
    try {
      const [image] = await uploadImages([file], purpose)
      setter(image.url)
    } catch {
      setSubmitError("Không tải được ảnh. Chỉ chấp nhận JPEG, PNG hoặc WebP, tối đa 5MB.")
    } finally {
      setIsUploading(false)
      event.target.value = ""
    }
  }

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setIsUploading(true)
    setSubmitError("")
    try {
      const uploaded = await uploadImages(files.slice(0, 6 - gallery.length), "pet-gallery")
      setGallery((current) => [...current, ...uploaded.map((image) => image.url)])
    } catch {
      setSubmitError("Không tải được thư viện ảnh. Mỗi ảnh phải nhỏ hơn 5MB.")
    } finally {
      setIsUploading(false)
      event.target.value = ""
    }
  }

  const removeGalleryImage = (index: number) => {
    setGallery(gallery.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleMultiDocUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    setPhotos: React.Dispatch<React.SetStateAction<string[]>>,
    purpose: UploadPurpose,
    currentCount: number,
    maxCount = 4,
  ) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    setIsUploading(true)
    setSubmitError("")
    try {
      const remainingSlots = Math.max(0, maxCount - currentCount)
      const uploaded = await uploadImages(files.slice(0, remainingSlots), purpose)
      setPhotos((current) => [...current, ...uploaded.map((image) => image.url)].slice(0, maxCount))
    } catch {
      setSubmitError("Không tải được ảnh giấy tờ. Vui lòng thử lại (ảnh tối đa 5MB).")
    } finally {
      setIsUploading(false)
      event.target.value = ""
    }
  }

  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [activePreset, setActivePreset] = useState<number | null>(null)

  const setAgePreset = (months: number) => {
    setActivePreset(months)
    const targetDate = new Date()
    targetDate.setMonth(targetDate.getMonth() - months)
    const yyyy = targetDate.getFullYear()
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0")
    const dd = String(targetDate.getDate()).padStart(2, "0")
    setFormData((prev) => ({ ...prev, birthday: `${yyyy}-${mm}-${dd}` }))
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setActivePreset(null)
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, "0")
      const dd = String(date.getDate()).padStart(2, "0")
      setFormData((prev) => ({ ...prev, birthday: `${yyyy}-${mm}-${dd}` }))
      setIsCalendarOpen(false)
    }
  }

  const formatBirthdayDisplay = (dateStr: string) => {
    if (!dateStr) return "Chọn ngày sinh của bé..."
    const [yyyy, mm, dd] = dateStr.split("-")
    if (!yyyy || !mm || !dd) return dateStr
    return `Ngày ${dd}/${mm}/${yyyy}`
  }

  const calculateAge = () => {
    if (!formData.birthday) return ""
    const birthday = new Date(formData.birthday)
    const now = new Date()

    if (birthday > now) {
      return "Ngày trong tương lai"
    }

    let months = (now.getFullYear() - birthday.getFullYear()) * 12 + (now.getMonth() - birthday.getMonth())
    if (now.getDate() < birthday.getDate()) months -= 1
    months = Math.max(0, months)

    if (months === 0) {
      const diffDays = Math.floor((now.getTime() - birthday.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays <= 0) return "Hôm nay"
      return `${diffDays} ngày tuổi (Sơ sinh)`
    }

    if (months < 12) {
      return `${months} tháng tuổi`
    }

    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    return remainingMonths === 0 ? `${years} tuổi` : `${years} tuổi ${remainingMonths} tháng`
  }

  const getAgeInMonths = () => {
    if (!formData.birthday) return null
    const birthday = new Date(formData.birthday)
    const now = new Date()
    if (birthday > now) return null
    let months = (now.getFullYear() - birthday.getFullYear()) * 12 + (now.getMonth() - birthday.getMonth())
    if (now.getDate() < birthday.getDate()) months -= 1
    return Math.max(0, months)
  }

  const minBreedingAgeMonths = formData.species === "cat" ? 8 : 12
  const currentAgeMonths = getAgeInMonths()
  const isUnderage = currentAgeMonths !== null && currentAgeMonths < minBreedingAgeMonths
  const weightLimits = getPetWeightLimits(formData.species)
  const weightNumber = Number(formData.weight)
  const hasWeight = formData.weight.trim() !== ""
  const profileWeightIsValid = hasWeight && isPetProfileWeightValid(formData.species, weightNumber)
  const matchingWeightIsEligible = hasWeight && isPetMatchingWeightEligible(formData.species, weightNumber)

  const getEligibleDate = () => {
    if (!formData.birthday) return ""
    const birthday = new Date(formData.birthday)
    const eligibleDate = new Date(birthday)
    eligibleDate.setMonth(eligibleDate.getMonth() + minBreedingAgeMonths)
    return eligibleDate.toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" })
  }

  const getWeightClassification = () => {
    const weightNum = parseFloat(formData.weight)
    if (isNaN(weightNum) || weightNum <= 0) return null

    if (formData.species === "cat") {
      if (weightNum < 3) return { label: "🐾 Mèo nhỏ / Nhẹ cân", color: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900" }
      if (weightNum <= 5.5) return { label: "🐾 Mèo tiêu chuẩn", color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900" }
      if (weightNum <= 8) return { label: "🐾 Mèo mập / Khung to", color: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900" }
      return { label: "🐾 Mèo ngoại cỡ (Maine Coon/XL)", color: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-900" }
    }
    // Dog
    if (weightNum < 5) return { label: "🐾 Vóc siêu nhỏ (Toy/Mini)", color: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/40 dark:border-blue-900" }
    if (weightNum <= 12) return { label: "🐾 Vóc nhỏ (Small)", color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900" }
    if (weightNum <= 25) return { label: "🐾 Vóc trung bình (Medium)", color: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900" }
    if (weightNum <= 45) return { label: "🐾 Vóc lớn (Large)", color: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/40 dark:border-orange-900" }
    return { label: "🐾 Khổng lồ (Giant/XL)", color: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/40 dark:border-purple-900" }
  }

  const adjustWeight = (delta: number) => {
    if (!weightLimits) return
    const current = parseFloat(formData.weight) || (formData.species === "cat" ? 4 : 10)
    const next = Math.max(
      weightLimits.profileMin,
      Math.min(weightLimits.profileMax, Math.round((current + delta) * 10) / 10),
    )
    setFormData((prev) => ({ ...prev, weight: String(next) }))
  }

  const canProceed = () => {
    if (step === 1) {
      const breedValid = isCustomBreed ? customBreedInput.trim().length > 0 : !!formData.breed
      return formData.name.trim().length > 0 && formData.species && breedValid && formData.gender && !!avatar
    }
    if (step === 2) {
      const isBirthdayValid = formData.birthday
        ? new Date(formData.birthday) <= new Date() && (new Date().getTime() - new Date(formData.birthday).getTime()) / (1000 * 60 * 60 * 24 * 365) <= 30
        : false;
      return isBirthdayValid && profileWeightIsValid && !!selectedWard
    }
    return true
  }

  const handleSubmit = async () => {
    if (isSubmitting || isUploading) return

    if (!avatar && gallery.length === 0) {
      setSubmitError("Vui lòng tải lên ít nhất 1 ảnh đại diện của bé.")
      setStep(1)
      return
    }

    if (formData.isVaccinated && vaccinePhotos.length === 0) {
      setSubmitError("Vui lòng tải ít nhất 1 ảnh sổ tiêm phòng để gửi xác minh.")
      setStep(2)
      return
    }
    if (formData.hasPedigree && pedigreePhotos.length === 0) {
      setSubmitError("Vui lòng tải ít nhất 1 ảnh giấy tờ phả hệ để gửi xác minh.")
      setStep(2)
      return
    }

    const species = formData.species === "dog" ? "DOG" : "CAT"
    const gender = formData.gender === "male" ? "MALE" : "FEMALE"
    const finalBreed = isCustomBreed ? customBreedInput.trim() : formData.breed

    const breedingOptionMap: Record<string, string> = {
      cash: "CASH",
      share: "SHARE_LITTER",
      negotiate: "NEGOTIATE",
    }

    setIsSubmitting(true)
    setSubmitError("")

    const finalLocation = "Hà Nội"
    const finalWard = selectedWard?.name || "Phường Hoàn Kiếm"
    const latitude = selectedWard?.lat ?? 21.0285
    const longitude = selectedWard?.lng ?? 105.8542

    try {
      await api.post("/pets", {
        name: formData.name.trim(),
        species,
        breed: finalBreed,
        gender,
        birthday: formData.birthday,
        weight: Number(formData.weight),
        location: finalLocation,
        district: undefined,
        ward: finalWard,
        latitude,
        longitude,
        avatarUrl: avatar || undefined,
        gallery,
        personality: formData.personality.trim() || undefined,
        isVaccinated: formData.isVaccinated,
        hasPedigree: formData.hasPedigree,
        pedigreeNumber: formData.pedigreeNumber.trim() || undefined,
        vaccineDocumentUrls: vaccinePhotos.length > 0 ? vaccinePhotos : undefined,
        vaccineNote: formData.isVaccinated ? "Đã tiêm đủ 3 mũi cơ bản" : undefined,
        pedigreeDocumentUrls: pedigreePhotos.length > 0 ? pedigreePhotos : undefined,
        pedigreeNote: formData.pedigreeNumber.trim() || "Giấy tờ phả hệ VKA/TICA",
        breedingOption: gender === "MALE" ? breedingOptionMap[formData.breedingOption] || undefined : undefined,
        breedingFee: gender === "MALE" && formData.breedingPrice ? Number(formData.breedingPrice) : undefined,
      })
      onComplete?.()
    } catch {
      setSubmitError("Không tạo được hồ sơ. Vui lòng kiểm tra backend và đăng nhập lại nếu cần.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    { number: 1, title: "Thông tin cơ bản" },
    { number: 2, title: "Chỉ số & Sức khỏe" },
    { number: 3, title: "Hình ảnh & Yêu cầu" },
  ]

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((currentStep, index) => (
          <div key={currentStep.number} className="flex items-center">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-full font-semibold transition-all",
                step >= currentStep.number ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {step > currentStep.number ? <Check className="size-5" /> : currentStep.number}
            </div>
            <span className={cn("ml-2 hidden text-sm font-medium sm:inline", step >= currentStep.number ? "text-foreground" : "text-muted-foreground")}>
              {currentStep.title}
            </span>
            {index < steps.length - 1 && (
              <div className={cn("mx-3 h-1 w-12 rounded", step > currentStep.number ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        ))}
      </div>

      <Card className="border-0 shadow-xl">
        <CardContent className="p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="mb-6 text-center text-2xl font-bold">Thông tin cơ bản</h2>

              <div className="flex flex-col items-center justify-center space-y-2">
                <label className="group relative cursor-pointer">
                  <div
                    className={cn(
                      "flex size-32 items-center justify-center overflow-hidden rounded-full border-4 border-dashed transition-all group-hover:border-primary/60",
                      avatar ? "border-solid border-primary" : "border-primary/40 bg-muted/30",
                    )}
                  >
                    {avatar ? (
                      <img src={avatar} alt="Ảnh đại diện thú cưng" className="size-full object-cover" />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Camera className="mx-auto mb-1 size-8 text-primary/70" />
                        <span className="text-xs font-bold text-foreground">Tải ảnh</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 flex size-10 items-center justify-center rounded-full bg-primary shadow-lg">
                    <Camera className="size-5 text-primary-foreground" />
                  </div>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={isUploading} onChange={(event) => handleImageUpload(event, setAvatar, "pet-avatar")} />
                </label>
                <div className="text-center">
                  <span className="text-xs font-bold text-foreground">
                    Ảnh đại diện của bé <span className="text-destructive">*</span>
                  </span>
                  {!avatar && (
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                      Bắt buộc tối thiểu 1 ảnh chân dung rõ nét
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Tên của bé <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Ví dụ: Đậu Đậu"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Loài <span className="text-destructive font-bold">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, species: "dog", breed: "" })}
                    className={cn(
                      "flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all",
                      formData.species === "dog" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                    )}
                  >
                    <Dog className={cn("size-12", formData.species === "dog" ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("font-semibold", formData.species === "dog" ? "text-primary" : "text-foreground")}>Chó</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, species: "cat", breed: "" })}
                    className={cn(
                      "flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all",
                      formData.species === "cat" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                    )}
                  >
                    <Cat className={cn("size-12", formData.species === "cat" ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("font-semibold", formData.species === "cat" ? "text-primary" : "text-foreground")}>Mèo</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="breed">
                  Giống <span className="text-destructive font-bold">*</span>
                </Label>
                <Select
                  value={isCustomBreed ? "OTHER" : formData.breed}
                  onValueChange={(value) => {
                    if (value === "OTHER") {
                      setIsCustomBreed(true)
                      setFormData({ ...formData, breed: "" })
                    } else {
                      setIsCustomBreed(false)
                      setFormData({ ...formData, breed: value })
                    }
                  }}
                  disabled={!formData.species}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.species ? "Chọn giống" : "Vui lòng chọn loài trước"} />
                  </SelectTrigger>
                  <SelectContent>
                    {breeds.map((breed) => (
                      <SelectItem key={breed} value={breed}>
                        {breed}
                      </SelectItem>
                    ))}
                    <SelectItem value="OTHER">✨ Giống khác (Nhập thủ công)</SelectItem>
                  </SelectContent>
                </Select>

                {isCustomBreed && (
                  <div className="mt-2 space-y-1">
                    <Label htmlFor="customBreedInput" className="text-xs font-semibold text-primary">Tên giống của bé</Label>
                    <Input
                      id="customBreedInput"
                      placeholder="Ví dụ: Puggle, Phốc sóc lai..."
                      value={customBreedInput}
                      onChange={(e) => setCustomBreedInput(e.target.value)}
                      className="border-primary/50 focus:border-primary"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Giới tính <span className="text-destructive font-bold">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: "male" })}
                    className={cn(
                      "rounded-xl border-2 p-4 font-semibold transition-all",
                      formData.gender === "male" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50",
                    )}
                  >
                    ♂ Đực
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      gender: "female",
                      breedingOption: "",
                      breedingPrice: "",
                    })}
                    className={cn(
                      "rounded-xl border-2 p-4 font-semibold transition-all",
                      formData.gender === "female" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50",
                    )}
                  >
                    ♀ Cái
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>
                  Vui lòng kiểm tra kỹ loài, giống, giới tính và ngày sinh. Đây là
                  thông tin định danh dùng để đối chiếu giấy tờ và bạn sẽ không thể
                  tự chỉnh sửa sau khi tạo hồ sơ.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="mb-6 text-center text-2xl font-bold">Chỉ số & Sức khỏe</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="birthday" className="text-sm font-bold">
                    Ngày sinh <span className="text-destructive font-bold">*</span>
                  </Label>
                  {formData.birthday && (
                    <span className={cn(
                      "text-xs font-black px-2.5 py-0.5 rounded-full border",
                      new Date(formData.birthday) > new Date()
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : "bg-primary/10 text-primary border-primary/20"
                    )}>
                      {new Date(formData.birthday) > new Date() ? "⚠️ Ngày không hợp lệ" : `✨ ${calculateAge()}`}
                    </span>
                  )}
                </div>

                {/* Quick Age Presets */}
                <div className="space-y-1.5 rounded-2xl bg-muted/40 p-3 border border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                      <Sparkles className="size-3 text-primary" /> Bạn chỉ nhớ số tháng/tuổi? Chọn nhanh:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      { label: "🍼 2 tháng", months: 2 },
                      { label: "4 tháng", months: 4 },
                      { label: "6 tháng", months: 6 },
                      { label: "8 tháng", months: 8 },
                      { label: "1 tuổi", months: 12 },
                      { label: "2 tuổi", months: 24 },
                      { label: "3 tuổi", months: 36 },
                      { label: "5 tuổi", months: 60 },
                    ].map((preset) => (
                      <button
                        key={preset.months}
                        type="button"
                        onClick={() => setAgePreset(preset.months)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer",
                          activePreset === preset.months
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background text-muted-foreground border-border/80 hover:border-primary/50 hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DatePicker Popover with Calendar */}
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between h-12 px-4 rounded-xl border bg-background text-sm font-bold shadow-xs transition-all hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer",
                        !formData.birthday ? "text-muted-foreground font-medium" : "text-foreground border-primary/40"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <CalendarIcon className="size-4" />
                        </div>
                        <span className="text-sm font-bold">
                          {formatBirthdayDisplay(formData.birthday)}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                        {formData.birthday ? "Đổi ngày" : "Mở lịch chọn"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border border-border/80 z-[100]" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.birthday ? new Date(formData.birthday) : undefined}
                      onSelect={handleCalendarSelect}
                      disabled={(date) => date > new Date() || date < new Date("1995-01-01")}
                      captionLayout="dropdown"
                      startMonth={new Date(1995, 0)}
                      endMonth={new Date()}
                      className="rounded-2xl p-3"
                    />
                  </PopoverContent>
                </Popover>

                {/* Underage info card */}
                {formData.birthday && isUnderage && currentAgeMonths !== null && new Date(formData.birthday) <= new Date() && (
                  <div className="mt-2 rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30 space-y-1">
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-extrabold text-xs">
                      <Info className="size-4 shrink-0" />
                      <span>Thông tin độ tuổi &amp; Chuẩn an toàn sinh sản</span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300/90 leading-relaxed">
                      Bé hiện tại đang <strong className="font-black text-blue-900 dark:text-blue-100">{calculateAge()}</strong> (chưa đạt độ tuổi phối giống an toàn: {formData.species === "cat" ? "Mèo từ 8 tháng" : "Chó từ 12 tháng"}). Hồ sơ của bé vẫn được tạo bình thường để lưu sổ tiêm và đặt lịch Spa. Tính năng Ghép đôi sẽ tự động kích hoạt vào <strong className="font-black text-blue-900 dark:text-blue-100">Tháng {getEligibleDate()}</strong>!
                    </p>
                  </div>
                )}

                {/* Mature status info */}
                {formData.birthday && !isUnderage && new Date(formData.birthday) <= new Date() && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <Sparkles className="size-3.5" /> Bé đã đạt độ tuổi trưởng thành, đủ điều kiện tham gia ghép đôi phối giống.
                  </p>
                )}
              </div>

              {/* Cân nặng Block */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="weight" className="text-sm font-bold">
                    Cân nặng (kg) <span className="text-destructive font-bold">*</span>
                  </Label>
                  {getWeightClassification() && (
                    <span className={cn("text-xs font-black px-2.5 py-0.5 rounded-full border", getWeightClassification()?.color)}>
                      {getWeightClassification()?.label}
                    </span>
                  )}
                </div>

                {/* Quick Weight Presets */}
                <div className="space-y-1.5 rounded-2xl bg-muted/40 p-3 border border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                      <Scale className="size-3 text-primary" />
                      {formData.species === "cat" ? "Gợi ý cân nặng phổ biến cho Mèo:" : "Gợi ý cân nặng phổ biến cho Chó:"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {(formData.species === "cat"
                      ? [
                          { label: "2.5 kg", val: "2.5" },
                          { label: "3.5 kg", val: "3.5" },
                          { label: "4.5 kg", val: "4.5" },
                          { label: "5.5 kg", val: "5.5" },
                          { label: "7.0 kg", val: "7" },
                        ]
                      : [
                          { label: "3 kg (Toy)", val: "3" },
                          { label: "6 kg (Nhỏ)", val: "6" },
                          { label: "12 kg (Vừa)", val: "12" },
                          { label: "25 kg (Lớn)", val: "25" },
                          { label: "35 kg (Rất lớn)", val: "35" },
                        ]
                    ).map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, weight: preset.val }))}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer",
                          formData.weight === preset.val
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background text-muted-foreground border-border/80 hover:border-primary/50 hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Integrated Stepper Input Group */}
                <div className="flex items-stretch rounded-2xl border-2 border-border/80 bg-background overflow-hidden shadow-xs focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
                  <button
                    type="button"
                    onClick={() => adjustWeight(-0.5)}
                    className="flex items-center justify-center px-4 py-2.5 bg-muted/40 hover:bg-primary/10 hover:text-primary active:bg-primary/20 text-muted-foreground transition-colors cursor-pointer border-r border-border/60 text-xs font-black select-none"
                    title="Giảm 0.5 kg"
                  >
                    <Minus className="size-4" />
                  </button>

                  <div className="relative flex-1 flex items-center justify-center">
                    <input
                      id="weight"
                      type="number"
                      step="0.1"
                      min={weightLimits?.profileMin ?? 0.2}
                      max={weightLimits?.profileMax ?? 160}
                      placeholder="0.0"
                      value={formData.weight}
                      onChange={(event) => setFormData({ ...formData, weight: event.target.value })}
                      className="w-full h-12 bg-transparent text-center text-lg font-black text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-8 pl-4"
                    />
                    <span className="absolute right-4 text-xs font-black text-muted-foreground pointer-events-none">
                      kg
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => adjustWeight(0.5)}
                    className="flex items-center justify-center px-4 py-2.5 bg-muted/40 hover:bg-primary/10 hover:text-primary active:bg-primary/20 text-muted-foreground transition-colors cursor-pointer border-l border-border/60 text-xs font-black select-none"
                    title="Tăng 0.5 kg"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>

                {hasWeight && weightLimits && !profileWeightIsValid && (
                  <p className="text-xs font-bold text-destructive">
                    ⚠️ Cân nặng của {formData.species === "dog" ? "chó" : "mèo"} phải từ {weightLimits.profileMin}-{weightLimits.profileMax} kg để lưu hồ sơ.
                  </p>
                )}
                {profileWeightIsValid && weightLimits && !matchingWeightIsEligible && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-black">⚠️ Chưa đủ điều kiện cân nặng để phối giống</p>
                    <p className="mt-1 font-medium">
                      Hồ sơ vẫn được lưu, nhưng {formData.species === "dog" ? "chó" : "mèo"} cần từ {weightLimits.matchingMin}-{weightLimits.matchingMax} kg để tham gia matching.
                    </p>
                  </div>
                )}
                {matchingWeightIsEligible && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ✓ Cân nặng đạt điều kiện tham gia matching.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                <div className="space-y-1">
                  <Label className="font-extrabold text-sm">
                    Địa chỉ & Khu vực của bé tại Hà Nội <span className="text-destructive font-bold">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Chọn Phường / Xã nơi bé đang ở để hệ thống tự động xác định toạ độ và đề xuất ghép đôi gần nhất.
                  </p>
                </div>
                <HanoiWardSelect
                  value={selectedWard?.name}
                  onChange={(ward) => setSelectedWard(ward)}
                />
              </div>

              {/* Sổ tiêm phòng & Vắc-xin Card */}
              <div
                className={cn(
                  "rounded-2xl border-2 p-4 transition-all space-y-3",
                  formData.isVaccinated
                    ? "border-primary/40 bg-primary/5 shadow-xs"
                    : "border-border/80 bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl shrink-0 font-bold transition-colors",
                        formData.isVaccinated
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Syringe className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-foreground">Sổ tiêm phòng &amp; Vắc-xin</span>
                        {formData.isVaccinated && (
                          <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                            Xác minh sức khỏe
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Đã tiêm phòng đầy đủ các mũi cơ bản (5/7 bệnh hoặc vắc-xin dại).
                      </p>
                    </div>
                  </div>

                  <Switch
                    id="vaccinated"
                    checked={formData.isVaccinated}
                    onCheckedChange={(checked) => {
                      setFormData({ ...formData, isVaccinated: checked })
                      if (!checked) setVaccinePhotos([])
                    }}
                  />
                </div>

                {formData.isVaccinated && (
                  <div className="pt-2 border-t border-border/60">
                    <DocumentMultiUploadBox
                      title="Ảnh chụp sổ tiêm phòng"
                      subtitle="Chụp rõ trang có thông tin bé, các mũi tiêm và nhãn dán vắc-xin."
                      photos={vaccinePhotos}
                      maxCount={4}
                      isUploading={isUploading}
                      onUpload={(e) => handleMultiDocUpload(e, setVaccinePhotos, "vaccine-document", vaccinePhotos.length, 4)}
                      onRemove={(index) => setVaccinePhotos((prev) => prev.filter((_, i) => i !== index))}
                    />
                  </div>
                )}
              </div>

              {/* Giấy tờ phả hệ Card */}
              <div
                className={cn(
                  "rounded-2xl border-2 p-4 transition-all space-y-3",
                  formData.hasPedigree
                    ? "border-primary/40 bg-primary/5 shadow-xs"
                    : "border-border/80 bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl shrink-0 font-bold transition-colors",
                        formData.hasPedigree
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Award className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-foreground">Giấy tờ phả hệ thuần chủng</span>
                        {formData.hasPedigree && (
                          <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold">
                            Thuần chủng
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Chứng nhận phả hệ cấp bởi VKA, FCI, TICA, WCF hoặc hiệp hội quốc tế.
                      </p>
                    </div>
                  </div>

                  <Switch
                    id="pedigree"
                    checked={formData.hasPedigree}
                    onCheckedChange={(checked) => {
                      setFormData({ ...formData, hasPedigree: checked })
                      if (!checked) {
                        setPedigreePhotos([])
                        setFormData((prev) => ({ ...prev, hasPedigree: false, pedigreeNumber: "" }))
                      }
                    }}
                  />
                </div>

                {formData.hasPedigree && (
                  <div className="pt-2 border-t border-border/60 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="pedigreeNumber" className="text-xs font-bold text-foreground">
                          Mã số chứng nhận phả hệ
                        </Label>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground mr-1">Hiệp hội:</span>
                          {["VKA", "TICA", "FCI", "WCF"].map((club) => (
                            <button
                              key={club}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => {
                                  const current = prev.pedigreeNumber.trim()
                                  if (current.startsWith(club)) return prev
                                  return { ...prev, pedigreeNumber: `${club}-${current.replace(/^[A-Z]+-?/, "")}` }
                                })
                              }}
                              className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition cursor-pointer"
                            >
                              {club}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Input
                        id="pedigreeNumber"
                        placeholder="Ví dụ: VKA-2023-001 hoặc TICA-09872"
                        value={formData.pedigreeNumber}
                        onChange={(event) => setFormData({ ...formData, pedigreeNumber: event.target.value })}
                        className="rounded-xl font-bold bg-background h-10"
                      />
                    </div>

                    <DocumentMultiUploadBox
                      title="Ảnh chụp giấy chứng nhận phả hệ"
                      subtitle="Chụp rõ mặt trước và mặt sau (hoặc sơ đồ phả hệ) để Admin kiểm duyệt."
                      photos={pedigreePhotos}
                      maxCount={4}
                      isUploading={isUploading}
                      onUpload={(e) => handleMultiDocUpload(e, setPedigreePhotos, "pedigree-document", pedigreePhotos.length, 4)}
                      onRemove={(index) => setPedigreePhotos((prev) => prev.filter((_, i) => i !== index))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="mb-6 text-center text-2xl font-bold">Hình ảnh & Yêu cầu</h2>

              <div className="space-y-2">
                <Label>Bộ sưu tập ảnh (tối đa 6 ảnh)</Label>
                <div className="grid grid-cols-3 gap-3">
                  {gallery.map((image, index) => (
                    <div key={image} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                      <img src={image} alt={`Ảnh ${index + 1}`} className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(index)}
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg"
                        aria-label="Xóa ảnh"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  {gallery.length < 6 && (
                    <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-primary/30 transition-all hover:border-primary/60 hover:bg-primary/5">
                      <div className="text-center text-muted-foreground">
                        <Plus className="mx-auto mb-1 size-8" />
                        <span className="text-xs">Thêm ảnh</span>
                      </div>
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={isUploading} onChange={handleGalleryUpload} />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="personality">Mô tả tính cách</Label>
                <Textarea
                  id="personality"
                  placeholder="Bé rất hiền, quấn người, thích ăn hạt..."
                  maxLength={500}
                  rows={4}
                  value={formData.personality}
                  onChange={(event) => setFormData({ ...formData, personality: event.target.value })}
                />
                <p className="text-right text-xs text-muted-foreground">{formData.personality.length}/500 ký tự</p>
              </div>

              {formData.gender === "male" && (
                isUnderage ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-black text-blue-800 dark:text-blue-300">
                      <Sparkles className="size-4 text-blue-600" />
                      <span>Cấu hình Phối giống Tự động (Tạm hoãn do bé còn nhỏ)</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Bé hiện tại đang <strong>{calculateAge()}</strong> (dưới {minBreedingAgeMonths} tháng tuổi), bạn chưa cần cài đặt chi phí phối giống. Khi bé đủ tuổi (dự kiến Tháng <strong>{getEligibleDate()}</strong>), bạn có thể cập nhật yêu cầu phối giống bất kỳ lúc nào.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="breedingOption">Hình thức phối giống mong muốn</Label>
                      <Select value={formData.breedingOption} onValueChange={(value) => setFormData({ ...formData, breedingOption: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn hình thức" />
                        </SelectTrigger>
                        <SelectContent>
                          {breedingOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.breedingOption === "cash" && (
                      <div className="space-y-2">
                        <Label htmlFor="breedingPrice">Số tiền (VNĐ)</Label>
                        <Input
                          id="breedingPrice"
                          type="number"
                          min="0"
                          step="100000"
                          placeholder="Ví dụ: 5000000"
                          value={formData.breedingPrice}
                          onChange={(event) => setFormData({ ...formData, breedingPrice: event.target.value })}
                        />
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          )}

          {submitError && (
            <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {submitError}
            </div>
          )}

          <div className="mt-8 flex justify-between border-t pt-6">
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={step === 1} className="gap-2">
              <ChevronLeft className="size-4" />
              Quay lại
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed() || isUploading} className="gap-2">
                Tiếp tục
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting || isUploading} className="gap-2">
                <Check className="size-4" />
                {isUploading ? "Đang tải ảnh..." : isSubmitting ? "Đang tạo..." : "Hoàn thành"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentMultiUploadBox({
  title,
  subtitle,
  photos,
  maxCount = 4,
  onUpload,
  onRemove,
  isUploading,
}: {
  title: string
  subtitle: string
  photos: string[]
  maxCount?: number
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: (index: number) => void
  isUploading: boolean
}) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-black text-foreground">{title}</span>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
          {photos.length}/{maxCount} ảnh
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {photos.map((url, index) => (
          <div key={`${url}-${index}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted shadow-2xs">
            <img src={url} alt={`Trang ${index + 1}`} className="size-full object-cover" />
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
              Trang {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow-md transition hover:scale-110 cursor-pointer"
              aria-label="Xóa ảnh này"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        {photos.length < maxCount && (
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/30 bg-background text-center transition hover:border-primary hover:bg-primary/5 shadow-2xs">
            <ImagePlus className="size-5 text-primary/70" />
            <span className="text-xs font-bold text-foreground">+ Thêm trang</span>
            <span className="text-[10px] text-muted-foreground">Tối đa 5MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              disabled={isUploading}
              onChange={onUpload}
            />
          </label>
        )}
      </div>
    </div>
  )
}
