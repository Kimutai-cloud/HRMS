import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationContainer from './components/NotificationContainer';
import { AppRouter } from './components/routing/AppRouter';
import { queryClient } from './lib/queryClient';
import { Toaster } from './components/ui/toaster';

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <AuthProvider>
          <NotificationContainer />
          <AppRouter />
          <Toaster />
        </AuthProvider>
      </NotificationProvider>
    </QueryClientProvider>
  );
};

export default App;