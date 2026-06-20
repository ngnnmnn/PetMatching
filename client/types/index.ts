export interface User {
  id: number;
  username: string;
  role: string;
  displayName: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}