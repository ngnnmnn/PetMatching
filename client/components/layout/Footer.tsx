'use client';

import { useEffect, useState } from 'react';
import { Facebook, Instagram, Mail, MapPin, PawPrint, Youtube } from 'lucide-react';
import Link from 'next/link';
import { spaApi } from '@/lib/api/spa';
import { AddressSpaType } from '@/types';

export default function Footer() {
  const [spaAddresses, setSpaAddresses] = useState<AddressSpaType[]>([]);

  useEffect(() => {
    spaApi.getSpaAddresses()
      .then((res) => {
        setSpaAddresses(res.data || []);
      })
      .catch(() => {
        setSpaAddresses([]);
      });
  }, []);

  return (
    <footer className="bg-[var(--text-main)] text-[var(--bg-page)] mt-16 rounded-t-3xl overflow-hidden">
      <div className="mx-auto max-w-[1440px] px-4 py-14 md:px-6 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary-color)] text-white shadow-md">
              <PawPrint className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">PetMatchAndStore</span>
          </div>
          <p className="mt-4 text-sm text-[var(--bg-page)]/70 leading-relaxed max-w-xs">
            Cửa hàng phụ kiện thú cưng hiện đại — đồng hành cùng bạn chăm sóc người bạn bốn chân.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">Liên kết nhanh</h4>
          <ul className="space-y-2.5 text-sm text-[var(--bg-page)]/75">
            <li>
              <Link href="/home" className="transition hover:text-[var(--primary-color)]">
                Trang chủ
              </Link>
            </li>
            <li>
              <Link href="/match" className="transition hover:text-[var(--primary-color)]">
                Ghép đôi thú cưng
              </Link>
            </li>
            <li>
              <Link href="/profile" className="transition hover:text-[var(--primary-color)]">
                Tài khoản
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">Liên hệ & Chi nhánh Spa</h4>
          <ul className="space-y-3 text-sm text-[var(--bg-page)]/75">
            {spaAddresses.length > 0 ? (
              spaAddresses.map((spa) => (
                <li key={spa.id} className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[var(--primary-color)]" />
                  <div>
                    <span className="font-bold text-white block">{spa.name}</span>
                    <span className="text-xs block">{spa.address}</span>
                    {spa.phone && <span className="text-xs text-white/80 block mt-0.5">SĐT: {spa.phone}</span>}
                  </div>
                </li>
              ))
            ) : (
              <li className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[var(--primary-color)]" />
                <div>
                  <span className="font-bold text-white block">PetMatch Spa</span>
                  <span className="text-xs">Chi nhánh PetMatching</span>
                </div>
              </li>
            )}
            <li className="flex items-center gap-2.5 pt-1">
              <Mail className="h-4 w-4 shrink-0 text-[var(--primary-color)]" />
              <span>petmatch@fpt.edu.vn</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">Mạng xã hội</h4>
          <div className="flex gap-3">
            {[Facebook, Instagram, Youtube].map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="Social Link"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-[var(--bg-page)] hover:bg-[var(--primary-color)] hover:text-white hover:scale-110 transition-all shadow-sm"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/10">
        <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-6 text-xs text-[var(--bg-page)]/50 flex flex-wrap items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} PetMatchAndStore. Mọi quyền được bảo lưu.</span>
          <span>Made with ♥ for pets</span>
        </div>
      </div>
    </footer>
  );
}
