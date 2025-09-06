from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID


@dataclass
class UserClaims:
    """user claims extracted from JWT token."""
    
    user_id: UUID
    email: str
    employee_profile_status: str
    token_type: str = "access"
    roles: Optional[list] = None
    issued_at: Optional[int] = None
    expires_at: Optional[int] = None
    audience: Optional[str] = None
    issuer: Optional[str] = None
    raw_payload: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        # Convert string UUID to UUID object if needed
        if isinstance(self.user_id, str):
            self.user_id = UUID(self.user_id)
    
    def is_verified_profile(self) -> bool:
        """Check if user has verified employee profile."""
        return self.employee_profile_status == "VERIFIED"
    
    def is_pending_verification(self) -> bool:
        """Check if user profile is pending verification."""
        return self.employee_profile_status in [
            "PENDING_VERIFICATION",
            "PENDING_DETAILS_REVIEW", 
            "PENDING_DOCUMENTS_REVIEW",
            "PENDING_ROLE_ASSIGNMENT",
            "PENDING_FINAL_APPROVAL"
        ]
    
    def needs_profile_completion(self) -> bool:
        """Check if user needs to complete their profile."""
        return self.employee_profile_status in ["NOT_STARTED", "UNKNOWN"]
    
    def is_profile_rejected(self) -> bool:
        """Check if user profile was rejected."""
        return self.employee_profile_status == "REJECTED"
    
    def can_access_standard_endpoints(self) -> bool:
        """Check if user can access standard application endpoints."""
        return self.is_verified_profile()
    
    def can_access_newcomer_endpoints(self) -> bool:
        """Check if user can access limited newcomer endpoints."""
        return self.needs_profile_completion() or self.is_pending_verification() or self.is_verified_profile()
    
    def should_redirect_to_profile_completion(self) -> bool:
        """Check if user should be redirected to profile completion."""
        return self.needs_profile_completion() or self.is_profile_rejected()
    
    def get_access_level(self) -> str:
        """Get user's current access level based on profile status."""
        if self.is_verified_profile():
            return "FULL_ACCESS"
        elif self.is_pending_verification():
            return "LIMITED_ACCESS"
        elif self.needs_profile_completion():
            return "PROFILE_COMPLETION_REQUIRED"
        elif self.is_profile_rejected():
            return "PROFILE_RESUBMISSION_REQUIRED"
        else:
            return "UNKNOWN_STATUS"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "user_id": str(self.user_id),
            "email": self.email,
            "employee_profile_status": self.employee_profile_status,
            "roles": self.roles or [],
            "access_level": self.get_access_level(),
            "can_access_system": self.can_access_standard_endpoints(),
            "needs_profile_completion": self.should_redirect_to_profile_completion(),
            "token_expires_at": datetime.utcfromtimestamp(self.expires_at).isoformat() if self.expires_at else None
        }



