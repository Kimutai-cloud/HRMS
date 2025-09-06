/**
 * Task Priority Indicator Component
 * Displays task priority with proper color coding and visual hierarchy
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Priority } from '@/types/task';
import { cn } from '@/lib/utils';

interface TaskPriorityIndicatorProps {
  priority: Priority;
  variant?: 'badge' | 'dot' | 'bar';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

const PRIORITY_CONFIG = {
  [Priority.LOW]: {
    label: 'Low',
    className: 'bg-green-100 text-green-800 border-green-300',
    dotColor: 'bg-green-500',
    barColor: 'bg-green-500',
    icon: '🔽',
    level: 1
  },
  [Priority.MEDIUM]: {
    label: 'Medium',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    dotColor: 'bg-yellow-500',
    barColor: 'bg-yellow-500',
    icon: '➡️',
    level: 2
  },
  [Priority.HIGH]: {
    label: 'High',
    className: 'bg-orange-100 text-orange-800 border-orange-300',
    dotColor: 'bg-orange-500',
    barColor: 'bg-orange-500',
    icon: '🔼',
    level: 3
  },
  [Priority.URGENT]: {
    label: 'Urgent',
    className: 'bg-red-100 text-red-800 border-red-300',
    dotColor: 'bg-red-500',
    barColor: 'bg-red-500',
    icon: '🚨',
    level: 4
  }
} as const;

const SIZE_CONFIG = {
  sm: {
    badge: 'text-xs px-1.5 py-0.5',
    dot: 'w-2 h-2',
    bar: 'w-1 h-4'
  },
  md: {
    badge: 'text-xs px-2 py-1',
    dot: 'w-3 h-3',
    bar: 'w-1.5 h-6'
  },
  lg: {
    badge: 'text-sm px-3 py-1.5',
    dot: 'w-4 h-4',
    bar: 'w-2 h-8'
  }
} as const;

export const TaskPriorityIndicator: React.FC<TaskPriorityIndicatorProps> = ({
  priority,
  variant = 'badge',
  size = 'md',
  className,
  showLabel = true
}) => {
  const config = PRIORITY_CONFIG[priority];
  const sizeConfig = SIZE_CONFIG[size];

  if (variant === 'dot') {
    return (
      <div 
        className={cn(
          'rounded-full flex-shrink-0',
          config.dotColor,
          sizeConfig.dot,
          className
        )}
        title={`Priority: ${config.label}`}
        aria-label={`Priority: ${config.label}`}
      />
    );
  }

  if (variant === 'bar') {
    return (
      <div 
        className={cn(
          'rounded-full flex-shrink-0',
          config.barColor,
          sizeConfig.bar,
          className
        )}
        title={`Priority: ${config.label}`}
        aria-label={`Priority: ${config.label}`}
      />
    );
  }

  // Default badge variant
  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-medium transition-colors',
        config.className,
        sizeConfig.badge,
        className
      )}
      title={`Priority: ${config.label}`}
    >
      <span className="text-xs" aria-hidden="true">
        {config.icon}
      </span>
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
};

export default TaskPriorityIndicator;