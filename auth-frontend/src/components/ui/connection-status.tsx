/**
 * Connection Status Component
 * Shows WebSocket connection status to users
 */

import React from 'react';
import { Button } from './button';
import { Badge } from './badge';
import { Alert, AlertDescription } from './alert';
import { 
  Wifi, 
  WifiOff, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  isConnected: boolean;
  status: string;
  onReconnect?: () => void;
  className?: string;
  variant?: 'badge' | 'alert' | 'inline';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  status,
  onReconnect,
  className,
  variant = 'badge'
}) => {
  const getStatusInfo = () => {
    switch (status) {
      case 'connecting':
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          label: 'Connecting...',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-300'
        };
      case 'connected':
        return {
          icon: <CheckCircle className="w-3 h-3" />,
          label: 'Connected',
          color: 'bg-green-100 text-green-800 border-green-300'
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="w-3 h-3" />,
          label: 'Disconnected',
          color: 'bg-red-100 text-red-800 border-red-300'
        };
      case 'error':
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Connection Error',
          color: 'bg-red-100 text-red-800 border-red-300'
        };
      default:
        return {
          icon: <Wifi className="w-3 h-3" />,
          label: 'Unknown',
          color: 'bg-gray-100 text-gray-800 border-gray-300'
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (variant === 'badge') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all',
          statusInfo.color,
          !isConnected && 'animate-pulse',
          className
        )}
      >
        {statusInfo.icon}
        <span>{statusInfo.label}</span>
        {!isConnected && onReconnect && (
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 ml-1 hover:bg-white/20"
            onClick={onReconnect}
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        )}
      </Badge>
    );
  }

  if (variant === 'alert' && !isConnected) {
    return (
      <Alert variant="destructive" className={className}>
        {statusInfo.icon}
        <AlertDescription className="flex items-center justify-between">
          <span>{statusInfo.label} - Real-time updates unavailable</span>
          {onReconnect && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReconnect}
              className="ml-2"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reconnect
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        {statusInfo.icon}
        <span className={cn(
          'font-medium',
          isConnected ? 'text-green-600' : 'text-red-600'
        )}>
          {statusInfo.label}
        </span>
        {!isConnected && onReconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReconnect}
            className="h-6 px-2 text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reconnect
          </Button>
        )}
      </div>
    );
  }

  return null;
};