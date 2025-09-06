export interface Department {
  id: string;
  name: string;
  description?: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by: string;
  
  // Optional manager information when populated
  manager?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  
  // Optional employee count when included in stats
  employee_count?: number;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  description?: string;
}

export interface AssignManagerRequest {
  manager_id: string;
}

export interface DepartmentResponse {
  id: string;
  name: string;
  description?: string;
  manager_id?: string;
  manager_name?: string; // This is what the backend actually returns
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by: string;
}

export interface DepartmentListResponse {
  departments: DepartmentResponse[];
  total: number;
}

export interface DepartmentStatsResponse extends DepartmentResponse {
  employee_count: number;
  active_employees: number;
  pending_employees: number;
}

export interface DepartmentStatsListResponse {
  departments: DepartmentStatsResponse[];
  total: number;
}

export interface DepartmentForDropdownResponse {
  id: string;
  name: string;
  is_active: boolean;
}

export interface DepartmentEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  manager_id?: string;
  status: string;
  hired_at?: string;
  created_at: string;
  updated_at?: string;
  verification_status: string;
}

export interface DepartmentEmployeesResponse {
  employees: DepartmentEmployee[];
  total: number;
}