from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.core.exceptions.auth_exceptions import TokenInvalidException, UserNotFoundException
from app.infrastructure.database.connection import db_connection
from app.infrastructure.database.repositories.user_repository import UserRepository
from app.infrastructure.database.repositories.token_repository import TokenRepository
from app.infrastructure.security.jwt_handler import JWTHandler
from app.infrastructure.security.password_hasher import PasswordHasher
from app.infrastructure.external.fastapi_mail_service import FastAPIMailService
from app.infrastructure.external.google_client import GoogleAuthService
from app.application.use_case.auth_use_cases import AuthUseCase
from app.application.use_case.user_use_cases import UserUseCase
from app.core.entities.user import User

# Security scheme
security = HTTPBearer()


# Database session dependency
async def get_db_session() -> AsyncSession:
    async with db_connection.async_session() as session:
        try:
            yield session
        finally:
            await session.close()


# Service dependencies
def get_password_service() -> PasswordHasher:
    return PasswordHasher()


def get_token_service() -> JWTHandler:
    return JWTHandler()


def get_email_service() -> FastAPIMailService:
    return FastAPIMailService()


def get_google_auth_service() -> GoogleAuthService:
    return GoogleAuthService()


# Repository dependencies
def get_user_repository(session: AsyncSession = Depends(get_db_session)) -> UserRepository:
    return UserRepository(session)


def get_token_repository(session: AsyncSession = Depends(get_db_session)) -> TokenRepository:
    return TokenRepository(session)


# Use case dependencies
def get_auth_use_case(
    user_repository: UserRepository = Depends(get_user_repository),
    token_repository: TokenRepository = Depends(get_token_repository),
    password_service: PasswordHasher = Depends(get_password_service),
    token_service: JWTHandler = Depends(get_token_service),
    email_service: FastAPIMailService = Depends(get_email_service),
    google_auth_service: GoogleAuthService = Depends(get_google_auth_service)
) -> AuthUseCase:
    return AuthUseCase(
        user_repository=user_repository,
        token_repository=token_repository,
        password_service=password_service,
        token_service=token_service,
        email_service=email_service,
        google_auth_service=google_auth_service
    )


def get_user_use_case(
    user_repository: UserRepository = Depends(get_user_repository)
) -> UserUseCase:
    return UserUseCase(user_repository)


# Authentication dependency
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    token_service: JWTHandler = Depends(get_token_service),
    user_repository: UserRepository = Depends(get_user_repository)
) -> User:
    try:
        # Verify token
        token_data = token_service.verify_token(credentials.credentials)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if it's an access token
        if token_data.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get user
        user_id = token_data.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user = await user_repository.get_by_id(UUID(user_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return user
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
