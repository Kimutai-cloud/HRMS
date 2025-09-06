import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import AdminWorkflowDashboard from '@/components/admin/AdminWorkflowDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/config/routes';
import { 
  Users, 
  FileCheck, 
  BarChart3, 
  Settings, 
  UserCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Loader2
} from 'lucide-react';

const AdminPanelPage: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const { metrics, loading, error, refresh } = useDashboardData('admin');

  // Calculate additional metrics from the dashboard data
  const totalEmployees = metrics.totalEmployees || 0;
  const pendingApprovals = metrics.pendingApprovals || 0;
  const activeEmployees = metrics.activeEmployees || 0;
  
  // Use real backend data for verified employees and document reviews
  const verifiedEmployees = metrics.verifiedEmployees || 0;
  const documentReviews = metrics.documentReviews || 0;

  const handleRefresh = async () => {
    try {
      await refresh();
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  if (!userProfile?.roles?.some(role => role.role_code === 'ADMIN' || role.code === 'ADMIN')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">You need admin privileges to access this panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground">
            Comprehensive administration tools and employee management
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="approvals">Employee Approvals</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Employees
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : totalEmployees}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalEmployees === 1 ? 'Employee in the system' : 'In the system'}
                </p>
                {totalEmployees > 0 && !loading && (
                  <div className="flex items-center pt-1">
                    <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                    <span className="text-xs text-green-600">Active system</span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Approvals
                </CardTitle>
                <Clock className={`h-4 w-4 ${pendingApprovals > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : pendingApprovals}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pendingApprovals === 0 ? 'All caught up!' : 'Awaiting review'}
                </p>
                {pendingApprovals > 0 && !loading && (
                  <div className="flex items-center pt-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600 mr-1" />
                    <span className="text-xs text-amber-600">Needs attention</span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Document Reviews
                </CardTitle>
                <FileCheck className={`h-4 w-4 ${documentReviews > 0 ? 'text-blue-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : documentReviews}
                </div>
                <p className="text-xs text-muted-foreground">
                  {documentReviews === 0 ? 'No documents pending' : 'Documents pending review'}
                </p>
                {documentReviews > 0 && !loading && (
                  <div className="flex items-center pt-1">
                    <Clock className="w-3 h-3 text-blue-600 mr-1" />
                    <span className="text-xs text-blue-600">Review required</span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Verified Employees
                </CardTitle>
                <CheckCircle className={`h-4 w-4 ${verifiedEmployees > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : verifiedEmployees}
                </div>
                <p className="text-xs text-muted-foreground">
                  {verifiedEmployees === 1 ? 'Employee fully verified' : 'Fully verified'}
                </p>
                {verifiedEmployees > 0 && !loading && (
                  <div className="flex items-center pt-1">
                    <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                    <span className="text-xs text-green-600">
                      {totalEmployees > 0 ? `${Math.round((verifiedEmployees / totalEmployees) * 100)}% verified` : 'Complete'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setActiveTab('approvals')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <UserCheck className="w-8 h-8 text-blue-600" />
                    {pendingApprovals > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {pendingApprovals}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold">Review Employees</h3>
                  <p className="text-sm text-muted-foreground">
                    {pendingApprovals === 0 ? 'All employees reviewed' : `${pendingApprovals} pending approval${pendingApprovals > 1 ? 's' : ''}`}
                  </p>
                </div>
                <div 
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(ROUTE_PATHS.DOCUMENTS)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <FileCheck className="w-8 h-8 text-green-600" />
                    {documentReviews > 0 && (
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                        {documentReviews}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold">Review Documents</h3>
                  <p className="text-sm text-muted-foreground">
                    {documentReviews === 0 ? 'No documents pending' : `${documentReviews} document${documentReviews > 1 ? 's' : ''} to review`}
                  </p>
                </div>
                <div 
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setActiveTab('analytics')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <BarChart3 className="w-8 h-8 text-purple-600" />
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      {totalEmployees}
                    </span>
                  </div>
                  <h3 className="font-semibold">Generate Reports</h3>
                  <p className="text-sm text-muted-foreground">
                    {totalEmployees === 0 ? 'No data available' : `Analytics for ${totalEmployees} employee${totalEmployees > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="approvals">
          <AdminWorkflowDashboard />
        </TabsContent>
        
        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Employee Onboarding Settings</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Configure the employee verification and approval workflow
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p>• Automatic email notifications: Enabled</p>
                    <p>• Document approval required: Yes</p>
                    <p>• Background check integration: Enabled</p>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Document Management</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    File upload limits and document retention policies
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p>• Maximum file size: 10MB</p>
                    <p>• Allowed file types: PDF, JPG, PNG, DOC</p>
                    <p>• Document retention: 7 years</p>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Security Settings</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Access control and security policies
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p>• Two-factor authentication: Required for admins</p>
                    <p>• Session timeout: 8 hours</p>
                    <p>• Audit logging: Enabled</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanelPage;