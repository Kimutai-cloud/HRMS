from uuid import uuid4, UUID
from datetime import datetime, timezone
from typing import List, Dict, Any

from app.core.entities.role import Role, RoleAssignment, RoleCode
from app.core.entities.events import RoleAssignedEvent, RoleRevokedEvent
from app.core.exceptions.role_exceptions import (
    RoleNotFoundException,
    RoleAlreadyAssignedException,
    RoleNotAssignedException,
    InvalidRoleCodeException,
    ForbiddenException
)
from app.core.interfaces.repositories import RoleRepositoryInterface, EventRepositoryInterface
from app.domain.services import RoleBasedAccessControlService
from app.application.dto.employee_dto import AssignRoleRequest, RoleAssignmentResponse


class RoleUseCase:
    """Role management use cases."""
    
    def __init__(
        self,
        role_repository: RoleRepositoryInterface,
        event_repository: EventRepositoryInterface,
        rbac_service: RoleBasedAccessControlService
    ):
        self.role_repository = role_repository
        self.event_repository = event_repository
        self.rbac_service = rbac_service
    
    async def assign_role(self, request: AssignRoleRequest, assigner_user_id: UUID) -> RoleAssignmentResponse:
        """Assign role to user."""
        
        # Check if assigner has permission
        if not await self.rbac_service.is_admin(assigner_user_id):
            raise ForbiddenException("Only admins can assign roles")
        
        # Validate role code
        try:
            role_code = RoleCode(request.role_code)
        except ValueError:
            raise InvalidRoleCodeException(f"Invalid role code: {request.role_code}")
        
        # Get role
        role = await self.role_repository.get_role_by_code(role_code)
        if not role:
            raise RoleNotFoundException(f"Role {role_code} not found")
        
        # For non-NEWCOMER roles, revoke all existing roles first to ensure only one active role
        if role_code != RoleCode.NEWCOMER:
            await self.role_repository.revoke_all_user_roles(request.user_id, assigner_user_id)
        
        # Check if already assigned (after potential revocation)
        existing = await self.role_repository.get_role_assignment(request.user_id, role.id)
        if existing and existing.is_active:
            raise RoleAlreadyAssignedException(f"Role {role_code} already assigned to user")
        
        # Create assignment
        assignment = RoleAssignment(
            id=uuid4(),
            user_id=request.user_id,
            role_id=role.id,
            scope=request.scope or {},
            created_at=datetime.now(timezone.utc)
        )
        
        # Save assignment
        created_assignment = await self.role_repository.assign_role(assignment)
        
        # Emit domain event
        event = RoleAssignedEvent(
            assignment_id=created_assignment.id,
            user_id=request.user_id,
            role_code=role_code.value
        )
        await self.event_repository.save_event(event)
        
        return RoleAssignmentResponse(
            id=created_assignment.id,
            user_id=created_assignment.user_id,
            role_code=role_code.value,
            scope=created_assignment.scope,
            created_at=created_assignment.created_at
        )
    
    async def revoke_role(self, user_id: UUID, role_code: str, revoker_user_id: UUID) -> bool:
        """Revoke role from user."""
        
        # Check if revoker has permission
        if not await self.rbac_service.is_admin(revoker_user_id):
            raise ForbiddenException("Only admins can revoke roles")
        
        # Validate role code
        try:
            role_code_enum = RoleCode(role_code)
        except ValueError:
            raise InvalidRoleCodeException(f"Invalid role code: {role_code}")
        
        # Get role
        role = await self.role_repository.get_role_by_code(role_code_enum)
        if not role:
            raise RoleNotFoundException(f"Role {role_code} not found")
        
        # Get assignment
        assignment = await self.role_repository.get_role_assignment(user_id, role.id)
        if not assignment:
            raise RoleNotAssignedException(f"Role {role_code} not assigned to user")
        
        # Revoke assignment
        success = await self.role_repository.revoke_role(assignment.id)
        
        if success:
            # Emit domain event
            event = RoleRevokedEvent(
                assignment_id=assignment.id,
                user_id=user_id,
                role_code=role_code
            )
            await self.event_repository.save_event(event)
        
        return success
    
    async def get_user_roles(self, user_id: UUID, requester_user_id: UUID) -> List[RoleAssignmentResponse]:
        """Get all role assignments for a user."""
        
        # Users can see their own roles, admins can see all
        if user_id != requester_user_id and not await self.rbac_service.is_admin(requester_user_id):
            raise ForbiddenException("Insufficient permissions to view user roles")
        
        assignments = await self.role_repository.get_user_roles(user_id)
        
        responses = []
        for assignment in assignments:
            role = await self.role_repository.get_role_by_id(assignment.role_id)
            if role:
                responses.append(RoleAssignmentResponse(
                    id=assignment.id,
                    user_id=assignment.user_id,
                    role_code=role.code.value,
                    scope=assignment.scope,
                    created_at=assignment.created_at
                ))
        
        return responses
    
    async def list_roles(self) -> List[Dict[str, Any]]:
        """List all available roles."""
        
        roles = await self.role_repository.list_roles()
        
        return [
            {
                "id": role.id,
                "code": role.code.value,
                "name": role.name,
                "description": role.description
            }
            for role in roles
        ]