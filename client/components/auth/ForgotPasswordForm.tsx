'use client';

import axios from 'axios';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import api from '@/lib/axios';
import AuthShell from './AuthShell';

const SUCCESS_MESSAGE =
  'Vui lòng kiểm tra email. Nếu địa chỉ này được liên kết với tài khoản PetMatching, bạn sẽ nhận được liên kết đặt lại mật khẩu.';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post<{ message?: string }>(
        '/auth/forgot-password',
        { email },
      );
      setMessage(response.data.message || SUCCESS_MESSAGE);
    } catch (requestError: unknown) {
      if (axios.isAxiosError<{ message?: string | string[] }>(requestError)) {
        const responseMessage = requestError.response?.data?.message;
        setError(
          Array.isArray(responseMessage)
            ? responseMessage.join(' ')
            : responseMessage || 'Không thể gửi yêu cầu. Vui lòng thử lại.',
        );
      } else {
        setError('Không thể gửi yêu cầu. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full rounded-[24px] border border-[#F0EFEA] bg-[var(--bg-card)] px-6 py-8 shadow-[0_18px_60px_rgba(26,26,26,0.06)] sm:px-10">
        <h1 className="text-center text-3xl font-extrabold text-[var(--text-main)]">
          Quên mật khẩu
        </h1>
        <p className="mb-7 mt-3 text-center text-sm leading-6 text-[var(--text-muted)]">
          Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
              Email <span className="text-[var(--primary-color)]">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="Nhập email đã đăng ký"
              required
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)]"
            />
          </div>

          {message && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm font-medium leading-6 text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--primary-color)] py-3.5 font-bold text-white transition hover:bg-[#cf5017] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại mật khẩu'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm font-medium">
        <Link
          href="/login"
          className="font-extrabold text-[var(--primary-color)] hover:underline"
        >
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}
