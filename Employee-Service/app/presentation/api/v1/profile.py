from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import List, Optional
from uuid import UUID, uuid4
import os
import aiofiles
from pathlib import Path

from app.application.use_case.profile_use_cases import ProfileUseCase
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.core.entities.user_claims import UserClaims
from app.core.entities.document import DocumentType
from app.presentation.schema.profile_schema import (
    SubmitEmployeeProfileRequest,
    EmployeeProfileResponse,
    ProfileVerificationStatusResponse,
    DocumentResponse,
    DocumentUploadRequest,
    DepartmentResponse,
    ManagerOptionResponse
)
from app.presentation.schema.common_schema import SuccessResponse
from app.presentation.api.dependencies import (
    get_profile_use_case,
    get_audit_repository,
    get_current_user_claims,
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
    
    # Check if user can submit profile
    if not (current_user.needs_profile_completion() or current_user.is_profile_rejected()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit profile with current status: {current_user.employee_profile_status}"
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
        
        # Submit profile
        employee_profile = await profile_use_case.submit_employee_profile(dto)
        
        # Audit log
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
        # Return helpful message for users who haven't submitted profile yet
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
    current_user: UserClaims = Depends(allow_newcomer_access),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Upload document for employee profile verification.
    Available to users with pending verification status.
    """
    
    # Validate file type
    allowed_types = settings.ALLOWED_FILE_TYPES
    file_extension = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    
    if file_extension not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file_extension}' not allowed. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Validate file size
    if file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    try:
        # Get employee profile
        employee_profile = await profile_use_case.get_employee_profile_by_user_id(current_user.user_id)
        
        # Check if user can upload documents
        if not (employee_profile.verification_status.value.startswith("PENDING") or 
                employee_profile.verification_status.value == "REJECTED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document uploads not allowed for current verification status"
            )
        
        # Create upload directory if it doesn't exist
        upload_dir = Path(settings.UPLOAD_DIR) / "employee_documents" / str(employee_profile.id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique file name
        file_id = uuid4()
        file_extension = file.filename.split(".")[-1] if "." in file.filename else "bin"
        saved_filename = f"{file_id}.{file_extension}"
        file_path = upload_dir / saved_filename
        
        # Save file
        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)
        
        # Create document record
        from app.application.dto.profile_dto import DocumentUploadRequest as DocumentUploadDTO
        dto = DocumentUploadDTO(
            employee_id=employee_profile.id,
            uploaded_by=current_user.user_id,
            document_type=document_type,
            file_name=file.filename,
            file_path=str(file_path),
            file_size=file.size,
            mime_type=file.content_type or "application/octet-stream",
            is_required=is_required,
            notes=notes
        )
        
        document = await profile_use_case.upload_document(dto)
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee_document",
            entity_id=document.id,
            action="DOCUMENT_UPLOADED",
            user_id=current_user.user_id,
            changes={
                "document_type": document_type.value,
                "file_name": file.filename,
                "file_size": file.size
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return document
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found. Please submit your profile first."
        )
    except Exception as e:
        # Clean up file if document creation failed
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document upload failed: {str(e)}"
        )


@router.get("/documents", response_model=List[DocumentResponse])
async def get_my_documents(
    current_user: UserClaims = Depends(allow_newcomer_access),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case)
):
    """
    Get all documents uploaded by current user.
    Available to users with submitted or verified profiles.
    """
    
    try:
        documents = await profile_use_case.get_user_documents(current_user.user_id)
        return documents
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found"
        )


@router.delete("/documents/{document_id}", response_model=SuccessResponse)
async def delete_document(
    document_id: UUID,
    current_user: UserClaims = Depends(allow_newcomer_access),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Delete uploaded document.
    Only allowed if profile is still pending or rejected.
    """
    
    try:
        success = await profile_use_case.delete_user_document(
            document_id=document_id,
            user_id=current_user.user_id
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


# Data endpoints for dropdowns

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