'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) as { role?: string } : null;

    router.replace(token ? (user?.role === 'ADMIN' ? '/admin' : '/home') : '/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-page)' }}>
      <div className="size-8 animate-spin rounded-full border-[3px] border-[var(--primary-color)] border-t-transparent" />
    </div>
  );
}
