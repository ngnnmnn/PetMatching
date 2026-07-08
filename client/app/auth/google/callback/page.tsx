'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/auth/AuthShell';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.';
}

export default function GoogleCallbackPage() {
  const [message, setMessage] = useState('Đang hoàn tất đăng nhập Google...');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const completeLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const error = params.get('error');

      if (error) {
        throw new Error(decodeURIComponent(error));
      }

      if (!token) {
        throw new Error('Không nhận được mã đăng nhập từ Google.');
      }

      localStorage.setItem('accessToken', token);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const data = await response.json();
        if (!response.ok || !data.user) {
          throw new Error(data.message || 'Token đăng nhập không hợp lệ.');
        }

        localStorage.setItem('user', JSON.stringify(data.user));
        window.dispatchEvent(new Event('auth-change'));
        window.location.replace('/home');
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    completeLogin().catch((error) => {
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
