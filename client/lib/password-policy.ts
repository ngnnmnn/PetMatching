export const PASSWORD_MIN_LENGTH = 6;

export type PasswordStrength = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  width: string;
  color: string;
};

const EMPTY_PASSWORD_STRENGTH: PasswordStrength = {
  level: 0,
  label: "",
  width: "0%",
  color: "transparent",
};

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return EMPTY_PASSWORD_STRENGTH;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  if (hasLower && hasUpper && hasNumber && hasSpecial) {
    return {
      level: 4,
      label: "Mật khẩu cực mạnh (Rất an toàn)",
      width: "100%",
      color: "#10B981",
    };
  }

  if (hasLower && hasUpper && hasNumber) {
    return {
      level: 3,
      label: "Mật khẩu mạnh",
      width: "75%",
      color: "#3B82F6",
    };
  }

  if (hasLetter && hasNumber) {
    return {
      level: 2,
      label: "Mật khẩu trung bình",
      width: "50%",
      color: "#F59E0B",
    };
  }

  return {
    level: 1,
    label: "Mật khẩu yếu",
    width: "25%",
    color: "#EF4444",
  };
}

export function getPasswordPolicyError(password: string): string | null {
  return password.length < PASSWORD_MIN_LENGTH
    ? `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`
    : null;
}
