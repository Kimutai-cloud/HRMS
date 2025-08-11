from abc import ABC, abstractmethod
from typing import Optional, List
from uuid import UUID

from app.core.entities.user import User
from app.core.entities.token import Token


class UserRepositoryInterface(ABC):
    """Abstract interface for user repository."""
    
    @abstractmethod
    async def create(self, user: User) -> User:
        """Create a new user."""
        pass
    
    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID."""
        pass
    
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        pass
    
    @abstractmethod
    async def update(self, user: User) -> User:
        """Update user."""
        pass
    
    @abstractmethod
    async def delete(self, user_id: UUID) -> bool:
        """Delete user."""
        pass


class TokenRepositoryInterface(ABC):
    """Abstract interface for token repository."""
    
    @abstractmethod
    async def create(self, token: Token) -> Token:
        """Create a new token."""
        pass
    
    @abstractmethod
    async def get_by_token(self, token: str) -> Optional[Token]:
        """Get token by token string."""
        pass
    
    @abstractmethod
    async def get_user_tokens(self, user_id: UUID, token_type: str) -> List[Token]:
        """Get all tokens for a user of specific type."""
        pass
    
    @abstractmethod
    async def revoke_token(self, token: str) -> bool:
        """Revoke a token."""
        pass
    
    @abstractmethod
    async def revoke_user_tokens(self, user_id: UUID, token_type: str) -> bool:
        """Revoke all tokens of specific type for a user."""
        pass
    
    @abstractmethod
    async def cleanup_expired_tokens(self) -> int:
        """Remove expired tokens and return count."""
        pass
