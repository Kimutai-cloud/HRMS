import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Flag, Clock, Play, Upload, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskCommentSystem } from '@/components/tasks/TaskCommentSystem';
import { TaskProgressTracker } from '@/components/tasks/TaskProgressTracker';
import { TaskSubmissionForm } from '@/components/tasks/TaskSubmissionForm';
import { useAuth } from '@/contexts/AuthContext';
import { taskService } from '@/services/serviceFactory';
import { useStartTask, useUpdateTaskProgress, useSubmitTask } from '@/hooks/queries/useTaskQueries';
import { TaskStatus, Priority } from '@/types/task';
import { toast } from '@/hooks/use-toast';

const TaskDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  // Task workflow mutations
  const startTaskMutation = useStartTask();
  const updateProgressMutation = useUpdateTaskProgress();
  const submitTaskMutation = useSubmitTask();

  const { data: task, isLoading, error, refetch } = useQuery({
    queryKey: ['task', id],
    queryFn: () => {
      // Determine user role for correct endpoint
      const isManagerOrAdmin = userProfile?.roles?.some(role => 
        role.role_code === 'MANAGER' || role.role_code === 'ADMIN'
      );
      const userRole = isManagerOrAdmin ? 'MANAGER' : 'EMPLOYEE';
      return taskService.getTaskById(id!, userRole);
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading task details...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-muted-foreground mb-2">Task Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The task you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-500';
      case 'ASSIGNED': return 'bg-blue-500';
      case 'IN_PROGRESS': return 'bg-yellow-500';
      case 'SUBMITTED': return 'bg-purple-500';
      case 'IN_REVIEW': return 'bg-pink-500';
      case 'COMPLETED': return 'bg-green-500';
      case 'CANCELLED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'LOW': return 'bg-green-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'HIGH': return 'bg-orange-500';
      case 'URGENT': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const isAssignedToUser = task.assignee?.id === userProfile?.employee?.id;
  const canSubmit = isAssignedToUser && task.status === 'IN_PROGRESS' && task.progress_percentage === 100;
  const canStart = isAssignedToUser && task.status === 'ASSIGNED';
  const canUpdateProgress = isAssignedToUser && task.status === 'IN_PROGRESS';

  // Task workflow action handlers
  const handleStartTask = async () => {
    try {
      await startTaskMutation.mutateAsync({ taskId: task.id });
      
      toast({
        title: 'Task Started',
        description: 'You have successfully started working on this task.',
      });
      
      refetch(); // Refresh task data
    } catch (error: any) {
      console.error('Failed to start task:', error);
      toast({
        title: 'Failed to Start Task',
        description: error.message || 'Unable to start the task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateProgress = async () => {
    try {
      const request = {
        progress_percentage: 100,
        hours_worked: 1,
        notes: 'Progress updated to 100% from task details'
      };
      
      await updateProgressMutation.mutateAsync({ taskId: task.id, request });
      
      toast({
        title: 'Progress Updated',
        description: 'Task progress has been updated to 100%.',
      });
      
      refetch(); // Refresh task data
    } catch (error: any) {
      console.error('Failed to update progress:', error);
      toast({
        title: 'Failed to Update Progress',
        description: error.message || 'Unable to update progress. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitTask = async () => {
    try {
      const request = {
        submission_notes: 'Task completed and submitted for review from task details page',
        attachments: []
      };
      
      await submitTaskMutation.mutateAsync({ taskId: task.id, request });
      
      toast({
        title: 'Task Submitted',
        description: 'Your task has been submitted for manager review.',
      });
      
      refetch(); // Refresh task data
    } catch (error: any) {
      console.error('Failed to submit task:', error);
      toast({
        title: 'Failed to Submit Task',
        description: error.message || 'Unable to submit the task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button onClick={() => navigate(-1)} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{task.title}</h1>
            <p className="text-muted-foreground">Task #{task.id.slice(-8)}</p>
          </div>
        </div>

        {/* Status and Priority Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge className={`${getStatusColor(task.status)} text-white`}>
            {task.status.replace('_', ' ')}
          </Badge>
          <Badge className={`${getPriorityColor(task.priority)} text-white`}>
            {task.priority}
          </Badge>
          <Badge variant="outline">
            {task.task_type}
          </Badge>
        </div>

        {/* Employee Workflow Actions */}
        {isAssignedToUser && (
          <div className="flex flex-wrap gap-2 mb-4">
            {canStart && (
              <Button 
                onClick={handleStartTask}
                disabled={startTaskMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play className="w-4 h-4 mr-2" />
                {startTaskMutation.isPending ? 'Starting...' : 'Start Task'}
              </Button>
            )}
            
            {canUpdateProgress && task.progress_percentage < 100 && (
              <Button 
                onClick={handleUpdateProgress}
                disabled={updateProgressMutation.isPending}
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {updateProgressMutation.isPending ? 'Updating...' : 'Mark as Complete'}
              </Button>
            )}
            
            {canSubmit && (
              <Button 
                onClick={handleSubmitTask}
                disabled={submitTaskMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                {submitTaskMutation.isPending ? 'Submitting...' : 'Submit for Review'}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {task.description || 'No description provided.'}
              </p>
            </CardContent>
          </Card>

          {/* Progress Tracker */}
          {isAssignedToUser && (
            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskProgressTracker taskId={task.id} />
              </CardContent>
            </Card>
          )}

          {/* Task Submission */}
          {canSubmit && (
            <Card>
              <CardHeader>
                <CardTitle>Submit Task</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskSubmissionForm taskId={task.id} />
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Comments & Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskCommentSystem taskId={task.id} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Assigned to</p>
                  <p className="text-sm text-muted-foreground">
                    {task.assignee ? 
                      task.assignee.full_name || `${task.assignee.first_name} ${task.assignee.last_name}` : 
                      'Unassigned'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Flag className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Department</p>
                  <p className="text-sm text-muted-foreground">
                    {task.department?.name || 'N/A'}
                  </p>
                </div>
              </div>

              {task.due_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Due Date</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              {task.estimated_hours && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Estimated Hours</p>
                    <p className="text-sm text-muted-foreground">
                      {task.estimated_hours} hours
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{task.progress_percentage}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 mt-1">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${task.progress_percentage}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetails;