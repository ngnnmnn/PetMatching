import { getPasswordStrength } from "@/lib/password-policy";

export default function PasswordStrengthMeter({
  password,
  className = "",
}: {
  password: string;
  className?: string;
}) {
  const strength = getPasswordStrength(password);

  return (
    <div className={`grid gap-1 ${className}`}>
      <div className="h-1 overflow-hidden rounded-full bg-[#ECE7DE]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: strength.width,
            backgroundColor: strength.color,
          }}
        />
      </div>
      <p
        className="min-h-4 text-[11px] font-semibold leading-4"
        style={{
          color:
            strength.color === "transparent"
              ? "var(--text-muted)"
              : strength.color,
        }}
      >
        {strength.label || "Nhập mật khẩu mới để kiểm tra độ mạnh"}
      </p>
    </div>
  );
}
