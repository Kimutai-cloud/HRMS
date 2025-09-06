import { AccessLevel, RoleCode } from '../types/auth';

export interface RouteConfig {
  path: string;
  component: string;
  requiredAccessLevel?: AccessLevel;
  requiredRoles?: RoleCode[];
  requiredPermissions?: string[];
  redirectTo?: string;
  public?: boolean;
  exact?: boolean;
}

export const ROUTE_PATHS = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  VERIFY_EMAIL: '/verify-email',
  
  // Dashboard routes
  DASHBOARD: '/dashboard',
  ADMIN_DASHBOARD: '/admin-dashboard',
  MANAGER_DASHBOARD: '/manager-dashboard',
  EMPLOYEE_DASHBOARD: '/employee-dashboard',
  NEWCOMER_DASHBOARD: '/newcomer-dashboard',
  
  // Profile routes
  PROFILE: '/profile',
  PROFILE_COMPLETION: '/profile-completion',
  PROFILE_EDIT: '/profile/edit',
  
  // Employee management
  EMPLOYEES: '/employees',
  EMPLOYEE_DETAILS: '/employees/:id',
  
  // Team management
  TEAM: '/team',
  TEAM_MEMBER: '/team/:id',
  
  // Document management
  DOCUMENTS: '/documents',
  DOCUMENT_UPLOAD: '/documents/upload',
  DOCUMENT_REVIEW: '/documents/review',
  
  // Admin routes
  ADMIN_PANEL: '/admin',
  DEPARTMENTS: '/admin/departments',
  USER_MANAGEMENT: '/admin/users',
  SYSTEM_SETTINGS: '/admin/settings',
  REPORTS: '/admin/reports',
  AUDIT_LOGS: '/admin/audit',
  
  // Manager routes
  MANAGER_DEPARTMENTS: '/manager/departments',
  MANAGER_DEPARTMENT_DETAIL: '/manager/departments/:id',
  MANAGER_ANALYTICS: '/manager/analytics',
  
  // Task Management routes
  TASKS: '/tasks',
  TASK_DETAILS: '/tasks/:id',
  MANAGER_TASKS: '/manager/tasks',
  MANAGER_TASK_CREATE: '/manager/tasks/create',
  EMPLOYEE_TASKS: '/employee/tasks',
  
  // Utility routes
  UNAUTHORIZED: '/unauthorized',
  NOT_FOUND: '/404',
} as const;

export const routeConfigs: RouteConfig[] = [
  // Public routes
  {
    path: ROUTE_PATHS.HOME,
    component: 'Landing',
    public: true,
  },
  {
    path: ROUTE_PATHS.LOGIN,
    component: 'LoginForm',
    public: true,
  },
  {
    path: ROUTE_PATHS.REGISTER,
    component: 'RegisterForm',
    public: true,
  },
  {
    path: ROUTE_PATHS.VERIFY_EMAIL,
    component: 'EmailVerification',
    public: true,
  },
  
  // Dashboard routes (smart routing handles which dashboard)
  {
    path: ROUTE_PATHS.DASHBOARD,
    component: 'SmartDashboard',
  },
  {
    path: ROUTE_PATHS.ADMIN_DASHBOARD,
    component: 'AdminDashboard',
    requiredAccessLevel: AccessLevel.ADMIN,
  },
  {
    path: ROUTE_PATHS.MANAGER_DASHBOARD,
    component: 'ManagerDashboard',
    requiredAccessLevel: AccessLevel.MANAGER,
  },
  {
    path: ROUTE_PATHS.EMPLOYEE_DASHBOARD,
    component: 'EmployeeDashboard',
    requiredAccessLevel: AccessLevel.VERIFIED,
  },
  {
    path: ROUTE_PATHS.NEWCOMER_DASHBOARD,
    component: 'NewcomerDashboard',
    // Remove access level restrictions - any authenticated user can access newcomer dashboard
  },
  
  // Profile routes
  {
    path: ROUTE_PATHS.PROFILE,
    component: 'Profile',
    // Any authenticated user can view their profile
  },
  {
    path: ROUTE_PATHS.PROFILE_COMPLETION,
    component: 'ProfileCompletion',
    requiredAccessLevel: AccessLevel.PROFILE_COMPLETION,
  },
  {
    path: ROUTE_PATHS.PROFILE_EDIT,
    component: 'ProfileEdit',
    // Any authenticated user can edit their profile - backend handles permissions
  },
  
  // Employee management routes
  {
    path: ROUTE_PATHS.EMPLOYEES,
    component: 'EmployeeList',
    requiredAccessLevel: AccessLevel.VERIFIED, // Only verified users can view employee list
  },
  {
    path: ROUTE_PATHS.EMPLOYEE_DETAILS,
    component: 'EmployeeDetails',
    requiredAccessLevel: AccessLevel.VERIFIED,
  },
  
  // Team management routes
  {
    path: ROUTE_PATHS.TEAM,
    component: 'TeamPage',
    requiredAccessLevel: AccessLevel.VERIFIED, // Only verified users can access team features
  },
  {
    path: ROUTE_PATHS.TEAM_MEMBER,
    component: 'TeamMemberDetails',
    requiredAccessLevel: AccessLevel.VERIFIED,
  },
  
  // Document management routes
  {
    path: ROUTE_PATHS.DOCUMENTS,
    component: 'DocumentList',
    // Any authenticated user can access documents - backend handles specific permissions
  },
  {
    path: ROUTE_PATHS.DOCUMENT_UPLOAD,
    component: 'DocumentUpload',
    // Any authenticated user can upload documents - backend validates
  },
  {
    path: ROUTE_PATHS.DOCUMENT_REVIEW,
    component: 'DocumentReview',
    requiredAccessLevel: AccessLevel.MANAGER, // Only managers and admins can review documents
  },
  
  // Admin routes
  {
    path: ROUTE_PATHS.ADMIN_PANEL,
    component: 'AdminPanel',
    requiredAccessLevel: AccessLevel.ADMIN,
  },
  {
    path: ROUTE_PATHS.DEPARTMENTS,
    component: 'DepartmentManagement',
    requiredAccessLevel: AccessLevel.ADMIN,
  },
  {
    path: ROUTE_PATHS.USER_MANAGEMENT,
    component: 'UserManagement',
    requiredAccessLevel: AccessLevel.ADMIN,
  },
  {
    path: ROUTE_PATHS.SYSTEM_SETTINGS,
    component: 'SystemSettings',
    requiredAccessLevel: AccessLevel.ADMIN,
  },
  {
    path: ROUTE_PATHS.REPORTS,
    component: 'Reports',
    requiredAccessLevel: AccessLevel.MANAGER, // Managers and admins can view reports
  },
  {
    path: ROUTE_PATHS.AUDIT_LOGS,
    component: 'AuditLogs',
    requiredAccessLevel: AccessLevel.ADMIN,
  },
  
  // Manager routes
  {
    path: ROUTE_PATHS.MANAGER_DEPARTMENTS,
    component: 'ManagerDepartments',
    requiredAccessLevel: AccessLevel.MANAGER,
  },
  {
    path: ROUTE_PATHS.MANAGER_DEPARTMENT_DETAIL,
    component: 'ManagerDepartmentDetail',
    requiredAccessLevel: AccessLevel.MANAGER,
  },
  {
    path: ROUTE_PATHS.MANAGER_ANALYTICS,
    component: 'ManagerAnalytics',
    requiredAccessLevel: AccessLevel.MANAGER,
  },
  
  // Task Management routes
  {
    path: ROUTE_PATHS.TASKS,
    component: 'TaskDashboard',
    requiredAccessLevel: AccessLevel.VERIFIED,
  },
  {
    path: ROUTE_PATHS.TASK_DETAILS,
    component: 'TaskDetails',
    requiredAccessLevel: AccessLevel.VERIFIED,
  },
  {
    path: ROUTE_PATHS.MANAGER_TASKS,
    component: 'ManagerTaskDashboard',
    requiredAccessLevel: AccessLevel.MANAGER,
  },
  {
    path: ROUTE_PATHS.MANAGER_TASK_CREATE,
    component: 'TaskCreatePage',
    requiredAccessLevel: AccessLevel.MANAGER,
  },
  {
    path: ROUTE_PATHS.EMPLOYEE_TASKS,
    component: 'EmployeeTaskDashboard',
    requiredAccessLevel: AccessLevel.VERIFIED,
  },
  
  // Utility routes
  {
    path: ROUTE_PATHS.UNAUTHORIZED,
    component: 'Unauthorized',
    public: true,
  },
  {
    path: ROUTE_PATHS.NOT_FOUND,
    component: 'NotFound',
    public: true,
  },
];

/**
 * Get route configuration by path
 */
export function getRouteConfig(path: string): RouteConfig | undefined {
  return routeConfigs.find(config => config.path === path);
}

/**
 * Check if route is public
 */
export function isPublicRoute(path: string): boolean {
  const config = getRouteConfig(path);
  return config?.public === true;
}

/**
 * Get default dashboard route based on user profile
 */
export function getDefaultDashboardRoute(accessLevel: AccessLevel): string {
  // Route based on access level (which already incorporates role information from backend)
  switch (accessLevel) {
    case AccessLevel.ADMIN:
      return ROUTE_PATHS.ADMIN_DASHBOARD;
    case AccessLevel.MANAGER:
      return ROUTE_PATHS.MANAGER_DASHBOARD;
    case AccessLevel.VERIFIED:
      return ROUTE_PATHS.EMPLOYEE_DASHBOARD;
    case AccessLevel.NEWCOMER:
      return ROUTE_PATHS.NEWCOMER_DASHBOARD;
    case AccessLevel.PROFILE_COMPLETION:
      return ROUTE_PATHS.NEWCOMER_DASHBOARD;
    default:
      return ROUTE_PATHS.NEWCOMER_DASHBOARD;
  }
}

/**
 * Navigation configuration for different user types
 */
export interface NavigationItem {
  label: string;
  path: string;
  icon?: string;
  requiredAccessLevel?: AccessLevel;
  requiredRoles?: RoleCode[];
  requiredPermissions?: string[];
  children?: NavigationItem[];
}

export const navigationConfig: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: ROUTE_PATHS.DASHBOARD,
    icon: 'dashboard',
  },
  {
    label: 'Profile',
    path: ROUTE_PATHS.PROFILE,
    icon: 'user',
    requiredPermissions: ['profile:read'],
  },
  {
    label: 'Documents',
    path: ROUTE_PATHS.DOCUMENTS,
    icon: 'folder',
    requiredPermissions: ['documents:upload'],
  },
  {
    label: 'Team',
    path: ROUTE_PATHS.TEAM,
    icon: 'users',
    requiredAccessLevel: AccessLevel.VERIFIED,
    requiredPermissions: ['team:read'],
  },
  {
    label: 'Employees',
    path: ROUTE_PATHS.EMPLOYEES,
    icon: 'users',
    requiredAccessLevel: AccessLevel.VERIFIED,
    requiredPermissions: ['employee:read'],
  },
  {
    label: 'Admin',
    path: ROUTE_PATHS.ADMIN_PANEL,
    icon: 'settings',
    requiredAccessLevel: AccessLevel.ADMIN,
    requiredRoles: [RoleCode.ADMIN],
    children: [
      {
        label: 'User Management',
        path: ROUTE_PATHS.USER_MANAGEMENT,
        requiredPermissions: ['employee:manage'],
      },
      {
        label: 'System Settings',
        path: ROUTE_PATHS.SYSTEM_SETTINGS,
        requiredPermissions: ['admin:write'],
      },
      {
        label: 'Reports',
        path: ROUTE_PATHS.REPORTS,
        requiredPermissions: ['reports:view'],
      },
      {
        label: 'Audit Logs',
        path: ROUTE_PATHS.AUDIT_LOGS,
        requiredPermissions: ['audit:logs'],
      },
    ],
  },
];