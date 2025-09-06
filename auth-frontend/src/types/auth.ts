// Base User Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface SendRegisterData {
  email: string;
  password: string;
  full_name: string;
}

// HRMS Enhanced Types - Synced with Auth-Service EmployeeProfileStatus
export enum VerificationStatus {
  NOT_STARTED = "NOT_STARTED",
  NOT_SUBMITTED = "NOT_SUBMITTED",
  PENDING_DETAILS_REVIEW = "PENDING_DETAILS_REVIEW",
  PENDING_DOCUMENTS_REVIEW = "PENDING_DOCUMENTS_REVIEW",
  PENDING_ROLE_ASSIGNMENT = "PENDING_ROLE_ASSIGNMENT", 
  PENDING_FINAL_APPROVAL = "PENDING_FINAL_APPROVAL",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED"
}

// Match backend VerificationStatus + role-based access
export enum AccessLevel {
  // No employee profile yet - needs to submit profile
  PROFILE_COMPLETION = "PROFILE_COMPLETION",
  
  // Profile submitted but not yet verified (any pending status)
  NEWCOMER = "NEWCOMER", 
  
  // Profile verified but regular employee access
  VERIFIED = "VERIFIED",
  
  // Profile verified with manager role
  MANAGER = "MANAGER",
  
  // Profile verified with admin role  
  ADMIN = "ADMIN"
}

export enum RoleCode {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  EMPLOYEE = "EMPLOYEE",
  NEWCOMER = "NEWCOMER"
}

export interface EmployeeData {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  department: string;
  position: string;
  manager_id?: string;
  verification_status: VerificationStatus;
  profile_completion_percentage: number;
  documents: DocumentStatus[];
  hire_date: string;
  start_date?: string;
  phone_number?: string;
  address?: string;
  city?: string;
  state?: string;
  employment_type?: string;
  work_location?: string;
  profile_image_url?: string;
}

export interface DocumentStatus {
  file_url: any;
  id: string;
  document_type: string;
  file_name: string;
  upload_date: string;
  status: "pending" | "approved" | "rejected";
  comments?: string;
}

export interface RoleAssignment {
  id: string;
  role_id: string;
  role_code: RoleCode;
  role_name: string;
  scope: Record<string, any>;
  created_at: string;
  assigned_by?: string;
  is_active: boolean;
}

export interface UserProfile extends User {
  employee: EmployeeData | null;
  roles: RoleAssignment[];
  access_level: AccessLevel;
  verification_status: VerificationStatus;
  permissions: string[];
  employee_profile_status: string;
}

export interface MeResponse {
  user_id: string;
  email: string;
  employee?: EmployeeData;
  roles?: RoleWithPermissions[];
}

export interface RoleWithPermissions {
  role_code: RoleCode;
  is_active: boolean;
  permissions?: string[];
  id:string, role_id:string, role_name:string, scope:string, created_at:string;
}


export interface AccessSummary {
  user_id: string;
  email: string;
  access_level: AccessLevel;
  verification_status: VerificationStatus;
  roles: string[];
  permissions: string[];
  can_access_system: boolean;
  needs_profile_completion: boolean;
  is_newcomer: boolean;
  is_admin: boolean;
}

// Enhanced Auth Context
export interface AuthContextType {
  // Base auth functionality
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<{ message: string; email: string }>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;

  // HRMS enhanced functionality
  userProfile: UserProfile | null;
  accessLevel: AccessLevel;
  permissions: string[];
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isNewcomer: boolean;

  // Methods
  refreshProfile: () => Promise<void>;
  checkPermission: (permission: string) => boolean;
  updateProfile: (data: Partial<EmployeeData>) => Promise<void>;
}

// Backend response interfaces
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string | null;
  is_verified: boolean;
  auth_provider: string;
  created_at: string;
}

// Employee Service Response Types
export interface EmployeeProfileResponse {
  user_id: string;
  email: string;
  employee: EmployeeData | null;
  roles: RoleAssignment[];
}

export interface ProfileSubmissionData {
  first_name: string;
  last_name: string;
  phone_number: string;
  address: string;
  department: string;
  position: string;
  hire_date: string;
  emergency_contact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  created_at: string;
  action_url?: string;
}

// Dashboard Data Types
export interface DashboardMetrics {
  totalEmployees?: number;
  pendingRequests?: number;
  completedTasks?: number;
  performanceScore?: number;
  teamMembers?: number;
  pendingApprovals?: number;
  systemHealth?: number;
  securityAlerts?: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: "online" | "busy" | "away" | "offline";
  performance: number;
  avatar?: string;
}

export interface ManagerOption {
  id: string;
  full_name: string;
  title?: string;
  department: string;
  email: string;
}

export interface PendingApproval {
  id: string;
  type: string;
  employee: string;
  details: string;
  priority: "high" | "medium" | "low";
  submitted: string;
  status: "pending" | "approved" | "rejected";
}
