import axios from "axios";
import { toast } from "sonner";

let isRedirectingToLogin = false;

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthRequest =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/verify-email") ||
      url.includes("/auth/resend-otp") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password") ||
      url.includes("/auth/complete-google-profile");

    if (error.response?.status === 401 && !isAuthRequest) {
      const errorCode = error.response?.data?.code;
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      if (typeof window !== "undefined" && !isRedirectingToLogin) {
        isRedirectingToLogin = true;
        if (errorCode === "ACCOUNT_SUSPENDED") {
          toast.error("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.");
        }
        sessionStorage.setItem(
          "auth_notice",
          errorCode === "ACCOUNT_SUSPENDED"
            ? "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên."
            : "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        );
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
