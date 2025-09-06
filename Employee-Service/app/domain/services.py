from typing import List, Optional, Dict, Any
from uuid import UUID

from app.core.entities.employee import Employee, EmploymentStatus
from app.core.entities.role import RoleCode, RoleAssignment
from app.core.interfaces.repositories import EmployeeRepositoryInterface, RoleRepositoryInterface
from app.core.interfaces.services import PermissionServiceInterface
from app.core.exceptions.employee_exceptions import (
    EmployeePermissionException,
    CircularManagershipException,
    EmployeeValidationException
)
from app.core.exceptions.role_exceptions import (
    ForbiddenException,
    InsufficientPermissionsException
)


class EmployeeDomainService:
    """Domain service for employee business logic."""
    
    def __init__(
        self,
        employee_repository: EmployeeRepositoryInterface,
        role_repository: RoleRepositoryInterface,
        permission_service: PermissionServiceInterface
    ):
        self.employee_repository = employee_repository
        self.role_repository = role_repository
        self.permission_service = permission_service
    
    async def validate_employee_creation(self, employee: Employee, creator_user_id: UUID) -> None:
        """Validate employee creation business rules."""
        # Check permissions
        if not await self.permission_service.can_create_employee(creator_user_id):
            raise EmployeePermissionException("Insufficient permissions to create employees")
        
        # Check email uniqueness
        existing = await self.employee_repository.get_by_email(employee.email)
        if existing:
            raise EmployeeValidationException(f"Employee with email {employee.email} already exists")
        
        # Validate manager exists and is active
        if employee.manager_id:
            manager = await self.employee_repository.get_by_id(employee.manager_id)
            if not manager:
                raise EmployeeValidationException("Specified manager does not exist")
            if not manager.is_active():
                raise EmployeeValidationException("Cannot assign inactive manager")
    
    async def validate_employee_update(
        self, 
        current_employee: Employee, 
        updates: Dict[str, Any], 
        updater_user_id: UUID
    ) -> None:
        """Validate employee update business rules."""
        # Check permissions
        if not await self.permission_service.can_update_employee(updater_user_id, current_employee.id):
            raise EmployeePermissionException("Insufficient permissions to update this employee")
        
        # If changing manager, validate circular relationship
        if 'manager_id' in updates and updates['manager_id']:
            new_manager_id = updates['manager_id']
            if await self.employee_repository.check_circular_managership(current_employee.id, new_manager_id):
                raise CircularManagershipException("Cannot create circular manager relationship")
            
            # Validate new manager exists and is active
            manager = await self.employee_repository.get_by_id(new_manager_id)
            if not manager:
                raise EmployeeValidationException("Specified manager does not exist")
            if not manager.is_active():
                raise EmployeeValidationException("Cannot assign inactive manager")
        
        # If changing email, validate uniqueness
        if 'email' in updates and updates['email'] != current_employee.email:
            existing = await self.employee_repository.get_by_email(updates['email'])
            if existing:
                raise EmployeeValidationException(f"Employee with email {updates['email']} already exists")
    
    async def validate_employee_deactivation(self, employee: Employee, deactivator_user_id: UUID) -> None:
        """Validate employee deactivation business rules."""
        # Check permissions
        if not await self.permission_service.can_deactivate_employee(deactivator_user_id, employee.id):
            raise EmployeePermissionException("Insufficient permissions to deactivate this employee")
        
        # Check if employee is already inactive
        if not employee.is_active():
            raise EmployeeValidationException("Employee is already inactive")
        
        # Check if employee has direct reports
        direct_reports = await self.employee_repository.get_by_manager_id(employee.id)
        if direct_reports:
            active_reports = [emp for emp in direct_reports if emp.is_active()]
            if active_reports:
                raise EmployeeValidationException(
                    f"Cannot deactivate employee with {len(active_reports)} active direct reports. "
                    "Please reassign or deactivate direct reports first."
                )


class RoleBasedAccessControlService:
    """Service for RBAC logic and permission checking."""
    
    def __init__(
        self,
        role_repository: RoleRepositoryInterface,
        employee_repository: EmployeeRepositoryInterface
    ):
        self.role_repository = role_repository
        self.employee_repository = employee_repository
    
    async def get_user_roles(self, user_id: UUID) -> List[RoleCode]:
        """Get all role codes for a user."""
        assignments = await self.role_repository.get_user_roles(user_id)
        role_codes = []
        
        for assignment in assignments:
            role = await self.role_repository.get_role_by_id(assignment.role_id)
            if role:
                role_codes.append(role.code)
        
        return role_codes
    
    async def has_permission(self, user_id: UUID, required_roles: List[RoleCode]) -> bool:
        """Check if user has any of the required roles."""
        user_roles = await self.get_user_roles(user_id)
        return any(role in user_roles for role in required_roles)
    
    async def is_admin(self, user_id: UUID) -> bool:
        """Check if user is admin."""
        return await self.role_repository.has_role(user_id, RoleCode.ADMIN)
    
    async def is_manager(self, user_id: UUID) -> bool:
        """Check if user is manager."""
        return await self.role_repository.has_role(user_id, RoleCode.MANAGER)
    
    async def can_view_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can view specific employee."""
        # Admin can view all
        if await self.is_admin(user_id):
            return True
        
        # Manager can view their team
        if await self.is_manager(user_id):
            employee = await self.employee_repository.get_by_id(employee_id)
            if employee and employee.manager_id:
                # Find the employee record for this user to get their employee ID
                # This requires mapping user_id to employee_id (could be via separate service)
                user_employee = await self._get_employee_by_user_id(user_id)
                if user_employee and employee.manager_id == user_employee.id:
                    return True
        
        # Employee can view themselves
        user_employee = await self._get_employee_by_user_id(user_id)
        if user_employee and user_employee.id == employee_id:
            return True
        
        return False
    
    async def can_update_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can update specific employee."""
        # Admin can update all
        if await self.is_admin(user_id):
            return True
        
        # Manager can update their team (limited fields)
        if await self.is_manager(user_id):
            employee = await self.employee_repository.get_by_id(employee_id)
            if employee and employee.manager_id:
                user_employee = await self._get_employee_by_user_id(user_id)
                if user_employee and employee.manager_id == user_employee.id:
                    return True
        
        # Employees cannot update in MVP
        return False
    
    async def _get_employee_by_user_id(self, user_id: UUID) -> Optional[Employee]:
        """Helper to get employee record by user ID."""
        return await self.employee_repository.get_by_user_id(user_id)