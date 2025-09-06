/**
 * React Query hooks for Task Management
 * Following established patterns and best practices from existing query hooks
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { taskService } from '@/services/serviceFactory';
import type {
  // Request Types
  CreateTaskRequest,
  UpdateTaskRequest,
  AssignTaskRequest,
  UpdateTaskProgressRequest,
  SubmitTaskRequest,
  ReviewTaskRequest,
  BulkTaskActionRequest,
  TaskSearchFilters,
  AddCommentRequest,
  UpdateCommentRequest,
  
  // Response Types
  TaskResponse,
  TaskSummaryResponse,
  ManagerTaskDashboardResponse,
  EmployeeTaskDashboardResponse,
  TaskSearchResponse,
  TaskActivityResponse,
  TaskComment,
  SuccessResponse
} from '@/types/task';

// Query keys - Factory Pattern (React Query Best Practice)
const TASKS_BASE = ['tasks'] as const;

export const taskKeys = {
  all: TASKS_BASE,
  
  // Manager keys
  managerDashboard: (userId: string) => [...TASKS_BASE, 'manager', 'dashboard', userId] as const,
  managerTasks: (filters?: TaskSearchFilters) => [...TASKS_BASE, 'manager', 'search', filters] as const,
  
  // Employee keys
  employeeDashboard: (userId: string) => [...TASKS_BASE, 'employee', 'dashboard', userId] as const,
  assignedTasks: (userId: string, filters?: Partial<TaskSearchFilters>) => [...TASKS_BASE, 'employee', 'assigned', userId, filters] as const,
  
  // Individual task keys
  task: (taskId: string) => [...TASKS_BASE, 'detail', taskId] as const,
  taskActivities: (taskId: string) => [...TASKS_BASE, 'activities', taskId] as const,
  taskComments: (taskId: string) => [...TASKS_BASE, 'comments', taskId] as const,
  
  // Search and pagination
  search: (filters: TaskSearchFilters) => [...TASKS_BASE, 'search', filters] as const,
} as const;

// ===============================
// Manager Query Hooks
// ===============================

/**
 * Get manager dashboard data with comprehensive statistics
 */
export const useManagerDashboard = () => {
  const { user, accessToken, isManager, isAdmin } = useAuth();
  const canAccess = isManager || isAdmin;

  return useQuery({
    queryKey: taskKeys.managerDashboard(user?.id || ''),
    queryFn: async (): Promise<ManagerTaskDashboardResponse> => {
      if (!user?.id) throw new Error('No user logged in');
      console.log('useManagerDashboard - User ID:', user.id, 'Access Token exists:', !!accessToken);
      taskService.setAccessToken(accessToken);
      return taskService.getManagerDashboard();
    },
    enabled: !!user?.id && !!accessToken && canAccess,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};

/**
 * Search and filter tasks with pagination
 */
export const useTaskSearch = (filters: TaskSearchFilters) => {
  const { user, accessToken, isManager, isAdmin } = useAuth();
  const canAccess = isManager || isAdmin;

  return useQuery({
    queryKey: taskKeys.search(filters),
    queryFn: async (): Promise<TaskSearchResponse> => {
      taskService.setAccessToken(accessToken);
      return taskService.searchTasks(filters);
    },
    enabled: !!accessToken && canAccess,
    keepPreviousData: true, // Keep previous data while fetching new page
  });
};

/**
 * Infinite query for task search with pagination
 */
export const useInfiniteTaskSearch = (baseFilters: Omit<TaskSearchFilters, 'page'>) => {
  const { user, accessToken, isManager, isAdmin } = useAuth();
  const canAccess = isManager || isAdmin;

  return useInfiniteQuery({
    queryKey: [...taskKeys.search(baseFilters as TaskSearchFilters), 'infinite'],
    queryFn: async ({ pageParam = 1 }): Promise<TaskSearchResponse> => {
      taskService.setAccessToken(accessToken);
      return taskService.searchTasks({
        ...baseFilters,
        page: pageParam,
      });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.has_next ? lastPage.page + 1 : undefined;
    },
    enabled: !!accessToken && canAccess,
  });
};

// ===============================
// Employee Query Hooks
// ===============================

/**
 * Get employee dashboard data with personal statistics
 */
export const useEmployeeDashboard = () => {
  const { user, accessToken, isEmployee } = useAuth();

  return useQuery({
    queryKey: taskKeys.employeeDashboard(user?.id || ''),
    queryFn: async (): Promise<EmployeeTaskDashboardResponse> => {
      if (!user?.id) throw new Error('No user logged in');
      taskService.setAccessToken(accessToken);
      return taskService.getEmployeeDashboard();
    },
    enabled: !!user?.id && !!accessToken && isEmployee,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000,
  });
};

/**
 * Get tasks assigned to current employee
 */
export const useAssignedTasks = (filters?: Partial<TaskSearchFilters>) => {
  const { user, accessToken, isEmployee } = useAuth();

  return useQuery({
    queryKey: taskKeys.assignedTasks(user?.id || '', filters),
    queryFn: async (): Promise<TaskSummaryResponse[]> => {
      if (!user?.id) throw new Error('No user logged in');
      taskService.setAccessToken(accessToken);
      return taskService.getAssignedTasks(filters);
    },
    enabled: !!user?.id && !!accessToken && isEmployee,
    refetchInterval: 60000, // Auto-refresh every minute
  });
};

// ===============================
// Shared Query Hooks
// ===============================

/**
 * Get individual task details
 */
export const useTask = (taskId: string) => {
  const { accessToken, userProfile } = useAuth();

  return useQuery({
    queryKey: taskKeys.task(taskId),
    queryFn: async (): Promise<TaskResponse> => {
      taskService.setAccessToken(accessToken);
      // Determine user role for correct endpoint
      const isManagerOrAdmin = userProfile?.roles?.some(role => 
        role.role_code === 'MANAGER' || role.role_code === 'ADMIN'
      );
      const userRole = isManagerOrAdmin ? 'MANAGER' : 'EMPLOYEE';
      return taskService.getTaskById(taskId, userRole);
    },
    enabled: !!taskId && !!accessToken,
  });
};

/**
 * Get task activity history
 */
export const useTaskActivities = (taskId: string) => {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: taskKeys.taskActivities(taskId),
    queryFn: async (): Promise<TaskActivityResponse[]> => {
      taskService.setAccessToken(accessToken);
      return taskService.getTaskActivities(taskId);
    },
    enabled: !!taskId && !!accessToken,
    refetchInterval: 30000, // Activities update frequently
  });
};

/**
 * Get task comments with real-time updates
 */
export const useTaskComments = (taskId: string) => {
  const { accessToken } = useAuth();

  return useQuery({
    queryKey: taskKeys.taskComments(taskId),
    queryFn: async (): Promise<TaskComment[]> => {
      taskService.setAccessToken(accessToken);
      return taskService.getTaskComments(taskId);
    },
    enabled: !!taskId && !!accessToken,
    refetchInterval: 10000, // Comments need frequent updates
  });
};

// ===============================
// Manager Mutation Hooks
// ===============================

/**
 * Create a new task
 */
export const useCreateTask = () => {
  const { accessToken, isManager, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateTaskRequest): Promise<TaskResponse> => {
      if (!isManager && !isAdmin) throw new Error('Manager access required');
      taskService.setAccessToken(accessToken);
      return taskService.createTask(request);
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: taskKeys.managerDashboard(data.assigner_id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      
      // If assigned, invalidate assignee's queries
      if (variables.assignee_id) {
        queryClient.invalidateQueries({ 
          queryKey: [...TASKS_BASE, 'employee'] 
        });
      }
    },
    onError: (error) => {
      console.error('Failed to create task:', error);
    },
  });
};

/**
 * Assign task to employee
 */
export const useAssignTask = () => {
  const { accessToken, isManager, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, request }: { taskId: string; request: AssignTaskRequest }): Promise<SuccessResponse> => {
      if (!isManager && !isAdmin) throw new Error('Manager access required');
      taskService.setAccessToken(accessToken);
      return taskService.assignTask(taskId, request);
    },
    onSuccess: (data, variables) => {
      // Invalidate task details and dashboard
      queryClient.invalidateQueries({ queryKey: taskKeys.task(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      
      // Invalidate employee dashboard for assignee
      queryClient.invalidateQueries({ 
        queryKey: [...TASKS_BASE, 'employee'] 
      });
    },
  });
};

/**
 * Review task (approve or reject)
 */
export const useReviewTask = () => {
  const { accessToken, isManager, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, request }: { taskId: string; request: ReviewTaskRequest }): Promise<SuccessResponse> => {
      if (!isManager && !isAdmin) throw new Error('Manager access required');
      taskService.setAccessToken(accessToken);
      return taskService.reviewTask(taskId, request);
    },
    onSuccess: (data, variables) => {
      // Invalidate task details and dashboards
      queryClient.invalidateQueries({ queryKey: taskKeys.task(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
};

/**
 * Update task details
 */
export const useUpdateTask = () => {
  const { accessToken, isManager, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, request }: { taskId: string; request: UpdateTaskRequest }): Promise<TaskResponse> => {
      if (!isManager && !isAdmin) throw new Error('Manager access required');
      taskService.setAccessToken(accessToken);
      return taskService.updateTask(taskId, request);
    },
    onSuccess: (data, variables) => {
      // Update task cache directly
      queryClient.setQueryData(taskKeys.task(variables.taskId), data);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
};

/**
 * Cancel task
 */
export const useCancelTask = () => {
  const { accessToken, isManager, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason?: string }): Promise<SuccessResponse> => {
      if (!isManager && !isAdmin) throw new Error('Manager access required');
      taskService.setAccessToken(accessToken);
      return taskService.cancelTask(taskId, reason);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.task(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
};

/**
 * Bulk task operations
 */
export const useBulkTaskAction = () => {
  const { accessToken, isManager, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkTaskActionRequest): Promise<SuccessResponse> => {
      if (!isManager && !isAdmin) throw new Error('Manager access required');
      taskService.setAccessToken(accessToken);
      return taskService.bulkTaskAction(request);
    },
    onSuccess: (data, variables) => {
      // Invalidate all task-related queries
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
};

// ===============================
// Employee Mutation Hooks
// ===============================

/**
 * Start working on assigned task
 */
export const useStartTask = () => {
  const { user, accessToken, isEmployee } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes?: string }): Promise<SuccessResponse> => {
      if (!isEmployee) throw new Error('Employee access required');
      taskService.setAccessToken(accessToken);
      return taskService.startTask(taskId, notes);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.task(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.employeeDashboard(user?.id || '') });
    },
  });
};

/**
 * Update task progress
 */
export const useUpdateTaskProgress = () => {
  const { user, accessToken, isEmployee } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, request }: { taskId: string; request: UpdateTaskProgressRequest }): Promise<SuccessResponse> => {
      if (!isEmployee) throw new Error('Employee access required');
      taskService.setAccessToken(accessToken);
      return taskService.updateTaskProgress(taskId, request);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.task(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.employeeDashboard(user?.id || '') });
      queryClient.invalidateQueries({ queryKey: taskKeys.taskActivities(variables.taskId) });
    },
  });
};

/**
 * Submit completed task for review
 */
export const useSubmitTask = () => {
  const { user, accessToken, isEmployee } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, request }: { taskId: string; request: SubmitTaskRequest }): Promise<SuccessResponse> => {
      if (!isEmployee) throw new Error('Employee access required');
      taskService.setAccessToken(accessToken);
      return taskService.submitTask(taskId, request);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.task(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.employeeDashboard(user?.id || '') });
    },
  });
};

// ===============================
// Comment Mutation Hooks
// ===============================

/**
 * Add task comment
 */
export const useAddTaskComment = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, request }: { taskId: string; request: AddCommentRequest }): Promise<TaskComment> => {
      taskService.setAccessToken(accessToken);
      return taskService.addTaskComment(taskId, request);
    },
    onSuccess: (data, variables) => {
      // Add comment to cache optimistically
      queryClient.setQueryData(
        taskKeys.taskComments(variables.taskId),
        (oldComments: TaskComment[] = []) => [data, ...oldComments]
      );
      
      // Invalidate activities as well
      queryClient.invalidateQueries({ queryKey: taskKeys.taskActivities(variables.taskId) });
    },
  });
};

/**
 * Update task comment
 */
export const useUpdateTaskComment = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      taskId, 
      commentId, 
      request 
    }: { 
      taskId: string; 
      commentId: string; 
      request: UpdateCommentRequest 
    }): Promise<TaskComment> => {
      taskService.setAccessToken(accessToken);
      return taskService.updateTaskComment(taskId, commentId, request);
    },
    onSuccess: (data, variables) => {
      // Update comment in cache
      queryClient.setQueryData(
        taskKeys.taskComments(variables.taskId),
        (oldComments: TaskComment[] = []) => 
          oldComments.map(comment => 
            comment.id === variables.commentId ? data : comment
          )
      );
    },
  });
};

/**
 * Delete task comment
 */
export const useDeleteTaskComment = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, commentId }: { taskId: string; commentId: string }): Promise<SuccessResponse> => {
      taskService.setAccessToken(accessToken);
      return taskService.deleteTaskComment(taskId, commentId);
    },
    onSuccess: (data, variables) => {
      // Remove comment from cache
      queryClient.setQueryData(
        taskKeys.taskComments(variables.taskId),
        (oldComments: TaskComment[] = []) => 
          oldComments.filter(comment => comment.id !== variables.commentId)
      );
    },
  });
};

// ===============================
// Utility Functions
// ===============================

/**
 * Invalidate all task-related queries (useful for WebSocket updates)
 */
export const useInvalidateTaskQueries = () => {
  const queryClient = useQueryClient();
  
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
    invalidateTask: (taskId: string) => queryClient.invalidateQueries({ queryKey: taskKeys.task(taskId) }),
    invalidateTaskComments: (taskId: string) => queryClient.invalidateQueries({ queryKey: taskKeys.taskComments(taskId) }),
    invalidateManagerDashboard: (userId: string) => queryClient.invalidateQueries({ queryKey: taskKeys.managerDashboard(userId) }),
    invalidateEmployeeDashboard: (userId: string) => queryClient.invalidateQueries({ queryKey: taskKeys.employeeDashboard(userId) }),
  };
};

/**
 * Prefetch task data (useful for hover previews, etc.)
 */
export const usePrefetchTask = () => {
  const { accessToken, userProfile } = useAuth();
  const queryClient = useQueryClient();
  
  return (taskId: string) => {
    queryClient.prefetchQuery({
      queryKey: taskKeys.task(taskId),
      queryFn: async (): Promise<TaskResponse> => {
        taskService.setAccessToken(accessToken);
        // Determine user role for correct endpoint
        const isManagerOrAdmin = userProfile?.roles?.some(role => 
          role.role_code === 'MANAGER' || role.role_code === 'ADMIN'
        );
        const userRole = isManagerOrAdmin ? 'MANAGER' : 'EMPLOYEE';
        return taskService.getTaskById(taskId, userRole);
      },
    });
  };
};