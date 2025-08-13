from uuid import uuid4, UUID
from datetime import datetime
from typing import List, Optional, Dict, Any

from app.core.entities.employee import Employee, EmploymentStatus
from app.core.entities.events import EmployeeCreatedEvent, EmployeeUpdatedEvent, EmployeeDeactivatedEvent
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeValidationException,
    EmployeePermissionException
)
from app.core.interfaces.repositories import EmployeeRepositoryInterface, EventRepositoryInterface
from app.domain.services import EmployeeDomainService, RoleBasedAccessControlService
from app.application.dto.employee_dto import (
    CreateEmployeeRequest,
    UpdateEmployeeRequest,
    DeactivateEmployeeRequest,
    EmployeeResponse,
    EmployeeListResponse
)


class EmployeeUseCase:
    """Employee management use cases."""
    
    def __init__(
        self,
        employee_repository: EmployeeRepositoryInterface,
        event_repository: EventRepositoryInterface,
        domain_service: EmployeeDomainService,
        rbac_service: RoleBasedAccessControlService
    ):
        self.employee_repository = employee_repository
        self.event_repository = event_repository
        self.domain_service = domain_service
        self.rbac_service = rbac_service
    
    async def create_employee(self, request: CreateEmployeeRequest, creator_user_id: UUID) -> EmployeeResponse:
        """Create a new employee."""
        
        # Create employee entity
        employee = Employee(
            id=uuid4(),
            first_name=request.first_name.strip(),
            last_name=request.last_name.strip(),
            email=request.email.lower().strip(),
            phone=request.phone.strip() if request.phone else None,
            title=request.title.strip() if request.title else None,
            department=request.department.strip() if request.department else None,
            manager_id=request.manager_id,
            status=EmploymentStatus.ACTIVE,
            hired_at=datetime.utcnow(),
            deactivated_at=None,
            deactivation_reason=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            version=1
        )
        
        # Validate business rules
        await self.domain_service.validate_employee_creation(employee, creator_user_id)
        
        # Save employee
        created_employee = await self.employee_repository.create(employee)
        
        # Emit domain event
        event = EmployeeCreatedEvent(
            employee_id=created_employee.id,
            employee_data={
                "first_name": created_employee.first_name,
                "last_name": created_employee.last_name,
                "email": created_employee.email,
                "title": created_employee.title,
                "department": created_employee.department,
                "manager_id": str(created_employee.manager_id) if created_employee.manager_id else None,
                "created_by": str(creator_user_id)
            }
        )
        await self.event_repository.save_event(event)
        
        return self._to_response(created_employee)
    
    async def get_employee(self, employee_id: UUID, requester_user_id: UUID) -> EmployeeResponse:
        """Get employee by ID with permission check."""
        
        # Check permissions
        if not await self.rbac_service.can_view_employee(requester_user_id, employee_id):
            raise EmployeePermissionException("Insufficient permissions to view this employee")
        
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            raise EmployeeNotFoundException(f"Employee with ID {employee_id} not found")
        
        return self._to_response(employee)
    
    async def list_employees(
        self,
        requester_user_id: UUID,
        page: int = 1,
        size: int = 20,
        status: Optional[EmploymentStatus] = None,
        department: Optional[str] = None,
        manager_id: Optional[UUID] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> EmployeeListResponse:
        """List employees with filtering and pagination."""
        
        # For non-admin users, filter to only viewable employees
        if not await self.rbac_service.is_admin(requester_user_id):
            # If manager, filter to their team
            if await self.rbac_service.is_manager(requester_user_id):
                user_employee = await self.rbac_service._get_employee_by_user_id(requester_user_id)
                if user_employee:
                    manager_id = user_employee.id
            else:
                # Regular employees can only see themselves - return empty for list view
                return EmployeeListResponse(employees=[], total=0, page=page, size=size, pages=0)
        
        result = await self.employee_repository.list_employees(
            page=page,
            size=size,
            status=status,
            department=department,
            manager_id=manager_id,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        employees = [self._to_response(emp) for emp in result["employees"]]
        
        return EmployeeListResponse(
            employees=employees,
            total=result["total"],
            page=page,
            size=size,
            pages=(result["total"] + size - 1) // size
        )
    
    async def update_employee(
        self,
        employee_id: UUID,
        request: UpdateEmployeeRequest,
        updater_user_id: UUID,
        version: Optional[int] = None
    ) -> EmployeeResponse:
        """Update employee with optimistic concurrency control."""
        
        # Get current employee
        current_employee = await self.employee_repository.get_by_id(employee_id)
        if not current_employee:
            raise EmployeeNotFoundException(f"Employee with ID {employee_id} not found")
        
        # Check version for optimistic concurrency
        if version is not None and current_employee.version != version:
            raise EmployeeValidationException("Employee has been modified by another user. Please refresh and try again.")
        
        # Prepare updates dict
        updates = {}
        if request.first_name is not None:
            updates["first_name"] = request.first_name.strip()
        if request.last_name is not None:
            updates["last_name"] = request.last_name.strip()
        if request.email is not None:
            updates["email"] = request.email.lower().strip()
        if request.phone is not None:
            updates["phone"] = request.phone.strip() if request.phone else None
        if request.title is not None:
            updates["title"] = request.title.strip() if request.title else None
        if request.department is not None:
            updates["department"] = request.department.strip() if request.department else None
        if request.manager_id is not None:
            updates["manager_id"] = request.manager_id
        
        if not updates:
            return self._to_response(current_employee)
        
        # Validate business rules
        await self.domain_service.validate_employee_update(current_employee, updates, updater_user_id)
        
        # Apply updates
        for key, value in updates.items():
            setattr(current_employee, key, value)
        
        current_employee.updated_at = datetime.utcnow()
        current_employee.version += 1
        
        # Save updated employee
        updated_employee = await self.employee_repository.update(current_employee)
        
        # Emit domain event
        event = EmployeeUpdatedEvent(
            employee_id=updated_employee.id,
            changes={
                "updated_fields": list(updates.keys()),
                "updated_by": str(updater_user_id),
                "previous_version": version or current_employee.version - 1
            }
        )
        await self.event_repository.save_event(event)
        
        return self._to_response(updated_employee)
    
    async def deactivate_employee(
        self,
        employee_id: UUID,
        request: DeactivateEmployeeRequest,
        deactivator_user_id: UUID
    ) -> EmployeeResponse:
        """Deactivate employee (soft delete)."""
        
        # Get current employee
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            raise EmployeeNotFoundException(f"Employee with ID {employee_id} not found")
        
        # Validate business rules
        await self.domain_service.validate_employee_deactivation(employee, deactivator_user_id)
        
        # Deactivate employee
        employee.deactivate(request.reason)
        employee.updated_at = datetime.utcnow()
        employee.version += 1
        
        # Save deactivated employee
        deactivated_employee = await self.employee_repository.update(employee)
        
        # Emit domain event
        event = EmployeeDeactivatedEvent(
            employee_id=deactivated_employee.id,
            reason=request.reason
        )
        await self.event_repository.save_event(event)
        
        return self._to_response(deactivated_employee)
    
    async def get_employee_by_email(self, email: str, requester_user_id: UUID) -> Optional[EmployeeResponse]:
        """Get employee by email with permission check."""
        
        employee = await self.employee_repository.get_by_email(email.lower().strip())
        if not employee:
            return None
        
        # Check permissions
        if not await self.rbac_service.can_view_employee(requester_user_id, employee.id):
            raise EmployeePermissionException("Insufficient permissions to view this employee")
        
        return self._to_response(employee)
    
    async def get_team_members(self, manager_user_id: UUID) -> List[EmployeeResponse]:
        """Get all team members for a manager."""
        
        # Get manager's employee record
        manager_employee = await self.rbac_service._get_employee_by_user_id(manager_user_id)
        if not manager_employee:
            raise EmployeeNotFoundException("Manager employee record not found")
        
        # Check if user is actually a manager
        if not await self.rbac_service.is_manager(manager_user_id):
            raise EmployeePermissionException("User is not a manager")
        
        # Get team members
        team_members = await self.employee_repository.get_by_manager_id(manager_employee.id)
        
        return [self._to_response(emp) for emp in team_members]
    
    def _to_response(self, employee: Employee) -> EmployeeResponse:
        """Convert employee entity to response DTO."""
        return EmployeeResponse(
            id=employee.id,
            first_name=employee.first_name,
            last_name=employee.last_name,
            email=employee.email,
            phone=employee.phone,
            title=employee.title,
            department=employee.department,
            manager_id=employee.manager_id,
            status=employee.status,
            hired_at=employee.hired_at,
            deactivated_at=employee.deactivated_at,
            deactivation_reason=employee.deactivation_reason,
            created_at=employee.created_at,
            updated_at=employee.updated_at,
            version=employee.version
        )


# Employee-Service/app/application/use_case/role_use_cases.py

from uuid import uuid4, UUID
from datetime import datetime
from typing import List

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
        
        # Check if already assigned
        existing = await self.role_repository.get_role_assignment(request.user_id, role.id)
        if existing:
            raise RoleAlreadyAssignedException(f"Role {role_code} already assigned to user")
        
        # Create assignment
        assignment = RoleAssignment(
            id=uuid4(),
            user_id=request.user_id,
            role_id=role.id,
            scope=request.scope or {},
            created_at=datetime.utcnow()
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