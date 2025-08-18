from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum


class EmploymentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class VerificationStatus(str, Enum):
    """Multi-stage verification status for employee profiles."""
    NOT_SUBMITTED = "NOT_SUBMITTED"
    PENDING_DETAILS_REVIEW = "PENDING_DETAILS_REVIEW"
    PENDING_DOCUMENTS_REVIEW = "PENDING_DOCUMENTS_REVIEW" 
    PENDING_ROLE_ASSIGNMENT = "PENDING_ROLE_ASSIGNMENT"
    PENDING_FINAL_APPROVAL = "PENDING_FINAL_APPROVAL"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


@dataclass
class Employee:
    """Employee entity with enhanced verification workflow."""
    
    id: Optional[UUID]
    user_id: Optional[UUID]  
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    title: Optional[str]
    department: Optional[str]
    manager_id: Optional[UUID]
    employment_status: EmploymentStatus
    verification_status: VerificationStatus
    hired_at: Optional[datetime]
    deactivated_at: Optional[datetime]
    deactivation_reason: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    version: int = 1
    
    # Verification workflow fields
    submitted_at: Optional[datetime] = None
    final_approved_by: Optional[UUID] = None
    final_approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    rejected_by: Optional[UUID] = None
    rejected_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.employment_status == EmploymentStatus.INACTIVE and not self.deactivated_at:
            self.deactivated_at = datetime.utcnow()
    
    def is_active(self) -> bool:
        return self.employment_status == EmploymentStatus.ACTIVE
    
    def is_verified(self) -> bool:
        return self.verification_status == VerificationStatus.VERIFIED
    
    def is_pending_verification(self) -> bool:
        return self.verification_status in [
            VerificationStatus.PENDING_DETAILS_REVIEW,
            VerificationStatus.PENDING_DOCUMENTS_REVIEW,
            VerificationStatus.PENDING_ROLE_ASSIGNMENT,
            VerificationStatus.PENDING_FINAL_APPROVAL
        ]
    
    def is_rejected(self) -> bool:
        return self.verification_status == VerificationStatus.REJECTED
    
    def can_resubmit(self) -> bool:
        """Check if employee can resubmit their profile."""
        return self.verification_status in [
            VerificationStatus.NOT_SUBMITTED,
            VerificationStatus.REJECTED
        ]
    
    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
    
    def get_verification_stage(self) -> str:
        """Get human-readable verification stage."""
        stage_map = {
            VerificationStatus.NOT_SUBMITTED: "Profile not submitted",
            VerificationStatus.PENDING_DETAILS_REVIEW: "Details under review",
            VerificationStatus.PENDING_DOCUMENTS_REVIEW: "Documents under review", 
            VerificationStatus.PENDING_ROLE_ASSIGNMENT: "Role assignment pending",
            VerificationStatus.PENDING_FINAL_APPROVAL: "Final approval pending",
            VerificationStatus.VERIFIED: "Fully verified",
            VerificationStatus.REJECTED: "Profile rejected"
        }
        return stage_map.get(self.verification_status, "Unknown status")
    
    def deactivate(self, reason: str) -> None:
        """Deactivate employee with reason."""
        self.employment_status = EmploymentStatus.INACTIVE
        self.deactivated_at = datetime.utcnow()
        self.deactivation_reason = reason
    
    def reactivate(self) -> None:
        """Reactivate employee."""
        self.employment_status = EmploymentStatus.ACTIVE
        self.deactivated_at = None
        self.deactivation_reason = None
    
    def submit_profile(self, submitted_by: UUID) -> None:
        """Submit profile for verification."""
        if not self.can_resubmit():
            raise ValueError(f"Cannot submit profile with status {self.verification_status}")
        
        self.verification_status = VerificationStatus.PENDING_DETAILS_REVIEW
        self.submitted_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.version += 1
        
        # Clear any previous rejection data
        self.rejection_reason = None
        self.rejected_by = None
        self.rejected_at = None
    
    def advance_verification_stage(self, new_status: VerificationStatus, reviewer_id: UUID) -> None:
        """Advance to next verification stage."""
        if not self.is_pending_verification() and self.verification_status != VerificationStatus.PENDING_FINAL_APPROVAL:
            raise ValueError(f"Cannot advance from status {self.verification_status}")
        
        self.verification_status = new_status
        self.updated_at = datetime.utcnow()
        self.version += 1
    
    def reject_verification(self, reason: str, rejected_by: UUID) -> None:
        """Reject the verification process."""
        if not self.is_pending_verification():
            raise ValueError(f"Cannot reject from status {self.verification_status}")
        
        self.verification_status = VerificationStatus.REJECTED
        self.rejection_reason = reason
        self.rejected_by = rejected_by
        self.rejected_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.version += 1
    
    def final_approve(self, approved_by: UUID) -> None:
        """Give final approval to employee."""
        if self.verification_status != VerificationStatus.PENDING_FINAL_APPROVAL:
            raise ValueError(f"Cannot approve from status {self.verification_status}")
        
        self.verification_status = VerificationStatus.VERIFIED
        self.final_approved_by = approved_by
        self.final_approved_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.version += 1