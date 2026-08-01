'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RequestsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/messages');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
    </div>
  );
}
