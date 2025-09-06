import React from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug, Wifi, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Comprehensive Error Handling and Fallback Components
 * Production-ready error states with user-friendly messaging
 */

interface BaseErrorFallbackProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
  showTechnicalDetails?: boolean;
  error?: Error;
}

const BaseErrorFallback: React.FC<BaseErrorFallbackProps> = ({
  title,
  description,
  icon: Icon = AlertTriangle,
  actions,
  className,
  showTechnicalDetails = false,
  error
}) => {
  const navigate = useNavigate();

  const defaultActions = (
    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
      <Button onClick={() => window.location.reload()}>
        <RefreshCw className="w-4 h-4 mr-2" />
        Try Again
      </Button>
      <Button variant="outline" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Go Back
      </Button>
    </div>
  );

  return (
    <div className={cn('flex items-center justify-center min-h-[400px] p-4', className)}>
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
          
          {showTechnicalDetails && error && (
            <details className="text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground mb-2">
                Technical Details
              </summary>
              <div className="p-3 bg-muted rounded text-xs font-mono break-all">
                <div className="mb-2 font-semibold">Error:</div>
                <div>{error.message}</div>
                {error.stack && (
                  <>
                    <div className="mt-2 mb-1 font-semibold">Stack Trace:</div>
                    <div className="whitespace-pre-wrap text-[10px]">{error.stack}</div>
                  </>
                )}
              </div>
            </details>
          )}
          
          {actions || defaultActions}
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Network error fallback
 */
export const NetworkErrorFallback: React.FC<{
  onRetry?: () => void;
  className?: string;
}> = ({ onRetry, className }) => {
  return (
    <BaseErrorFallback
      title="Connection Problem"
      description="We're having trouble connecting to our servers. Please check your internet connection and try again."
      icon={Wifi}
      className={className}
      actions={
        <div className="space-y-3 w-full">
          <Button onClick={onRetry || (() => window.location.reload())} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
          <p className="text-xs text-muted-foreground">
            If the problem persists, please check your network connection.
          </p>
        </div>
      }
    />
  );
};

/**
 * Permission denied error fallback
 */
export const PermissionErrorFallback: React.FC<{
  resource?: string;
  className?: string;
}> = ({ resource = 'this resource', className }) => {
  const navigate = useNavigate();

  return (
    <BaseErrorFallback
      title="Access Denied"
      description={`You don't have permission to access ${resource}. Please contact your administrator if you believe this is an error.`}
      icon={Shield}
      className={className}
      actions={
        <div className="flex flex-col gap-3 w-full">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <Home className="w-4 h-4 mr-2" />
            Return to Dashboard
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      }
    />
  );
};

/**
 * Task not found error fallback
 */
export const TaskNotFoundFallback: React.FC<{
  taskId?: string;
  className?: string;
}> = ({ taskId, className }) => {
  const navigate = useNavigate();

  return (
    <BaseErrorFallback
      title="Task Not Found"
      description={
        taskId 
          ? `The task with ID "${taskId}" could not be found. It may have been deleted or you may not have access to it.`
          : "The requested task could not be found. It may have been deleted or moved."
      }
      className={className}
      actions={
        <div className="flex flex-col gap-3 w-full">
          <Button onClick={() => navigate('/tasks')}>
            View All Tasks
          </Button>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
        </div>
      }
    />
  );
};

/**
 * Session expired error fallback
 */
export const SessionExpiredFallback: React.FC<{
  onLogin?: () => void;
  className?: string;
}> = ({ onLogin, className }) => {
  return (
    <BaseErrorFallback
      title="Session Expired"
      description="Your session has expired for security reasons. Please log in again to continue."
      icon={Clock}
      className={className}
      actions={
        <div className="space-y-3 w-full">
          <Button onClick={onLogin || (() => window.location.href = '/login')} className="w-full">
            Log In Again
          </Button>
          <p className="text-xs text-muted-foreground">
            You'll be redirected to the login page.
          </p>
        </div>
      }
    />
  );
};

/**
 * Server error (5xx) fallback
 */
export const ServerErrorFallback: React.FC<{
  errorCode?: number;
  className?: string;
}> = ({ errorCode = 500, className }) => {
  const getErrorMessage = (code: number) => {
    switch (code) {
      case 500:
        return "We're experiencing technical difficulties. Our team has been notified.";
      case 502:
        return "The server is temporarily unavailable. Please try again in a few moments.";
      case 503:
        return "The service is temporarily unavailable for maintenance. Please try again later.";
      default:
        return "We're experiencing server issues. Please try again later.";
    }
  };

  return (
    <BaseErrorFallback
      title={`Server Error (${errorCode})`}
      description={getErrorMessage(errorCode)}
      className={className}
      actions={
        <div className="space-y-3 w-full">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <p className="text-xs text-muted-foreground">
            If the problem continues, please contact support.
          </p>
        </div>
      }
    />
  );
};

/**
 * Generic error fallback with debugging options
 */
export const GenericErrorFallback: React.FC<{
  error: Error;
  resetError?: () => void;
  context?: string;
  className?: string;
}> = ({ error, resetError, context = 'application', className }) => {
  const navigate = useNavigate();

  const isNetworkError = error.message.includes('fetch') || error.message.includes('network');
  const isPermissionError = error.message.includes('403') || error.message.includes('401');

  if (isNetworkError) {
    return <NetworkErrorFallback onRetry={resetError} className={className} />;
  }

  if (isPermissionError) {
    return <PermissionErrorFallback className={className} />;
  }

  return (
    <BaseErrorFallback
      title={`${context} Error`}
      description="Something unexpected happened. We're working to fix this issue."
      error={error}
      showTechnicalDetails={process.env.NODE_ENV === 'development'}
      className={className}
      actions={
        <div className="flex flex-col gap-3 w-full">
          <Button onClick={resetError || (() => window.location.reload())}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>
          {process.env.NODE_ENV === 'development' && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                const report = {
                  error: error.message,
                  stack: error.stack,
                  timestamp: new Date().toISOString(),
                  userAgent: navigator.userAgent,
                  url: window.location.href
                };
                navigator.clipboard.writeText(JSON.stringify(report, null, 2));
                alert('Error report copied to clipboard');
              }}
            >
              <Bug className="w-4 h-4 mr-2" />
              Copy Error Report
            </Button>
          )}
        </div>
      }
    />
  );
};

/**
 * Inline error display for smaller components
 */
export const InlineError: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}> = ({ title = 'Error', message, onRetry, className }) => {
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm mt-1">{message}</div>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-4 flex-shrink-0"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

/**
 * Loading error state for lists
 */
export const LoadingError: React.FC<{
  what?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ what = 'content', onRetry, className }) => {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="text-center max-w-sm">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Failed to Load</h3>
        <p className="text-muted-foreground text-sm mb-4">
          We couldn't load the {what}. This might be a temporary issue.
        </p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Maintenance mode fallback
 */
export const MaintenanceFallback: React.FC<{
  estimatedTime?: string;
  className?: string;
}> = ({ estimatedTime, className }) => {
  return (
    <BaseErrorFallback
      title="Scheduled Maintenance"
      description={
        estimatedTime
          ? `We're performing scheduled maintenance. We'll be back ${estimatedTime}.`
          : "We're performing scheduled maintenance and will be back shortly."
      }
      icon={Clock}
      className={className}
      actions={
        <div className="space-y-3 w-full">
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Check Again
          </Button>
          <p className="text-xs text-muted-foreground">
            Thank you for your patience.
          </p>
        </div>
      }
    />
  );
};

/**
 * Error boundary hook for functional components
 */
export function useErrorHandler() {
  const navigate = useNavigate();

  const handleError = (error: Error, context: string = 'Unknown') => {
    console.error(`Error in ${context}:`, error);

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with error tracking service
    }

    // Determine appropriate action based on error type
    if (error.message.includes('401') || error.message.includes('403')) {
      navigate('/login');
    } else if (error.message.includes('404')) {
      navigate('/404');
    }
    // For other errors, let error boundary handle it
  };

  return { handleError };
}

/**
 * Retry mechanism hook
 */
export function useRetry(maxRetries: number = 3) {
  const [retryCount, setRetryCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);

  const retry = async (fn: () => Promise<any>) => {
    if (retryCount >= maxRetries) {
      throw new Error(`Max retries (${maxRetries}) exceeded`);
    }

    setIsRetrying(true);
    try {
      const result = await fn();
      setRetryCount(0); // Reset on success
      return result;
    } catch (error) {
      setRetryCount(prev => prev + 1);
      throw error;
    } finally {
      setIsRetrying(false);
    }
  };

  const reset = () => {
    setRetryCount(0);
    setIsRetrying(false);
  };

  return {
    retry,
    reset,
    retryCount,
    isRetrying,
    canRetry: retryCount < maxRetries
  };
}