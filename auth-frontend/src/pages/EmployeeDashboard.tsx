import { useState, useEffect } from "react";
import { 
  User, 
  FileText, 
  Calendar, 
  MessageSquare,
  Target,
  Clock,
  CheckCircle,
  TrendingUp,
  Users,
  Bell,
  RefreshCw,
  AlertCircle,
  Upload,
  Edit
} from "lucide-react";
import { EmployeeMetrics } from "@/components/dashboard/DashboardMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { useDashboardData } from "@/hooks";
import EmployeeService from "@/services/employeeService";
import { type DocumentStatus } from "@/types/auth";
import { ROUTE_PATHS } from "@/config/routes";
import { useNavigate } from "react-router-dom";

interface PersonalStats {
  documentsUploaded: number;
  pendingApproval: number;
  profileCompletion: number;
  recentActivity: any[];
}

export default function EmployeeDashboard() {
  const { user, userProfile } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentStatus[]>([]);
  const [stats, setStats] = useState<PersonalStats>({
    documentsUploaded: 0,
    pendingApproval: 0,
    profileCompletion: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const employeeService = new EmployeeService();

  useEffect(() => {
    loadPersonalData();
  }, [userProfile]);

  const loadPersonalData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      // Set access token for employee service
      const authService = new (await import('../services/authService')).default();
      const token = authService.getAccessToken();
      employeeService.setAccessToken(token);

      // Load user documents
      const userDocs = await employeeService.getEmployeeDocuments(user.id);
      setDocuments(userDocs);

      // Calculate stats
      const pendingDocs = userDocs.filter(doc => doc.status === 'pending').length;
      const profileCompletion = userProfile?.employee?.profile_completion_percentage || 0;

      setStats({
        documentsUploaded: userDocs.length,
        pendingApproval: pendingDocs,
        profileCompletion: profileCompletion,
        recentActivity: generateRecentActivity(userDocs)
      });

    } catch (err) {
      console.error('Failed to load personal data:', err);
      const errorMessage = 'Failed to load personal data';
      setError(errorMessage);
      showNotification('error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const generateRecentActivity = (docs: DocumentStatus[]) => {
    return docs.slice(0, 3).map(doc => {
      // Truncate file name if too long
      const shortFileName = doc.file_name && doc.file_name.length > 20 
        ? doc.file_name.substring(0, 20) + '...' 
        : doc.file_name || 'Unknown';
      
      return {
        type: 'Document Upload',
        description: `${doc.document_type || 'Document'} - ${shortFileName}`,
        status: doc.status,
        date: doc.upload_date || doc.uploaded_at, // Try both date fields
        comments: doc.comments
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const getUserDisplayName = () => {
    if (userProfile?.employee) {
      return `${userProfile.employee.first_name}`;
    }
    return user?.firstName || "Employee";
  };

  return (
    <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {getUserDisplayName()}!
            </h1>
            <p className="text-muted-foreground">
              Here's your personal dashboard and updates.
              {userProfile?.employee && (
                <span className="block text-sm">
                  {userProfile.employee.department} - {userProfile.employee.position}
                </span>
              )}
            </p>
          </div>
          <Button onClick={loadPersonalData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Use role-specific metrics */}
        <EmployeeMetrics dashboardData={stats} />

        {/* Personal Documents & Profile */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* My Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  My Documents
                </div>
                <Badge variant="secondary">{stats.documentsUploaded}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {documents.slice(0, 4).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">{doc.document_type}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-48">
                      {doc.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.upload_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary"
                      className={
                        doc.status === "approved" ? "bg-green-100 text-green-800" :
                        doc.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }>
                      {doc.status}
                    </Badge>
                    {doc.comments && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-24 truncate">
                        {doc.comments}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {documents.length === 0 && (
                <div className="text-center p-4 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2" />
                  <p>No documents uploaded yet</p>
                </div>
              )}
              
              <Button 
                className="w-full mt-4"
                onClick={() => navigate(ROUTE_PATHS.DOCUMENT_UPLOAD)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </CardContent>
          </Card>

          {/* Profile Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-success" />
                  Profile Status
                </div>
                <Badge variant="secondary">{stats.profileCompletion}%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Profile completion progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Profile Completion</span>
                  <span>{stats.profileCompletion}%</span>
                </div>
                <Progress value={stats.profileCompletion} className="h-2" />
              </div>

              {/* Verification Status */}
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Verification Status</span>
                  <Badge variant="secondary" className={
                    userProfile?.verification_status === 'VERIFIED' ? "bg-green-100 text-green-800" :
                    userProfile?.verification_status === 'PENDING_DETAILS_REVIEW' || 'PENDING_DOCUMENTS_REVIEW' || 'PENDING_ROLE_ASSIGNMENT' || 'PENDING_FINAL_APPROVAL' ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  }>
                    {userProfile?.verification_status?.replace('_', ' ').toLowerCase() || 'Unknown'}
                  </Badge>
                </div>
                {userProfile?.employee && (
                  <div className="text-xs text-muted-foreground">
                    <p>Department: {userProfile.employee.department}</p>
                    <p>Position: {userProfile.employee.position}</p>
                    {userProfile.employee.hire_date && (
                      <p>Hire Date: {new Date(userProfile.employee.hire_date).toLocaleDateString()}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.PROFILE)}
                >
                  <User className="w-4 h-4 mr-2" />
                  View Profile
                </Button>
                <Button 
                  className="flex-1" 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.PROFILE_EDIT)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-info" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.type}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.date && !isNaN(new Date(activity.date).getTime()) 
                          ? new Date(activity.date).toLocaleDateString()
                          : 'Unknown date'
                        }
                      </p>
                    </div>
                    <Badge variant="secondary" className={
                      activity.status === "approved" ? "bg-green-100 text-green-800" :
                      activity.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                      "bg-red-100 text-red-800"
                    }>
                      {activity.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center p-4 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
              <Button 
                className="w-full" 
                variant="outline" 
                size="sm"
                onClick={() => navigate(ROUTE_PATHS.DOCUMENTS)}
              >
                View All Documents
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.PROFILE_EDIT)}
                >
                  <User className="w-4 h-4 mr-2" />
                  Update Profile
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.DOCUMENT_UPLOAD)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(ROUTE_PATHS.DOCUMENTS)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Documents
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-warning" />
                Status Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className={`p-2 rounded ${
                  stats.profileCompletion === 100 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
                }`}>
                  <p className="font-medium">Profile Status</p>
                  <p className="text-xs">
                    {stats.profileCompletion === 100 ? 'Profile Complete' : `${100 - stats.profileCompletion}% remaining`}
                  </p>
                </div>
                
                <div className={`p-2 rounded ${
                  stats.pendingApproval === 0 ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'
                }`}>
                  <p className="font-medium">Document Status</p>
                  <p className="text-xs">
                    {stats.pendingApproval === 0 ? 'All documents reviewed' : `${stats.pendingApproval} pending approval`}
                  </p>
                </div>
                
                <div className="p-2 rounded bg-gray-50 text-gray-800">
                  <p className="font-medium">Account Status</p>
                  <p className="text-xs">
                    {userProfile?.verification_status?.replace('_', ' ').toLowerCase() || 'Unknown'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}