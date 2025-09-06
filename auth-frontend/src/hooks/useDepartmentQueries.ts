import React from 'react';
import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { departmentService } from '../services/serviceFactory';
import { useAuth } from '../contexts/AuthContext';
import type {
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentResponse,
  DepartmentListResponse,
  DepartmentStatsListResponse,
  DepartmentForDropdownResponse,
  DepartmentEmployeesResponse
} from '../types/department';

// Define AssignManagerRequest inline to avoid import issues
interface AssignManagerRequest {
  manager_id: string;
}

// Query Keys Factory - following TanStack Query best practices
export const departmentKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentKeys.all, 'list'] as const,
  list: (includeInactive?: boolean) => [...departmentKeys.lists(), includeInactive] as const,
  details: () => [...departmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...departmentKeys.details(), id] as const,
  stats: () => [...departmentKeys.all, 'stats'] as const,
  dropdown: () => [...departmentKeys.all, 'dropdown'] as const,
  managed: () => [...departmentKeys.all, 'managed'] as const,
  employees: () => [...departmentKeys.all, 'employees'] as const,
  departmentEmployees: (id: string) => [...departmentKeys.employees(), id] as const,
} as const;

// Query Options Factory - for type safety and reusability
export const departmentQueryOptions = {
  list: (includeInactive = false) =>
    queryOptions({
      queryKey: departmentKeys.list(includeInactive),
      queryFn: () => departmentService.listDepartments(includeInactive),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

  detail: (id: string) =>
    queryOptions({
      queryKey: departmentKeys.detail(id),
      queryFn: () => departmentService.getDepartment(id),
      staleTime: 5 * 60 * 1000,
    }),

  stats: () =>
    queryOptions({
      queryKey: departmentKeys.stats(),
      queryFn: () => departmentService.getDepartmentsWithStats(),
      staleTime: 2 * 60 * 1000, // 2 minutes for fresher stats
    }),

  dropdown: () =>
    queryOptions({
      queryKey: departmentKeys.dropdown(),
      queryFn: () => departmentService.getDepartmentsForDropdown(),
      staleTime: 10 * 60 * 1000, // 10 minutes - dropdowns change less frequently
    }),

  managed: () =>
    queryOptions({
      queryKey: departmentKeys.managed(),
      queryFn: () => departmentService.getManagedDepartments(),
      staleTime: 5 * 60 * 1000,
    }),

  departmentEmployees: (id: string) =>
    queryOptions({
      queryKey: departmentKeys.departmentEmployees(id),
      queryFn: () => departmentService.getDepartmentEmployees(id),
      staleTime: 2 * 60 * 1000,
    }),
};

// Custom hook to ensure authenticated requests
function useAuthenticatedDepartmentService() {
  const { accessToken } = useAuth();
  
  // Set access token when it changes
  React.useEffect(() => {
    if (accessToken) {
      departmentService.setAccessToken(accessToken);
    }
  }, [accessToken]);
  
  return departmentService;
}

// Admin Query Hooks
export function useDepartments(includeInactive = false) {
  useAuthenticatedDepartmentService();
  
  return useQuery(departmentQueryOptions.list(includeInactive));
}

export function useDepartmentsWithStats() {
  useAuthenticatedDepartmentService();
  
  return useQuery(departmentQueryOptions.stats());
}

export function useDepartment(id: string, enabled = true) {
  useAuthenticatedDepartmentService();
  
  return useQuery({
    ...departmentQueryOptions.detail(id),
    enabled: enabled && !!id,
  });
}

// Public Query Hooks
export function useDepartmentsForDropdown() {
  useAuthenticatedDepartmentService();
  
  return useQuery(departmentQueryOptions.dropdown());
}

// Manager Query Hooks
export function useManagedDepartments() {
  useAuthenticatedDepartmentService();
  
  return useQuery(departmentQueryOptions.managed());
}

export function useDepartmentEmployees(departmentId: string, enabled = true) {
  useAuthenticatedDepartmentService();
  
  return useQuery({
    ...departmentQueryOptions.departmentEmployees(departmentId),
    enabled: enabled && !!departmentId,
  });
}

// Mutation Hooks
export function useCreateDepartment() {
  const queryClient = useQueryClient();
  useAuthenticatedDepartmentService();
  
  return useMutation({
    mutationFn: (data: CreateDepartmentRequest) => 
      departmentService.createDepartment(data),
    onSuccess: () => {
      // Invalidate and refetch department lists
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.stats() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.dropdown() });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  useAuthenticatedDepartmentService();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDepartmentRequest }) =>
      departmentService.updateDepartment(id, data),
    onSuccess: (data, variables) => {
      // Update the specific department in cache
      queryClient.setQueryData(departmentKeys.detail(variables.id), data);
      
      // Invalidate department lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.stats() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.dropdown() });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  useAuthenticatedDepartmentService();
  
  return useMutation({
    mutationFn: (id: string) => departmentService.deleteDepartment(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: departmentKeys.detail(deletedId) });
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.stats() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.dropdown() });
    },
  });
}

export function useAssignManager() {
  const queryClient = useQueryClient();
  useAuthenticatedDepartmentService();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignManagerRequest }) =>
      departmentService.assignManager(id, data),
    onSuccess: (data, variables) => {
      // Update the specific department in cache
      queryClient.setQueryData(departmentKeys.detail(variables.id), data);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.stats() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.managed() });
    },
  });
}

export function useRemoveManager() {
  const queryClient = useQueryClient();
  useAuthenticatedDepartmentService();
  
  return useMutation({
    mutationFn: (id: string) => departmentService.removeManager(id),
    onSuccess: (data, departmentId) => {
      // Update the specific department in cache
      queryClient.setQueryData(departmentKeys.detail(departmentId), data);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.stats() });
      queryClient.invalidateQueries({ queryKey: departmentKeys.managed() });
    },
  });
}

// Prefetch utilities for performance optimization
export function usePrefetchDepartment() {
  const queryClient = useQueryClient();
  useAuthenticatedDepartmentService();
  
  return React.useCallback(
    (id: string) => {
      queryClient.prefetchQuery(departmentQueryOptions.detail(id));
    },
    [queryClient]
  );
}

export function usePrefetchDepartmentEmployees() {
  const queryClient = useQueryClient();
  useAuthenticatedDepartmentService();
  
  return React.useCallback(
    (id: string) => {
      queryClient.prefetchQuery(departmentQueryOptions.departmentEmployees(id));
    },
    [queryClient]
  );
}