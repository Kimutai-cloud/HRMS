import { useState, useEffect } from "react";
import { 
  Users, 
  ClipboardList, 
  TrendingUp, 
  Target,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Award,
  RefreshCw,
  Building2
} from "lucide-react";
import { ManagerMetrics } from "@/components/dashboard/DashboardMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { useTeamData } from "@/hooks";
import managerService, { type TeamMetrics } from "@/services/managerService";
import { employeeService } from "@/services/serviceFactory";
import { type EmployeeData } from "@/types/auth";
import { ROUTE_PATHS } from "@/config/routes";
import { useNavigate } from "react-router-dom";

interface DashboardData {
  teamMetrics: TeamMetrics;
  teamMembers: EmployeeData[];
  pendingActions: {
    approvals_needed: number;
    documents_to_review: number;
    leave_requests: number;
    overdue_reviews: number;
  };
  recentActivities: Array<{
    type: string;
    description: string;
    timestamp: string;
    employee_name?: string;
  }>;
}

export default function ManagerDashboard() {
  const { userProfile } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const { members: teamMembers } = useTeamData();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTeamData();
  }, [userProfile]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Manager Dashboard: Loading team data...');
      
      // Just proceed with API calls - the employeeService will handle authentication

      // Set access token for employee service
      const authService = new (await import('../services/authService')).default();
      const token = authService.getAccessToken();
      employeeService.setAccessToken(token);

      console.log('Manager Dashboard: Access token set, making API calls...');

      // Use manager service to get dashboard summary
      const [dashboardSummary, teamMembers] = await Promise.all([
        managerService.getDashboardSummary(),
        managerService.getTeamMembers()
      ]);

      setDashboardData({
        teamMetrics: dashboardSummary.team_metrics,
        teamMembers: teamMembers,
        pendingActions: dashboardSummary.pending_actions,
        recentActivities: dashboardSummary.recent_activities
      });

      console.log('Manager Dashboard: Data loaded successfully', {
        teamSize: teamMembers.length,
        pendingApprovals: dashboardSummary.pending_actions.approvals_needed
      });

    } catch (err) {
      console.error('Failed to load team data:', err);
      const errorMessage = 'Failed to load team data. Please try refreshing.';
      setError(errorMessage);
      showNotification('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading team data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Team Management</h1>
            <p className="text-muted-foreground">
              Welcome back, {userProfile?.employee?.first_name}. 
              Monitor your team's performance and handle approvals.
            </p>
          </div>
          <Button onClick={loadTeamData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Use role-specific metrics */}
        <ManagerMetrics />

        {/* Team Overview & Approvals */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Team Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Team Members
                </div>
                <Badge variant="secondary">{dashboardData?.teamMetrics.total_team_members || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboardData?.teamMembers.slice(0, 4).map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {member.first_name[0]}{member.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.first_name} {member.last_name}</p>
                      <p className="text-sm text-muted-foreground">{member.position}</p>
                      <p className="text-xs text-muted-foreground">{member.department}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div className="text-sm font-medium">{member.profile_completion_percentage}%</div>
                    <Badge variant="secondary"
                      className={
                        member.verification_status === "VERIFIED" ? "bg-green-100 text-green-800" :
                        (member.verification_status === "PENDING_DETAILS_REVIEW" || 
                         member.verification_status === "PENDING_DOCUMENTS_REVIEW" || 
                         member.verification_status === "PENDING_ROLE_ASSIGNMENT" || 
                         member.verification_status === "PENDING_FINAL_APPROVAL") ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }>
                      {member.verification_status.replace('_', ' ').toLowerCase()}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {(!dashboardData?.teamMembers || dashboardData.teamMembers.length === 0) && (
                <div className="text-center p-4 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2" />
                  <p>No team members found</p>
                </div>
              )}
              
              <Button 
                className="w-full mt-4" 
                variant="outline"
                onClick={() => navigate(ROUTE_PATHS.TEAM)}
              >
                View All Team Members
              </Button>
            </CardContent>
          </Card>

          {/* Managed Departments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  My Departments
                </div>
                <Badge variant="secondary">0</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-4 text-muted-foreground">
                <Building2 className="w-8 h-8 mx-auto mb-2" />
                <p>Department management available</p>
                <p className="text-xs mt-1">Manage your assigned departments</p>
              </div>
              
              <Button 
                className="w-full mt-4"
                onClick={() => navigate(ROUTE_PATHS.MANAGER_DEPARTMENTS)}
              >
                View All Departments
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Team Analytics & Performance */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Team Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Profile Completion</span>
                    <span>{dashboardData?.teamMetrics.average_profile_completion || 0}%</span>
                  </div>
                  <Progress value={dashboardData?.teamMetrics.average_profile_completion || 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Verified Members</span>
                    <span>{dashboardData?.teamMetrics.team_compliance_rate || 0}%</span>
                  </div>
                  <Progress value={dashboardData?.teamMetrics.team_compliance_rate || 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Team Size</span>
                    <span>{dashboardData?.teamMetrics.total_team_members || 0}</span>
                  </div>
                  <Progress value={Math.min((dashboardData?.teamMetrics.total_team_members || 0) * 10, 100)} className="h-2" />
                </div>
              </div>
              <Button 
                className="w-full" 
                variant="outline" 
                size="sm"
                onClick={() => navigate(ROUTE_PATHS.MANAGER_ANALYTICS)}
              >
                View Detailed Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {dashboardData?.teamMembers
                  .sort((a, b) => (b.profile_completion_percentage || 0) - (a.profile_completion_percentage || 0))
                  .slice(0, 3)
                  .map((member, index) => (
                    <div key={member.id} className="flex justify-between items-center">
                      <span className="text-sm">{member.first_name} {member.last_name}</span>
                      <Badge variant="secondary" className={
                        index === 0 ? "bg-yellow-100 text-yellow-800" :
                        index === 1 ? "bg-gray-100 text-gray-800" :
                        "bg-orange-100 text-orange-800"
                      }>
                        {member.profile_completion_percentage || 0}%
                      </Badge>
                    </div>
                  ))}
                
                {(!dashboardData?.teamMembers || dashboardData.teamMembers.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center">No team members yet</p>
                )}
              </div>
              <Button 
                className="w-full" 
                variant="outline" 
                size="sm"
                onClick={() => navigate(ROUTE_PATHS.TEAM)}
              >
                Manage Team
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-info" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.TEAM)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  View Team
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.DOCUMENT_REVIEW)}
                >
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Review Requests
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.MANAGER_ANALYTICS)}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Team Reports
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}