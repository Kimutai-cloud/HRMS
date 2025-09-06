export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  userId?: string;
  roles?: string[];
  department?: string;
  read: boolean;
  actionUrl?: string;
}

export interface TaskWebSocketMessage {
  type: 'task_update' | 'task_comment' | 'task_assignment';
  data: any;
}

export interface WebSocketMessage {
  type: 'notification' | 'dashboard_update' | 'status_change' | 'connection' | 'task_update' | 'task_comment' | 'task_assignment';
  data: any;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

class WebSocketService {
  private ws: WebSocket | null = null;
  private baseURL = "ws://localhost:8002/ws"; // Notification Service WebSocket URL
  private accessToken: string | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private isOnline = true;
  
  private listeners: {
    notification: ((notification: NotificationData) => void)[];
    dashboardUpdate: ((data: any) => void)[];
    statusChange: ((status: ConnectionStatus) => void)[];
    connection: ((connected: boolean) => void)[];
    taskUpdate: ((data: any) => void)[];
    taskComment: ((data: any) => void)[];
    taskAssignment: ((data: any) => void)[];
  } = {
    notification: [],
    dashboardUpdate: [],
    statusChange: [],
    connection: [],
    taskUpdate: [],
    taskComment: [],
    taskAssignment: []
  };

  setCredentials(token: string, userId: string) {
    this.accessToken = token;
    this.userId = userId;
    this.setupOnlineOfflineHandlers();
  }

  private setupOnlineOfflineHandlers() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      this.isOnline = navigator.onLine;
    }
  }

  private handleOnline() {
    console.log('Network: Back online');
    this.isOnline = true;
    if (!this.isConnected() && this.accessToken && this.userId) {
      this.connect();
    }
  }

  private handleOffline() {
    console.log('Network: Gone offline');
    this.isOnline = false;
    if (this.ws) {
      this.ws.close(1000, 'Network offline');
    }
  }

  connect() {
    if (!this.accessToken || !this.userId) {
      console.warn('WebSocket: No credentials provided');
      return;
    }

    if (!this.isOnline) {
      console.warn('WebSocket: Cannot connect while offline');
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      this.setConnectionStatus('connecting');
      const wsUrl = `${this.baseURL}?token=${this.accessToken}&userId=${this.userId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.setConnectionStatus('error');
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }

    // Clean up event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }

    this.setConnectionStatus('disconnected');
  }

  private handleOpen(event: Event) {
    console.log('WebSocket connected');
    this.setConnectionStatus('connected');
    this.reconnectAttempts = 0;
    this.notifyConnectionListeners(true);
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'notification':
          this.handleNotification(message.data);
          break;
        case 'dashboard_update':
          this.handleDashboardUpdate(message.data);
          break;
        case 'status_change':
          this.handleStatusChange(message.data);
          break;
        case 'task_update':
          this.handleTaskUpdate(message.data);
          break;
        case 'task_comment':
          this.handleTaskComment(message.data);
          break;
        case 'task_assignment':
          this.handleTaskAssignment(message.data);
          break;
        default:
          console.log('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log('WebSocket disconnected:', event.code, event.reason);
    this.setConnectionStatus('disconnected');
    this.notifyConnectionListeners(false);

    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event) {
    console.error('WebSocket error:', event);
    this.setConnectionStatus('error');
  }

  private handleNotification(data: NotificationData) {
    const notification: NotificationData = {
      ...data,
      timestamp: new Date(data.timestamp),
    };
    
    this.listeners.notification.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  private handleDashboardUpdate(data: any) {
    this.listeners.dashboardUpdate.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in dashboard update listener:', error);
      }
    });
  }

  private handleStatusChange(data: any) {
    this.listeners.statusChange.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in status change listener:', error);
      }
    });
  }

  private handleTaskUpdate(data: any) {
    this.listeners.taskUpdate.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in task update listener:', error);
      }
    });
  }

  private handleTaskComment(data: any) {
    this.listeners.taskComment.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in task comment listener:', error);
      }
    });
  }

  private handleTaskAssignment(data: any) {
    this.listeners.taskAssignment.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in task assignment listener:', error);
      }
    });
  }

  private setConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
    this.listeners.statusChange.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in status change listener:', error);
      }
    });
  }

  private notifyConnectionListeners(connected: boolean) {
    this.listeners.connection.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts);
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  sendMessage(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  markNotificationAsRead(notificationId: string) {
    this.sendMessage({
      type: 'notification',
      data: {
        action: 'mark_read',
        notificationId
      }
    });
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  onNotification(listener: (notification: NotificationData) => void) {
    this.listeners.notification.push(listener);
    return () => {
      const index = this.listeners.notification.indexOf(listener);
      if (index > -1) {
        this.listeners.notification.splice(index, 1);
      }
    };
  }

  onDashboardUpdate(listener: (data: any) => void) {
    this.listeners.dashboardUpdate.push(listener);
    return () => {
      const index = this.listeners.dashboardUpdate.indexOf(listener);
      if (index > -1) {
        this.listeners.dashboardUpdate.splice(index, 1);
      }
    };
  }

  onStatusChange(listener: (status: ConnectionStatus) => void) {
    this.listeners.statusChange.push(listener);
    return () => {
      const index = this.listeners.statusChange.indexOf(listener);
      if (index > -1) {
        this.listeners.statusChange.splice(index, 1);
      }
    };
  }

  onConnection(listener: (connected: boolean) => void) {
    this.listeners.connection.push(listener);
    return () => {
      const index = this.listeners.connection.indexOf(listener);
      if (index > -1) {
        this.listeners.connection.splice(index, 1);
      }
    };
  }

  onTaskUpdate(listener: (data: any) => void) {
    this.listeners.taskUpdate.push(listener);
    return () => {
      const index = this.listeners.taskUpdate.indexOf(listener);
      if (index > -1) {
        this.listeners.taskUpdate.splice(index, 1);
      }
    };
  }

  onTaskComment(listener: (data: any) => void) {
    this.listeners.taskComment.push(listener);
    return () => {
      const index = this.listeners.taskComment.indexOf(listener);
      if (index > -1) {
        this.listeners.taskComment.splice(index, 1);
      }
    };
  }

  onTaskAssignment(listener: (data: any) => void) {
    this.listeners.taskAssignment.push(listener);
    return () => {
      const index = this.listeners.taskAssignment.indexOf(listener);
      if (index > -1) {
        this.listeners.taskAssignment.splice(index, 1);
      }
    };
  }

  // Task-specific message sending
  subscribeToTask(taskId: string) {
    this.sendMessage({
      type: 'task_update',
      data: {
        action: 'subscribe',
        taskId
      }
    });
  }

  unsubscribeFromTask(taskId: string) {
    this.sendMessage({
      type: 'task_update',
      data: {
        action: 'unsubscribe',
        taskId
      }
    });
  }

  sendTaskComment(taskId: string, commentData: any) {
    this.sendMessage({
      type: 'task_comment',
      data: {
        action: 'new_comment',
        taskId,
        ...commentData
      }
    });
  }
}

export default new WebSocketService();