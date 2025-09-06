import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { getTaskBreadcrumbs, TaskBreadcrumb } from '@/utils/taskNavigation';
import { cn } from '@/lib/utils';

interface TaskBreadcrumbsProps {
  taskData?: { id: string; title: string };
  className?: string;
}

/**
 * Breadcrumb navigation component for task management sections
 * Automatically generates breadcrumbs based on current route and task data
 */
export const TaskBreadcrumbs: React.FC<TaskBreadcrumbsProps> = ({ 
  taskData, 
  className 
}) => {
  const location = useLocation();
  const breadcrumbs = getTaskBreadcrumbs(location.pathname, taskData);

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav 
      className={cn("flex items-center space-x-2 text-sm text-muted-foreground", className)}
      aria-label="Breadcrumb"
    >
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center space-x-2">
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          )}
          
          {crumb.isActive ? (
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {index === 0 && <Home className="w-4 h-4 inline mr-1" />}
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-foreground transition-colors truncate max-w-[200px]"
            >
              {index === 0 && <Home className="w-4 h-4 inline mr-1" />}
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
};

/**
 * Simplified breadcrumb component for basic navigation
 */
interface SimpleBreadcrumbsProps {
  items: Array<{
    label: string;
    href?: string;
    isActive?: boolean;
  }>;
  className?: string;
}

export const SimpleBreadcrumbs: React.FC<SimpleBreadcrumbsProps> = ({ 
  items, 
  className 
}) => {
  return (
    <nav 
      className={cn("flex items-center space-x-2 text-sm text-muted-foreground", className)}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center space-x-2">
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          )}
          
          {item.isActive || !item.href ? (
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {item.label}
            </span>
          ) : (
            <Link
              to={item.href}
              className="hover:text-foreground transition-colors truncate max-w-[200px]"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
};