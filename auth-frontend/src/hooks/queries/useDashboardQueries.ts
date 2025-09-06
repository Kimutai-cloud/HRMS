import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeService from '@/services/employeeService';

const employeeService = new EmployeeService();

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  metrics: (userId: string, role: string) => [...dashboardKeys.all, 'metrics', userId, role] as const,
  adminMetrics: () => [...dashboardKeys.all, 'admin-metrics'] as const,
  managerMetrics: (managerId: string) => [...dashboardKeys.all, 'manager-metrics', managerId] as const,
  employeeMetrics: (userId: string) => [...dashboardKeys.all, 'employee-metrics', userId] as const,
  newcomerMetrics: (userId: string) => [...dashboardKeys.all, 'newcomer-metrics', userId] as const,
};

// Admin dashboard metrics
export const useAdminDashboardMetrics = () => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: dashboardKeys.adminMetrics(),
    queryFn: async () => {
      employeeService.setAccessToken(accessToken);
      
      const [totalEmployees, activeEmployees, pendingApprovals, newHires] = await Promise.all([
        employeeService.getTotalEmployeesCount(),
        employeeService.getActiveEmployeesCount(),
        employeeService.getPendingApprovalsCount(),
        employeeService.getNewHiresCount(),
      ]);

      return {
        totalEmployees,
        activeEmployees,
        pendingApprovals,
        newHires,
      };
    },
    enabled: !!accessToken && isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Manager dashboard metrics
export const useManagerDashboardMetrics = (managerId?: string) => {
  const { user, accessToken, isManager } = useAuth();
  const targetManagerId = managerId || user?.id;

  return useQuery({
    queryKey: dashboardKeys.managerMetrics(targetManagerId || ''),
    queryFn: async () => {
      if (!targetManagerId) throw new Error('No manager ID provided');
      employeeService.setAccessToken(accessToken);
      
      const [teamMembers, pendingApprovals] = await Promise.all([
        employeeService.getTeamMembersCount(targetManagerId),
        employeeService.getManagerPendingApprovals(targetManagerId),
      ]);

      return {
        teamMembers,
        pendingApprovals,
      };
    },
    enabled: !!targetManagerId && !!accessToken && isManager,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Employee dashboard metrics
export const useEmployeeDashboardMetrics = (userId?: string) => {
  const { user, accessToken, isEmployee } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: dashboardKeys.employeeMetrics(targetUserId || ''),
    queryFn: async () => {
      if (!targetUserId) throw new Error('No user ID provided');
      employeeService.setAccessToken(accessToken);
      
      const [tasksCompleted, profileCompletion] = await Promise.all([
        employeeService.getTasksCompletedCount(targetUserId),
        employeeService.getProfileCompletionPercentage(targetUserId),
      ]);

      return {
        tasksCompleted,
        profileCompletion,
      };
    },
    enabled: !!targetUserId && !!accessToken && isEmployee,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Newcomer dashboard metrics
export const useNewcomerDashboardMetrics = (userId?: string) => {
  const { user, accessToken, isNewcomer } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: dashboardKeys.newcomerMetrics(targetUserId || ''),
    queryFn: async () => {
      if (!targetUserId) throw new Error('No user ID provided');
      employeeService.setAccessToken(accessToken);
      
      const [profileCompletion, documentsUploaded] = await Promise.all([
        employeeService.getProfileCompletionPercentage(targetUserId),
        employeeService.getDocumentsUploadedCount(targetUserId),
      ]);

      return {
        profileCompletion,
        documentsUploaded,
      };
    },
    enabled: !!targetUserId && !!accessToken && isNewcomer,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};