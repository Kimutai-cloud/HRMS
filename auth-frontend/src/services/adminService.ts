/**
 * Admin Operations Service
 * Handles all administrative API operations using the centralized API layer
 */

import { employeeService, authService } from './serviceFactory';
import { type EmployeeData, type UserProfile, VerificationStatus, AccessLevel } from '../types/auth';

export interface SystemMetrics {
  total_users: number;
  active_users: number;
  pending_approvals: number;
  total_employees: number;
  verified_employees: number;
  pending_employees: number;
  rejected_employees: number;
  new_registrations_today: number;
  new_registrations_week: number;
  documents_pending_review: number;
  system_health: 'healthy' | 'warning' | 'critical';
  last_updated: string;
}

export interface UserCreationData {
  email: string;
  first_name: string;
  last_name: string;
  temporary_password?: string;
  send_welcome_email?: boolean;
  roles: string[];
  department?: string;
  position?: string;
  manager_id?: string;
  employment_type?: 'full_time' | 'part_time' | 'contract' | 'intern';
  start_date?: string;
}

export interface BulkUserAction {
  user_ids: string[];
  action: 'activate' | 'deactivate' | 'verify' | 'reject' | 'delete' | 'reset_password';
  reason?: string;
  send_notification?: boolean;
}

export interface SystemSettings {
  id: string;
  category: 'security' | 'notifications' | 'documents' | 'general';
  key: string;
  value: string;
  description: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  is_public: boolean;
  updated_by: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, any>;
  ip_address: string;
  user_agent: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  resource_type?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  start_date?: string;
  end_date?: string;
  ip_address?: string;
  limit?: number;
  offset?: number;
}

export interface ComplianceReport {
  report_id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  total_employees: number;
  compliant_employees: number;
  non_compliant_employees: number;
  compliance_rate: number;
  missing_documents: Array<{
    employee_id: string;
    employee_name: string;
    missing_docs: string[];
  }>;
  expired_documents: Array<{
    employee_id: string;
    employee_name: string;
    expired_docs: string[];
  }>;
  department_compliance: Array<{
    department: string;
    total: number;
    compliant: number;
    rate: number;
  }>;
}

class AdminService {
  // ============================================================================
  // PHASE 1: STAGE-SPECIFIC METHODS FOR 4-STAGE WORKFLOW
  // ============================================================================

  /**
   * Get employees pending details review (Stage 1)
   */
  async getPendingDetailsReviews(limit = 50): Promise<any> {
    try {
      return await employeeService.get(`/admin/pending-reviews/details?limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch pending details reviews:', error);
      throw error;
    }
  }

  /**
   * Get employees pending documents review (Stage 2)
   */
  async getPendingDocumentsReviews(limit = 50): Promise<any> {
    try {
      return await employeeService.get(`/admin/pending-reviews/documents?limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch pending documents reviews:', error);
      throw error;
    }
  }

  /**
   * Get employees pending role assignment (Stage 3)
   */
  async getPendingRoleAssignments(limit = 50): Promise<any> {
    try {
      return await employeeService.get(`/admin/pending-reviews/roles?limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch pending role assignments:', error);
      throw error;
    }
  }

  /**
   * Get employees pending final approval (Stage 4)
   */
  async getPendingFinalApprovals(limit = 50): Promise<any> {
    try {
      return await employeeService.get(`/admin/pending-reviews/final?limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch pending final approvals:', error);
      throw error;
    }
  }

  /**
   * Get employee documents for review
   */
  async getEmployeeDocumentsForReview(employeeId: string): Promise<any> {
    try {
      return await employeeService.get(`/admin/documents/${employeeId}`);
    } catch (error) {
      console.error('Failed to fetch employee documents for review:', error);
      throw error;
    }
  }

  // ============================================================================
  // STAGE ACTIONS
  // ============================================================================

  /**
   * Approve employee details (Stage 1)
   */
  async approveDetails(employeeId: string, notes?: string): Promise<any> {
    try {
      return await employeeService.post(`/admin/reviews/${employeeId}/approve-details`, {
        notes: notes || ''
      });
    } catch (error) {
      console.error('Failed to approve details:', error);
      throw error;
    }
  }

  /**
   * Approve employee documents (Stage 2)
   */
  async approveDocuments(employeeId: string, notes?: string): Promise<any> {
    try {
      return await employeeService.post(`/admin/reviews/${employeeId}/approve-documents`, {
        notes: notes || ''
      });
    } catch (error) {
      console.error('Failed to approve documents:', error);
      throw error;
    }
  }

  /**
   * Assign role to employee (Stage 3)
   */
  async assignRole(employeeId: string, roleCode: string, notes?: string): Promise<any> {
    try {
      return await employeeService.post(`/admin/reviews/${employeeId}/assign-role`, {
        role_code: roleCode,
        notes: notes || ''
      });
    } catch (error) {
      console.error('Failed to assign role:', error);
      throw error;
    }
  }

  /**
   * Final approve employee (Stage 4)
   */
  async finalApprove(employeeId: string, notes?: string): Promise<any> {
    try {
      return await employeeService.post(`/admin/reviews/${employeeId}/final-approve`, {
        notes: notes || ''
      });
    } catch (error) {
      console.error('Failed to final approve:', error);
      throw error;
    }
  }

  /**
   * Reject employee at any stage
   */
  async rejectAtStage(employeeId: string, reason: string, stage?: string): Promise<any> {
    try {
      return await employeeService.post(`/admin/reviews/${employeeId}/reject`, {
        reason,
        stage
      });
    } catch (error) {
      console.error('Failed to reject at stage:', error);
      throw error;
    }
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Bulk approve employees at specific stage
   */
  async bulkApproveStage(employeeIds: string[], stage: string, notes?: string): Promise<any> {
    try {
      return await employeeService.post('/admin/reviews/bulk-approve', {
        employee_ids: employeeIds,
        stage,
        notes: notes || ''
      });
    } catch (error) {
      console.error('Failed to bulk approve stage:', error);
      throw error;
    }
  }

  /**
   * Bulk approve documents
   */
  async bulkApproveDocuments(documentIds: string[], notes?: string): Promise<any> {
    try {
      return await employeeService.post('/admin/reviews/bulk-documents-approve', {
        document_ids: documentIds,
        notes: notes || ''
      });
    } catch (error) {
      console.error('Failed to bulk approve documents:', error);
      throw error;
    }
  }

  /**
   * Bulk reject employees (implemented as multiple individual calls)
   */
  async bulkReject(employeeIds: string[], reason: string, stage?: string): Promise<{
    results: Array<{ employeeId: string; success: boolean; error?: string }>;
    total: number;
    successful: number;
  }> {
    try {
      const results = await Promise.allSettled(
        employeeIds.map(employeeId => 
          this.rejectAtStage(employeeId, reason, stage)
            .then(() => ({ employeeId, success: true }))
            .catch(error => ({ employeeId, success: false, error: error.message }))
        )
      );

      const processedResults = results.map(result => 
        result.status === 'fulfilled' ? result.value : result.reason
      );

      return {
        results: processedResults,
        total: employeeIds.length,
        successful: processedResults.filter(r => r.success).length
      };
    } catch (error) {
      console.error('Failed to bulk reject:', error);
      throw error;
    }
  }

  // ============================================================================
  // DOCUMENT OPERATIONS
  // ============================================================================

  /**
   * Approve individual document
   */
  async approveDocument(documentId: string, notes?: string): Promise<any> {
    try {
      return await employeeService.post(`/admin/documents/${documentId}/approve`, {
        notes: notes || ''
      });
    } catch (error) {
      console.error('Failed to approve document:', error);
      throw error;
    }
  }

  /**
   * Reject individual document
   */
  async rejectDocument(documentId: string, notes: string): Promise<any> {
    try {
      return await employeeService.post(`/admin/documents/${documentId}/reject`, {
        notes
      });
    } catch (error) {
      console.error('Failed to reject document:', error);
      throw error;
    }
  }

  /**
   * Request document replacement
   */
  async requestDocumentReplacement(documentId: string, reason: string): Promise<any> {
    try {
      return await employeeService.post(`/admin/documents/${documentId}/request-replacement`, {
        notes: reason
      });
    } catch (error) {
      console.error('Failed to request document replacement:', error);
      throw error;
    }
  }

  /**
   * Download document
   */
  async downloadDocument(documentId: string): Promise<Blob> {
    try {
      const response = await fetch(`${import.meta.env.VITE_EMPLOYEE_SERVICE_URL || 'http://localhost:8001/api/v1'}/admin/documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.statusText}`);
      }
      
      return response.blob();
    } catch (error) {
      console.error('Failed to download document:', error);
      throw error;
    }
  }

  /**
   * Get preview URL for document
   */
  getDocumentPreviewUrl(documentId: string): string {
    const token = localStorage.getItem('accessToken');
    const baseUrl = import.meta.env.VITE_EMPLOYEE_SERVICE_URL || 'http://localhost:8001/api/v1';
    return `${baseUrl}/admin/documents/${documentId}/preview?token=${token}`;
  }

  /**
   * Get system metrics and dashboard data
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      // Use the actual admin dashboard endpoint
      const dashboard = await employeeService.get<any>('/admin/dashboard');
      
      // Transform to SystemMetrics format
      return {
        total_users: dashboard.quick_stats?.total_users || 0,
        active_users: dashboard.quick_stats?.total_verified || 0,
        pending_approvals: dashboard.pending_reviews?.total || 0,
        total_employees: dashboard.quick_stats?.total_employees || 0,
        verified_employees: dashboard.quick_stats?.total_verified || 0,
        pending_employees: dashboard.pending_reviews?.total || 0,
        rejected_employees: dashboard.quick_stats?.total_rejected || 0,
        new_registrations_today: 0, // Not available in current backend
        new_registrations_week: 0, // Not available in current backend
        documents_pending_review: dashboard.pending_reviews?.documents || 0,
        system_health: 'healthy',
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
      throw error;
    }
  }

  /**
   * Get all users with advanced filtering
   */
  async getAllUsers(filters: {
    search?: string;
    status?: 'active' | 'inactive' | 'pending';
    role?: string;
    department?: string;
    verified?: boolean;
    created_after?: string;
    created_before?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    users: UserProfile[];
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

      // Use the employees endpoint for user listing with admin access
      const endpoint = `/employees${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await employeeService.get<any>(endpoint);
      
      // Transform employees response to match expected format
      return {
        users: response.employees || [],
        total: response.total_count || 0,
        offset: response.page || 0,
        limit: response.size || 20
      };
    } catch (error) {
      console.error('Failed to fetch all users:', error);
      throw error;
    }
  }

  /**
   * Create new user account
   */
  async createUser(userData: UserCreationData): Promise<UserProfile> {
    try {
      // Use the employee creation endpoint
      return await employeeService.post<UserProfile>('/employees/', userData);
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Update user account
   */
  async updateUser(userId: string, updates: Partial<UserCreationData>): Promise<UserProfile> {
    try {
      // Use the employee update endpoint
      return await employeeService.patch<UserProfile>(`/employees/${userId}`, updates);
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  async deleteUser(userId: string, reason?: string): Promise<void> {
    try {
      // Use the employee deactivation endpoint
      await employeeService.post(`/employees/${userId}:deactivate`, {
        reason: reason || 'Administrative action'
      });
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * Bulk action on users
   */
  async bulkActionUsers(action: BulkUserAction): Promise<{
    processed: number;
    failed: Array<{ user_id: string; error: string }>;
  }> {
    try {
      // Use the bulk approval endpoint
      const result = await employeeService.post('/admin/reviews/bulk-approve', {
        employee_ids: action.user_ids,
        stage: 'FINAL_APPROVAL',
        notes: action.reason || 'Bulk action performed'
      });
      
      return {
        processed: action.user_ids.length,
        failed: []
      };
    } catch (error) {
      console.error('Failed to perform bulk action on users:', error);
      throw error;
    }
  }

  /**
   * Reset user password
   */
  async resetUserPassword(userId: string, sendEmail = true): Promise<{ temporary_password?: string }> {
    try {
      return await employeeService.post(`/admin/users/${userId}/reset-password`, {
        send_email: sendEmail,
      });
    } catch (error) {
      console.error('Failed to reset user password:', error);
      throw error;
    }
  }

  /**
   * Impersonate user (admin only)
   */
  async impersonateUser(userId: string): Promise<{ access_token: string; user: UserProfile }> {
    try {
      return await employeeService.post(`/admin/users/${userId}/impersonate`);
    } catch (error) {
      console.error('Failed to impersonate user:', error);
      throw error;
    }
  }

  /**
   * Get system settings
   */
  async getSystemSettings(category?: string): Promise<SystemSettings[]> {
    try {
      // Return empty array as settings endpoint doesn't exist yet
      console.warn('System settings endpoint not implemented in backend');
      return [];
    } catch (error) {
      console.error('Failed to fetch system settings:', error);
      throw error;
    }
  }

  /**
   * Update system setting
   */
  async updateSystemSetting(settingId: string, value: string): Promise<SystemSettings> {
    try {
      return await employeeService.put<SystemSettings>(`/admin/settings/${settingId}`, { value });
    } catch (error) {
      console.error('Failed to update system setting:', error);
      throw error;
    }
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(filters: AuditLogFilters = {}): Promise<{
    entries: AuditLogEntry[];
    total_count: number;
    has_more: boolean;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `/admin/audit-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await employeeService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      throw error;
    }
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(
    format: 'csv' | 'xlsx' = 'csv',
    filters: AuditLogFilters = {}
  ): Promise<void> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', format);
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      await employeeService.download(
        `/admin/audit-logs/export?${queryParams.toString()}`, 
        `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`
      );
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: string,
    endDate: string,
    departments?: string[]
  ): Promise<ComplianceReport> {
    try {
      const payload = {
        start_date: startDate,
        end_date: endDate,
        departments,
      };

      return await employeeService.post<ComplianceReport>('/admin/compliance-report', payload);
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    services: Array<{
      name: string;
      status: 'up' | 'down' | 'degraded';
      response_time: number;
      last_check: string;
    }>;
    database: {
      status: 'connected' | 'disconnected';
      connections: number;
      query_time: number;
    };
    storage: {
      used_space: number;
      total_space: number;
      usage_percentage: number;
    };
    uptime: number;
    last_updated: string;
  }> {
    try {
      return await employeeService.get('/admin/health');
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      throw error;
    }
  }

  /**
   * Backup system data
   */
  async initiateBackup(includeDocuments = false): Promise<{
    backup_id: string;
    started_at: string;
    estimated_completion: string;
  }> {
    try {
      return await employeeService.post('/admin/backup', {
        include_documents: includeDocuments,
      });
    } catch (error) {
      console.error('Failed to initiate backup:', error);
      throw error;
    }
  }

  /**
   * Get backup status
   */
  async getBackupStatus(backupId?: string): Promise<Array<{
    id: string;
    status: 'running' | 'completed' | 'failed';
    started_at: string;
    completed_at?: string;
    file_size?: number;
    download_url?: string;
    error_message?: string;
  }>> {
    try {
      const endpoint = backupId ? `/admin/backup/${backupId}` : '/admin/backup/status';
      return await employeeService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch backup status:', error);
      throw error;
    }
  }

  /**
   * Send system announcement
   */
  async sendAnnouncement(announcement: {
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    target_audience: 'all' | 'employees' | 'managers' | 'admins';
    departments?: string[];
    expires_at?: string;
    requires_acknowledgment?: boolean;
  }): Promise<{ announcement_id: string; sent_to: number }> {
    try {
      return await employeeService.post('/admin/announcements', announcement);
    } catch (error) {
      console.error('Failed to send announcement:', error);
      throw error;
    }
  }

  /**
   * Get pending approvals across the system
   */
  async getPendingApprovals(): Promise<{
    employee_verifications: Array<{
      employee_id: string;
      employee_name: string;
      submitted_at: string;
      profile_completion: number;
    }>;
    document_reviews: Array<{
      document_id: string;
      employee_name: string;
      document_type: string;
      uploaded_at: string;
    }>;
    role_requests: Array<{
      request_id: string;
      user_name: string;
      requested_role: string;
      requested_at: string;
    }>;
    total_pending: number;
  }> {
    try {
      return await employeeService.get('/admin/pending-approvals');
    } catch (error) {
      console.error('Failed to fetch pending approvals:', error);
      throw error;
    }
  }

  /**
   * Clear system cache
   */
  async clearSystemCache(cacheType?: 'user_sessions' | 'api_cache' | 'file_cache' | 'all'): Promise<{
    cleared: string[];
    cache_size_before: number;
    cache_size_after: number;
  }> {
    try {
      const payload = cacheType ? { cache_type: cacheType } : {};
      return await employeeService.post('/admin/clear-cache', payload);
    } catch (error) {
      console.error('Failed to clear system cache:', error);
      throw error;
    }
  }

  /**
   * Get system usage statistics
   */
  async getUsageStatistics(period: 'day' | 'week' | 'month' = 'week'): Promise<{
    period: string;
    active_users: number;
    total_logins: number;
    documents_uploaded: number;
    api_requests: number;
    storage_used: number;
    daily_breakdown: Array<{
      date: string;
      active_users: number;
      logins: number;
      documents: number;
      api_requests: number;
    }>;
  }> {
    try {
      return await employeeService.get(`/admin/usage-statistics?period=${period}`);
    } catch (error) {
      console.error('Failed to fetch usage statistics:', error);
      throw error;
    }
  }

  /**
   * Manage user sessions
   */
  async getUserSessions(userId?: string): Promise<Array<{
    session_id: string;
    user_id: string;
    user_email: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    last_activity: string;
    is_current: boolean;
  }>> {
    try {
      const endpoint = userId ? `/admin/sessions?user_id=${userId}` : '/admin/sessions';
      return await employeeService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch user sessions:', error);
      throw error;
    }
  }

  /**
   * Terminate user session
   */
  async terminateSession(sessionId: string): Promise<void> {
    try {
      await employeeService.delete(`/admin/sessions/${sessionId}`);
    } catch (error) {
      console.error('Failed to terminate session:', error);
      throw error;
    }
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllUserSessions(userId: string): Promise<{ terminated_sessions: number }> {
    try {
      return await employeeService.delete(`/admin/users/${userId}/sessions`);
    } catch (error) {
      console.error('Failed to terminate all user sessions:', error);
      throw error;
    }
  }
}

// Create singleton instance
const adminService = new AdminService();

export default adminService;