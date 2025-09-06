import { 
  type UserProfile,
  type EmployeeProfileResponse,
  type ProfileSubmissionData,
  type AccessSummary,
  type EmployeeData,
  type DocumentStatus,
  VerificationStatus,
  AccessLevel 
} from '../types/auth';

class EmployeeService {
  private baseURL = "http://localhost:8001/api/v1"; // Employee Service URL
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorDetail = "Network error occurred";
      try {
        const errorResponse = await response.json();
        errorDetail = errorResponse.detail || errorResponse.message || JSON.stringify(errorResponse);
      } catch (e) {
        console.error("Could not parse error response:", e);
      }
      
      throw new Error(errorDetail);
    }

    const responseData = await response.json();
    return responseData;
  }

  // Helper methods for common HTTP operations
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH", 
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async download(endpoint: string, fileName: string): Promise<void> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {};

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }

  async getEmployeeProfile(userId: string): Promise<UserProfile> {
    // Use the existing /me/ endpoint which properly handles new users
    const response = await this.request<{
      user_id: string;
      email: string;
      employee: EmployeeData | null;
      roles: any[];
    }>(`/me/`);
    
    // Transform response to UserProfile format
    const userProfile: UserProfile = {
      id: response.user_id,
      email: response.email,
      firstName: response.employee?.first_name || "",
      lastName: response.employee?.last_name || "",
      isEmailVerified: true, // This comes from auth service
      employee: response.employee,
      roles: response.roles || [],
      access_level: this.determineAccessLevel(response),
      verification_status: response.employee?.verification_status || VerificationStatus.NOT_STARTED,
      permissions: this.extractPermissions(response.roles || []),
      employee_profile_status: this.getProfileStatus(response.employee)
    };

    return userProfile;
  }

  async getAccessSummary(userId: string): Promise<AccessSummary> {
    // Use the /me/ endpoint to get current user access summary
    const response = await this.request<{
      user_id: string;
      email: string;
      employee: EmployeeData | null;
      roles: any[];
    }>(`/me/`);

    // Transform to AccessSummary format
    return {
      user_id: response.user_id,
      email: response.email,
      access_level: this.determineAccessLevel(response),
      verification_status: response.employee?.verification_status || VerificationStatus.NOT_STARTED,
      roles: response.roles?.map(r => r.role_code || r.code) || [],
      permissions: this.extractPermissions(response.roles || []),
      can_access_system: response.employee?.verification_status === VerificationStatus.VERIFIED,
      needs_profile_completion: !response.employee || response.employee.verification_status === VerificationStatus.NOT_STARTED,
      is_newcomer: !response.employee || response.employee.verification_status !== VerificationStatus.VERIFIED,
      is_admin: response.roles?.some(r => (r.role_code || r.code) === "ADMIN") || false
    };
  }

  async submitProfile(userId: string, profileData: ProfileSubmissionData): Promise<EmployeeData> {
    const response = await this.request<EmployeeData>(`/profile/submit`, {
      method: "POST",
      body: JSON.stringify(profileData),
    });

    return response;
  }


  async updateEmployeeProfile(userId: string, data: Partial<EmployeeData>): Promise<EmployeeData> {
    // For updating employee profile, use the profile resubmit endpoint
    const response = await this.request<EmployeeData>(`/profile/resubmit`, {
      method: "POST",
      body: JSON.stringify(data),
    });

    return response;
  }

  // New method for updating details of verified employees
  async updateEmployeeDetails(updateData: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    title?: string;
  }): Promise<EmployeeData> {
    const response = await this.request<EmployeeData>(`/profile/update-details`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
    });

    return response;
  }

  async uploadDocument(userId: string, documentType: string, file: File): Promise<DocumentStatus> {
    // Map frontend document types to backend enum values
    const documentTypeMapping: Record<string, string> = {
      'government_id': 'ID_CARD',
      'address_proof': 'OTHER',
      'educational_certificates': 'EDUCATION_CERTIFICATE',
      'previous_employment': 'PREVIOUS_EMPLOYMENT_LETTER',
      'medical_certificate': 'OTHER',
      'tax_documents': 'OTHER',
      'bank_statement': 'OTHER',
      'other': 'OTHER',
      'passport': 'PASSPORT',
      'drivers_license': 'DRIVERS_LICENSE',
      'birth_certificate': 'BIRTH_CERTIFICATE',
      'employment_contract': 'EMPLOYMENT_CONTRACT',
      'professional_certification': 'PROFESSIONAL_CERTIFICATION'
    };

    const backendDocumentType = documentTypeMapping[documentType] || 'OTHER';
    
    console.log('Frontend document type:', documentType);
    console.log('Mapped backend document type:', backendDocumentType);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', backendDocumentType);
    formData.append('is_required', 'true');

    const response = await fetch(`${this.baseURL}/profile/upload-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorDetail = "Document upload failed";
      try {
        const errorResponse = await response.json();
        errorDetail = errorResponse.detail || errorResponse.message || JSON.stringify(errorResponse);
      } catch (e) {
        console.error("Could not parse error response:", e);
      }
      throw new Error(errorDetail);
    }

    return response.json();
  }

  async getEmployeeDocuments(userId: string): Promise<DocumentStatus[]> {
    const response = await this.request<DocumentStatus[]>(`/profile/documents`);
    return response;
  }

  async approveEmployee(employeeId: string, notes?: string): Promise<void> {
    await this.request(`/admin/reviews/${employeeId}/final-approve`, {
      method: "POST",
      body: JSON.stringify({ notes: notes || "Approved via dashboard" }),
    });
  }

  async rejectEmployee(employeeId: string, reason: string, stage: string = "FINAL_APPROVAL"): Promise<void> {
    await this.request(`/admin/reviews/${employeeId}/reject`, {
      method: "POST",
      body: JSON.stringify({ 
        reason: reason,
        stage: stage
      }),
    });
  }

  async getAllEmployees(): Promise<EmployeeData[]> {
    const response = await this.request<any>("/employees/");
    // The backend returns { employees: [...], total_count: number, page: number, size: number }
    return response.employees || response;
  }

  async getTeamMembers(managerId?: string): Promise<EmployeeData[]> {
    // Use the actual backend endpoint for getting team members
    const response = await this.request<EmployeeData[]>(`/employees/me/team`);
    return response;
  }

  // Dashboard data methods - use admin dashboard and employees endpoints
  async getTotalEmployeesCount(): Promise<number> {
    const response = await this.request<any>("/admin/dashboard");
    return response.quick_stats?.total_verified || 0;
  }

  async getActiveEmployeesCount(): Promise<number> {
    const response = await this.request<any>("/admin/dashboard");
    return response.quick_stats?.total_verified || 0;
  }

  async getPendingApprovalsCount(): Promise<number> {
    const response = await this.request<any>("/admin/dashboard");
    return response.pending_reviews?.total || 0;
  }

  async getNewHiresCount(): Promise<number> {
    const response = await this.request<any>("/admin/dashboard");
    return response.pending_reviews?.final || 0;
  }

  async getTeamMembersCount(managerId?: string): Promise<number> {
    // Use the actual backend endpoint for getting team members
    try {
      const response = await this.request<any>(`/employees/me/team`);
      return Array.isArray(response) ? response.length : 0;
    } catch {
      return 0;
    }
  }

  async getManagerPendingApprovals(managerId: string): Promise<number> {
    // Use admin dashboard for now as fallback
    try {
      const response = await this.request<any>("/admin/dashboard");
      return response.pending_reviews?.total || 0;
    } catch {
      return 0;
    }
  }

  async getTasksCompletedCount(userId: string): Promise<number> {
    // Return dummy data for now since this endpoint doesn't exist
    return 0;
  }

  async getProfileCompletionPercentage(userId: string): Promise<number> {
    // Use me endpoint to get profile completion
    try {
      const response = await this.request<any>("/me/");
      if (response.employee) {
        return response.employee.profile_completion_percentage || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  async getDocumentsUploadedCount(userId: string): Promise<number> {
    // Return dummy data for now since this endpoint doesn't exist
    return 0;
  }

  private determineAccessLevel(profile: { employee: EmployeeData | null; roles: any[] }): AccessLevel {
    // Check if user has admin role first (overrides everything)
    const hasAdminRole = profile.roles.some(role => 
      role.code === "ADMIN" || role.role_code === "ADMIN"
    );
    if (hasAdminRole) {
      return AccessLevel.ADMIN;
    }

    if (!profile.employee) {
      return AccessLevel.NEWCOMER; 
    }

    if (profile.employee.verification_status === VerificationStatus.NOT_STARTED || 
        profile.employee.verification_status === VerificationStatus.PENDING_DETAILS_REVIEW ||
        profile.employee.verification_status === VerificationStatus.PENDING_DOCUMENTS_REVIEW || 
        profile.employee.verification_status === VerificationStatus.PENDING_ROLE_ASSIGNMENT ||
        profile.employee.verification_status === VerificationStatus.PENDING_FINAL_APPROVAL) {
      return AccessLevel.NEWCOMER;
    }

    if (profile.employee.verification_status === VerificationStatus.VERIFIED) {
      return AccessLevel.VERIFIED;
    }

    return AccessLevel.NEWCOMER;
  }

  async getAdminDashboard(): Promise<any> {
    const response = await this.request<any>(`/admin/dashboard`);
    return response;
  }

  private extractPermissions(roles: any[]): string[] {
    // Extract permissions from roles
    const permissions: string[] = [];
    roles.forEach(role => {
      // Add role-based permissions
      switch (role.role_code) {
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
    return [...new Set(permissions)]; // Remove duplicates
  }

  private getProfileStatus(employee: EmployeeData | null): string {
    if (!employee) {
      return "NOT_CREATED";
    }

    if (employee.profile_completion_percentage < 100) {
      return "INCOMPLETE";
    }

    switch (employee.verification_status) {
      case VerificationStatus.NOT_STARTED:
        return "READY_FOR_VERIFICATION";
      case VerificationStatus.PENDING_DETAILS_REVIEW:
        return "PENDING_DETAILS_REVIEW";
      case VerificationStatus.PENDING_DOCUMENTS_REVIEW:
        return "PENDING_DOCUMENTS_REVIEW";
      case VerificationStatus.PENDING_ROLE_ASSIGNMENT:
        return "PENDING_ROLE_ASSIGNMENT";
      case VerificationStatus.PENDING_FINAL_APPROVAL:
        return "PENDING_FINAL_APPROVAL";
      case VerificationStatus.VERIFIED:
        return "VERIFIED";
      case VerificationStatus.REJECTED:
        return "REJECTED";
      default:
        return "UNKNOWN";
    }
  }
}

// Create and export a singleton instance
export const employeeService = new EmployeeService();

export default EmployeeService;