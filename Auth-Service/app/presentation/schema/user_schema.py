from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from uuid import UUID
from typing import Optional

from app.core.entities.user import AuthProvider, EmployeeProfileStatus


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str]
    is_verified: bool
    auth_provider: AuthProvider
    employee_profile_status: EmployeeProfileStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8, max_length=128)