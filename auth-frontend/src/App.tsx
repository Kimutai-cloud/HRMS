import React, { useState } from 'react';
import { Loader2, Settings } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationContainer from './components/NotificationContainer';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import Dashboard from './components/auth/Dashboard';

// Background options
const backgroundOptions = {
  pattern: 'bg-pattern',
  gradient: 'bg-gradient-to-br from-[#F5F7FA] via-white to-[#F5F7FA]',
  image: 'url(/background.jpg)',
  solid: 'bg-[#F5F7FA]'
};

const AuthenticatedContent: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#1E88E5] mx-auto mb-4" />
          <p className="text-[#9E9E9E] font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  return (
    <div className="flex justify-end pr-8">
      <div className="w-full max-w-2xl"> {}
        {isLogin ? (
          <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {

  return (
    <NotificationProvider>
      <AuthProvider>
        <div className="min-h-screen relative bg-cover bg-center bg-no-repeat" 
             style={{ backgroundImage: backgroundOptions.image }}>
          <NotificationContainer />
          
          {/* Main Content */}
          <main className="container mx-auto px-4 py-12">
            <AuthenticatedContent />
          </main>

          {/* Footer */}
          <footer className="footer-glass mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center">
                <div className="flex justify-center items-center space-x-2 mb-3">
                </div>
                <p className="text-[#9E9E9E] text-sm mb-2">
                  &copy; 2024 HRMS. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </NotificationProvider>
  );
};

export default App;