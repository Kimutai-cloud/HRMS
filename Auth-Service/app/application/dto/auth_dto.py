from dataclasses import dataclass
from typing import Optional


@dataclass
class RegisterUserRequest:
    email: str
    password: str
    full_name: Optional[str] = None


@dataclass
class LoginRequest:
    email: str
    password: str


@dataclass
class GoogleAuthRequest:
    id_token: str


@dataclass
class RefreshTokenRequest:
    refresh_token: str


@dataclass
class EmailVerificationRequest:
    token: str


@dataclass
class PasswordResetRequest:
    token: str
    new_password: str


@dataclass
class ForgotPasswordRequest:
    email: str