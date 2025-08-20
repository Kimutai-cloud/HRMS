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
    showNotification('info', 'You\'ve been signed out successfully. Come back soon!');
  };

  return (
    <div>
      <Card>
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/25">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Dashboard</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-6 border border-blue-200/50 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25">
                <User className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-blue-200/50">
                <span className="text-gray-600 font-medium">Full Name:</span>
                <span className="text-gray-900 font-semibold">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-blue-200/50">
                <span className="text-gray-600 font-medium">Email:</span>
                <span className="text-gray-900 font-semibold">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 font-medium">Email Status:</span>
                <span className={`font-semibold ${
                  user?.isEmailVerified 
                    ? 'text-green-600' 
                    : 'text-orange-600'
                }`}>
                  {user?.isEmailVerified ? 'Verified' : 'Not Verified'}
                </span>
              </div>
            </div>
          </div>

          
        </div>

        <div className="text-center">
          <Button
            variant="error"
            size="lg"
            onClick={handleLogout}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-xl shadow-red-500/30"
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
