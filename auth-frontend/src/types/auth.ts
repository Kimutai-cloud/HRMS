export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface SendRegisterData {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<{ message: string; email: string }>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
}

// Backend response interfaces
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string | null;
  is_verified: boolean;
  auth_provider: string;
  created_at: string;
}
