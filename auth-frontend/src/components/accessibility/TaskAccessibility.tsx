import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Accessibility Components for Task Management
 * Enhanced ARIA support and keyboard navigation
 */

interface SkipLinkProps {
  targetId: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Skip navigation link for keyboard users
 */
export const SkipLink: React.FC<SkipLinkProps> = ({ 
  targetId, 
  children, 
  className 
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50',
        'bg-primary text-primary-foreground px-4 py-2 rounded-md',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
    >
      {children}
    </a>
  );
};

interface FocusTrapProps {
  children: React.ReactNode;
  isActive: boolean;
  restoreFocus?: boolean;
}

/**
 * Focus trap for modals and dialogs
 */
export const FocusTrap: React.FC<FocusTrapProps> = ({ 
  children, 
  isActive, 
  restoreFocus = true 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const getFocusableElements = () => {
      return container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;
    };

    const focusableElements = getFocusableElements();
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus the first element
    if (firstElement) {
      firstElement.focus();
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Trigger close action if available
        const closeButton = container.querySelector('[data-close-modal]') as HTMLElement;
        closeButton?.click();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);

      // Restore focus to previously focused element
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive, restoreFocus]);

  return (
    <div ref={containerRef} className="focus-trap">
      {children}
    </div>
  );
};

interface AnnouncementProps {
  message: string;
  priority?: 'polite' | 'assertive';
}

/**
 * Live region announcements for screen readers
 */
export const Announcement: React.FC<AnnouncementProps> = ({ 
  message, 
  priority = 'polite' 
}) => {
  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
};

interface TaskListAccessibilityProps {
  totalCount: number;
  currentView: string;
  isFiltered: boolean;
  children: React.ReactNode;
}

/**
 * Enhanced task list with accessibility features
 */
export const TaskListAccessibility: React.FC<TaskListAccessibilityProps> = ({
  totalCount,
  currentView,
  isFiltered,
  children
}) => {
  return (
    <section
      role="main"
      aria-labelledby="task-list-heading"
      aria-describedby="task-list-description"
    >
      <h2 id="task-list-heading" className="sr-only">
        Task List
      </h2>
      <div id="task-list-description" className="sr-only">
        {isFiltered ? (
          `Showing ${totalCount} filtered tasks in ${currentView} view`
        ) : (
          `Showing ${totalCount} tasks in ${currentView} view`
        )}
      </div>
      
      <div
        role="list"
        aria-label={`Task list with ${totalCount} items`}
      >
        {children}
      </div>
    </section>
  );
};

interface TaskCardAccessibilityProps {
  taskId: string;
  title: string;
  status: string;
  priority: string;
  assignee?: string;
  dueDate?: string;
  isSelected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * Accessible task card component
 */
export const TaskCardAccessibility: React.FC<TaskCardAccessibilityProps> = ({
  taskId,
  title,
  status,
  priority,
  assignee,
  dueDate,
  isSelected = false,
  onClick,
  children
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const getStatusAnnouncement = () => {
    let announcement = `${title}, ${status} priority ${priority}`;
    if (assignee) announcement += `, assigned to ${assignee}`;
    if (dueDate) announcement += `, due ${dueDate}`;
    return announcement;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      ref={cardRef}
      role="listitem"
      tabIndex={0}
      aria-selected={isSelected}
      aria-labelledby={`task-title-${taskId}`}
      aria-describedby={`task-details-${taskId}`}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      className={cn(
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'cursor-pointer transition-colors',
        isSelected && 'ring-2 ring-primary'
      )}
    >
      <div id={`task-title-${taskId}`} className="sr-only">
        {title}
      </div>
      <div id={`task-details-${taskId}`} className="sr-only">
        {getStatusAnnouncement()}
      </div>
      {children}
    </div>
  );
};

interface FormAccessibilityProps {
  formId: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Accessible form wrapper with proper labels and descriptions
 */
export const FormAccessibility: React.FC<FormAccessibilityProps> = ({
  formId,
  title,
  description,
  children
}) => {
  return (
    <form
      id={formId}
      role="form"
      aria-labelledby={`${formId}-title`}
      aria-describedby={description ? `${formId}-description` : undefined}
    >
      <h2 id={`${formId}-title`} className="sr-only">
        {title}
      </h2>
      {description && (
        <div id={`${formId}-description`} className="sr-only">
          {description}
        </div>
      )}
      {children}
    </form>
  );
};

interface ProgressAccessibilityProps {
  value: number;
  max: number;
  label: string;
  description?: string;
  children?: React.ReactNode;
}

/**
 * Accessible progress indicator
 */
export const ProgressAccessibility: React.FC<ProgressAccessibilityProps> = ({
  value,
  max,
  label,
  description,
  children
}) => {
  const percentage = Math.round((value / max) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      aria-describedby={description ? 'progress-description' : undefined}
    >
      {description && (
        <div id="progress-description" className="sr-only">
          {description}
        </div>
      )}
      <Announcement message={`Progress: ${percentage}% complete`} />
      {children}
    </div>
  );
};

interface FilterAccessibilityProps {
  filterId: string;
  label: string;
  activeFilters: string[];
  totalResults: number;
  children: React.ReactNode;
}

/**
 * Accessible filter section with live updates
 */
export const FilterAccessibility: React.FC<FilterAccessibilityProps> = ({
  filterId,
  label,
  activeFilters,
  totalResults,
  children
}) => {
  const [previousCount, setPreviousCount] = useState(totalResults);

  useEffect(() => {
    if (totalResults !== previousCount) {
      setPreviousCount(totalResults);
    }
  }, [totalResults, previousCount]);

  return (
    <section
      id={filterId}
      role="search"
      aria-labelledby={`${filterId}-label`}
      aria-describedby={`${filterId}-results`}
    >
      <h3 id={`${filterId}-label`} className="sr-only">
        {label}
      </h3>
      <div id={`${filterId}-results`} className="sr-only">
        {activeFilters.length > 0 ? (
          `${activeFilters.length} filters active: ${activeFilters.join(', ')}. 
           Showing ${totalResults} results.`
        ) : (
          `No filters active. Showing ${totalResults} results.`
        )}
      </div>
      
      <Announcement 
        message={`Filter results updated: ${totalResults} items found`}
        priority="polite"
      />
      
      {children}
    </section>
  );
};

/**
 * Keyboard navigation hook for task lists
 */
export const useKeyboardNavigation = (items: any[], onSelect?: (item: any) => void) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isNavigating) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev <= 0 ? items.length - 1 : prev - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (selectedIndex >= 0 && onSelect) {
            onSelect(items[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsNavigating(false);
          setSelectedIndex(-1);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, isNavigating, onSelect]);

  const startNavigation = () => {
    setIsNavigating(true);
    setSelectedIndex(0);
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setSelectedIndex(-1);
  };

  return {
    selectedIndex,
    isNavigating,
    startNavigation,
    stopNavigation,
  };
};

/**
 * Screen reader utility functions
 */
export const screenReaderUtils = {
  announcePageChange: (pageName: string) => {
    const announcement = `Navigated to ${pageName} page`;
    // Create temporary announcement element
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'assertive');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.textContent = announcement;
    document.body.appendChild(announcer);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 1000);
  },

  announceAction: (action: string, result?: string) => {
    const message = result ? `${action}: ${result}` : action;
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.className = 'sr-only';
    announcer.textContent = message;
    document.body.appendChild(announcer);
    
    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 1000);
  }
};