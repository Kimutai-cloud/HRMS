import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  Award,
  CheckCircle,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useTeamData } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import managerService from '@/services/managerService';
import analyticsService from '@/services/analyticsService';
import { useEffect } from 'react';

interface TeamAnalytics {
  teamSize: number;
  averageProfileCompletion: number;
  verifiedMembers: number;
  pendingApprovals: number;
  departmentDistribution: Array<{ name: string; value: number; }>;
  recentActivities: Array<{ type: string; description: string; timestamp: string; employee_name?: string; }>;
  topPerformers: Array<{ name: string; completion: number; status: string; }>;
  teamMetrics: any;
}

const ManagerAnalytics: React.FC = () => {
  const { userProfile } = useAuth();
  const { members: teamMembers } = useTeamData();
  const [timeRange, setTimeRange] = useState('30d');
  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Get real data from manager service dashboard summary
      const [dashboardSummary, teamPerformance] = await Promise.all([
        managerService.getDashboardSummary(),
        managerService.getTeamPerformance()
      ]);

      // Extract real metrics
      const teamMetrics = dashboardSummary.team_metrics;
      const recentActivities = dashboardSummary.recent_activities;
      
      // Calculate department distribution from real team data
      const deptCounts = teamMembers?.reduce((acc, member) => {
        const dept = member.department || 'Unassigned';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const departmentDistribution = Object.entries(deptCounts).map(([name, value]) => ({ name, value }));

      // Top performers from real performance data
      const topPerformers = teamPerformance
        .sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))
        .slice(0, 5)
        .map(member => ({
          name: member.employee_name,
          completion: member.profile_completion,
          status: teamMembers?.find(tm => tm.id === member.employee_id)?.verification_status || 'UNKNOWN'
        }));

      setAnalytics({
        teamSize: teamMetrics.total_team_members,
        averageProfileCompletion: teamMetrics.average_profile_completion,
        verifiedMembers: teamMetrics.verified_members,
        pendingApprovals: teamMetrics.pending_members,
        departmentDistribution,
        recentActivities,
        topPerformers,
        teamMetrics
      });

    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      manager: userProfile?.employee?.first_name + ' ' + userProfile?.employee?.last_name,
      timeRange,
      analytics
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `manager-team-analytics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Team Analytics</h1>
            <p className="text-muted-foreground">Comprehensive insights into your team's performance</p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Team Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into your team's performance and progress
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportReport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={loadAnalytics} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.teamSize || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active team members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Profile Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(analytics?.averageProfileCompletion || 0)}%</div>
            <Progress value={analytics?.averageProfileCompletion || 0} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Managed Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.departmentDistribution?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active departments under your management
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Members</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.verifiedMembers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Out of {analytics?.teamSize || 0} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Team Activities & Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Team Activities & Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Compliance Rate</span>
                  <span className="text-sm">{analytics?.teamMetrics?.team_compliance_rate || 0}%</span>
                </div>
                <Progress value={analytics?.teamMetrics?.team_compliance_rate || 0} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">New Members (30d)</span>
                  <span className="text-sm">{analytics?.teamMetrics?.new_members_this_month || 0}</span>
                </div>
                <Progress value={Math.min((analytics?.teamMetrics?.new_members_this_month || 0) * 10, 100)} className="h-2" />
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Recent Team Activities</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {analytics?.recentActivities?.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.description}</p>
                      {activity.employee_name && (
                        <p className="text-xs text-muted-foreground">{activity.employee_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                
                {(!analytics?.recentActivities || analytics.recentActivities.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activities</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Department Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics?.departmentDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics?.departmentDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.topPerformers?.map((performer, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' : 
                    index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{performer.name}</p>
                    <p className="text-sm text-muted-foreground">Profile: {performer.completion}%</p>
                  </div>
                </div>
                <Badge variant="secondary" className={
                  performer.status === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                  performer.status?.includes('PENDING') ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }>
                  {performer.status?.replace('_', ' ').toLowerCase()}
                </Badge>
              </div>
            ))}
            
            {(!analytics?.topPerformers || analytics.topPerformers.length === 0) && (
              <div className="text-center p-4 text-muted-foreground">
                <Award className="w-8 h-8 mx-auto mb-2" />
                <p>No team members to display</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerAnalytics;