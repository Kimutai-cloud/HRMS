import React, { Suspense, lazy } from 'react';
import { TaskListSkeleton, TaskDetailSkeleton, DashboardSkeleton, LoadingSpinner } from '@/components/ui/loading-states';
import { TaskErrorBoundary } from './TaskErrorBoundary';

/**
 * Lazy Loading Components for Task Management
 * Optimized for performance with code splitting and error boundaries
 */

// Lazy load task components
const LazyManagerTaskDashboard = lazy(() => import('@/pages/ManagerTaskDashboard'));
const LazyEmployeeTaskDashboard = lazy(() => import('@/components/tasks/EmployeeTaskDashboard'));
const LazyTaskCommentSystem = lazy(() => import('@/components/tasks/TaskCommentSystem'));
const LazyTaskProgressTracker = lazy(() => import('@/components/tasks/TaskProgressTracker'));
const LazyTaskSubmissionForm = lazy(() => import('@/components/tasks/TaskSubmissionForm'));
const LazyTaskWebSocketProvider = lazy(() =>
  import('@/components/tasks/TaskWebSocketProvider').then(module => ({
    default: module.TaskWebSocketProvider
  }))
);

// Lazy load page components
const LazyTaskDetails = lazy(() => import('@/pages/TaskDetails'));
const LazyTaskCreatePage = lazy(() => import('@/pages/TaskCreatePage'));

/**
 * Manager Task Dashboard with lazy loading and error boundary
 */
export const ManagerTaskDashboardLazy: React.FC = () => (
  <TaskErrorBoundary>
    <Suspense fallback={<DashboardSkeleton showStats={true} showCharts={true} />}>
      <LazyManagerTaskDashboard />
    </Suspense>
  </TaskErrorBoundary>
);

/**
 * Employee Task Dashboard with lazy loading and error boundary
 */
export const EmployeeTaskDashboardLazy: React.FC = () => (
  <TaskErrorBoundary>
    <Suspense fallback={<DashboardSkeleton showStats={false} showCharts={false} />}>
      <LazyEmployeeTaskDashboard />
    </Suspense>
  </TaskErrorBoundary>
);

/**
 * Task Details with lazy loading and error boundary
 */
export const TaskDetailsLazy: React.FC = () => (
  <TaskErrorBoundary>
    <Suspense fallback={<TaskDetailSkeleton showComments={true} />}>
      <LazyTaskDetails />
    </Suspense>
  </TaskErrorBoundary>
);

/**
 * Task Create Page with lazy loading and error boundary
 */
export const TaskCreatePageLazy: React.FC = () => (
  <TaskErrorBoundary>
    <Suspense fallback={
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-muted-foreground">Loading task creation form...</p>
          </div>
        </div>
      </div>
    }>
      <LazyTaskCreatePage />
    </Suspense>
  </TaskErrorBoundary>
);

/**
 * Task Comment System with lazy loading
 */
interface TaskCommentSystemLazyProps {
  taskId: string;
}

export const TaskCommentSystemLazy: React.FC<TaskCommentSystemLazyProps> = ({ taskId }) => (
  <TaskErrorBoundary>
    <Suspense fallback={
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-2 text-muted-foreground">Loading comments...</span>
        </div>
      </div>
    }>
      <LazyTaskCommentSystem taskId={taskId} />
    </Suspense>
  </TaskErrorBoundary>
);

/**
 * Task Progress Tracker with lazy loading
 */
interface TaskProgressTrackerLazyProps {
  taskId: string;
}

export const TaskProgressTrackerLazy: React.FC<TaskProgressTrackerLazyProps> = ({ taskId }) => (
  <TaskErrorBoundary>
    <Suspense fallback={
      <div className="space-y-4">
        <div className="h-4 bg-muted animate-pulse rounded-full" />
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-8 bg-muted animate-pulse rounded-full" />
          ))}
        </div>
      </div>
    }>
      <LazyTaskProgressTracker taskId={taskId} />
    </Suspense>
  </TaskErrorBoundary>
);

/**
 * Task Submission Form with lazy loading
 */
interface TaskSubmissionFormLazyProps {
  taskId: string;
}

export const TaskSubmissionFormLazy: React.FC<TaskSubmissionFormLazyProps> = ({ taskId }) => (
  <TaskErrorBoundary>
    <Suspense fallback={
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
      </div>
    }>
      <LazyTaskSubmissionForm taskId={taskId} />
    </Suspense>
  </TaskErrorBoundary>
);
/**
 * Task WebSocket Provider with lazy loading
 */
interface TaskWebSocketProviderLazyProps {
  children: React.ReactNode;
}

export const TaskWebSocketProviderLazy: React.FC<TaskWebSocketProviderLazyProps> = ({ children }) => (
  <TaskErrorBoundary>
    <Suspense fallback={children}>
      <LazyTaskWebSocketProvider>
        {children}
      </LazyTaskWebSocketProvider>
    </Suspense>
  </TaskErrorBoundary>
);

/**
 * Preloader component for critical task components
 * Use this to preload components before they're needed
 */
export const TaskComponentPreloader: React.FC = () => {
  React.useEffect(() => {
    // Preload critical components after initial render
    const preloadTimer = setTimeout(() => {
      // Preload most commonly used components
      import('@/components/tasks/ManagerTaskDashboard');
      import('@/components/tasks/EmployeeTaskDashboard');
      import('@/pages/TaskDetails');
    }, 100);

    return () => clearTimeout(preloadTimer);
  }, []);

  return null;
};

/**
 * Dynamic import utilities for programmatic lazy loading
 */
export const taskComponentImports = {
  managerDashboard: () => import('@/components/tasks/ManagerTaskDashboard'),
  employeeDashboard: () => import('@/components/tasks/EmployeeTaskDashboard'),
  taskDetails: () => import('@/pages/TaskDetails'),
  taskCreate: () => import('@/pages/TaskCreatePage'),
  commentSystem: () => import('@/components/tasks/TaskCommentSystem'),
  progressTracker: () => import('@/components/tasks/TaskProgressTracker'),
  submissionForm: () => import('@/components/tasks/TaskSubmissionForm'),
  webSocketProvider: () => import('@/components/tasks/TaskWebSocketProvider'),
};

/**
 * Preload specific components based on user role
 */
export const preloadTaskComponentsForRole = (role: 'manager' | 'employee' | 'admin') => {
  switch (role) {
    case 'manager':
    case 'admin':
      taskComponentImports.managerDashboard();
      taskComponentImports.taskCreate();
      break;
    case 'employee':
      taskComponentImports.employeeDashboard();
      break;
  }
  
  // Always preload common components
  taskComponentImports.taskDetails();
  taskComponentImports.commentSystem();
};

/**
 * Bundle analyzer helper for identifying large components
 */
export const getComponentBundleInfo = () => {
  if (process.env.NODE_ENV === 'development') {
    return {
      managerDashboard: 'Manager Dashboard (~45KB)',
      employeeDashboard: 'Employee Dashboard (~35KB)',
      taskDetails: 'Task Details (~30KB)',
      taskCreate: 'Task Create (~40KB)',
      commentSystem: 'Comment System (~25KB)',
      progressTracker: 'Progress Tracker (~15KB)',
      submissionForm: 'Submission Form (~20KB)',
      webSocketProvider: 'WebSocket Provider (~10KB)',
    };
  }
  return null;
};