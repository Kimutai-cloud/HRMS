
from uuid import uuid4, UUID
from datetime import datetime
from typing import Optional, List

from app.core.entities.user import User, AuthProvider, EmployeeProfileStatus
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


class EmailServiceException(Exception):
    """Raised when email service fails."""
    pass


class AuthUseCase:
    """Authentication use cases with employee profile status management."""
    
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
        
        # Validate password strength
        if len(request.password) < 8:
            raise InvalidCredentialsException("Password must be at least 8 characters long")
        
        # Create new user with NOT_STARTED profile status
        hashed_password = self.password_service.hash_password(request.password)
        user = User(
            id=uuid4(),
            email=request.email,
            hashed_password=hashed_password,
            full_name=request.full_name,
            is_verified=False,
            auth_provider=AuthProvider.EMAIL,
            employee_profile_status=EmployeeProfileStatus.NOT_STARTED,  # Default status
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Send verification email
        verification_token = self.token_service.create_email_verification_token(user)
        
        try:
            email_sent = await self.email_service.send_verification_email(
                user.email, 
                verification_token
            )
            
            if not email_sent:
                raise EmailServiceException(
                    "Failed to send verification email. Please check your email configuration."
                )
                
        except Exception as e:
            raise EmailServiceException(
                f"Failed to send verification email: {str(e)}. "
                "Please check your email service configuration."
            )
        
        # Create user only if email was sent successfully
        try:
            created_user = await self.user_repository.create(user)
            print(f"✅ User created successfully: {created_user.email}")
            print(f"📧 Verification email sent to: {created_user.email}")
            print(f"👤 Employee profile status: {created_user.employee_profile_status.value}")
            
        except Exception as e:
            print(f"❌ Critical: Email sent but user creation failed: {e}")
            raise Exception(
                "Account creation failed after sending verification email. "
                "Please contact support if you received a verification email."
            )
        
        return UserResponse(
            id=created_user.id,
            email=created_user.email,
            full_name=created_user.full_name,
            is_verified=created_user.is_verified,
            auth_provider=created_user.auth_provider,
            employee_profile_status=created_user.employee_profile_status,  # Include in response
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
            raise EmailNotVerifiedException(
                "Please verify your email address before logging in. "
                "Check your inbox for the verification email."
            )
        
        # Create tokens (JWT will include employee_profile_status)
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
                employee_profile_status=user.employee_profile_status,  # Include in response
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
                    employee_profile_status=EmployeeProfileStatus.NOT_STARTED,  # Still need employee profile
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                user = await self.user_repository.create(user)
                
                # Send welcome email (non-blocking)
                try:
                    await self.email_service.send_welcome_email(user.email, user.full_name or "User")
                except Exception as e:
                    print(f"⚠️  Welcome email failed (non-critical): {e}")
            
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
                    employee_profile_status=user.employee_profile_status,
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
        
        # Get user (this ensures we have the latest employee_profile_status)
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException("User not found")
        
        # Create new tokens with updated user info
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
                employee_profile_status=user.employee_profile_status,
                created_at=user.created_at
            )
        )
    
    async def verify_email(self, request: EmailVerificationRequest) -> bool:
        """Verify user email with verification token."""
        
        # Verify token
        token_data = self.token_service.verify_token(request.token)
        if not token_data:
            raise TokenInvalidException("Invalid or expired verification token")
        
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
        
        # Send welcome email (non-blocking)
        try:
            await self.email_service.send_welcome_email(user.email, user.full_name or "User")
        except Exception as e:
            print(f"⚠️  Welcome email failed (non-critical): {e}")
        
        print(f"✅ Email verified for user: {user.email}")
        print(f"👤 Next step: Complete employee profile (status: {user.employee_profile_status.value})")
        
        return True
    
    async def forgot_password(self, request: ForgotPasswordRequest) -> bool:
        """Send password reset email."""
        
        user = await self.user_repository.get_by_email(request.email)
        if not user:
            # Don't reveal that user doesn't exist
            print(f"⚠️  Password reset requested for non-existent email: {request.email}")
            return True
        
        if not user.can_login_with_password():
            # Don't send reset email for Google users
            print(f"⚠️  Password reset requested for Google user: {request.email}")
            return True
        
        # Create reset token and send email
        reset_token = self.token_service.create_password_reset_token(user)
        
        try:
            email_sent = await self.email_service.send_password_reset_email(user.email, reset_token)
            if not email_sent:
                print(f"❌ Failed to send password reset email to: {user.email}")
        except Exception as e:
            print(f"❌ Password reset email failed: {e}")
        
        return True
    
    async def reset_password(self, request: PasswordResetRequest) -> bool:
        """Reset user password using reset token."""
        
        # Verify token
        token_data = self.token_service.verify_token(request.token)
        if not token_data:
            raise TokenInvalidException("Invalid or expired reset token")
        
        user_id = token_data.get('sub')
        if not user_id:
            raise TokenInvalidException("Invalid token payload")
        
        # Validate new password
        if len(request.new_password) < 8:
            raise InvalidCredentialsException("Password must be at least 8 characters long")
        
        # Get and update user
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException("User not found")
        
        if not user.can_login_with_password():
            raise InvalidCredentialsException("Cannot reset password for this user")
        
        user.hashed_password = self.password_service.hash_password(request.new_password)
        user.updated_at = datetime.utcnow()
        await self.user_repository.update(user)
        
        # Revoke all refresh tokens
        await self.token_repository.revoke_user_tokens(user.id, TokenType.REFRESH.value)
        
        return True
    
    # New methods for employee profile status management
    
    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID."""
        return await self.user_repository.get_by_id(user_id)
    
    async def update_employee_profile_status(self, user_id: UUID, status: EmployeeProfileStatus) -> bool:
        """Update user's employee profile status."""
        success = await self.user_repository.update_employee_profile_status(user_id, status)
        
        if success:
            user = await self.user_repository.get_by_id(user_id)
            if user:
                print(f"👤 Employee profile status updated for {user.email}: {status.value}")
        
        return success
    
    async def get_users_by_profile_status(self, status: EmployeeProfileStatus, limit: int = 100) -> List[User]:
        """Get users by their employee profile status."""
        return await self.user_repository.get_users_by_profile_status(status, limit)