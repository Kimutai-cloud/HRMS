
from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.core.entities.employee import VerificationStatus
from app.core.entities.document import DocumentType, DocumentReviewStatus


class SubmitEmployeeProfileRequest(BaseModel):
    """Request schema for employee profile submission."""
    
    first_name: str = Field(..., min_length=1, max_length=255, description="Employee's first name")
    last_name: str = Field(..., min_length=1, max_length=255, description="Employee's last name")
    phone: Optional[str] = Field(None, max_length=50, description="Employee's phone number")
    title: Optional[str] = Field(None, max_length=255, description="Employee's job title")
    department: str = Field(..., max_length=255, description="Employee's department")
    manager_id: Optional[UUID] = Field(None, description="UUID of the employee's manager")
    
    @validator('first_name', 'last_name')
    def validate_names(cls, v):
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()
    
    @validator('department')
    def validate_department(cls, v):
        if not v or not v.strip():
            raise ValueError('Department is required')
        return v.strip()
    


class DocumentUploadRequest(BaseModel):
    """Request schema for document upload."""
    
    document_type: DocumentType = Field(..., description="Type of document being uploaded")
    is_required: bool = Field(True, description="Whether this document is required")
    notes: Optional[str] = Field(None, max_length=500, description="Optional notes about the document")
    


class DocumentResponse(BaseModel):
    """Response schema for document information."""
    
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
    



class ProfileVerificationStatusResponse(BaseModel):
    """Response showing detailed profile verification status."""
    
    employee_id: UUID
    user_id: UUID
    verification_status: VerificationStatus
    status_description: str
    current_stage: str
    progress_percentage: int
    submitted_at: Optional[datetime]
    
    # Stage-specific information
    details_review_completed: bool = False
    documents_review_completed: bool = False
    role_assignment_completed: bool = False
    final_approval_completed: bool = False
    
    # Next steps and requirements
    next_steps: List[str]
    required_actions: List[str]
    can_resubmit: bool
    
    # Rejection information (if applicable)
    rejection_reason: Optional[str] = None
    rejected_at: Optional[datetime] = None


class EmployeeProfileResponse(BaseModel):
    """Complete employee profile response with verification info."""
    
    id: UUID
    user_id: Optional[UUID]
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    title: Optional[str]
    department: Optional[str]
    manager_id: Optional[UUID]
    verification_status: VerificationStatus
    submitted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    version: int
    
    documents: List[DocumentResponse] = []
    verification_details: Optional[ProfileVerificationStatusResponse] = None



class DepartmentResponse(BaseModel):
    """Response schema for department information."""
    
    id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    manager_count: int = 0
    employee_count: int = 0
  

class ManagerOptionResponse(BaseModel):
    """Response schema for manager selection options."""
    
    id: UUID
    full_name: str
    title: Optional[str]
    department: str
    email: str
    
    