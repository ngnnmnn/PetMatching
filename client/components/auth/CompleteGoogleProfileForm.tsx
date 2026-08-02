"use client";

import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import AuthShell from "./AuthShell";
import type { AuthResponse } from "@/types";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import {
  getPasswordPolicyError,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password-policy";

export default function CompleteGoogleProfileForm() {
  const router = useRouter();
  const params = useSearchParams();
  const profileToken = params.get("profileToken") || "";
  const email = params.get("email") || "";
  const needsPassword = params.get("needsPassword") !== "false";
  const [username, setUsername] = useState("");
  const [name, setName] = useState(params.get("suggestedName") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileToken || loading) return;
    setError("");

    if (needsPassword && password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (needsPassword) {
      const policyError = getPasswordPolicyError(password);
      if (policyError) {
        setError(policyError);
        return;
      }
    }

    setLoading(true);
    try {
      const response = await api.post<AuthResponse>(
        "/auth/complete-google-profile",
        {
          profileToken,
          username,
          name,
          ...(needsPassword ? { password, confirmPassword } : {}),
        },
      );
      if (!response.data.accessToken || !response.data.user) {
        throw new Error("Không thể hoàn tất tài khoản.");
      }

      localStorage.setItem("accessToken", response.data.accessToken);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      window.dispatchEvent(new Event("auth-change"));
      router.replace(params.get("redirect") || "/home");
    } catch (requestError: unknown) {
      if (axios.isAxiosError<{ message?: string | string[] }>(requestError)) {
        const message = requestError.response?.data?.message;
        setError(
          Array.isArray(message)
            ? message.join(" ")
            : message || "Không thể hoàn tất tài khoản.",
        );
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Không thể hoàn tất tài khoản.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (!profileToken) {
    return (
      <AuthShell>
        <div className="rounded-2xl bg-red-50 p-5 text-center font-medium text-red-600">
          Phiên hoàn thiện tài khoản không hợp lệ. Vui lòng đăng nhập Google
          lại.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="w-full rounded-[24px] border border-[#F0EFEA] bg-[var(--bg-card)] px-6 py-8 shadow-[0_18px_60px_rgba(26,26,26,0.06)] sm:px-10">
        <h1 className="text-center text-3xl font-extrabold text-[var(--text-main)]">
          Hoàn tất tài khoản
        </h1>
        <p className="mb-7 mt-3 text-center text-sm text-[var(--text-muted)]">
          Tạo thông tin đăng nhập PetMatching để có thể dùng cả Google và mật
          khẩu.
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Email Google" value={email} disabled />
          <Field
            label="Tên đăng nhập"
            value={username}
            onChange={setUsername}
            minLength={4}
            maxLength={30}
            pattern="[a-zA-Z0-9._]+"
            autoComplete="username"
          />
          <Field
            label="Tên hiển thị"
            value={name}
            onChange={setName}
            minLength={2}
            maxLength={80}
            autoComplete="name"
          />
          {needsPassword && (
            <>
              <PasswordField
                label="Mật khẩu"
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
              <PasswordStrengthMeter password={password} className="-mt-3" />
              <PasswordField
                label="Xác nhận mật khẩu"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
            </>
          )}
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--primary-color)] py-3.5 font-bold text-white hover:bg-[#cf5017] disabled:opacity-60"
          >
            {loading ? "Đang hoàn tất..." : "Hoàn tất tài khoản"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  autoComplete?: string;
};

function Field({
  label,
  value,
  onChange,
  disabled,
  ...inputProps
}: FieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-[var(--text-main)]">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
        required={!disabled}
        {...inputProps}
        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 text-[15px] focus:border-[var(--primary-color)] focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)] disabled:opacity-70"
      />
    </div>
  );
}

function PasswordField({
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
        {label}
      </label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          required
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-4 py-3 pr-12 focus:border-[var(--primary-color)] focus:outline-none focus:ring-4 focus:ring-[rgba(228,93,28,0.14)]"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
