import type { 
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentResponse,
  DepartmentListResponse,
  AssignManagerRequest,
  DepartmentStatsListResponse,
  DepartmentForDropdownResponse,
  DepartmentEmployeesResponse
} from '../types/department';


class DepartmentService {
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

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT", 
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  // Admin Department Management
  async createDepartment(data: CreateDepartmentRequest): Promise<DepartmentResponse> {
    return this.post<DepartmentResponse>("/admin/departments", data);
  }

  async listDepartments(includeInactive: boolean = false): Promise<DepartmentListResponse> {
    const params = includeInactive ? "?include_inactive=true" : "";
    return this.get<DepartmentListResponse>(`/admin/departments${params}`);
  }

  async getDepartmentsWithStats(): Promise<DepartmentStatsListResponse> {
    return this.get<DepartmentStatsListResponse>("/admin/departments/stats");
  }

  async getDepartment(departmentId: string): Promise<DepartmentResponse> {
    // Try public endpoint first (available to all authenticated users)
    return this.get<DepartmentResponse>(`/departments/${departmentId}`);
  }

  async updateDepartment(
    departmentId: string, 
    data: UpdateDepartmentRequest
  ): Promise<DepartmentResponse> {
    return this.put<DepartmentResponse>(`/admin/departments/${departmentId}`, data);
  }

  async deleteDepartment(departmentId: string): Promise<{ success: boolean; message: string }> {
    return this.delete<{ success: boolean; message: string }>(`/admin/departments/${departmentId}`);
  }

  async assignManager(
    departmentId: string, 
    data: AssignManagerRequest
  ): Promise<DepartmentResponse> {
    return this.post<DepartmentResponse>(`/admin/departments/${departmentId}/assign-manager`, data);
  }

  async removeManager(departmentId: string): Promise<DepartmentResponse> {
    return this.delete<DepartmentResponse>(`/admin/departments/${departmentId}/remove-manager`);
  }

  // Public Department Endpoints (for forms, dropdowns, etc.)
  async getDepartmentsForDropdown(): Promise<DepartmentForDropdownResponse[]> {
    return this.get<DepartmentForDropdownResponse[]>("/departments");
  }

  async getDepartmentPublic(departmentId: string): Promise<DepartmentResponse> {
    return this.get<DepartmentResponse>(`/departments/${departmentId}`);
  }

  // Manager Department Endpoints
  async getManagedDepartments(): Promise<DepartmentListResponse> {
    return this.get<DepartmentListResponse>("/manager/departments/my-departments");
  }

  async getDepartmentEmployees(departmentId: string): Promise<DepartmentEmployeesResponse> {
    console.log('🔍 Fetching employees for department:', departmentId);
    try {
      const response = await this.get<DepartmentEmployeesResponse>(`/manager/departments/${departmentId}/employees`);
      console.log('✅ Department employees response:', response);
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch department employees:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const departmentService = new DepartmentService();

export default DepartmentService;