import { 
  type LoginCredentials, 
  type RegisterData, 
  type SendRegisterData, 
  type AuthResponse, 
  type UserResponse,
  type AuthTokens,
  type User 
} from '../types/auth';

class AuthService {
  private baseURL = "http://localhost:8000/api/v1";
  private tokens: AuthTokens | null = null;
  private readonly ACCESS_TOKEN_KEY = 'hrms_access_token';
  private readonly REFRESH_TOKEN_KEY = 'hrms_refresh_token';
  private readonly TOKEN_TYPE_KEY = 'hrms_token_type';

  constructor() {
    // Load tokens from localStorage on initialization
    this.loadTokensFromStorage();
  }

  private loadTokensFromStorage() {
    try {
      const accessToken = localStorage.getItem(this.ACCESS_TOKEN_KEY);
      const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
      const tokenType = localStorage.getItem(this.TOKEN_TYPE_KEY);
      
      if (accessToken && refreshToken) {
        this.tokens = {
          accessToken,
          refreshToken,
          tokenType: tokenType || 'bearer'
        };
      }
    } catch (error) {
      console.error('Error loading tokens from storage:', error);
      this.clearTokens();
    }
  }

  private saveTokensToStorage(tokens: AuthTokens) {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken);
      localStorage.setItem(this.TOKEN_TYPE_KEY, tokens.tokenType);
    } catch (error) {
      console.error('Error saving tokens to storage:', error);
    }
  }

  private clearTokensFromStorage() {
    try {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.TOKEN_TYPE_KEY);
    } catch (error) {
      console.error('Error clearing tokens from storage:', error);
    }
  }

  setTokens(tokens: AuthTokens) {
    this.tokens = tokens;
    this.saveTokensToStorage(tokens);
  }

  getAccessToken(): string | null {
    return this.tokens?.accessToken || null;
  }

  clearTokens() {
    this.tokens = null;
    this.clearTokensFromStorage();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const token = this.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorDetail = "Network error occurred";
      try {
        const errorResponse = await response.json();
        errorDetail = errorResponse.detail || errorResponse.message || JSON.stringify(errorResponse);
      } catch (e) {
        console.error("Could not parse error response:", e);
      }
      
      throw new Error(errorDetail);
    }

    const responseData = await response.json();
    return responseData;
  }

  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    const tokens: AuthTokens = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenType: response.token_type,
    };

    const user: User = {
      id: response.user.id,
      email: response.user.email,
      firstName: this.extractFirstName(response.user.full_name),
      lastName: this.extractLastName(response.user.full_name),
      isEmailVerified: response.user.is_verified,
    };

    this.setTokens(tokens);
    return { user, tokens };
  }

  async register(data: RegisterData): Promise<{ message: string; email: string }> {
    const backendData: SendRegisterData = {
      email: data.email,
      password: data.password,
      full_name: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
    };

    const response = await this.request<UserResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(backendData),
    });

    return {
      message: "Account created successfully! Please check your email to verify your account.",
      email: response.email
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await this.request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });

    return response;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.request<UserResponse>("/users/me");
    
    return {
      id: response.id,
      email: response.email,
      firstName: this.extractFirstName(response.full_name),
      lastName: this.extractLastName(response.full_name),
      isEmailVerified: response.is_verified,
    };
  }

  async refreshTokens(): Promise<AuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await this.request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: this.tokens.refreshToken }),
    });

    const tokens: AuthTokens = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      tokenType: response.token_type,
    };

    this.setTokens(tokens);
    return tokens;
  }

  private extractFirstName(fullName: string | null | undefined): string {
    if (!fullName) return "";
    const parts = fullName.trim().split(" ");
    return parts[0] || "";
  }

  private extractLastName(fullName: string | null | undefined): string {
    if (!fullName) return "";
    const parts = fullName.trim().split(" ");
    return parts.slice(1).join(" ") || "";
  }
}

export default AuthService;
