'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import api from '@/lib/axios';
import AuthShell from './AuthShell';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown]);

  const getErrorMessage = (err: any, fallback: string) => {
    const message = err.response?.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    return message || fallback;
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError('Thiếu email cần xác thực.');
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError('Vui lòng nhập mã OTP gồm 6 chữ số.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/verify-email', { email, otp });

      if (response.data.success) {
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        window.dispatchEvent(new Event('auth-change'));
        router.push('/home');
      }
    } catch (err: any) {
      setError(getErrorMessage(err, 'Xác thực email thất bại.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');

    if (!email) {
      setError('Thiếu email cần gửi lại mã.');
      return;
    }

    setResending(true);

    try {
      const response = await api.post('/auth/resend-otp', { email });
      setMessage(response.data.message || 'Mã OTP mới đã được gửi.');
      setOtp('');
      setCountdown(30);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Không thể gửi lại mã OTP.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full rounded-[24px] border border-[#F0EFEA] bg-[var(--bg-card)] px-6 py-8 shadow-[0_18px_60px_rgba(26,26,26,0.06)] sm:px-10">
        <div className="mb-6 flex justify-center">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-[var(--bg-demo-box)] text-[var(--primary-color)]">
            <MailCheck className="size-7" strokeWidth={2.4} />
          </span>
        </div>

        <h1 className="mb-3 text-center text-3xl font-extrabold tracking-normal text-[var(--text-main)]">
          Xác thực email
        </h1>
        <p className="mb-8 text-center text-sm font-medium leading-6 text-[var(--text-muted)]">
          Chúng tôi đã gửi mã 6 số đến:{' '}
          <span className="font-extrabold text-[var(--text-main)]">{email || 'email của bạn'}</span>
        </p>

        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="mb-3 block text-center text-sm font-bold text-[var(--text-main)]">
              Mã OTP
            </label>
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => setOtp(value.replace(/\D/g, ''))}
              containerClassName="justify-center gap-2"
            >
              <InputOTPGroup className="gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="h-12 w-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] text-lg font-extrabold text-[var(--text-main)] shadow-none first:rounded-xl last:rounded-xl data-[active=true]:border-[var(--primary-color)] data-[active=true]:ring-[rgba(228,93,28,0.16)] sm:w-12"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--primary-color)] py-3.5 text-center font-bold text-white transition duration-200 ease-in-out hover:bg-[#cf5017] hover:shadow-[0_12px_26px_rgba(228,93,28,0.24)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Đang xác nhận...' : 'Xác nhận'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending || countdown > 0}
          className="mt-4 w-full rounded-xl border border-[var(--border-color)] bg-white px-4 py-3 text-sm font-bold text-[var(--text-main)] transition duration-200 ease-in-out hover:border-[var(--primary-color)] hover:bg-[var(--bg-demo-box)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending
            ? 'Đang gửi lại mã...'
            : countdown > 0
              ? `Gửi lại mã sau ${countdown}s`
              : 'Gửi lại mã'}
        </button>
      </div>

      <p className="mt-6 text-center text-sm font-medium text-[var(--text-muted)]">
        Đã xác thực rồi?{' '}
        <Link
          href="/login"
          className="font-extrabold text-[var(--primary-color)] transition duration-200 ease-in-out hover:text-[#cf5017] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}
