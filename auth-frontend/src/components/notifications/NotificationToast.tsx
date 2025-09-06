import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks';

const NotificationToast: React.FC = () => {
  const { toast } = useToast();
  const { notifications } = useWebSocket();

  useEffect(() => {
    const latestNotification = notifications[0];
    if (latestNotification && !latestNotification.read) {
      const getIcon = () => {
        switch (latestNotification.type) {
          case 'success':
            return <CheckCircle className="w-4 h-4" />;
          case 'error':
            return <AlertCircle className="w-4 h-4" />;
          case 'warning':
            return <AlertTriangle className="w-4 h-4" />;
          default:
            return <Info className="w-4 h-4" />;
        }
      };

      toast({
        title: latestNotification.title,
        description: latestNotification.message,
        variant: latestNotification.type === 'error' ? 'destructive' : 'default',
      });
    }
  }, [notifications, toast]);

  return null;
};

export default NotificationToast;