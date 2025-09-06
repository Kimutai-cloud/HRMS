/**
 * Task List View Component
 * Displays a comprehensive list of all tasks with filtering, search, and pagination
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TaskFilters from './TaskFilters';
import TaskStatusBadge from './TaskStatusBadge';
import TaskPriorityIndicator from './TaskPriorityIndicator';
import { useTaskSearch } from '@/hooks/queries/useTaskQueries';
import type { TaskSearchFilters, TaskSummaryResponse } from '@/types/task';
import { 
  Eye, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  User, 
  Calendar,
  MoreHorizontal,
  ArrowUpDown,
  ExternalLink,
  AlertTriangle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TaskListViewProps {
  onViewTask?: (taskId: string) => void;
  onApproveTask?: (taskId: string) => void;
  onRejectTask?: (taskId: string) => void;
  className?: string;
}

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
];

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export const TaskListView: React.FC<TaskListViewProps> = ({
  onViewTask,
  onApproveTask,
  onRejectTask,
  className
}) => {
  const [filters, setFilters] = useState<TaskSearchFilters>({
    page: 1,
    per_page: 20,
    sort_by: 'created_at',
    sort_order: 'desc'
  });

  const { 
    data: searchResult, 
    isLoading, 
    error, 
    refetch 
  } = useTaskSearch(filters);

  const tasks = searchResult?.tasks || [];
  const totalPages = searchResult?.total_pages || 0;
  const totalItems = searchResult?.total_items || 0;
  const currentPage = searchResult?.current_page || 1;
  const hasNext = searchResult?.has_next || false;
  const hasPrev = searchResult?.has_previous || false;

  const handleFiltersChange = (newFilters: TaskSearchFilters) => {
    setFilters(prev => ({ 
      ...prev, 
      ...newFilters, 
      page: 1 // Reset to first page when filters change
    }));
  };

  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({ 
      ...prev, 
      search: searchTerm.trim() || undefined,
      page: 1 
    }));
  };

  const handleSort = (sortBy: string) => {
    setFilters(prev => ({
      ...prev,
      sort_by: sortBy,
      sort_order: prev.sort_by === sortBy && prev.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleItemsPerPageChange = (perPage: number) => {
    setFilters(prev => ({ 
      ...prev, 
      per_page: perPage, 
      page: 1 
    }));
  };

  const handleTaskAction = (action: string, taskId: string) => {
    switch (action) {
      case 'view':
        onViewTask?.(taskId);
        break;
      case 'approve':
        onApproveTask?.(taskId);
        break;
      case 'reject':
        onRejectTask?.(taskId);
        break;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const getOverdueStatus = (dueDate?: string, status?: string) => {
    if (!dueDate || status === 'COMPLETED' || status === 'CANCELLED') return false;
    return new Date(dueDate) < new Date();
  };

  // Memoized pagination items
  const paginationItems = useMemo(() => {
    const items = [];
    const maxVisible = 5;
    const halfVisible = Math.floor(maxVisible / 2);
    
    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, currentPage + halfVisible);
    
    // Adjust range if we're near the beginning or end
    if (endPage - startPage + 1 < maxVisible) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + maxVisible - 1);
      } else {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      items.push(i);
    }
    
    return items;
  }, [currentPage, totalPages]);

  if (isLoading && !tasks.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-2" />
            </div>
            <Skeleton className="h-10 w-96" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load tasks. {' '}
              <Button variant="link" onClick={() => refetch()} className="p-0 h-auto">
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              All Tasks
              <Badge variant="secondary">
                {totalItems} total
              </Badge>
            </CardTitle>
            <CardDescription>
              Comprehensive view of all your created tasks
            </CardDescription>
          </div>
          
          <TaskFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onSearch={handleSearch}
            isLoading={isLoading}
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Table Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={filters.sort_by} onValueChange={handleSort}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort(filters.sort_by || 'created_at')}
              className="h-8 w-8 p-0"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show:</span>
            <Select 
              value={filters.limit?.toString()} 
              onValueChange={(value) => handleItemsPerPageChange(parseInt(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEMS_PER_PAGE_OPTIONS.map(option => (
                  <SelectItem key={option} value={option.toString()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Task Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {filters.search || Object.keys(filters).some(key => key !== 'page' && key !== 'limit' && key !== 'sort_by' && key !== 'sort_order' && filters[key as keyof TaskSearchFilters])
                        ? 'No tasks match your filters.'
                        : 'No tasks created yet.'
                      }
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => {
                  const isOverdue = getOverdueStatus(task.due_date, task.status);
                  
                  return (
                    <TableRow 
                      key={task.id} 
                      className={cn(
                        'hover:bg-muted/50 cursor-pointer',
                        isOverdue && 'bg-red-50 hover:bg-red-100'
                      )}
                      onClick={() => handleTaskAction('view', task.id)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{task.title}</span>
                            {isOverdue && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {task.task_type}
                            </Badge>
                            {task.progress_percentage !== undefined && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {task.progress_percentage}%
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <TaskStatusBadge status={task.status} />
                      </TableCell>
                      
                      <TableCell>
                        <TaskPriorityIndicator priority={task.priority} />
                      </TableCell>
                      
                      <TableCell>
                        {task.assignee_name ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{task.assignee_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className={cn(
                            'text-sm',
                            isOverdue && 'text-red-600 font-medium'
                          )}>
                            {formatDate(task.due_date)}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(task.created_at)}
                        </span>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTaskAction('view', task.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {task.status === 'SUBMITTED' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTaskAction('approve', task.id);
                                }}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTaskAction('reject', task.id);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * (filters.limit || 20)) + 1} to{' '}
              {Math.min(currentPage * (filters.limit || 20), totalItems)} of {totalItems} tasks
            </div>
            
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={!hasPrev ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {paginationItems.map((pageNum, index) => (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => handlePageChange(pageNum)}
                      isActive={pageNum === currentPage}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                {totalPages > Math.max(...paginationItems) && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(currentPage + 1)}
                    className={!hasNext ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
        
        {/* Loading Overlay */}
        {isLoading && tasks.length > 0 && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskListView;