"use client"

import { useState } from "react"
import { Camera, Dog, Cat, Plus, X, Upload, ChevronLeft, ChevronRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { dogBreeds, catBreeds, breedingOptions, provinces } from "@/lib/pet-data"

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

  const breeds = formData.species === "dog" ? dogBreeds : formData.species === "cat" ? catBreeds : []

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setter(url)
    }
  }

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newImages = files.slice(0, 6 - gallery.length).map((file) => URL.createObjectURL(file))
    setGallery([...gallery, ...newImages])
  }

  const removeGalleryImage = (index: number) => {
    setGallery(gallery.filter((_, i) => i !== index))
  }

  const calculateAge = () => {
    if (!formData.birthday) return ""
    const birthday = new Date(formData.birthday)
    const now = new Date()
    const months = (now.getFullYear() - birthday.getFullYear()) * 12 + (now.getMonth() - birthday.getMonth())
    if (months < 12) {
      return `${months} tháng tuổi`
    }
    return `${Math.floor(months / 12)} tuổi ${months % 12} tháng`
  }

  const canProceed = () => {
    if (step === 1) {
      return formData.name && formData.species && formData.breed && formData.gender
    }
    if (step === 2) {
      return formData.birthday && formData.weight
    }
    return true
  }

  const handleSubmit = () => {
    console.log("[v0] Form submitted:", { formData, avatar, gallery, vaccinePhoto, pedigreePhoto })
    onComplete?.()
  }

  const steps = [
    { number: 1, title: "Thông tin cơ bản" },
    { number: 2, title: "Chỉ số & Sức khỏe" },
    { number: 3, title: "Hình ảnh & Yêu cầu" },
  ]

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all",
                step >= s.number
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {step > s.number ? <Check className="w-5 h-5" /> : s.number}
            </div>
            <span className={cn("ml-2 text-sm font-medium hidden sm:inline", step >= s.number ? "text-foreground" : "text-muted-foreground")}>
              {s.title}
            </span>
            {i < steps.length - 1 && (
              <div className={cn("w-12 h-1 mx-3 rounded", step > s.number ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        ))}
      </div>

      <Card className="border-0 shadow-xl">
        <CardContent className="p-6 sm:p-8">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Thông tin cơ bản</h2>
              
              {/* Avatar Upload */}
              <div className="flex justify-center">
                <label className="relative cursor-pointer group">
                  <div className={cn(
                    "w-32 h-32 rounded-full border-4 border-dashed border-primary/30 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/60",
                    avatar && "border-solid border-primary"
                  )}>
                    {avatar ? (
                      <img src={avatar} alt="Pet avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Camera className="w-8 h-8 mx-auto mb-1" />
                        <span className="text-xs">Tải ảnh</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg">
                    <Camera className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setAvatar)} />
                </label>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Tên của bé *</Label>
                <Input
                  id="name"
                  placeholder="Ví dụ: Đậu Đậu"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* Species */}
              <div className="space-y-2">
                <Label>Loài *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, species: "dog", breed: "" })}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
                      formData.species === "dog"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Dog className={cn("w-12 h-12", formData.species === "dog" ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("font-semibold", formData.species === "dog" ? "text-primary" : "text-foreground")}>Chó</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, species: "cat", breed: "" })}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
                      formData.species === "cat"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Cat className={cn("w-12 h-12", formData.species === "cat" ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("font-semibold", formData.species === "cat" ? "text-primary" : "text-foreground")}>Mèo</span>
                  </button>
                </div>
              </div>

              {/* Breed */}
              <div className="space-y-2">
                <Label htmlFor="breed">Giống *</Label>
                <Select
                  value={formData.breed}
                  onValueChange={(value) => setFormData({ ...formData, breed: value })}
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
                  </SelectContent>
                </Select>
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label>Giới tính *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: "male" })}
                    className={cn(
                      "p-4 rounded-xl border-2 font-semibold transition-all",
                      formData.gender === "male"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    ♂ Đực (Male)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: "female" })}
                    className={cn(
                      "p-4 rounded-xl border-2 font-semibold transition-all",
                      formData.gender === "female"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    ♀ Cái (Female)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Health & Specs */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Chỉ số & Sức khỏe</h2>

              {/* Birthday */}
              <div className="space-y-2">
                <Label htmlFor="birthday">Ngày sinh *</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="birthday"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    className="flex-1"
                  />
                  {formData.birthday && (
                    <span className="text-sm text-primary font-medium whitespace-nowrap">{calculateAge()}</span>
                  )}
                </div>
              </div>

              {/* Weight */}
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
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">kg</span>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Khu vực</Label>
                <Select value={formData.location} onValueChange={(value) => setFormData({ ...formData, location: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tỉnh/thành phố" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((province) => (
                      <SelectItem key={province} value={province}>
                        {province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vaccination */}
              <div className="space-y-4 p-4 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between">
                  <Label htmlFor="vaccinated" className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      id="vaccinated"
                      checked={formData.isVaccinated}
                      onCheckedChange={(checked) => setFormData({ ...formData, isVaccinated: checked as boolean })}
                    />
                    <span>Đã tiêm đủ 3 mũi cơ bản</span>
                  </Label>
                </div>
                {formData.isVaccinated && (
                  <div className="pt-2">
                    <Label className="text-sm text-muted-foreground mb-2 block">Upload ảnh Sổ tiêm phòng (tùy chọn)</Label>
                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-all">
                      {vaccinePhoto ? (
                        <div className="relative">
                          <img src={vaccinePhoto} alt="Vaccine record" className="max-h-32 rounded" />
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setVaccinePhoto(null) }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Tải ảnh lên</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setVaccinePhoto)} />
                    </label>
                  </div>
                )}
              </div>

              {/* Pedigree */}
              <div className="space-y-4 p-4 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pedigree" className="cursor-pointer">Giấy tờ phả hệ (VKA/TICA)</Label>
                  <Switch
                    id="pedigree"
                    checked={formData.hasPedigree}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasPedigree: checked })}
                  />
                </div>
                {formData.hasPedigree && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="pedigreeNumber" className="text-sm">Mã số chứng nhận</Label>
                      <Input
                        id="pedigreeNumber"
                        placeholder="Ví dụ: VKA-2023-001"
                        value={formData.pedigreeNumber}
                        onChange={(e) => setFormData({ ...formData, pedigreeNumber: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground mb-2 block">Upload ảnh giấy tờ</Label>
                      <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-all">
                        {pedigreePhoto ? (
                          <div className="relative">
                            <img src={pedigreePhoto} alt="Pedigree document" className="max-h-32 rounded" />
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setPedigreePhoto(null) }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Tải ảnh lên</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setPedigreePhoto)} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Gallery & Demands */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-6">Hình ảnh & Yêu cầu</h2>

              {/* Gallery */}
              <div className="space-y-2">
                <Label>Bộ sưu tập ảnh (tối đa 6 ảnh)</Label>
                <div className="grid grid-cols-3 gap-3">
                  {gallery.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                      <img src={img} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(i)}
                        className="absolute top-2 right-2 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {gallery.length < 6 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-primary/30 flex items-center justify-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all">
                      <div className="text-center text-muted-foreground">
                        <Plus className="w-8 h-8 mx-auto mb-1" />
                        <span className="text-xs">Thêm ảnh</span>
                      </div>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                    </label>
                  )}
                </div>
              </div>

              {/* Personality */}
              <div className="space-y-2">
                <Label htmlFor="personality">Mô tả tính cách</Label>
                <Textarea
                  id="personality"
                  placeholder="Bé rất hiền, quấn người, thích ăn hạt..."
                  maxLength={500}
                  rows={4}
                  value={formData.personality}
                  onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                />
                <p className="text-xs text-muted-foreground text-right">{formData.personality.length}/500 ký tự</p>
              </div>

              {/* Breeding Option */}
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

              {/* Breeding Price */}
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
                    onChange={(e) => setFormData({ ...formData, breedingPrice: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={step === 1}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Quay lại
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="gap-2"
              >
                Tiếp tục
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} className="gap-2">
                <Check className="w-4 h-4" />
                Hoàn thành
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
