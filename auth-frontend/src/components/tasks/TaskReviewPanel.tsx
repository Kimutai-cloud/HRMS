/**
 * Task Review Panel Component
 * Allows managers to review, approve, or reject submitted tasks
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import TaskStatusBadge from './TaskStatusBadge';
import TaskPriorityIndicator from './TaskPriorityIndicator';
import { useTask, useReviewTask, useTaskActivities } from '@/hooks/queries/useTaskQueries';
import { type ReviewTaskRequest, TaskStatus } from '@/types/task';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  Building, 
  Tag,
  MessageSquare,
  Activity,
  AlertTriangle,
  FileText,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  review_notes: z.string().optional(),
  reason: z.string().optional(),
}).refine((data) => {
  if (data.action === 'reject' && !data.reason?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Rejection reason is required when rejecting a task",
  path: ["reason"]
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface TaskReviewPanelProps {
  taskId: string;
  onReviewComplete?: (action: 'approve' | 'reject') => void;
  onClose?: () => void;
  className?: string;
}

const TaskDetailSection: React.FC<{
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, children, icon }) => (
  <div className="space-y-2">
    <h4 className="text-sm font-medium flex items-center gap-2">
      {icon}
      {title}
    </h4>
    <div className="text-sm text-muted-foreground">
      {children}
    </div>
  </div>
);

export const TaskReviewPanel: React.FC<TaskReviewPanelProps> = ({
  taskId,
  onReviewComplete,
  onClose,
  className
}) => {
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: task, isLoading, error } = useTask(taskId);
  const { data: activities } = useTaskActivities(taskId);
  const reviewMutation = useReviewTask();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      action: 'approve',
      review_notes: '',
      reason: ''
    }
  });

  const watchedAction = watch('action');

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="animate-pulse space-y-2">
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !task) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load task details. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const canReview = task.status === TaskStatus.SUBMITTED || task.status === TaskStatus.IN_REVIEW;
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const isCancelled = task.status === TaskStatus.CANCELLED;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const onSubmit = async (data: ReviewFormData) => {
    setReviewAction(data.action);
    setShowConfirmDialog(true);
  };

  const handleConfirmReview = async () => {
    if (!reviewAction) return;

    try {
      const formData = watch();
      const reviewData: ReviewTaskRequest = {
        approved: reviewAction === 'approve',
        review_notes: formData.review_notes || (reviewAction === 'reject' ? formData.reason : undefined)
      };

      await reviewMutation.mutateAsync({ taskId, request: reviewData });
      
      toast.success(
        reviewAction === 'approve' ? 'Task approved successfully!' : 'Task rejected and sent back for revision',
        {
          description: `The task has been ${reviewAction === 'approve' ? 'approved and marked as completed' : 'rejected and returned to the employee'}.`
        }
      );

      setShowConfirmDialog(false);
      onReviewComplete?.(reviewAction);
    } catch (error: any) {
      console.error('Failed to review task:', error);
      toast.error('Failed to review task', {
        description: error.message || 'An unexpected error occurred.'
      });
      setShowConfirmDialog(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy \'at\' h:mm a');
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Task Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl mb-2 leading-tight">
                {task.title}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <TaskStatusBadge status={task.status} />
                <TaskPriorityIndicator priority={task.priority} />
                <Badge variant="outline">
                  {task.task_type}
                </Badge>
              </div>
            </div>
            
            {(isCompleted || isCancelled) && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium',
                isCompleted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              )}>
                {isCompleted ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Completed
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" />
                    Cancelled
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Progress</Label>
              <span className="text-sm font-medium">{task.progress_percentage}%</span>
            </div>
            <Progress value={task.progress_percentage} className="h-3" />
          </div>

          {/* Task Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {task.assignee_id && (
                <TaskDetailSection title="Assigned To" icon={<User className="w-4 h-4" />}>
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-xs">
                        {getInitials(task.assignee?.name || 'Unknown')}
                      </AvatarFallback>
                    </Avatar>
                    <span>{task.assignee?.name || 'Unknown Employee'}</span>
                  </div>
                </TaskDetailSection>
              )}

              <TaskDetailSection title="Department" icon={<Building className="w-4 h-4" />}>
                {task.department?.name} ({task.department?.code})
              </TaskDetailSection>

              {task.estimated_hours && (
                <TaskDetailSection title="Estimated Time" icon={<Clock className="w-4 h-4" />}>
                  {task.estimated_hours} hours
                  {task.actual_hours && (
                    <span className="ml-2 text-xs">
                      (Actual: {task.actual_hours}h)
                    </span>
                  )}
                </TaskDetailSection>
              )}
            </div>

            <div className="space-y-4">
              <TaskDetailSection title="Created" icon={<Calendar className="w-4 h-4" />}>
                {formatDate(task.created_at)}
              </TaskDetailSection>

              {task.due_date && (
                <TaskDetailSection title="Due Date" icon={<Calendar className="w-4 h-4" />}>
                  <span className={cn(
                    new Date(task.due_date) < new Date() && task.status !== TaskStatus.COMPLETED && 'text-red-600 font-medium'
                  )}>
                    {formatDate(task.due_date)}
                    {new Date(task.due_date) < new Date() && task.status !== TaskStatus.COMPLETED && ' (Overdue)'}
                  </span>
                </TaskDetailSection>
              )}

              {task.tags && task.tags.length > 0 && (
                <TaskDetailSection title="Tags" icon={<Tag className="w-4 h-4" />}>
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TaskDetailSection>
              )}
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <>
              <Separator />
              <TaskDetailSection title="Description" icon={<FileText className="w-4 h-4" />}>
                <div className="whitespace-pre-wrap bg-muted/30 p-3 rounded text-sm">
                  {task.description}
                </div>
              </TaskDetailSection>
            </>
          )}
        </CardContent>
      </Card>

      {/* Review Form */}
      {canReview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Review Task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Review Decision</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant={watchedAction === 'approve' ? 'default' : 'outline'}
                    onClick={() => setValue('action', 'approve')}
                    className="flex-1"
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Approve & Complete
                  </Button>
                  <Button
                    type="button"
                    variant={watchedAction === 'reject' ? 'destructive' : 'outline'}
                    onClick={() => setValue('action', 'reject')}
                    className="flex-1"
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Request Changes
                  </Button>
                </div>
              </div>

              {watchedAction === 'reject' && (
                <div>
                  <Label htmlFor="reason">Reason for Changes *</Label>
                  <Textarea
                    id="reason"
                    {...register('reason')}
                    placeholder="Explain what needs to be changed or improved..."
                    className={errors.reason ? 'border-red-500' : ''}
                  />
                  {errors.reason && (
                    <p className="text-sm text-red-500 mt-1">{errors.reason.message}</p>
                  )}
                </div>
              )}

              <div>
                <Label htmlFor="review_notes">Additional Notes</Label>
                <Textarea
                  id="review_notes"
                  {...register('review_notes')}
                  placeholder="Any additional feedback or comments..."
                />
              </div>

              <div className="flex justify-end gap-2">
                {onClose && (
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `${watchedAction === 'approve' ? 'Approve' : 'Request Changes'}`
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Recent Activities */}
      {activities && activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 w-5" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.slice(0, 10).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{activity.performed_by.name}</span>{' '}
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? 'Approve Task?' : 'Request Changes?'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve' 
                ? 'This will mark the task as completed and notify the employee.'
                : 'This will send the task back to the employee for revision.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-muted/50 p-3 rounded">
              <h4 className="font-medium mb-1">Task: {task.title}</h4>
              <p className="text-sm text-muted-foreground">
                Assigned to: {task.assignee?.name}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={reviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReview}
              disabled={reviewMutation.isPending}
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
            >
              {reviewMutation.isPending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Confirm ${reviewAction === 'approve' ? 'Approval' : 'Changes'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Display */}
      {reviewMutation.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {reviewMutation.error.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default TaskReviewPanel;