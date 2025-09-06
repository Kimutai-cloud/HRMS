/**
 * Manager Task Dashboard Component
 * Comprehensive dashboard for managers with personal and team statistics
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import TaskCard from './TaskCard';
import TaskStatusBadge from './TaskStatusBadge';
import TaskPriorityIndicator from './TaskPriorityIndicator';
import TaskListView from './TaskListView';
import { useManagerDashboard, useReviewTask } from '@/hooks/queries/useTaskQueries';
import { TaskStatus, Priority } from '@/types/task';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, 
  Users, 
  ClipboardList, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Activity,
  Filter,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManagerTaskDashboardProps {
  onCreateTask?: () => void;
  onViewTask?: (taskId: string) => void;
  onFilterChange?: (filters: any) => void;
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

const TaskStatsChart: React.FC<{
  title: string;
  stats: Record<string, number>;
  type: 'status' | 'priority' | 'type';
}> = ({ title, stats, type }) => {
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
  
  const getColorClass = (key: string) => {
    if (type === 'status') {
      const statusColors = {
        DRAFT: 'bg-gray-500',
        ASSIGNED: 'bg-blue-500',
        IN_PROGRESS: 'bg-yellow-500',
        SUBMITTED: 'bg-purple-500',
        IN_REVIEW: 'bg-pink-500',
        COMPLETED: 'bg-green-500',
        CANCELLED: 'bg-red-500'
      };
      return statusColors[key as keyof typeof statusColors] || 'bg-gray-500';
    }
    if (type === 'priority') {
      const priorityColors = {
        LOW: 'bg-green-500',
        MEDIUM: 'bg-yellow-500',
        HIGH: 'bg-orange-500',
        URGENT: 'bg-red-500'
      };
      return priorityColors[key as keyof typeof priorityColors] || 'bg-gray-500';
    }
    return 'bg-blue-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(stats).map(([key, count]) => {
          const percentage = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{key.toLowerCase().replace('_', ' ')}</span>
                <span className="font-medium">{count}</span>
              </div>
              <Progress 
                value={percentage} 
                className="h-2"
                // Custom color would need CSS custom properties
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export const ManagerTaskDashboard: React.FC<ManagerTaskDashboardProps> = ({
  onCreateTask,
  onViewTask,
  onFilterChange
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const { data: dashboard, isLoading, error, refetch } = useManagerDashboard();
  const reviewTaskMutation = useReviewTask();

  const handleApproveTask = async (taskId: string) => {
    try {
      const request = {
        approved: true,
        review_notes: 'Approved from dashboard'
      };
      
      await reviewTaskMutation.mutateAsync({ taskId, request });
      
      toast({
        title: 'Task Approved',
        description: 'Task has been successfully approved.',
      });
      
      refetch(); // Refresh dashboard data
    } catch (error: any) {
      console.error('Failed to approve task:', error);
      toast({
        title: 'Approval Failed',
        description: error.message || 'Failed to approve task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      const request = {
        approved: false,
        review_notes: 'Task rejected - needs revision. Please review and resubmit.'
      };
      
      await reviewTaskMutation.mutateAsync({ taskId, request });
      
      toast({
        title: 'Task Rejected',
        description: 'Task has been sent back for revision.',
      });
      
      refetch(); // Refresh dashboard data
    } catch (error: any) {
      console.error('Failed to reject task:', error);
      toast({
        title: 'Rejection Failed',
        description: error.message || 'Failed to reject task. Please try again.',
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
          <Skeleton className="h-10 w-32" />
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
          Failed to load dashboard data. {' '}
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
          <h3 className="text-lg font-medium mb-2">No Dashboard Data</h3>
          <p className="text-muted-foreground mb-4">
            Unable to load your task management dashboard.
          </p>
          <Button onClick={() => refetch()}>
            Refresh Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Safely destructure dashboard data with defaults
  const personal_stats = dashboard?.personal_stats || null;
  const team_stats = dashboard?.team_stats || null;
  const recent_activities = dashboard?.recent_activities || [];
  const pending_reviews = dashboard?.pending_reviews || [];
  const overdue_tasks = dashboard?.overdue_tasks || [];


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground">
            Manage your tasks and oversee your team's progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => onCreateTask?.()}>
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Tasks"
          value={personal_stats.total_tasks}
          description="All tasks you've created"
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <MetricCard
          title="Team Tasks"
          value={team_stats.total_team_tasks}
          description="Active tasks in your department"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Completion Rate"
          value={`${personal_stats.completion_rate.toFixed(1)}%`}
          description="Personal task completion"
          icon={<Target className="h-4 w-4" />}
          trend={{
            value: 5.2,
            label: 'from last month',
            positive: true
          }}
        />
        <MetricCard
          title="Overdue Tasks"
          value={personal_stats.overdue_count + team_stats.overdue_tasks}
          description="Requires immediate attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          className={personal_stats.overdue_count > 0 ? 'border-red-200 bg-red-50/50' : ''}
        />
      </div>

      {/* Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">All Tasks</TabsTrigger>
          <TabsTrigger value="reviews">
            Pending Reviews
            {pending_reviews.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pending_reviews.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
          <TabsTrigger value="activities">Recent Activities</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <TaskStatsChart
              title="Tasks by Status"
              stats={personal_stats.by_status}
              type="status"
            />
            <TaskStatsChart
              title="Tasks by Priority"
              stats={personal_stats.by_priority}
              type="priority"
            />
            <TaskStatsChart
              title="Tasks by Type"
              stats={personal_stats.by_type}
              type="type"
            />
          </div>

          {/* Overdue Tasks Alert */}
          {overdue_tasks.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You have {overdue_tasks.length} overdue task{overdue_tasks.length > 1 ? 's' : ''} that need attention.
              </AlertDescription>
            </Alert>
          )}

          {/* Recent Overdue Tasks */}
          {overdue_tasks.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Overdue Tasks
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {overdue_tasks.slice(0, 6).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showActions={true}
                    canManageTasks={true}
                    onActionClick={(action, taskId) => {
                      switch (action) {
                        case 'view':
                          onViewTask?.(taskId);
                          break;
                        case 'comment':
                          onViewTask?.(taskId); // Navigate to task details for comments
                          break;
                        case 'approve':
                          handleApproveTask(taskId);
                          break;
                        case 'reject':
                          handleRejectTask(taskId);
                          break;
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* All Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
          <TaskListView
            onViewTask={onViewTask}
            onApproveTask={handleApproveTask}
            onRejectTask={handleRejectTask}
          />
        </TabsContent>

        {/* Pending Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          {pending_reviews.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                  <p className="text-muted-foreground">
                    No tasks are currently pending your review.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pending_reviews.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showActions={true}
                  onActionClick={(action, taskId) => {
                    switch (action) {
                      case 'view':
                        onViewTask?.(taskId);
                        break;
                      case 'comment':
                        onViewTask?.(taskId); // Navigate to task details for comments
                        break;
                      case 'approve':
                        handleApproveTask(taskId);
                        break;
                      case 'reject':
                        handleRejectTask(taskId);
                        break;
                    }
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Team Performance Tab */}
        <TabsContent value="team" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Department Overview
                </CardTitle>
                <CardDescription>
                  {team_stats.department.name} ({team_stats.department.code})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Tasks:</span>
                  <span className="font-medium">{team_stats.total_team_tasks}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Tasks:</span>
                  <span className="font-medium">{team_stats.active_tasks}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completion Rate:</span>
                  <span className="font-medium">{team_stats.completion_rate.toFixed(1)}%</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Team Progress</span>
                    <span>{team_stats.completion_rate.toFixed(1)}%</span>
                  </div>
                  <Progress value={team_stats.completion_rate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team Workload</CardTitle>
                <CardDescription>
                  Task distribution across team members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {team_stats.team_members.slice(0, 5).map((member) => (
                    <div key={member.employee_id} className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {member.employee_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.active_tasks} active, {member.completed_tasks} completed
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {member.workload_percentage}%
                        </span>
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          member.workload_percentage > 80 ? 'bg-red-500' :
                          member.workload_percentage > 60 ? 'bg-yellow-500' :
                          'bg-green-500'
                        )} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
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
                    Task activities will appear here as they happen.
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
                  Latest updates from your tasks and team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recent_activities.slice(0, 10).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{activity.user_name || 'Unknown User'}</span>{' '}
                          {activity.action.toLowerCase().replace('_', ' ') + ' task'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.details?.task_title || 'Unknown Task'} • {new Date(activity.created_at).toLocaleString()}
                        </p>
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

export default ManagerTaskDashboard;