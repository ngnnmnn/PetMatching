'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, PawPrint, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';

type Pet = {
  id: string;
  name: string;
  species: 'DOG' | 'CAT';
  breed: string;
  gender: 'MALE' | 'FEMALE';
  weight: number;
  location: string;
  avatarUrl?: string | null;
  gallery: string[];
  hasPedigree: boolean;
  isAvailableForMatching: boolean;
  status: 'ACTIVE' | 'HIDDEN' | 'INACTIVE';
};

export default function MyPetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadPets = () => {
    setLoading(true);
    api
      .get<Pet[]>('/pets/my')
      .then((response) => setPets(response.data))
      .catch(() => setMessage('Không tải được hồ sơ thú cưng.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadPets, []);

  const toggleAvailability = async (pet: Pet) => {
    await api.patch(`/pets/${pet.id}/availability`, {
      isAvailableForMatching: !pet.isAvailableForMatching,
    });
    loadPets();
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader sectionLabel="Thú cưng" />
      <section className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-6">
          <div>
            <h1 className="mt-2 text-3xl font-bold">Thú cưng của tôi</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Quản lý hồ sơ, trạng thái active và sẵn sàng ghép đôi.
            </p>
          </div>
          <Button className="gap-2" asChild>
            <Link href="/my-pets/new">
              <Plus className="size-4" />
              Tạo hồ sơ
            </Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-4 py-6">
        {message && <div className="mb-4 rounded-xl border bg-card p-4 text-sm text-primary">{message}</div>}
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Đang tải hồ sơ...</div>
        ) : pets.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
              <PawPrint className="size-10 text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Chưa có hồ sơ thú cưng</h2>
            <p className="mb-6 text-muted-foreground">Tạo hồ sơ đầu tiên để bắt đầu ghép đôi.</p>
            <Button asChild>
              <Link href="/my-pets/new">Tạo hồ sơ</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pets.map((pet) => (
              <article key={pet.id} className="overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
                <div className="aspect-video bg-muted">
                  <img
                    src={pet.avatarUrl || pet.gallery?.[0] || '/placeholder.svg'}
                    alt={pet.name}
                    className="size-full object-cover"
                  />
                </div>
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">{pet.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {pet.breed} - {pet.gender === 'MALE' ? 'Đực' : 'Cái'}
                      </p>
                    </div>
                    <span className="rounded-lg border px-3 py-1 text-xs font-bold text-muted-foreground">
                      {pet.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{pet.location}</span>
                    <span>{pet.weight} kg</span>
                    {pet.hasPedigree && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <BadgeCheck className="size-4" />
                        Phả hệ
                      </span>
                    )}
                  </div>

                  {pet.gender === 'MALE' ? (
                    <Button
                      variant={pet.isAvailableForMatching ? 'default' : 'outline'}
                      className="w-full gap-2"
                      onClick={() => toggleAvailability(pet)}
                    >
                      {pet.isAvailableForMatching ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                      {pet.isAvailableForMatching ? 'Đang sẵn sàng ghép đôi' : 'Bật sẵn sàng ghép đôi'}
                    </Button>
                  ) : (
                    <Button className="w-full" asChild>
                      <Link href="/explore">Tìm hồ sơ đực phù hợp</Link>
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
