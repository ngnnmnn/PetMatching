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
import { CalendarIcon, Clock, PawPrint } from 'lucide-react';

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
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('09:00');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingPets, setFetchingPets] = useState<boolean>(false);

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
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().split('T')[0]);
      setTime('09:00');
      setNote('');
      setCustomPetName('');
    }
  }, [isOpen]);

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
            ) : pets.length > 0 ? (
              <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                <SelectTrigger id="pet-select" className="bg-background border-input">
                  <SelectValue placeholder="Chọn thú cưng của bạn" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((pet) => (
                    <SelectItem key={pet.id} value={pet.id}>
                      {pet.name} ({pet.breed})
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Thú cưng khác (Nhập tên bên dưới)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-dashed">
                Bạn chưa thêm thú cưng nào. Vui lòng nhập tên thú cưng ở ô phía dưới.
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
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} // minimum tomorrow
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-time" className="text-sm font-semibold flex items-center gap-1.5">
                <Clock className="size-4 text-primary" />
                Giờ hẹn *
              </Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger id="booking-time" className="bg-background border-input">
                  <SelectValue placeholder="Chọn giờ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="08:00">08:00 AM</SelectItem>
                  <SelectItem value="09:00">09:00 AM</SelectItem>
                  <SelectItem value="10:00">10:00 AM</SelectItem>
                  <SelectItem value="11:00">11:00 AM</SelectItem>
                  <SelectItem value="13:30">01:30 PM</SelectItem>
                  <SelectItem value="14:30">02:30 PM</SelectItem>
                  <SelectItem value="15:30">03:30 PM</SelectItem>
                  <SelectItem value="16:30">04:30 PM</SelectItem>
                  <SelectItem value="17:30">05:30 PM</SelectItem>
                  <SelectItem value="18:30">06:30 PM</SelectItem>
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
