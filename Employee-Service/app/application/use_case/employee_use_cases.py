from uuid import uuid4, UUID
from datetime import datetime, timezone
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
    DeactivateEmployeeRequest
)
from app.presentation.schema.employee_schema import (
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
        from app.core.entities.employee import VerificationStatus
        from datetime import timezone
        now = datetime.now(timezone.utc)
        
        employee = Employee(
            id=uuid4(),
            user_id=None,  # Will be set when linked to user account
            first_name=request.first_name.strip(),
            last_name=request.last_name.strip(),
            email=request.email.lower().strip(),
            phone=request.phone.strip() if request.phone else None,
            title=request.title.strip() if request.title else None,
            department=request.department.strip() if request.department else None,
            manager_id=request.manager_id,
            status=EmploymentStatus.ACTIVE,
            employment_status=EmploymentStatus.ACTIVE,
            verification_status=VerificationStatus.NOT_SUBMITTED,
            hired_at=now,
            deactivated_at=None,
            deactivation_reason=None,
            created_at=now,
            updated_at=now,
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
        
        current_employee.updated_at = datetime.now(timezone.utc)
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
        employee.updated_at = datetime.now(timezone.utc)
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
    
    async def get_employee_by_user_id(self, user_id: UUID, requester_user_id: UUID = None) -> Optional[EmployeeResponse]:
        """Get employee by user ID with optional permission check."""
        
        employee = await self.employee_repository.get_by_user_id(user_id)
        if not employee:
            return None
        
        # Check permissions (skip if requester is getting their own profile)
        if requester_user_id and requester_user_id != user_id:
            if not await self.rbac_service.can_view_employee(requester_user_id, employee.id):
                raise EmployeePermissionException("Insufficient permissions to view this employee")
        
        return self._to_response(employee)
    
    async def get_team_members(self, manager_user_id: UUID) -> List[EmployeeResponse]:
        """Get all team members for a manager or all employees for admin."""
        
        # Check if user is admin - admins can see all employees
        if await self.rbac_service.is_admin(manager_user_id):
            # Admin can see all active employees as their "team"
            all_employees = await self.employee_repository.list_employees(
                page=1,
                size=1000,  # Get all employees for admin
                status=None,
                department=None,
                manager_id=None,
                search=None,
                sort_by="first_name",
                sort_order="asc"
            )
            return [self._to_response(emp) for emp in all_employees.employees]
        
        # Check if user is actually a manager
        if not await self.rbac_service.is_manager(manager_user_id):
            raise EmployeePermissionException("User is not a manager or admin")
        
        # Get manager's employee record
        manager_employee = await self.rbac_service._get_employee_by_user_id(manager_user_id)
        if not manager_employee:
            raise EmployeeNotFoundException("Manager employee record not found")
        
        # Get team members
        team_members = await self.employee_repository.get_by_manager_id(manager_employee.id)
        
        return [self._to_response(emp) for emp in team_members]
    
    def _to_response(self, employee: Employee) -> EmployeeResponse:
        """Convert employee entity to response schema."""
        return EmployeeResponse(
            id=employee.id,
            user_id=employee.user_id,
            first_name=employee.first_name,
            last_name=employee.last_name,
            email=employee.email,
            phone=employee.phone,
            title=employee.title,
            department=employee.department,
            manager_id=employee.manager_id,
            status=employee.status,
            employment_status=employee.employment_status,
            verification_status=employee.verification_status,
            hired_at=employee.hired_at,
            deactivated_at=employee.deactivated_at,
            deactivation_reason=employee.deactivation_reason,
            created_at=employee.created_at,
            updated_at=employee.updated_at,
            version=employee.version,
            submitted_at=employee.submitted_at,
            final_approved_by=employee.final_approved_by,
            final_approved_at=employee.final_approved_at,
            rejection_reason=employee.rejection_reason,
            rejected_by=employee.rejected_by,
            rejected_at=employee.rejected_at
        )


