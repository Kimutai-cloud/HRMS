import io
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import List, Optional
from uuid import UUID, uuid4
import os
import aiofiles
from pathlib import Path
import mimetypes

from app.application.use_case.profile_use_cases import ProfileUseCase
from app.application.use_case.document_use_cases import DocumentUseCase
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.core.entities.user_claims import UserClaims
from app.core.entities.document import DocumentType
from app.presentation.schema.profile_schema import (
    SubmitEmployeeProfileRequest,
    EmployeeProfileResponse,
    ProfileVerificationStatusResponse,
    DocumentResponse,
    DepartmentResponse,
    ManagerOptionResponse
)
from app.presentation.schema.common_schema import SuccessResponse
from app.presentation.api.dependencies import (
    get_profile_use_case,
    get_document_use_case,
    get_audit_repository,
    get_current_user_claims,
    require_profile_completion,
    require_newcomer_access,
    allow_newcomer_access,
    get_request_context
)
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeValidationException,
    EmployeeAlreadyExistsException
)
from app.config.settings import settings

router = APIRouter(prefix="/profile", tags=["Employee Profile"])


@router.post("/submit", response_model=EmployeeProfileResponse, status_code=status.HTTP_201_CREATED)
async def submit_employee_profile(
    request: SubmitEmployeeProfileRequest,
    current_user: UserClaims = Depends(get_current_user_claims),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Submit employee profile for verification.
    Available to users with NOT_STARTED or REJECTED profile status.
    """
    
    if not (current_user.needs_profile_completion() or current_user.is_profile_rejected()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit profile with current status: {current_user.employee_profile_status}"
        )
    
    try:
        from app.application.dto.profile_dto import SubmitProfileRequest
        dto = SubmitProfileRequest(
            user_id=current_user.user_id,
            email=current_user.email,
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
            title=request.title,
            department=request.department,
            manager_id=request.manager_id
        )
        
        employee_profile = await profile_use_case.submit_employee_profile(dto)
        
        await audit_repository.log_action(
            entity_type="employee",
            entity_id=employee_profile.id,
            action="PROFILE_SUBMITTED",
            user_id=current_user.user_id,
            changes={
                "first_name": employee_profile.first_name,
                "last_name": employee_profile.last_name,
                "department": employee_profile.department,
                "title": employee_profile.title,
                "verification_status": employee_profile.verification_status.value
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return employee_profile
        
    except EmployeeAlreadyExistsException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/status", response_model=ProfileVerificationStatusResponse)
async def get_profile_verification_status(
    current_user: UserClaims = Depends(allow_newcomer_access),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case)
):
    """
    Get detailed profile verification status.
    Available to users with pending verification or verified profiles.
    """
    
    try:
        status_info = await profile_use_case.get_profile_verification_status(current_user.user_id)
        return status_info
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found. Please submit your profile first."
        )


@router.get("/my-profile", response_model=EmployeeProfileResponse)
async def get_my_profile(
    current_user: UserClaims = Depends(allow_newcomer_access),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case)
):
    """
    Get current user's complete employee profile.
    Available to users with submitted or verified profiles.
    """
    
    try:
        profile = await profile_use_case.get_employee_profile_by_user_id(current_user.user_id)
        return profile
        
    except EmployeeNotFoundException as e:
        if current_user.needs_profile_completion():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee profile not found. Please complete your profile submission first."
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/upload-document", response_model=DocumentResponse)
async def upload_document(
    document_type: DocumentType = Form(...),
    is_required: bool = Form(True),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: UserClaims = Depends(require_newcomer_access),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case),
    document_use_case: DocumentUseCase = Depends(get_document_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Upload document for employee profile verification.
    Enhanced with proper file handling and validation.
    """
    
    # FIXED: Enhanced file validation
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File name is required"
        )
    
    # Validate file type
    file_extension = Path(file.filename).suffix.lower().lstrip('.')
    if file_extension not in settings.ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file_extension}' not allowed. Allowed types: {', '.join(settings.ALLOWED_FILE_TYPES)}"
        )
    
    # Read file content for size validation
    file_content = await file.read()
    
    # Validate file size
    if len(file_content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Validate MIME type
    detected_mime = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
    if file.content_type and file.content_type != detected_mime:
        print(f"⚠️  MIME type mismatch: uploaded={file.content_type}, detected={detected_mime}")
    
    try:
        # Get employee profile
        employee_profile = await profile_use_case.get_employee_profile_by_user_id(current_user.user_id)
        
        # Check if user can upload documents
        if not employee_profile.verification_status.value.startswith("PENDING") and \
           employee_profile.verification_status.value != "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Document uploads not allowed for verification status: {employee_profile.verification_status.value}"
            )
        
        # FIXED: Upload document using document use case
        uploaded_document = await document_use_case.upload_document(
            employee_id=employee_profile.id,
            uploaded_by=current_user.user_id,
            document_type=document_type,
            file_content=file_content,
            file_name=file.filename,
            mime_type=detected_mime,
            is_required=is_required,
            notes=notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee_document",
            entity_id=uploaded_document.id,
            action="DOCUMENT_UPLOADED",
            user_id=current_user.user_id,
            changes={
                "document_type": document_type.value,
                "file_name": file.filename,
                "file_size": len(file_content),
                "mime_type": detected_mime
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return DocumentResponse(
            id=uploaded_document.id,
            document_type=uploaded_document.document_type,
            display_name=uploaded_document.get_display_name(),
            file_name=uploaded_document.file_name,
            file_size=uploaded_document.file_size,
            mime_type=uploaded_document.mime_type,
            uploaded_at=uploaded_document.uploaded_at,
            review_status=uploaded_document.review_status,
            review_notes=uploaded_document.review_notes,
            reviewed_at=uploaded_document.reviewed_at,
            is_required=uploaded_document.is_required
        )
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found. Please submit your profile first."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document upload failed: {str(e)}"
        )


@router.get("/documents", response_model=List[DocumentResponse])
async def get_my_documents(
    current_user: UserClaims = Depends(require_newcomer_access),
    document_use_case: DocumentUseCase = Depends(get_document_use_case)
):
    """
    Get all documents uploaded by current user.
    """
    
    try:
        documents = await document_use_case.get_employee_documents(
            employee_id=None,  # Will be resolved by user_id in use case
            requester_user_id=current_user.user_id
        )
        
        return [
            DocumentResponse(
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
                is_required=doc.is_required
            )
            for doc in documents
        ]
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found"
        )


@router.get("/documents/{document_id}/download")
async def download_my_document(
    document_id: UUID,
    current_user: UserClaims = Depends(require_newcomer_access),
    document_use_case: DocumentUseCase = Depends(get_document_use_case)
):
    """
    Download user's own document.
    """
    
    try:
        content, filename, mime_type = await document_use_case.download_document(
            document_id=document_id,
            requester_user_id=current_user.user_id
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )


@router.delete("/documents/{document_id}", response_model=SuccessResponse)
async def delete_document(
    document_id: UUID,
    current_user: UserClaims = Depends(require_newcomer_access),
    document_use_case: DocumentUseCase = Depends(get_document_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Delete uploaded document.
    Only allowed if profile is still pending or rejected.
    """
    
    try:
        success = await document_use_case.delete_document(
            document_id=document_id,
            requester_user_id=current_user.user_id
        )
        
        if success:
            # Audit log
            await audit_repository.log_action(
                entity_type="employee_document",
                entity_id=document_id,
                action="DOCUMENT_DELETED",
                user_id=current_user.user_id,
                changes={},
                ip_address=request_context.get("ip_address"),
                user_agent=request_context.get("user_agent")
            )
        
        return SuccessResponse(message="Document deleted successfully")
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )



@router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(
    current_user: UserClaims = Depends(get_current_user_claims),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case)
):
    """
    Get list of departments for profile submission.
    Available to all authenticated users.
    """
    
    departments = await profile_use_case.get_departments()
    return departments


@router.get("/managers", response_model=List[ManagerOptionResponse])
async def get_managers(
    department: Optional[str] = None,
    current_user: UserClaims = Depends(get_current_user_claims),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case)
):
    """
    Get list of managers for profile submission.
    Optionally filter by department.
    Available to all authenticated users.
    """
    
    managers = await profile_use_case.get_managers(department_filter=department)
    return managers


@router.get("/managers/by-department/{department}", response_model=List[ManagerOptionResponse])
async def get_managers_by_department(
    department: str,
    current_user: UserClaims = Depends(get_current_user_claims),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case)
):
    """
    Get managers filtered by specific department.
    Available to all authenticated users.
    """
    
    managers = await profile_use_case.get_managers(department_filter=department)
    return managers


# Resubmission endpoint

@router.post("/resubmit", response_model=EmployeeProfileResponse)
async def resubmit_profile(
    request: SubmitEmployeeProfileRequest,
    current_user: UserClaims = Depends(get_current_user_claims),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Resubmit employee profile after rejection.
    Only available to users with REJECTED profile status.
    """
    
    if not current_user.is_profile_rejected():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile resubmission only allowed for rejected profiles"
        )
    
    try:
        # Convert request to DTO
        from app.application.dto.profile_dto import SubmitProfileRequest
        dto = SubmitProfileRequest(
            user_id=current_user.user_id,
            email=current_user.email,
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
            title=request.title,
            department=request.department,
            manager_id=request.manager_id
        )
        
        # Resubmit profile
        employee_profile = await profile_use_case.resubmit_employee_profile(dto)
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee",
            entity_id=employee_profile.id,
            action="PROFILE_RESUBMITTED",
            user_id=current_user.user_id,
            changes={
                "previous_status": "REJECTED",
                "new_status": employee_profile.verification_status.value
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return employee_profile
        
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