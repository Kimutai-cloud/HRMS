from abc import ABC, abstractmethod
from typing import Optional

from app.core.entities.user import User
from app.core.entities.token import JWTTokenPair


class PasswordServiceInterface(ABC):
    """Abstract interface for password hashing service."""
    
    @abstractmethod
    def hash_password(self, password: str) -> str:
        """Hash a password."""
        pass
    
    @abstractmethod
    def verify_password(self, password: str, hashed_password: str) -> bool:
        """Verify a password against hash."""
        pass


class TokenServiceInterface(ABC):
    """Abstract interface for token service."""
    
    @abstractmethod
    def create_access_token(self, user: User) -> str:
        """Create access token for user."""
        pass
    
    @abstractmethod
    def create_refresh_token(self, user: User) -> str:
        """Create refresh token for user."""
        pass
    
    @abstractmethod
    def create_token_pair(self, user: User) -> JWTTokenPair:
        """Create access and refresh token pair."""
        pass
    
    @abstractmethod
    def verify_token(self, token: str) -> Optional[dict]:
        """Verify and decode token."""
        pass
    
    @abstractmethod
    def create_email_verification_token(self, user: User) -> str:
        """Create email verification token."""
        pass
    
    @abstractmethod
    def create_password_reset_token(self, user: User) -> str:
        """Create password reset token."""
        pass


class EmailServiceInterface(ABC):
    """Abstract interface for email service."""
    
    @abstractmethod
    async def send_verification_email(self, email: str, token: str) -> bool:
        """Send email verification email."""
        pass
    
    @abstractmethod
    async def send_password_reset_email(self, email: str, token: str) -> bool:
        """Send password reset email."""
        pass
    
    @abstractmethod
    async def send_welcome_email(self, email: str, name: str) -> bool:
        """Send welcome email."""
        pass


class GoogleAuthServiceInterface(ABC):
    """Abstract interface for Google authentication service."""
    
    @abstractmethod
    async def verify_google_token(self, token: str) -> dict:
        """Verify Google ID token and return user info."""
        pass