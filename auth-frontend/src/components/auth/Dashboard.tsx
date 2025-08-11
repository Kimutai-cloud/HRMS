import React from 'react';
import { CheckCircle, LogOut, User, Mail, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Button from '../ui/Button';
import Card from '../ui/Card';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();

  const handleLogout = () => {
    logout();
    showNotification('info', 'You have been signed out successfully.');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-[#43A047] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[#212121] mb-3">Welcome to Your Dashboard</h1>
          <p className="text-[#9E9E9E] text-lg">You're successfully authenticated and ready to go!</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#F5F7FA] rounded-lg p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-[#1E88E5] rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[#212121]">Profile Information</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-[#9E9E9E] font-medium">Full Name:</span>
                <span className="text-[#212121] font-semibold">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-[#9E9E9E] font-medium">Email:</span>
                <span className="text-[#212121] font-semibold">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[#9E9E9E] font-medium">Email Status:</span>
                <span className={`font-semibold ${
                  user?.isEmailVerified 
                    ? 'text-[#43A047]' 
                    : 'text-[#FB8C00]'
                }`}>
                  {user?.isEmailVerified ? 'Verified' : 'Not Verified'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#F5F7FA] rounded-lg p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-[#26A69A] rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[#212121]">Account Security</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-[#43A047]">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Two-factor authentication available</span>
              </div>
              <div className="flex items-center space-x-2 text-[#43A047]">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Secure password requirements</span>
              </div>
              <div className="flex items-center space-x-2 text-[#43A047]">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Email verification enabled</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Button
            variant="error"
            size="lg"
            onClick={handleLogout}
            className="inline-flex items-center space-x-2"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
