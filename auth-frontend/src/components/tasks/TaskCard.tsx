/**
 * Task Card Component
 * Reusable task display component for both Manager and Employee views
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import TaskStatusBadge from './TaskStatusBadge';
import TaskPriorityIndicator from './TaskPriorityIndicator';
import type { TaskSummary } from '@/types/task';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  Clock, 
  User, 
  Building, 
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Play,
  Upload,
  X,
  RotateCcw,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow, format, isValid } from 'date-fns';

interface TaskCardProps {
  task: TaskSummary;
  showAssignee?: boolean;
  showDepartment?: boolean;
  showActions?: boolean;
  onActionClick?: (action: string, taskId: string) => void;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  canManageTasks?: boolean; // For showing approve/reject buttons
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  showAssignee = true,
  showDepartment = true,
  showActions = false,
  onActionClick,
  className,
  variant = 'default',
  canManageTasks = false
}) => {
  const isOverdue = task.is_overdue;
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const createdDate = new Date(task.created_at);

  const formatDate = (date: Date | null) => {
    if (!date || !isValid(date)) return null;
    return format(date, 'MMM d, yyyy');
  };

  const formatRelativeDate = (date: Date | null) => {
    if (!date || !isValid(date)) return null;
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAction = (action: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onActionClick?.(action, task.id);
  };

  const cardContent = (
    <Card 
      className={cn(
        'transition-all duration-200 hover:shadow-md cursor-pointer',
        isOverdue && 'ring-2 ring-red-200 border-red-300',
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-2">
              {task.title}
            </h3>
            
            <div className="flex items-center gap-2 flex-wrap">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityIndicator priority={task.priority} size="sm" />
              
              {task.task_type && (
                <Badge variant="secondary" className="text-xs">
                  {task.task_type}
                </Badge>
              )}
            </div>
          </div>

          {isOverdue && (
            <div className="flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Progress Bar */}
        {task.progress_percentage > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{task.progress_percentage}%</span>
            </div>
            <Progress value={task.progress_percentage} className="h-2" />
          </div>
        )}

        {/* Task Details */}
        <div className="space-y-2 text-xs text-muted-foreground">
          {/* Assignee */}
          {showAssignee && task.assignee && (
            <div className="flex items-center gap-2">
              <User className="w-3 h-3" />
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="text-xs">
                    {getInitials(task.assignee.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{task.assignee.name}</span>
              </div>
            </div>
          )}

          {/* Department */}
          {showDepartment && task.department && (
            <div className="flex items-center gap-2">
              <Building className="w-3 h-3" />
              <span className="truncate">
                {task.department.name} ({task.department.code})
              </span>
            </div>
          )}

          {/* Due Date */}
          {dueDate && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              <span className={cn(
                isOverdue && 'text-red-600 font-medium'
              )}>
                Due {formatRelativeDate(dueDate)}
                {isOverdue && ' (Overdue)'}
              </span>
            </div>
          )}

          {/* Created Date */}
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>Created {formatRelativeDate(createdDate)}</span>
          </div>
        </div>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0.5">
                {tag}
              </Badge>
            ))}
            {task.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                +{task.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="mt-4 space-y-2">
            {/* Common Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => handleAction('view', e)}
              >
                View Details
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={(e) => handleAction('comment', e)}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Comments
              </Button>
            </div>
            
            {/* Status-specific Employee Actions */}
            {task.status === 'ASSIGNED' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={(e) => handleAction('start', e)}
                >
                  <Play className="w-3 h-3 mr-1" />
                  Start Task
                </Button>
              </div>
            )}
            
            {task.status === 'IN_PROGRESS' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                  onClick={(e) => handleAction('update', e)}
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Update Progress
                </Button>
                {task.progress_percentage >= 100 && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                    onClick={(e) => handleAction('submit', e)}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Submit for Review
                  </Button>
                )}
              </div>
            )}
            
            {/* Manager Actions for Submitted Tasks */}
            {task.status === 'SUBMITTED' && canManageTasks && (
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs text-green-600 border-green-300 hover:bg-green-50"
                  onClick={(e) => handleAction('approve', e)}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                  onClick={(e) => handleAction('reject', e)}
                >
                  <X className="w-3 h-3 mr-1" />
                  Reject
                </Button>
              </div>
            )}
            
            {/* Status indicator for completed/cancelled */}
            {task.status === 'COMPLETED' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-medium">Task Completed</span>
              </div>
            )}
            
            {task.status === 'CANCELLED' && (
              <div className="flex items-center gap-2 text-red-600">
                <X className="w-4 h-4" />
                <span className="text-xs font-medium">Task Cancelled</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Wrap with Link for navigation
  return (
    <Link 
      to={`/tasks/${task.id}`} 
      className="block"
      onClick={(e) => {
        // Prevent navigation if clicking on action buttons
        if ((e.target as Element).closest('button')) {
          e.preventDefault();
        }
      }}
    >
      {cardContent}
    </Link>
  );
};

export default TaskCard;