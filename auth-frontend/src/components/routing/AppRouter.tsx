import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { routeConfigs, ROUTE_PATHS } from '@/config/routes';
import { AccessLevel, RoleCode } from '@/types/auth';
import { DashboardLayout } from '../dashboard/DashboardLayout';

// Auth Components
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import { ProtectedRoute } from '../auth/ProtectedRoute';
import { SmartDashboard } from './SmartDashboard';

// Form Wrappers that use navigate
const LoginFormWrapper = () => {
  const navigate = useNavigate();
  return <LoginForm onSwitchToRegister={() => navigate('/register')} />;
};

const RegisterFormWrapper = () => {
  const navigate = useNavigate();
  return <RegisterForm onSwitchToLogin={() => navigate('/login')} />;
};

// Import dashboard and page components directly
import AdminDashboard from '@/pages/AdminDashboard';
import ManagerDashboard from '@/pages/ManagerDashboard';
import EmployeeDashboard from '@/pages/EmployeeDashboard';
import NewcomerDashboard from '@/pages/NewcomerDashboard';
import ProfileEdit from '@/pages/ProfileEdit';
import ProfilePage from '@/pages/ProfilePage';
import DocumentsPage from '@/pages/DocumentsPage';
import AdminPanelPage from '@/pages/AdminPanelPage';
import SystemSettingsPage from '@/pages/SystemSettingsPage';
import TeamPage from '@/pages/TeamPage';
import UserManagement from '@/pages/UserManagement';
import AuditLogs from '@/pages/AuditLogs';

// Department Components  
import { DepartmentManagement } from '@/components/admin';
import { ManagerDepartments, ManagerDepartmentDetail } from '@/components/manager';
import ManagerAnalytics from '@/pages/ManagerAnalytics';

// Task Management Components (Lazy Loaded)
import TaskDashboard from '@/pages/TaskDashboard';
import { TaskDetailsLazy, TaskCreatePageLazy, ManagerTaskDashboardLazy, EmployeeTaskDashboardLazy } from '@/components/tasks/LazyTaskComponents';

// Component mapping - maps component names to actual components
const componentMap = {
  // Auth
  'LoginForm': LoginFormWrapper,
  'RegisterForm': RegisterFormWrapper,
  'Landing': () => <Navigate to="/dashboard" replace />,
  'EmailVerification': () => <div className="p-8 text-center">Email Verification - Coming Soon</div>,
  
  // Dashboard
  'SmartDashboard': () => <SmartDashboard />,
  'AdminDashboard': AdminDashboard,
  'ManagerDashboard': ManagerDashboard,
  'EmployeeDashboard': EmployeeDashboard,
  'NewcomerDashboard': NewcomerDashboard,
  
  // Profile Management
  'Profile': ProfilePage,
  'ProfileCompletion': NewcomerDashboard,
  'ProfileEdit': ProfileEdit,
  
  // Employee Management
  'EmployeeList': () => <div className="p-8">Employee List - Coming Soon</div>,
  'EmployeeDetails': () => <div className="p-8">Employee Details - Coming Soon</div>,
  
  // Team Management
  'TeamPage': TeamPage,
  'TeamMemberDetails': () => <div className="p-8">Team Member Details - Coming Soon</div>,
  
  // Document Management
  'DocumentList': DocumentsPage,
  'DocumentUpload': DocumentsPage,
  'DocumentReview': DocumentsPage,
  
  // Admin Panel
  'AdminPanel': AdminPanelPage,
  'DepartmentManagement': DepartmentManagement,
  'UserManagement': UserManagement,
  'SystemSettings': SystemSettingsPage,
  'Reports': SystemSettingsPage,
  'AuditLogs': AuditLogs,
  
  // Manager Panel
  'ManagerDepartments': ManagerDepartments,
  'ManagerDepartmentDetail': ManagerDepartmentDetail,
  'ManagerAnalytics': ManagerAnalytics,
  
  // Task Management (Lazy Loaded)
  'TaskDashboard': TaskDashboard,
  'TaskDetails': TaskDetailsLazy,
  'ManagerTaskDashboard': ManagerTaskDashboardLazy,
  'EmployeeTaskDashboard': EmployeeTaskDashboardLazy,
  'TaskCreatePage': TaskCreatePageLazy,
  
  // Fallback components
  'NotFound': () => <div className="p-8 text-center">Page Not Found</div>,
  'Unauthorized': () => <div className="p-8 text-center text-red-600">Unauthorized Access</div>,
};

// Loading Component
const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

// Public Route Wrapper
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  
  // If user is logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Auth Layout for login/register pages
const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen relative bg-cover bg-center bg-no-repeat bg-fixed flex flex-col overflow-hidden" 
         style={{ backgroundImage: 'url(/background.jpg)' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none"></div>
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, #3B82F6 0%, transparent 50%), radial-gradient(circle at 75% 75%, #10B981 0%, transparent 50%)`,
          backgroundSize: '100px 100px'
        }}></div>
      </div>
      
      <main className="flex-1 py-12 flex items-center justify-center relative z-10">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>

      <footer className="footer-glass relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="flex justify-center items-center space-x-2 mb-3">
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};


// Generate routes from configuration
const generateRoute = (routeConfig: any) => {
  const Component = componentMap[routeConfig.component as keyof typeof componentMap];
  
  if (!Component) {
    console.warn(`Component "${routeConfig.component}" not found in componentMap`);
    return null;
  }

  const element = routeConfig.public ? (
    <PublicRoute>
      <AuthLayout>
        <Component />
      </AuthLayout>
    </PublicRoute>
  ) : (
    <ProtectedRoute
      requiredAccessLevel={routeConfig.requiredAccessLevel}
      requiredRoles={routeConfig.requiredRoles}
      requiredPermissions={routeConfig.requiredPermissions}
    >
      <DashboardLayout>
        <Component />
      </DashboardLayout>
    </ProtectedRoute>
  );

  return (
    <Route
      key={routeConfig.path}
      path={routeConfig.path}
      element={element}
    />
  );
};

export const AppRouter: React.FC = () => {
  let authData;
  try {
    authData = useAuth();
  } catch (error) {
    console.error('useAuth context error in AppRouter:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Authentication context error</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
  const { loading } = authData;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Generate routes from configuration */}
        {routeConfigs.map(generateRoute).filter(Boolean)}
        

        {/* Default Routes */}
        <Route path="/" element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />} />
        <Route path="/unauthorized" element={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
              <p className="text-gray-600 mb-4">You don't have permission to access this resource.</p>
              <button 
                onClick={() => window.location.href = '/dashboard'} 
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        } />
        <Route path="*" element={<Navigate to={ROUTE_PATHS.NOT_FOUND} replace />} />
      </Routes>
    </BrowserRouter>
  );
};