'use client';

import Link from 'next/link';
import { PawPrint } from 'lucide-react';

type AuthShellProps = {
  children: React.ReactNode;
};

export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'size-9',
    md: 'size-14',
    lg: 'size-20',
  };

  const iconSizes = {
    sm: 'size-5',
    md: 'size-7',
    lg: 'size-10',
  };

  return (
    <span
      className={`${sizes[size]} inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--primary-color)] text-white shadow-[0_12px_28px_rgba(228,93,28,0.22)]`}
      aria-hidden="true"
    >
      <PawPrint className={iconSizes[size]} strokeWidth={2.6} />
    </span>
  );
}

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[var(--bg-page)] font-[Inter,Outfit,ui-sans-serif,system-ui,sans-serif] text-[var(--text-main)]">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:flex-nowrap sm:px-8 lg:px-12">
        <Link
          href="/"
          className="inline-flex items-center gap-3 rounded-full text-[var(--text-main)] transition duration-200 ease-in-out hover:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.18)]"
        >
          <BrandMark size="sm" />
          <span className="text-xl font-extrabold tracking-normal">PetMatch</span>
        </Link>

        <nav className="ml-auto flex items-center gap-2 sm:gap-3" aria-label="Authentication navigation">
          <Link
            href="/"
            className="rounded-full bg-[var(--primary-color)] px-4 py-2.5 text-sm font-bold text-white transition duration-200 ease-in-out hover:bg-[#cf5017] hover:shadow-[0_10px_22px_rgba(228,93,28,0.22)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.22)] sm:px-6"
          >
            + Tạo hồ sơ
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--primary-color)] bg-transparent px-4 py-2.5 text-sm font-bold text-[var(--primary-color)] transition duration-200 ease-in-out hover:bg-[var(--bg-demo-box)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.18)] sm:px-6"
          >
            Đăng nhập
          </Link>
        </nav>
      </header>

      <section className="flex min-h-[calc(100vh-88px)] items-center justify-center px-5 py-8 sm:px-6">
        <div className="w-full max-w-[460px]">
          <div className="mb-5 flex flex-col items-center gap-4 text-center">
            <Link
              href="/login"
              className="text-sm font-semibold text-[var(--text-muted)] transition duration-200 ease-in-out hover:text-[var(--primary-color)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
            >
              ← Quay lại trang chủ
            </Link>
            <BrandMark size="lg" />
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
