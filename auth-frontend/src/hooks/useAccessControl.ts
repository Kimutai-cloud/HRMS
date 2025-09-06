import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from './usePermissions';
import { useRole } from './useRole';
import { AccessLevel, RoleCode } from '../types/auth';

/**
 * Combined hook for comprehensive access control
 * Provides both permission and role-based access control in one place
 */
export function useAccessControl() {
  const auth = useAuth();
  const permissions = usePermissions();
  const roles = useRole();

  return {
    // Auth context
    ...auth,
    
    // Permissions
    permissions: permissions.permissions,
    hasPermission: permissions.hasPermission,
    hasAnyPermission: permissions.hasAnyPermission,
    hasAllPermissions: permissions.hasAllPermissions,
    
    // Roles
    hasRole: roles.hasRole,
    hasAnyRole: roles.hasAnyRole,
    canAccessAdmin: roles.canAccessAdmin,
    canManageTeam: roles.canManageTeam,
    canApproveDocuments: roles.canApproveDocuments,
    needsProfileCompletion: roles.needsProfileCompletion,
    isVerified: roles.isVerified,
    canAccessRoute: roles.canAccessRoute,
  };
}

/**
 * Hook for dashboard access control
 * Determines which dashboard a user should see
 */
export function useDashboardAccess() {
  const { accessLevel, isAdmin, isManager, isEmployee, isNewcomer } = useAuth();
  
  const getDashboardRoute = (): string => {
    if (accessLevel === AccessLevel.PROFILE_COMPLETION) {
      return '/profile-completion';
    }
    
    if (isAdmin) {
      return '/admin-dashboard';
    }
    
    if (isManager) {
      return '/manager-dashboard';
    }
    
    if (isEmployee) {
      return '/employee-dashboard';
    }
    
    if (isNewcomer) {
      return '/newcomer-dashboard';
    }
    
    // Default fallback
    return '/dashboard';
  };

  return {
    dashboardRoute: getDashboardRoute(),
    canAccessAdminDashboard: isAdmin,
    canAccessManagerDashboard: isManager || isAdmin,
    canAccessEmployeeDashboard: isEmployee || isManager || isAdmin,
    canAccessNewcomerDashboard: isNewcomer || isEmployee || isManager || isAdmin,
  };
}

/**
 * Hook for feature access control
 * Check access to specific application features
 */
export function useFeatureAccess() {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { canAccessAdmin, canManageTeam, canApproveDocuments } = useRole();

  return {
    // Profile features
    canEditProfile: hasPermission('profile:write'),
    canViewProfile: hasPermission('profile:read'),
    canCompleteProfile: hasPermission('profile:complete'),
    
    // Document features
    canUploadDocuments: hasPermission('documents:upload'),
    canReviewDocuments: hasPermission('documents:review'),
    canApproveDocuments: canApproveDocuments(),
    
    // Employee management
    canViewEmployees: hasPermission('employee:read'),
    canManageEmployees: hasPermission('employee:manage'),
    canDeleteEmployees: hasPermission('employee:delete'),
    
    // Team management
    canViewTeam: hasPermission('team:read'),
    canManageTeam: canManageTeam(),
    
    // Admin features
    canAccessAdminPanel: canAccessAdmin(),
    canManageSystem: hasPermission('admin:write'),
    canViewReports: hasPermission('reports:view'),
    canExportReports: hasPermission('reports:export'),
    canManageNotifications: hasPermission('notifications:manage'),
    
    // System monitoring
    canViewSystemHealth: hasPermission('system:health'),
    canViewAuditLogs: hasPermission('audit:logs'),
  };
}

/**
 * Hook for navigation access control
 * Determines which navigation items should be visible
 */
export function useNavigationAccess() {
  const { isAdmin, isManager, isEmployee, isNewcomer } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();

  return {
    // Main navigation
    showDashboard: true,
    showProfile: true,
    showDocuments: hasPermission('documents:upload'),
    
    // Team management
    showTeam: hasAnyPermission(['team:read', 'team:manage']),
    showEmployees: hasPermission('employee:read'),
    
    // Admin navigation
    showAdminPanel: isAdmin,
    showUserManagement: isAdmin && hasPermission('employee:manage'),
    showDepartments: isAdmin,
    showSystemSettings: isAdmin && hasPermission('admin:write'),
    showReports: hasAnyPermission(['reports:view', 'reports:create']),
    showAuditLogs: hasPermission('audit:logs'),
    
    // Manager navigation
    showManagerTools: isManager || isAdmin,
    showManagerDepartments: isManager || isAdmin,
    showApprovals: hasPermission('documents:approve'),
    
    // Employee navigation
    showPersonalDocuments: isEmployee || isManager || isAdmin,
    showTimeTracking: isEmployee || isManager || isAdmin,
    
    // Newcomer navigation
    showOnboarding: isNewcomer,
    showProfileCompletion: hasPermission('profile:complete'),
  };
}