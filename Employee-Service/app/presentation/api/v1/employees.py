from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from typing import Optional, List
from uuid import UUID

from app.application.use_case.employee_use_cases import EmployeeUseCase
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.presentation.schema.employee_schema import (
    CreateEmployeeRequest,
    UpdateEmployeeRequest,
    DeactivateEmployeeRequest,
    EmployeeResponse,
    EmployeeListResponse
)
from app.presentation.schema.common_schema import SuccessResponse, ErrorResponse
from app.presentation.api.dependencies import (
    get_employee_use_case,
    get_audit_repository,
    get_current_user,
    require_admin,
    require_manager_or_admin,
    get_request_context
)
from app.core.entities.employee import EmploymentStatus
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeAlreadyExistsException,
    EmployeeValidationException,
    EmployeePermissionException
)

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    request: CreateEmployeeRequest,
    current_user: dict = Depends(require_admin),  # Only admins can create employees
    employee_use_case: EmployeeUseCase = Depends(get_employee_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """Create a new employee. Admin only."""
    
    try:
        # Convert request to DTO
        from app.application.dto.employee_dto import CreateEmployeeRequest as CreateEmployeeDTO
        dto = CreateEmployeeDTO(
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            phone=request.phone,
            title=request.title,
            department=request.department,
            manager_id=request.manager_id
        )
        
        # Create employee
        employee = await employee_use_case.create_employee(dto, current_user["user_id"])
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee",
            entity_id=employee.id,
            action="CREATE",
            user_id=current_user["user_id"],
            changes={
                "first_name": employee.first_name,
                "last_name": employee.last_name,
                "email": employee.email,
                "title": employee.title,
                "department": employee.department
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return employee
        
    except EmployeeAlreadyExistsException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except EmployeePermissionException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/", response_model=EmployeeListResponse)
async def list_employees(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    status: Optional[EmploymentStatus] = Query(None, description="Filter by employment status"),
    department: Optional[str] = Query(None, description="Filter by department"),
    manager_id: Optional[UUID] = Query(None, description="Filter by manager ID"),
    search: Optional[str] = Query(None, description="Search in name, email, title"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$", description="Sort order"),
    current_user: dict = Depends(get_current_user),
    employee_use_case: EmployeeUseCase = Depends(get_employee_use_case)
):
    """List employees with filtering and pagination. Access controlled by role."""
    
    try:
        employees = await employee_use_case.list_employees(
            requester_user_id=current_user["user_id"],
            page=page,
            size=size,
            status=status,
            department=department,
            manager_id=manager_id,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return employees
        
    except EmployeePermissionException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: UUID,
    current_user: dict = Depends(get_current_user),
    employee_use_case: EmployeeUseCase = Depends(get_employee_use_case)
):
    """Get employee by ID. Access controlled by role and relationship."""
    
    try:
        employee = await employee_use_case.get_employee(
            employee_id=employee_id,
            requester_user_id=current_user["user_id"]
        )
        
        return employee
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EmployeePermissionException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: UUID,
    request: UpdateEmployeeRequest,
    version: Optional[int] = Header(None, alias="If-Match"),
    current_user: dict = Depends(require_manager_or_admin),
    employee_use_case: EmployeeUseCase = Depends(get_employee_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """Update employee. Managers can update their team, Admins can update all."""
    
    try:
        # Convert request to DTO
        from app.application.dto.employee_dto import UpdateEmployeeRequest as UpdateEmployeeDTO
        dto = UpdateEmployeeDTO(
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            phone=request.phone,
            title=request.title,
            department=request.department,
            manager_id=request.manager_id
        )
        
        # Get original employee for audit
        original_employee = await employee_use_case.get_employee(
            employee_id=employee_id,
            requester_user_id=current_user["user_id"]
        )
        
        # Update employee
        updated_employee = await employee_use_case.update_employee(
            employee_id=employee_id,
            request=dto,
            updater_user_id=current_user["user_id"],
            version=version
        )
        
        # Audit log changes
        changes = {}
        if request.first_name and request.first_name != original_employee.first_name:
            changes["first_name"] = {"from": original_employee.first_name, "to": request.first_name}
        if request.last_name and request.last_name != original_employee.last_name:
            changes["last_name"] = {"from": original_employee.last_name, "to": request.last_name}
        if request.email and request.email != original_employee.email:
            changes["email"] = {"from": original_employee.email, "to": request.email}
        if request.title and request.title != original_employee.title:
            changes["title"] = {"from": original_employee.title, "to": request.title}
        if request.department and request.department != original_employee.department:
            changes["department"] = {"from": original_employee.department, "to": request.department}
        if request.manager_id and request.manager_id != original_employee.manager_id:
            changes["manager_id"] = {"from": str(original_employee.manager_id) if original_employee.manager_id else None, "to": str(request.manager_id)}
        
        if changes:
            await audit_repository.log_action(
                entity_type="employee",
                entity_id=employee_id,
                action="UPDATE",
                user_id=current_user["user_id"],
                changes=changes,
                ip_address=request_context.get("ip_address"),
                user_agent=request_context.get("user_agent")
            )
        
        return updated_employee
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except EmployeePermissionException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/{employee_id}:deactivate", response_model=EmployeeResponse)
async def deactivate_employee(
    employee_id: UUID,
    request: DeactivateEmployeeRequest,
    current_user: dict = Depends(require_admin),  # Only admins can deactivate
    employee_use_case: EmployeeUseCase = Depends(get_employee_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """Deactivate employee (soft delete). Admin only."""
    
    try:
        # Convert request to DTO
        from app.application.dto.employee_dto import DeactivateEmployeeRequest as DeactivateEmployeeDTO
        dto = DeactivateEmployeeDTO(reason=request.reason)
        
        # Deactivate employee
        deactivated_employee = await employee_use_case.deactivate_employee(
            employee_id=employee_id,
            request=dto,
            deactivator_user_id=current_user["user_id"]
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="employee",
            entity_id=employee_id,
            action="DEACTIVATE",
            user_id=current_user["user_id"],
            changes={"reason": request.reason},
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return deactivated_employee
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except EmployeePermissionException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/me/team", response_model=List[EmployeeResponse])
async def get_my_team(
    current_user: dict = Depends(require_manager_or_admin),
    employee_use_case: EmployeeUseCase = Depends(get_employee_use_case)
):
    """Get team members for the current manager."""
    
    try:
        team_members = await employee_use_case.get_team_members(current_user["user_id"])
        return team_members
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except EmployeePermissionException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )