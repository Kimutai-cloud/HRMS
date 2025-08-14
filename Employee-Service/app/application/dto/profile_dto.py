from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from app.core.entities.document import DocumentType


@dataclass
class SubmitProfileRequest:
    """DTO for employee profile submission."""
    
    user_id: UUID  # Extracted from JWT
    email: str  # Extracted from JWT
    first_name: str
    last_name: str
    phone: Optional[str]
    title: Optional[str]
    department: str
    manager_id: Optional[UUID]


@dataclass
class DocumentUploadRequest:
    """DTO for document upload."""
    
    employee_id: UUID
    uploaded_by: UUID
    document_type: DocumentType
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    is_required: bool = True
    notes: Optional[str] = None


@dataclass
class ProfileStatusResponse:
    """DTO for profile status information."""
    
    employee_id: UUID
    user_id: UUID
    verification_status: str
    status_description: str
    progress_percentage: int
    next_steps: List[str]
    can_resubmit: bool
    submitted_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None