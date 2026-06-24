export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  phone?: string;
  isVerified: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  accessToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
}