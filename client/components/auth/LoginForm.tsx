'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import api from '@/lib/axios';
import { LoginCredentials } from '@/types';
import AuthShell from './AuthShell';

export default function LoginForm() {
  const router = useRouter();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const [formData, setFormData] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', formData);

      if (response.data.success) {
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        window.dispatchEvent(new Event('auth-change'));
        const role = response.data.user?.role;
        if (role === 'ADMIN') {
          router.push('/admin');
        } else if (role === 'STORE_MANAGER' || role === 'SPA_MANAGER') {
          router.push('/manager');
        } else {
          router.push('/home');
        }
      }
    } catch (err: any) {
      const data = err.response?.data;

      if (data?.requiresVerification && data?.email) {
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }

      setError(data?.message || 'Đăng nhập thất bại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full rounded-[24px] border border-[#F0EFEA] bg-[var(--bg-card)] px-6 py-8 shadow-[0_18px_60px_rgba(26,26,26,0.06)] sm:px-10">
        <h1 className="mb-8 text-center text-3xl font-extrabold tracking-normal text-[var(--text-main)]">
          Đăng nhập
        </h1>

        <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
              Email <span className="text-[var(--primary-color)]">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-[15px] text-[var(--text-main)] transition duration-200 ease-in-out placeholder:text-[#B0B0B0] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)]"
              placeholder="Nhập email"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
              Mật khẩu <span className="text-[var(--primary-color)]">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 pr-12 text-[15px] text-[var(--text-main)] transition duration-200 ease-in-out placeholder:text-[#B0B0B0] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)]"
                placeholder="Nhập mật khẩu"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition duration-200 ease-in-out hover:bg-white hover:text-[var(--primary-color)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--primary-color)] py-3.5 text-center font-bold text-white transition duration-200 ease-in-out hover:bg-[#cf5017] hover:shadow-[0_12px_26px_rgba(228,93,28,0.24)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--border-color)]" />
          <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Hoặc</span>
          <span className="h-px flex-1 bg-[var(--border-color)]" />
        </div>

        <a
          href={`${apiBaseUrl}/auth/google`}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-color)] bg-white px-4 py-3.5 text-sm font-bold text-[var(--text-main)] transition duration-200 ease-in-out hover:border-[var(--primary-color)] hover:bg-[var(--bg-demo-box)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-white text-base shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
            G
          </span>
          Đăng nhập bằng Google
        </a>

      </div>

      <p className="mt-6 text-center text-sm font-medium text-[var(--text-muted)]">
        Chưa có tài khoản?{' '}
        <Link
          href="/register"
          className="font-extrabold text-[var(--primary-color)] transition duration-200 ease-in-out hover:text-[#cf5017] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
        >
          Đăng ký ngay
        </Link>
      </p>
    </AuthShell>
  );
}
