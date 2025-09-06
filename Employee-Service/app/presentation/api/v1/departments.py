from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID

from app.application.use_case.department_use_cases import DepartmentUseCase
from app.presentation.schema.department_schema import (
    CreateDepartmentRequest,
    UpdateDepartmentRequest,
    AssignManagerRequest,
    DepartmentResponse,
    DepartmentListResponse,
    DepartmentStatsListResponse,
    DepartmentForDropdownResponse
)
from app.presentation.schema.employee_schema import EmployeeResponse
from app.presentation.schema.common_schema import SuccessResponse
from app.presentation.api.dependencies import (
    get_department_use_case,
    require_admin,
    get_request_context,
    allow_newcomer_access_with_cors,
    require_manager_or_admin
)
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeValidationException,
    EmployeePermissionException
)

router = APIRouter()

# Admin Department Management Endpoints
admin_router = APIRouter(prefix="/admin/departments", tags=["Admin - Departments"])

@admin_router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    request: CreateDepartmentRequest,
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_admin)
):
    """Create a new department (Admin only)."""
    try:
        department = await department_use_case.create_department(request, current_user["user_id"])
        return department
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

@admin_router.get("", response_model=DepartmentListResponse)
async def list_departments_admin(
    include_inactive: bool = Query(False, description="Include inactive departments"),
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_admin)
):
    """List all departments (Admin only)."""
    return await department_use_case.list_departments(include_inactive)

@admin_router.get("/stats", response_model=DepartmentStatsListResponse)
async def get_departments_with_stats(
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_admin)
):
    """Get departments with employee statistics (Admin only)."""
    return await department_use_case.list_departments_with_stats()

@admin_router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department_admin(
    department_id: UUID,
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_admin)
):
    """Get department by ID (Admin only)."""
    department = await department_use_case.get_department(department_id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    return department

@admin_router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: UUID,
    request: UpdateDepartmentRequest,
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_admin)
):
    """Update department details (Admin only)."""
    try:
        department = await department_use_case.update_department(
            department_id, request, current_user["user_id"]
        )
        return department
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

@admin_router.delete("/{department_id}", response_model=SuccessResponse)
async def delete_department(
    department_id: UUID,
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_admin)
):
    """Soft delete department (Admin only)."""
    try:
        success = await department_use_case.delete_department(
            department_id, current_user["user_id"]
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
        return SuccessResponse(
            success=True,
            message="Department deleted successfully"
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

@admin_router.post("/{department_id}/assign-manager", response_model=DepartmentResponse)
async def assign_department_manager(
    department_id: UUID,
    request: AssignManagerRequest,
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_admin)
):
    """Assign manager to department (Admin only)."""
    try:
        department = await department_use_case.assign_manager(
            department_id, request, current_user["user_id"]
        )
        return department
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

@admin_router.delete("/{department_id}/remove-manager", response_model=DepartmentResponse)
async def remove_department_manager(
    department_id: UUID,
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_admin)
):
    """Remove manager from department (Admin only)."""
    try:
        department = await department_use_case.remove_manager(
            department_id, current_user["user_id"]
        )
        return department
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

# Public Department Endpoints (for forms, dropdowns, etc.)
public_router = APIRouter(prefix="/departments", tags=["Departments - Public"])

@public_router.get("", response_model=List[DepartmentForDropdownResponse])
async def get_departments_for_dropdown(
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(allow_newcomer_access_with_cors)
):
    """Get active departments for dropdown/select components."""
    departments = await department_use_case.list_departments(include_inactive=False)
    
    return [
        DepartmentForDropdownResponse(
            id=dept.id,
            name=dept.name,
            is_active=dept.is_active
        )
        for dept in departments.departments
    ]

@public_router.get("/{department_id}", response_model=DepartmentResponse)
async def get_department_public(
    department_id: UUID,
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(allow_newcomer_access_with_cors)
):
    """Get department by ID (public endpoint)."""
    department = await department_use_case.get_department(department_id)
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    return department

# Manager Department Endpoints
manager_router = APIRouter(prefix="/manager/departments", tags=["Manager - Departments"])

@manager_router.get("/my-departments", response_model=DepartmentListResponse)
async def get_my_managed_departments(
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_manager_or_admin)  # Fixed: use proper auth dependency
):
    """Get departments managed by current user."""
    return await department_use_case.get_managed_departments(current_user["user_id"])

@manager_router.get("/{department_id}/employees")
async def get_department_employees(
    department_id: UUID,
    department_use_case: DepartmentUseCase = Depends(get_department_use_case),
    current_user = Depends(require_manager_or_admin)  # Fixed: use proper auth dependency
):
    """Get employees in a specific department (Manager access)."""
    # First verify the manager has access to this department
    managed_departments = await department_use_case.get_managed_departments(current_user["user_id"])
    
    department_ids = [dept.id for dept in managed_departments.departments]
    if department_id not in department_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not manage this department"
        )
    
    employees = await department_use_case.get_department_employees(department_id)
    
    # Convert to response format (reusing employee response schema)
    employee_responses = []
    for emp in employees:
        employee_responses.append(EmployeeResponse(
            id=emp.id,
            user_id=emp.user_id,
            first_name=emp.first_name,
            last_name=emp.last_name,
            email=emp.email,
            phone=emp.phone,
            title=emp.title,
            department=emp.department,
            manager_id=emp.manager_id,
            status=emp.employment_status,
            employment_status=emp.employment_status,
            verification_status=emp.verification_status,
            hired_at=emp.hired_at,
            deactivated_at=emp.deactivated_at,
            deactivation_reason=emp.deactivation_reason,
            created_at=emp.created_at,
            updated_at=emp.updated_at,
            version=emp.version
        ))
    
    return {"employees": employee_responses, "total": len(employee_responses)}

# Include all routers
router.include_router(admin_router)
router.include_router(public_router)
router.include_router(manager_router)