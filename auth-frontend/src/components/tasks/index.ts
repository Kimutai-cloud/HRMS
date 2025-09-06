/**
 * Task Management Components - Export Index
 * Centralizes exports for all task-related components
 */

// Shared Components
export { default as TaskStatusBadge } from './TaskStatusBadge';
export { default as TaskPriorityIndicator } from './TaskPriorityIndicator';
export { default as TaskCard } from './TaskCard';

// Manager Components
export { default as ManagerTaskDashboard } from './ManagerTaskDashboard';
export { default as TaskCreationForm } from './TaskCreationForm';
export { default as TaskReviewPanel } from './TaskReviewPanel';

// Employee Components
export { default as EmployeeTaskDashboard } from './EmployeeTaskDashboard';
export { default as TaskProgressTracker } from './TaskProgressTracker';
export { default as TaskSubmissionForm } from './TaskSubmissionForm';

// Real-time Components
export { default as TaskCommentSystem } from './TaskCommentSystem';
export { TaskWebSocketProvider, useTaskWebSocket, useAutoTaskSubscription } from './TaskWebSocketProvider';

// Re-export types for convenience
export type {
  TaskStatus,
  Priority,
  TaskType,
  CreateTaskRequest,
  TaskSummary,
  TaskResponse,
  ManagerTaskDashboardResponse,
  EmployeeTaskDashboardResponse
} from '../../types/task';