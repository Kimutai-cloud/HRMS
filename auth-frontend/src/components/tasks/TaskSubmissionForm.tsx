/**
 * Task Submission Form Component
 * Allows employees to submit completed tasks for manager review
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTask, useSubmitTask } from '@/hooks/queries/useTaskQueries';
import { useAuth } from '@/contexts/AuthContext';
import { TaskStatus, type SubmitTaskRequest } from '@/types/task';
import { 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  FileText,
  Calendar,
  User,
  Target,
  Timer
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const submissionSchema = z.object({
  submission_notes: z.string()
    .min(10, 'Please provide at least 10 characters describing the completion')
    .max(2000, 'Notes must be less than 2000 characters'),
  actual_hours: z.number()
    .min(0, 'Hours cannot be negative')
    .max(999, 'Hours cannot exceed 999')
    .optional()
});

type SubmissionFormData = z.infer<typeof submissionSchema>;

interface TaskSubmissionFormProps {
  taskId: string;
  onSubmissionSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

const TaskSummarySection: React.FC<{
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, children, icon }) => (
  <div className="space-y-2">
    <h4 className="text-sm font-medium flex items-center gap-2">
      {icon}
      {title}
    </h4>
    <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
      {children}
    </div>
  </div>
);

export const TaskSubmissionForm: React.FC<TaskSubmissionFormProps> = ({
  taskId,
  onSubmissionSuccess,
  onCancel,
  className
}) => {
  const { userProfile } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formData, setFormData] = useState<SubmissionFormData | null>(null);

  const { data: task, isLoading, error } = useTask(taskId);
  const submitTaskMutation = useSubmitTask();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue
  } = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      submission_notes: '',
      actual_hours: task?.actual_hours || undefined
    }
  });

  const watchedHours = watch('actual_hours');

  // Update form when task data changes
  React.useEffect(() => {
    if (task?.actual_hours) {
      setValue('actual_hours', task.actual_hours);
    }
  }, [task, setValue]);

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
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-32 bg-muted rounded" />
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

  const canSubmit = task.status === TaskStatus.IN_PROGRESS && 
    task.assignee_id === userProfile?.employee?.id &&
    task.progress_percentage === 100;

  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
  const timeEstimateVariance = task.estimated_hours && watchedHours 
    ? ((watchedHours - task.estimated_hours) / task.estimated_hours * 100)
    : null;

  const onFormSubmit = (data: SubmissionFormData) => {
    setFormData(data);
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmission = async () => {
    if (!formData) return;

    try {
      const submissionData: SubmitTaskRequest = {
        submission_notes: formData.submission_notes,
        actual_hours: formData.actual_hours
      };

      await submitTaskMutation.mutateAsync({ taskId, request: submissionData });
      
      toast.success('Task submitted successfully!', {
        description: 'Your task has been submitted for manager review.'
      });

      setShowConfirmDialog(false);
      onSubmissionSuccess?.();
    } catch (error: any) {
      toast.error('Failed to submit task', {
        description: error.message
      });
      setShowConfirmDialog(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Submit Task for Review
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Task Summary */}
          <div className="space-y-4">
            <h3 className="font-medium">Task Summary</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <TaskSummarySection 
                title="Progress" 
                icon={<Target className="w-4 h-4" />}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Completion</span>
                    <Badge variant={task.progress_percentage === 100 ? "default" : "secondary"}>
                      {task.progress_percentage}%
                    </Badge>
                  </div>
                  <Progress value={task.progress_percentage} className="h-2" />
                </div>
              </TaskSummarySection>

              <TaskSummarySection 
                title="Time Tracking" 
                icon={<Timer className="w-4 h-4" />}
              >
                <div className="space-y-1">
                  {task.estimated_hours && (
                    <div className="flex justify-between">
                      <span>Estimated:</span>
                      <span className="font-medium">{task.estimated_hours}h</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Actual:</span>
                    <span className="font-medium">{task.actual_hours || 0}h</span>
                  </div>
                  {timeEstimateVariance !== null && (
                    <div className="flex justify-between">
                      <span>Variance:</span>
                      <span className={cn(
                        'font-medium text-sm',
                        timeEstimateVariance > 20 ? 'text-red-600' :
                        timeEstimateVariance > 0 ? 'text-yellow-600' :
                        'text-green-600'
                      )}>
                        {timeEstimateVariance > 0 ? '+' : ''}{timeEstimateVariance.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </TaskSummarySection>
            </div>

            {task.due_date && (
              <TaskSummarySection 
                title="Due Date" 
                icon={<Calendar className="w-4 h-4" />}
              >
                <div className={cn(
                  'font-medium',
                  isOverdue && 'text-red-600'
                )}>
                  {format(new Date(task.due_date), 'MMM d, yyyy \'at\' h:mm a')}
                  {isOverdue && (
                    <span className="ml-2 text-red-600">
                      (Overdue by {formatDistanceToNow(new Date(task.due_date))})
                    </span>
                  )}
                </div>
              </TaskSummarySection>
            )}
          </div>

          {/* Submission Requirements Check */}
          <div className="space-y-4">
            <h3 className="font-medium">Submission Requirements</h3>
            
            <div className="space-y-2">
              <div className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                task.progress_percentage === 100 
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              )}>
                {task.progress_percentage === 100 ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">
                  Task must be 100% complete
                  {task.progress_percentage === 100 
                    ? ' ✓ Complete' 
                    : ` (Currently ${task.progress_percentage}%)`}
                </span>
              </div>

              <div className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                task.assignee_id === userProfile?.employee?.id
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              )}>
                {task.assignee_id === userProfile?.employee?.id ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium">
                  Task must be assigned to you
                  {task.assignee_id === userProfile?.employee?.id ? ' ✓ Verified' : ' ✗ Not assigned'}
                </span>
              </div>
            </div>
          </div>

          {!canSubmit && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {task.progress_percentage < 100 && 
                  `Task must be 100% complete before submission (currently ${task.progress_percentage}%).`}
                {task.assignee_id !== userProfile?.employee?.id && 
                  'You can only submit tasks that are assigned to you.'}
                {task.status !== TaskStatus.IN_PROGRESS && 
                  `Task status must be "In Progress" to submit (currently ${task.status}).`}
              </AlertDescription>
            </Alert>
          )}

          {canSubmit && (
            <>
              <Separator />
              
              {/* Submission Form */}
              <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="submission_notes">
                    Completion Summary *
                  </Label>
                  <Textarea
                    id="submission_notes"
                    {...register('submission_notes')}
                    placeholder="Describe what you've completed, any challenges faced, and key outcomes achieved..."
                    rows={4}
                    className={cn(
                      'mt-2 resize-vertical',
                      errors.submission_notes && 'border-red-500'
                    )}
                  />
                  {errors.submission_notes && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.submission_notes.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum 10 characters required
                  </p>
                </div>

                <div>
                  <Label htmlFor="actual_hours">
                    Final Time Spent (hours)
                  </Label>
                  <Input
                    id="actual_hours"
                    type="number"
                    step="0.5"
                    min="0"
                    max="999"
                    {...register('actual_hours', { valueAsNumber: true })}
                    placeholder="e.g., 8.5"
                    className={cn(
                      'mt-2',
                      errors.actual_hours && 'border-red-500'
                    )}
                  />
                  {errors.actual_hours && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.actual_hours.message}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  {onCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onCancel}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-w-[140px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Submit for Review
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Task for Review?</DialogTitle>
            <DialogDescription>
              Once submitted, this task will be sent to your manager for review. 
              You won't be able to make further changes until it's reviewed.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="bg-muted/50 p-3 rounded">
              <h4 className="font-medium mb-2">Task: {task.title}</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Progress: {task.progress_percentage}%</div>
                {formData?.actual_hours && (
                  <div>Time Spent: {formData.actual_hours} hours</div>
                )}
                <div>Due: {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No due date'}</div>
              </div>
            </div>
            
            {formData?.submission_notes && (
              <div className="bg-muted/50 p-3 rounded">
                <h4 className="font-medium mb-2">Your Summary:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {formData.submission_notes}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={submitTaskMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSubmission}
              disabled={submitTaskMutation.isPending}
            >
              {submitTaskMutation.isPending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Confirm Submission
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TaskSubmissionForm;