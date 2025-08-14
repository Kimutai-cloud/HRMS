from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum


class AuthProvider(str, Enum):
    EMAIL = "email"
    GOOGLE = "google"


class EmployeeProfileStatus(str, Enum):
    """Employee profile completion and verification status."""
    NOT_STARTED = "NOT_STARTED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


@dataclass
class User:
    """User entity representing a user in the system."""
    
    id: Optional[UUID]
    email: str
    hashed_password: Optional[str]
    full_name: Optional[str]
    is_verified: bool
    auth_provider: AuthProvider
    employee_profile_status: EmployeeProfileStatus
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    def __post_init__(self):
        if self.auth_provider == AuthProvider.EMAIL and not self.hashed_password:
            raise ValueError("Email auth provider requires a hashed password")
        
        # Set default employee profile status if not provided
        if not hasattr(self, 'employee_profile_status') or self.employee_profile_status is None:
            self.employee_profile_status = EmployeeProfileStatus.NOT_STARTED
    
    def is_google_user(self) -> bool:
        return self.auth_provider == AuthProvider.GOOGLE
    
    def can_login_with_password(self) -> bool:
        return self.auth_provider == AuthProvider.EMAIL and self.hashed_password is not None
    
    def has_completed_employee_profile(self) -> bool:
        """Check if user has completed their employee profile setup."""
        return self.employee_profile_status != EmployeeProfileStatus.NOT_STARTED
    
    def is_employee_profile_verified(self) -> bool:
        """Check if user's employee profile is fully verified."""
        return self.employee_profile_status == EmployeeProfileStatus.VERIFIED
    
    def is_pending_verification(self) -> bool:
        """Check if user's employee profile is awaiting verification."""
        return self.employee_profile_status == EmployeeProfileStatus.PENDING_VERIFICATION
    
    def is_profile_rejected(self) -> bool:
        """Check if user's employee profile was rejected."""
        return self.employee_profile_status == EmployeeProfileStatus.REJECTED
    
    def update_employee_profile_status(self, status: EmployeeProfileStatus) -> None:
        """Update the employee profile status."""
        self.employee_profile_status = status
        self.updated_at = datetime.utcnow()