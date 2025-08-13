from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID

from app.application.use_case.role_use_cases import RoleUseCase
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.presentation.schema.role_schema import (
    AssignRoleRequest,
    RoleAssignmentResponse,
    RoleResponse
)
from app.presentation.schema.common_schema import SuccessResponse
from app.presentation.api.dependencies import (
    get_role_use_case,
    get_audit_repository,
    require_admin,
    get_request_context
)
from app.core.exceptions.role_exceptions import (
    RoleNotFoundException,
    RoleAlreadyAssignedException,
    RoleNotAssignedException,
    InvalidRoleCodeException,
    ForbiddenException
)

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("/", response_model=List[RoleResponse])
async def list_roles(
    role_use_case: RoleUseCase = Depends(get_role_use_case)
):
    """List all available roles."""
    
    roles = await role_use_case.list_roles()
    return roles


@router.post("/assignments", response_model=RoleAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_role(
    request: AssignRoleRequest,
    current_user: dict = Depends(require_admin),
    role_use_case: RoleUseCase = Depends(get_role_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """Assign role to user. Admin only."""
    
    try:
        # Convert request to DTO
        from app.application.dto.employee_dto import AssignRoleRequest as AssignRoleDTO
        dto = AssignRoleDTO(
            user_id=request.user_id,
            role_code=request.role_code,
            scope=request.scope
        )
        
        # Assign role
        assignment = await role_use_case.assign_role(dto, current_user["user_id"])
        
        # Audit log
        await audit_repository.log_action(
            entity_type="role_assignment",
            entity_id=assignment.id,
            action="CREATE",
            user_id=current_user["user_id"],
            changes={
                "user_id": str(request.user_id),
                "role_code": request.role_code,
                "scope": request.scope
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return assignment
        
    except RoleNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except RoleAlreadyAssignedException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except InvalidRoleCodeException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.delete("/assignments/{user_id}/{role_code}", response_model=SuccessResponse)
async def revoke_role(
    user_id: UUID,
    role_code: str,
    current_user: dict = Depends(require_admin),
    role_use_case: RoleUseCase = Depends(get_role_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """Revoke role from user. Admin only."""
    
    try:
        # Revoke role
        success = await role_use_case.revoke_role(
            user_id=user_id,
            role_code=role_code,
            revoker_user_id=current_user["user_id"]
        )
        
        if success:
            # Audit log
            await audit_repository.log_action(
                entity_type="role_assignment",
                entity_id=user_id,  # Using user_id as we don't have assignment_id
                action="DELETE",
                user_id=current_user["user_id"],
                changes={
                    "user_id": str(user_id),
                    "role_code": role_code
                },
                ip_address=request_context.get("ip_address"),
                user_agent=request_context.get("user_agent")
            )
        
        return SuccessResponse(message=f"Role {role_code} revoked from user")
        
    except RoleNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except RoleNotAssignedException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except InvalidRoleCodeException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/assignments/{user_id}", response_model=List[RoleAssignmentResponse])
async def get_user_roles(
    user_id: UUID,
    current_user: dict = Depends(require_admin),
    role_use_case: RoleUseCase = Depends(get_role_use_case)
):
    """Get all role assignments for a user. Admin only or own roles."""
    
    try:
        assignments = await role_use_case.get_user_roles(
            user_id=user_id,
            requester_user_id=current_user["user_id"]
        )
        
        return assignments
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )