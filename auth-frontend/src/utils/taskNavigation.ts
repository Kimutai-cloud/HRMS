import { ROUTE_PATHS } from '@/config/routes';

/**
 * Task Navigation Utilities
 * Provides deep linking and navigation functions for task management
 */

export interface TaskNavigationParams {
  taskId?: string;
  departmentId?: string;
  assigneeId?: string;
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
}

/**
 * Generate task detail URL with task ID
 */
export function getTaskDetailUrl(taskId: string): string {
  return ROUTE_PATHS.TASK_DETAILS.replace(':id', taskId);
}

/**
 * Generate manager task dashboard URL with optional filters
 */
export function getManagerTasksUrl(params?: TaskNavigationParams): string {
  const url = new URL(ROUTE_PATHS.MANAGER_TASKS, window.location.origin);
  
  if (params) {
    if (params.departmentId) url.searchParams.set('department', params.departmentId);
    if (params.assigneeId) url.searchParams.set('assignee', params.assigneeId);
    if (params.status) url.searchParams.set('status', params.status);
    if (params.priority) url.searchParams.set('priority', params.priority);
    if (params.search) url.searchParams.set('search', params.search);
    if (params.page) url.searchParams.set('page', params.page.toString());
  }
  
  return url.pathname + url.search;
}

/**
 * Generate employee task dashboard URL with optional filters
 */
export function getEmployeeTasksUrl(params?: TaskNavigationParams): string {
  const url = new URL(ROUTE_PATHS.EMPLOYEE_TASKS, window.location.origin);
  
  if (params) {
    if (params.status) url.searchParams.set('status', params.status);
    if (params.priority) url.searchParams.set('priority', params.priority);
    if (params.search) url.searchParams.set('search', params.search);
    if (params.page) url.searchParams.set('page', params.page.toString());
  }
  
  return url.pathname + url.search;
}

/**
 * Generate task creation URL with pre-filled data
 */
export function getTaskCreateUrl(params?: {
  departmentId?: string;
  assigneeId?: string;
  parentTaskId?: string;
}): string {
  const url = new URL(ROUTE_PATHS.MANAGER_TASK_CREATE, window.location.origin);
  
  if (params) {
    if (params.departmentId) url.searchParams.set('department', params.departmentId);
    if (params.assigneeId) url.searchParams.set('assignee', params.assigneeId);
    if (params.parentTaskId) url.searchParams.set('parent', params.parentTaskId);
  }
  
  return url.pathname + url.search;
}

/**
 * Parse URL parameters for task filtering
 */
export function parseTaskFilters(searchParams: URLSearchParams): TaskNavigationParams {
  return {
    departmentId: searchParams.get('department') || undefined,
    assigneeId: searchParams.get('assignee') || undefined,
    status: searchParams.get('status') || undefined,
    priority: searchParams.get('priority') || undefined,
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
  };
}

/**
 * Generate shareable task link for notifications/emails
 */
export function getShareableTaskUrl(taskId: string, baseUrl?: string): string {
  const base = baseUrl || window.location.origin;
  return `${base}${getTaskDetailUrl(taskId)}`;
}

/**
 * Navigate to task with specific context (for use in components)
 */
export function navigateToTask(taskId: string, navigate: (path: string) => void): void {
  navigate(getTaskDetailUrl(taskId));
}

/**
 * Navigate to task dashboard based on user role
 */
export function navigateToTaskDashboard(
  userRole: 'admin' | 'manager' | 'employee', 
  navigate: (path: string) => void,
  filters?: TaskNavigationParams
): void {
  if (userRole === 'admin' || userRole === 'manager') {
    navigate(getManagerTasksUrl(filters));
  } else {
    navigate(getEmployeeTasksUrl(filters));
  }
}

/**
 * Generate breadcrumb data for task navigation
 */
export interface TaskBreadcrumb {
  label: string;
  path: string;
  isActive?: boolean;
}

export function getTaskBreadcrumbs(
  currentPath: string,
  taskData?: { id: string; title: string }
): TaskBreadcrumb[] {
  const breadcrumbs: TaskBreadcrumb[] = [
    { label: 'Dashboard', path: ROUTE_PATHS.DASHBOARD },
  ];

  if (currentPath.startsWith(ROUTE_PATHS.MANAGER_TASKS)) {
    breadcrumbs.push({ label: 'Task Management', path: ROUTE_PATHS.MANAGER_TASKS });
    
    if (currentPath === ROUTE_PATHS.MANAGER_TASK_CREATE) {
      breadcrumbs.push({ label: 'Create Task', path: ROUTE_PATHS.MANAGER_TASK_CREATE, isActive: true });
    } else if (currentPath.includes('/tasks/') && taskData) {
      breadcrumbs.push({ 
        label: taskData.title, 
        path: getTaskDetailUrl(taskData.id), 
        isActive: true 
      });
    }
  } else if (currentPath.startsWith(ROUTE_PATHS.EMPLOYEE_TASKS)) {
    breadcrumbs.push({ label: 'My Tasks', path: ROUTE_PATHS.EMPLOYEE_TASKS });
    
    if (currentPath.includes('/tasks/') && taskData) {
      breadcrumbs.push({ 
        label: taskData.title, 
        path: getTaskDetailUrl(taskData.id), 
        isActive: true 
      });
    }
  } else if (currentPath.startsWith(ROUTE_PATHS.TASKS)) {
    breadcrumbs.push({ label: 'Tasks', path: ROUTE_PATHS.TASKS });
    
    if (currentPath.includes('/tasks/') && taskData) {
      breadcrumbs.push({ 
        label: taskData.title, 
        path: getTaskDetailUrl(taskData.id), 
        isActive: true 
      });
    }
  }

  return breadcrumbs;
}

/**
 * Task status display utilities
 */
export const TASK_STATUS_LABELS = {
  DRAFT: 'Draft',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'Under Review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;

export const TASK_PRIORITY_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
} as const;

/**
 * Generate task URL for notifications
 */
export function generateTaskNotificationUrl(taskId: string, action?: string): string {
  const baseUrl = getTaskDetailUrl(taskId);
  if (action) {
    return `${baseUrl}?action=${action}`;
  }
  return baseUrl;
}

/**
 * Check if current path is a task management route
 */
export function isTaskManagementRoute(pathname: string): boolean {
  return pathname.startsWith(ROUTE_PATHS.TASKS) || 
         pathname.startsWith(ROUTE_PATHS.MANAGER_TASKS) || 
         pathname.startsWith(ROUTE_PATHS.EMPLOYEE_TASKS);
}

/**
 * Get appropriate task dashboard URL based on user permissions
 */
export function getContextualTaskDashboardUrl(accessLevel: string): string {
  if (accessLevel === 'ADMIN' || accessLevel === 'MANAGER') {
    return ROUTE_PATHS.MANAGER_TASKS;
  }
  return ROUTE_PATHS.EMPLOYEE_TASKS;
}