import React from 'react';
import { Loader2, RefreshCw, AlertCircle, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Task Management Loading States
 * Specialized loading components for task management interfaces
 */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <Loader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} />
  );
};

interface TaskListSkeletonProps {
  count?: number;
  showFilters?: boolean;
}

export const TaskListSkeleton: React.FC<TaskListSkeletonProps> = ({ 
  count = 5, 
  showFilters = true 
}) => {
  return (
    <div className="space-y-4">
      {/* Filter skeleton */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="h-10 w-48 bg-muted animate-pulse rounded" />
              <div className="h-10 w-32 bg-muted animate-pulse rounded" />
              <div className="h-10 w-40 bg-muted animate-pulse rounded" />
              <div className="h-10 w-24 bg-muted animate-pulse rounded" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task list skeleton */}
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="flex gap-2 mt-3">
                    <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
                    <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
                    <div className="h-6 w-14 bg-muted animate-pulse rounded-full" />
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface TaskDetailSkeletonProps {
  showComments?: boolean;
}

export const TaskDetailSkeleton: React.FC<TaskDetailSkeletonProps> = ({ 
  showComments = true 
}) => {
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-10 w-20 bg-muted animate-pulse rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-8 w-2/3 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
          <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
          <div className="h-6 w-14 bg-muted animate-pulse rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content skeleton */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>

          {/* Progress skeleton */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-full bg-muted animate-pulse rounded-full" />
                <div className="flex gap-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comments skeleton */}
          {showComments && (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="border-l-2 pl-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="h-4 w-full bg-muted animate-pulse rounded" />
                      <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-6 w-28 bg-muted animate-pulse rounded" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface DashboardSkeletonProps {
  showStats?: boolean;
  showCharts?: boolean;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ 
  showStats = true, 
  showCharts = true 
}) => {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts skeleton */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-6 w-40 bg-muted animate-pulse rounded" />
                <div className="h-64 w-full bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-6 w-36 bg-muted animate-pulse rounded" />
                <div className="h-64 w-full bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent tasks skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            <TaskListSkeleton count={3} showFilters={false} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline';
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = CheckSquare,
  title,
  description,
  action,
  className
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <Icon className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
      {action && (
        <Button 
          onClick={action.onClick} 
          variant={action.variant || 'default'}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  description = "We encountered an error while loading this content.",
  onRetry,
  className
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <AlertCircle className="w-12 h-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
    </div>
  );
};

interface InlineLoadingProps {
  text?: string;
  size?: 'sm' | 'md';
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({ 
  text = "Loading...", 
  size = 'md' 
}) => {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <LoadingSpinner size={size === 'sm' ? 'sm' : 'md'} />
      <span className={size === 'sm' ? 'text-sm' : ''}>{text}</span>
    </div>
  );
};