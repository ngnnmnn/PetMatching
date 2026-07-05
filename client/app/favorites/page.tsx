'use client';

import { Heart, Search } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/button';

export default function FavoritesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader sectionLabel="Yêu thích" />
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
          <Heart className="size-10 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-3xl font-bold">Danh sách yêu thích</h1>
        <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
          Các hồ sơ bạn đã lưu sẽ hiển thị tại đây. Tính năng lưu yêu thích sẽ được nối với backend sau bước matching MVP.
        </p>
        <Button className="gap-2" asChild>
          <Link href="/explore">
            <Search className="size-4" />
            Khám phá hồ sơ
          </Link>
        </Button>
      </section>
    </main>
  );
}
