'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StorePage from '@/components/home/StorePage';

export default function HomeRoute() {
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const user = storedUser ? (JSON.parse(storedUser) as { role?: string }) : null;

    if (user?.role === 'ADMIN') {
      router.replace('/admin');
    } else if (user?.role === 'STORE_MANAGER' || user?.role === 'SPA_MANAGER') {
      router.replace('/manager');
    }
  }, [router]);

  return <StorePage />;
}
