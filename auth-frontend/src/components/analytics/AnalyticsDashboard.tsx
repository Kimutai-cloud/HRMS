import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle
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
import { Skeleton } from '@/components/ui/skeleton';
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
import { useAllEmployees, useAdminDashboardMetrics } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';

interface AnalyticsDashboardProps {
  className?: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ className }) => {
  const { isAdmin } = useAuth();
  const [timeRange, setTimeRange] = useState('30d');
  const [viewType, setViewType] = useState('overview');

  const { data: employees = [], isLoading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useAllEmployees();
  const { data: metrics, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useAdminDashboardMetrics();

  // Mock data for charts - replace with real analytics data
  const employeeGrowthData = [
    { month: 'Jan', employees: 45, newHires: 5 },
    { month: 'Feb', employees: 52, newHires: 7 },
    { month: 'Mar', employees: 58, newHires: 6 },
    { month: 'Apr', employees: 65, newHires: 7 },
    { month: 'May', employees: 72, newHires: 7 },
    { month: 'Jun', employees: 78, newHires: 6 },
  ];

  const departmentData = [
    { name: 'Engineering', value: 35, color: '#3B82F6' },
    { name: 'Design', value: 12, color: '#10B981' },
    { name: 'Product', value: 8, color: '#F59E0B' },
    { name: 'Marketing', value: 6, color: '#EF4444' },
    { name: 'Sales', value: 10, color: '#8B5CF6' },
    { name: 'HR', value: 4, color: '#06B6D4' },
  ];

  const verificationStatusData = [
    { status: 'Verified', count: metrics?.activeEmployees || 0, color: '#10B981' },
    { status: 'Pending', count: metrics?.pendingApprovals || 0, color: '#F59E0B' },
    { status: 'Rejected', count: 5, color: '#EF4444' },
    { status: 'Not Started', count: 3, color: '#6B7280' },
  ];

  const profileCompletionData = [
    { range: '90-100%', count: 45 },
    { range: '80-89%', count: 23 },
    { range: '70-79%', count: 12 },
    { range: '60-69%', count: 8 },
    { range: '<60%', count: 5 },
  ];

  if (!isAdmin) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Access restricted to administrators only.</p>
      </div>
    );
  }

  if (employeesLoading || metricsLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        
        {/* Metrics Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Charts Skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (employeesError || metricsError) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Failed to load analytics data. {employeesError?.message || metricsError?.message}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                refetchEmployees();
                refetchMetrics();
              }}
              className="ml-2"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleExport = () => {
    // Generate analytics report
    const reportData = {
      generatedAt: new Date().toISOString(),
      totalEmployees: metrics?.totalEmployees || 0,
      activeEmployees: metrics?.activeEmployees || 0,
      pendingApprovals: metrics?.pendingApprovals || 0,
      departments: departmentData,
      employeeGrowth: employeeGrowthData,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hrms-analytics-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track employee metrics and organizational insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalEmployees || 0}</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              +12% from last month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeEmployees || 0}</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="w-3 h-3 mr-1" />
              +8% from last month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.pendingApprovals || 0}</div>
            <div className="flex items-center text-xs text-yellow-600">
              <Calendar className="w-3 h-3 mr-1" />
              Needs attention
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New Hires</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.newHires || 0}</div>
            <div className="flex items-center text-xs text-blue-600">
              <Users className="w-3 h-3 mr-1" />
              This month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Employee Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Employee Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={employeeGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="employees" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Total Employees"
                />
                <Line 
                  type="monotone" 
                  dataKey="newHires" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="New Hires"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Department Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {departmentData.map((dept) => (
                <div key={dept.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="text-sm">{dept.name}</span>
                  <Badge variant="outline" className="ml-auto">
                    {dept.value}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status and Completion Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Verification Status */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {verificationStatusData.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium">{item.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{ 
                        width: `${(item.count / (metrics?.totalEmployees || 1)) * 100}%`,
                        backgroundColor: item.color 
                      }}
                    />
                  </div>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Profile Completion */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Completion Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={profileCompletionData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="range" type="category" width={60} />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">24</div>
              <div className="text-sm text-blue-600">Profiles Created</div>
              <div className="text-xs text-muted-foreground">Last 7 days</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-2xl font-bold text-green-600">18</div>
              <div className="text-sm text-green-600">Approvals Completed</div>
              <div className="text-xs text-muted-foreground">Last 7 days</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">156</div>
              <div className="text-sm text-yellow-600">Documents Uploaded</div>
              <div className="text-xs text-muted-foreground">Last 7 days</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;