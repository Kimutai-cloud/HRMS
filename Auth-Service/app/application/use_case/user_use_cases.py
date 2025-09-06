from uuid import UUID
from datetime import datetime, timezone

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
    
    async def update_user_profile(self, user_id: UUID, full_name: str = None) -> UserResponse:
        """Update user profile."""
        
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException("User not found")
        
        # Update only provided fields
        if full_name is not None:
            user.full_name = full_name
        
        user.updated_at = datetime.now(timezone.utc)
        
        updated_user = await self.user_repository.update(user)
        
        return UserResponse(
            id=updated_user.id,
            email=updated_user.email,
            full_name=updated_user.full_name,
            is_verified=updated_user.is_verified,
            auth_provider=updated_user.auth_provider,
            created_at=updated_user.created_at
        )
    
    async def change_password(self, user_id: UUID, current_password: str, new_password: str) -> bool:
        """Change user password."""
        from app.infrastructure.security.password_hasher import PasswordHasher
        
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException("User not found")
        
        # Verify current password
        password_hasher = PasswordHasher()
        if not password_hasher.verify_password(current_password, user.hashed_password):
            raise ValueError("Current password is incorrect")
        
        # Hash new password and update
        user.hashed_password = password_hasher.hash_password(new_password)
        user.updated_at = datetime.now(timezone.utc)
        
        await self.user_repository.update(user)
        return True