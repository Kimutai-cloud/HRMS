/**
 * Document Management Service
 * Handles all document-related API operations using the centralized API layer
 */

import { documentService } from './serviceFactory';
import { type DocumentStatus } from '../types/auth';

export interface DocumentUploadData {
  document_type: 'id_card' | 'passport' | 'driver_license' | 'resume' | 'contract' | 'tax_form' | 'other';
  description?: string;
  is_required?: boolean;
  expires_at?: string;
}

export interface DocumentMetadata {
  id: string;
  employee_id: string;
  document_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  description?: string;
  upload_date: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  comments?: string;
  is_required: boolean;
  expires_at?: string;
  download_url?: string;
}

export interface DocumentReviewData {
  status: 'approved' | 'rejected';
  comments?: string;
  requires_resubmission?: boolean;
}

export interface DocumentSearchFilters {
  employee_id?: string;
  document_type?: string;
  status?: 'pending' | 'approved' | 'rejected';
  is_required?: boolean;
  uploaded_after?: string;
  uploaded_before?: string;
  reviewed_by?: string;
  expires_before?: string; // Documents expiring before this date
  limit?: number;
  offset?: number;
}

export interface BulkDocumentAction {
  document_ids: string[];
  action: 'approve' | 'reject' | 'delete';
  comments?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  document_type: string;
  description: string;
  is_required: boolean;
  max_file_size: number;
  allowed_mime_types: string[];
  instructions?: string;
  example_url?: string;
}

class DocumentManagementService {
  /**
   * Upload a document for an employee
   */
  async uploadDocument(
    file: File,
    data: DocumentUploadData,
    employeeId?: string
  ): Promise<DocumentMetadata> {
    try {
      const endpoint = employeeId ? `/employees/${employeeId}/documents` : '/employees/me/documents';
      
      return await documentService.upload<DocumentMetadata>(endpoint, file, {
        document_type: data.document_type,
        description: data.description || '',
        is_required: data.is_required?.toString() || 'false',
        expires_at: data.expires_at || '',
      });
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
  }

  /**
   * Get documents for an employee
   */
  async getEmployeeDocuments(employeeId?: string): Promise<DocumentMetadata[]> {
    try {
      const endpoint = employeeId ? `/employees/${employeeId}/documents` : '/employees/me/documents';
      return await documentService.get<DocumentMetadata[]>(endpoint);
    } catch (error) {
      console.error('Failed to fetch employee documents:', error);
      throw error;
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<DocumentMetadata> {
    try {
      return await documentService.get<DocumentMetadata>(`/documents/${documentId}`);
    } catch (error) {
      console.error('Failed to fetch document:', error);
      throw error;
    }
  }

  /**
   * Download a document
   */
  async downloadDocument(documentId: string, filename?: string): Promise<void> {
    try {
      await documentService.download(`/documents/${documentId}/download`, filename);
    } catch (error) {
      console.error('Failed to download document:', error);
      throw error;
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(documentId: string, data: Partial<DocumentUploadData>): Promise<DocumentMetadata> {
    try {
      return await documentService.put<DocumentMetadata>(`/documents/${documentId}`, data);
    } catch (error) {
      console.error('Failed to update document:', error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await documentService.delete(`/documents/${documentId}`);
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }

  /**
   * Review a document (approve/reject)
   */
  async reviewDocument(documentId: string, reviewData: DocumentReviewData): Promise<DocumentMetadata> {
    try {
      return await documentService.post<DocumentMetadata>(`/documents/${documentId}/review`, {
        ...reviewData,
        reviewed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to review document:', error);
      throw error;
    }
  }

  /**
   * Get all documents (admin/manager view)
   */
  async getAllDocuments(filters: DocumentSearchFilters = {}): Promise<{
    documents: DocumentMetadata[];
    total: number;
    offset: number;
    limit: number;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `/documents${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await documentService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch all documents:', error);
      throw error;
    }
  }

  /**
   * Get pending documents for review
   */
  async getPendingDocuments(limit = 50, offset = 0): Promise<{
    documents: DocumentMetadata[];
    total: number;
  }> {
    try {
      return await this.getAllDocuments({
        status: 'pending',
        limit,
        offset,
      });
    } catch (error) {
      console.error('Failed to fetch pending documents:', error);
      throw error;
    }
  }

  /**
   * Bulk action on documents
   */
  async bulkActionDocuments(action: BulkDocumentAction): Promise<{
    processed: number;
    failed: Array<{ document_id: string; error: string }>;
  }> {
    try {
      return await documentService.post('/documents/bulk-action', action);
    } catch (error) {
      console.error('Failed to perform bulk action on documents:', error);
      throw error;
    }
  }

  /**
   * Get document templates
   */
  async getDocumentTemplates(): Promise<DocumentTemplate[]> {
    try {
      return await documentService.get<DocumentTemplate[]>('/document-templates');
    } catch (error) {
      console.error('Failed to fetch document templates:', error);
      throw error;
    }
  }

  /**
   * Get required documents for employee
   */
  async getRequiredDocuments(employeeId?: string): Promise<{
    required: DocumentTemplate[];
    submitted: DocumentMetadata[];
    missing: DocumentTemplate[];
  }> {
    try {
      const endpoint = employeeId 
        ? `/employees/${employeeId}/required-documents` 
        : '/employees/me/required-documents';
      
      return await documentService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch required documents:', error);
      throw error;
    }
  }

  /**
   * Check document compliance for employee
   */
  async checkDocumentCompliance(employeeId?: string): Promise<{
    is_compliant: boolean;
    total_required: number;
    submitted: number;
    approved: number;
    missing: string[];
    expired: string[];
    rejected: string[];
    compliance_percentage: number;
  }> {
    try {
      const endpoint = employeeId 
        ? `/employees/${employeeId}/document-compliance` 
        : '/employees/me/document-compliance';
      
      return await documentService.get(endpoint);
    } catch (error) {
      console.error('Failed to check document compliance:', error);
      throw error;
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStatistics(departmentId?: string): Promise<{
    total_documents: number;
    pending_review: number;
    approved: number;
    rejected: number;
    expired: number;
    by_type: Array<{
      document_type: string;
      count: number;
      pending: number;
      approved: number;
      rejected: number;
    }>;
    by_department?: Array<{
      department: string;
      total: number;
      compliance_rate: number;
    }>;
    recent_uploads: number; // Last 7 days
  }> {
    try {
      const endpoint = departmentId 
        ? `/documents/statistics?department=${departmentId}` 
        : '/documents/statistics';
      
      return await documentService.get(endpoint);
    } catch (error) {
      console.error('Failed to fetch document statistics:', error);
      throw error;
    }
  }

  /**
   * Generate document report
   */
  async generateDocumentReport(
    format: 'csv' | 'xlsx' | 'pdf' = 'csv',
    filters: DocumentSearchFilters = {}
  ): Promise<void> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', format);
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      await documentService.download(
        `/documents/report?${queryParams.toString()}`, 
        `document-report-${new Date().toISOString().split('T')[0]}.${format}`
      );
    } catch (error) {
      console.error('Failed to generate document report:', error);
      throw error;
    }
  }

  /**
   * Get document activity log
   */
  async getDocumentActivity(documentId: string): Promise<Array<{
    id: string;
    action: 'uploaded' | 'reviewed' | 'approved' | 'rejected' | 'downloaded' | 'deleted';
    performed_by: string;
    performed_at: string;
    details?: string;
    ip_address?: string;
  }>> {
    try {
      return await documentService.get(`/documents/${documentId}/activity`);
    } catch (error) {
      console.error('Failed to fetch document activity:', error);
      throw error;
    }
  }

  /**
   * Request document resubmission
   */
  async requestResubmission(documentId: string, reason: string): Promise<DocumentMetadata> {
    try {
      return await documentService.post<DocumentMetadata>(`/documents/${documentId}/request-resubmission`, {
        reason,
        requested_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to request document resubmission:', error);
      throw error;
    }
  }

  /**
   * Set document expiration reminder
   */
  async setExpirationReminder(
    documentId: string, 
    reminderDays: number = 30
  ): Promise<void> {
    try {
      await documentService.post(`/documents/${documentId}/expiration-reminder`, {
        reminder_days_before: reminderDays,
      });
    } catch (error) {
      console.error('Failed to set expiration reminder:', error);
      throw error;
    }
  }

  /**
   * Get expiring documents
   */
  async getExpiringDocuments(days: number = 30): Promise<DocumentMetadata[]> {
    try {
      return await documentService.get<DocumentMetadata[]>(`/documents/expiring?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch expiring documents:', error);
      throw error;
    }
  }

  /**
   * Verify document authenticity (if supported)
   */
  async verifyDocument(documentId: string): Promise<{
    is_authentic: boolean;
    confidence_score: number;
    verification_details: Record<string, any>;
    verified_at: string;
  }> {
    try {
      return await documentService.post(`/documents/${documentId}/verify`);
    } catch (error) {
      console.error('Failed to verify document:', error);
      throw error;
    }
  }
}

// Create singleton instance
const documentManagementService = new DocumentManagementService();

export default documentManagementService;