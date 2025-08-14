
from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import Optional
from uuid import UUID

from app.application.use_case.auth_use_cases import AuthUseCase
from app.core.entities.user import EmployeeProfileStatus
from app.core.exceptions.auth_exceptions import UserNotFoundException
from app.presentation.schema.internal_schema import (
    UpdateProfileStatusRequest,
    UpdateProfileStatusResponse,
    UserProfileStatusResponse
)
from app.presentation.api.dependencies import get_auth_use_case
from app.config.settings import settings

router = APIRouter(prefix="/internal", tags=["Internal API"])


async def verify_internal_service_auth(
    x_service_name: Optional[str] = Header(None),
    x_service_token: Optional[str] = Header(None)
):
    """Verify that the request is coming from an authorized internal service."""
    
    # Simple service authentication - in production, use proper service-to-service auth
    if not x_service_name or not x_service_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing internal service authentication headers"
        )
    
    # Verify the service token (in production, use JWT or other secure method)
    expected_token = getattr(settings, 'INTERNAL_SERVICE_TOKEN', 'internal-service-secret-token')
    if x_service_token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service token"
        )
    
    # You could also verify specific service names are allowed
    allowed_services = getattr(settings, 'ALLOWED_INTERNAL_SERVICES', ['employee-service'])
    if x_service_name not in allowed_services:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Service '{x_service_name}' not authorized for internal API access"
        )
    
    return x_service_name


@router.patch("/users/{user_id}/profile-status", response_model=UpdateProfileStatusResponse)
async def update_user_profile_status(
    user_id: UUID,
    request: UpdateProfileStatusRequest,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case),
    service_name: str = Depends(verify_internal_service_auth)
):
    """
    Update a user's employee profile status.
    This endpoint is called by the Employee Service when verification status changes.
    """
    
    try:
        # Get current user to capture previous status
        current_user = await auth_use_case.get_user_by_id(user_id)
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        previous_status = current_user.employee_profile_status
        
        # Update the status
        success = await auth_use_case.update_employee_profile_status(
            user_id=user_id,
            status=request.employee_profile_status
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update employee profile status"
            )
        
        return UpdateProfileStatusResponse(
            success=True,
            message="Employee profile status updated successfully",
            user_id=user_id,
            previous_status=previous_status,
            new_status=request.employee_profile_status
        )
        
    except UserNotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/users/{user_id}/profile-status", response_model=UserProfileStatusResponse)
async def get_user_profile_status(
    user_id: UUID,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case),
    service_name: str = Depends(verify_internal_service_auth)
):
    """
    Get a user's current employee profile status.
    This endpoint allows other services to check user verification status.
    """
    
    try:
        user = await auth_use_case.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        return UserProfileStatusResponse(
            user_id=user.id,
            email=user.email,
            employee_profile_status=user.employee_profile_status,
            updated_at=user.updated_at.isoformat() if user.updated_at else None
        )
        
    except UserNotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/users/by-profile-status/{status}", response_model=list[UserProfileStatusResponse])
async def get_users_by_profile_status(
    status: EmployeeProfileStatus,
    limit: int = 100,
    auth_use_case: AuthUseCase = Depends(get_auth_use_case),
    service_name: str = Depends(verify_internal_service_auth)
):
    """
    Get users by their employee profile status.
    Useful for Employee Service to sync data or send notifications.
    """
    
    try:
        users = await auth_use_case.get_users_by_profile_status(status, limit)
        
        return [
            UserProfileStatusResponse(
                user_id=user.id,
                email=user.email,
                employee_profile_status=user.employee_profile_status,
                updated_at=user.updated_at.isoformat() if user.updated_at else None
            )
            for user in users
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/health")
async def internal_api_health():
    """Health check for internal API."""
    return {"status": "healthy", "service": "auth-service-internal-api"}