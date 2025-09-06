/**
 * Role Management Service
 * Handles all role and permission-related API operations using the centralized API layer
 */

import { authService, employeeService } from './serviceFactory';
import { type RoleAssignment, RoleCode } from '../types/auth';

export interface Role {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
  permissions: string[];
  is_system_role: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
  is_system_permission: boolean;
}

export interface RoleRequest {
  id?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  requested_role_id: string;
  requested_role_name: string;
  current_roles: string[];
  justification: string;
  requested_by: string;
  approved_by?: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_at?: string;
  review_comments?: string;
}

export interface RoleAssignmentData {
  user_id: string;
  role_id: string;
  scope?: Record<string, any>;
  effective_from?: string;
  effective_until?: string;
  assigned_by: string;
  reason?: string;
}

export interface BulkRoleAction {
  user_ids: string[];
  action: 'assign' | 'revoke' | 'update';
  role_id: string;
  scope?: Record<string, any>;
  reason?: string;
}

export interface RoleHierarchy {
  role_id: string;
  role_name: string;
  level: number;
  parent_roles: string[];
  child_roles: string[];
  inherits_permissions: boolean;
}

export interface AccessMatrix {
  user_id: string;
  user_name: string;
  roles: Array<{
    role_id: string;
    role_name: string;
    permissions: string[];
    scope: Record<string, any>;
  }>;
  effective_permissions: string[];
  access_level: string;
}

class RoleService {
  /**
   * Get all available roles
   */
  async getRoles(includeInactive = false): Promise<Role[]> {
    try {
      const endpoint = includeInactive ? '/roles?include_inactive=true' : '/roles';
      return await authService.get<Role[]>(endpoint);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      throw error;
    }
  }

  /**
   * Get role by ID
   */
  async getRole(roleId: string): Promise<Role> {
    try {
      return await authService.get<Role>(`/roles/${roleId}`);
    } catch (error) {
      console.error('Failed to fetch role:', error);
      throw error;
    }
  }

  /**
   * Create new role
   */
  async createRole(roleData: {
    code: string;
    name: string;
    description: string;
    permissions: string[];
  }): Promise<Role> {
    try {
      return await authService.post<Role>('/roles', roleData);
    } catch (error) {
      console.error('Failed to create role:', error);
      throw error;
    }
  }

  /**
   * Update role
   */
  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    try {
      return await authService.put<Role>(`/roles/${roleId}`, updates);
    } catch (error) {
      console.error('Failed to update role:', error);
      throw error;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    try {
      await authService.delete(`/roles/${roleId}`);
    } catch (error) {
      console.error('Failed to delete role:', error);
      throw error;
    }
  }

  /**
   * Get all permissions
   */
  async getPermissions(): Promise<Permission[]> {
    try {
      return await authService.get<Permission[]>('/permissions');
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      throw error;
    }
  }

  /**
   * Get permissions by resource
   */
  async getPermissionsByResource(resource: string): Promise<Permission[]> {
    try {
      return await authService.get<Permission[]>(`/permissions?resource=${resource}`);
    } catch (error) {
      console.error('Failed to fetch permissions by resource:', error);
      throw error;
    }
  }

  /**
   * Create custom permission
   */
  async createPermission(permissionData: {
    code: string;
    name: string;
    description: string;
    resource: string;
    action: string;
    conditions?: Record<string, any>;
  }): Promise<Permission> {
    try {
      return await authService.post<Permission>('/permissions', permissionData);
    } catch (error) {
      console.error('Failed to create permission:', error);
      throw error;
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<RoleAssignment[]> {
    try {
      return await authService.get<RoleAssignment[]>(`/users/${userId}/roles`);
    } catch (error) {
      console.error('Failed to fetch user roles:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(assignmentData: RoleAssignmentData): Promise<RoleAssignment> {
    try {
      return await authService.post<RoleAssignment>('/role-assignments', assignmentData);
    } catch (error) {
      console.error('Failed to assign role to user:', error);
      throw error;
    }
  }

  /**
   * Revoke role from user
   */
  async revokeRoleFromUser(userId: string, roleId: string, reason?: string): Promise<void> {
    try {
      const endpoint = reason
        ? `/users/${userId}/roles/${roleId}?reason=${encodeURIComponent(reason)}`
        : `/users/${userId}/roles/${roleId}`;
      await authService.delete(endpoint);
    } catch (error) {
      console.error('Failed to revoke role from user:', error);
      throw error;
    }
  }

  /**
   * Update role assignment
   */
  async updateRoleAssignment(
    assignmentId: string, 
    updates: Partial<RoleAssignmentData>
  ): Promise<RoleAssignment> {
    try {
      return await authService.put<RoleAssignment>(`/role-assignments/${assignmentId}`, updates);
    } catch (error) {
      console.error('Failed to update role assignment:', error);
      throw error;
    }
  }

  /**
   * Bulk assign/revoke roles
   */
  async bulkRoleAction(action: BulkRoleAction): Promise<{
    processed: number;
    failed: Array<{ user_id: string; error: string }>;
  }> {
    try {
      return await authService.post('/role-assignments/bulk', action);
    } catch (error) {
      console.error('Failed to perform bulk role action:', error);
      throw error;
    }
  }

  /**
   * Request role assignment
   */
  async requestRole(requestData: {
    role_id: string;
    justification: string;
  }): Promise<RoleRequest> {
    try {
      return await authService.post<RoleRequest>('/role-requests', requestData);
    } catch (error) {
      console.error('Failed to request role:', error);
      throw error;
    }
  }

  /**
   * Get pending role requests
   */
  async getPendingRoleRequests(): Promise<RoleRequest[]> {
    try {
      return await authService.get<RoleRequest[]>('/role-requests?status=pending');
    } catch (error) {
      console.error('Failed to fetch pending role requests:', error);
      throw error;
    }
  }

  /**
   * Get all role requests
   */
  async getRoleRequests(filters: {
    user_id?: string;
    status?: 'pending' | 'approved' | 'rejected';
    role_id?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    requests: RoleRequest[];
    total: number;
    offset: number;
    limit: number;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `/role-requests${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await authService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch role requests:', error);
      throw error;
    }
  }

  /**
   * Approve role request
   */
  async approveRoleRequest(requestId: string, comments?: string): Promise<RoleRequest> {
    try {
      return await authService.post<RoleRequest>(`/role-requests/${requestId}/approve`, {
        review_comments: comments,
        reviewed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to approve role request:', error);
      throw error;
    }
  }

  /**
   * Reject role request
   */
  async rejectRoleRequest(requestId: string, reason: string): Promise<RoleRequest> {
    try {
      return await authService.post<RoleRequest>(`/role-requests/${requestId}/reject`, {
        review_comments: reason,
        reviewed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to reject role request:', error);
      throw error;
    }
  }

  /**
   * Get role hierarchy
   */
  async getRoleHierarchy(): Promise<RoleHierarchy[]> {
    try {
      return await authService.get<RoleHierarchy[]>('/roles/hierarchy');
    } catch (error) {
      console.error('Failed to fetch role hierarchy:', error);
      throw error;
    }
  }

  /**
   * Check user permissions
   */
  async checkUserPermissions(
    userId: string, 
    permissions: string[]
  ): Promise<Record<string, boolean>> {
    try {
      return await authService.post(`/users/${userId}/check-permissions`, { permissions });
    } catch (error) {
      console.error('Failed to check user permissions:', error);
      throw error;
    }
  }

  /**
   * Get user access matrix
   */
  async getUserAccessMatrix(userId: string): Promise<AccessMatrix> {
    try {
      return await authService.get<AccessMatrix>(`/users/${userId}/access-matrix`);
    } catch (error) {
      console.error('Failed to fetch user access matrix:', error);
      throw error;
    }
  }

  /**
   * Get effective permissions for user
   */
  async getEffectivePermissions(userId: string): Promise<{
    permissions: Permission[];
    roles: Role[];
    access_level: string;
    computed_at: string;
  }> {
    try {
      return await authService.get(`/users/${userId}/effective-permissions`);
    } catch (error) {
      console.error('Failed to fetch effective permissions:', error);
      throw error;
    }
  }

  /**
   * Simulate role assignment (dry run)
   */
  async simulateRoleAssignment(userId: string, roleId: string): Promise<{
    current_permissions: string[];
    new_permissions: string[];
    added_permissions: string[];
    removed_permissions: string[];
    access_level_change: {
      from: string;
      to: string;
    };
    warnings: string[];
  }> {
    try {
      return await authService.post(`/users/${userId}/simulate-role-assignment`, { role_id: roleId });
    } catch (error) {
      console.error('Failed to simulate role assignment:', error);
      throw error;
    }
  }

  /**
   * Get role usage statistics
   */
  async getRoleStatistics(): Promise<{
    total_roles: number;
    active_roles: number;
    custom_roles: number;
    system_roles: number;
    role_assignments: number;
    most_assigned_roles: Array<{
      role_id: string;
      role_name: string;
      assignment_count: number;
    }>;
    least_assigned_roles: Array<{
      role_id: string;
      role_name: string;
      assignment_count: number;
    }>;
    orphaned_permissions: string[];
  }> {
    try {
      return await authService.get('/roles/statistics');
    } catch (error) {
      console.error('Failed to fetch role statistics:', error);
      throw error;
    }
  }

  /**
   * Export role assignments
   */
  async exportRoleAssignments(
    format: 'csv' | 'xlsx' = 'csv',
    filters: {
      role_id?: string;
      user_id?: string;
      include_inactive?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', format);
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      await authService.download(
        `/role-assignments/export?${queryParams.toString()}`, 
        `role-assignments-${new Date().toISOString().split('T')[0]}.${format}`
      );
    } catch (error) {
      console.error('Failed to export role assignments:', error);
      throw error;
    }
  }

  /**
   * Validate role configuration
   */
  async validateRoleConfiguration(): Promise<{
    is_valid: boolean;
    warnings: Array<{
      type: 'circular_dependency' | 'orphaned_permission' | 'unused_role' | 'conflicting_permissions';
      message: string;
      affected_items: string[];
      severity: 'low' | 'medium' | 'high';
    }>;
    suggestions: Array<{
      type: 'optimization' | 'security' | 'maintenance';
      message: string;
      recommended_action: string;
    }>;
  }> {
    try {
      return await authService.get('/roles/validate');
    } catch (error) {
      console.error('Failed to validate role configuration:', error);
      throw error;
    }
  }

  /**
   * Get role assignment history
   */
  async getRoleAssignmentHistory(
    userId?: string,
    roleId?: string,
    limit = 50,
    offset = 0
  ): Promise<{
    history: Array<{
      id: string;
      user_id: string;
      user_name: string;
      role_id: string;
      role_name: string;
      action: 'assigned' | 'revoked' | 'updated';
      performed_by: string;
      performed_at: string;
      reason?: string;
      scope?: Record<string, any>;
    }>;
    total: number;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('user_id', userId);
      if (roleId) queryParams.append('role_id', roleId);
      queryParams.append('limit', limit.toString());
      queryParams.append('offset', offset.toString());

      return await authService.get(`/role-assignments/history?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to fetch role assignment history:', error);
      throw error;
    }
  }

  /**
   * Create role template
   */
  async createRoleTemplate(templateData: {
    name: string;
    description: string;
    base_roles: string[];
    additional_permissions: string[];
    scope_template: Record<string, any>;
  }): Promise<{
    template_id: string;
    created_at: string;
  }> {
    try {
      return await authService.post('/role-templates', templateData);
    } catch (error) {
      console.error('Failed to create role template:', error);
      throw error;
    }
  }

  /**
   * Apply role template to user
   */
  async applyRoleTemplate(
    userId: string,
    templateId: string,
    customizations?: Record<string, any>
  ): Promise<RoleAssignment[]> {
    try {
      return await authService.post(`/users/${userId}/apply-role-template`, {
        template_id: templateId,
        customizations,
      });
    } catch (error) {
      console.error('Failed to apply role template:', error);
      throw error;
    }
  }
}

// Create singleton instance
const roleService = new RoleService();

export default roleService;