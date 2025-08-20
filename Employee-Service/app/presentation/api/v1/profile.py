from dataclasses import dataclass
import datetime
import hashlib
import io
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
import os
import aiofiles
from pathlib import Path
import mimetypes

from app.application.use_case.profile_use_cases import ProfileUseCase
from app.application.use_case.document_use_cases import DocumentUseCase, DocumentValidationException
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.core.entities.employee import VerificationStatus
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
    """profile submission with comprehensive validation."""

    if not (current_user.needs_profile_completion() or current_user.is_profile_rejected()):

        status_guidance = {
            "PENDING_VERIFICATION": "Your profile is already submitted and under review.",
            "VERIFIED": "Your profile is already verified. Contact support for changes."
        }
        
        guidance = status_guidance.get(
            current_user.employee_profile_status, 
            "Profile submission not allowed with current status"
        )
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "SUBMISSION_NOT_ALLOWED",
                "message": guidance,
                "current_status": current_user.employee_profile_status,
                "allowed_statuses": ["NOT_STARTED", "REJECTED"]
            }
        )
    
    await _check_submission_rate_limit(current_user.user_id, request_context)
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
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "PROFILE_CONFLICT",
                    "message": str(e),
                    "action_required": "contact_support" if "already exists" in str(e) else "check_status"
                }
            )
    except EmployeeValidationException as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error": "VALIDATION_FAILED",
                    "message": str(e),
                    "action_required": "fix_data"
                }
            )
     
_submission_attempts = {}    
async def _check_submission_rate_limit(user_id: UUID, request_context: dict):
        """Prevent spam submissions."""
        now = datetime.utcnow()
        user_key = str(user_id)
        
        if user_key in _submission_attempts:
            last_attempt = _submission_attempts[user_key]
            if (now - last_attempt).seconds < 30: 
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "RATE_LIMITED",
                        "message": "Please wait before submitting again",
                        "retry_after": 30
                    }
                )
        
        _submission_attempts[user_key] = now

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
    
    upload_validation = await _validate_upload_request(file, document_type, current_user)
    if not upload_validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "UPLOAD_VALIDATION_FAILED",
                "message": upload_validation.error_message,
                "details": upload_validation.details
            }
        )
    
    try:
        file_content = await _secure_file_read(file)
    except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                "error": "FILE_READ_ERROR",
                "message": f"Failed to read file: {str(e)}",
                "max_size_mb": settings.MAX_FILE_SIZE // (1024*1024)
            }
        )
    
    security_check = await _perform_security_checks(file_content, file.filename, file.content_type)
    if not security_check.passed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "SECURITY_CHECK_FAILED",
                "message": security_check.message,
                "threat_level": security_check.threat_level
            }
        )
    
    try:
        employee_profile = await profile_use_case.get_employee_profile_by_user_id(current_user.user_id)
        
        upload_eligibility = _check_upload_eligibility(employee_profile, document_type)
        if not upload_eligibility.allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "UPLOAD_NOT_ALLOWED",
                    "message": upload_eligibility.reason,
                    "current_status": employee_profile.verification_status.value
                }
            )
        
        uploaded_document = await document_use_case.upload_document(
            employee_id=employee_profile.id,
            uploaded_by=current_user.user_id,
            document_type=document_type,
            file_content=file_content,
            file_name=file.filename,
            mime_type=file.content_type,
            is_required=is_required,
            notes=notes
        )
        
        await audit_repository.log_action(
            entity_type="employee_document",
            entity_id=uploaded_document.id,
            action="DOCUMENT_UPLOADED",
            user_id=current_user.user_id,
            changes={
                "document_type": document_type.value,
                "file_name": file.filename,
                "file_size": len(file_content),
                "mime_type": file.content_type,
                "security_hash": hashlib.sha256(file_content).hexdigest()[:16]  
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
    
    except DocumentValidationException as e:
       raise HTTPException(
           status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
           detail={
               "error": "DOCUMENT_VALIDATION_FAILED",
               "message": str(e),
               "action_required": "fix_file_and_retry"
           }
       )
    except Exception as e:
       # Log unexpected errors
       print(f"❌ Unexpected upload error: {e}")
       raise HTTPException(
           status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
           detail={
               "error": "UPLOAD_SYSTEM_ERROR",
               "message": "Document upload failed due to system error",
               "action_required": "try_again_later"
           }
       )  
@dataclass
class UploadValidationResult:
   is_valid: bool
   error_message: str = ""
   details: Dict[str, Any] = None

async def _validate_upload_request(
   file: UploadFile, document_type: DocumentType, user: UserClaims
) -> UploadValidationResult:
   """Comprehensive upload request validation."""
   
   details = {}
   
   if not file.filename:
       return UploadValidationResult(False, "File name is required")
   
   file_extension = Path(file.filename).suffix.lower().lstrip('.')
   if file_extension not in settings.ALLOWED_FILE_TYPES:
       details["allowed_types"] = settings.ALLOWED_FILE_TYPES
       details["received_type"] = file_extension
       return UploadValidationResult(
           False, 
           f"File type '{file_extension}' not allowed", 
           details
       )
   
   type_specific_validation = _validate_document_type_requirements(document_type, file_extension)
   if not type_specific_validation.is_valid:
       return type_specific_validation

   if not user.can_access_newcomer_endpoints():
       return UploadValidationResult(
           False, 
           "Document upload requires newcomer access level or higher"
       )
   
   return UploadValidationResult(True)

def _validate_document_type_requirements(document_type: DocumentType, file_extension: str) -> UploadValidationResult:
   """Validate document type specific requirements."""
   
   type_requirements = {
       DocumentType.ID_CARD: ["pdf", "jpg", "jpeg", "png"],
       DocumentType.PASSPORT: ["pdf", "jpg", "jpeg", "png"],
       DocumentType.EDUCATION_CERTIFICATE: ["pdf", "jpg", "jpeg", "png"],
       DocumentType.EMPLOYMENT_CONTRACT: ["pdf", "doc", "docx"],
   }
   
   allowed_extensions = type_requirements.get(document_type)
   if allowed_extensions and file_extension not in allowed_extensions:
       return UploadValidationResult(
           False,
           f"Document type {document_type.value} only accepts: {', '.join(allowed_extensions)}",
           {"allowed_for_type": allowed_extensions, "received": file_extension}
       )
   
   return UploadValidationResult(True)

async def _secure_file_read(file: UploadFile) -> bytes:
   """Securely read uploaded file with size monitoring."""
   
   chunk_size = 8192  
   max_size = settings.MAX_FILE_SIZE
   total_size = 0
   content_chunks = []
   
   try:
       while True:
           chunk = await file.read(chunk_size)
           if not chunk:
               break
               
           total_size += len(chunk)
           if total_size > max_size:
               raise ValueError(f"File size exceeds maximum allowed size of {max_size // (1024*1024)}MB")
           
           content_chunks.append(chunk)
       
       return b''.join(content_chunks)
       
   finally:
       await file.seek(0)  

@dataclass
class SecurityCheckResult:
   passed: bool
   message: str = ""
   threat_level: str = "none"

async def _perform_security_checks(content: bytes, filename: str, mime_type: str) -> SecurityCheckResult:
   """Perform security checks on uploaded content."""
   
   if content.startswith((b'MZ', b'\x7fELF', b'\xca\xfe\xba\xbe')):
       return SecurityCheckResult(False, "Executable files not allowed", "high")
   
   if mime_type == "application/pdf":
       if b'/JavaScript' in content or b'/JS' in content:
           return SecurityCheckResult(False, "PDF with JavaScript not allowed", "medium")
   
   if any(pattern in filename.lower() for pattern in ['script', '.exe', '.bat', '.cmd']):
       return SecurityCheckResult(False, "Suspicious filename pattern", "medium")
   
   return SecurityCheckResult(True)

@dataclass 
class UploadEligibilityResult:
   allowed: bool
   reason: str = ""

def _check_upload_eligibility(employee_profile, document_type: DocumentType) -> UploadEligibilityResult:
   """Check if user is eligible to upload documents."""
   
   allowed_statuses = [
       VerificationStatus.PENDING_DETAILS_REVIEW,
       VerificationStatus.PENDING_DOCUMENTS_REVIEW,
       VerificationStatus.REJECTED
   ]
   
   if employee_profile.verification_status not in allowed_statuses:
       return UploadEligibilityResult(
           False,
           f"Document uploads not allowed for status: {employee_profile.verification_status.value}"
       )
   
   return UploadEligibilityResult(True)

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
        
        employee_profile = await profile_use_case.resubmit_employee_profile(dto)
        
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