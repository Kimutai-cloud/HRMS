import React, { useState } from 'react';
import { Mail, Lock, User, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { type RegisterData } from '../../types/auth';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { register, loading } = useAuth();
  const { showNotification } = useNotification();
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [errors, setErrors] = useState<Partial<RegisterData>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const validateForm = (): boolean => {
    const newErrors: Partial<RegisterData> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');

    if (!validateForm()) {
      showNotification('warning', 'Please check your information and try again.');
      return;
    }

    try {
      showNotification('info', 'Creating your account...');
      const result = await register(formData);
      setSuccessMessage(result.message);
      showNotification('success', 'Great! Your account has been created. Please check your email to verify your account.');
      
      // Clear form
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
      });
      
      // Auto-switch to login after a delay
      setTimeout(() => {
        onSwitchToLogin();
      }, 3000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'We couldn\'t create your account. Please try again or contact support if the problem persists.';
      showNotification('error', errorMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  // Show success state
  if (successMessage) {
    return (
      <Card>
        <div className="text-center">
          <div className="w-20 h-20 bg-[#43A047] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#212121] mb-4">Registration Successful!</h2>
          
          <div className="p-4 bg-[#43A047]/10 border border-[#43A047]/20 rounded-lg mb-6">
            <div className="flex items-center space-x-3 text-[#43A047]">
              <Clock className="w-5 h-5" />
              <div>
                <p className="font-medium">Check Your Email</p>
                <p className="text-sm">{successMessage}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-gray-600">
              We'll redirect you to the login page in a few seconds...
            </p>
            <Button
              variant="outline"
              onClick={onSwitchToLogin}
            >
              Go to login now
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-teal-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/25">
          <User className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
        <p className="text-gray-600">Join us today! Please fill in your details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Name"
            type="text"
            icon={User}
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            error={errors.firstName}
            placeholder="John"
            onKeyDown={handleKeyDown}
          />

          <Input
            label="Last Name"
            type="text"
            icon={User}
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            error={errors.lastName}
            placeholder="Doe"
            onKeyDown={handleKeyDown}
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          icon={Mail}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          placeholder="john@example.com"
          onKeyDown={handleKeyDown}
        />

        <Input
          label="Password"
          type="password"
          icon={Lock}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          error={errors.password}
          placeholder="Enter a strong password (min 8 characters)"
          onKeyDown={handleKeyDown}
        />

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          loading={loading}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 shadow-xl shadow-teal-500/30"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-600">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Sign in here
          </button>
        </p>
      </div>
    </Card>
  );
};

export default RegisterForm;
