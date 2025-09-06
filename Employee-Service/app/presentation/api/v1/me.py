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
        # Try to get employee record by email - but bypass permission check for /me/ endpoint
        # Users should always be able to see their own profile data
        
        # Get employee directly from repository to bypass permission checks
        from app.infrastructure.database.repositories.employee_repository import EmployeeRepository
        from app.presentation.api.dependencies import get_db_session
        
        employee = None
        async for session in get_db_session():
            employee_repo = EmployeeRepository(session)
            
            # First try by user_id (more reliable)
            employee_entity = await employee_repo.get_by_user_id(current_user["user_id"])
            
            # If not found by user_id, try by email  
            if not employee_entity:
                employee_entity = await employee_repo.get_by_email(current_user["email"])
            
            # Convert to response format if found
            if employee_entity:
                # Use a simple conversion without full use case
                employee = {
                    "id": str(employee_entity.id),
                    "user_id": str(employee_entity.user_id),
                    "first_name": employee_entity.first_name,
                    "last_name": employee_entity.last_name,
                    "email": employee_entity.email,
                    "phone": employee_entity.phone,
                    "title": employee_entity.title,
                    "department": employee_entity.department,
                    "verification_status": employee_entity.verification_status.value,
                    "employment_status": employee_entity.employment_status.value,
                    "created_at": employee_entity.created_at.isoformat() if employee_entity.created_at else None,
                    "submitted_at": employee_entity.submitted_at.isoformat() if employee_entity.submitted_at else None,
                }
            break
        
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
        try:
            roles = await role_use_case.get_user_roles(
                user_id=current_user["user_id"],
                requester_user_id=current_user["user_id"]
            )
        except Exception as role_error:
            print(f"⚠️ Failed to get user roles: {role_error}")
            # Return with empty roles if role lookup fails
            roles = []
        
        return {
            "user_id": current_user["user_id"],
            "email": current_user["email"],
            "employee": None,
            "roles": roles
        }
    
    except Exception as e:
        print(f"❌ Unexpected error in /me/ endpoint: {e}")
        import traceback
        traceback.print_exc()
        
        # Return basic user info even if database queries fail
        return {
            "user_id": current_user["user_id"],
            "email": current_user["email"],
            "employee": None,
            "roles": []
        }