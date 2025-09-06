import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardUpdates } from '@/hooks/useWebSocket';
import EmployeeService from '@/services/employeeService';

export interface DashboardMetrics {
  totalEmployees?: number;
  activeEmployees?: number;
  pendingApprovals?: number;
  newHires?: number;
  teamMembers?: number;
  tasksCompleted?: number;
  profileCompletion?: number;
  documentsUploaded?: number;
  documentReviews?: number;
  verifiedEmployees?: number;
  totalRejected?: number;
  completionRate?: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useDashboardData = (context?: 'admin' | 'manager' | 'employee' | 'newcomer'): DashboardData => {
  let authData;
  try {
    authData = useAuth();
  } catch (error) {
    console.error('useAuth context error:', error);
    return {
      metrics: {},
      loading: false,
      error: 'Authentication context unavailable',
      refresh: async () => {}
    };
  }
  const { user, userProfile, isAdmin, isManager, isEmployee, isNewcomer } = authData;
  const [metrics, setMetrics] = useState<DashboardMetrics>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const employeeService = new EmployeeService();
  const dashboardUpdate = useDashboardUpdates();

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      if (context === 'admin' && isAdmin) {
        // Call the actual admin dashboard API
        try {
          // Set token and fetch admin dashboard data
          const authService = new (await import('@/services/authService')).default();
          const token = authService.getAccessToken();
          employeeService.setAccessToken(token);
          
          const dashboardData = await employeeService.getAdminDashboard();
          
          setMetrics({
            totalEmployees: dashboardData.quick_stats?.total_verified || 0,
            activeEmployees: dashboardData.quick_stats?.total_verified || 0,
            pendingApprovals: dashboardData.pending_reviews?.total || 0,
            newHires: dashboardData.pending_reviews?.final || 0,
            documentReviews: dashboardData.document_reviews?.total_pending || 0,
            verifiedEmployees: dashboardData.quick_stats?.total_verified || 0,
            totalRejected: dashboardData.quick_stats?.total_rejected || 0,
            completionRate: dashboardData.quick_stats?.completion_rate || 0,
          });
        } catch (apiError) {
          console.error('Failed to fetch admin dashboard data:', apiError);
          // Fallback to default values
          setMetrics({
            totalEmployees: 0,
            activeEmployees: 0,
            pendingApprovals: 0,
            newHires: 0,
            documentReviews: 0,
            verifiedEmployees: 0,
            totalRejected: 0,
            completionRate: 0,
          });
        }
      } else if ((context === 'manager' || !context) && isManager) {
        // Call manager-specific endpoints
        try {
          // Set token first
          const authService = new (await import('@/services/authService')).default();
          const token = authService.getAccessToken();
          employeeService.setAccessToken(token);
          
          const teamMembers = await employeeService.getTeamMembersCount();
          const pendingApprovals = await employeeService.getManagerPendingApprovals(user.id);
          
          setMetrics({
            teamMembers: teamMembers,
            pendingApprovals: pendingApprovals,
          });
        } catch (apiError) {
          console.error('Failed to fetch manager dashboard data:', apiError);
          setMetrics({
            teamMembers: 0,
            pendingApprovals: 0,
          });
        }
      } else if ((context === 'employee' || !context) && isEmployee) {
        // Call employee-specific endpoints
        try {
          // Set token first
          const authService = new (await import('@/services/authService')).default();
          const token = authService.getAccessToken();
          employeeService.setAccessToken(token);
          
          const tasksCompleted = await employeeService.getTasksCompletedCount(user.id);
          const profileCompletion = await employeeService.getProfileCompletionPercentage(user.id);
          
          setMetrics({
            tasksCompleted: tasksCompleted,
            profileCompletion: profileCompletion,
          });
        } catch (apiError) {
          console.error('Failed to fetch employee dashboard data:', apiError);
          setMetrics({
            tasksCompleted: 0,
            profileCompletion: 0,
          });
        }
      } else if ((context === 'newcomer' || !context) && isNewcomer) {
        // Call newcomer-specific endpoints
        try {
          // Set token first
          const authService = new (await import('@/services/authService')).default();
          const token = authService.getAccessToken();
          employeeService.setAccessToken(token);
          
          const profileCompletion = await employeeService.getProfileCompletionPercentage(user.id);
          const documentsUploaded = await employeeService.getDocumentsUploadedCount(user.id);
          
          setMetrics({
            profileCompletion: profileCompletion,
            documentsUploaded: documentsUploaded,
          });
        } catch (apiError) {
          console.error('Failed to fetch newcomer dashboard data:', apiError);
          setMetrics({
            profileCompletion: 0,
            documentsUploaded: 0,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user, userProfile]);

  useEffect(() => {
    if (dashboardUpdate) {
      setMetrics(prevMetrics => ({
        ...prevMetrics,
        ...dashboardUpdate
      }));
    }
  }, [dashboardUpdate]);

  return {
    metrics,
    loading,
    error,
    refresh: fetchDashboardData,
  };
};

export default useDashboardData;