"use client"

import * as React from "react"
import { Check, ChevronsUpDown, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { HANOI_WARDS, searchHanoiWards, type HanoiWard } from "@/lib/hanoi-wards"

interface HanoiWardSelectProps {
  value?: string | null
  onChange: (ward: HanoiWard) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function HanoiWardSelect({
  value,
  onChange,
  placeholder = "Tìm và chọn Phường / Xã tại Hà Nội...",
  className,
  disabled = false,
}: HanoiWardSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const listRef = React.useRef<HTMLDivElement>(null)

  const filteredWards = React.useMemo(() => {
    return searchHanoiWards(searchTerm)
  }, [searchTerm])

  const selectedWard = React.useMemo(() => {
    if (!value) return null
    return HANOI_WARDS.find((w) => w.name.toLowerCase() === value.toLowerCase()) || null
  }, [value])

  // Xử lý cuộn chuột giữa (wheel) mượt mà kể cả khi mở trong Modal/Dialog
  React.useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (!el) return

    const onNativeWheel = (e: WheelEvent) => {
      e.stopPropagation()
      el.scrollTop += e.deltaY
    }

    el.addEventListener("wheel", onNativeWheel, { passive: false })
    return () => {
      el.removeEventListener("wheel", onNativeWheel)
    }
  }, [open, filteredWards])

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (listRef.current) {
      listRef.current.scrollTop += e.deltaY
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between rounded-xl border border-input bg-background px-3 py-2 text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground h-11",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="truncate font-semibold text-foreground">
              {selectedWard ? `${selectedWard.name}, Hà Nội` : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] sm:w-[400px] p-0 rounded-2xl shadow-2xl z-50 bg-popover"
        align="start"
        data-scroll-lock-scrollable
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Gõ tên Phường / Xã (vd: Dịch Vọng, Hoàn Kiếm)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <div
          ref={listRef}
          onWheel={handleWheel}
          data-scroll-lock-scrollable
          className="max-h-64 overflow-y-auto p-1 text-sm overscroll-contain"
          style={{ scrollbarWidth: "thin" }}
        >
          {filteredWards.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Không tìm thấy Phường / Xã nào phù hợp tại Hà Nội.
            </div>
          ) : (
            filteredWards.map((ward) => {
              const isSelected = selectedWard?.name === ward.name
              return (
                <button
                  key={ward.name}
                  type="button"
                  onClick={() => {
                    onChange(ward)
                    setOpen(false)
                    setSearchTerm("")
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer",
                    isSelected && "bg-primary/15 font-bold text-primary",
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{ward.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      TP. Hà Nội · ({ward.lat.toFixed(4)}, {ward.lng.toFixed(4)})
                    </span>
                  </div>
                  {isSelected && <Check className="size-4 text-primary shrink-0" />}
                </button>
              )
            })
          )}
        </div>
        <div className="border-t bg-muted/30 px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">
          📍 Toạ độ chuẩn tự động gán — Không yêu cầu bật GPS
        </div>
      </PopoverContent>
    </Popover>
  )
}
