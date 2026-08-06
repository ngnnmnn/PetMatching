'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { spaApi } from '@/lib/api/spa';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { CalendarIcon, Clock, PawPrint, Plus } from 'lucide-react';

interface BookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
  serviceId: string;
  serviceName: string;
  price: number;
}

interface Pet {
  id: string;
  name: string;
  breed: string;
  avatarUrl?: string;
}

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function BookingDialog({
  isOpen,
  onClose,
  branchId,
  branchName,
  serviceId,
  serviceName,
  price,
}: BookingDialogProps) {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>('custom');
  const [customPetName, setCustomPetName] = useState<string>('');
  const [date, setDate] = useState<string>(getLocalDateString());
  const [time, setTime] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingPets, setFetchingPets] = useState<boolean>(false);

  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch user's pets
      setFetchingPets(true);
      api.get('/pets/my')
        .then((res) => {
          setPets(res.data || []);
          if (res.data && res.data.length > 0) {
            setSelectedPetId(res.data[0].id);
          } else {
            setSelectedPetId('custom');
          }
        })
        .catch(() => {
          setSelectedPetId('custom');
        })
        .finally(() => {
          setFetchingPets(false);
        });

      // Reset form
      setDate(getLocalDateString());
      setTime('');
      setNote('');
      setCustomPetName('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !branchId || !date) return;
    setLoadingSlots(true);
    spaApi.getAvailability(branchId, date, 30)
      .then((res) => {
        setAvailableSlots(res.data || []);
      })
      .catch(() => {
        setAvailableSlots([]);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [isOpen, branchId, date]);

  const filteredSlots = React.useMemo(() => {
    const todayStr = getLocalDateString();
    const isToday = date === todayStr;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    return availableSlots.filter((slot) => {
      // Hide slot if no staff available
      if (!slot.isAvailable || slot.remainingSlots <= 0 || !slot.availableStaffs || slot.availableStaffs.length === 0) {
        return false;
      }

      // Hide slot if earlier than current time for today
      const [h, m] = slot.time.split(':').map(Number);
      const startMins = h * 60 + m;
      if (isToday && startMins < currentMins) {
        return false;
      }

      return true;
    });
  }, [availableSlots, date]);

  useEffect(() => {
    if (time) {
      const isValid = filteredSlots.some((s) => s.time === time);
      if (!isValid) {
        setTime('');
      }
    }
  }, [filteredSlots, time]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date) {
      toast.error('Vui lòng chọn ngày đặt lịch.');
      return;
    }

    if (!time) {
      toast.error('Vui lòng chọn giờ hẹn.');
      return;
    }

    let petName = customPetName;
    if (selectedPetId !== 'custom') {
      const selectedPet = pets.find(p => p.id === selectedPetId);
      petName = selectedPet ? selectedPet.name : '';
    }

    if (!petName.trim()) {
      toast.error('Vui lòng chọn hoặc nhập tên thú cưng.');
      return;
    }

    // Combine date and time
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

    setLoading(true);
    try {
      await spaApi.createBooking({
        branchId,
        serviceId,
        mainServiceId: serviceId || '',
        petName,
        scheduledAt,
        note,
      });

      toast.success('Đặt lịch hẹn Spa thành công!');
      onClose();
      router.push('/spa/bookings');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi đặt lịch. Vui lòng thử lại.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Đặt Lịch Hẹn Spa</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Bạn đang đăng ký dịch vụ <span className="font-bold text-primary">{serviceName}</span> tại chi nhánh <span className="font-bold">{branchName}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Service info summary */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dịch vụ:</span>
              <span className="font-medium text-foreground">{serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chi nhánh:</span>
              <span className="font-medium text-foreground">{branchName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chi phí dự kiến:</span>
              <span className="font-bold text-primary">{price.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>

          {/* Pet Selector */}
          <div className="space-y-2">
            <Label htmlFor="pet-select" className="text-sm font-semibold flex items-center gap-1.5">
              <PawPrint className="size-4 text-primary" />
              Chọn thú cưng
            </Label>
            {fetchingPets ? (
              <div className="h-10 animate-pulse rounded-md bg-muted" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pets.map((pet) => (
                  <div
                    key={pet.id}
                    onClick={() => setSelectedPetId(pet.id)}
                    className={`flex items-center gap-2.5 p-2.5 border rounded-xl cursor-pointer hover:bg-accent/50 transition-all ${
                      selectedPetId === pet.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pet-dialog"
                      checked={selectedPetId === pet.id}
                      onChange={() => setSelectedPetId(pet.id)}
                      className="accent-primary size-3.5"
                    />
                    {pet.avatarUrl ? (
                      <img
                        src={pet.avatarUrl}
                        alt={pet.name}
                        className="size-8 rounded-full object-cover border shrink-0"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center border font-bold text-xs text-primary shrink-0">
                        🐾
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="font-bold text-xs text-foreground truncate">{pet.name}</p>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {pet.breed}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Card styled like pet selection option with '+' icon inside */}
                <Link href="/my-pets/new" onClick={onClose} className="block">
                  <div className="flex items-center gap-2.5 p-2.5 border border-dashed border-primary/50 rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all h-full min-h-[48px]">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shrink-0">
                      <Plus className="size-4 font-bold" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-primary">Thêm thú cưng</p>
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Custom Pet Name Input */}
          {(selectedPetId === 'custom' || pets.length === 0) && (
            <div className="space-y-1.5">
              <Label htmlFor="custom-pet-name" className="text-xs font-medium">Tên thú cưng của bạn *</Label>
              <Input
                id="custom-pet-name"
                placeholder="Ví dụ: Mochi, LuLu..."
                value={customPetName}
                onChange={(e) => setCustomPetName(e.target.value)}
                required
                className="bg-background border-input"
              />
            </div>
          )}

          {/* Date and Time Selector */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="booking-date" className="text-sm font-semibold flex items-center gap-1.5">
                <CalendarIcon className="size-4 text-primary" />
                Ngày hẹn *
              </Label>
              <Input
                id="booking-date"
                type="date"
                value={date}
                min={getLocalDateString()}
                onKeyDown={(e) => e.preventDefault()}
                onChange={(e) => {
                  const val = e.target.value;
                  const todayStr = getLocalDateString();
                  if (!val || val >= todayStr) {
                    setDate(val);
                  } else {
                    setDate(todayStr);
                  }
                }}
                required
                className="bg-background border-input cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-time" className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="size-4 text-primary" />
                Giờ hẹn *
              </Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger id="booking-time" className="bg-background border-input">
                  <SelectValue placeholder={loadingSlots ? 'Đang tải...' : 'Chọn giờ'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredSlots.length > 0 ? (
                    filteredSlots.map((slot) => (
                      <SelectItem key={slot.time} value={slot.time}>
                        {slot.time} ({slot.remainingSlots} NV rảnh)
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      Không có khung giờ rảnh
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Booking Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="booking-note" className="text-sm font-semibold">Ghi chú (Tùy chọn)</Label>
            <Textarea
              id="booking-note"
              placeholder="Nhập yêu cầu đặc biệt của bạn (ví dụ: thú cưng nhát nước, cần cắt tỉa kỹ phần tai...)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] bg-background border-input"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-semibold"
            >
              {loading ? 'Đang xử lý...' : 'Xác nhận đặt lịch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
