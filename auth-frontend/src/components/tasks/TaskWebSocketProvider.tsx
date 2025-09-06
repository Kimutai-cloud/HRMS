/**
 * Task WebSocket Provider Component
 * Integrates real-time WebSocket updates with React Query cache
 */

import React, { createContext, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTaskWebSocketIntegration } from '@/hooks/useTaskWebSocket';
import { useAuth } from '@/contexts/AuthContext';
import websocketService from '@/services/websocketService';
import { ConnectionStatus } from '@/components/ui/connection-status';
import { toast } from 'sonner';

interface TaskWebSocketContextType {
  isConnected: boolean;
  connectionStatus: string;
  reconnect: () => void;
}

const TaskWebSocketContext = createContext<TaskWebSocketContextType | undefined>(undefined);

export const useTaskWebSocket = () => {
  const context = useContext(TaskWebSocketContext);
  if (!context) {
    throw new Error('useTaskWebSocket must be used within TaskWebSocketProvider');
  }
  return context;
};

interface TaskWebSocketProviderProps {
  children: React.ReactNode;
}

export const TaskWebSocketProvider: React.FC<TaskWebSocketProviderProps> = ({ children }) => {
  const { user, accessToken } = useAuth();
  const queryClient = useQueryClient();
  const { isConnected, connectionStatus, reconnect } = useTaskWebSocketIntegration();

  // Initialize WebSocket connection when user is authenticated
  useEffect(() => {
    if (user && accessToken) {
      websocketService.setCredentials(accessToken, user.id);
      websocketService.connect();
    }

    return () => {
      if (websocketService.isConnected()) {
        websocketService.disconnect();
      }
    };
  }, [user, accessToken]);

  // Handle connection status changes
  useEffect(() => {
    let reconnectToast: string | number | undefined;

    if (connectionStatus === 'connecting') {
      reconnectToast = toast.loading('Connecting to real-time updates...', {
        id: 'websocket-connection'
      });
    } else if (connectionStatus === 'connected') {
      toast.success('Connected to real-time updates', {
        id: 'websocket-connection'
      });
    } else if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
      toast.error('Lost connection to real-time updates', {
        id: 'websocket-connection',
        description: 'Some features may not work properly. Click to reconnect.',
        action: {
          label: 'Reconnect',
          onClick: reconnect
        },
        duration: 10000
      });
    }

    return () => {
      if (reconnectToast) {
        toast.dismiss(reconnectToast);
      }
    };
  }, [connectionStatus, reconnect]);

  const contextValue: TaskWebSocketContextType = {
    isConnected,
    connectionStatus,
    reconnect
  };

  return (
    <TaskWebSocketContext.Provider value={contextValue}>
      {children}
      {/* Connection Status Indicator */}
      <ConnectionStatus 
        isConnected={isConnected}
        status={connectionStatus}
        onReconnect={reconnect}
      />
    </TaskWebSocketContext.Provider>
  );
};

/**
 * Hook to automatically subscribe/unsubscribe to task updates
 */
export const useAutoTaskSubscription = (taskId: string | undefined) => {
  useEffect(() => {
    if (!taskId) return;

    const subscribeToTask = () => {
      if (websocketService.isConnected()) {
        websocketService.subscribeToTask(taskId);
      }
    };

    const unsubscribeFromTask = () => {
      if (websocketService.isConnected()) {
        websocketService.unsubscribeFromTask(taskId);
      }
    };

    // Subscribe when component mounts or connection is established
    subscribeToTask();

    // Listen for connection changes
    const unsubscribeConnection = websocketService.onConnection((connected) => {
      if (connected) {
        subscribeToTask();
      }
    });

    return () => {
      unsubscribeFromTask();
      unsubscribeConnection();
    };
  }, [taskId]);
};