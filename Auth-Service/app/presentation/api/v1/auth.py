from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.application.use_case.auth_use_cases import AuthUseCase
from app.application.dto.auth_dto import (
    RegisterUserRequest,
    LoginRequest,
    GoogleAuthRequest,
    RefreshTokenRequest,
    EmailVerificationRequest,
    PasswordResetRequest,
    ForgotPasswordRequest
)
from app.presentation.schema.auth_schema import (
    RegisterRequest,
    LoginRequest as LoginSchema,
    GoogleAuthRequest as GoogleAuthSchema,
    RefreshTokenRequest as RefreshTokenSchema,
    EmailVerificationRequest as EmailVerificationSchema,
    PasswordResetRequest as PasswordResetSchema,
    ForgotPasswordRequest as ForgotPasswordSchema
)
from app.presentation.schema.user_schema import AuthResponse, UserResponse
from app.presentation.schema.common_schema import SuccessResponse, ErrorResponse
from app.presentation.api.dependencies import get_auth_use_case
from app.core.exceptions.auth_exceptions import (
    UserAlreadyExistsException,
    InvalidCredentialsException,
    UserNotFoundException,
    EmailNotVerifiedException,
    TokenInvalidException,
    GoogleAuthException
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case)
):
    """Register a new user with email and password."""
    try:
        dto = RegisterUserRequest(
            email=request.email,
            password=request.password,
            full_name=request.full_name
        )
        user = await auth_use_case.register_user(dto)
        return user
    except UserAlreadyExistsException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginSchema,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case)
):
    """Login with email and password."""
    try:
        dto = LoginRequest(email=request.email, password=request.password)
        auth_response = await auth_use_case.login_user(dto)
        return auth_response
    except (InvalidCredentialsException, UserNotFoundException) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    except EmailNotVerifiedException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/google", response_model=AuthResponse)
async def google_auth(
    request: GoogleAuthSchema,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case)
):
    """Authenticate with Google ID token."""
    try:
        dto = GoogleAuthRequest(id_token=request.id_token)
        auth_response = await auth_use_case.google_auth(dto)
        return auth_response
    except GoogleAuthException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(
    request: RefreshTokenSchema,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case)
):
    """Refresh access token using refresh token."""
    try:
        dto = RefreshTokenRequest(refresh_token=request.refresh_token)
        auth_response = await auth_use_case.refresh_token(dto)
        return auth_response
    except (TokenInvalidException, UserNotFoundException) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.post("/verify-email", response_model=SuccessResponse)
async def verify_email(
    request: EmailVerificationSchema,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case)
):
    """Verify user email with verification token."""
    try:
        dto = EmailVerificationRequest(token=request.token)
        success = await auth_use_case.verify_email(dto)
        return SuccessResponse(message="Email verified successfully")
    except (TokenInvalidException, UserNotFoundException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )


@router.post("/forgot-password", response_model=SuccessResponse)
async def forgot_password(
    request: ForgotPasswordSchema,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case)
):
    """Send password reset email."""
    dto = ForgotPasswordRequest(email=request.email)
    await auth_use_case.forgot_password(dto)
    return SuccessResponse(message="If the email exists, a reset link has been sent")


@router.post("/reset-password", response_model=SuccessResponse)
async def reset_password(
    request: PasswordResetSchema,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case)
):
    """Reset password using reset token."""
    try:
        dto = PasswordResetRequest(token=request.token, new_password=request.new_password)
        success = await auth_use_case.reset_password(dto)
        return SuccessResponse(message="Password reset successfully")
    except (TokenInvalidException, UserNotFoundException, InvalidCredentialsException) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token or operation not allowed"
        )
