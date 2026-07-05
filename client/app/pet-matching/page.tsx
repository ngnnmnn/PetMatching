'use client';

import { useState } from 'react';
import { Heart, PawPrint, Plus, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PetDiscovery } from '@/components/pet-discovery';
import { PetProfileForm } from '@/components/pet-profile-form';
import { demoPets } from '@/lib/pet-options';
import { cn } from '@/lib/utils';

export default function PetMatchingPage() {
  const [activeTab, setActiveTab] = useState('discover');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const showTab = (tab: string) => {
    setActiveTab(tab);
    setShowCreateForm(false);
  };

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <a href="/pet-matching" className="flex items-center gap-2 text-xl font-bold">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary">
                <PawPrint className="size-6 text-primary-foreground" />
              </div>
              <span className="hidden sm:inline">PetMatch</span>
            </a>

            <div className="hidden items-center gap-1 md:flex">
              <Button
                variant={activeTab === 'discover' ? 'default' : 'ghost'}
                onClick={() => showTab('discover')}
                className="gap-2"
              >
                <Search className="size-4" />
                Kham pha
              </Button>
              <Button
                variant={activeTab === 'favorites' ? 'default' : 'ghost'}
                onClick={() => showTab('favorites')}
                className="gap-2"
              >
                <Heart className="size-4" />
                Yeu thich
              </Button>
              <Button
                variant={activeTab === 'my-pets' ? 'default' : 'ghost'}
                onClick={() => showTab('my-pets')}
                className="gap-2"
              >
                <PawPrint className="size-4" />
                Thu cung cua toi
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreateForm(true)} className="gap-2">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Tao ho so</span>
              </Button>
              <Button variant="ghost" size="icon" aria-label="Tai khoan">
                <User className="size-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="sticky top-16 z-40 border-b bg-background md:hidden">
        <div className="flex">
          <MobileTab
            active={activeTab === 'discover'}
            onClick={() => showTab('discover')}
            icon={<Search className="mx-auto mb-1 size-4" />}
            label="Kham pha"
          />
          <MobileTab
            active={activeTab === 'favorites'}
            onClick={() => showTab('favorites')}
            icon={<Heart className="mx-auto mb-1 size-4" />}
            label="Yeu thich"
          />
          <MobileTab
            active={activeTab === 'my-pets'}
            onClick={() => showTab('my-pets')}
            icon={<PawPrint className="mx-auto mb-1 size-4" />}
            label="Thu cung"
          />
        </div>
      </div>

      <main>
        {showCreateForm ? (
          <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
              <Button variant="ghost" onClick={() => setShowCreateForm(false)} className="mb-4">
                Quay lai
              </Button>
              <h1 className="mb-2 text-center text-3xl font-bold">Tao ho so thu cung</h1>
              <p className="text-center text-muted-foreground">
                Dien thong tin de bat dau tim ban ghep doi cho be
              </p>
            </div>
            <PetProfileForm onComplete={() => setShowCreateForm(false)} />
          </div>
        ) : activeTab === 'discover' ? (
          <PetDiscovery userPets={demoPets.slice(0, 2)} />
        ) : activeTab === 'favorites' ? (
          <EmptyFavorites onDiscover={() => showTab('discover')} />
        ) : (
          <MyPets onCreate={() => setShowCreateForm(true)} />
        )}
      </main>
    </div>
  );
}

function MobileTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 py-3 text-sm font-medium transition-colors',
        active ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyFavorites({ onDiscover }: { onDiscover: () => void }) {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
        <Heart className="size-10 text-muted-foreground" />
      </div>
      <h2 className="mb-2 text-2xl font-bold">Danh sach yeu thich trong</h2>
      <p className="mb-6 text-muted-foreground">
        Nhan vao trai tim de luu cac be ban quan tam
      </p>
      <Button onClick={onDiscover}>Kham pha ngay</Button>
    </div>
  );
}

function MyPets({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Thu cung cua toi</h2>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="size-4" />
          Them moi
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {demoPets.slice(0, 2).map((pet) => (
          <div
            key={pet.id}
            className="cursor-pointer overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg"
          >
            <div className="aspect-video overflow-hidden">
              <img
                src={pet.avatar || '/placeholder.svg'}
                alt={pet.name}
                className="size-full object-cover"
              />
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold">{pet.name}</h3>
              <p className="text-sm text-muted-foreground">{pet.breed}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pet.gender === 'male' ? 'Duc' : 'Cai'} - {pet.weight} kg
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
