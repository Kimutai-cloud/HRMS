/**
 * Task Progress Tracker Component
 * Allows employees to update task progress with notes and time tracking
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useTask, useUpdateTaskProgress, useStartTask } from '@/hooks/queries/useTaskQueries';
import { useAuth } from '@/contexts/AuthContext';
import { TaskStatus } from '@/types/task';
import type { UpdateTaskProgressRequest } from '@/types/task';
import { 
  Play, 
  Clock, 
  TrendingUp, 
  CheckCircle, 
  AlertTriangle,
  Calendar,
  Timer,
  Save,
  Target
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const progressSchema = z.object({
  progress_percentage: z.number()
    .min(0, 'Progress cannot be negative')
    .max(100, 'Progress cannot exceed 100%'),
  notes: z.string().optional(),
  actual_hours: z.number()
    .min(0, 'Hours cannot be negative')
    .max(999, 'Hours cannot exceed 999')
    .optional()
});

type ProgressFormData = z.infer<typeof progressSchema>;

interface TaskProgressTrackerProps {
  taskId: string;
  onProgressUpdate?: (progress: number) => void;
  onTaskStart?: () => void;
  className?: string;
}

const ProgressMilestone: React.FC<{
  percentage: number;
  label: string;
  icon: React.ReactNode;
  achieved: boolean;
  current?: boolean;
}> = ({ percentage, label, icon, achieved, current }) => {
  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
      achieved && 'bg-green-50 border-green-200',
      current && 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20',
      !achieved && !current && 'bg-muted/30 border-muted'
    )}>
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        achieved && 'bg-green-500 text-white',
        current && 'bg-blue-500 text-white',
        !achieved && !current && 'bg-muted text-muted-foreground'
      )}>
        {achieved ? <CheckCircle className="w-4 h-4" /> : icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{percentage}%</div>
      </div>
    </div>
  );
};

const TimeTracker: React.FC<{
  estimatedHours?: number;
  actualHours?: number;
  onTimeUpdate: (hours: number) => void;
  disabled?: boolean;
}> = ({ estimatedHours, actualHours, onTimeUpdate, disabled }) => {
  const [timeInput, setTimeInput] = useState(actualHours?.toString() || '');

  const handleTimeSubmit = () => {
    const hours = parseFloat(timeInput);
    if (!isNaN(hours) && hours >= 0) {
      onTimeUpdate(hours);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 text-sm">
        {estimatedHours && (
          <div>
            <Label className="text-muted-foreground">Estimated</Label>
            <div className="font-medium">{estimatedHours}h</div>
          </div>
        )}
        <div>
          <Label className="text-muted-foreground">Actual</Label>
          <div className="font-medium">{actualHours || 0}h</div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Input
          type="number"
          step="0.5"
          min="0"
          max="999"
          placeholder="Hours spent"
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
          className="flex-1"
          disabled={disabled}
        />
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleTimeSubmit}
          disabled={disabled || !timeInput}
        >
          <Timer className="w-4 h-4 mr-2" />
          Update
        </Button>
      </div>
    </div>
  );
};

export const TaskProgressTracker: React.FC<TaskProgressTrackerProps> = ({
  taskId,
  onProgressUpdate,
  onTaskStart,
  className
}) => {
  const { userProfile } = useAuth();
  const [showProgressForm, setShowProgressForm] = useState(false);

  const { data: task, isLoading, error } = useTask(taskId);
  const updateProgressMutation = useUpdateTaskProgress();
  const startTaskMutation = useStartTask();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset
  } = useForm<ProgressFormData>({
    resolver: zodResolver(progressSchema),
    defaultValues: {
      progress_percentage: task?.progress_percentage || 0,
      notes: '',
      actual_hours: task?.actual_hours || 0
    }
  });

  const watchedProgress = watch('progress_percentage');

  // Update form when task data changes
  React.useEffect(() => {
    if (task) {
      setValue('progress_percentage', task.progress_percentage);
      setValue('actual_hours', task.actual_hours || 0);
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
            <div className="h-16 bg-muted rounded" />
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

  const canUpdateProgress = task.status === TaskStatus.IN_PROGRESS && 
    task.assignee_id === userProfile?.employee?.id;
  const canStartTask = task.status === TaskStatus.ASSIGNED && 
    task.assignee_id === userProfile?.employee?.id;

  const handleStartTask = async () => {
    try {
      await startTaskMutation.mutateAsync({ 
        taskId, 
        notes: 'Task started by employee' 
      });
      toast.success('Task started successfully!');
      onTaskStart?.();
    } catch (error: any) {
      toast.error('Failed to start task', {
        description: error.message
      });
    }
  };

  const handleProgressUpdate = async (data: ProgressFormData) => {
    try {
      const updateData: UpdateTaskProgressRequest = {
        progress_percentage: data.progress_percentage,
        notes: data.notes || undefined,
        actual_hours: data.actual_hours || undefined
      };

      await updateProgressMutation.mutateAsync({ taskId, request: updateData });
      
      toast.success('Progress updated successfully!');
      onProgressUpdate?.(data.progress_percentage);
      setShowProgressForm(false);
      reset();
    } catch (error: any) {
      toast.error('Failed to update progress', {
        description: error.message
      });
    }
  };

  const handleTimeUpdate = (hours: number) => {
    setValue('actual_hours', hours);
    handleSubmit(handleProgressUpdate)();
  };

  const milestones = [
    { percentage: 0, label: 'Not Started', icon: <Play className="w-4 h-4" /> },
    { percentage: 25, label: 'In Progress', icon: <TrendingUp className="w-4 h-4" /> },
    { percentage: 50, label: 'Half Complete', icon: <Target className="w-4 h-4" /> },
    { percentage: 75, label: 'Nearly Done', icon: <TrendingUp className="w-4 h-4" /> },
    { percentage: 100, label: 'Completed', icon: <CheckCircle className="w-4 h-4" /> }
  ];

  const getCurrentMilestone = (progress: number) => {
    if (progress === 0) return 0;
    if (progress <= 25) return 1;
    if (progress <= 50) return 2;
    if (progress <= 75) return 3;
    return 4;
  };

  const currentMilestone = getCurrentMilestone(task.progress_percentage);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && 
    task.status !== TaskStatus.COMPLETED;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Progress Tracking
          </div>
          <Badge variant="outline" className="font-mono">
            {task.progress_percentage}%
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Overview */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Overall Progress</Label>
              <span className="text-sm font-medium">{task.progress_percentage}%</span>
            </div>
            <Progress value={task.progress_percentage} className="h-3" />
          </div>

          {/* Due Date Alert */}
          {isOverdue && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This task was due {formatDistanceToNow(new Date(task.due_date!), { addSuffix: true })}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Progress Milestones */}
        <div>
          <Label className="text-sm font-medium mb-3 block">Milestones</Label>
          <div className="grid gap-2">
            {milestones.map((milestone, index) => (
              <ProgressMilestone
                key={milestone.percentage}
                percentage={milestone.percentage}
                label={milestone.label}
                icon={milestone.icon}
                achieved={task.progress_percentage >= milestone.percentage}
                current={index === currentMilestone}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* Time Tracking */}
        <div>
          <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Time Tracking
          </Label>
          <TimeTracker
            estimatedHours={task.estimated_hours}
            actualHours={task.actual_hours}
            onTimeUpdate={handleTimeUpdate}
            disabled={!canUpdateProgress}
          />
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-4">
          {canStartTask && (
            <Button
              onClick={handleStartTask}
              disabled={startTaskMutation.isPending}
              className="w-full"
            >
              {startTaskMutation.isPending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Working on Task
                </>
              )}
            </Button>
          )}

          {canUpdateProgress && (
            <>
              {!showProgressForm ? (
                <Button
                  variant="outline"
                  onClick={() => setShowProgressForm(true)}
                  className="w-full"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Update Progress
                </Button>
              ) : (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <h4 className="font-medium">Update Progress</h4>
                  
                  <form onSubmit={handleSubmit(handleProgressUpdate)} className="space-y-4">
                    <div>
                      <Label htmlFor="progress">Progress Percentage</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <Input
                          id="progress"
                          type="number"
                          min="0"
                          max="100"
                          {...register('progress_percentage', { valueAsNumber: true })}
                          className={errors.progress_percentage ? 'border-red-500' : ''}
                        />
                        <div className="text-sm font-mono min-w-0">
                          {watchedProgress}%
                        </div>
                      </div>
                      {errors.progress_percentage && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.progress_percentage.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="notes">Progress Notes</Label>
                      <Textarea
                        id="notes"
                        {...register('notes')}
                        placeholder="Describe what you've accomplished..."
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowProgressForm(false);
                          reset();
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1"
                      >
                        {isSubmitting ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Update Progress
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {!canStartTask && !canUpdateProgress && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {task.status === TaskStatus.DRAFT && 'This task is still in draft mode.'}
                {task.status === TaskStatus.ASSIGNED && task.assignee_id !== userProfile?.employee?.id && 'This task is assigned to someone else.'}
                {task.status === TaskStatus.SUBMITTED && 'This task is submitted and awaiting review.'}
                {task.status === TaskStatus.IN_REVIEW && 'This task is currently under review.'}
                {task.status === TaskStatus.COMPLETED && 'This task has been completed.'}
                {task.status === TaskStatus.CANCELLED && 'This task has been cancelled.'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskProgressTracker;