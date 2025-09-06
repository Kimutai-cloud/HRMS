from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone
import io

from app.application.services.notification_service import NotificationService
from app.presentation.api.dependencies import get_notification_service
from app.application.use_case.admin_review_use_cases import AdminReviewUseCase
from app.application.use_case.document_use_cases import DocumentUseCase
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.core.entities.role import RoleCode
from app.application.services.notification_service import NotificationService
from app.core.entities.document import DocumentReviewStatus
from app.presentation.schema.admin_schema import (
    AdminDashboardResponse,
    PendingReviewResponse,
    ApproveDetailsRequest,
    ApproveDocumentsRequest,
    AssignRoleRequest,
    FinalApprovalRequest,
    RejectProfileRequest,
    BulkApprovalRequest,
    BulkDocumentApprovalRequest,
    DocumentReviewRequest,
    DocumentReviewResponse,
    BulkNotificationRequest,
    AuditLogResponse,
    AuditLogEntry
)
from app.presentation.schema.common_schema import SuccessResponse
from app.presentation.api.dependencies import (
    get_admin_review_use_case,
    get_document_use_case,
    get_audit_repository,
    require_admin,
    get_request_context,
    get_notification_service,
    get_employee_use_case,
    get_employee_repository
)
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeValidationException,
    EmployeePermissionException
)
from app.core.exceptions.role_exceptions import ForbiddenException

router = APIRouter(prefix="/admin", tags=["Admin - Employee Verification"])


# Dashboard and Overview

@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard(
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case)
):
    """
    Get comprehensive admin dashboard with pending reviews and statistics.
    Admin only.
    """
    
    try:
        dashboard_data = await admin_review_use_case.get_admin_dashboard_summary(
            current_user["user_id"]
        )
        return dashboard_data
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Stage 1: Details Review

@router.get("/pending-reviews/details", response_model=List[PendingReviewResponse])
async def get_pending_details_reviews(
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case)
):
    """
    Get employees pending details review.
    Admin only.
    """
    
    try:
        pending_reviews = await admin_review_use_case.get_pending_details_reviews(
            current_user["user_id"], limit
        )
        
        return [
            PendingReviewResponse(
                employee=review.employee,
                documents_summary=review.documents_summary,
                days_pending=review.days_pending,
                priority=review.priority,
                current_stage="DETAILS_REVIEW"
            )
            for review in pending_reviews
        ]
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/reviews/{employee_id}/approve-details", response_model=SuccessResponse)
async def approve_employee_details(
    employee_id: UUID,
    request: ApproveDetailsRequest,
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Approve employee details and advance to documents review stage.
    Admin only.
    """
    
    try:
        updated_employee = await admin_review_use_case.approve_details_review(
            employee_id=employee_id,
            reviewer_id=current_user["user_id"],
            notes=request.notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee",
            entity_id=employee_id,
            action="DETAILS_APPROVED",
            user_id=current_user["user_id"],
            changes={
                "previous_status": "PENDING_DETAILS_REVIEW",
                "new_status": "PENDING_DOCUMENTS_REVIEW",
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(
            message=f"Employee details approved. Advanced to documents review stage."
        )
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Stage 2: Documents Review

@router.get("/pending-reviews/documents", response_model=List[PendingReviewResponse])
async def get_pending_documents_reviews(
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case)
):
    """
    Get employees pending documents review.
    Admin only.
    """
    
    try:
        pending_reviews = await admin_review_use_case.get_pending_documents_reviews(
            current_user["user_id"], limit
        )
        
        return [
            PendingReviewResponse(
                employee=review.employee,
                documents_summary=review.documents_summary,
                days_pending=review.days_pending,
                priority=review.priority,
                current_stage="DOCUMENTS_REVIEW"
            )
            for review in pending_reviews
        ]
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/documents/{employee_id}", response_model=List[DocumentReviewResponse])
async def get_employee_documents_for_review(
    employee_id: UUID,
    current_user: dict = Depends(require_admin),
    document_use_case: DocumentUseCase = Depends(get_document_use_case)
):
    """
    Get all documents for an employee for admin review.
    Admin only.
    """
    
    try:
        documents = await document_use_case.get_employee_documents(
            employee_id=employee_id,
            requester_user_id=current_user["user_id"]
        )
        
        return [
            DocumentReviewResponse(
                id=doc.id,
                document_type=doc.document_type,
                display_name=doc.get_display_name(),
                file_name=doc.file_name,
                file_size=doc.file_size,
                mime_type=doc.mime_type,
                uploaded_at=doc.uploaded_at,
                review_status=doc.review_status,
                review_notes=doc.review_notes,
                reviewed_at=doc.reviewed_at,
                is_required=doc.is_required,
                can_preview=doc.mime_type.startswith(('image/', 'application/pdf'))
            )
            for doc in documents
        ]
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    except EmployeePermissionException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/documents/{document_id}/preview")
async def preview_document(
    document_id: UUID,
    current_user: dict = Depends(require_admin),
    document_use_case: DocumentUseCase = Depends(get_document_use_case)
):
    """
    Preview document file for admin review.
    Admin only.
    """
    
    try:
        content, filename, mime_type = await document_use_case.download_document(
            document_id=document_id,
            requester_user_id=current_user["user_id"]
        )
        
        # For preview, use inline disposition instead of attachment
        return StreamingResponse(
            io.BytesIO(content),
            media_type=mime_type,
            headers={"Content-Disposition": f"inline; filename={filename}"}
        )
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    except EmployeePermissionException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: UUID,
    current_user: dict = Depends(require_admin),
    document_use_case: DocumentUseCase = Depends(get_document_use_case)
):
    """
    Download document file for admin review.
    Admin only.
    """
    
    try:
        content, filename, mime_type = await document_use_case.download_document(
            document_id=document_id,
            requester_user_id=current_user["user_id"]
        )
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=mime_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    except EmployeePermissionException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/documents/{document_id}/approve", response_model=SuccessResponse)
async def approve_document(
    document_id: UUID,
    request: DocumentReviewRequest,
    current_user: dict = Depends(require_admin),
    document_use_case: DocumentUseCase = Depends(get_document_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Approve a specific document.
    Admin only.
    """
    
    try:
        updated_document = await document_use_case.approve_document(
            document_id=document_id,
            reviewer_id=current_user["user_id"],
            notes=request.notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee_document",
            entity_id=document_id,
            action="DOCUMENT_APPROVED",
            user_id=current_user["user_id"],
            changes={
                "document_type": updated_document.document_type.value,
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(message="Document approved successfully")
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )


@router.post("/documents/{document_id}/reject", response_model=SuccessResponse)
async def reject_document(
    document_id: UUID,
    request: DocumentReviewRequest,
    current_user: dict = Depends(require_admin),
    document_use_case: DocumentUseCase = Depends(get_document_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Reject a specific document.
    Admin only.
    """
    
    if not request.notes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required"
        )
    
    try:
        updated_document = await document_use_case.reject_document(
            document_id=document_id,
            reviewer_id=current_user["user_id"],
            reason=request.notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee_document",
            entity_id=document_id,
            action="DOCUMENT_REJECTED",
            user_id=current_user["user_id"],
            changes={
                "document_type": updated_document.document_type.value,
                "reason": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(message="Document rejected")
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )


@router.post("/documents/{document_id}/request-replacement", response_model=SuccessResponse)
async def request_document_replacement(
    document_id: UUID,
    request: DocumentReviewRequest,
    current_user: dict = Depends(require_admin),
    document_use_case: DocumentUseCase = Depends(get_document_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Request document replacement.
    Admin only.
    """
    
    if not request.notes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Replacement reason is required"
        )
    
    try:
        updated_document = await document_use_case.request_document_replacement(
            document_id=document_id,
            reviewer_id=current_user["user_id"],
            reason=request.notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee_document",
            entity_id=document_id,
            action="DOCUMENT_REPLACEMENT_REQUESTED",
            user_id=current_user["user_id"],
            changes={
                "document_type": updated_document.document_type.value,
                "reason": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(message="Document replacement requested")
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )


@router.post("/reviews/{employee_id}/approve-documents", response_model=SuccessResponse)
async def approve_employee_documents(
    employee_id: UUID,
    request: ApproveDocumentsRequest,
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Approve all documents for an employee and advance to role assignment stage.
    Admin only.
    """
    
    try:
        updated_employee = await admin_review_use_case.approve_documents_review(
            employee_id=employee_id,
            reviewer_id=current_user["user_id"],
            notes=request.notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee",
            entity_id=employee_id,
            action="DOCUMENTS_APPROVED",
            user_id=current_user["user_id"],
            changes={
                "previous_status": "PENDING_DOCUMENTS_REVIEW",
                "new_status": "PENDING_ROLE_ASSIGNMENT",
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(
            message="Employee documents approved. Advanced to role assignment stage."
        )
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Stage 3: Role Assignment

@router.get("/pending-reviews/roles", response_model=List[PendingReviewResponse])
async def get_pending_role_assignments(
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case)
):
    """
    Get employees pending role assignment.
    Admin only.
    """
    
    try:
        pending_reviews = await admin_review_use_case.get_pending_role_assignments(
            current_user["user_id"], limit
        )
        
        return [
            PendingReviewResponse(
                employee=review.employee,
                documents_summary=review.documents_summary,
                days_pending=review.days_pending,
                priority=review.priority,
                current_stage="ROLE_ASSIGNMENT"
            )
            for review in pending_reviews
        ]
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/reviews/{employee_id}/assign-role", response_model=SuccessResponse)
async def assign_employee_role(
    employee_id: UUID,
    request: AssignRoleRequest,
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Assign role to employee and advance to final approval stage.
    Admin only.
    """
    
    try:
        # Validate role code
        try:
            role_code = RoleCode(request.role_code)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role code: {request.role_code}"
            )
        
        updated_employee = await admin_review_use_case.assign_role_and_advance(
            employee_id=employee_id,
            role_code=role_code,
            reviewer_id=current_user["user_id"],
            notes=request.notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee",
            entity_id=employee_id,
            action="ROLE_ASSIGNED",
            user_id=current_user["user_id"],
            changes={
                "previous_status": "PENDING_ROLE_ASSIGNMENT",
                "new_status": "PENDING_FINAL_APPROVAL",
                "assigned_role": request.role_code,
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(
            message=f"Role {request.role_code} assigned. Advanced to final approval stage."
        )
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Stage 4: Final Approval

@router.get("/pending-reviews/final", response_model=List[PendingReviewResponse])
async def get_pending_final_approvals(
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case)
):
    """
    Get employees pending final approval.
    Admin only.
    """
    
    try:
        pending_reviews = await admin_review_use_case.get_pending_final_approvals(
            current_user["user_id"], limit
        )
        
        return [
            PendingReviewResponse(
                employee=review.employee,
                documents_summary=review.documents_summary,
                days_pending=review.days_pending,
                priority=review.priority,
                current_stage="FINAL_APPROVAL"
            )
            for review in pending_reviews
        ]
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/reviews/{employee_id}/final-approve", response_model=SuccessResponse)
async def final_approve_employee(
    employee_id: UUID,
    request: FinalApprovalRequest,
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Give final approval and complete employee verification.
    Admin only.
    """
    
    try:
        updated_employee = await admin_review_use_case.final_approve_employee(
            employee_id=employee_id,
            approver_id=current_user["user_id"],
            notes=request.notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee",
            entity_id=employee_id,
            action="FINAL_APPROVED",
            user_id=current_user["user_id"],
            changes={
                "previous_status": "PENDING_FINAL_APPROVAL",
                "new_status": "VERIFIED",
                "hired_at": updated_employee.hired_at.isoformat() if updated_employee.hired_at else None,
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(
            message="Employee verification completed! User now has full system access."
        )
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Rejection

@router.post("/reviews/{employee_id}/reject", response_model=SuccessResponse)
async def reject_employee_profile(
    employee_id: UUID,
    request: RejectProfileRequest,
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Reject employee profile at any stage.
    Admin only.
    """
    
    try:
        updated_employee = await admin_review_use_case.reject_employee_profile(
            employee_id=employee_id,
            reason=request.reason,
            reviewer_id=current_user["user_id"],
            stage=request.stage
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee",
            entity_id=employee_id,
            action="PROFILE_REJECTED",
            user_id=current_user["user_id"],
            changes={
                "stage": request.stage,
                "reason": request.reason,
                "new_status": "REJECTED"
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(
            message=f"Employee profile rejected. User can resubmit with corrections."
        )
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Bulk Operations

@router.post("/reviews/bulk-approve", response_model=SuccessResponse)
async def bulk_approve_employees(
    request: BulkApprovalRequest,
    current_user: dict = Depends(require_admin),
    admin_review_use_case: AdminReviewUseCase = Depends(get_admin_review_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Bulk approve multiple employees at a specific stage.
    Admin only.
    """
    
    try:
        approved_employees = await admin_review_use_case.bulk_approve_stage(
            employee_ids=request.employee_ids,
            stage=request.stage,
            reviewer_id=current_user["user_id"],
            notes=request.notes
        )
        
        # Audit log for bulk operation
        await audit_repository.log_action(
            entity_type="bulk_operation",
            entity_id=current_user["user_id"],  # Use admin user ID
            action="BULK_APPROVAL",
            user_id=current_user["user_id"],
            changes={
                "stage": request.stage,
                "employee_count": len(request.employee_ids),
                "approved_count": len(approved_employees),
                "employee_ids": [str(id) for id in request.employee_ids],
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(
            message=f"Bulk approval completed: {len(approved_employees)}/{len(request.employee_ids)} employees approved at {request.stage} stage"
        )
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    
@router.post("/reviews/bulk-documents-approve", response_model=SuccessResponse)
async def bulk_approve_documents(
    request: BulkDocumentApprovalRequest,
    current_user: dict = Depends(require_admin),
    document_use_case: DocumentUseCase = Depends(get_document_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """Bulk approve multiple documents."""
    
    try:
        approved_documents = await document_use_case.bulk_approve_documents(
            document_ids=request.document_ids,
            reviewer_id=current_user["user_id"],
            notes=request.notes
        )
        
        # Audit log for bulk operation
        await audit_repository.log_action(
            entity_type="bulk_operation",
            entity_id=current_user["user_id"],
            action="BULK_DOCUMENT_APPROVAL",
            user_id=current_user["user_id"],
            changes={
                "document_count": len(request.document_ids),
                "approved_count": len(approved_documents),
                "document_ids": [str(id) for id in request.document_ids],
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(
            message=f"Bulk document approval completed: {len(approved_documents)}/{len(request.document_ids)} documents approved"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bulk operation failed: {str(e)}"
        )

@router.post("/notifications/bulk-send", response_model=SuccessResponse)
async def bulk_send_notifications(
    request: BulkNotificationRequest,
    current_user: dict = Depends(require_admin),
    notification_service: NotificationService = Depends(get_notification_service)
):
    """Send bulk notifications to multiple users."""
    
    try:
        success_count = 0
        for user_id in request.user_ids:
            try:
                await notification_service._create_notification(
                    user_id=user_id,
                    type=request.notification_type,
                    title=request.title,
                    message=request.message,
                    data=request.additional_data or {}
                )
                success_count += 1
            except Exception as e:
                # Log error for monitoring but continue processing other notifications
                pass
        
        return SuccessResponse(
            message=f"Bulk notifications sent: {success_count}/{len(request.user_ids)} successful"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk notification failed: {str(e)}"
        )


# Audit Logs

@router.get("/audit-logs", response_model=AuditLogResponse)
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=500, description="Maximum number of audit log entries"),
    offset: int = Query(0, ge=0, description="Number of entries to skip"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[UUID] = Query(None, description="Filter by specific entity ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    user_id: Optional[UUID] = Query(None, description="Filter by user who performed the action"),
    current_user: dict = Depends(require_admin),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    employee_repository = Depends(get_employee_repository)
):
    """
    Get audit logs with filtering and pagination.
    Admin only.
    """
    
    try:
        # Fetch audit logs based on filters
        if user_id:
            # Get user-specific actions
            audit_logs = await audit_repository.get_user_actions(
                user_id=user_id,
                limit=limit
            )
        elif entity_id and entity_type:
            # Get entity-specific audit trail
            audit_logs = await audit_repository.get_entity_audit_trail(
                entity_type=entity_type,
                entity_id=entity_id,
                limit=limit
            )
        else:
            # Get all audit logs with filtering
            audit_logs = await audit_repository.get_all_audit_logs(
                limit=limit,
                offset=offset,
                entity_type=entity_type,
                action=action
            )
        
        # Get total count for pagination
        total_count = await audit_repository.get_audit_logs_count(
            entity_type=entity_type,
            action=action,
            user_id=user_id
        )
        
        # Get unique user IDs to fetch user names
        user_ids = set()
        for log in audit_logs:
            if log.get('user_id'):
                user_ids.add(log.get('user_id'))
        
        # Fetch user names
        user_names = {}
        for uid in user_ids:
            try:
                employee = await employee_repository.get_by_user_id(uid)
                if employee:
                    user_names[str(uid)] = f"{employee.first_name} {employee.last_name}"
                else:
                    user_names[str(uid)] = "Unknown User"
            except:
                user_names[str(uid)] = "Unknown User"
        
        # Convert to response format
        entries = []
        for log in audit_logs:
            user_id_str = str(log.get('user_id', ''))
            entry = AuditLogEntry(
                id=UUID(str(log.get('id', uuid4()))),
                timestamp=log.get('timestamp', datetime.now(timezone.utc)),
                user_id=UUID(user_id_str) if user_id_str and user_id_str != 'None' else uuid4(),
                user_name=user_names.get(user_id_str, "Unknown User"),
                action=log.get('action', ''),
                entity_type=log.get('entity_type', ''),
                entity_id=UUID(str(log.get('entity_id', uuid4()))),
                ip_address=log.get('ip_address', ''),
                user_agent=log.get('user_agent', ''),
                changes=log.get('changes', {})
            )
            entries.append(entry)
        
        return AuditLogResponse(
            entries=entries,
            total_count=total_count,
            has_more=(offset + len(entries)) < total_count
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch audit logs: {str(e)}"
        )