/**
 * Task WebSocket Integration Hooks
 * Handles real-time task updates, comments, and notifications
 */

import React, { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import websocketService from '@/services/websocketService';
import { useInvalidateTaskQueries, taskKeys } from '@/hooks/queries/useTaskQueries';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskWebSocketMessage } from '@/types/task';
import { toast } from 'sonner';

interface TaskUpdateData {
  task_id: string;
  status?: string;
  progress_percentage?: number;
  updated_by: {
    id: string;
    name: string;
    email: string;
  };
  timestamp: string;
  changes?: Record<string, any>;
}

interface TaskCommentData {
  task_id: string;
  comment_id: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  content: string;
  comment_type: string;
  timestamp: string;
  parent_comment_id?: string;
}

interface TaskAssignmentData {
  task_id: string;
  task_title: string;
  assignee_id: string;
  assignee_name: string;
  assigned_by: {
    id: string;
    name: string;
    email: string;
  };
  timestamp: string;
}

/**
 * Hook for real-time task updates
 */
export const useTaskRealTimeUpdates = () => {
  const queryClient = useQueryClient();
  const { invalidateAll, invalidateTask, invalidateTaskComments } = useInvalidateTaskQueries();
  const { user } = useAuth();

  const handleTaskUpdate = useCallback((data: TaskUpdateData) => {
    console.log('Task update received:', data);
    
    // Update specific task cache
    invalidateTask(data.task_id);
    
    // Update dashboard caches
    if (user?.id) {
      queryClient.invalidateQueries({ 
        queryKey: taskKeys.managerDashboard(user.id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: taskKeys.employeeDashboard(user.id) 
      });
    }

    // Show notification if the update is not from current user
    if (data.updated_by.id !== user?.id) {
      const statusChange = data.changes?.status;
      if (statusChange) {
        toast.info(`Task status updated`, {
          description: `${data.updated_by.name} changed task status to ${statusChange}`,
          action: {
            label: 'View Task',
            onClick: () => {
              // Navigate to task - would need router integration
              window.location.href = `/tasks/${data.task_id}`;
            }
          }
        });
      } else {
        toast.info(`Task updated`, {
          description: `${data.updated_by.name} made changes to the task`
        });
      }
    }
  }, [invalidateTask, queryClient, user?.id]);

  const handleTaskComment = useCallback((data: TaskCommentData) => {
    console.log('Task comment received:', data);
    
    // Update comments cache
    invalidateTaskComments(data.task_id);
    
    // Update task activities
    queryClient.invalidateQueries({
      queryKey: taskKeys.taskActivities(data.task_id)
    });

    // Show notification if comment is not from current user
    if (data.author.id !== user?.id) {
      toast.info(`New comment`, {
        description: `${data.author.name} added a comment`,
        action: {
          label: 'View',
          onClick: () => {
            window.location.href = `/tasks/${data.task_id}#comments`;
          }
        }
      });
    }
  }, [invalidateTaskComments, queryClient, user?.id]);

  const handleTaskAssignment = useCallback((data: TaskAssignmentData) => {
    console.log('Task assignment received:', data);
    
    // Update all relevant caches
    invalidateAll();
    
    // Show notification for task assignment
    if (data.assignee_id === user?.employee_id) {
      // Task assigned to current user
      toast.success(`New task assigned!`, {
        description: `${data.assigned_by.name} assigned "${data.task_title}" to you`,
        action: {
          label: 'View Task',
          onClick: () => {
            window.location.href = `/tasks/${data.task_id}`;
          }
        }
      });
    } else if (data.assigned_by.id === user?.id) {
      // Current user assigned task to someone else
      toast.success(`Task assigned`, {
        description: `"${data.task_title}" assigned to ${data.assignee_name}`
      });
    }
  }, [invalidateAll, user?.id, user?.employee_id]);

  useEffect(() => {
    // Set up WebSocket listeners
    const unsubscribeTaskUpdate = websocketService.onTaskUpdate(handleTaskUpdate);
    const unsubscribeTaskComment = websocketService.onTaskComment(handleTaskComment);
    const unsubscribeTaskAssignment = websocketService.onTaskAssignment(handleTaskAssignment);

    // Cleanup on unmount
    return () => {
      unsubscribeTaskUpdate();
      unsubscribeTaskComment();
      unsubscribeTaskAssignment();
    };
  }, [handleTaskUpdate, handleTaskComment, handleTaskAssignment]);

  return {
    isConnected: websocketService.isConnected(),
    connectionStatus: websocketService.getConnectionStatus()
  };
};

/**
 * Hook for subscribing to specific task updates
 */
export const useTaskSubscription = (taskId: string | undefined) => {
  useEffect(() => {
    if (!taskId || !websocketService.isConnected()) return;

    // Subscribe to task updates
    websocketService.subscribeToTask(taskId);

    // Cleanup on unmount or task change
    return () => {
      websocketService.unsubscribeFromTask(taskId);
    };
  }, [taskId]);
};

/**
 * Hook for real-time connection status
 */
export const useWebSocketConnection = () => {
  const [connectionStatus, setConnectionStatus] = React.useState(
    websocketService.getConnectionStatus()
  );
  const [isConnected, setIsConnected] = React.useState(
    websocketService.isConnected()
  );

  useEffect(() => {
    const unsubscribeStatus = websocketService.onStatusChange(setConnectionStatus);
    const unsubscribeConnection = websocketService.onConnection(setIsConnected);

    return () => {
      unsubscribeStatus();
      unsubscribeConnection();
    };
  }, []);

  const reconnect = useCallback(() => {
    websocketService.connect();
  }, []);

  return {
    connectionStatus,
    isConnected,
    reconnect
  };
};

/**
 * Hook for sending real-time task comments
 */
export const useTaskCommentSender = () => {
  const sendComment = useCallback((taskId: string, commentData: {
    content: string;
    comment_type?: string;
    parent_comment_id?: string;
  }) => {
    if (websocketService.isConnected()) {
      websocketService.sendTaskComment(taskId, commentData);
    }
  }, []);

  return { sendComment };
};

/**
 * Custom hook to integrate WebSocket updates with React Query
 */
export const useTaskWebSocketIntegration = () => {
  const realTimeUpdates = useTaskRealTimeUpdates();
  const connection = useWebSocketConnection();

  return {
    ...realTimeUpdates,
    ...connection
  };
};