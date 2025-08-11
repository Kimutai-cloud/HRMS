import React, {createContext, useContext, useState, useEffect, type ReactNode,} from "react";
import {Eye, EyeOff, Mail, Lock, User, Loader2, CheckCircle, AlertCircle,} from "lucide-react";
import "./App.css";

function App() {
    // =============================================================================
    // TYPES AND INTERFACES
    // =============================================================================

    // These interfaces match your FastAPI DTOs - this is crucial for type safety
    interface User {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      isEmailVerified: boolean;
    }

    interface AuthTokens {
      accessToken: string;
      refreshToken: string;
      tokenType: string;
    }

    interface LoginCredentials {
      email: string;
      password: string;
    }

    // Frontend form data structure (what the user fills in)
    interface RegisterData {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }

    // Backend API structure (what gets sent to the server)
    interface SendRegisterData {
      email: string;
      password: string;
      full_name: string; // This is what the backend expects
    }

    interface AuthContextType {
      user: User | null;
      loading: boolean;
      login: (credentials: LoginCredentials) => Promise<void>;
      register: (data: RegisterData) => Promise<void>;
      logout: () => void;
      refreshToken: () => Promise<void>;
    }

    // =============================================================================
    // API CLIENT - This encapsulates all backend communication
    // =============================================================================

    class AuthAPI {
      private baseURL = "http://127.0.0.1:8000/api/v1";
      private tokens: AuthTokens | null = null;

      setTokens(tokens: AuthTokens) {
        this.tokens = tokens;
      }

      getAccessToken(): string | null {
        return this.tokens?.accessToken || null;
      }

      clearTokens() {
        this.tokens = null;
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
        

        console.log("🔍 Making request to:", url);
        console.log("🔍 Method:", options.method || "GET");
        console.log("🔍 Headers:", headers);
        if (options.body) {
          console.log("🔍 Body:", options.body);
        }

        const response = await fetch(url, {
          ...options,
          headers,
        });

        console.log("🔍 Response status:", response.status);
        console.log("🔍 Response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          let errorDetail = "Network error occurred";
          try {
            const errorResponse = await response.json();
            errorDetail = errorResponse.detail || errorResponse.message || JSON.stringify(errorResponse);
            console.error("🔍 Error response body:", errorResponse);
          } catch (e) {
            console.error("🔍 Could not parse error response:", e);
          }
          
          console.error("🔍 Full error details:", {
            status: response.status,
            statusText: response.statusText,
            url: url,
            method: options.method || "GET",
            detail: errorDetail
          });
          
          throw new Error(`HTTP ${response.status}: ${errorDetail}`);
        }

        const responseData = await response.json();
        console.log("🔍 Success response:", responseData);
        return responseData;
      }

      async login(
        credentials: LoginCredentials
      ): Promise<{ user: User; tokens: AuthTokens }> {
        const response = await this.request<{ user: User; tokens: AuthTokens }>(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify(credentials),
          }
        );

        this.setTokens(response.tokens);
        return response;
      }

      async register(
        data: RegisterData
      ): Promise<{ user: User; tokens: AuthTokens }> {
        // Transform the frontend data to match backend expectations
        // This is the key change - we concatenate firstName and lastName into full_name
        const backendData: SendRegisterData = {
          email: data.email,
          password: data.password,
          full_name: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(), // Concatenate names with proper spacing
        };

        // Debug logging to see exactly what's being sent
        console.log("🔍 Frontend data:", data);
        console.log("🔍 Backend data being sent:", backendData);
        console.log("🔍 Request URL:", `${this.baseURL}/auth/register`);

        const response = await this.request<{ user: User; tokens: AuthTokens }>(
          "/auth/register",
          {
            method: "POST",
            body: JSON.stringify(backendData), // Send the transformed data
          }
        );

        this.setTokens(response.tokens);
        return response;
      }

      async getCurrentUser(): Promise<User> {
        return this.request<User>("/users/me");
      }

      async refreshTokens(): Promise<AuthTokens> {
        if (!this.tokens?.refreshToken) {
          throw new Error("No refresh token available");
        }

        const tokens = await this.request<AuthTokens>("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
        });

        this.setTokens(tokens);
        return tokens;
      }
    }

    // =============================================================================
    // AUTH CONTEXT - Global state management for authentication
    // =============================================================================

    const AuthContext = createContext<AuthContextType | null>(null);

    const AuthProvider: React.FC<{ children: ReactNode }> = ({
      children,
    }) => {
      const [user, setUser] = useState<User | null>(null);
      const [loading, setLoading] = useState(true);
      const [api] = useState(() => new AuthAPI());

      // Initialize auth state on app load
      useEffect(() => {
        initializeAuth();
      }, []);

      const initializeAuth = async () => {
        try {
          setLoading(false);
        } catch (error) {
          console.error("Auth initialization failed:", error);
          setLoading(false);
        }
      };

      const login = async (credentials: LoginCredentials) => {
        setLoading(true);
        try {
          const { user, tokens } = await api.login(credentials);
          setUser(user);
        } catch (error) {
          throw error; // Re-throw so the component can handle it
        } finally {
          setLoading(false);
        }
      };

      const register = async (data: RegisterData) => {
        setLoading(true);
        try {
          const { user, tokens } = await api.register(data);
          setUser(user);
        } catch (error) {
          throw error;
        } finally {
          setLoading(false);
        }
      };

      const logout = () => {
        api.clearTokens();
        setUser(null);
      };

      const refreshToken = async () => {
        try {
          await api.refreshTokens();
          const user = await api.getCurrentUser();
          setUser(user);
        } catch (error) {
          logout();
          throw error;
        }
      };

      return (
        <AuthContext.Provider
          value={{
            user,
            loading,
            login,
            register,
            logout,
            refreshToken,
          }}
        >
          {children}
        </AuthContext.Provider>
      );
    };

    const useAuth = (): AuthContextType => {
      const context = useContext(AuthContext);
      if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
      }
      return context;
    };

    // =============================================================================
    // FORM COMPONENTS - Reusable form elements with proper validation
    // =============================================================================

    interface FormFieldProps {
      label: string;
      type: string;
      value: string;
      onChange: (value: string) => void;
      error?: string;
      placeholder?: string;
      icon?: React.ReactNode;
      onKeyDown?: (e: React.KeyboardEvent) => void;
    }

    const FormField: React.FC<FormFieldProps> = ({
      label,
      type,
      value,
      onChange,
      error,
      placeholder,
      icon,
      onKeyDown,
    }) => {
      const [showPassword, setShowPassword] = useState(false);
      const isPassword = type === "password";
      const inputType = isPassword
        ? showPassword
          ? "text"
          : "password"
        : type;

      return (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <div className="relative">
            {icon && (
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                {icon}
              </div>
            )}
            <input
              type={inputType}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className={`w-full ${icon ? "pl-10" : "pl-3"} pr-${isPassword ? "10" : "3"
                } py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${error ? "border-red-500 ring-1 ring-red-500" : ""
                }`}
            />
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            )}
          </div>
          {error && (
            <div className="flex items-center space-x-1 text-red-600 text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
      );
    };

    // =============================================================================
    // LOGIN COMPONENT
    // =============================================================================

    const LoginForm: React.FC<{ onSwitchToRegister: () => void }> = ({
      onSwitchToRegister,
    }) => {
      const { login, loading } = useAuth();
      const [formData, setFormData] = useState<LoginCredentials>({
        email: "",
        password: "",
      });
      const [errors, setErrors] = useState<Partial<LoginCredentials>>({});
      const [submitError, setSubmitError] = useState("");

      // Simple client-side validation
      const validateForm = (): boolean => {
        const newErrors: Partial<LoginCredentials> = {};

        if (!formData.email) {
          newErrors.email = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          newErrors.email = "Email is invalid";
        }

        if (!formData.password) {
          newErrors.password = "Password is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
      };

      const handleSubmit = async () => {
        setSubmitError("");

        if (!validateForm()) return;

        try {
          await login(formData);
        } catch (error) {
          setSubmitError(
            error instanceof Error ? error.message : "Login failed"
          );
        }
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          handleSubmit();
        }
      };

      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Sign In</h2>
            <p className="mt-2 text-gray-600">
              Welcome back! Please sign in to your account.
            </p>
          </div>

          <div className="space-y-4">
            <FormField
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(email) => setFormData({ ...formData, email })}
              error={errors.email}
              placeholder="Enter your email"
              icon={<Mail size={20} />}
              onKeyDown={handleKeyDown}
            />

            <FormField
              label="Password"
              type="password"
              value={formData.password}
              onChange={(password) => setFormData({ ...formData, password })}
              error={errors.password}
              placeholder="Enter your password"
              icon={<Lock size={20} />}
              onKeyDown={handleKeyDown}
            />
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
              <AlertCircle size={20} />
              <span>{submitError}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Don't have an account? Sign up
            </button>
          </div>
        </div>
      );
    };

    // =============================================================================
    // REGISTER COMPONENT
    // =============================================================================

    const RegisterForm: React.FC<{ onSwitchToLogin: () => void }> = ({
      onSwitchToLogin,
    }) => {
      const { register, loading } = useAuth();
      const [formData, setFormData] = useState<RegisterData>({
        email: "",
        password: "",        
        firstName: "",
        lastName: "",
      });
      const [errors, setErrors] = useState<Partial<RegisterData>>({});
      const [submitError, setSubmitError] = useState("");

      const validateForm = (): boolean => {
        const newErrors: Partial<RegisterData> = {};

        if (!formData.firstName.trim()) {
          newErrors.firstName = "First name is required";
        }

        if (!formData.lastName.trim()) {
          newErrors.lastName = "Last name is required";
        }

        if (!formData.email) {
          newErrors.email = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          newErrors.email = "Email is invalid";
        }

        if (!formData.password) {
          newErrors.password = "Password is required";
        } else if (formData.password.length < 8) {
          newErrors.password = "Password must be at least 8 characters";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
      };

      const handleSubmit = async () => {
        setSubmitError("");

        if (!validateForm()) return;

        try {
          // The register function in AuthAPI will handle the transformation
          // from firstName/lastName to full_name automatically
          await register(formData);
        } catch (error) {
          setSubmitError(
            error instanceof Error ? error.message : "Registration failed"
          );
        }
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          handleSubmit();
        }
      };

      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
            <p className="mt-2 text-gray-600">
              Join us today! Please fill in your details.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="First Name"
              type="text"
              value={formData.firstName}
              onChange={(firstName) => setFormData({ ...formData, firstName })}
              error={errors.firstName}
              placeholder="John"
              icon={<User size={20} />}
              onKeyDown={handleKeyDown}
            />

            <FormField
              label="Last Name"
              type="text"
              value={formData.lastName}
              onChange={(lastName) => setFormData({ ...formData, lastName })}
              error={errors.lastName}
              placeholder="Doe"
              icon={<User size={20} />}
              onKeyDown={handleKeyDown}
            />
          </div>

          <FormField
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(email) => setFormData({ ...formData, email })}
            error={errors.email}
            placeholder="john@example.com"
            icon={<Mail size={20} />}
            onKeyDown={handleKeyDown}
          />

          <FormField
            label="Password"
            type="password"
            value={formData.password}
            onChange={(password) => setFormData({ ...formData, password })}
            error={errors.password}
            placeholder="Enter a strong password"
            icon={<Lock size={20} />}
            onKeyDown={handleKeyDown}
          />

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
              <AlertCircle size={20} />
              <span>{submitError}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 focus:ring-4 focus:ring-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      );
    };

    // =============================================================================
    // DASHBOARD COMPONENT - Shows authenticated user state
    // =============================================================================

    const Dashboard: React.FC = () => {
      const { user, logout } = useAuth();

      return (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome to Your Dashboard
              </h2>
              <p className="text-gray-600">
                You're successfully authenticated!
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Profile Information
                </h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Name:</span> {user?.firstName}{" "}
                    {user?.lastName}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span> {user?.email}
                  </p>
                  <p>
                    <span className="font-medium">Email Status:</span>{" "}
                    {user?.isEmailVerified ? (
                      <span className="text-green-600">Verified</span>
                    ) : (
                      <span className="text-orange-600">Not Verified</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={logout}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    };

    // =============================================================================
    // MAIN APP COMPONENT
    // =============================================================================

    const AuthDemo: React.FC = () => {
      const [isLogin, setIsLogin] = useState(true);

      return (
        <AuthProvider>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
            <div className="container mx-auto px-4 py-8">
              <AuthenticatedContent
                isLogin={isLogin}
                onToggleMode={() => setIsLogin(!isLogin)}
              />
            </div>
          </div>
        </AuthProvider>
      );
    };

    const AuthenticatedContent: React.FC<{
      isLogin: boolean;
      onToggleMode: () => void;
    }> = ({ isLogin, onToggleMode }) => {
      const { user, loading } = useAuth();

      if (loading) {
        return (
          <div className="flex justify-center items-center min-h-96">
            <Loader2 size={40} className="animate-spin text-blue-600" />
          </div>
        );
      }

      if (user) {
        return <Dashboard />;
      }

      return (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            {isLogin ? (
              <LoginForm onSwitchToRegister={onToggleMode} />
            ) : (
              <RegisterForm onSwitchToLogin={onToggleMode} />
            )}
          </div>
        </div>
      );
    };
    return <AuthDemo />;
  
  }
export default App;