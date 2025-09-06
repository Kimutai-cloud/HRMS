import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AccessLevel, RoleCode } from '@/types/auth';
import { getDefaultDashboardRoute, isPublicRoute, ROUTE_PATHS } from '@/config/routes';
import { canAccessRoute, hasAnyRole } from '@/lib/permissions';

interface NavigationGuardProps {
  children: React.ReactNode;
}

export function NavigationGuard({ children }: NavigationGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, accessLevel, loading } = useAuth();

  useEffect(() => {
    // Don't redirect while loading
    if (loading) return;

    const currentPath = location.pathname;

    // Allow public routes
    if (isPublicRoute(currentPath)) return;

    // Redirect to login if not authenticated
    if (!user) {
      navigate(ROUTE_PATHS.LOGIN, { 
        state: { from: location },
        replace: true 
      });
      return;
    }

    // Handle different access levels and redirect accordingly
    handleAccessLevelRedirect(currentPath);
  }, [user, userProfile, accessLevel, loading, location, navigate]);

  const handleAccessLevelRedirect = (currentPath: string) => {
    if (!userProfile) return;

    const roles = userProfile.roles.map(r => r.role_code);

    // Profile completion required
    if (accessLevel === AccessLevel.PROFILE_COMPLETION) {
      if (currentPath !== ROUTE_PATHS.PROFILE_COMPLETION && 
          currentPath !== ROUTE_PATHS.PROFILE_EDIT) {
        navigate(ROUTE_PATHS.PROFILE_COMPLETION, { replace: true });
        return;
      }
    }

    // Newcomer access
    if (accessLevel === AccessLevel.NEWCOMER) {
      const allowedPaths: string[] = [
        ROUTE_PATHS.NEWCOMER_DASHBOARD,
        ROUTE_PATHS.PROFILE,
        ROUTE_PATHS.PROFILE_EDIT,
        ROUTE_PATHS.DOCUMENTS,
        ROUTE_PATHS.DOCUMENT_UPLOAD,
      ];
      
      if (!allowedPaths.includes(currentPath) && currentPath !== ROUTE_PATHS.DASHBOARD) {
        navigate(ROUTE_PATHS.NEWCOMER_DASHBOARD, { replace: true });
        return;
      }
    }

    // Admin trying to access lower-level dashboards
    if (hasAnyRole(userProfile, [RoleCode.ADMIN])) {
      if (currentPath === ROUTE_PATHS.EMPLOYEE_DASHBOARD || 
          currentPath === ROUTE_PATHS.MANAGER_DASHBOARD ||
          currentPath === ROUTE_PATHS.NEWCOMER_DASHBOARD) {
        navigate(ROUTE_PATHS.ADMIN_DASHBOARD, { replace: true });
        return;
      }
    }

    // Manager trying to access employee or newcomer dashboards
    if (hasAnyRole(userProfile, [RoleCode.MANAGER]) && 
        !hasAnyRole(userProfile, [RoleCode.ADMIN])) {
      if (currentPath === ROUTE_PATHS.EMPLOYEE_DASHBOARD || 
          currentPath === ROUTE_PATHS.NEWCOMER_DASHBOARD) {
        navigate(ROUTE_PATHS.MANAGER_DASHBOARD, { replace: true });
        return;
      }
    }

    // Employee trying to access newcomer dashboard
    if (hasAnyRole(userProfile, [RoleCode.EMPLOYEE]) && 
        !hasAnyRole(userProfile, [RoleCode.MANAGER, RoleCode.ADMIN])) {
      if (currentPath === ROUTE_PATHS.NEWCOMER_DASHBOARD) {
        navigate(ROUTE_PATHS.EMPLOYEE_DASHBOARD, { replace: true });
        return;
      }
    }

    // Redirect to appropriate dashboard if on generic dashboard route
    if (currentPath === ROUTE_PATHS.DASHBOARD) {
      const defaultRoute = getDefaultDashboardRoute(accessLevel);
      navigate(defaultRoute, { replace: true });
      return;
    }
  };

  return <>{children}</>;
}

/**
 * Route-specific guard for admin routes
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile && !hasAnyRole(userProfile, [RoleCode.ADMIN])) {
      navigate(ROUTE_PATHS.UNAUTHORIZED, { replace: true });
    }
  }, [userProfile, navigate]);

  return <>{children}</>;
}

/**
 * Route-specific guard for manager routes
 */
export function ManagerGuard({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile && !hasAnyRole(userProfile, [RoleCode.ADMIN, RoleCode.MANAGER])) {
      navigate(ROUTE_PATHS.UNAUTHORIZED, { replace: true });
    }
  }, [userProfile, navigate]);

  return <>{children}</>;
}

/**
 * Route-specific guard for verified users
 */
export function VerifiedGuard({ children }: { children: React.ReactNode }) {
  const { userProfile, accessLevel } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile && !canAccessRoute(userProfile, AccessLevel.VERIFIED)) {
      const roles = userProfile.roles.map(r => r.role_code);
      const defaultRoute = getDefaultDashboardRoute(accessLevel);
      navigate(defaultRoute, { replace: true });
    }
  }, [userProfile, accessLevel, navigate]);

  return <>{children}</>;
}

/**
 * Guard for profile completion requirement
 */
export function ProfileCompletionGuard({ children }: { children: React.ReactNode }) {
  const { accessLevel } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (accessLevel !== AccessLevel.PROFILE_COMPLETION) {
      // If profile is completed, redirect to appropriate dashboard
      navigate(ROUTE_PATHS.DASHBOARD, { replace: true });
    }
  }, [accessLevel, navigate]);

  // Only render children if profile completion is required
  if (accessLevel !== AccessLevel.PROFILE_COMPLETION) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Smart redirect guard that redirects users to appropriate pages
 * based on their verification status and access level
 */
export function SmartRedirectGuard() {
  const { user, userProfile, accessLevel, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    const currentPath = location.pathname;

    // Don't redirect on public routes
    if (isPublicRoute(currentPath)) return;

    // Don't redirect if not authenticated
    if (!user) return;

    // Don't redirect if already on appropriate route
    if (userProfile) {
      const roles = userProfile.roles.map(r => r.role_code);
      const defaultRoute = getDefaultDashboardRoute(accessLevel);
      
      // Allow current route if it's the default route or a valid route for user
      const validRoutes = getValidRoutesForUser(accessLevel, roles);
      if (validRoutes.includes(currentPath)) return;

      // Redirect to default route if current route is not valid
      if (currentPath !== defaultRoute) {
        navigate(defaultRoute, { replace: true });
      }
    }
  }, [user, userProfile, accessLevel, loading, location, navigate]);

  return null; // This component doesn't render anything
}

/**
 * Get valid routes for a user based on their access level and roles
 */
function getValidRoutesForUser(accessLevel: AccessLevel, roles: RoleCode[]): string[] {
  const baseRoutes: string[] = [
    ROUTE_PATHS.PROFILE,
    ROUTE_PATHS.DASHBOARD,
  ];

  switch (accessLevel) {
    case AccessLevel.PROFILE_COMPLETION:
      return [
        ROUTE_PATHS.PROFILE_COMPLETION,
        ROUTE_PATHS.PROFILE_EDIT,
        ...baseRoutes,
      ];

    case AccessLevel.NEWCOMER:
      return [
        ROUTE_PATHS.NEWCOMER_DASHBOARD,
        ROUTE_PATHS.DOCUMENTS,
        ROUTE_PATHS.DOCUMENT_UPLOAD,
        ROUTE_PATHS.PROFILE_EDIT,
        ...baseRoutes,
      ];

    case AccessLevel.VERIFIED:
      const verifiedRoutes: string[] = [
        ROUTE_PATHS.EMPLOYEE_DASHBOARD,
        ROUTE_PATHS.DOCUMENTS,
        ROUTE_PATHS.DOCUMENT_UPLOAD,
        ROUTE_PATHS.PROFILE_EDIT,
        ROUTE_PATHS.TEAM,
        ...baseRoutes,
      ];

      if (roles.includes(RoleCode.MANAGER)) {
        verifiedRoutes.push(
          ROUTE_PATHS.MANAGER_DASHBOARD as string,
          ROUTE_PATHS.EMPLOYEES,
          ROUTE_PATHS.DOCUMENT_REVIEW
        );
      }

      return verifiedRoutes;

    case AccessLevel.ADMIN:
      return [
        ROUTE_PATHS.ADMIN_DASHBOARD,
        ROUTE_PATHS.ADMIN_PANEL,
        ROUTE_PATHS.USER_MANAGEMENT,
        ROUTE_PATHS.SYSTEM_SETTINGS,
        ROUTE_PATHS.REPORTS,
        ROUTE_PATHS.AUDIT_LOGS,
        ROUTE_PATHS.EMPLOYEES,
        ROUTE_PATHS.TEAM,
        ROUTE_PATHS.DOCUMENTS,
        ROUTE_PATHS.DOCUMENT_UPLOAD,
        ROUTE_PATHS.DOCUMENT_REVIEW,
        ROUTE_PATHS.PROFILE_EDIT,
        ROUTE_PATHS.MANAGER_DASHBOARD as string,
        ...baseRoutes,
      ];

    default:
      return baseRoutes;
  }
}