from typing import List, Optional
from uuid import UUID

from app.core.entities.role import RoleCode
from app.core.interfaces.services import PermissionServiceInterface
from app.core.interfaces.repositories import RoleRepositoryInterface, EmployeeRepositoryInterface


class PermissionService(PermissionServiceInterface):
    """Implementation of permission checking service."""
    
    def __init__(
        self,
        role_repository: RoleRepositoryInterface,
        employee_repository: EmployeeRepositoryInterface
    ):
        self.role_repository = role_repository
        self.employee_repository = employee_repository
    
    async def can_create_employee(self, user_id: UUID) -> bool:
        """Check if user can create employees."""
        return await self.role_repository.has_role(user_id, RoleCode.ADMIN)
    
    async def can_view_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can view specific employee."""
        # Admin can view all
        if await self.role_repository.has_role(user_id, RoleCode.ADMIN):
            return True
        
        # Manager can view their team
        if await self.role_repository.has_role(user_id, RoleCode.MANAGER):
            employee = await self.employee_repository.get_by_id(employee_id)
            if employee and employee.manager_id:
                # Get the user's employee record to compare with manager_id
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
        if await self.role_repository.has_role(user_id, RoleCode.ADMIN):
            return True
        
        # Manager can update their team (limited fields)
        if await self.role_repository.has_role(user_id, RoleCode.MANAGER):
            employee = await self.employee_repository.get_by_id(employee_id)
            if employee and employee.manager_id:
                user_employee = await self._get_employee_by_user_id(user_id)
                if user_employee and employee.manager_id == user_employee.id:
                    return True
        
        # Employees cannot update in MVP
        return False
    
    async def can_deactivate_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can deactivate specific employee."""
        # Only admins can deactivate employees
        return await self.role_repository.has_role(user_id, RoleCode.ADMIN)
    
    async def can_assign_roles(self, user_id: UUID) -> bool:
        """Check if user can assign roles."""
        return await self.role_repository.has_role(user_id, RoleCode.ADMIN)
    
    async def get_viewable_employees(self, user_id: UUID) -> List[UUID]:
        """Get list of employee IDs that user can view."""
        viewable_ids = []
        
        # Admin can view all
        if await self.role_repository.has_role(user_id, RoleCode.ADMIN):
            # This would need pagination in real implementation
            # For now, return empty list to indicate "all"
            return []
        
        # Manager can view their team
        if await self.role_repository.has_role(user_id, RoleCode.MANAGER):
            user_employee = await self._get_employee_by_user_id(user_id)
            if user_employee:
                team_members = await self.employee_repository.get_by_manager_id(user_employee.id)
                viewable_ids.extend([emp.id for emp in team_members])
        
        # Employee can view themselves
        user_employee = await self._get_employee_by_user_id(user_id)
        if user_employee:
            viewable_ids.append(user_employee.id)
        
        return list(set(viewable_ids))  # Remove duplicates
    
    async def _get_employee_by_user_id(self, user_id: UUID) -> Optional[any]:
        """Get employee record by user ID."""
        # This is a simplified implementation
        # In real implementation, you'd need a mapping between user_id and employee
        # Options:
        # 1. Add user_id field to Employee model
        # 2. Map by email (get user email from auth service, find employee by email)
        # 3. Separate user-employee mapping table
        
        # For now, returning None - implement based on your auth integration strategy
        # You might want to call the Auth Service to get user email, then find employee by email
        return None