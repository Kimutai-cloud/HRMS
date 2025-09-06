/**
 * Task Status Badge Component
 * Displays task status with proper color coding and accessibility
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const STATUS_CONFIG = {
  [TaskStatus.DRAFT]: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200',
    icon: '📝'
  },
  [TaskStatus.ASSIGNED]: {
    label: 'Assigned',
    className: 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200',
    icon: '📋'
  },
  [TaskStatus.IN_PROGRESS]: {
    label: 'In Progress',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200',
    icon: '🔄'
  },
  [TaskStatus.SUBMITTED]: {
    label: 'Submitted',
    className: 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200',
    icon: '📤'
  },
  [TaskStatus.IN_REVIEW]: {
    label: 'In Review',
    className: 'bg-pink-100 text-pink-800 border-pink-300 hover:bg-pink-200',
    icon: '👀'
  },
  [TaskStatus.COMPLETED]: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200',
    icon: '✅'
  },
  [TaskStatus.CANCELLED]: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200',
    icon: '❌'
  }
} as const;

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({
  status,
  className
}) => {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium transition-colors',
        config.className,
        className
      )}
      title={`Task status: ${config.label}`}
    >
      <span className="text-xs" aria-hidden="true">
        {config.icon}
      </span>
      <span>{config.label}</span>
    </Badge>
  );
};

export default TaskStatusBadge;