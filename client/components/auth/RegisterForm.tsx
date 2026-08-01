"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import axios from "axios";
import api from "@/lib/axios";
import { RegisterData } from "@/types";
import AuthShell from "./AuthShell";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import {
  getPasswordPolicyError,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password-policy";

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  const redirectParam = searchParams.get("redirect");
  const googleLoginUrl = redirectParam
    ? `${apiBaseUrl}/auth/google?redirect=${encodeURIComponent(redirectParam)}`
    : `${apiBaseUrl}/auth/google`;
  const [formData, setFormData] = useState<
    RegisterData & { confirmPassword: string }
  >({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp!");
      return;
    }

    const policyError = getPasswordPolicyError(formData.password);
    if (policyError) {
      setError(policyError);
      return;
    }

    setLoading(true);

    try {
      const registerData: RegisterData = {
        email: formData.email,
        username: formData.username,
        password: formData.password,
        name: formData.name,
      };
      const response = await api.post("/auth/register", registerData);

      if (response.data.success) {
        router.push(
          `/verify-email?email=${encodeURIComponent(response.data.email || registerData.email)}`,
        );
        return;
      }

      setError(
        response.data.message || "Không thể tạo tài khoản. Vui lòng thử lại.",
      );
    } catch (requestError: unknown) {
      const response = axios.isAxiosError<{
        message?: string | string[];
      }>(requestError)
        ? requestError.response
        : undefined;
      const message = response?.data?.message;
      if (Array.isArray(message)) {
        setError(message.join(" "));
      } else if (message) {
        setError(message);
      } else if (axios.isAxiosError(requestError) && requestError.request) {
        setError(
          "Không kết nối được tới server. Vui lòng kiểm tra backend đang chạy ở port 5000.",
        );
      } else {
        setError("Đăng ký thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full rounded-[24px] border border-[#F0EFEA] bg-[var(--bg-card)] px-6 py-8 shadow-[0_18px_60px_rgba(26,26,26,0.06)] sm:px-10">
        <h1 className="mb-8 text-center text-3xl font-extrabold tracking-normal text-[var(--text-main)]">
          Tạo tài khoản
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
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
              Tên đăng nhập{" "}
              <span className="text-[var(--primary-color)]">*</span>
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-[15px] text-[var(--text-main)] transition duration-200 ease-in-out placeholder:text-[#B0B0B0] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)]"
              placeholder="4–30 ký tự: chữ, số, dấu chấm hoặc gạch dưới"
              autoComplete="username"
              minLength={4}
              maxLength={30}
              pattern="[a-zA-Z0-9._]+"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
              Tên hiển thị{" "}
              <span className="text-[var(--primary-color)]">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-[15px] text-[var(--text-main)] transition duration-200 ease-in-out placeholder:text-[#B0B0B0] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)]"
              placeholder="Nhập tên hiển thị"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
              Mật khẩu <span className="text-[var(--primary-color)]">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 pr-12 text-[15px] text-[var(--text-main)] transition duration-200 ease-in-out placeholder:text-[#B0B0B0] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)]"
                placeholder={`Nhập mật khẩu (ít nhất ${PASSWORD_MIN_LENGTH} ký tự)`}
                required
                minLength={PASSWORD_MIN_LENGTH}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition duration-200 ease-in-out hover:bg-white hover:text-[var(--primary-color)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <PasswordStrengthMeter
              password={formData.password}
              className="mt-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
              Xác nhận mật khẩu{" "}
              <span className="text-[var(--primary-color)]">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 pr-12 text-[15px] text-[var(--text-main)] transition duration-200 ease-in-out placeholder:text-[#B0B0B0] focus:border-[var(--primary-color)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)]"
                placeholder="Nhập lại mật khẩu"
                required
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition duration-200 ease-in-out hover:bg-white hover:text-[var(--primary-color)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
                aria-label={
                  showConfirmPassword
                    ? "Ẩn mật khẩu xác nhận"
                    : "Hiện mật khẩu xác nhận"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
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
            {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[var(--border-color)]" />
          <span className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Hoặc
          </span>
          <span className="h-px flex-1 bg-[var(--border-color)]" />
        </div>

        <a
          href={googleLoginUrl}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--border-color)] bg-white px-4 py-3.5 text-sm font-bold text-[var(--text-main)] transition duration-200 ease-in-out hover:border-[var(--primary-color)] hover:bg-[var(--bg-demo-box)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-white text-base shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
            G
          </span>
          Đăng ký bằng Google
        </a>
      </div>

      <p className="mt-6 text-center text-sm font-medium text-[var(--text-muted)]">
        Đã có tài khoản?{" "}
        <Link
          href={
            redirectParam
              ? `/login?redirect=${encodeURIComponent(redirectParam)}`
              : "/login"
          }
          className="font-extrabold text-[var(--primary-color)] transition duration-200 ease-in-out hover:text-[#cf5017] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(228,93,28,0.16)]"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}
