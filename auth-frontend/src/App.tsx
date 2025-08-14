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
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="max-w-6xl mx-auto px-4">
        <Dashboard />
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-lg">
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
        <div className="min-h-screen relative bg-cover bg-center bg-no-repeat bg-fixed flex flex-col overflow-hidden" 
             style={{ backgroundImage: backgroundOptions.image }}>
          {/* Subtle overlay for better readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none"></div>
          
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, #3B82F6 0%, transparent 50%), radial-gradient(circle at 75% 75%, #10B981 0%, transparent 50%)`,
              backgroundSize: '100px 100px'
            }}></div>
          </div>
          
          <NotificationContainer />
          
          {/* Main Content */}
          <main className="flex-1 py-12 flex items-center justify-center relative z-10">
            <AuthenticatedContent />
          </main>

          {/* Footer */}
          <footer className="footer-glass relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center">
                <div className="flex justify-center items-center space-x-2 mb-3">
                </div>
              </div>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </NotificationProvider>
  );
};

export default App;