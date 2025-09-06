from uuid import uuid4, UUID
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from app.core.entities.department import Department
from app.core.entities.employee import Employee, EmploymentStatus
from app.core.entities.role import RoleCode
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeValidationException,
    EmployeePermissionException
)
from app.core.interfaces.repositories import (
    DepartmentRepositoryInterface, 
    EmployeeRepositoryInterface,
    RoleRepositoryInterface,
    EventRepositoryInterface
)
from app.application.dto.department_dto import (
    CreateDepartmentRequest,
    UpdateDepartmentRequest,
    AssignManagerRequest,
    DepartmentResponse,
    DepartmentListResponse,
    DepartmentWithStatsResponse,
    DepartmentStatsListResponse
)


class DepartmentUseCase:
    """Department management use cases."""
    
    def __init__(
        self,
        department_repository: DepartmentRepositoryInterface,
        employee_repository: EmployeeRepositoryInterface,
        role_repository: RoleRepositoryInterface,
        event_repository: EventRepositoryInterface
    ):
        self.department_repository = department_repository
        self.employee_repository = employee_repository
        self.role_repository = role_repository
        self.event_repository = event_repository
    
    async def create_department(self, request: CreateDepartmentRequest, creator_user_id: UUID) -> DepartmentResponse:
        """Create a new department."""
        
        # Validate creator has admin permissions
        if not await self._has_admin_permissions(creator_user_id):
            raise EmployeePermissionException("Only administrators can create departments")
        
        # Check name uniqueness
        existing = await self.department_repository.get_by_name(request.name)
        if existing:
            raise EmployeeValidationException(f"Department with name '{request.name}' already exists")
        
        now = datetime.now(timezone.utc)
        
        # Create department entity
        department = Department(
            id=uuid4(),
            name=request.name.strip(),
            description=request.description.strip() if request.description else None,
            manager_id=None,  # Initially no manager assigned
            is_active=True,
            created_at=now,
            updated_at=now,
            created_by=creator_user_id
        )
        
        # Save department
        created_department = await self.department_repository.create(department)
        
        return self._to_response(created_department)
    
    async def get_department(self, department_id: UUID) -> Optional[DepartmentResponse]:
        """Get department by ID."""
        department = await self.department_repository.get_by_id(department_id)
        if not department:
            return None
        
        return await self._to_response_with_manager_name(department)
    
    async def list_departments(self, include_inactive: bool = False) -> DepartmentListResponse:
        """List all departments."""
        departments = await self.department_repository.list_departments(include_inactive)
        
        # Get manager names for all departments
        department_responses = []
        for dept in departments:
            response = await self._to_response_with_manager_name(dept)
            department_responses.append(response)
        
        return DepartmentListResponse(
            departments=department_responses,
            total=len(department_responses)
        )
    
    async def list_departments_with_stats(self) -> DepartmentStatsListResponse:
        """List departments with employee statistics."""
        departments_with_stats = await self.department_repository.get_departments_with_stats()
        
        responses = []
        for stats in departments_with_stats:
            dept = stats['department']
            manager_name = None
            if dept.manager_id:
                manager = await self.employee_repository.get_by_id(dept.manager_id)
                if manager:
                    manager_name = manager.get_full_name()
            
            response = DepartmentWithStatsResponse(
                id=dept.id,
                name=dept.name,
                description=dept.description,
                manager_id=dept.manager_id,
                manager_name=manager_name,
                is_active=dept.is_active,
                employee_count=stats['employee_count'],
                has_manager=stats['has_manager'],
                created_at=dept.created_at,
                updated_at=dept.updated_at
            )
            responses.append(response)
        
        return DepartmentStatsListResponse(
            departments=responses,
            total=len(responses)
        )
    
    async def update_department(
        self, 
        department_id: UUID, 
        request: UpdateDepartmentRequest, 
        updater_user_id: UUID
    ) -> DepartmentResponse:
        """Update department details."""
        
        # Validate updater has admin permissions
        if not await self._has_admin_permissions(updater_user_id):
            raise EmployeePermissionException("Only administrators can update departments")
        
        # Get existing department
        department = await self.department_repository.get_by_id(department_id)
        if not department:
            raise EmployeeNotFoundException("Department not found")
        
        # Validate name uniqueness if changing
        if request.name and request.name != department.name:
            existing = await self.department_repository.get_by_name(request.name)
            if existing:
                raise EmployeeValidationException(f"Department with name '{request.name}' already exists")
        
        # Update department
        department.update_details(
            name=request.name,
            description=request.description
        )
        
        updated_department = await self.department_repository.update(department)
        
        return await self._to_response_with_manager_name(updated_department)
    
    async def delete_department(self, department_id: UUID, deleter_user_id: UUID) -> bool:
        """Soft delete department."""
        
        # Validate deleter has admin permissions
        if not await self._has_admin_permissions(deleter_user_id):
            raise EmployeePermissionException("Only administrators can delete departments")
        
        # Check if department has active employees
        employees = await self.department_repository.get_department_employees(department_id)
        if employees:
            raise EmployeeValidationException(
                f"Cannot delete department with {len(employees)} active employees. "
                "Please reassign employees first."
            )
        
        return await self.department_repository.delete(department_id)
    
    async def assign_manager(
        self, 
        department_id: UUID, 
        request: AssignManagerRequest, 
        assigner_user_id: UUID
    ) -> DepartmentResponse:
        """Assign manager to department."""
        
        # Validate assigner has admin permissions
        if not await self._has_admin_permissions(assigner_user_id):
            raise EmployeePermissionException("Only administrators can assign department managers")
        
        # Get department
        department = await self.department_repository.get_by_id(department_id)
        if not department:
            raise EmployeeNotFoundException("Department not found")
        
        # Validate manager exists and has MANAGER role
        manager = await self.employee_repository.get_by_id(request.manager_id)
        if not manager:
            raise EmployeeNotFoundException("Manager not found")
        
        if not manager.is_active():
            raise EmployeeValidationException("Cannot assign inactive employee as manager")
        
        # Check if employee has MANAGER role
        if not await self.role_repository.has_role(manager.user_id, RoleCode.MANAGER):
            raise EmployeeValidationException("Employee must have MANAGER role to be assigned as department manager")
        
        # Assign manager
        department.assign_manager(request.manager_id)
        
        # Update in repository
        await self.department_repository.assign_manager(department_id, request.manager_id)
        
        # Return updated department
        updated_department = await self.department_repository.get_by_id(department_id)
        return await self._to_response_with_manager_name(updated_department)
    
    async def remove_manager(self, department_id: UUID, remover_user_id: UUID) -> DepartmentResponse:
        """Remove manager from department."""
        
        # Validate remover has admin permissions
        if not await self._has_admin_permissions(remover_user_id):
            raise EmployeePermissionException("Only administrators can remove department managers")
        
        # Get department
        department = await self.department_repository.get_by_id(department_id)
        if not department:
            raise EmployeeNotFoundException("Department not found")
        
        if not department.is_managed():
            raise EmployeeValidationException("Department does not have a manager assigned")
        
        # Remove manager
        await self.department_repository.remove_manager(department_id)
        
        # Return updated department
        updated_department = await self.department_repository.get_by_id(department_id)
        return await self._to_response_with_manager_name(updated_department)
    
    async def get_managed_departments(self, manager_user_id: UUID) -> DepartmentListResponse:
        """Get departments managed by a specific manager."""
        
        # Get manager's employee record
        manager_employee = await self.employee_repository.get_by_user_id(manager_user_id)
        if not manager_employee:
            return DepartmentListResponse(departments=[], total=0)
        
        departments = await self.department_repository.get_managed_departments(manager_employee.id)
        
        # Convert to responses with manager names
        department_responses = []
        for dept in departments:
            response = await self._to_response_with_manager_name(dept)
            department_responses.append(response)
        
        return DepartmentListResponse(
            departments=department_responses,
            total=len(department_responses)
        )
    
    async def get_department_employees(self, department_id: UUID) -> List[Employee]:
        """Get all employees in a department."""
        return await self.department_repository.get_department_employees(department_id)
    
    async def _has_admin_permissions(self, user_id: UUID) -> bool:
        """Check if user has admin permissions."""
        try:
            return await self.role_repository.has_role(user_id, RoleCode.ADMIN)
        except:
            return False
    
    def _to_response(self, department: Department) -> DepartmentResponse:
        """Convert department entity to response DTO."""
        return DepartmentResponse(
            id=department.id,
            name=department.name,
            description=department.description,
            manager_id=department.manager_id,
            manager_name=None,  # Will be populated separately
            is_active=department.is_active,
            created_at=department.created_at,
            updated_at=department.updated_at,
            created_by=department.created_by
        )
    
    async def _to_response_with_manager_name(self, department: Department) -> DepartmentResponse:
        """Convert department entity to response DTO with manager name."""
        response = self._to_response(department)
        
        # Get manager name if manager is assigned
        if department.manager_id:
            manager = await self.employee_repository.get_by_id(department.manager_id)
            if manager:
                response.manager_name = manager.get_full_name()
        
        return response