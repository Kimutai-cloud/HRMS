import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AccessLevel, RoleCode } from '@/types/auth';
import { getDefaultDashboardRoute } from '@/config/routes';

/**
 * Smart Dashboard Router
 * Automatically routes users to the appropriate dashboard based on their role and access level
 */
export function SmartDashboard() {
  const { user, userProfile, accessLevel, loading } = useAuth();

  // Show loading state while determining user permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Wait for profile to be fully loaded before redirecting  
  // This prevents multiple redirects during login flow
  // Note: userProfile can be null for users who need to complete their profile
  // But we should only show loading if the auth context is still loading
  // For users with PROFILE_COMPLETION access level, userProfile being null is expected

  // Determine dashboard route based on final access level
  const dashboardRoute = getDefaultDashboardRoute(accessLevel);

  // Redirect to the appropriate dashboard
  return <Navigate to={dashboardRoute} replace />;
}

/**
 * Dashboard Router Hook
 * Returns the appropriate dashboard component based on user permissions
 */
export function useDashboardRouter() {
  const { userProfile, accessLevel } = useAuth();

  const getDashboardComponent = () => {
    if (!userProfile) return null;

    const roles = userProfile?.roles?.map(r => r.role_code) || [];

    // Check for admin role first (highest priority)
    if (roles.includes(RoleCode.ADMIN)) {
      return 'AdminDashboard';
    }

    // Check for manager role
    if (roles.includes(RoleCode.MANAGER)) {
      return 'ManagerDashboard';
    }

    // Check for employee role
    if (roles.includes(RoleCode.EMPLOYEE)) {
      return 'EmployeeDashboard';
    }

    // Fall back to access level
    switch (accessLevel) {
      case AccessLevel.PROFILE_COMPLETION:
        return 'ProfileCompletion';
      case AccessLevel.NEWCOMER:
        return 'NewcomerDashboard';
      case AccessLevel.VERIFIED:
        return 'EmployeeDashboard';
      case AccessLevel.ADMIN:
        return 'AdminDashboard';
      default:
        return 'ProfileCompletion';
    }
  };

  const getDashboardTitle = () => {
    if (!userProfile) return 'Loading...';

    const roles = userProfile?.roles?.map(r => r.role_code) || [];

    if (roles.includes(RoleCode.ADMIN)) {
      return 'Admin Dashboard';
    }

    if (roles.includes(RoleCode.MANAGER)) {
      return 'Manager Dashboard';
    }

    if (roles.includes(RoleCode.EMPLOYEE)) {
      return 'Employee Dashboard';
    }

    switch (accessLevel) {
      case AccessLevel.PROFILE_COMPLETION:
        return 'Complete Your Profile';
      case AccessLevel.NEWCOMER:
        return 'Newcomer Dashboard';
      case AccessLevel.VERIFIED:
        return 'Employee Dashboard';
      case AccessLevel.ADMIN:
        return 'Admin Dashboard';
      default:
        return 'Dashboard';
    }
  };

  const getDashboardPermissions = () => {
    if (!userProfile) return [];

    const roles = userProfile?.roles?.map(r => r.role_code) || [];
    const permissions: string[] = [];

    if (roles.includes(RoleCode.ADMIN)) {
      permissions.push(
        'admin:read', 'admin:write', 'admin:delete',
        'employee:manage', 'reports:view', 'system:health',
        'audit:logs', 'notifications:manage'
      );
    }

    if (roles.includes(RoleCode.MANAGER)) {
      permissions.push(
        'team:read', 'team:manage', 'employee:read',
        'reports:view', 'documents:review'
      );
    }

    if (roles.includes(RoleCode.EMPLOYEE)) {
      permissions.push(
        'profile:read', 'profile:write', 'documents:upload'
      );
    }

    switch (accessLevel) {
      case AccessLevel.PROFILE_COMPLETION:
        permissions.push('profile:complete');
        break;
      case AccessLevel.NEWCOMER:
        permissions.push('profile:complete', 'documents:upload');
        break;
    }

    return [...new Set([...permissions, ...userProfile.permissions])];
  };

  const getAvailableRoutes = () => {
    if (!userProfile) return [];

    const roles = userProfile?.roles?.map(r => r.role_code) || [];
    const routes: string[] = ['/profile', '/documents'];

    if (roles.includes(RoleCode.ADMIN)) {
      routes.push(
        '/admin',
        '/admin/users',
        '/admin/settings',
        '/admin/reports',
        '/admin/audit',
        '/employees',
        '/team'
      );
    }

    if (roles.includes(RoleCode.MANAGER)) {
      routes.push('/team', '/employees', '/documents/review');
    }

    if (accessLevel === AccessLevel.PROFILE_COMPLETION) {
      return ['/profile-completion', '/profile/edit'];
    }

    return routes;
  };

  return {
    dashboardComponent: getDashboardComponent(),
    dashboardTitle: getDashboardTitle(),
    dashboardPermissions: getDashboardPermissions(),
    availableRoutes: getAvailableRoutes(),
    userProfile,
    accessLevel,
    roles: userProfile?.roles.map(r => r.role_code) || [],
  };
}

/**
 * Dashboard Route Guard
 * Ensures users can only access dashboards appropriate to their role
 */
interface DashboardGuardProps {
  children: React.ReactNode;
  requiredAccessLevel?: AccessLevel;
  requiredRoles?: RoleCode[];
  fallbackRoute?: string;
}

export function DashboardGuard({ 
  children, 
  requiredAccessLevel, 
  requiredRoles = [],
  fallbackRoute 
}: DashboardGuardProps) {
  const { userProfile, accessLevel } = useAuth();

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const userRoles = userProfile.roles.map(r => r.role_code);

  // Check access level requirement
  if (requiredAccessLevel) {
    const accessLevels = [
      AccessLevel.PROFILE_COMPLETION,
      AccessLevel.NEWCOMER,
      AccessLevel.VERIFIED,
      AccessLevel.ADMIN,
    ];

    const userAccessIndex = accessLevels.indexOf(accessLevel);
    const requiredAccessIndex = accessLevels.indexOf(requiredAccessLevel);

    if (userAccessIndex < requiredAccessIndex) {
      const defaultRoute = fallbackRoute || getDefaultDashboardRoute(accessLevel);
      return <Navigate to={defaultRoute} replace />;
    }
  }

  // Check role requirements
  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    if (!hasRequiredRole) {
      const defaultRoute = fallbackRoute || getDefaultDashboardRoute(accessLevel);
      return <Navigate to={defaultRoute} replace />;
    }
  }

  return <>{children}</>;
}