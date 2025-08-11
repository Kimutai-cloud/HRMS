from fastapi import APIRouter, Depends, HTTPException, status

from app.application.use_case.user_use_cases import UserUseCase
from app.presentation.schema.user_schema import UserResponse, UpdateProfileRequest
from app.presentation.api.dependencies import get_user_use_case, get_current_user
from app.core.entities.user import User
from app.core.exceptions.auth_exceptions import UserNotFoundException

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current user profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_verified=current_user.is_verified,
        auth_provider=current_user.auth_provider,
        created_at=current_user.created_at
    )


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    user_use_case: UserUseCase = Depends(get_user_use_case)
):
    """Update current user profile."""
    try:
        updated_user = await user_use_case.update_user_profile(
            user_id=current_user.id,
            full_name=request.full_name
        )
        return updated_user
    except UserNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )