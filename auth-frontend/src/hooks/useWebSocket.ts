import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import websocketService from '../services/websocketService';
import type { NotificationData } from '../services/websocketService';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export const useWebSocket = () => {
  const { user, accessToken } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user && accessToken) {
      websocketService.setCredentials(accessToken, user.id);
      websocketService.connect();

      const unsubscribeStatus = websocketService.onStatusChange((status) => {
        setConnectionStatus(status);
      });

      const unsubscribeNotification = websocketService.onNotification((notification) => {
        setNotifications(prev => [notification, ...prev]);
        if (!notification.read) {
          setUnreadCount(prev => prev + 1);
        }
      });

      return () => {
        unsubscribeStatus();
        unsubscribeNotification();
        websocketService.disconnect();
      };
    }
  }, [user, accessToken]);

  const markAsRead = useCallback((notificationId: string) => {
    websocketService.markNotificationAsRead(notificationId);
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    connectionStatus,
    notifications,
    unreadCount,
    isConnected: connectionStatus === 'connected',
    markAsRead,
    clearNotifications,
  };
};

export const useDashboardUpdates = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = websocketService.onDashboardUpdate((data) => {
      setDashboardData(data);
    });

    return unsubscribe;
  }, []);

  return dashboardData;
};

export default useWebSocket;