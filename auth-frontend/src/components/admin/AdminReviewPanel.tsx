import React, { useState } from 'react';
import { useEmployeeForReview, useEmployeeDocumentsForReview } from '@/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import adminService from '@/services/adminService';
import DetailsReviewPanel from './panels/DetailsReviewPanel';
import DocumentsReviewPanel from './panels/DocumentsReviewPanel';
import RolesReviewPanel from './panels/RolesReviewPanel';
import FinalApprovalPanel from './panels/FinalApprovalPanel';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2 } from 'lucide-react';

interface AdminReviewPanelProps {
  employeeId: string;
  stage: 'details' | 'documents' | 'roles' | 'final';
  onComplete: (success: boolean) => void;
  readOnly?: boolean;
}

const AdminReviewPanel: React.FC<AdminReviewPanelProps> = ({
  employeeId,
  stage,
  onComplete,
  readOnly = false
}) => {
  const { data: employee, isLoading, error } = useEmployeeForReview(employeeId);
  const { data: employeeDocuments, isLoading: documentsLoading, error: documentsError } = useEmployeeDocumentsForReview(employeeId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Using imported singleton instance
  const [isProcessing, setIsProcessing] = useState(false);
  


  if (isLoading || (stage === 'documents' && documentsLoading)) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mr-3" />
          <span>Loading employee data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || (stage === 'documents' && documentsError)) {
    const errorMessage = error?.message || documentsError?.message || 'Unknown error';
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-red-600">
            Error loading employee data: {errorMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!employee) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-muted-foreground">Employee not found</div>
        </CardContent>
      </Card>
    );
  }

  const handleStageComplete = (success: boolean) => {
    onComplete(success);
  };

  // Real API handlers for the panels
  const handleDetailsApprove = async (notes: string) => {
    setIsProcessing(true);
    try {
      await adminService.approveDetails(employeeId, notes);
      toast({
        title: "Details Approved",
        description: `${employee?.first_name || 'Employee'}'s details have been verified and approved`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      handleStageComplete(true);
    } catch (error) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error approving details:', error);
      }
      toast({
        title: "Approval Failed",
        description: "Unable to approve the employee details. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDetailsReject = async (reason: string) => {
    setIsProcessing(true);
    try {
      await adminService.rejectDetails(employeeId, reason);
      toast({
        title: "Details Rejected",
        description: `${employee?.first_name || 'Employee'}'s details have been rejected and they will be notified to make corrections`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      handleStageComplete(false);
    } catch (error) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error rejecting details:', error);
      }
      toast({
        title: "Error",
        description: "Failed to reject details verification",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDetailsRequestChanges = async (changes: string) => {
    try {
      await adminService.requestDetailsChanges(employeeId, changes);
      toast({
        title: "Changes Requested",
        description: `${employee?.first_name || 'Employee'} will be notified about the requested changes to their details`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      // This doesn't complete the stage but sends back for corrections
    } catch (error) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error requesting changes:', error);
      }
      toast({
        title: "Error",
        description: "Failed to send change request",
        variant: "destructive",
      });
    }
  };

  const handleDocumentsApprove = async (notes: string) => {
    setIsProcessing(true);
    try {
      await adminService.approveDocuments(employeeId, notes);
      toast({
        title: "All Documents Approved",
        description: `${employee?.first_name || 'Employee'}'s documents have been approved and they can proceed to role assignment`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      handleStageComplete(true);
    } catch (error: any) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error approving documents:', error);
      }
      
      // Handle specific workflow validation errors
      let errorMessage = "Failed to approve documents verification";
      let errorTitle = "Error";
      
      if (error?.message?.includes('PENDING_DETAILS_REVIEW')) {
        errorTitle = "Details Review Required";
        errorMessage = "Please complete the details review stage first before approving documents.";
      } else if (error?.message?.includes('pending documents')) {
        errorTitle = "Pending Documents Found";
        errorMessage = "Some documents are still pending approval. Please review all individual documents first.";
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDocumentsReject = async (reason: string) => {
    try {
      await adminService.rejectDocuments(employeeId, reason);
      toast({
        title: "Documents Rejected",
        description: `${employee?.first_name || 'Employee'}'s documents have been rejected and they will be notified to resubmit`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      handleStageComplete(false);
    } catch (error) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error rejecting documents:', error);
      }
      toast({
        title: "Error",
        description: "Failed to reject employee documents",
        variant: "destructive",
      });
    }
  };

  const handleDocumentApprove = async (documentId: string, notes: string) => {
    try {
      await adminService.approveDocument(documentId, notes);
      
      // Find document name for user-friendly notification
      const document = employeeDocuments?.find(doc => doc.id === documentId);
      const documentName = document?.display_name || document?.document_type || 'Document';
      
      toast({
        title: "Document Approved",
        description: `${documentName} has been approved successfully`,
      });
      
      // Invalidate and refetch queries
      await queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      
      // Small delay to ensure data is refreshed
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      }, 500);
      
    } catch (error) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error approving document:', error);
      }
      toast({
        title: "Approval Failed",
        description: "Unable to approve the document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDocumentReject = async (documentId: string, reason: string) => {
    try {
      await adminService.rejectDocument(documentId, reason);
      
      // Find document name for user-friendly notification
      const document = employeeDocuments?.find(doc => doc.id === documentId);
      const documentName = document?.display_name || document?.document_type || 'Document';
      
      toast({
        title: "Document Rejected",
        description: `${documentName} has been rejected and employee will be notified`,
      });
      
      // Invalidate and refetch queries
      await queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      
      // Small delay to ensure data is refreshed
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      }, 500);
      
    } catch (error) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error rejecting document:', error);
      }
      toast({
        title: "Rejection Failed", 
        description: "Unable to reject the document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDocumentDownload = async (documentId: string) => {
    try {
      const blob = await adminService.downloadDocument(documentId);
      
      // Get the document info for filename
      const document = employeeDocuments?.find(doc => doc.id === documentId);
      const filename = document?.file_name || `document-${documentId}`;
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Complete",
        description: `${filename} has been downloaded to your device`,
      });
    } catch (error) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error downloading document:', error);
      }
      toast({
        title: "Download Failed",
        description: "Unable to download the document. The file may not be available or there's a connection issue.",
        variant: "destructive",
      });
    }
  };

  const handleRolesApprove = async (assignedRoles: string[], notes: string) => {
    setIsProcessing(true);
    try {
      // Convert role ID to role code (backend expects role_code like 'EMPLOYEE', 'MANAGER')
      const roleIdToCodeMap: Record<string, string> = {
        'employee-role': 'EMPLOYEE',
        'manager-role': 'MANAGER', 
        'admin-role': 'ADMIN'
      };
      
      const selectedRoleId = assignedRoles[0] || 'employee-role';
      const roleCode = roleIdToCodeMap[selectedRoleId] || 'EMPLOYEE';
      await adminService.assignRole(employeeId, roleCode, notes);
      toast({
        title: "Role Assigned",
        description: `${employee?.first_name || 'Employee'} has been assigned the ${roleCode.toLowerCase()} role and can proceed to final approval`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      handleStageComplete(true);
    } catch (error: any) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error approving roles:', error);
      }
      
      // Handle specific workflow validation errors
      let errorMessage = "Failed to approve role assignment";
      let errorTitle = "Error";
      
      if (error?.message?.includes('PENDING_DOCUMENTS_REVIEW')) {
        errorTitle = "Documents Review Required";
        errorMessage = "Please complete the documents review stage first before assigning roles.";
      } else if (error?.message?.includes('PENDING_DETAILS_REVIEW')) {
        errorTitle = "Details Review Required";  
        errorMessage = "Please complete the details review stage first.";
      } else if (error?.message?.includes('Cannot assign role')) {
        errorTitle = "Workflow Validation Error";
        errorMessage = "This employee is not ready for role assignment. Please complete previous stages first.";
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRolesReject = async (reason: string) => {
    try {
      await adminService.rejectRoles(employeeId, reason);
      toast({
        title: "Roles Rejected",
        description: `${employee?.first_name || 'Employee'}'s role assignment has been rejected and they will be notified`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      handleStageComplete(false);
    } catch (error) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error rejecting roles:', error);
      }
      toast({
        title: "Error",
        description: "Failed to reject employee roles",
        variant: "destructive",
      });
    }
  };

  const handleFinalApprove = async (notes: string, grantAccess: boolean) => {
    setIsProcessing(true);
    try {
      await adminService.finalApprove(employeeId, notes);
      toast({
        title: "Approval Complete",
        description: `${employee?.first_name || 'Employee'} is now fully approved and has been granted system access`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      handleStageComplete(true);
    } catch (error: any) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error final approve:', error);
      }
      
      // Handle specific workflow validation errors
      let errorMessage = "Failed to complete final approval";
      let errorTitle = "Error";
      
      if (error?.message?.includes('PENDING_ROLE_ASSIGNMENT')) {
        errorTitle = "Role Assignment Required";
        errorMessage = "Please complete the role assignment stage first before final approval.";
      } else if (error?.message?.includes('PENDING_DOCUMENTS_REVIEW')) {
        errorTitle = "Documents Review Required";
        errorMessage = "Please complete the documents review stage first.";
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalReject = async (reason: string) => {
    try {
      await adminService.finalReject(employeeId, reason);
      toast({
        title: "Application Rejected",
        description: `${employee?.first_name || 'Employee'}'s application has been rejected and they will be notified of the decision`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'employee-documents', employeeId] });
      handleStageComplete(false);
    } catch (error) {
      // Log error for debugging but don't expose to user
      if (process.env.NODE_ENV === 'development') {
        console.error('Error final reject:', error);
      }
      toast({
        title: "Error",
        description: "Failed to reject final approval",
        variant: "destructive",
      });
    }
  };

  // Render appropriate panel based on stage
  switch (stage) {
    case 'details':
      return (
        <DetailsReviewPanel
          employee={employee}
          onApprove={handleDetailsApprove}
          onReject={handleDetailsReject}
          onRequestChanges={handleDetailsRequestChanges}
          readOnly={readOnly}
          isProcessing={isProcessing}
        />
      );

    case 'documents':
      // Transform API documents to match DocumentsReviewPanel interface
      const transformedDocuments = (employeeDocuments || []).map(doc => ({
        id: doc.id,
        filename: doc.file_name,
        file_type: doc.mime_type || 'application/octet-stream',
        file_size: doc.file_size,
        upload_date: doc.uploaded_at,
        status: doc.review_status?.toLowerCase() || 'pending',
        document_type: doc.display_name || doc.document_type,
        notes: doc.review_notes,
        approval_date: doc.reviewed_at,
        approved_by: doc.reviewed_by,
        rejection_reason: doc.review_notes,
        url: `${import.meta.env.VITE_EMPLOYEE_SERVICE_URL || 'http://localhost:8001/api/v1'}/admin/documents/${doc.id}/download`
      }));

      // Transform employee data to match DocumentsReviewPanel interface
      const documentsEmployee = {
        ...employee,
        documents: transformedDocuments,
        documents_summary: {
          total_documents: employeeDocuments?.length || 0,
          approved_documents: employeeDocuments?.filter(d => d.review_status === 'APPROVED').length || 0,
          pending_documents: employeeDocuments?.filter(d => d.review_status === 'PENDING').length || 0,
          rejected_documents: employeeDocuments?.filter(d => d.review_status === 'REJECTED' || d.review_status === 'REQUIRES_REPLACEMENT').length || 0,
        }
      };
      return (
        <DocumentsReviewPanel
          employee={documentsEmployee}
          onApprove={handleDocumentsApprove}
          onReject={handleDocumentsReject}
          onDocumentApprove={handleDocumentApprove}
          onDocumentReject={handleDocumentReject}
          onDownload={handleDocumentDownload}
          readOnly={readOnly}
          isProcessing={isProcessing}
        />
      );

    case 'roles':
      // Transform employee data to match RolesReviewPanel interface
      // For now, create mock role data based on common roles
      const mockRoles = [
        {
          id: 'employee-role',
          code: 'EMPLOYEE', 
          name: 'Employee',
          description: 'Standard employee access',
          permissions: ['profile:read', 'profile:write', 'documents:upload'],
          level: 'LOW' as const
        },
        {
          id: 'manager-role',
          code: 'MANAGER',
          name: 'Manager', 
          description: 'Team management access',
          permissions: ['profile:read', 'profile:write', 'team:manage', 'reports:view'],
          level: 'MEDIUM' as const
        },
        {
          id: 'admin-role',
          code: 'ADMIN',
          name: 'Administrator',
          description: 'Full administrative access', 
          permissions: ['*'],
          level: 'ADMIN' as const
        }
      ];

      const rolesEmployee = {
        ...employee,
        current_roles: employee.roles || [],
        recommended_roles: [mockRoles[0]], // Recommend employee role by default
        available_roles: mockRoles
      };
      return (
        <RolesReviewPanel
          employee={rolesEmployee}
          onApprove={handleRolesApprove}
          onReject={handleRolesReject}
          readOnly={readOnly}
          isProcessing={isProcessing}
        />
      );

    case 'final':
      // Transform employee data to match FinalApprovalPanel interface
      const finalEmployee = {
        ...employee,
        completed_stages: employee.completed_stages || [],
        assigned_roles: employee.roles || [],
        approval_timeline: employee.approval_timeline
      };
      return (
        <FinalApprovalPanel
          employee={finalEmployee}
          onApprove={handleFinalApprove}
          onReject={handleFinalReject}
          readOnly={readOnly}
          isProcessing={isProcessing}
        />
      );

    default:
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">Invalid stage: {stage}</div>
          </CardContent>
        </Card>
      );
  }
};

export default AdminReviewPanel;