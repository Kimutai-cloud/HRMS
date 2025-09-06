import React, { useState } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Clock,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { NotificationData } from '../../services/websocketService';

const getNotificationIcon = (type: NotificationData['type']) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    default:
      return <Info className="w-4 h-4 text-blue-500" />;
  }
};

const getNotificationBorderColor = (type: NotificationData['type']) => {
  switch (type) {
    case 'success':
      return 'border-l-green-500';
    case 'error':
      return 'border-l-red-500';
    case 'warning':
      return 'border-l-yellow-500';
    default:
      return 'border-l-blue-500';
  }
};

const formatTimestamp = (timestamp: Date) => {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return timestamp.toLocaleDateString();
};

interface NotificationItemProps {
  notification: NotificationData;
  onMarkAsRead: (id: string) => void;
  onAction?: (url: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  onMarkAsRead, 
  onAction 
}) => {
  return (
    <div
      className={`
        p-4 border-l-4 ${getNotificationBorderColor(notification.type)}
        ${notification.read ? 'bg-muted/20' : 'bg-background'}
        hover:bg-muted/30 transition-colors
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {getNotificationIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-medium ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
              {notification.title}
            </h4>
            <div className="flex items-center gap-2">
              {!notification.read && (
                <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
              )}
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatTimestamp(notification.timestamp)}
              </span>
            </div>
          </div>
          
          <p className={`text-sm mt-1 ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
            {notification.message}
          </p>
          
          <div className="flex items-center gap-2 mt-2">
            {notification.actionUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction?.(notification.actionUrl!)}
                className="h-7 text-xs"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View Details
              </Button>
            )}
            
            {!notification.read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkAsRead(notification.id)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Mark as Read
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface NotificationCenterProps {
  className?: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ className }) => {
  const { notifications, unreadCount, markAsRead, clearNotifications, connectionStatus } = useWebSocket();
  const [isOpen, setIsOpen] = useState(false);

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleAction = (url: string) => {
    // Handle navigation to action URL
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
    setIsOpen(false);
  };

  const handleMarkAllAsRead = () => {
    notifications.forEach(notification => {
      if (!notification.read) {
        markAsRead(notification.id);
      }
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative ${className}`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-96 sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle>Notifications</SheetTitle>
              <div className="flex items-center gap-1">
                <div 
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' : 
                    connectionStatus === 'connecting' ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`} 
                />
                <span className="text-xs text-muted-foreground capitalize">
                  {connectionStatus}
                </span>
              </div>
            </div>
            
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Mark All Read
              </Button>
            )}
          </div>
          
          <SheetDescription>
            {notifications.length === 0 
              ? "No notifications yet"
              : `${notifications.length} notifications, ${unreadCount} unread`
            }
          </SheetDescription>
        </SheetHeader>
        
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Bell className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No notifications</h3>
            <p className="text-sm text-muted-foreground">You're all caught up!</p>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100vh-120px)]">
            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </ScrollArea>
            
            {notifications.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearNotifications}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear All Notifications
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default NotificationCenter;