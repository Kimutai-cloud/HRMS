import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import EmployeeService from '@/services/employeeService';
import type { UserProfile, EmployeeData, DocumentStatus, ProfileSubmissionData, ManagerOption } from '@/types/auth';

const employeeService = new EmployeeService();

// Query keys - Factory Pattern (React Query Best Practice)
const EMPLOYEES_BASE = ['employees'] as const;

export const employeeKeys = {
  all: EMPLOYEES_BASE,
  profile: (userId: string) => [...EMPLOYEES_BASE, 'profile', userId] as const,
  documents: (userId: string) => [...EMPLOYEES_BASE, 'documents', userId] as const,
  team: (managerId: string) => [...EMPLOYEES_BASE, 'team', managerId] as const,
  list: () => [...EMPLOYEES_BASE, 'list'] as const,
  accessSummary: (userId: string) => [...EMPLOYEES_BASE, 'access-summary', userId] as const,
} as const;

// Profile queries
export const useEmployeeProfile = (userId?: string) => {
  const { user, accessToken } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: employeeKeys.profile(targetUserId || ''),
    queryFn: async (): Promise<UserProfile> => {
      if (!targetUserId) throw new Error('No user ID provided');
      employeeService.setAccessToken(accessToken);
      return employeeService.getEmployeeProfile(targetUserId);
    },
    enabled: !!targetUserId && !!accessToken,
  });
};

export const useAccessSummary = (userId?: string) => {
  const { user, accessToken } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: employeeKeys.accessSummary(targetUserId || ''),
    queryFn: async () => {
      if (!targetUserId) throw new Error('No user ID provided');
      employeeService.setAccessToken(accessToken);
      return employeeService.getAccessSummary(targetUserId);
    },
    enabled: !!targetUserId && !!accessToken,
  });
};

// Document queries
export const useEmployeeDocuments = (userId?: string) => {
  const { user, accessToken } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: employeeKeys.documents(targetUserId || ''),
    queryFn: async (): Promise<DocumentStatus[]> => {
      if (!targetUserId) throw new Error('No user ID provided');
      employeeService.setAccessToken(accessToken);
      return employeeService.getEmployeeDocuments(targetUserId);
    },
    enabled: !!targetUserId && !!accessToken,
  });
};

// Team queries (for managers)
export const useTeamMembers = (managerId?: string) => {
  const { user, accessToken, isManager } = useAuth();
  const targetManagerId = managerId || user?.id;

  return useQuery({
    queryKey: employeeKeys.team(targetManagerId || ''),
    queryFn: async (): Promise<EmployeeData[]> => {
      if (!targetManagerId) throw new Error('No manager ID provided');
      employeeService.setAccessToken(accessToken);
      return employeeService.getTeamMembers(targetManagerId);
    },
    enabled: !!targetManagerId && !!accessToken && isManager,
  });
};

// Admin queries
export const useAllEmployees = () => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: employeeKeys.list(),
    queryFn: async (): Promise<EmployeeData[]> => {
      employeeService.setAccessToken(accessToken);
      return employeeService.getAllEmployees();
    },
    enabled: !!accessToken && isAdmin,
  });
};

// Profile mutations
export const useUpdateEmployeeProfile = () => {
  const { user, accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<EmployeeData>) => {
      if (!user?.id) throw new Error('No user logged in');
      employeeService.setAccessToken(accessToken);
      return employeeService.updateEmployeeProfile(user.id, data);
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch profile data
      queryClient.invalidateQueries({ queryKey: employeeKeys.profile(user?.id || '') });
      queryClient.invalidateQueries({ queryKey: employeeKeys.accessSummary(user?.id || '') });
    },
  });
};

export const useSubmitProfile = () => {
  const { user, accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileData: ProfileSubmissionData) => {
      if (!user?.id) throw new Error('No user logged in');
      employeeService.setAccessToken(accessToken);
      return employeeService.submitProfile(user.id, profileData);
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch profile data
      queryClient.invalidateQueries({ queryKey: employeeKeys.profile(user?.id || '') });
      queryClient.invalidateQueries({ queryKey: employeeKeys.accessSummary(user?.id || '') });
    },
  });
};

// Document mutations
export const useUploadDocument = () => {
  const { user, accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentType, file }: { documentType: string; file: File }) => {
      if (!user?.id) throw new Error('No user logged in');
      employeeService.setAccessToken(accessToken);
      return employeeService.uploadDocument(user.id, documentType, file);
    },
    onSuccess: () => {
      // Invalidate documents query
      queryClient.invalidateQueries({ queryKey: employeeKeys.documents(user?.id || '') });
    },
  });
};

// Admin mutations
export const useApproveEmployee = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeId: string) => {
      if (!isAdmin) throw new Error('Admin access required');
      employeeService.setAccessToken(accessToken);
      return employeeService.approveEmployee(employeeId);
    },
    onSuccess: () => {
      // Invalidate employee lists
      queryClient.invalidateQueries({ queryKey: employeeKeys.list() });
    },
  });
};

export const useRejectEmployee = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeId, reason }: { employeeId: string; reason: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      employeeService.setAccessToken(accessToken);
      return employeeService.rejectEmployee(employeeId, reason);
    },
    onSuccess: () => {
      // Invalidate employee lists
      queryClient.invalidateQueries({ queryKey: employeeKeys.list() });
    },
  });
};
// Manager queries
export const useManagers = (departmentFilter?: string) => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: [...EMPLOYEES_BASE, 'managers', departmentFilter] as const,
    queryFn: async (): Promise<ManagerOption[]> => {
      employeeService.setAccessToken(accessToken);
      const profileService = await import('@/services/employeeProfileService');
      return profileService.default.getManagers(departmentFilter);
    },
    enabled: !!accessToken && isAdmin,
  });
};

