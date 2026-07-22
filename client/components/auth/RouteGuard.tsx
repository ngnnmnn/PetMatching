'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const PRIVATE_ROUTES = [
  '/explore',
  '/requests',
  '/messages',
  '/my-pets',
  '/cart',
  '/checkout',
  '/favorites',
  '/orders',
  '/profile',
  '/spa',
  '/admin',
  '/manager',
];

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const isPrivateRoute = PRIVATE_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      );

      if (isPrivateRoute && !token) {
        setAuthorized(false);
        router.replace(`/login?redirect=${encodeURIComponent(pathname + window.location.search)}`);
      } else {
        setAuthorized(true);
      }
    };

    checkAuth();

    const handleAuthChange = () => checkAuth();
    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, [pathname, router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)]">
        <div className="size-8 animate-spin rounded-full border-[3px] border-[var(--primary-color)] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
