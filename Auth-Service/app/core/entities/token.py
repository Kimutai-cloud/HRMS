from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"
    EMAIL_VERIFICATION = "email_verification"
    PASSWORD_RESET = "password_reset"


@dataclass
class Token:
    """Token entity for various authentication tokens."""
    
    id: Optional[UUID]
    user_id: UUID
    token: str
    token_type: TokenType
    expires_at: datetime
    is_revoked: bool = False
    user_agent: Optional[str] = None
    created_at: Optional[datetime] = None
    
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self) -> bool:
        return not self.is_revoked and not self.is_expired()


@dataclass
class JWTTokenPair:
    """JWT token pair containing access and refresh tokens."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900  #15min
