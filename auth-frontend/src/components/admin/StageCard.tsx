import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { 
  UserCheck, 
  FileCheck, 
  Settings, 
  CheckCircle,
  Clock,
  MoreVertical,
  Plus,
  Filter,
  Search
} from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import EmployeeReviewCard from './EmployeeReviewCard';
import BulkSelectionToolbar from './BulkSelectionToolbar';
import { Input } from '@/components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { PendingReview } from '@/hooks/queries/useAdminQueries';

interface StageCardProps {
  stage: 'details' | 'documents' | 'roles' | 'final';
  title: string;
  reviews: PendingReview[];
  loading: boolean;
  selectedEmployees: string[];
  searchQuery: string;
  priorityFilter: string;
  onEmployeeSelect: (employeeId: string) => void;
  onEmployeeReview: (employeeId: string) => void;
  onBulkAction: (employeeIds: string[], action: 'approve' | 'reject') => void;
  onSearchChange: (query: string) => void;
  onPriorityFilter: (priority: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const StageCard: React.FC<StageCardProps> = ({
  stage,
  title,
  reviews,
  loading,
  selectedEmployees,
  searchQuery,
  priorityFilter,
  onEmployeeSelect,
  onEmployeeReview,
  onBulkAction,
  onSearchChange,
  onPriorityFilter,
  onSelectAll,
  onDeselectAll,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const stageConfig = {
    details: {
      icon: UserCheck,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800'
    },
    documents: {
      icon: FileCheck,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800'
    },
    roles: {
      icon: Settings,
      color: 'orange',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-800'
    },
    final: {
      icon: CheckCircle,
      color: 'purple',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-800'
    }
  };

  const config = stageConfig[stage];
  const IconComponent = config.icon;

  // Droppable functionality for drag & drop
  const { isOver, setNodeRef } = useDroppable({
    id: `stage-${stage}`,
  });

  // Filter reviews based on search and priority
  const filteredReviews = reviews.filter(review => {
    const matchesSearch = !searchQuery || 
      `${review.employee.first_name} ${review.employee.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.employee.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.employee.position?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPriority = !priorityFilter || priorityFilter === 'all' || review.priority === priorityFilter;
    
    return matchesSearch && matchesPriority;
  });

  const urgentCount = filteredReviews.filter(r => r.priority === 'urgent').length;
  const highPriorityCount = filteredReviews.filter(r => r.priority === 'high').length;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col h-full transition-all duration-200 ${
        isOver ? 'ring-2 ring-blue-300 ring-opacity-50' : ''
      }`}
    >
      <Card className={`flex-1 ${config.borderColor} ${config.bgColor} shadow-sm`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconComponent className={`w-5 h-5 text-${config.color}-600`} />
              <div>
                <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {filteredReviews.length} total
                  </Badge>
                  {urgentCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {urgentCount} urgent
                    </Badge>
                  )}
                  {highPriorityCount > 0 && (
                    <Badge className="text-xs bg-orange-100 text-orange-800">
                      {highPriorityCount} high
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={onSelectAll}>
                    Select All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDeselectAll}>
                    Deselect All
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onPriorityFilter('urgent')}>
                    Show Only Urgent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPriorityFilter('high')}>
                    Show High Priority
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPriorityFilter('all')}>
                    Show All
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-3 pt-3 border-t">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={`Search ${title.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 h-8"
                />
              </div>

              {/* Priority Filter */}
              <div className="flex gap-2">
                {['all', 'urgent', 'high', 'normal', 'low'].map((priority) => (
                  <Button
                    key={priority}
                    size="sm"
                    variant={priorityFilter === priority ? "default" : "outline"}
                    onClick={() => onPriorityFilter(priority)}
                    className="text-xs h-7 capitalize"
                  >
                    {priority}
                  </Button>
                ))}
              </div>

              {/* Bulk Selection Toolbar */}
              {selectedEmployees.length > 0 && (
                <BulkSelectionToolbar
                  selectedCount={selectedEmployees.length}
                  onBulkApprove={() => onBulkAction(selectedEmployees, 'approve')}
                  onBulkReject={() => onBulkAction(selectedEmployees, 'reject')}
                  onDeselectAll={onDeselectAll}
                />
              )}
            </div>
          )}
        </CardHeader>

        {isExpanded && (
          <CardContent className="flex-1 pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <IconComponent className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">
                  {reviews.length === 0 
                    ? `No employees at ${title.toLowerCase()} stage`
                    : 'No employees match current filters'
                  }
                </p>
                {searchQuery && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => onSearchChange('')}
                    className="mt-2"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                <SortableContext
                  items={filteredReviews.map(r => r.employee.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredReviews.map((review) => (
                    <EmployeeReviewCard
                      key={review.employee.id}
                      review={review}
                      stage={stage}
                      isSelected={selectedEmployees.includes(review.employee.id)}
                      onSelect={() => onEmployeeSelect(review.employee.id)}
                      onReview={() => onEmployeeReview(review.employee.id)}
                    />
                  ))}
                </SortableContext>
              </div>
            )}

            {/* Stage Statistics */}
            {!loading && filteredReviews.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>Avg: {Math.round(filteredReviews.reduce((acc, r) => acc + r.days_pending, 0) / filteredReviews.length)} days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                    <span>Oldest: {Math.max(...filteredReviews.map(r => r.days_pending))} days</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default StageCard;