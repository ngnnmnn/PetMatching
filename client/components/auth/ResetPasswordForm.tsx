'use client';

import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import {
  getPasswordPolicyError,
  PASSWORD_MIN_LENGTH,
} from '@/lib/password-policy';
import AuthShell from './AuthShell';
import PasswordStrengthMeter from './PasswordStrengthMeter';

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !token) return;

    setError('');
    const policyError = getPasswordPolicyError(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword,
      });
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError: unknown) {
      if (axios.isAxiosError<{ message?: string | string[] }>(requestError)) {
        const responseMessage = requestError.response?.data?.message;
        setError(
          Array.isArray(responseMessage)
            ? responseMessage.join(' ')
            : responseMessage || 'Không thể đặt lại mật khẩu.',
        );
      } else {
        setError('Không thể đặt lại mật khẩu. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full rounded-[24px] border border-[#F0EFEA] bg-[var(--bg-card)] px-6 py-8 shadow-[0_18px_60px_rgba(26,26,26,0.06)] sm:px-10">
        <h1 className="text-center text-3xl font-extrabold text-[var(--text-main)]">
          Đặt lại mật khẩu
        </h1>
        <p className="mb-7 mt-3 text-center text-sm leading-6 text-[var(--text-muted)]">
          Tạo mật khẩu mới cho tài khoản PetMatching của bạn.
        </p>

        {!token ? (
          <InvalidLinkMessage />
        ) : success ? (
          <div className="space-y-5">
            <div className="rounded-xl bg-emerald-50 p-4 text-sm font-medium leading-6 text-emerald-700">
              Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.
            </div>
            <Link
              href="/login"
              className="block w-full rounded-xl bg-[var(--primary-color)] py-3.5 text-center font-bold text-white hover:bg-[#cf5017]"
            >
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <PasswordInput
              label="Mật khẩu mới"
              value={newPassword}
              visible={showNewPassword}
              onChange={setNewPassword}
              onToggle={() => setShowNewPassword((value) => !value)}
            />
            <PasswordStrengthMeter password={newPassword} className="-mt-3" />
            <PasswordInput
              label="Xác nhận mật khẩu"
              value={confirmPassword}
              visible={showConfirmPassword}
              onChange={setConfirmPassword}
              onToggle={() => setShowConfirmPassword((value) => !value)}
            />

            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--primary-color)] py-3.5 font-bold text-white hover:bg-[#cf5017] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

function InvalidLinkMessage() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-red-50 p-4 text-sm font-medium leading-6 text-red-600">
        Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
      </div>
      <Link
        href="/forgot-password"
        className="block w-full rounded-xl bg-[var(--primary-color)] py-3.5 text-center font-bold text-white hover:bg-[#cf5017]"
      >
        Gửi lại liên kết
      </Link>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  visible,
  onChange,
  onToggle,
}: {
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
        {label} <span className="text-[var(--primary-color)]">*</span>
      </label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          required
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 pr-12 focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)]"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center text-[var(--text-muted)]"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
