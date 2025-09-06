/**
 * Task Filters Component
 * Provides filtering and search functionality for task management
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { 
  Filter, 
  Search, 
  X, 
  Calendar as CalendarIcon,
  Users,
  Tag,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { TaskStatus, Priority, TaskType, type TaskSearchFilters } from '@/types/task';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TaskFiltersProps {
  filters: TaskSearchFilters;
  onFiltersChange: (filters: TaskSearchFilters) => void;
  onSearch: (searchTerm: string) => void;
  isLoading?: boolean;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', icon: '📝', color: 'bg-gray-100 text-gray-800' },
  { value: 'ASSIGNED', label: 'Assigned', icon: '👤', color: 'bg-blue-100 text-blue-800' },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: '⚡', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'SUBMITTED', label: 'Submitted', icon: '📤', color: 'bg-purple-100 text-purple-800' },
  { value: 'IN_REVIEW', label: 'In Review', icon: '👀', color: 'bg-pink-100 text-pink-800' },
  { value: 'COMPLETED', label: 'Completed', icon: '✅', color: 'bg-green-100 text-green-800' },
  { value: 'CANCELLED', label: 'Cancelled', icon: '❌', color: 'bg-red-100 text-red-800' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low', icon: '🔽', color: 'bg-green-100 text-green-800' },
  { value: 'MEDIUM', label: 'Medium', icon: '➡️', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HIGH', label: 'High', icon: '🔼', color: 'bg-orange-100 text-orange-800' },
  { value: 'URGENT', label: 'Urgent', icon: '🚨', color: 'bg-red-100 text-red-800' },
];

const TYPE_OPTIONS = [
  { value: 'PROJECT', label: 'Project', icon: '📊' },
  { value: 'TASK', label: 'Task', icon: '📋' },
  { value: 'SUBTASK', label: 'Subtask', icon: '📄' },
];

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  isLoading = false,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
    onFiltersChange({ ...filters, search: searchTerm.trim() || undefined });
  };

  const handleFilterChange = (key: keyof TaskSearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    onFiltersChange(newFilters);
  };

  const handleMultiSelectChange = (key: keyof TaskSearchFilters, value: string, checked: boolean) => {
    const currentValues = (filters[key] as string[]) || [];
    const newValues = checked 
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    
    handleFilterChange(key, newValues.length > 0 ? newValues : undefined);
  };

  const clearFilters = () => {
    setSearchTerm('');
    onFiltersChange({});
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status?.length) count++;
    if (filters.priority?.length) count++;
    if (filters.task_type?.length) count++;
    if (filters.due_date_from || filters.due_date_to) count++;
    if (filters.created_from || filters.created_to) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            maxLength={100}
          />
          {searchTerm && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => {
                setSearchTerm('');
                onSearch('');
                onFiltersChange({ ...filters, search: undefined });
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </form>

      {/* Filter Sheet */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge 
                variant="secondary" 
                className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Tasks
            </SheetTitle>
            <SheetDescription>
              Narrow down your task list with filters
            </SheetDescription>
          </SheetHeader>

          <div className="py-6">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-6 pr-4">
                
                {/* Status Filter */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                    <Label className="font-medium">Status</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <div key={status.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status.value}`}
                          checked={filters.status?.includes(status.value as TaskStatus) || false}
                          onCheckedChange={(checked) => 
                            handleMultiSelectChange('status', status.value, checked as boolean)
                          }
                        />
                        <Label htmlFor={`status-${status.value}`} className="flex items-center gap-1 text-sm">
                          <span>{status.icon}</span>
                          {status.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Priority Filter */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    <Label className="font-medium">Priority</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITY_OPTIONS.map((priority) => (
                      <div key={priority.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`priority-${priority.value}`}
                          checked={filters.priority?.includes(priority.value as Priority) || false}
                          onCheckedChange={(checked) => 
                            handleMultiSelectChange('priority', priority.value, checked as boolean)
                          }
                        />
                        <Label htmlFor={`priority-${priority.value}`} className="flex items-center gap-1 text-sm">
                          <span>{priority.icon}</span>
                          {priority.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Type Filter */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <Label className="font-medium">Task Type</Label>
                  </div>
                  <div className="space-y-2">
                    {TYPE_OPTIONS.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type.value}`}
                          checked={filters.task_type?.includes(type.value as TaskType) || false}
                          onCheckedChange={(checked) => 
                            handleMultiSelectChange('task_type', type.value, checked as boolean)
                          }
                        />
                        <Label htmlFor={`type-${type.value}`} className="flex items-center gap-1 text-sm">
                          <span>{type.icon}</span>
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Date Range Filter */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    <Label className="font-medium">Due Date Range</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="due-from" className="text-xs text-muted-foreground">From</Label>
                      <Input
                        id="due-from"
                        type="date"
                        value={filters.due_date_from || ''}
                        onChange={(e) => handleFilterChange('due_date_from', e.target.value || undefined)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="due-to" className="text-xs text-muted-foreground">To</Label>
                      <Input
                        id="due-to"
                        type="date"
                        value={filters.due_date_to || ''}
                        onChange={(e) => handleFilterChange('due_date_to', e.target.value || undefined)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Created Date Range */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    <Label className="font-medium">Created Date Range</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="created-from" className="text-xs text-muted-foreground">From</Label>
                      <Input
                        id="created-from"
                        type="date"
                        value={filters.created_from || ''}
                        onChange={(e) => handleFilterChange('created_from', e.target.value || undefined)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="created-to" className="text-xs text-muted-foreground">To</Label>
                      <Input
                        id="created-to"
                        type="date"
                        value={filters.created_to || ''}
                        onChange={(e) => handleFilterChange('created_to', e.target.value || undefined)}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </ScrollArea>

            {/* Filter Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
              >
                Clear All
              </Button>
              <div className="text-sm text-muted-foreground">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Active Filter Summary */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                  setSearchTerm('');
                  onSearch('');
                  onFiltersChange({ ...filters, search: undefined });
                }}
              />
            </Badge>
          )}
          {filters.status?.length && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status.length}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('status', undefined)}
              />
            </Badge>
          )}
          {filters.priority?.length && (
            <Badge variant="secondary" className="gap-1">
              Priority: {filters.priority.length}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleFilterChange('priority', undefined)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskFilters;