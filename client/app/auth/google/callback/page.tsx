"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/auth/AuthShell";
import api from "@/lib/axios";
import type { User } from "@/types";

type VerifyResponse = { user?: User; message?: string };

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message || "Không thể hoàn tất đăng nhập Google."
    );
  }
  return error instanceof Error
    ? error.message
    : "Không thể hoàn tất đăng nhập Google.";
}

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập Google...");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const completeLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      if (error) throw new Error(error);

      const redirect = params.get("redirect") || "";
      const profileToken = params.get("profileToken");
      if (profileToken) {
        const onboardingParams = new URLSearchParams({
          profileToken,
          email: params.get("email") || "",
          suggestedName: params.get("suggestedName") || "",
          needsPassword: params.get("needsPassword") || "true",
        });
        if (redirect) onboardingParams.set("redirect", redirect);
        router.replace(`/complete-profile?${onboardingParams.toString()}`);
        return;
      }

      const token = params.get("token");
      if (!token) throw new Error("Không nhận được mã đăng nhập từ Google.");

      const response = await api.get<VerifyResponse>("/auth/verify", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.data.user) throw new Error("Token đăng nhập không hợp lệ.");

      localStorage.setItem("accessToken", token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      window.dispatchEvent(new Event("auth-change"));
      localStorage.removeItem("login_redirect_url");

      const role = response.data.user.role;
      if (role === "ADMIN") router.replace("/admin");
      else if (role === "STORE_MANAGER" || role === "SPA_MANAGER")
        router.replace("/manager");
      else if (role === "SPA_STAFF") router.replace("/spa/staff");
      else if (redirect) router.replace(redirect);
      else router.replace("/home");
    };

    completeLogin().catch((error: unknown) => {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      setHasError(true);
      setMessage(getErrorMessage(error));
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-page)] px-5 text-[var(--text-main)]">
      <div className="w-full max-w-[420px] rounded-[24px] border border-[#F0EFEA] bg-white px-8 py-10 text-center shadow-[0_18px_60px_rgba(26,26,26,0.06)]">
        <div className="mb-5 flex justify-center">
          <BrandMark size="lg" />
        </div>
        <h1 className="mb-3 text-2xl font-extrabold">
          {hasError ? "Đăng nhập thất bại" : "Đang đăng nhập"}
        </h1>
        <p className="text-sm font-medium text-[var(--text-muted)]">
          {message}
        </p>
        {hasError && (
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-xl bg-[var(--primary-color)] px-5 py-3 text-sm font-bold text-white hover:bg-[#cf5017]"
          >
            Quay lại đăng nhập
          </Link>
        )}
      </div>
    </main>
  );
}
