
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from uuid import UUID
from typing import Optional

from app.core.entities.user import AuthProvider, EmployeeProfileStatus

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class EmailVerificationRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str]
    is_verified: bool
    auth_provider: AuthProvider
    employee_profile_status: EmployeeProfileStatus  
    created_at: datetime
    
    
class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    
   
class UpdateProfileRequest(BaseModel):
    full_name: str = Field(..., max_length=255)


class EmployeeProfileStatusResponse(BaseModel):
    """Response showing user's employee profile status and next steps."""
    user_id: UUID
    email: EmailStr
    employee_profile_status: EmployeeProfileStatus
    status_description: str
    next_steps: list[str]
    can_access_system: bool
    
   