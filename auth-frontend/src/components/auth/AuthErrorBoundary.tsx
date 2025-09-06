import React, { Component, type ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log the error for debugging
    console.error('Auth Error Boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-8 text-center">
            {/* Error Icon */}
            <div className="w-24 h-24 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Authentication Error
            </h1>

            <p className="text-lg text-gray-600 mb-6">
              Something went wrong with the authentication system.
            </p>

            {/* Error Details (only in development) */}
            {import.meta.env.MODE === 'development' && this.state.error && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-gray-900 mb-2">Error Details:</h3>
                <p className="text-sm text-red-600 mb-2">{this.state.error.toString()}</p>
                {this.state.errorInfo && (
                  <details className="text-sm text-gray-600">
                    <summary className="cursor-pointer mb-2">Stack Trace</summary>
                    <pre className="whitespace-pre-wrap overflow-x-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={this.handleRetry}>
                Try Again
              </Button>
              <Button variant="outline" onClick={this.handleGoHome}>
                Go to Home
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>

            {/* Help Text */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                If this problem persists, please try logging out and logging back in, 
                or contact support for assistance.
              </p>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with auth error boundary
 */
export function withAuthErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
) {
  return function WithAuthErrorBoundary(props: P) {
    return (
      <AuthErrorBoundary fallback={fallback} onError={onError}>
        <Component {...props} />
      </AuthErrorBoundary>
    );
  };
}

/**
 * Hook for handling authentication errors
 */
export function useAuthErrorHandler() {
  const handleAuthError = (error: Error) => {
    console.error('Authentication error:', error);
    
    // Check if it's a specific auth error
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      // Redirect to login
      window.location.href = '/login';
    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
      // Redirect to unauthorized page
      window.location.href = '/unauthorized';
    } else {
      // Generic error handling
      throw error; // Let the error boundary handle it
    }
  };

  return { handleAuthError };
}