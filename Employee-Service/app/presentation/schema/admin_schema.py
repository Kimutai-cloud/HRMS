from pydantic import BaseModel, Field, field_validator, validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.core.entities.employee import Employee
from app.core.entities.document import DocumentType, DocumentReviewStatus


# Dashboard and Summary Schemas

class PendingReviewsStats(BaseModel):
    """Statistics for pending reviews at each stage."""
    details: int = Field(..., description="Profiles pending details review")
    documents: int = Field(..., description="Profiles pending documents review")
    roles: int = Field(..., description="Profiles pending role assignment")
    final: int = Field(..., description="Profiles pending final approval")
    total: int = Field(..., description="Total profiles pending review")


class DocumentReviewStats(BaseModel):
    """Statistics for document reviews."""
    pending: int = Field(..., description="Documents pending review")
    requires_replacement: int = Field(..., description="Documents requiring replacement")
    total_pending: int = Field(..., description="Total documents requiring attention")


class UrgentItemsStats(BaseModel):
    """Statistics for urgent items requiring attention."""
    count: int = Field(..., description="Number of urgent items")
    oldest_days: int = Field(..., description="Days since oldest urgent item")


class QuickStats(BaseModel):
    """Quick statistics for overview."""
    total_verified: int = Field(..., description="Total verified employees")
    total_rejected: int = Field(..., description="Total rejected profiles")
    completion_rate: float = Field(..., description="Verification completion rate percentage")


class AdminDashboardResponse(BaseModel):
    """Comprehensive admin dashboard response."""
    pending_reviews: PendingReviewsStats
    document_reviews: DocumentReviewStats
    urgent_items: UrgentItemsStats
    quick_stats: QuickStats


# Review Management Schemas

class PendingReviewResponse(BaseModel):
    """Response for a single pending review."""
    employee: Employee
    documents_summary: Optional[Dict[str, Any]] = None
    days_pending: int = Field(..., description="Days since submission/last update")
    priority: str = Field(..., description="Priority level: low, normal, high, urgent")
    current_stage: str = Field(..., description="Current review stage")
    
    class Config:
        from_attributes = True


# Request Schemas for Review Actions

class ApproveDetailsRequest(BaseModel):
    """Request to approve employee details."""
    notes: Optional[str] = Field(None, max_length=1000, description="Optional review notes")


class ApproveDocumentsRequest(BaseModel):
    """Request to approve employee documents."""
    notes: Optional[str] = Field(None, max_length=1000, description="Optional review notes")


class AssignRoleRequest(BaseModel):
    """Request to assign role to employee."""
    role_code: str = Field(..., description="Role code to assign (EMPLOYEE, MANAGER)")
    notes: Optional[str] = Field(None, max_length=1000, description="Optional assignment notes")
    
    @validator('role_code')
    def validate_role_code(cls, v):
        allowed_roles = ['EMPLOYEE', 'MANAGER']  # Not allowing ADMIN assignment through this endpoint
        if v not in allowed_roles:
            raise ValueError(f'Role code must be one of: {allowed_roles}')
        return v


class FinalApprovalRequest(BaseModel):
    """Request for final approval."""
    notes: Optional[str] = Field(None, max_length=1000, description="Optional final approval notes")


class RejectProfileRequest(BaseModel):
    """Request to reject employee profile."""
    reason: str = Field(..., min_length=10, max_length=2000, description="Detailed rejection reason")
    stage: Optional[str] = Field(None, description="Current stage where rejection occurs")
    
    @validator('reason')
    def validate_reason(cls, v):
        if not v or not v.strip():
            raise ValueError('Rejection reason cannot be empty')
        return v.strip()


class BulkApprovalRequest(BaseModel):
    """Request for bulk approval of multiple employees."""
    employee_ids: List[UUID] = Field(..., min_items=1, max_items=50, description="List of employee IDs to approve")
    stage: str = Field(..., description="Stage to approve (DETAILS_REVIEW, DOCUMENTS_REVIEW, FINAL_APPROVAL)")
    notes: Optional[str] = Field(None, max_length=1000, description="Optional notes for all approvals")
    
    @validator('stage')
    def validate_stage(cls, v):
        allowed_stages = ['DETAILS_REVIEW', 'DOCUMENTS_REVIEW', 'FINAL_APPROVAL']
        if v not in allowed_stages:
            raise ValueError(f'Stage must be one of: {allowed_stages}')
        return v
    
    @validator('employee_ids')
    def validate_employee_ids(cls, v):
        if len(set(v)) != len(v):
            raise ValueError('Duplicate employee IDs not allowed')
        return v


# Document Management Schemas

class DocumentReviewRequest(BaseModel):
    """Request for document review action."""
    notes: Optional[str] = Field(None, max_length=1000, description="Review notes or rejection reason")


class DocumentReviewResponse(BaseModel):
    """Response for document review information."""
    id: UUID
    document_type: DocumentType
    display_name: str
    file_name: str
    file_size: int
    mime_type: str
    uploaded_at: datetime
    review_status: DocumentReviewStatus
    review_notes: Optional[str]
    reviewed_at: Optional[datetime]
    is_required: bool
    can_preview: bool = Field(..., description="Whether document can be previewed in browser")
    
    class Config:
        from_attributes = True


class BulkDocumentActionRequest(BaseModel):
    """Request for bulk document actions."""
    document_ids: List[UUID] = Field(..., min_items=1, max_items=20, description="List of document IDs")
    action: str = Field(..., description="Action to perform (approve, reject, request_replacement)")
    notes: Optional[str] = Field(None, max_length=1000, description="Notes for all documents")
    
    @field_validator('action')
    def validate_action(cls, v):
        allowed_actions = ['approve', 'reject', 'request_replacement']
        if v not in allowed_actions:
            raise ValueError(f'Action must be one of: {allowed_actions}')
        return v
    
    @field_validator('document_ids')
    def validate_document_ids(cls, v):
        if len(set(v)) != len(v):
            raise ValueError('Duplicate document IDs not allowed')
        return v
    
class BulkDocumentApprovalRequest(BaseModel):
    """Request for bulk document approval."""
    document_ids: List[UUID] = Field(..., min_items=1, max_items=50)
    notes: Optional[str] = Field(None, max_length=1000)
    
    @field_validator('document_ids')
    def validate_document_ids(cls, v):
        if len(set(v)) != len(v):
            raise ValueError('Duplicate document IDs not allowed')
        return v

class BulkNotificationRequest(BaseModel):
    """Request for bulk notifications."""
    user_ids: List[UUID] = Field(..., min_items=1, max_items=100)
    notification_type: str = Field(..., description="Notification type")
    title: str = Field(..., max_length=255)
    message: str = Field(..., max_length=2000)
    additional_data: Optional[Dict[str, Any]] = None


# Analytics and Reporting Schemas

class VerificationAnalytics(BaseModel):
    """Analytics data for verification process."""
    total_submitted: int
    total_verified: int
    total_rejected: int
    total_pending: int
    average_processing_days: float
    stage_bottlenecks: Dict[str, int]
    monthly_trends: List[Dict[str, Any]]


class StagePerformanceMetrics(BaseModel):
    """Performance metrics for each verification stage."""
    stage: str
    average_time_days: float
    pending_count: int
    completed_this_month: int
    bottleneck_score: float  # Higher = more of a bottleneck


class AdminPerformanceResponse(BaseModel):
    """Admin performance and workload response."""
    admin_id: UUID
    admin_name: str
    reviews_completed_this_month: int
    average_review_time_hours: float
    pending_assignments: int
    efficiency_score: float


# Search and Filter Schemas

class EmployeeSearchRequest(BaseModel):
    """Request for employee search with filters."""
    search_term: Optional[str] = Field(None, max_length=100, description="Search in name, email, department")
    verification_status: Optional[str] = Field(None, description="Filter by verification status")
    department: Optional[str] = Field(None, description="Filter by department")
    submitted_after: Optional[datetime] = Field(None, description="Filter by submission date")
    submitted_before: Optional[datetime] = Field(None, description="Filter by submission date")
    priority: Optional[str] = Field(None, description="Filter by priority (low, normal, high, urgent)")
    page: int = Field(1, ge=1, description="Page number")
    size: int = Field(20, ge=1, le=100, description="Page size")
    sort_by: str = Field("submitted_at", description="Sort field")
    sort_order: str = Field("desc", pattern="^(asc|desc)$", description="Sort order")


class AdvancedSearchResponse(BaseModel):
    """Response for advanced employee search."""
    employees: List[PendingReviewResponse]
    total: int
    page: int
    size: int
    pages: int
    filters_applied: Dict[str, Any]


# Notification and Communication Schemas

class NotificationRequest(BaseModel):
    """Request to send notification to user."""
    user_id: UUID
    notification_type: str = Field(..., description="Type of notification")
    title: str = Field(..., max_length=255, description="Notification title")
    message: str = Field(..., max_length=2000, description="Notification message")
    send_email: bool = Field(True, description="Whether to send email notification")
    additional_data: Optional[Dict[str, Any]] = Field(None, description="Additional notification data")


class BulkNotificationRequest(BaseModel):
    """Request to send bulk notifications."""
    user_ids: List[UUID] = Field(..., min_items=1, max_items=100)
    notification_type: str
    title: str = Field(..., max_length=255)
    message: str = Field(..., max_length=2000)
    send_email: bool = Field(True)
    additional_data: Optional[Dict[str, Any]] = None


# System Configuration Schemas

class VerificationConfigRequest(BaseModel):
    """Request to update verification configuration."""
    auto_approve_documents: bool = Field(False, description="Auto-approve certain document types")
    require_manager_approval: bool = Field(True, description="Require manager approval for team members")
    notification_settings: Dict[str, bool] = Field(..., description="Notification preferences")
    document_retention_days: int = Field(365, ge=30, le=2555, description="Document retention period")
    max_resubmissions: int = Field(3, ge=1, le=10, description="Maximum profile resubmissions allowed")


class SystemHealthResponse(BaseModel):
    """System health and status response."""
    service_status: str
    database_status: str
    auth_service_connection: str
    pending_reviews_count: int
    urgent_items_count: int
    system_load: float
    last_updated: datetime


# Audit and Compliance Schemas

class AuditLogEntry(BaseModel):
    """Single audit log entry."""
    id: UUID
    entity_type: str
    entity_id: UUID
    action: str
    user_id: UUID
    user_name: Optional[str]
    changes: Dict[str, Any]
    timestamp: datetime
    ip_address: Optional[str]
    user_agent: Optional[str]


class AuditLogResponse(BaseModel):
    """Response for audit log queries."""
    entries: List[AuditLogEntry]
    total_count: int
    has_more: bool


class ComplianceReportRequest(BaseModel):
    """Request for compliance report generation."""
    report_type: str = Field(..., description="Type of compliance report")
    start_date: datetime = Field(..., description="Report start date")
    end_date: datetime = Field(..., description="Report end date")
    include_sensitive_data: bool = Field(False, description="Include sensitive data in report")
    format: str = Field("json", pattern="^(json|csv|pdf)$", description="Report format")



class AdminWorkflowExample(BaseModel):
    """Example workflow for admin operations."""
