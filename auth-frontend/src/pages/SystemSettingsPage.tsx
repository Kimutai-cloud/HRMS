import React from 'react';
import ReportsGenerator from '@/components/analytics/ReportsGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Settings, 
  AlertTriangle,
  Database,
  Shield,
  Mail,
  FileText
} from 'lucide-react';

const SystemSettingsPage: React.FC = () => {
  const { userProfile } = useAuth();

  if (!userProfile?.roles?.some(role => role.role_code === 'ADMIN' )) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">You need admin privileges to access system settings.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground">
          Configure system-wide settings and generate reports
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Database Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Connection Status</label>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Connected</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Database Size</label>
              <p className="text-sm text-muted-foreground">2.4 GB</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Backup</label>
              <p className="text-sm text-muted-foreground">2 hours ago</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Authentication Method</label>
              <p className="text-sm text-muted-foreground">JWT with 8-hour expiry</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Failed Login Attempts</label>
              <p className="text-sm text-muted-foreground">Max 5 attempts before lockout</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Audit Logging</label>
              <p className="text-sm text-muted-foreground">Enabled for all admin actions</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">SMTP Server</label>
              <p className="text-sm text-muted-foreground">smtp.company.com:587</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Templates</label>
              <p className="text-sm text-muted-foreground">5 active templates</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Daily Email Limit</label>
              <p className="text-sm text-muted-foreground">1000 emails/day</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Document Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Storage Used</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }} />
                </div>
                <span className="text-sm">65%</span>
              </div>
              <p className="text-xs text-muted-foreground">6.5 GB of 10 GB used</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Document Retention</label>
              <p className="text-sm text-muted-foreground">7 years (compliance)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Reports & Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReportsGenerator />
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSettingsPage;