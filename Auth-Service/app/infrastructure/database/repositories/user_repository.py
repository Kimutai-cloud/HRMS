from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.entities.user import User, AuthProvider
from app.core.interfaces.repositories import UserRepositoryInterface
from app.core.exceptions.auth_exceptions import UserAlreadyExistsException
from app.infrastructure.database.models import UserModel


class UserRepository(UserRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, user: User) -> User:
        db_user = UserModel(
            id=user.id,
            email=user.email,
            hashed_password=user.hashed_password,
            full_name=user.full_name,
            is_verified=user.is_verified,
            auth_provider=user.auth_provider.value,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        
        try:
            self.session.add(db_user)
            await self.session.commit()
            await self.session.refresh(db_user)
            return self._to_entity(db_user)
        except IntegrityError:
            await self.session.rollback()
            raise UserAlreadyExistsException("User with this email already exists")
    
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.session.execute(
            select(UserModel).where(UserModel.id == user_id)
        )
        db_user = result.scalar_one_or_none()
        return self._to_entity(db_user) if db_user else None
    
    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(UserModel).where(UserModel.email == email)
        )
        db_user = result.scalar_one_or_none()
        return self._to_entity(db_user) if db_user else None
    
    async def update(self, user: User) -> User:
        result = await self.session.execute(
            select(UserModel).where(UserModel.id == user.id)
        )
        db_user = result.scalar_one_or_none()
        
        if not db_user:
            raise ValueError("User not found")
        
        db_user.email = user.email
        db_user.hashed_password = user.hashed_password
        db_user.full_name = user.full_name
        db_user.is_verified = user.is_verified
        db_user.auth_provider = user.auth_provider.value
        db_user.updated_at = user.updated_at
        
        await self.session.commit()
        await self.session.refresh(db_user)
        return self._to_entity(db_user)
    
    async def delete(self, user_id: UUID) -> bool:
        result = await self.session.execute(
            select(UserModel).where(UserModel.id == user_id)
        )
        db_user = result.scalar_one_or_none()
        
        if db_user:
            await self.session.delete(db_user)
            await self.session.commit()
            return True
        return False
    
    def _to_entity(self, db_user: UserModel) -> User:
        return User(
            id=db_user.id,
            email=db_user.email,
            hashed_password=db_user.hashed_password,
            full_name=db_user.full_name,
            is_verified=db_user.is_verified,
            auth_provider=AuthProvider(db_user.auth_provider),
            created_at=db_user.created_at,
            updated_at=db_user.updated_at
        )
