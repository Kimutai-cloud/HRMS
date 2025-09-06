/**
 * Employee Profile Service
 * Handles all employee profile related API operations using the centralized API layer
 */

import { employeeService } from './serviceFactory';
import { 
  type UserProfile,
  type EmployeeProfileResponse,
  type ProfileSubmissionData,
  type AccessSummary,
  type EmployeeData,
  type ManagerOption,
  VerificationStatus,
  AccessLevel 
} from '../types/auth';

export interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  date_of_birth?: string;
  position?: string;
  department?: string;
  employment_type?: 'full_time' | 'part_time' | 'contract' | 'intern';
  work_location?: 'office' | 'remote' | 'hybrid';
  start_date?: string;
}

export interface ManagerAssignmentData {
  employee_id: string;
  manager_id: string;
  effective_date?: string;
}

export interface BulkUpdateData {
  employee_ids: string[];
  updates: Partial<ProfileUpdateData>;
}

export interface ProfileSearchFilters {
  department?: string;
  verification_status?: VerificationStatus;
  employment_type?: string;
  work_location?: string;
  manager_id?: string;
  search_term?: string;
  limit?: number;
  offset?: number;
}

class EmployeeProfileService {
  private determineAccessLevel(profile: { employee: any; roles: any[] }): AccessLevel {
    const hasAdminRole = profile.roles?.some(role => 
      role.code === "ADMIN" || role.role_code === "ADMIN"
    );
    if (hasAdminRole) {
      return AccessLevel.ADMIN;
    }

    if (!profile.employee) {
      return AccessLevel.PROFILE_COMPLETION;
    }

    if (profile.employee.verification_status === 'VERIFIED') {
      return AccessLevel.VERIFIED;
    }

    return AccessLevel.NEWCOMER;
  }

  private extractPermissions(roles: any[]): string[] {
    const permissions: string[] = [];
    roles?.forEach(role => {
      switch (role.role_code || role.code) {
        case "ADMIN":
          permissions.push("admin:read", "admin:write", "admin:delete", "employee:manage", "reports:view");
          break;
        case "MANAGER":
          permissions.push("team:read", "team:manage", "reports:view", "employee:read");
          break;
        case "EMPLOYEE":
          permissions.push("profile:read", "profile:write", "documents:upload");
          break;
        case "NEWCOMER":
          permissions.push("profile:complete", "documents:upload");
          break;
      }
    });
    return [...new Set(permissions)];
  }
  /**
   * Get employee profile by ID
   */
  async getEmployeeProfile(employeeId: string): Promise<UserProfile> {
    try {
      // Use the actual backend endpoint for getting employee by ID
      return await employeeService.get<UserProfile>(`/employees/${employeeId}`);
    } catch (error) {
      console.error('Failed to fetch employee profile:', error);
      throw error;
    }
  }

  /**
   * Get current user's profile
   */
  async getCurrentProfile(): Promise<UserProfile> {
    try {
      // Use the actual backend /me/ endpoint
      const response = await employeeService.get<{
        user_id: string;
        email: string;
        employee: any;
        roles: any[];
      }>('/me/');
      
      // Transform to UserProfile format
      return {
        id: response.user_id,
        email: response.email,
        firstName: response.employee?.first_name || '',
        lastName: response.employee?.last_name || '',
        isEmailVerified: true,
        employee: response.employee,
        roles: response.roles || [],
        access_level: this.determineAccessLevel(response),
        verification_status: response.employee?.verification_status || 'NOT_STARTED',
        permissions: this.extractPermissions(response.roles || []),
        employee_profile_status: response.employee?.verification_status || 'NOT_STARTED'
      } as UserProfile;
    } catch (error) {
      console.error('Failed to fetch current user profile:', error);
      throw error;
    }
  }

  /**
   * Update employee profile
   */
  async updateEmployeeProfile(employeeId: string, data: ProfileUpdateData): Promise<UserProfile> {
    try {
      // Use the actual backend endpoint for updating employees
      return await employeeService.patch<UserProfile>(`/employees/${employeeId}`, data);
    } catch (error) {
      console.error('Failed to update employee profile:', error);
      throw error;
    }
  }

  /**
   * Update current user's profile
   */
  async updateCurrentProfile(data: ProfileUpdateData): Promise<UserProfile> {
    try {
      // Use the profile resubmit endpoint for current user updates
      return await employeeService.post<UserProfile>('/profile/resubmit', data);
    } catch (error) {
      console.error('Failed to update current user profile:', error);
      throw error;
    }
  }

  /**
   * Submit profile for verification
   */
  async submitProfileForVerification(data: ProfileSubmissionData): Promise<EmployeeProfileResponse> {
    try {
      // Use the actual backend profile submission endpoint
      return await employeeService.post<EmployeeProfileResponse>('/profile/submit', data);
    } catch (error) {
      console.error('Failed to submit profile for verification:', error);
      throw error;
    }
  }

  /**
   * Get access summary for employee
   */
  async getAccessSummary(employeeId?: string): Promise<AccessSummary> {
    try {
      // Use the /me/ endpoint and transform the response
      const response = await employeeService.get<{
        user_id: string;
        email: string;
        employee: any;
        roles: any[];
      }>('/me/');
      
      return {
        user_id: response.user_id,
        email: response.email,
        access_level: this.determineAccessLevel(response),
        verification_status: response.employee?.verification_status || 'NOT_STARTED',
        roles: response.roles?.map(r => r.role_code || r.code) || [],
        permissions: this.extractPermissions(response.roles || []),
        can_access_system: response.employee?.verification_status === 'VERIFIED',
        needs_profile_completion: !response.employee || response.employee.verification_status === 'NOT_STARTED',
        is_newcomer: !response.employee || response.employee.verification_status !== 'VERIFIED',
        is_admin: response.roles?.some(r => (r.role_code || r.code) === "ADMIN") || false
      };
    } catch (error) {
      console.error('Failed to fetch access summary:', error);
      throw error;
    }
  }

  /**
   * Get team members for a manager
   */
  async getTeamMembers(managerId?: string): Promise<EmployeeData[]> {
    try {
      // Use the actual backend endpoint for getting team members
      return await employeeService.get<EmployeeData[]>('/employees/me/team');
    } catch (error) {
      console.error('Failed to fetch team members:', error);
      throw error;
    }
  }

  /**
   * Get all employees (admin only)
   */
  async getAllEmployees(filters: ProfileSearchFilters = {}): Promise<{
    employees: EmployeeData[];
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

      const endpoint = `/employees${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await employeeService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch all employees:', error);
      throw error;
    }
  }

  /**
   * Search employees
   */
  async searchEmployees(searchTerm: string, filters: Omit<ProfileSearchFilters, 'search_term'> = {}): Promise<EmployeeData[]> {
    try {
      const searchFilters: ProfileSearchFilters = {
        ...filters,
        search_term: searchTerm,
      };

      const result = await this.getAllEmployees(searchFilters);
      return result.employees;
    } catch (error) {
      console.error('Failed to search employees:', error);
      throw error;
    }
  }

  /**
   * Approve employee verification
   */
  async approveEmployee(employeeId: string, comments?: string): Promise<UserProfile> {
    try {
      return await employeeService.post<UserProfile>(`/employees/${employeeId}/approve`, {
        comments,
        approved_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to approve employee:', error);
      throw error;
    }
  }

  /**
   * Reject employee verification
   */
  async rejectEmployee(employeeId: string, reason: string): Promise<UserProfile> {
    try {
      return await employeeService.post<UserProfile>(`/employees/${employeeId}/reject`, {
        reason,
        rejected_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to reject employee:', error);
      throw error;
    }
  }

  /**
   * Assign manager to employee
   */
  async assignManager(data: ManagerAssignmentData): Promise<UserProfile> {
    try {
      return await employeeService.post<UserProfile>(`/employees/${data.employee_id}/assign-manager`, {
        manager_id: data.manager_id,
        effective_date: data.effective_date || new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to assign manager:', error);
      throw error;
    }
  }

  /**
   * Remove manager from employee
   */
  async removeManager(employeeId: string): Promise<UserProfile> {
    try {
      return await employeeService.delete<UserProfile>(`/employees/${employeeId}/manager`);
    } catch (error) {
      console.error('Failed to remove manager:', error);
      throw error;
    }
  }

  /**
   * Bulk update employees
   */
  async bulkUpdateEmployees(data: BulkUpdateData): Promise<{
    updated: number;
    failed: Array<{ employee_id: string; error: string }>;
  }> {
    try {
      return await employeeService.post('/employees/bulk-update', data);
    } catch (error) {
      console.error('Failed to bulk update employees:', error);
      throw error;
    }
  }

  /**
   * Deactivate employee
   */
  async deactivateEmployee(employeeId: string, reason?: string): Promise<UserProfile> {
    try {
      return await employeeService.post<UserProfile>(`/employees/${employeeId}/deactivate`, {
        reason,
        deactivated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to deactivate employee:', error);
      throw error;
    }
  }

  /**
   * Reactivate employee
   */
  async reactivateEmployee(employeeId: string): Promise<UserProfile> {
    try {
      return await employeeService.post<UserProfile>(`/employees/${employeeId}/reactivate`, {
        reactivated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to reactivate employee:', error);
      throw error;
    }
  }

  /**
   * Get employee verification history
   */
  async getVerificationHistory(employeeId: string): Promise<Array<{
    id: string;
    status: VerificationStatus;
    changed_by: string;
    changed_at: string;
    comments?: string;
    reason?: string;
  }>> {
    try {
      return await employeeService.get(`/employees/${employeeId}/verification-history`);
    } catch (error) {
      console.error('Failed to fetch verification history:', error);
      throw error;
    }
  }

  /**
   * Get profile completion statistics
   */
  async getProfileCompletionStats(): Promise<{
    total_employees: number;
    completed_profiles: number;
    incomplete_profiles: number;
    average_completion: number;
    completion_by_department: Array<{
      department: string;
      total: number;
      completed: number;
      average_completion: number;
    }>;
  }> {
    try {
      return await employeeService.get('/employees/profile-completion-stats');
    } catch (error) {
      console.error('Failed to fetch profile completion stats:', error);
      throw error;
    }
  }

  /**
   * Export employee data
   */
  async exportEmployeeData(
    format: 'csv' | 'xlsx' = 'csv',
    filters: ProfileSearchFilters = {}
  ): Promise<void> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', format);
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      await employeeService.download(`/employees/export?${queryParams.toString()}`, `employees.${format}`);
    } catch (error) {
      console.error('Failed to export employee data:', error);
      throw error;
    }
  }

  /**
   * Get available managers for assignment
   */
  async getManagers(departmentFilter?: string): Promise<ManagerOption[]> {
    try {
      const endpoint = departmentFilter 
        ? `/profile/managers/by-department/${departmentFilter}`
        : '/profile/managers';
      
      return await employeeService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch managers:', error);
      throw error;
    }
  }
}

// Create singleton instance
const employeeProfileService = new EmployeeProfileService();

export default employeeProfileService;