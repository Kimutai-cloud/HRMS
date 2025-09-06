/**
 * Task Management Service
 * Handles all task-related API operations for both Manager and Employee workflows
 * Based on comprehensive backend testing and integration guide
 */

import ApiService, { type ApiError } from './apiService';
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
  SuccessResponse,
  
  // Dashboard Types
  TaskStatsResponse,
  TeamTaskStatsResponse,
  EmployeeWorkloadResponse
} from '../types/task';

export class TaskService {
  private apiService: ApiService;

  constructor(apiService: ApiService) {
    this.apiService = apiService;
  }

  /**
   * Set access token for authenticated requests
   */
  setAccessToken(token: string | null): void {
    this.apiService.setAccessToken(token);
  }

  // ===============================
  // Manager Dashboard Operations
  // ===============================

  /**
   * Get comprehensive manager task dashboard
   * @returns Manager dashboard data with personal and team statistics
   */
  async getManagerDashboard(): Promise<ManagerTaskDashboardResponse> {
    try {
      const response = await this.apiService.get<ManagerTaskDashboardResponse>('/manager/tasks/dashboard');
      console.log('TaskService - Manager dashboard API response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('TaskService - Manager dashboard API error:', error);
      throw this.handleTaskError(error as ApiError, 'Failed to load manager dashboard');
    }
  }

  // ===============================
  // Manager Task Management
  // ===============================

  /**
   * Create a new task
   * @param request Task creation data
   * @returns Created task details
   */
  async createTask(request: CreateTaskRequest): Promise<TaskResponse> {
    try {
      return await this.apiService.post<TaskResponse>('/manager/tasks/create', request);
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to create task');
    }
  }

  /**
   * Assign a task to an employee
   * @param taskId Task UUID
   * @param request Assignment details (must use Employee ID, not User ID)
   * @returns Success response
   */
  async assignTask(taskId: string, request: AssignTaskRequest): Promise<SuccessResponse> {
    try {
      return await this.apiService.post<SuccessResponse>(
        `/manager/tasks/${taskId}/assign`, 
        request
      );
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to assign task');
    }
  }

  /**
   * Review a submitted task (approve or reject)
   * @param taskId Task UUID
   * @param request Review details
   * @returns Success response
   */
  async reviewTask(taskId: string, request: ReviewTaskRequest): Promise<SuccessResponse> {
    try {
      const payload = {
        approved: request.approved,
        review_notes: request.review_notes
      };
      
      return await this.apiService.post<SuccessResponse>(
        `/manager/tasks/${taskId}/review`, 
        payload
      );
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to review task');
    }
  }

  /**
   * Update task details (title, description, priority, etc.)
   * @param taskId Task UUID
   * @param request Update data
   * @returns Updated task details
   */
  async updateTask(taskId: string, request: UpdateTaskRequest): Promise<TaskResponse> {
    try {
      return await this.apiService.put<TaskResponse>(`/manager/tasks/${taskId}`, request);
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to update task');
    }
  }

  /**
   * Cancel a task
   * @param taskId Task UUID
   * @param reason Cancellation reason
   * @returns Success response
   */
  async cancelTask(taskId: string, reason?: string): Promise<SuccessResponse> {
    try {
      return await this.apiService.post<SuccessResponse>(
        `/manager/tasks/${taskId}/cancel`,
        { reason }
      );
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to cancel task');
    }
  }

  /**
   * Bulk task operations
   * @param request Bulk action details
   * @returns Success response with operation results
   */
  async bulkTaskAction(request: BulkTaskActionRequest): Promise<SuccessResponse> {
    try {
      return await this.apiService.post<SuccessResponse>('/manager/tasks/bulk-action', request);
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to perform bulk task operation');
    }
  }

  // ===============================
  // Employee Dashboard Operations
  // ===============================

  /**
   * Get comprehensive employee task dashboard
   * @returns Employee dashboard data with personal statistics
   */
  async getEmployeeDashboard(): Promise<EmployeeTaskDashboardResponse> {
    try {
      return await this.apiService.get<EmployeeTaskDashboardResponse>('/employee/tasks/dashboard');
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to load employee dashboard');
    }
  }

  // ===============================
  // Employee Task Management
  // ===============================

  /**
   * Get tasks assigned to current employee
   * @param filters Optional filtering parameters
   * @returns List of assigned tasks
   */
  async getAssignedTasks(filters?: Partial<TaskSearchFilters>): Promise<TaskSummaryResponse[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters?.status?.length) {
        filters.status.forEach(status => queryParams.append('status', status));
      }
      if (filters?.priority?.length) {
        filters.priority.forEach(priority => queryParams.append('priority', priority));
      }
      if (filters?.limit) {
        queryParams.append('limit', filters.limit.toString());
      }

      const queryString = queryParams.toString();
      const endpoint = queryString 
        ? `/employee/tasks/assigned?${queryString}`
        : '/employee/tasks/assigned';

      return await this.apiService.get<TaskSummaryResponse[]>(endpoint);
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to load assigned tasks');
    }
  }

  /**
   * Start working on an assigned task
   * @param taskId Task UUID
   * @param notes Optional start notes
   * @returns Success response
   */
  async startTask(taskId: string, notes?: string): Promise<SuccessResponse> {
    try {
      return await this.apiService.post<SuccessResponse>(
        `/employee/tasks/${taskId}/start`,
        {}
      );
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to start task');
    }
  }

  /**
   * Update task progress
   * @param taskId Task UUID
   * @param request Progress update data
   * @returns Success response
   */
  async updateTaskProgress(taskId: string, request: UpdateTaskProgressRequest): Promise<SuccessResponse> {
    try {
      return await this.apiService.post<SuccessResponse>(
        `/employee/tasks/${taskId}/update-progress`,
        request
      );
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to update task progress');
    }
  }

  /**
   * Submit completed task for review
   * @param taskId Task UUID
   * @param request Submission details
   * @returns Success response
   */
  async submitTask(taskId: string, request: SubmitTaskRequest): Promise<SuccessResponse> {
    try {
      const payload = {
        submission_notes: request.submission_notes,
        attachments: request.attachments
      };
      
      return await this.apiService.post<SuccessResponse>(
        `/employee/tasks/${taskId}/submit`,
        payload
      );
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to submit task');
    }
  }

  // ===============================
  // Shared Task Operations
  // ===============================

  /**
   * Get task details by ID
   * @param taskId Task UUID
   * @returns Complete task details
   */
  async getTaskById(taskId: string, userRole?: string): Promise<TaskResponse> {
    try {
      // Use role-based endpoint since there's no general /tasks/{id} endpoint
      const endpoint = userRole === 'MANAGER' || userRole === 'ADMIN' 
        ? `/manager/tasks/${taskId}` 
        : `/employee/tasks/${taskId}`;
      return await this.apiService.get<TaskResponse>(endpoint);
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to load task details');
    }
  }

  /**
   * Search and filter tasks
   * @param filters Search criteria and pagination
   * @returns Paginated search results
   */
  async searchTasks(filters: TaskSearchFilters): Promise<TaskSearchResponse> {
    try {
      // Use POST for search to handle complex filter objects
      return await this.apiService.post<TaskSearchResponse>('/manager/tasks/search', filters);
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to search tasks');
    }
  }

  /**
   * Get task activity history
   * @param taskId Task UUID
   * @returns List of task activities
   */
  async getTaskActivities(taskId: string): Promise<TaskActivityResponse[]> {
    try {
      return await this.apiService.get<TaskActivityResponse[]>(`/tasks/${taskId}/activities`);
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to load task activities');
    }
  }

  // ===============================
  // Comment System Operations
  // ===============================

  /**
   * Get task comments with threading support
   * @param taskId Task UUID
   * @returns List of comments with replies
   */
  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    try {
      return await this.apiService.get<TaskComment[]>(`/tasks/${taskId}/comments`);
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to load task comments');
    }
  }

  /**
   * Add a comment to a task
   * @param taskId Task UUID
   * @param request Comment data
   * @returns Created comment
   */
  async addTaskComment(taskId: string, request: AddCommentRequest): Promise<TaskComment> {
    try {
      return await this.apiService.post<TaskComment>(`/tasks/${taskId}/comments`, request);
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to add comment');
    }
  }

  /**
   * Update a comment
   * @param taskId Task UUID
   * @param commentId Comment UUID
   * @param request Update data
   * @returns Updated comment
   */
  async updateTaskComment(
    taskId: string, 
    commentId: string, 
    request: UpdateCommentRequest
  ): Promise<TaskComment> {
    try {
      return await this.apiService.put<TaskComment>(
        `/tasks/${taskId}/comments/${commentId}`,
        request
      );
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to update comment');
    }
  }

  /**
   * Delete a comment
   * @param taskId Task UUID
   * @param commentId Comment UUID
   * @returns Success response
   */
  async deleteTaskComment(taskId: string, commentId: string): Promise<SuccessResponse> {
    try {
      return await this.apiService.delete<SuccessResponse>(
        `/tasks/${taskId}/comments/${commentId}`
      );
    } catch (error) {
      throw this.handleTaskError(error as ApiError, 'Failed to delete comment');
    }
  }

  // ===============================
  // Error Handling
  // ===============================

  private handleTaskError(error: ApiError, defaultMessage: string): Error {
    // Handle specific task management errors
    if (error.status === 403) {
      return new Error('You do not have permission to perform this action');
    }
    
    if (error.status === 404) {
      return new Error('Task not found or has been deleted');
    }
    
    if (error.status === 409) {
      return new Error('Task is in a state that prevents this operation');
    }
    
    if (error.status === 422) {
      // Validation errors - extract specific field errors if available
      if (error.data?.detail) {
        if (Array.isArray(error.data.detail)) {
          const fieldErrors = error.data.detail
            .map((err: any) => err.msg || err.message)
            .join(', ');
          return new Error(`Validation error: ${fieldErrors}`);
        } else {
          return new Error(`Validation error: ${error.data.detail}`);
        }
      }
      return new Error('Invalid data provided');
    }
    
    if (error.status === 429) {
      return new Error('Too many requests. Please wait before trying again.');
    }
    
    // Handle specific task workflow errors
    if (error.message?.includes('Only the task assigner can approve')) {
      return new Error('You can only approve tasks that you created');
    }
    
    if (error.message?.includes('department_id')) {
      return new Error('Invalid department selected. Please choose a valid department.');
    }
    
    if (error.message?.includes('assignee_id')) {
      return new Error('Invalid employee selected for assignment. Please choose a valid employee.');
    }
    
    // Return original error message if available, otherwise use default
    return new Error(error.message || defaultMessage);
  }
}

// Note: Use the properly constructed taskService from serviceFactory.ts instead
// export const taskService = new TaskService(); // Removed - this was broken (missing ApiService parameter)

export default TaskService;