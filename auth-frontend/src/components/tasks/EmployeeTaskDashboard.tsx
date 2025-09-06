/**
 * Employee Task Dashboard Component
 * Personal dashboard for employees to view and manage their assigned tasks
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TaskCard from './TaskCard';
import TaskStatusBadge from './TaskStatusBadge';
import TaskPriorityIndicator from './TaskPriorityIndicator';
import { useEmployeeDashboard, useAssignedTasks, useStartTask, useUpdateTaskProgress, useSubmitTask } from '@/hooks/queries/useTaskQueries';
import { TaskStatus, Priority } from '@/types/task';
import { 
  ClipboardList, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Activity,
  Filter,
  Calendar,
  User,
  Play,
  Upload,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface EmployeeTaskDashboardProps {
  onViewTask?: (taskId: string) => void;
  onStartTask?: (taskId: string) => void;
  onSubmitTask?: (taskId: string) => void;
}

function safeFormatDistance(dateStr?: string) {
  const d = dateStr ? new Date(dateStr) : null;
  return d && !isNaN(d.getTime())
    ? formatDistanceToNow(d, { addSuffix: true })
    : 'Unknown time';
}


const MetricCard: React.FC<{
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  className?: string;
}> = ({ title, value, description, icon, trend, className }) => {
  return (
    <Card className={cn('transition-all hover:shadow-md', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={cn(
            'flex items-center text-xs mt-2',
            trend.positive ? 'text-green-600' : 'text-red-600'
          )}>
            <TrendingUp className="w-3 h-3 mr-1" />
            {trend.value}% {trend.label}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const QuickAction: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  disabled?: boolean;
}> = ({ title, description, icon, onClick, variant = 'default', disabled = false }) => {
  const variants = {
    default: 'border-border hover:bg-muted/50',
    success: 'border-green-200 bg-green-50/50 hover:bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50',
    destructive: 'border-red-200 bg-red-50/50 hover:bg-red-50'
  };

  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        variants[variant],
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const EmployeeTaskDashboard: React.FC<EmployeeTaskDashboardProps> = ({
  onViewTask,
  onStartTask,
  onSubmitTask
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const { data: dashboard, isLoading, error, refetch } = useEmployeeDashboard();
  
  // Task workflow mutations
  const startTaskMutation = useStartTask();
  const updateProgressMutation = useUpdateTaskProgress();
  const submitTaskMutation = useSubmitTask();
  
  // Build filter object for assigned tasks
  const taskFilters = React.useMemo(() => {
    const filters: any = {};
    if (statusFilter !== 'all') {
      filters.status = [statusFilter];
    }
    if (priorityFilter !== 'all') {
      filters.priority = [priorityFilter];
    }
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [statusFilter, priorityFilter]);

  const { data: filteredTasks } = useAssignedTasks(taskFilters);

  // Task workflow action handlers
  const handleStartTask = async (taskId: string) => {
    try {
      await startTaskMutation.mutateAsync({ taskId });
      
      toast({
        title: 'Task Started',
        description: 'You have successfully started working on this task.',
      });
      
      refetch(); // Refresh dashboard data
    } catch (error: any) {
      console.error('Failed to start task:', error);
      toast({
        title: 'Failed to Start Task',
        description: error.message || 'Unable to start the task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitTask = async (taskId: string) => {
    try {
      const request = {
        submission_notes: 'Task completed and submitted for review',
        attachments: []
      };
      
      await submitTaskMutation.mutateAsync({ taskId, request });
      
      toast({
        title: 'Task Submitted',
        description: 'Your task has been submitted for manager review.',
      });
      
      refetch(); // Refresh dashboard data
    } catch (error: any) {
      console.error('Failed to submit task:', error);
      toast({
        title: 'Failed to Submit Task',
        description: error.message || 'Unable to submit the task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateProgress = async (taskId: string) => {
    // For now, automatically set to 100% - in a real app this would open a modal/form
    try {
      const request = {
        progress_percentage: 100,
        hours_worked: 1,
        notes: 'Progress updated from dashboard'
      };
      
      await updateProgressMutation.mutateAsync({ taskId, request });
      
      toast({
        title: 'Progress Updated',
        description: 'Task progress has been updated to 100%.',
      });
      
      refetch(); // Refresh dashboard data
    } catch (error: any) {
      console.error('Failed to update progress:', error);
      toast({
        title: 'Failed to Update Progress',
        description: error.message || 'Unable to update progress. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load your dashboard. {' '}
          <Button variant="link" onClick={() => refetch()} className="p-0 h-auto">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Tasks Yet</h3>
          <p className="text-muted-foreground mb-4">
            You haven't been assigned any tasks yet. Check back later or contact your manager.
          </p>
          <Button onClick={() => refetch()}>
            Refresh Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { personal_stats, assigned_tasks, recent_activities, upcoming_deadlines, workload_summary } = dashboard;

  // Quick actions based on task statuses
  const inProgressTasks = assigned_tasks.filter(task => task.status === TaskStatus.IN_PROGRESS);
  const readyToSubmitTasks = assigned_tasks.filter(task => 
    task.status === TaskStatus.IN_PROGRESS && task.progress_percentage >= 100
  );
  const assignedTasks = assigned_tasks.filter(task => task.status === TaskStatus.ASSIGNED);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-muted-foreground">
            Track your assigned tasks and manage your workload
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Tasks"
          value={personal_stats.total_tasks}
          description="All tasks assigned to you"
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <MetricCard
          title="In Progress"
          value={personal_stats.by_status[TaskStatus.IN_PROGRESS] || 0}
          description="Currently working on"
          icon={<Play className="h-4 w-4" />}
        />
        <MetricCard
          title="Completion Rate"
          value={`${(personal_stats.completion_rate ?? 0).toFixed(1)}%`}
          description="Tasks completed on time"
          icon={<Target className="h-4 w-4" />}
          trend={{
            value: 8.2,
            label: 'from last month',
            positive: true
          }}
        />
        <MetricCard
          title="Overdue Tasks"
          value={personal_stats.overdue_count}
          description="Require immediate attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          className={personal_stats.overdue_count > 0 ? 'border-red-200 bg-red-50/50' : ''}
        />
      </div>

      {/* Quick Actions */}
      {(assignedTasks.length > 0 || readyToSubmitTasks.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assignedTasks.length > 0 && (
              <QuickAction
                title="Start New Tasks"
                description={`${assignedTasks.length} task${assignedTasks.length > 1 ? 's' : ''} ready to begin`}
                icon={<Play className="w-5 h-5 text-blue-600" />}
                onClick={() => setActiveTab('tasks')}
                variant="default"
              />
            )}
            
            {readyToSubmitTasks.length > 0 && (
              <QuickAction
                title="Submit Completed Tasks"
                description={`${readyToSubmitTasks.length} task${readyToSubmitTasks.length > 1 ? 's' : ''} ready for review`}
                icon={<Upload className="w-5 h-5 text-green-600" />}
                onClick={() => setActiveTab('tasks')}
                variant="success"
              />
            )}
            
            {upcoming_deadlines.length > 0 && (
              <QuickAction
                title="Upcoming Deadlines"
                description={`${upcoming_deadlines.length} task${upcoming_deadlines.length > 1 ? 's' : ''} due soon`}
                icon={<Calendar className="w-5 h-5 text-yellow-600" />}
                onClick={() => setActiveTab('deadlines')}
                variant="warning"
              />
            )}
          </div>
        </div>
      )}

      {/* Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">
            My Tasks
            {assigned_tasks.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {assigned_tasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="deadlines">
            Deadlines
            {upcoming_deadlines.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {upcoming_deadlines.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Workload Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  My Workload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Active Tasks:</span>
                  <span className="font-medium">{workload_summary.active_tasks}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed Tasks:</span>
                  <span className="font-medium">{workload_summary.completed_tasks}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Completion:</span>
                  <span className="font-medium">
                      {workload_summary.average_task_completion_days !== undefined 
                        ? workload_summary.average_task_completion_days.toFixed(1) 
                        : 0} days
                    </span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Workload Level</span>
                    <span>{(workload_summary.workload_percentage ?? 0).toFixed(1)}%</span>
                  </div>
                  <Progress value={workload_summary.workload_percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {workload_summary.workload_percentage > 80 ? 'High workload' :
                     workload_summary.workload_percentage > 60 ? 'Moderate workload' :
                     'Light workload'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Task Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Task Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(personal_stats.by_status).map(([status, count]) => {
                    const percentage = personal_stats.total_tasks > 0 ? (count / personal_stats.total_tasks) * 100 : 0;
                    return count > 0 ? (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <TaskStatusBadge status={status as TaskStatus} />
                          </div>
                          <span className="font-medium">{count}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    ) : null;
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Priority Tasks */}
          {upcoming_deadlines.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Upcoming Deadlines
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcoming_deadlines.slice(0, 6).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showActions={true}
                    showDepartment={false}
                    onActionClick={(action, taskId) => {
                      if (action === 'view') onViewTask?.(taskId);
                      if (action === 'start') handleStartTask(taskId);
                      if (action === 'submit') handleSubmitTask(taskId);
                      if (action === 'update') handleUpdateProgress(taskId);
                      if (action === 'comment') onViewTask?.(taskId);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value={TaskStatus.ASSIGNED}>Assigned</SelectItem>
                <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                <SelectItem value={TaskStatus.SUBMITTED}>Submitted</SelectItem>
                <SelectItem value={TaskStatus.IN_REVIEW}>In Review</SelectItem>
                <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value={Priority.URGENT}>Urgent</SelectItem>
                <SelectItem value={Priority.HIGH}>High</SelectItem>
                <SelectItem value={Priority.MEDIUM}>Medium</SelectItem>
                <SelectItem value={Priority.LOW}>Low</SelectItem>
              </SelectContent>
            </Select>

            {(statusFilter !== 'all' || priorityFilter !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Task List */}
          {(filteredTasks || assigned_tasks).length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                  <p className="text-muted-foreground">
                    {statusFilter !== 'all' || priorityFilter !== 'all' 
                      ? 'No tasks match your current filters.' 
                      : 'You have no assigned tasks at the moment.'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(filteredTasks || assigned_tasks).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showActions={true}
                  showAssignee={false}
                  onActionClick={(action, taskId) => {
                    if (action === 'view') onViewTask?.(taskId);
                    if (action === 'start') handleStartTask(taskId);
                    if (action === 'submit') handleSubmitTask(taskId);
                    if (action === 'update') handleUpdateProgress(taskId);
                    if (action === 'comment') onViewTask?.(taskId); // Navigate to task details for comments
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Deadlines Tab */}
        <TabsContent value="deadlines" className="space-y-4">
          {upcoming_deadlines.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Calendar className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No urgent deadlines</h3>
                  <p className="text-muted-foreground">
                    All your tasks are on track with their deadlines.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcoming_deadlines.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showActions={true}
                    showAssignee={false}
                    onActionClick={(action, taskId) => {
                      if (action === 'view') onViewTask?.(taskId);
                      if (action === 'start') handleStartTask(taskId);
                      if (action === 'submit') handleSubmitTask(taskId);
                      if (action === 'update') handleUpdateProgress(taskId);
                      if (action === 'comment') onViewTask?.(taskId);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-4">
          {recent_activities.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No recent activities</h3>
                  <p className="text-muted-foreground">
                    Your task activities will appear here as they happen.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activities
                </CardTitle>
                <CardDescription>
                  Your latest task updates and changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recent_activities.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {activity.task_title}
                          </p>
                          <span className="text-xs text-muted-foreground">•</span>
                          <p className="text-xs text-muted-foreground">
                            {activity.timestamp
                              ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
                              : 'Unknown time'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmployeeTaskDashboard;