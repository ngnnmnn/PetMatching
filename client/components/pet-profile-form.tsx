"use client"

import { useState, useEffect } from "react"
import { Camera, Cat, Check, ChevronLeft, ChevronRight, Dog, Info, Plus, Sparkles, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/axios"
import { breedingOptions, catBreeds, dogBreeds, provinces } from "@/lib/pet-options"
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
  const [vaccinePhoto, setVaccinePhoto] = useState<string | null>(null)
  const [pedigreePhoto, setPedigreePhoto] = useState<string | null>(null)
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
    if (!formData.species) {
      setDbBreeds([])
      return
    }
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

  const calculateAge = () => {
    if (!formData.birthday) return ""
    const birthday = new Date(formData.birthday)
    const now = new Date()
    const months = (now.getFullYear() - birthday.getFullYear()) * 12 + (now.getMonth() - birthday.getMonth())

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
    return (now.getFullYear() - birthday.getFullYear()) * 12 + (now.getMonth() - birthday.getMonth())
  }

  const minBreedingAgeMonths = formData.species === "cat" ? 8 : 12
  const currentAgeMonths = getAgeInMonths()
  const isUnderage = currentAgeMonths !== null && currentAgeMonths < minBreedingAgeMonths

  const getEligibleDate = () => {
    if (!formData.birthday) return ""
    const birthday = new Date(formData.birthday)
    const eligibleDate = new Date(birthday)
    eligibleDate.setMonth(eligibleDate.getMonth() + minBreedingAgeMonths)
    return eligibleDate.toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric" })
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
      const isWeightValid = formData.weight
        ? Number(formData.weight) > 0 && Number(formData.weight) <= 150
        : false;
      return isBirthdayValid && isWeightValid && !!selectedWard
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

    if (formData.isVaccinated && !vaccinePhoto) {
      setSubmitError("Vui lòng tải ảnh sổ tiêm phòng để gửi xác minh.")
      setStep(2)
      return
    }
    if (formData.hasPedigree && !pedigreePhoto) {
      setSubmitError("Vui lòng tải ảnh giấy tờ phả hệ để gửi xác minh.")
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
        vaccineDocumentUrls: vaccinePhoto ? [vaccinePhoto] : undefined,
        vaccineNote: formData.isVaccinated ? "Đã tiêm đủ 3 mũi cơ bản" : undefined,
        pedigreeDocumentUrls: pedigreePhoto ? [pedigreePhoto] : undefined,
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
                <Label htmlFor="name">Tên của bé *</Label>
                <Input
                  id="name"
                  placeholder="Ví dụ: Đậu Đậu"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Loài *</Label>
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
                <Label htmlFor="breed">Giống *</Label>
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
                <Label>Giới tính *</Label>
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="mb-6 text-center text-2xl font-bold">Chỉ số & Sức khỏe</h2>

              <div className="space-y-2">
                <Label htmlFor="birthday">Ngày sinh *</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="birthday"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={formData.birthday}
                    onChange={(event) => setFormData({ ...formData, birthday: event.target.value })}
                    className="flex-1"
                  />
                  {formData.birthday && (
                    <span className="whitespace-nowrap text-sm font-medium text-primary">{calculateAge()}</span>
                  )}
                </div>
                {formData.birthday && isUnderage && currentAgeMonths !== null && (
                  <div className="mt-2.5 rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30 space-y-1">
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-extrabold text-xs">
                      <Info className="size-4 shrink-0" />
                      <span>Thông tin độ tuổi &amp; Chuẩn an toàn sinh sản</span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300/90 leading-relaxed">
                      Bé hiện tại đang <strong className="font-black text-blue-900 dark:text-blue-100">{calculateAge()}</strong> (chưa đạt độ tuổi phối giống an toàn: {formData.species === "cat" ? "Mèo từ 8 tháng" : "Chó từ 12 tháng"}). Hồ sơ của bé vẫn được tạo bình thường để lưu sổ tiêm và đặt lịch Spa. Tính năng Ghép đôi sẽ tự động kích hoạt vào <strong className="font-black text-blue-900 dark:text-blue-100">Tháng {getEligibleDate()}</strong>!
                    </p>
                  </div>
                )}
                {formData.birthday && !isUnderage && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <Sparkles className="size-3.5" /> Bé đã đạt độ tuổi trưởng thành, đủ điều kiện tham gia ghép đôi phối giống.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Cân nặng (kg) *</Label>
                <div className="relative">
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Ví dụ: 5.5"
                    value={formData.weight}
                    onChange={(event) => setFormData({ ...formData, weight: event.target.value })}
                    className="pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">kg</span>
                </div>
                {formData.weight && Number(formData.weight) <= 0 && (
                  <p className="text-xs font-semibold text-destructive mt-1">Cân nặng phải lớn hơn 0 kg.</p>
                )}
                {formData.weight && Number(formData.weight) > 150 && (
                  <p className="text-xs font-semibold text-destructive mt-1">Cân nặng quá lớn (tối đa 150kg). Vui lòng kiểm tra lại.</p>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                <div className="space-y-1">
                  <Label className="font-extrabold text-sm">Địa chỉ & Khu vực của bé tại Hà Nội *</Label>
                  <p className="text-xs text-muted-foreground">
                    Chọn Phường / Xã nơi bé đang ở để hệ thống tự động xác định toạ độ và đề xuất ghép đôi gần nhất.
                  </p>
                </div>
                <HanoiWardSelect
                  value={selectedWard?.name}
                  onChange={(ward) => setSelectedWard(ward)}
                />
              </div>

              <div className="space-y-4 rounded-xl bg-muted/50 p-4">
                <Label htmlFor="vaccinated" className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    id="vaccinated"
                    checked={formData.isVaccinated}
                    onCheckedChange={(checked) => setFormData({ ...formData, isVaccinated: checked as boolean })}
                  />
                  <span>Đã tiêm đủ 3 mũi cơ bản</span>
                </Label>

                {formData.isVaccinated && (
                  <UploadBox
                    label="Tải ảnh sổ tiêm phòng"
                    image={vaccinePhoto}
                    imageAlt="Sổ tiêm phòng"
                    onRemove={() => setVaccinePhoto(null)}
                    onUpload={(event) => handleImageUpload(event, setVaccinePhoto, "vaccine-document")}
                  />
                )}
              </div>

              <div className="space-y-4 rounded-xl bg-muted/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="pedigree" className="cursor-pointer">
                    Giấy tờ phả hệ (VKA/TICA)
                  </Label>
                  <Switch
                    id="pedigree"
                    checked={formData.hasPedigree}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasPedigree: checked })}
                  />
                </div>

                {formData.hasPedigree && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="pedigreeNumber" className="text-sm">
                        Mã số chứng nhận
                      </Label>
                      <Input
                        id="pedigreeNumber"
                        placeholder="Ví dụ: VKA-2023-001"
                        value={formData.pedigreeNumber}
                        onChange={(event) => setFormData({ ...formData, pedigreeNumber: event.target.value })}
                      />
                    </div>
                    <UploadBox
                      label="Tải ảnh giấy tờ"
                      image={pedigreePhoto}
                      imageAlt="Giấy tờ phả hệ"
                      onRemove={() => setPedigreePhoto(null)}
                      onUpload={(event) => handleImageUpload(event, setPedigreePhoto, "pedigree-document")}
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

function UploadBox({
  label,
  image,
  imageAlt,
  onRemove,
  onUpload,
}: {
  label: string
  image: string | null
  imageAlt: string
  onRemove: () => void
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="pt-2">
      <Label className="mb-2 block text-sm text-muted-foreground">{label}</Label>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-all hover:border-primary/50">
        {image ? (
          <div className="relative">
            <img src={image} alt={imageAlt} className="max-h-32 rounded" />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                onRemove()
              }}
              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              aria-label="Xóa ảnh"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tải ảnh lên</span>
          </>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
      </label>
    </div>
  )
}
