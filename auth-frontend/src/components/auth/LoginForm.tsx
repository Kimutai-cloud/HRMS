import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { type LoginCredentials } from '../../types/auth';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister }) => {
  const { login, loading } = useAuth();
  const { showNotification } = useNotification();
  const [formData, setFormData] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<LoginCredentials>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginCredentials> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showNotification('warning', 'Please check your information and try again.');
      return;
    }

    try {
      showNotification('info', 'Signing you in...');
      await login(formData);
      showNotification('success', 'Welcome back! You\'ve been successfully signed in.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to sign you in. Please check your credentials and try again.';
      showNotification('error', errorMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  return (
    <Card>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
        <p className="text-gray-600">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Email Address"
          type="email"
          icon={Mail}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          placeholder="Enter your email address"
          onKeyDown={handleKeyDown}
        />

        <Input
          label="Password"
          type="password"
          icon={Lock}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          error={errors.password}
          placeholder="Enter your password"
          onKeyDown={handleKeyDown}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-xl shadow-blue-500/30"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-600">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Create one here
          </button>
        </p>
      </div>
    </Card>
  );
};

export default LoginForm;
