from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID

from app.core.entities.user import AuthProvider


@dataclass
class UserResponse:
    id: UUID
    email: str
    full_name: Optional[str]
    is_verified: bool
    auth_provider: AuthProvider
    created_at: datetime


@dataclass
class AuthResponse:
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: UserResponse