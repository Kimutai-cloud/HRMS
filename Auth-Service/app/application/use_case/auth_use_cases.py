from uuid import uuid4
from datetime import datetime

from app.core.entities.user import User, AuthProvider
from app.core.entities.token import Token, TokenType
from app.core.exceptions.auth_exceptions import (
    UserAlreadyExistsException,
    InvalidCredentialsException,
    UserNotFoundException,
    EmailNotVerifiedException,
    TokenInvalidException,
    GoogleAuthException
)
from app.core.interfaces.repositories import UserRepositoryInterface, TokenRepositoryInterface
from app.core.interfaces.services import (
    PasswordServiceInterface,
    TokenServiceInterface,
    EmailServiceInterface,
    GoogleAuthServiceInterface
)
from app.application.dto.auth_dto import (
    RegisterUserRequest,
    LoginRequest,
    GoogleAuthRequest,
    RefreshTokenRequest,
    EmailVerificationRequest,
    PasswordResetRequest,
    ForgotPasswordRequest
)
from app.application.dto.user_dto import AuthResponse, UserResponse


class AuthUseCase:
    """Authentication use cases."""
    
    def __init__(
        self,
        user_repository: UserRepositoryInterface,
        token_repository: TokenRepositoryInterface,
        password_service: PasswordServiceInterface,
        token_service: TokenServiceInterface,
        email_service: EmailServiceInterface,
        google_auth_service: GoogleAuthServiceInterface
    ):
        self.user_repository = user_repository
        self.token_repository = token_repository
        self.password_service = password_service
        self.token_service = token_service
        self.email_service = email_service
        self.google_auth_service = google_auth_service
    
    async def register_user(self, request: RegisterUserRequest) -> UserResponse:
        """Register a new user with email and password."""
        
        # Check if user already exists
        existing_user = await self.user_repository.get_by_email(request.email)
        if existing_user:
            raise UserAlreadyExistsException("User with this email already exists")
        
        # Create new user
        hashed_password = self.password_service.hash_password(request.password)
        user = User(
            id=uuid4(),
            email=request.email,
            hashed_password=hashed_password,
            full_name=request.full_name,
            is_verified=False,
            auth_provider=AuthProvider.EMAIL,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Save user
        created_user = await self.user_repository.create(user)
        
        # Send verification email
        verification_token = self.token_service.create_email_verification_token(created_user)
        await self.email_service.send_verification_email(created_user.email, verification_token)
        
        return UserResponse(
            id=created_user.id,
            email=created_user.email,
            full_name=created_user.full_name,
            is_verified=created_user.is_verified,
            auth_provider=created_user.auth_provider,
            created_at=created_user.created_at
        )
    
    async def login_user(self, request: LoginRequest) -> AuthResponse:
        """Login user with email and password."""
        
        # Get user by email
        user = await self.user_repository.get_by_email(request.email)
        if not user:
            raise InvalidCredentialsException("Invalid email or password")
        
        # Verify password
        if not user.can_login_with_password():
            raise InvalidCredentialsException("Invalid email or password")
        
        if not self.password_service.verify_password(request.password, user.hashed_password):
            raise InvalidCredentialsException("Invalid email or password")
        
        # Check if email is verified
        if not user.is_verified:
            raise EmailNotVerifiedException("Email not verified")
        
        # Create tokens
        token_pair = self.token_service.create_token_pair(user)
        
        return AuthResponse(
            access_token=token_pair.access_token,
            refresh_token=token_pair.refresh_token,
            token_type=token_pair.token_type,
            expires_in=token_pair.expires_in,
            user=UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                is_verified=user.is_verified,
                auth_provider=user.auth_provider,
                created_at=user.created_at
            )
        )
    
    async def google_auth(self, request: GoogleAuthRequest) -> AuthResponse:
        """Authenticate user with Google ID token."""
        
        try:
            # Verify Google token
            user_info = await self.google_auth_service.verify_google_token(request.id_token)
            email = user_info.get('email')
            name = user_info.get('name')
            
            if not email:
                raise GoogleAuthException("Invalid Google token: email not found")
            
            # Get or create user
            user = await self.user_repository.get_by_email(email)
            if not user:
                user = User(
                    id=uuid4(),
                    email=email,
                    hashed_password=None,
                    full_name=name,
                    is_verified=True,  # Google accounts are pre-verified
                    auth_provider=AuthProvider.GOOGLE,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                user = await self.user_repository.create(user)
                
                # Send welcome email
                await self.email_service.send_welcome_email(user.email, user.full_name or "User")
            
            # Create tokens
            token_pair = self.token_service.create_token_pair(user)
            
            return AuthResponse(
                access_token=token_pair.access_token,
                refresh_token=token_pair.refresh_token,
                token_type=token_pair.token_type,
                expires_in=token_pair.expires_in,
                user=UserResponse(
                    id=user.id,
                    email=user.email,
                    full_name=user.full_name,
                    is_verified=user.is_verified,
                    auth_provider=user.auth_provider,
                    created_at=user.created_at
                )
            )
            
        except Exception as e:
            raise GoogleAuthException(f"Google authentication failed: {str(e)}")
    
    async def refresh_token(self, request: RefreshTokenRequest) -> AuthResponse:
        """Refresh access token using refresh token."""
        
        # Verify refresh token
        token_data = self.token_service.verify_token(request.refresh_token)
        if not token_data:
            raise TokenInvalidException("Invalid refresh token")
        
        user_id = token_data.get('sub')
        if not user_id:
            raise TokenInvalidException("Invalid token payload")
        
        # Get user
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException("User not found")
        
        # Create new tokens
        token_pair = self.token_service.create_token_pair(user)
        
        return AuthResponse(
            access_token=token_pair.access_token,
            refresh_token=token_pair.refresh_token,
            token_type=token_pair.token_type,
            expires_in=token_pair.expires_in,
            user=UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                is_verified=user.is_verified,
                auth_provider=user.auth_provider,
                created_at=user.created_at
            )
        )
    
    async def verify_email(self, request: EmailVerificationRequest) -> bool:
        """Verify user email with verification token."""
        
        # Verify token
        token_data = self.token_service.verify_token(request.token)
        if not token_data:
            raise TokenInvalidException("Invalid verification token")
        
        user_id = token_data.get('sub')
        if not user_id:
            raise TokenInvalidException("Invalid token payload")
        
        # Get and update user
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException("User not found")
        
        if user.is_verified:
            return True  # Already verified
        
        user.is_verified = True
        user.updated_at = datetime.utcnow()
        await self.user_repository.update(user)
        
        # Send welcome email
        await self.email_service.send_welcome_email(user.email, user.full_name or "User")
        
        return True
    
    async def forgot_password(self, request: ForgotPasswordRequest) -> bool:
        """Send password reset email."""
        
        user = await self.user_repository.get_by_email(request.email)
        if not user:
            # Don't reveal that user doesn't exist
            return True
        
        if not user.can_login_with_password():
            # Don't send reset email for Google users
            return True
        
        # Create reset token and send email
        reset_token = self.token_service.create_password_reset_token(user)
        await self.email_service.send_password_reset_email(user.email, reset_token)
        
        return True
    
    async def reset_password(self, request: PasswordResetRequest) -> bool:
        """Reset user password using reset token."""
        
        # Verify token
        token_data = self.token_service.verify_token(request.token)
        if not token_data:
            raise TokenInvalidException("Invalid reset token")
        
        user_id = token_data.get('sub')
        if not user_id:
            raise TokenInvalidException("Invalid token payload")
        
        # Get and update user
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException("User not found")
        
        if not user.can_login_with_password():
            raise InvalidCredentialsException("Cannot reset password for this user")
        
        # Update password
        user.hashed_password = self.password_service.hash_password(request.new_password)
        user.updated_at = datetime.utcnow()
        await self.user_repository.update(user)
        
        # Revoke all refresh tokens
        await self.token_repository.revoke_user_tokens(user.id, TokenType.REFRESH.value)
        
        return True