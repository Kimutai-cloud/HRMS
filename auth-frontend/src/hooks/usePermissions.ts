import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions,
  getAllUserPermissions,
  type UserProfile 
} from '../lib/permissions';

/**
 * Hook for checking permissions in components
 */
export function usePermissions() {
  const { userProfile, permissions } = useAuth();
  
  // Get all permissions including role-based ones
  const allPermissions = useMemo(() => {
    return getAllUserPermissions(userProfile);
  }, [userProfile]);

  return {
    permissions: allPermissions,
    hasPermission: (permission: string) => hasPermission(allPermissions, permission),
    hasAnyPermission: (permissions: string[]) => hasAnyPermission(allPermissions, permissions),
    hasAllPermissions: (permissions: string[]) => hasAllPermissions(allPermissions, permissions),
  };
}

/**
 * Hook for checking specific permission
 */
export function useHasPermission(permission: string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
}

/**
 * Hook for checking if user has any of the specified permissions
 */
export function useHasAnyPermission(permissions: string[]): boolean {
  const { hasAnyPermission } = usePermissions();
  return hasAnyPermission(permissions);
}

/**
 * Hook for checking if user has all of the specified permissions
 */
export function useHasAllPermissions(permissions: string[]): boolean {
  const { hasAllPermissions } = usePermissions();
  return hasAllPermissions(permissions);
}