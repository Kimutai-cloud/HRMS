import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type AuthContextType, type LoginCredentials, type RegisterData } from '../types/auth';
import AuthService from '../services/authService';

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [loading, setLoading] = useState(false);
  const [api] = useState(() => new AuthService());

  // Check for email verification token in URL on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const isVerificationPage = window.location.pathname === '/verify-email';
    
    if (token && isVerificationPage) {
      handleEmailVerification(token);
    }
  }, []);

  const handleEmailVerification = async (token: string) => {
    setLoading(true);
    try {
      await api.verifyEmail(token);
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      alert("Email verified successfully! You can now log in.");
    } catch (error) {
      alert("Email verification failed, Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      const { user } = await api.login(credentials);
      setUser(user);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setLoading(true);
    try {
      const result = await api.register(data);
      return result;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (token: string) => {
    setLoading(true);
    try {
      await api.verifyEmail(token);
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
        verifyEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
