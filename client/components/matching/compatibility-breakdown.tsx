"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle,
  Award,
  ChevronDown,
  Dna,
  HeartHandshake,
  Info,
  MapPin,
  Scale,
  Sparkles,
  Syringe,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CompatibilityBreakdownProps {
  myPet: {
    name: string
    breed: string
    gender: "MALE" | "FEMALE"
    weight: number
    location: string
    ward?: string | null
    hasPedigree: boolean
    pedigreeVerified: boolean
    isVaccinated: boolean
    vaccineVerified: boolean
  }
  candidatePet: {
    name: string
    breed: string
    gender: "MALE" | "FEMALE"
    weight: number
    location: string
    ward?: string | null
    hasPedigree: boolean
    pedigreeVerified: boolean
    isVaccinated: boolean
    vaccineVerified: boolean
    distanceKm?: number
    compatibilityScore?: number
    matchReasons?: string[]
    breedWarnings?: string[]
    breedInfo?: {
      offspringName: string | null
      warningNote: string | null
      isCompatible: boolean
    }
  }
  defaultExpanded?: boolean
}

export function CompatibilityBreakdown({
  myPet,
  candidatePet,
  defaultExpanded = false,
}: CompatibilityBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const score = candidatePet.compatibilityScore ?? 75

  // Scoring factors breakdown
  const isSameBreed = myPet.breed.toLowerCase() === candidatePet.breed.toLowerCase()
  const isBreedCompatible = candidatePet.breedInfo?.isCompatible === true
  const isBreedIncompatible = candidatePet.breedInfo?.isCompatible === false || (!isSameBreed && !isBreedCompatible)
  const isSimilarWeight = Math.abs(myPet.weight - candidatePet.weight) <= 5
  const bothPedigree = myPet.hasPedigree && candidatePet.hasPedigree
  const bothPedigreeVerified = myPet.pedigreeVerified && candidatePet.pedigreeVerified
  const bothVaccineVerified = myPet.vaccineVerified && candidatePet.vaccineVerified

  const getScoreColor = (value: number) => {
    if (value >= 85) return "text-emerald-600 dark:text-emerald-400"
    if (value >= 70) return "text-primary"
    if (value >= 50) return "text-amber-500"
    return "text-rose-500"
  }

  const getScoreBadgeBg = (value: number) => {
    if (value >= 85) return "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
    if (value >= 70) return "bg-primary/10 border-primary/25 text-primary"
    if (value >= 50) return "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300"
    return "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300"
  }

  const getBorderAccent = (value: number) => {
    if (value >= 85) return "border-emerald-500/30 hover:border-emerald-500/50"
    if (value >= 70) return "border-primary/30 hover:border-primary/50"
    if (value >= 50) return "border-amber-500/30 hover:border-amber-500/50"
    return "border-rose-500/30 hover:border-rose-500/50"
  }

  const getEvaluation = (value: number) => {
    if (value >= 90) return "Tương thích Tuyệt vời"
    if (value >= 80) return "Độ tương thích Rất cao"
    if (value >= 70) return "Phù hợp Ghép đôi"
    if (value >= 50) return "Tương thích Trung bình"
    return "Cần cân nhắc thêm"
  }

  return (
    <div className={cn(
      "rounded-3xl border bg-card p-4 sm:p-5 shadow-xs transition-all duration-300",
      getBorderAccent(score),
    )}>
      {/* Compact Interactive Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left cursor-pointer group focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Score Ring Pill */}
            <div className={cn(
              "flex flex-col size-12 items-center justify-center rounded-2xl border text-center font-black shrink-0 transition-transform group-hover:scale-105 shadow-xs",
              getScoreBadgeBg(score),
            )}>
              <span className="text-sm leading-none font-black">{score}%</span>
              <span className="text-[9px] font-bold opacity-80 mt-0.5">Điểm</span>
            </div>

            {/* Title & Versus Pair */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                  Giải Mã Độ Phù Hợp Ghép Đôi
                </h3>
                <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black border", getScoreBadgeBg(score))}>
                  {getEvaluation(score)}
                </span>
              </div>

              {/* Pet vs Pet Comparison */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 truncate">
                <span className="font-bold text-foreground">{myPet.name}</span>
                <span className="text-[11px]">({myPet.breed})</span>
                <span className="text-primary font-black px-0.5">⚡</span>
                <span className="font-bold text-foreground">{candidatePet.name}</span>
                <span className="text-[11px]">({candidatePet.breed})</span>
              </div>
            </div>
          </div>

          {/* Clean Single Arrow Toggle */}
          <div className="flex size-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary transition-all shrink-0">
            <ChevronDown className={cn("size-4 transition-transform duration-300", isExpanded && "rotate-180")} />
          </div>
        </div>

        {/* Collapsed Quick Insights Chips */}
        {!isExpanded && (
          <div className="mt-3 flex flex-wrap gap-1.5 pt-2.5 border-t border-dashed">
            {isSameBreed ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-bold border border-emerald-200/60">
                <Dna className="size-3" /> Cùng giống thuần chủng (+25%)
              </span>
            ) : isBreedCompatible ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold border border-primary/20">
                <Dna className="size-3" /> Lai tạo tương thích (+20%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 px-2 py-0.5 text-[11px] font-bold border border-rose-200/60">
                <AlertTriangle className="size-3" /> Khác giống loài (-10%)
              </span>
            )}

            <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 px-2 py-0.5 text-[11px] font-bold border border-teal-200/60">
              <MapPin className="size-3" /> {candidatePet.distanceKm != null ? `Cách ~${candidatePet.distanceKm} km` : candidatePet.ward || candidatePet.location} (+15%)
            </span>

            {isSimilarWeight ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 text-[11px] font-bold border border-blue-200/60">
                <Scale className="size-3" /> Thể trạng tương đồng (+10%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-[11px] font-bold border border-amber-200/60">
                <Scale className="size-3" /> Chênh lệch {Math.abs(myPet.weight - candidatePet.weight).toFixed(1)}kg
              </span>
            )}

            {bothPedigree && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-[11px] font-bold border border-amber-200/60">
                <Award className="size-3" /> Có phả hệ (+10%)
              </span>
            )}
          </div>
        )}
      </button>

      {/* Expandable Details Section */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden space-y-4 pt-4 border-t mt-3.5"
          >
            {/* Progress Score Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>Tổng hợp mức độ tương thích</span>
                <span className={cn("font-black", getScoreColor(score))}>{score}/100 Điểm</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    score >= 85
                      ? "bg-gradient-to-r from-teal-500 to-emerald-500"
                      : score >= 70
                      ? "bg-gradient-to-r from-amber-500 to-primary"
                      : "bg-gradient-to-r from-rose-500 to-amber-500",
                  )}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Breakdown Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Info className="size-3.5" /> Chi tiết từng tiêu chí chấm điểm
              </h4>

              <div className="grid gap-2">
                {/* 1. Base Score */}
                <div className="flex items-center justify-between rounded-xl border bg-card p-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Điều kiện sinh sản nền tảng</p>
                      <p className="text-[11px] text-muted-foreground">Độ tuổi trưởng thành, sẵn sàng ghép đôi</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-black text-primary shrink-0">+30%</span>
                </div>

                {/* 2. Breed Compatibility */}
                <div className={cn(
                  "flex items-center justify-between rounded-xl border p-3 shadow-2xs",
                  isSameBreed
                    ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20"
                    : isBreedIncompatible
                    ? "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20"
                    : "bg-card",
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg",
                      isSameBreed
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                        : isBreedIncompatible
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
                        : "bg-muted text-muted-foreground",
                    )}>
                      <Dna className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {isSameBreed
                          ? `Cùng giống thuần chủng (${myPet.breed})`
                          : isBreedCompatible
                          ? `Lai tạo giống tương thích`
                          : `Khác giống loài (${myPet.breed} & ${candidatePet.breed})`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {isSameBreed
                          ? "Cùng giống giúp duy trì nguồn gen thuần chủng F1 chuẩn đẹp"
                          : candidatePet.breedInfo?.offspringName
                          ? `Phối giống lai tạo được công nhận: ${candidatePet.breedInfo.offspringName}`
                          : "Hai giống khác biệt, hãy cân nhắc đặc tính con lai khi sinh nở"}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "font-mono text-xs font-black shrink-0",
                    isSameBreed ? "text-emerald-600" : isBreedCompatible ? "text-primary" : "text-rose-500",
                  )}>
                    {isSameBreed ? "+25%" : isBreedCompatible ? "+20%" : "-10%"}
                  </span>
                </div>

                {/* 3. Location & Proximity */}
                <div className="flex items-center justify-between rounded-xl border bg-teal-50/40 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/60 p-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                      <MapPin className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        Khu vực & Khoảng cách ({candidatePet.ward || candidatePet.location})
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {candidatePet.distanceKm != null && candidatePet.distanceKm <= 1
                          ? "Cùng khu vực rất gần (< 1 km), thuận tiện gặp gỡ"
                          : `Khoảng cách ~${candidatePet.distanceKm ?? 3.5} km, dễ dàng sắp xếp lịch phối`}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-black text-teal-600 shrink-0">+15%</span>
                </div>

                {/* 4. Weight Similarity */}
                <div className={cn(
                  "flex items-center justify-between rounded-xl border p-3 shadow-2xs",
                  isSimilarWeight ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/60" : "bg-card",
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg",
                      isSimilarWeight ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-muted text-muted-foreground",
                    )}>
                      <Scale className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        Thể hình & Cân nặng ({myPet.weight}kg vs {candidatePet.weight}kg)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {isSimilarWeight
                          ? `Chênh lệch chỉ ${Math.abs(myPet.weight - candidatePet.weight).toFixed(1)}kg (<= 5kg), an toàn khi phối và đỡ đẻ`
                          : `Chênh lệch ${Math.abs(myPet.weight - candidatePet.weight).toFixed(1)}kg, cần chú ý thể trạng khi mang thai`}
                      </p>
                    </div>
                  </div>
                  <span className={cn("font-mono text-xs font-black shrink-0", isSimilarWeight ? "text-blue-600" : "text-muted-foreground")}>
                    {isSimilarWeight ? "+10%" : "+0%"}
                  </span>
                </div>

                {/* 5. Pedigree Certification */}
                <div className={cn("flex items-center justify-between rounded-xl border p-3 shadow-2xs", bothPedigree ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200" : "bg-card")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", bothPedigree ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
                      <Award className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Giấy chứng nhận Phả hệ VKA</p>
                      <p className="text-[11px] text-muted-foreground">
                        {bothPedigreeVerified
                          ? "Cả 2 bé đều đã được kiểm định phả hệ VKA chính thức (+20%)"
                          : bothPedigree
                          ? "Cả 2 bé đều có khai báo phả hệ (+10%)"
                          : "Chưa cung cấp đủ giấy tờ phả hệ 2 bên"}
                      </p>
                    </div>
                  </div>
                  <span className={cn("font-mono text-xs font-black shrink-0", bothPedigreeVerified ? "text-amber-600" : bothPedigree ? "text-amber-600" : "text-muted-foreground")}>
                    {bothPedigreeVerified ? "+20%" : bothPedigree ? "+10%" : "+0%"}
                  </span>
                </div>

                {/* 6. Health & Vaccination */}
                <div className={cn("flex items-center justify-between rounded-xl border p-3 shadow-2xs", bothVaccineVerified ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200" : "bg-card")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", bothVaccineVerified ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
                      <Syringe className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Kiểm định tiêm chủng y tế</p>
                      <p className="text-[11px] text-muted-foreground">
                        {bothVaccineVerified
                          ? "Đã xác thực sổ tiêm ngừa đầy đủ, bảo đảm an toàn sức khỏe"
                          : "Chưa xác minh đủ hồ sơ tiêm chủng 2 bên"}
                      </p>
                    </div>
                  </div>
                  <span className={cn("font-mono text-xs font-black shrink-0", bothVaccineVerified ? "text-emerald-600" : "text-muted-foreground")}>
                    {bothVaccineVerified ? "+5%" : "+0%"}
                  </span>
                </div>
              </div>
            </div>

            {/* Warnings & Notes (if any) */}
            {candidatePet.breedWarnings && candidatePet.breedWarnings.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-extrabold text-xs">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Lưu ý lai tạo di truyền từ Chuyên gia</span>
                </div>
                <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  {candidatePet.breedWarnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Collapse Button */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Thu gọn phân tích <ChevronDown className="size-3.5 rotate-180" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

