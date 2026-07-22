'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/auth/AuthShell';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.';
}

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Đang hoàn tất đăng nhập Google...');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const completeLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const error = params.get('error');

      if (error) {
        console.error('Google login returned error:', error);
        throw new Error(decodeURIComponent(error));
      }

      if (!token) {
        console.error('Google login callback: token is missing in URL');
        throw new Error('Không nhận được mã đăng nhập từ Google.');
      }

      console.log('Google login token received:', token);
      localStorage.setItem('accessToken', token);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);

      try {
        console.log('Verifying Google token with backend at:', `${API_BASE_URL}/auth/verify`);
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const data = await response.json();
        console.log('Verification response status:', response.status, data);

        if (!response.ok || !data.user) {
          throw new Error(data.message || 'Token đăng nhập không hợp lệ.');
        }

        console.log('Google token verified successfully. User:', data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.dispatchEvent(new Event('auth-change'));

        const redirectUrl = params.get('redirect') || localStorage.getItem('login_redirect_url');
        localStorage.removeItem('login_redirect_url');

        console.log('Redirecting to target URL:', redirectUrl || '/home');
        if (redirectUrl) {
          if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
            window.location.replace(redirectUrl);
          } else {
            router.replace(redirectUrl);
          }
        } else {
          router.replace('/home');
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    completeLogin().catch((error) => {
      console.error('Google login callback caught exception:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      setHasError(true);
      setMessage(getErrorMessage(error));
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-page)] px-5 text-[var(--text-main)]">
      <div className="w-full max-w-[420px] rounded-[24px] border border-[#F0EFEA] bg-white px-8 py-10 text-center shadow-[0_18px_60px_rgba(26,26,26,0.06)]">
        <div className="mb-5 flex justify-center">
          <BrandMark size="lg" />
        </div>
        <h1 className="mb-3 text-2xl font-extrabold">
          {hasError ? 'Đăng nhập thất bại' : 'Đang đăng nhập'}
        </h1>
        <p className="text-sm font-medium text-[var(--text-muted)]">{message}</p>

        {hasError && (
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-xl bg-[var(--primary-color)] px-5 py-3 text-sm font-bold text-white transition duration-200 ease-in-out hover:bg-[#cf5017] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.22)]"
          >
            Quay lại đăng nhập
          </Link>
        )}
      </div>
    </main>
  );
}
