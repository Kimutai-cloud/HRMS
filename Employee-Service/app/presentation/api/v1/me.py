from fastapi import APIRouter, Depends, HTTPException, status

from app.application.use_case.employee_use_cases import EmployeeUseCase
from app.application.use_case.role_use_cases import RoleUseCase
from app.presentation.schema.employee_schema import EmployeeResponse
from app.presentation.schema.role_schema import RoleAssignmentResponse
from app.presentation.api.dependencies import (
    get_employee_use_case,
    get_role_use_case,
    get_current_user
)
from app.core.exceptions.employee_exceptions import EmployeeNotFoundException, EmployeePermissionException
from typing import List, Dict, Any

router = APIRouter(prefix="/me", tags=["Current User"])


@router.get("/", response_model=Dict[str, Any])
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
    employee_use_case: EmployeeUseCase = Depends(get_employee_use_case),
    role_use_case: RoleUseCase = Depends(get_role_use_case)
):
    """Get current user's profile including employee data and roles."""
    
    try:
        # Try to get employee record by email
        employee = await employee_use_case.get_employee_by_email(
            email=current_user["email"],
            requester_user_id=current_user["user_id"]
        )
        
        # Get user roles
        roles = await role_use_case.get_user_roles(
            user_id=current_user["user_id"],
            requester_user_id=current_user["user_id"]
        )
        
        return {
            "user_id": current_user["user_id"],
            "email": current_user["email"],
            "employee": employee,
            "roles": roles
        }
        
    except (EmployeeNotFoundException, EmployeePermissionException):
        # User exists in auth but not as employee
        roles = await role_use_case.get_user_roles(
            user_id=current_user["user_id"],
            requester_user_id=current_user["user_id"]
        )
        
        return {
            "user_id": current_user["user_id"],
            "email": current_user["email"],
            "employee": None,
            "roles": roles
        }