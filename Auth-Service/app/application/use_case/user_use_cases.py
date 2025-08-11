from uuid import UUID
from datetime import datetime

from app.core.entities.user import User
from app.core.exceptions.auth_exceptions import UserNotFoundException
from app.core.interfaces.repositories import UserRepositoryInterface
from app.application.dto.user_dto import UserResponse


class UserUseCase:
    """User management use cases."""
    
    def __init__(self, user_repository: UserRepositoryInterface):
        self.user_repository = user_repository
    
    async def get_user_profile(self, user_id: UUID) -> UserResponse:
        """Get user profile by ID."""
        
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException("User not found")
        
        return UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_verified=user.is_verified,
            auth_provider=user.auth_provider,
            created_at=user.created_at
        )
    
    async def update_user_profile(self, user_id: UUID, full_name: str) -> UserResponse:
        """Update user profile."""
        
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException("User not found")
        
        user.full_name = full_name
        user.updated_at = datetime.utcnow()
        
        updated_user = await self.user_repository.update(user)
        
        return UserResponse(
            id=updated_user.id,
            email=updated_user.email,
            full_name=updated_user.full_name,
            is_verified=updated_user.is_verified,
            auth_provider=updated_user.auth_provider,
            created_at=updated_user.created_at
        )