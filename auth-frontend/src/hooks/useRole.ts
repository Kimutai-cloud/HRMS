import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RoleCode, AccessLevel } from '../types/auth';
import { 
  hasRole, 
  hasAnyRole, 
  canAccessAdmin, 
  canManageTeam, 
  canApproveDocuments,
  needsProfileCompletion,
  isVerified,
  canAccessRoute,
  isNewcomer
} from '../lib/permissions';

/**
 * Hook for role-based access control
 */
export function useRole() {
  const { userProfile, isAdmin, isManager, isEmployee, isNewcomer: contextIsNewcomer } = useAuth();

  const roleChecks = useMemo(() => ({
    hasRole: (role: RoleCode) => hasRole(userProfile, role),
    hasAnyRole: (roles: RoleCode[]) => hasAnyRole(userProfile, roles),
    canAccessAdmin: () => canAccessAdmin(userProfile),
    canManageTeam: () => canManageTeam(userProfile),
    canApproveDocuments: () => canApproveDocuments(userProfile),
    needsProfileCompletion: () => needsProfileCompletion(userProfile),
    isVerified: () => isVerified(userProfile),
    isNewcomer: () => isNewcomer(userProfile),
    canAccessRoute: (requiredLevel: AccessLevel) => canAccessRoute(userProfile, requiredLevel),
  }), [userProfile]);

  return {
    userProfile,
    isAdmin,
    isManager,
    isEmployee,
    contextIsNewcomer,
    ...roleChecks,
  };
}

/**
 * Hook for checking specific role
 */
export function useHasRole(role: RoleCode): boolean {
  const { hasRole } = useRole();
  return hasRole(role);
}

/**
 * Hook for checking if user has any of the specified roles
 */
export function useHasAnyRole(roles: RoleCode[]): boolean {
  const { hasAnyRole } = useRole();
  return hasAnyRole(roles);
}

/**
 * Hook for admin access
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = useRole();
  return isAdmin;
}

/**
 * Hook for manager access
 */
export function useIsManager(): boolean {
  const { isManager } = useRole();
  return isManager;
}

/**
 * Hook for employee access
 */
export function useIsEmployee(): boolean {
  const { isEmployee } = useRole();
  return isEmployee;
}

/**
 * Hook for newcomer status
 */
export function useIsNewcomer(): boolean {
  const { isNewcomer } = useRole();
  return isNewcomer();
}

/**
 * Hook for checking admin capabilities
 */
export function useCanAccessAdmin(): boolean {
  const { canAccessAdmin } = useRole();
  return canAccessAdmin();
}

/**
 * Hook for checking team management capabilities
 */
export function useCanManageTeam(): boolean {
  const { canManageTeam } = useRole();
  return canManageTeam();
}

/**
 * Hook for checking document approval capabilities
 */
export function useCanApproveDocuments(): boolean {
  const { canApproveDocuments } = useRole();
  return canApproveDocuments();
}

/**
 * Hook for checking if profile completion is needed
 */
export function useNeedsProfileCompletion(): boolean {
  const { needsProfileCompletion } = useRole();
  return needsProfileCompletion();
}

/**
 * Hook for checking verification status
 */
export function useIsVerified(): boolean {
  const { isVerified } = useRole();
  return isVerified();
}

/**
 * Hook for checking route access
 */
export function useCanAccessRoute(requiredLevel: AccessLevel): boolean {
  const { canAccessRoute } = useRole();
  return canAccessRoute(requiredLevel);
}