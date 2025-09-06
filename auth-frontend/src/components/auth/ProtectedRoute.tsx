import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AccessLevel, RoleCode } from '@/types/auth';
import { canAccessRoute, hasRole, hasAnyRole } from '@/lib/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredAccessLevel?: AccessLevel;
  requiredRoles?: RoleCode[];
  requiredPermissions?: string[];
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredAccessLevel,
  requiredRoles = [],
  requiredPermissions = [],
  redirectTo = '/login',
  fallback
}: ProtectedRouteProps) {
  const { user, userProfile, loading, accessLevel } = useAuth();

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check access level requirement (this is the main protection mechanism)
  if (requiredAccessLevel && !canAccessRoute(userProfile, requiredAccessLevel)) {
    if (fallback) return <>{fallback}</>;
    
    // Smart redirect based on user's current access level
    switch (accessLevel) {
      case AccessLevel.PROFILE_COMPLETION:
        return <Navigate to="/newcomer-dashboard" replace />;
      case AccessLevel.NEWCOMER:
        return <Navigate to="/newcomer-dashboard" replace />;
      case AccessLevel.VERIFIED:
        return <Navigate to="/employee-dashboard" replace />;
      case AccessLevel.MANAGER:
        return <Navigate to="/manager-dashboard" replace />;
      case AccessLevel.ADMIN:
        return <Navigate to="/admin-dashboard" replace />;
      default:
        return <Navigate to="/newcomer-dashboard" replace />;
    }
  }

  // Note: We removed role and permission checks since access level already incorporates this info from backend
  
  return <>{children}</>;
}

// Specific route guards for common use cases
export function AdminRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute
      requiredRoles={[RoleCode.ADMIN]}
      requiredAccessLevel={AccessLevel.ADMIN}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
}

export function ManagerRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute
      requiredRoles={[RoleCode.ADMIN, RoleCode.MANAGER]}
      requiredAccessLevel={AccessLevel.VERIFIED}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
}

export function EmployeeRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute
      requiredRoles={[RoleCode.ADMIN, RoleCode.MANAGER, RoleCode.EMPLOYEE]}
      requiredAccessLevel={AccessLevel.VERIFIED}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
}

export function NewcomerRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredRoles'>) {
  return (
    <ProtectedRoute
      requiredRoles={[RoleCode.ADMIN, RoleCode.MANAGER, RoleCode.EMPLOYEE, RoleCode.NEWCOMER]}
      requiredAccessLevel={AccessLevel.NEWCOMER}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
}

export function ProfileCompletionRoute({ children, ...props }: Omit<ProtectedRouteProps, 'requiredAccessLevel'>) {
  return (
    <ProtectedRoute
      requiredAccessLevel={AccessLevel.PROFILE_COMPLETION}
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
}