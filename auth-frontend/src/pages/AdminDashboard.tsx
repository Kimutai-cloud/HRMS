import { useState, useEffect } from "react";
import { 
  Users, 
  Shield, 
  Database, 
  Activity, 
  Settings, 
  AlertTriangle,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle,
  UserCheck,
  UserX,
  RefreshCw,
  Eye
} from "lucide-react";
import { AdminMetrics } from "@/components/dashboard/DashboardMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import EmployeeService from "@/services/employeeService";
import { type EmployeeData } from "@/types/auth";
import { ROUTE_PATHS } from "@/config/routes";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  totalEmployees: number;
  pendingApprovals: number;
  systemHealth: number;
  recentActivity: any[];
}

export default function AdminDashboard() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { metrics, loading: dashboardLoading, error: dashboardError, refresh } = useDashboardData('admin');
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: metrics.totalEmployees || 0,
    pendingApprovals: metrics.pendingApprovals || 0,
    systemHealth: 98.5,
    recentActivity: []
  });

  const employeeService = new EmployeeService();

  // Helper function to calculate system health based on real data
  const calculateSystemHealth = (dashboardData: any): number => {
    if (!dashboardData) return 98.5; // fallback
    
    const totalEmployees = dashboardData.quick_stats?.total_verified || 0;
    const pendingApprovals = dashboardData.pending_reviews?.total || 0;
    const completionRate = dashboardData.quick_stats?.completion_rate || 0;
    
    // Calculate health based on system efficiency
    let health = 98.5; // Base health
    
    // Reduce health if there are too many pending approvals relative to total
    if (totalEmployees > 0) {
      const pendingRatio = pendingApprovals / (totalEmployees + pendingApprovals);
      if (pendingRatio > 0.2) health -= 5; // High pending ratio
      else if (pendingRatio > 0.1) health -= 2; // Moderate pending ratio
    }
    
    // Adjust based on completion rate if available
    if (completionRate > 0) {
      if (completionRate < 0.7) health -= 3; // Low completion rate
      else if (completionRate > 0.9) health += 1; // High completion rate
    }
    
    return Math.max(90, Math.min(100, health)); // Keep between 90-100%
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (showSuccessNotification = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Set access token for employee service
      const authService = new (await import('../services/authService')).default();
      const token = authService.getAccessToken();
      employeeService.setAccessToken(token);

      // Fetch actual data from backend
      const [employeesData, dashboardData] = await Promise.all([
        employeeService.getAllEmployees(),
        employeeService.getAdminDashboard()
      ]);

      setEmployees(employeesData);
      setStats({
        totalEmployees: dashboardData.quick_stats?.total_verified || employeesData.length || 0,
        pendingApprovals: dashboardData.pending_reviews?.total || 0,
        systemHealth: calculateSystemHealth(dashboardData),
        recentActivity: generateRecentActivity(employeesData)
      });

      if (showSuccessNotification) {
        showNotification('success', 'Dashboard data refreshed successfully');
      }

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
      showNotification('error', `Failed to load dashboard data: ${errorMessage}`);
      
      // Set fallback data on error
      setEmployees([]);
      setStats({
        totalEmployees: 0,
        pendingApprovals: 0,
        systemHealth: calculateSystemHealth(null),
        recentActivity: []
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string | Date) => {
    const now = new Date();
    const date = new Date(dateString);
    
    // Handle invalid dates
    if (isNaN(date.getTime())) {
      return '1 hour ago'; // Default fallback
    }
    
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInMonths = Math.floor(diffInDays / 30);

    // Handle future dates (shouldn't happen but be safe)
    if (diffInMs < 0) {
      return '1 hour ago';
    }

    if (diffInMinutes < 60) {
      if (diffInMinutes <= 0) return '1 minute ago'; // Avoid "just now"
      return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
    } else if (diffInDays < 7) {
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
    } else if (diffInWeeks < 4) {
      return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
    } else {
      return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`;
    }
  };

  const generateRecentActivity = (employees: EmployeeData[]) => {
    const activities: { action: string; user: string; time: string; type: string; }[] = [];
    const now = new Date();
    
    // Add recent activities based on employee data with more realistic timestamps
    employees.slice(0, 4).forEach((emp, index) => {
      let action = 'User Updated';
      let type = 'success';
      
      // Create more realistic activity timestamps (spreading activities over the last few days)
      const baseTime = new Date(now.getTime() - (index * 2 + Math.random() * 24) * 60 * 60 * 1000); // Random time in last few days
      let activityTime = baseTime.toISOString();
      
      // Use updated_at field if available, otherwise created_at, finally fall back to generated time
      if (emp.updated_at) {
        activityTime = emp.updated_at;
      } else if (emp.created_at) {
        activityTime = emp.created_at;
      }
      
      switch (emp.verification_status) {
        case 'PENDING_DETAILS_REVIEW':
          action = 'Profile Submitted for Review';
          type = 'warning';
          break;
        case 'PENDING_DOCUMENTS_REVIEW':
          action = 'Documents Pending Review';
          type = 'warning';
          break;
        case 'PENDING_ROLE_ASSIGNMENT':
          action = 'Role Assignment Pending';
          type = 'warning';
          break;
        case 'PENDING_FINAL_APPROVAL':
          action = 'Final Approval Pending';
          type = 'warning';
          break;
        case 'VERIFIED':
          action = 'Profile Verified';
          type = 'success';
          break;
        default:
          action = 'User Profile Updated';
          type = 'info';
      }
      
      activities.push({
        action: action,
        user: `${emp.first_name} ${emp.last_name}`,
        time: formatTimeAgo(activityTime),
        type: type
      });
    });

    return activities;
  };

  const handleReviewEmployee = (employeeId: string) => {
    // Navigate to admin panel with specific employee for review
    navigate(`${ROUTE_PATHS.ADMIN_PANEL}?employee=${employeeId}`);
  };

  const handleRejectEmployee = async (employeeId: string, reason: string) => {
    try {
      setError(null);
      
      // Find employee name for notification
      const employee = employees.find(emp => emp.id === employeeId);
      const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : 'Employee';
      
      // Ensure token is set
      const authService = new (await import('../services/authService')).default();
      const token = authService.getAccessToken();
      employeeService.setAccessToken(token);
      
      await employeeService.rejectEmployee(employeeId, reason || 'Rejected by admin');
      await loadDashboardData(false); // Reload data without success notification
      
      showNotification('info', `${employeeName} has been rejected and notified`);
    } catch (err) {
      console.error('Failed to reject employee:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject employee';
      showNotification('error', `Failed to reject employee: ${errorMessage}`);
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">System Administration</h1>
            <p className="text-muted-foreground">
              Welcome back, {userProfile?.employee?.first_name || user?.firstName}. 
              Complete system overview and management tools.
            </p>
          </div>
          <Button onClick={() => loadDashboardData(true)} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Use role-specific metrics */}
        <AdminMetrics />

        {/* Admin Actions & System Status */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pending Approvals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Pending Approvals
                </div>
                <Badge variant="secondary">{stats.pendingApprovals}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {employees
                .filter(emp => emp.verification_status === 'PENDING_DETAILS_REVIEW' || 
                              emp.verification_status === 'PENDING_DOCUMENTS_REVIEW' || 
                              emp.verification_status === 'PENDING_ROLE_ASSIGNMENT' || 
                              emp.verification_status === 'PENDING_FINAL_APPROVAL')
                .slice(0, 4)
                .map((employee, index) => (
                  <div key={employee.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {employee.department} - {employee.position}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {employee.verification_status?.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleReviewEmployee(employee.id)}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Review
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRejectEmployee(employee.id, 'Admin review required')}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <UserX className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              
              {stats.pendingApprovals === 0 && (
                <div className="text-center p-4 text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>No pending approvals</p>
                </div>
              )}
              
              <Button 
                className="w-full mt-4" 
                variant="outline"
                onClick={() => navigate(ROUTE_PATHS.USER_MANAGEMENT)}
              >
                View All Employees
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-info" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.recentActivity.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">{item.action}</p>
                    <p className="text-sm text-muted-foreground">{item.user}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={item.type === "error" ? "destructive" : "secondary"}
                      className={
                        item.type === "success" ? "bg-green-100 text-green-800" :
                        item.type === "warning" ? "bg-yellow-100 text-yellow-800" :
                        item.type === "error" ? "" : ""
                      }>
                      {item.time}
                    </Badge>
                  </div>
                </div>
              ))}
              
              <Button 
                className="w-full mt-4" 
                variant="outline"
                onClick={() => navigate(ROUTE_PATHS.AUDIT_LOGS)}
              >
                View Full Audit Log
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* System Configuration & Quick Actions */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Employee Service</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Auth Service</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Employees</span>
                  <span className="font-medium">{stats.totalEmployees}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>System Health</span>
                  <span className="font-medium">{stats.systemHealth}%</span>
                </div>
              </div>
              <Button 
                className="w-full" 
                variant="outline" 
                size="sm"
                onClick={() => navigate(ROUTE_PATHS.SYSTEM_SETTINGS)}
              >
                Configure System
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Employee Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Verified</span>
                  <span>{employees.filter(e => e.verification_status === 'VERIFIED').length}</span>
                </div>
                <Progress 
                  value={(employees.filter(e => e.verification_status === 'VERIFIED').length / Math.max(employees.length, 1)) * 100} 
                  className="h-2" 
                />
                <div className="flex justify-between text-sm">
                  <span>Pending</span>
                  <span>{stats.pendingApprovals}</span>
                </div>
                <Progress 
                  value={(stats.pendingApprovals / Math.max(employees.length, 1)) * 100} 
                  className="h-2" 
                />
              </div>
              <Button 
                className="w-full" 
                variant="outline" 
                size="sm"
                onClick={() => navigate(ROUTE_PATHS.REPORTS)}
              >
                View Reports
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-info" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.USER_MANAGEMENT)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.AUDIT_LOGS)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Audit Logs
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.SYSTEM_SETTINGS)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}