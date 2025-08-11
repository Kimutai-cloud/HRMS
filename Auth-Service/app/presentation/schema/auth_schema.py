from pydantic import BaseModel, EmailStr, Field
from typing import Optional


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