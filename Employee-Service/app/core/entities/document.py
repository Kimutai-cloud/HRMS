from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum


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
            self.uploaded_at = datetime.utcnow()
    
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
        self.reviewed_at = datetime.utcnow()
        self.review_notes = notes
    
    def reject_document(self, reviewer_id: UUID, reason: str) -> None:
        """Reject the document."""
        self.review_status = DocumentReviewStatus.REJECTED
        self.reviewed_by = reviewer_id
        self.reviewed_at = datetime.utcnow()
        self.review_notes = reason
    
    def request_replacement(self, reviewer_id: UUID, reason: str) -> None:
        """Request document replacement."""
        self.review_status = DocumentReviewStatus.REQUIRES_REPLACEMENT
        self.reviewed_by = reviewer_id
        self.reviewed_at = datetime.utcnow()
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