from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum


class AuthProvider(str, Enum):
    EMAIL = "email"
    GOOGLE = "google"


@dataclass
class User:
    """User entity representing a user in the system."""
    
    id: Optional[UUID]
    email: str
    hashed_password: Optional[str]
    full_name: Optional[str]
    is_verified: bool
    auth_provider: AuthProvider
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    def __post_init__(self):
        if self.auth_provider == AuthProvider.EMAIL and not self.hashed_password:
            raise ValueError("Email auth provider requires a hashed password")
    
    def is_google_user(self) -> bool:
        return self.auth_provider == AuthProvider.GOOGLE
    
    def can_login_with_password(self) -> bool:
        return self.auth_provider == AuthProvider.EMAIL and self.hashed_password is not None
