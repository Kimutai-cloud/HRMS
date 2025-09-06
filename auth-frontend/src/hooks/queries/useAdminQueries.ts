import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import adminService from '@/services/adminService';
import EmployeeService from '@/services/employeeService';
import type { EmployeeData } from '@/types/auth';

const employeeService = new EmployeeService();

// ============================================================================
// ADMIN QUERY KEYS - Factory Pattern (React Query Best Practice)
// ============================================================================

// Base keys to avoid circular references
const ADMIN_BASE = ['admin'] as const;
const PENDING_REVIEWS_BASE = [...ADMIN_BASE, 'pending-reviews'] as const;

// Type-safe admin query key factory
export const adminKeys = {
  all: ADMIN_BASE,
  dashboard: () => [...ADMIN_BASE, 'dashboard'] as const,
  pendingReviews: {
    all: PENDING_REVIEWS_BASE,
    details: (limit = 50) => [...PENDING_REVIEWS_BASE, 'details', limit] as const,
    documents: (limit = 50) => [...PENDING_REVIEWS_BASE, 'documents', limit] as const,
    roles: (limit = 50) => [...PENDING_REVIEWS_BASE, 'roles', limit] as const,
    final: (limit = 50) => [...PENDING_REVIEWS_BASE, 'final', limit] as const,
  },
  employeeForReview: (employeeId: string) => [...ADMIN_BASE, 'employee-review', employeeId] as const,
  employeeDocumentsForReview: (employeeId: string) => [...ADMIN_BASE, 'employee-documents-review', employeeId] as const,
  auditLogs: (filters?: Record<string, unknown>) => [...ADMIN_BASE, 'audit-logs', filters] as const,
} as const;

// Type definitions for better IntelliSense
export type AdminKeys = typeof adminKeys;

// ============================================================================
// ADMIN WORKFLOW TYPES
// ============================================================================

export interface PendingReview {
  employee: EmployeeData;
  documents_summary?: {
    total_documents: number;
    approved_documents: number;
    pending_documents: number;
    rejected_documents: number;
    all_required_approved: boolean;
  };
  days_pending: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  current_stage: string;
}

export interface AdminDashboardData {
  pending_reviews: {
    details: number;
    documents: number;
    roles: number;
    final: number;
    total: number;
  };
  document_reviews: {
    pending: number;
    requires_replacement: number;
    total_pending: number;
  };
  urgent_items: {
    count: number;
    oldest_days: number;
  };
  quick_stats: {
    total_verified: number;
    total_rejected: number;
    completion_rate: number;
  };
}

export interface DocumentReviewData {
  id: string;
  document_type: string;
  display_name: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  review_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUIRES_REPLACEMENT';
  review_notes?: string;
  reviewed_at?: string;
  is_required: boolean;
  can_preview: boolean;
}

// ============================================================================
// DASHBOARD QUERIES
// ============================================================================

/**
 * Admin Dashboard Summary
 */
export const useAdminDashboard = () => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.dashboard(),
    queryFn: async (): Promise<AdminDashboardData> => {
      if (!isAdmin) throw new Error('Admin access required');
      
      const metrics = await adminService.getSystemMetrics();
      
      return {
        pending_reviews: {
          details: Math.floor(metrics.pending_approvals * 0.3),
          documents: metrics.documents_pending_review,
          roles: Math.floor(metrics.pending_approvals * 0.2),
          final: Math.floor(metrics.pending_approvals * 0.1),
          total: metrics.pending_approvals,
        },
        document_reviews: {
          pending: metrics.documents_pending_review,
          requires_replacement: 0, // TODO: Add to backend
          total_pending: metrics.documents_pending_review,
        },
        urgent_items: {
          count: 0, // TODO: Add to backend
          oldest_days: 0, // TODO: Add to backend
        },
        quick_stats: {
          total_verified: metrics.verified_employees,
          total_rejected: metrics.rejected_employees,
          completion_rate: metrics.verified_employees / (metrics.total_employees || 1),
        },
      };
    },
    enabled: !!accessToken && isAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds - real-time updates
  });
};

// ============================================================================
// PENDING REVIEW QUERIES (4-STAGE WORKFLOW)
// ============================================================================

/**
 * Stage 1: Details Review
 */
export const usePendingDetailsReviews = (limit = 50) => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.pendingReviews.details(limit),
    queryFn: async (): Promise<PendingReview[]> => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.getPendingDetailsReviews(limit);
    },
    enabled: !!accessToken && isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Stage 2: Documents Review
 */
export const usePendingDocumentsReviews = (limit = 50) => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.pendingReviews.documents(limit),
    queryFn: async (): Promise<PendingReview[]> => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.getPendingDocumentsReviews(limit);
    },
    enabled: !!accessToken && isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Stage 3: Role Assignment
 */
export const usePendingRoleAssignments = (limit = 50) => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.pendingReviews.roles(limit),
    queryFn: async (): Promise<PendingReview[]> => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.getPendingRoleAssignments(limit);
    },
    enabled: !!accessToken && isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Stage 4: Final Approval
 */
export const usePendingFinalApprovals = (limit = 50) => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.pendingReviews.final(limit),
    queryFn: async (): Promise<PendingReview[]> => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.getPendingFinalApprovals(limit);
    },
    enabled: !!accessToken && isAdmin,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// ============================================================================
// EMPLOYEE REVIEW QUERIES
// ============================================================================

/**
 * Get employee details for review
 */
export const useEmployeeForReview = (employeeId: string) => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.employeeForReview(employeeId),
    queryFn: async (): Promise<EmployeeData> => {
      if (!isAdmin) throw new Error('Admin access required');
      // Get specific employee data for admin review
      employeeService.setAccessToken(accessToken);

      
      // Get employee data from admin endpoint - try to find the employee in the reviews
      // First, let's try to get the employee from all employees list and find by ID
      const allEmployees = await employeeService.getAllEmployees();
      const employeeData = allEmployees.find(emp => emp.id === employeeId);
      

      
      if (!employeeData) {
        throw new Error('Employee data not found');
      }
      
      return employeeData;
    },
    enabled: !!employeeId && !!accessToken && isAdmin,
  });
};

/**
 * Get employee documents for review
 */
export const useEmployeeDocumentsForReview = (employeeId: string) => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.employeeDocumentsForReview(employeeId),
    queryFn: async (): Promise<DocumentReviewData[]> => {
      if (!isAdmin) throw new Error('Admin access required');
      const documents = await adminService.getEmployeeDocumentsForReview(employeeId);
      
      // Add preview URLs to each document
      return documents.map((doc: any) => ({
        ...doc,
        url: adminService.getDocumentPreviewUrl(doc.id)
      }));
    },
    enabled: !!employeeId && !!accessToken && isAdmin,
  });
};

// ============================================================================
// STAGE-SPECIFIC MUTATION HOOKS
// ============================================================================

/**
 * Approve Details (Stage 1)
 */
export const useApproveDetails = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeId, notes }: { employeeId: string; notes?: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.approveDetails(employeeId, notes);
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
};

/**
 * Approve Documents (Stage 2)
 */
export const useApproveDocuments = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeId, notes }: { employeeId: string; notes?: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.approveDocuments(employeeId, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
};

/**
 * Assign Role (Stage 3)
 */
export const useAssignRole = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeId, roleCode, notes }: { employeeId: string; roleCode: string; notes?: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.assignRole(employeeId, roleCode, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
};

/**
 * Final Approve (Stage 4)
 */
export const useFinalApprove = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeId, notes }: { employeeId: string; notes?: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.finalApprove(employeeId, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
};

/**
 * Reject at Stage
 */
export const useRejectAtStage = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeId, reason, stage }: { employeeId: string; reason: string; stage?: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.rejectAtStage(employeeId, reason, stage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
};

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Bulk Approval
 */
export const useBulkApproval = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeIds, stage, notes }: { employeeIds: string[]; stage: string; notes?: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.bulkApproveStage(employeeIds, stage, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
};

/**
 * Bulk Document Approval
 */
export const useBulkDocumentApproval = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentIds, notes }: { documentIds: string[]; notes?: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.bulkApproveDocuments(documentIds, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
};

/**
 * Bulk Reject
 */
export const useBulkReject = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeIds, reason, stage }: { employeeIds: string[]; reason: string; stage?: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.bulkReject(employeeIds, reason, stage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.all });
      queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() });
    },
  });
};

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

/**
 * Approve individual document
 */
export const useApproveDocument = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, notes }: { documentId: string; notes?: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.approveDocument(documentId, notes);
    },
    onSuccess: (_, variables) => {
      // Invalidate document queries for the specific employee
      queryClient.invalidateQueries({ queryKey: [...ADMIN_BASE, 'employee-documents-review'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.documents() });
    },
  });
};

/**
 * Reject individual document
 */
export const useRejectDocument = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, reason }: { documentId: string; reason: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.rejectDocument(documentId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ADMIN_BASE, 'employee-documents-review'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.documents() });
    },
  });
};

/**
 * Request document replacement
 */
export const useRequestDocumentReplacement = () => {
  const { accessToken, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, reason }: { documentId: string; reason: string }) => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.requestDocumentReplacement(documentId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ADMIN_BASE, 'employee-documents-review'] });
      queryClient.invalidateQueries({ queryKey: adminKeys.pendingReviews.documents() });
    },
  });
};

/**
 * Download document
 */
export const useDownloadDocument = () => {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const blob = await adminService.downloadDocument(documentId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `document_${documentId}`; // Backend should provide filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    },
  });
};

// ============================================================================
// AUDIT AND COMPLIANCE
// ============================================================================

/**
 * Get audit logs
 */
export const useAuditLogs = (filters?: any) => {
  const { accessToken, isAdmin } = useAuth();

  return useQuery({
    queryKey: adminKeys.auditLogs(filters),
    queryFn: async () => {
      if (!isAdmin) throw new Error('Admin access required');
      return adminService.getAuditLogs(filters);
    },
    enabled: !!accessToken && isAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};