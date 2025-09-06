from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from enum import Enum
from uuid import uuid4


class DocumentType(str, Enum):
    """Types of documents that can be uploaded."""
    ID_CARD = "ID_CARD"
    PASSPORT = "PASSPORT" 
    DRIVERS_LICENSE = "DRIVERS_LICENSE"
    BIRTH_CERTIFICATE = "BIRTH_CERTIFICATE"
    EDUCATION_CERTIFICATE = "EDUCATION_CERTIFICATE"
    EMPLOYMENT_CONTRACT = "EMPLOYMENT_CONTRACT"
    PREVIOUS_EMPLOYMENT_LETTER = "PREVIOUS_EMPLOYMENT_LETTER"
    PROFESSIONAL_CERTIFICATION = "PROFESSIONAL_CERTIFICATION"
    OTHER = "OTHER"


class DocumentReviewStatus(str, Enum):
    """Review status for uploaded documents."""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REQUIRES_REPLACEMENT = "REQUIRES_REPLACEMENT"

class DocumentVersion(str, Enum):
    """Document version tracking."""
    ORIGINAL = "ORIGINAL"
    REVISION_1 = "REVISION_1"
    REVISION_2 = "REVISION_2"
    REVISION_3 = "REVISION_3"

@dataclass
class DocumentVersionInfo:
    """Document version information."""
    version: DocumentVersion
    parent_document_id: Optional[UUID] = None
    version_notes: Optional[str] = None
    superseded_at: Optional[datetime] = None
    is_current: bool = True


@dataclass
class EmployeeDocument:
    """Document entity for employee document uploads."""
    
    id: Optional[UUID]
    employee_id: UUID
    document_type: DocumentType
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    uploaded_at: datetime
    uploaded_by: UUID

    # Version tracking
    version: DocumentVersion = DocumentVersion.ORIGINAL
    parent_document_id: Optional[UUID] = None
    version_notes: Optional[str] = None
    superseded_at: Optional[datetime] = None
    is_current: bool = True

    # Expiry tracking
    expires_at: Optional[datetime] = None
    expiry_reminder_sent: bool = False
    
    # Review fields
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    review_status: DocumentReviewStatus = DocumentReviewStatus.PENDING
    review_notes: Optional[str] = None
    
    # Metadata
    is_required: bool = True
    display_order: int = 0
    
    def __post_init__(self):
        if self.uploaded_at is None:
            self.uploaded_at = datetime.now(timezone.utc)
    
    def is_pending_review(self) -> bool:
        """Check if document is pending review."""
        return self.review_status == DocumentReviewStatus.PENDING
    
    def is_approved(self) -> bool:
        """Check if document is approved."""
        return self.review_status == DocumentReviewStatus.APPROVED
    
    def is_rejected(self) -> bool:
        """Check if document is rejected."""
        return self.review_status in [
            DocumentReviewStatus.REJECTED,
            DocumentReviewStatus.REQUIRES_REPLACEMENT
        ]
    
    def approve_document(self, reviewer_id: UUID, notes: Optional[str] = None) -> None:
        """Approve the document."""
        self.review_status = DocumentReviewStatus.APPROVED
        self.reviewed_by = reviewer_id
        self.reviewed_at = datetime.now(timezone.utc)
        self.review_notes = notes
    
    def reject_document(self, reviewer_id: UUID, reason: str) -> None:
        """Reject the document."""
        self.review_status = DocumentReviewStatus.REJECTED
        self.reviewed_by = reviewer_id
        self.reviewed_at = datetime.now(timezone.utc)
        self.review_notes = reason
    
    def request_replacement(self, reviewer_id: UUID, reason: str) -> None:
        """Request document replacement."""
        self.review_status = DocumentReviewStatus.REQUIRES_REPLACEMENT
        self.reviewed_by = reviewer_id
        self.reviewed_at = datetime.now(timezone.utc)
        self.review_notes = reason
    
    def get_file_extension(self) -> str:
        """Get file extension from file name."""
        if "." in self.file_name:
            return self.file_name.split(".")[-1].lower()
        return ""
    
    def get_display_name(self) -> str:
        """Get human-readable display name for document type."""
        display_names = {
            DocumentType.ID_CARD: "National ID Card",
            DocumentType.PASSPORT: "Passport",
            DocumentType.DRIVERS_LICENSE: "Driver's License",
            DocumentType.BIRTH_CERTIFICATE: "Birth Certificate",
            DocumentType.EDUCATION_CERTIFICATE: "Education Certificate",
            DocumentType.EMPLOYMENT_CONTRACT: "Employment Contract",
            DocumentType.PREVIOUS_EMPLOYMENT_LETTER: "Previous Employment Letter",
            DocumentType.PROFESSIONAL_CERTIFICATION: "Professional Certification",
            DocumentType.OTHER: "Other Document"
        }
        return display_names.get(self.document_type, str(self.document_type))
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id) if self.id else None,
            "document_type": self.document_type.value,
            "display_name": self.get_display_name(),
            "file_name": self.file_name,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "uploaded_at": self.uploaded_at.isoformat(),
            "review_status": self.review_status.value,
            "review_notes": self.review_notes,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "is_required": self.is_required
        }
    
    def create_new_version(self, new_file_path: str, new_file_name: str, version_notes: str) -> 'EmployeeDocument':
        """Create a new version of this document."""
        next_version = self._get_next_version()
        
        new_doc = EmployeeDocument(
            id=uuid4(),
            employee_id=self.employee_id,
            document_type=self.document_type,
            file_name=new_file_name,
            file_path=new_file_path,
            file_size=0,  
            mime_type=self.mime_type,
            uploaded_at=datetime.now(timezone.utc),
            uploaded_by=self.uploaded_by,
            review_status=DocumentReviewStatus.PENDING,
            is_required=self.is_required,
            version=next_version,
            parent_document_id=self.id,
            version_notes=version_notes
        )
        
        # Mark current document as superseded
        self.is_current = False
        self.superseded_at = datetime.now(timezone.utc)
        
        return new_doc
    
    def _get_next_version(self) -> DocumentVersion:
        """Get the next version number."""
        version_order = [
            DocumentVersion.ORIGINAL,
            DocumentVersion.REVISION_1,
            DocumentVersion.REVISION_2,
            DocumentVersion.REVISION_3
        ]
        
        current_index = version_order.index(self.version)
        if current_index < len(version_order) - 1:
            return version_order[current_index + 1]
        else:
            raise ValueError("Maximum document versions reached")
    
    def is_expired(self) -> bool:
        """Check if document has expired."""
        return self.expires_at and datetime.now(timezone.utc) > self.expires_at
    
    def days_until_expiry(self) -> Optional[int]:
        """Get days until document expires."""
        if not self.expires_at:
            return None
        delta = self.expires_at - datetime.now(timezone.utc)
        return max(0, delta.days)