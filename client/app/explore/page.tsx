'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Heart, MapPin, PawPrint, Search, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Pet = {
  id: string;
  name: string;
  species: 'DOG' | 'CAT';
  breed: string;
  gender: 'MALE' | 'FEMALE';
  birthday: string;
  weight: number;
  location: string;
  avatarUrl?: string | null;
  avatar?: string | null;
  gallery: string[];
  personality?: string | null;
  hasPedigree: boolean;
  verified?: boolean;
  isAvailableForMatching: boolean;
  compatibilityScore?: number;
  ownerName?: string;
};

export default function ExplorePage() {
  const [myPets, setMyPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [candidates, setCandidates] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const femalePets = useMemo(() => myPets.filter((pet) => pet.gender === 'FEMALE'), [myPets]);

  useEffect(() => {
    api
      .get<Pet[]>('/pets/my')
      .then((response) => {
        setMyPets(response.data);
        const firstFemale = response.data.find((pet) => pet.gender === 'FEMALE');
        if (firstFemale) setSelectedPetId(firstFemale.id);
      })
      .catch(() => setMessage('Không tải được hồ sơ thú cưng của bạn.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPetId) {
      setCandidates([]);
      return;
    }

    setLoading(true);
    api
      .get<{ data: Pet[] }>('/matching/candidates', {
        params: { femalePetId: selectedPetId },
      })
      .then((response) => setCandidates(response.data.data))
      .catch(() => setMessage('Không tải được danh sách gợi ý.'))
      .finally(() => setLoading(false));
  }, [selectedPetId]);

  const passCandidate = async (candidateId: string) => {
    if (!selectedPetId) return;
    await api.post('/matching/pass', { femalePetId: selectedPetId, malePetId: candidateId });
    setCandidates((current) => current.filter((pet) => pet.id !== candidateId));
    setMessage('Đã ẩn hồ sơ này khỏi gợi ý.');
  };

  const requestCandidate = async (candidateId: string) => {
    if (!selectedPetId) return;
    await api.post('/matching/requests', { femalePetId: selectedPetId, malePetId: candidateId });
    setCandidates((current) => current.filter((pet) => pet.id !== candidateId));
    setMessage('Đã gửi yêu cầu ghép đôi.');
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader sectionLabel="Ghép đôi" />
      <section className="border-b bg-card">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-2 text-3xl font-bold">Khám phá ghép đôi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Chọn hồ sơ thú cưng cái của bạn, sau đó gửi yêu cầu tới các hồ sơ đực đang sẵn sàng ghép đôi.
            </p>
          </div>

          <div className="w-full md:w-80">
            <Select value={selectedPetId} onValueChange={setSelectedPetId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn thú cưng cái" />
              </SelectTrigger>
              <SelectContent>
                {femalePets.map((pet) => (
                  <SelectItem key={pet.id} value={pet.id}>
                    {pet.name} - {pet.breed}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-6">
        {message && (
          <div className="mb-4 rounded-xl border bg-card p-4 text-sm font-medium text-primary">
            {message}
          </div>
        )}

        {!loading && femalePets.length === 0 && (
          <EmptyState
            icon={<PawPrint className="size-10 text-muted-foreground" />}
            title="Chưa có hồ sơ thú cưng cái"
            description="Hãy tạo hồ sơ thú cưng cái trước khi gửi yêu cầu ghép đôi."
            actionHref="/my-pets"
            actionLabel="Quản lý thú cưng"
          />
        )}

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Đang tải gợi ý...</div>
        ) : candidates.length === 0 && femalePets.length > 0 ? (
          <EmptyState
            icon={<Search className="size-10 text-muted-foreground" />}
            title="Chưa có gợi ý phù hợp"
            description="Các hồ sơ đã pass hoặc đang chờ xử lý sẽ được ẩn khỏi danh sách."
            actionHref="/my-pets"
            actionLabel="Xem hồ sơ của tôi"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {candidates.map((pet) => (
              <article key={pet.id} className="overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
                <div className="aspect-video bg-muted">
                  <img
                    src={pet.avatarUrl || pet.avatar || pet.gallery?.[0] || '/placeholder.svg'}
                    alt={pet.name}
                    className="size-full object-cover"
                  />
                </div>
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">{pet.name}</h2>
                      <p className="text-sm text-muted-foreground">{pet.breed}</p>
                    </div>
                    <span className="rounded-lg bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
                      {pet.compatibilityScore ?? 0}%
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" />
                      {pet.location}
                    </span>
                    <span>{pet.weight} kg</span>
                    {pet.hasPedigree && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <BadgeCheck className="size-4" />
                        Phả hệ
                      </span>
                    )}
                    {pet.verified && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <ShieldCheck className="size-4" />
                        Xác thực
                      </span>
                    )}
                  </div>

                  {pet.personality && (
                    <p className="text-sm leading-relaxed text-muted-foreground">{pet.personality}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="gap-2" onClick={() => passCandidate(pet.id)}>
                      <X className="size-4" />
                      Không quan tâm
                    </Button>
                    <Button className="gap-2" onClick={() => requestCandidate(pet.id)}>
                      <Heart className="size-4" />
                      Gửi yêu cầu
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h2 className="mb-2 text-2xl font-bold">{title}</h2>
      <p className="mx-auto mb-6 max-w-xl text-muted-foreground">{description}</p>
      <Button asChild>
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
