import { useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TaskStatus, Priority, TaskType } from '@/types/task';

/**
 * Advanced URL State Management for Task Filters
 * Provides persistent filter state with URL synchronization
 */

export interface TaskFilterState {
  search?: string;
  status?: TaskStatus[];
  priority?: Priority[];
  task_type?: TaskType[];
  assignee_id?: string[];
  department_id?: string[];
  due_date_from?: string;
  due_date_to?: string;
  created_from?: string;
  created_to?: string;
  tags?: string[];
  sort_by?: 'created_at' | 'due_date' | 'title' | 'priority' | 'status';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  view?: 'list' | 'grid' | 'board';
}

const DEFAULT_FILTERS: TaskFilterState = {
  page: 1,
  limit: 20,
  sort_by: 'created_at',
  sort_order: 'desc',
  view: 'list',
};

/**
 * Hook for managing task filter state with URL persistence
 */
export function useTaskFilters(initialFilters: Partial<TaskFilterState> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Parse current filters from URL
  const currentFilters = useMemo((): TaskFilterState => {
    const filters: TaskFilterState = { ...DEFAULT_FILTERS, ...initialFilters };

    // Parse single values
    const search = searchParams.get('search');
    if (search) filters.search = search;

    const department_id = searchParams.get('department');
    if (department_id) filters.department_id = [department_id];

    const due_date_from = searchParams.get('due_from');
    if (due_date_from) filters.due_date_from = due_date_from;

    const due_date_to = searchParams.get('due_to');
    if (due_date_to) filters.due_date_to = due_date_to;

    const created_from = searchParams.get('created_from');
    if (created_from) filters.created_from = created_from;

    const created_to = searchParams.get('created_to');
    if (created_to) filters.created_to = created_to;

    const sort_by = searchParams.get('sort');
    if (sort_by && ['created_at', 'due_date', 'title', 'priority', 'status'].includes(sort_by)) {
      filters.sort_by = sort_by as TaskFilterState['sort_by'];
    }

    const sort_order = searchParams.get('order');
    if (sort_order && ['asc', 'desc'].includes(sort_order)) {
      filters.sort_order = sort_order as 'asc' | 'desc';
    }

    const view = searchParams.get('view');
    if (view && ['list', 'grid', 'board'].includes(view)) {
      filters.view = view as 'list' | 'grid' | 'board';
    }

    const page = searchParams.get('page');
    if (page && !isNaN(parseInt(page))) {
      filters.page = parseInt(page);
    }

    const limit = searchParams.get('limit');
    if (limit && !isNaN(parseInt(limit))) {
      filters.limit = parseInt(limit);
    }

    // Parse array values
    const status = searchParams.get('status');
    if (status) {
      filters.status = status.split(',').filter(s => 
        ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'].includes(s)
      ) as TaskStatus[];
    }

    const priority = searchParams.get('priority');
    if (priority) {
      filters.priority = priority.split(',').filter(p => 
        ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(p)
      ) as Priority[];
    }

    const task_type = searchParams.get('type');
    if (task_type) {
      filters.task_type = task_type.split(',').filter(t => 
        ['PROJECT', 'TASK', 'SUBTASK'].includes(t)
      ) as TaskType[];
    }

    const assignee_id = searchParams.get('assignee');
    if (assignee_id) {
      filters.assignee_id = assignee_id.split(',');
    }

    const tags = searchParams.get('tags');
    if (tags) {
      filters.tags = tags.split(',');
    }

    return filters;
  }, [searchParams, initialFilters]);

  // Update filters and URL
  const updateFilters = useCallback((
    updates: Partial<TaskFilterState>, 
    options: { replace?: boolean; resetPage?: boolean } = {}
  ) => {
    const { replace = false, resetPage = true } = options;

    const newFilters = { ...currentFilters, ...updates };
    
    // Reset page when filters change (unless explicitly disabled)
    if (resetPage && Object.keys(updates).some(key => key !== 'page' && key !== 'view')) {
      newFilters.page = 1;
    }

    // Build new search params
    const newSearchParams = new URLSearchParams();

    // Add single value parameters
    if (newFilters.search) newSearchParams.set('search', newFilters.search);
    if (newFilters.department_id?.[0]) newSearchParams.set('department', newFilters.department_id[0]);
    if (newFilters.due_date_from) newSearchParams.set('due_from', newFilters.due_date_from);
    if (newFilters.due_date_to) newSearchParams.set('due_to', newFilters.due_date_to);
    if (newFilters.created_from) newSearchParams.set('created_from', newFilters.created_from);
    if (newFilters.created_to) newSearchParams.set('created_to', newFilters.created_to);
    
    // Only set non-default sort values
    if (newFilters.sort_by && newFilters.sort_by !== DEFAULT_FILTERS.sort_by) {
      newSearchParams.set('sort', newFilters.sort_by);
    }
    if (newFilters.sort_order && newFilters.sort_order !== DEFAULT_FILTERS.sort_order) {
      newSearchParams.set('order', newFilters.sort_order);
    }
    if (newFilters.view && newFilters.view !== DEFAULT_FILTERS.view) {
      newSearchParams.set('view', newFilters.view);
    }
    if (newFilters.page && newFilters.page !== DEFAULT_FILTERS.page) {
      newSearchParams.set('page', newFilters.page.toString());
    }
    if (newFilters.limit && newFilters.limit !== DEFAULT_FILTERS.limit) {
      newSearchParams.set('limit', newFilters.limit.toString());
    }

    // Add array value parameters
    if (newFilters.status?.length) {
      newSearchParams.set('status', newFilters.status.join(','));
    }
    if (newFilters.priority?.length) {
      newSearchParams.set('priority', newFilters.priority.join(','));
    }
    if (newFilters.task_type?.length) {
      newSearchParams.set('type', newFilters.task_type.join(','));
    }
    if (newFilters.assignee_id?.length) {
      newSearchParams.set('assignee', newFilters.assignee_id.join(','));
    }
    if (newFilters.tags?.length) {
      newSearchParams.set('tags', newFilters.tags.join(','));
    }

    setSearchParams(newSearchParams, { replace });
  }, [currentFilters, setSearchParams]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  // Set single filter
  const setFilter = useCallback(<K extends keyof TaskFilterState>(
    key: K, 
    value: TaskFilterState[K]
  ) => {
    updateFilters({ [key]: value });
  }, [updateFilters]);

  // Add/remove items from array filters
  const toggleArrayFilter = useCallback(<K extends keyof TaskFilterState>(
    key: K,
    value: string,
    currentArray?: string[]
  ) => {
    const current = currentArray || (currentFilters[key] as string[]) || [];
    const newArray = current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value];
    
    updateFilters({ [key]: newArray.length > 0 ? newArray : undefined } as Partial<TaskFilterState>);
  }, [currentFilters, updateFilters]);

  // Quick filter presets
  const applyPreset = useCallback((preset: 'my-tasks' | 'overdue' | 'high-priority' | 'in-progress') => {
    switch (preset) {
      case 'my-tasks':
        // This would need user context to set assignee_id
        updateFilters({ assignee_id: ['current-user-id'] });
        break;
      case 'overdue':
        updateFilters({ 
          due_date_to: new Date().toISOString().split('T')[0],
          status: ['ASSIGNED', 'IN_PROGRESS'] 
        });
        break;
      case 'high-priority':
        updateFilters({ priority: ['HIGH', 'URGENT'] });
        break;
      case 'in-progress':
        updateFilters({ status: ['IN_PROGRESS'] });
        break;
    }
  }, [updateFilters]);

  // Get filter summary for display
  const getFilterSummary = useCallback((): string[] => {
    const summary: string[] = [];
    
    if (currentFilters.search) {
      summary.push(`Search: "${currentFilters.search}"`);
    }
    if (currentFilters.status?.length) {
      summary.push(`Status: ${currentFilters.status.join(', ')}`);
    }
    if (currentFilters.priority?.length) {
      summary.push(`Priority: ${currentFilters.priority.join(', ')}`);
    }
    if (currentFilters.task_type?.length) {
      summary.push(`Type: ${currentFilters.task_type.join(', ')}`);
    }
    if (currentFilters.tags?.length) {
      summary.push(`Tags: ${currentFilters.tags.join(', ')}`);
    }
    if (currentFilters.due_date_from || currentFilters.due_date_to) {
      const from = currentFilters.due_date_from || 'start';
      const to = currentFilters.due_date_to || 'end';
      summary.push(`Due: ${from} to ${to}`);
    }

    return summary;
  }, [currentFilters]);

  // Check if filters are active (non-default)
  const hasActiveFilters = useMemo(() => {
    return Object.entries(currentFilters).some(([key, value]) => {
      const defaultValue = DEFAULT_FILTERS[key as keyof TaskFilterState];
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== defaultValue;
    });
  }, [currentFilters]);

  // Generate shareable URL with current filters
  const getShareableUrl = useCallback(() => {
    const url = new URL(window.location.href);
    return url.toString();
  }, []);

  // Build API query parameters from filters
  const getApiParams = useCallback(() => {
    const params: Record<string, any> = {};
    
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      
      if (Array.isArray(value) && value.length > 0) {
        params[key] = value;
      } else if (!Array.isArray(value) && value !== DEFAULT_FILTERS[key as keyof TaskFilterState]) {
        params[key] = value;
      }
    });

    return params;
  }, [currentFilters]);

  return {
    // Current state
    filters: currentFilters,
    hasActiveFilters,
    
    // Update methods
    updateFilters,
    setFilter,
    toggleArrayFilter,
    clearFilters,
    applyPreset,
    
    // Utility methods
    getFilterSummary,
    getShareableUrl,
    getApiParams,
    
    // Navigation
    navigate,
  };
}

/**
 * Hook for managing saved filter presets
 */
export function useFilterPresets() {
  const STORAGE_KEY = 'task-filter-presets';

  const getPresets = useCallback((): Record<string, TaskFilterState> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  const savePreset = useCallback((name: string, filters: TaskFilterState) => {
    const presets = getPresets();
    presets[name] = filters;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }, [getPresets]);

  const deletePreset = useCallback((name: string) => {
    const presets = getPresets();
    delete presets[name];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }, [getPresets]);

  const getPreset = useCallback((name: string): TaskFilterState | null => {
    const presets = getPresets();
    return presets[name] || null;
  }, [getPresets]);

  return {
    getPresets,
    savePreset,
    deletePreset,
    getPreset,
  };
}

/**
 * Hook for filter validation and sanitization
 */
export function useFilterValidation() {
  const validateDateRange = useCallback((from?: string, to?: string): boolean => {
    if (!from || !to) return true;
    return new Date(from) <= new Date(to);
  }, []);

  const sanitizeFilters = useCallback((filters: Partial<TaskFilterState>): TaskFilterState => {
    const sanitized: TaskFilterState = { ...DEFAULT_FILTERS };

    // Sanitize string values
    if (filters.search && filters.search.length <= 100) {
      sanitized.search = filters.search.trim();
    }

    // Sanitize arrays with validation
    if (filters.status) {
      sanitized.status = filters.status.filter(s => 
        ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED'].includes(s)
      );
    }

    if (filters.priority) {
      sanitized.priority = filters.priority.filter(p => 
        ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(p)
      );
    }

    // Sanitize pagination
    if (filters.page && filters.page > 0) {
      sanitized.page = Math.min(filters.page, 1000); // Max 1000 pages
    }

    if (filters.limit && filters.limit > 0) {
      sanitized.limit = Math.min(filters.limit, 100); // Max 100 items per page
    }

    // Validate date ranges
    if (filters.due_date_from && filters.due_date_to) {
      if (validateDateRange(filters.due_date_from, filters.due_date_to)) {
        sanitized.due_date_from = filters.due_date_from;
        sanitized.due_date_to = filters.due_date_to;
      }
    } else {
      if (filters.due_date_from) sanitized.due_date_from = filters.due_date_from;
      if (filters.due_date_to) sanitized.due_date_to = filters.due_date_to;
    }

    return sanitized;
  }, [validateDateRange]);

  return {
    validateDateRange,
    sanitizeFilters,
  };
}