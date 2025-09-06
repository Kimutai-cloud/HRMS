import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Clock, 
  Mail, 
  MapPin,
  Briefcase,
  Calendar,
  FileText,
  Eye,
  CheckCircle,
  AlertTriangle,
  Timer,
  Building,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PendingReview } from '@/hooks/queries/useAdminQueries';

interface EmployeeReviewCardProps {
  review: PendingReview;
  stage: 'details' | 'documents' | 'roles' | 'final';
  isSelected: boolean;
  onSelect: () => void;
  onReview: () => void;
}

const EmployeeReviewCard: React.FC<EmployeeReviewCardProps> = ({
  review,
  stage,
  isSelected,
  onSelect,
  onReview,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const employee = review.employee;

  // Drag and drop functionality
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: employee.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'normal': return 'bg-blue-500 text-white';
      case 'low': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getCompletionPercentage = () => {
    return employee.profile_completion_percentage || 0;
  };

  const getDocumentsSummary = () => {
    if (stage !== 'documents' || !review.documents_summary) return null;
    const { approved_documents, pending_documents, rejected_documents, total_documents } = review.documents_summary;
    return { approved: approved_documents, pending: pending_documents, rejected: rejected_documents, total: total_documents };
  };

  return (
    <TooltipProvider>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`${isDragging ? 'opacity-50 rotate-2' : ''} transition-all duration-200`}
      >
        <Card 
          className={`group cursor-pointer transition-all duration-200 hover:shadow-md ${
            isSelected ? 'ring-2 ring-primary ring-opacity-50 bg-primary/5' : 'hover:bg-muted/30'
          } ${isDragging ? 'shadow-xl z-50' : ''}`}
        >
          <CardContent className="p-4">
            {/* Main Card Content */}
            <div className="flex items-center gap-3">
              {/* Selection Checkbox */}
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onSelect}
                  className="rounded"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Drag Handle (invisible but functional) */}
              <div
                {...listeners}
                className="flex-shrink-0 w-2 h-8 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-30 hover:opacity-60 bg-muted-foreground rounded-sm transition-opacity"
                title="Drag to move between stages"
              />

              {/* Employee Avatar */}
              <div className="flex-shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={employee.profile_image_url} alt={employee.first_name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(employee.first_name, employee.last_name)}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Employee Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold truncate">
                      {employee.first_name} {employee.last_name}
                    </h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {employee.position} • {employee.department}
                    </p>
                  </div>

                  {/* Priority Badge */}
                  <Badge className={`${getPriorityColor(review.priority)} text-xs px-2 py-0.5`}>
                    {review.priority}
                  </Badge>
                </div>

                {/* Quick Stats Row */}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{review.days_pending}d</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Pending for {review.days_pending} days</p>
                    </TooltipContent>
                  </Tooltip>

                  {stage === 'details' && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>{getCompletionPercentage()}%</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Profile {getCompletionPercentage()}% complete</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {stage === 'documents' && getDocumentsSummary() && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span>{getDocumentsSummary()?.approved}/{getDocumentsSummary()?.total}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{getDocumentsSummary()?.approved} of {getDocumentsSummary()?.total} documents approved</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {employee.start_date && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(employee.start_date), 'MMM dd')}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Start date: {format(new Date(employee.start_date), 'MMM dd, yyyy')}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>

                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReview();
                  }}
                  className="h-8 px-3 text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Review
                </Button>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t space-y-3 text-sm">
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h5 className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                      Contact
                    </h5>
                    {employee.email && (
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="truncate">{employee.email}</span>
                      </div>
                    )}
                    {employee.phone_number && (
                      <div className="flex items-center gap-2 text-xs">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span>{employee.phone_number}</span>
                      </div>
                    )}
                    {(employee.city || employee.state) && (
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="truncate">
                          {employee.city && employee.state ? `${employee.city}, ${employee.state}` : (employee.city || employee.state)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                      Employment
                    </h5>
                    <div className="flex items-center gap-2 text-xs">
                      <Briefcase className="w-3 h-3 text-muted-foreground" />
                      <span>{employee.employment_type || 'Full-time'}</span>
                    </div>
                    {employee.work_location && (
                      <div className="flex items-center gap-2 text-xs">
                        <Building className="w-3 h-3 text-muted-foreground" />
                        <span>{employee.work_location}</span>
                      </div>
                    )}
                    {employee.hire_date && (
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span>Hired {formatDistanceToNow(new Date(employee.hire_date))} ago</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stage-Specific Details */}
                {stage === 'documents' && getDocumentsSummary() && (
                  <div className="pt-2 border-t">
                    <h5 className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Document Status
                    </h5>
                    <div className="flex gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{getDocumentsSummary()?.approved} Approved</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span>{getDocumentsSummary()?.pending} Pending</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>{getDocumentsSummary()?.rejected} Rejected</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Priority and Urgency Indicators */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Timer className="w-3 h-3 text-muted-foreground" />
                      <span>Priority: <span className="capitalize font-medium">{review.priority}</span></span>
                    </div>
                    {review.days_pending > 7 && (
                      <div className="flex items-center gap-1 text-orange-600">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Overdue</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default EmployeeReviewCard;