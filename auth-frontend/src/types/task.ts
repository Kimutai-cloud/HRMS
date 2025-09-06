/**
 * Task Management Types
 * Based on backend API schema and comprehensive testing results
 */

// ===============================
// Core Enums (Must match backend exactly)
// ===============================

export enum TaskType {
  PROJECT = "PROJECT",
  TASK = "TASK", 
  SUBTASK = "SUBTASK"
}

export enum TaskStatus {
  DRAFT = "DRAFT",
  ASSIGNED = "ASSIGNED",
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  IN_REVIEW = "IN_REVIEW",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export enum Priority {
  LOW = "LOW",
  MEDIUM = "MEDIUM", 
  HIGH = "HIGH",
  URGENT = "URGENT"
}

export enum CommentType {
  COMMENT = "COMMENT",
  STATUS_CHANGE = "STATUS_CHANGE",
  PROGRESS_UPDATE = "PROGRESS_UPDATE",
  REVIEW_NOTES = "REVIEW_NOTES"
}

// ===============================
// ID Management Types (Critical)
// ===============================

export interface TaskUser {
  user_id: string;        // From JWT token - authentication ID
  employee_id: string;    // For task operations - database ID
  email: string;
  name?: string;
}

// ===============================
// Core Task Types
// ===============================

export interface Task {
  id: string;
  title: string;
  description?: string;
  task_type: TaskType;
  priority: Priority;
  status: TaskStatus;
  department_id: string;
  assignee_id?: string;
  assigner_id: string;
  parent_task_id?: string;
  estimated_hours?: number;
  actual_hours?: number;
  progress_percentage: number;
  due_date?: string; // ISO datetime string
  created_at: string;
  updated_at: string;
  tags?: string[];
  details?: Record<string, any>;
}

export interface TaskSummary {
  id: string;
  title: string;
  task_type: TaskType;
  priority: Priority;
  status: TaskStatus;
  progress_percentage: number;
  due_date?: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  department: {
    id: string;
    name: string;
    code: string;
  };
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
  tags?: string[];
}

// ===============================
// Request/Response Types
// ===============================

export interface CreateTaskRequest {
  title: string; // Required, max 200 chars
  description?: string;
  task_type: TaskType;
  priority: Priority;
  department_id: string; // Required UUID - must exist in departments
  assignee_id?: string; // Optional UUID - employee ID, not user ID
  parent_task_id?: string;
  estimated_hours?: number;
  due_date?: string; // ISO datetime string
  tags?: string[];
  details?: Record<string, any>; // Not implemented yet in backend
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  due_date?: string;
  estimated_hours?: number;
  tags?: string[];
}

export interface AssignTaskRequest {
  assignee_id: string; // Required - Employee ID (not User ID)
  assignment_notes?: string;
}

export interface UpdateTaskProgressRequest {
  progress_percentage: number; // 0-100
  notes?: string;
  actual_hours?: number;
}

export interface SubmitTaskRequest {
  submission_notes?: string;
  actual_hours?: number;
  attachments?: Record<string, any>[];
}

export interface ReviewTaskRequest {
  approved: boolean;
  review_notes?: string;
}

export interface BulkTaskActionRequest {
  task_ids: string[];
  action: 'assign' | 'cancel' | 'delete';
  assignee_id?: string; // For assign action
  notes?: string;
}

// ===============================
// Dashboard and Statistics Types
// ===============================

export interface TaskStats {
  total_tasks: number;
  by_status: Record<TaskStatus, number>;
  by_priority: Record<Priority, number>;
  by_type: Record<TaskType, number>;
  overdue_count: number;
  completion_rate: number; // 0-100
  average_completion_days: number;
}

export interface EmployeeWorkload {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  total_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  workload_percentage: number;
  average_task_completion_days: number;
}

export interface TeamTaskStats {
  department: {
    id: string;
    name: string;
    code: string;
  };
  total_team_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  average_task_age: number;
  team_members: EmployeeWorkload[];
}

export interface ManagerDashboardData {
  personal_stats: TaskStats;
  team_stats: TeamTaskStats;
  recent_activities: TaskActivity[];
  pending_reviews: TaskSummary[];
  overdue_tasks: TaskSummary[];
}

export interface EmployeeDashboardData {
  personal_stats: TaskStats;
  assigned_tasks: TaskSummary[];
  recent_activities: TaskActivity[];
  upcoming_deadlines: TaskSummary[];
  workload_summary: EmployeeWorkload;
}

// ===============================
// Activity and Comments Types
// ===============================

export interface TaskActivity {
  id: string;
  task_id: string;
  task_title: string;
  activity_type: string;
  description: string;
  performed_by: {
    id: string;
    name: string;
    email: string;
  };
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  author_email: string;
  comment_type: CommentType;
  content: string;
  parent_comment_id?: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  replies?: TaskComment[];
}

export interface AddCommentRequest {
  content: string;
  comment_type?: CommentType;
  parent_comment_id?: string;
}

export interface UpdateCommentRequest {
  content: string;
}

// ===============================
// Search and Filtering Types
// ===============================

export interface TaskSearchFilters {
  search?: string; // Title/description search, max 100 chars
  status?: TaskStatus[];
  priority?: Priority[];
  task_type?: TaskType[];
  assignee_id?: string[];
  manager_id?: string;
  department_id?: string;
  parent_task_id?: string;
  due_date_from?: string; // ISO date string
  due_date_to?: string;
  created_date_from?: string; // Backend expects created_date_from/to
  created_date_to?: string;
  is_overdue?: boolean;
  tags?: string[];
  page?: number; // Default 1
  per_page?: number; // Backend expects per_page, not limit
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface TaskSearchResponse {
  tasks: TaskSummary[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// ===============================
// Real-time WebSocket Types
// ===============================

export interface TaskUpdateMessage {
  type: "TASK_UPDATE";
  task_id: string;
  status: TaskStatus;
  updated_by: string;
  timestamp: string;
  changes?: Record<string, any>;
}

export interface TaskCommentMessage {
  type: "TASK_COMMENT";
  task_id: string;
  comment_id: string;
  author: string;
  message: string;
  timestamp: string;
}

export interface TaskAssignmentMessage {
  type: "TASK_ASSIGNMENT";
  task_id: string;
  assignee_id: string;
  assigned_by: string;
  timestamp: string;
}

export type TaskWebSocketMessage = 
  | TaskUpdateMessage 
  | TaskCommentMessage 
  | TaskAssignmentMessage;

// ===============================
// UI Helper Types
// ===============================

export interface TaskStatusColors {
  [key: string]: {
    bg: string;
    text: string;
    border: string;
  };
}

export interface TaskPriorityColors {
  [key: string]: {
    bg: string;
    text: string;
    icon: string;
  };
}

// ===============================
// Form Validation Types
// ===============================

export interface TaskFormErrors {
  title?: string;
  description?: string;
  task_type?: string;
  priority?: string;
  department_id?: string;
  assignee_id?: string;
  due_date?: string;
  estimated_hours?: string;
}

export interface TaskValidationResult {
  isValid: boolean;
  errors: TaskFormErrors;
}

// ===============================
// State Machine Types
// ===============================

export type TaskStatusTransition = {
  [K in TaskStatus]: TaskStatus[];
};

export const VALID_TASK_TRANSITIONS: TaskStatusTransition = {
  [TaskStatus.DRAFT]: [TaskStatus.ASSIGNED, TaskStatus.CANCELLED],
  [TaskStatus.ASSIGNED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.SUBMITTED, TaskStatus.ASSIGNED],
  [TaskStatus.SUBMITTED]: [TaskStatus.IN_REVIEW, TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_REVIEW]: [TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS],
  [TaskStatus.COMPLETED]: [], // Final state
  [TaskStatus.CANCELLED]: []  // Final state
};

// ===============================
// API Response Types
// ===============================

export interface TaskResponse extends Task {
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  department?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface TaskSummaryResponse extends TaskSummary {}

export interface ManagerTaskDashboardResponse extends ManagerDashboardData {}

export interface EmployeeTaskDashboardResponse extends EmployeeDashboardData {}

export interface TaskStatsResponse extends TaskStats {}

export interface TeamTaskStatsResponse extends TeamTaskStats {}

export interface EmployeeWorkloadResponse extends EmployeeWorkload {}

export interface TaskActivityResponse extends TaskActivity {}

export interface SuccessResponse {
  success: boolean;
  message: string;
  data?: any;
}