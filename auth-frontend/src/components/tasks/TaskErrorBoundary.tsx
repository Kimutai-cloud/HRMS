import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, Bug } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

/**
 * Task Management Error Boundary
 * Catches and handles errors within task management components
 */
export class TaskErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('TaskErrorBoundary caught an error:', error, errorInfo);
    }

    // Report to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with error tracking service (e.g., Sentry)
      console.error('Task Management Error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    } else {
      // Reload the page if max retries exceeded
      window.location.reload();
    }
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleReportError = () => {
    const { error } = this.state;
    if (error) {
      // Create error report
      const errorReport = {
        message: error.message,
        stack: error.stack,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      };

      // Copy to clipboard
      navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
      
      // Show success message (you might want to use toast here)
      alert('Error report copied to clipboard. Please share this with support.');
    }
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, showDetails = false } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Determine error type for better UX
      const isNetworkError = error?.message.includes('fetch') || 
                            error?.message.includes('network') ||
                            error?.message.includes('Failed to fetch');
      
      const isPermissionError = error?.message.includes('403') || 
                               error?.message.includes('Unauthorized') ||
                               error?.message.includes('Permission denied');

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="w-6 h-6" />
                Task Management Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isNetworkError ? (
                <Alert>
                  <AlertDescription>
                    Unable to connect to the server. Please check your internet connection and try again.
                  </AlertDescription>
                </Alert>
              ) : isPermissionError ? (
                <Alert>
                  <AlertDescription>
                    You don't have permission to access this resource. Please contact your administrator.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertDescription>
                    An unexpected error occurred while loading the task management interface.
                  </AlertDescription>
                </Alert>
              )}

              {showDetails && error && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Technical Details
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded text-xs font-mono">
                    <div className="font-semibold mb-2">Error Message:</div>
                    <div className="mb-3 break-words">{error.message}</div>
                    {error.stack && (
                      <>
                        <div className="font-semibold mb-2">Stack Trace:</div>
                        <div className="whitespace-pre-wrap break-words">{error.stack}</div>
                      </>
                    )}
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {retryCount < this.maxRetries ? (
                  <Button onClick={this.handleRetry} className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again {retryCount > 0 && `(${retryCount}/${this.maxRetries})`}
                  </Button>
                ) : (
                  <Button onClick={() => window.location.reload()} className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload Page
                  </Button>
                )}
                
                <Button variant="outline" onClick={this.handleGoBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={this.handleReportError}
                  className="w-full text-xs"
                >
                  <Bug className="w-3 h-3 mr-2" />
                  Copy Error Report
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

/**
 * Higher Order Component for wrapping components with TaskErrorBoundary
 */
export function withTaskErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: T) => (
    <TaskErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </TaskErrorBoundary>
  );

  WrappedComponent.displayName = `withTaskErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Specific error boundary for task operations
 */
interface TaskOperationErrorBoundaryProps extends Omit<Props, 'children'> {
  children: ReactNode;
  operationType: 'create' | 'update' | 'delete' | 'assign' | 'submit' | 'approve';
}

export const TaskOperationErrorBoundary: React.FC<TaskOperationErrorBoundaryProps> = ({
  children,
  operationType,
  ...props
}) => {
  const getOperationErrorMessage = (type: string) => {
    const messages = {
      create: 'Failed to create task',
      update: 'Failed to update task',
      delete: 'Failed to delete task',
      assign: 'Failed to assign task',
      submit: 'Failed to submit task',
      approve: 'Failed to approve task',
    };
    return messages[type as keyof typeof messages] || 'Task operation failed';
  };

  const customFallback = (
    <Alert>
      <AlertTriangle className="w-4 h-4" />
      <AlertDescription>
        {getOperationErrorMessage(operationType)}. Please try again or contact support if the problem persists.
      </AlertDescription>
    </Alert>
  );

  return (
    <TaskErrorBoundary fallback={customFallback} {...props}>
      {children}
    </TaskErrorBoundary>
  );
};