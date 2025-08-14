
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from app.core.entities.user import EmployeeProfileStatus


class UpdateProfileStatusRequest(BaseModel):
    employee_profile_status: EmployeeProfileStatus = Field(
        ..., 
        description="New employee profile status"
    )
    


class UpdateProfileStatusResponse(BaseModel):
    success: bool
    message: str
    user_id: UUID
    previous_status: EmployeeProfileStatus
    new_status: EmployeeProfileStatus
    



class InternalServiceAuthRequest(BaseModel):
    service_name: str = Field(..., description="Name of the calling service")
    service_token: str = Field(..., description="Internal service authentication token")


class UserProfileStatusResponse(BaseModel):
    user_id: UUID
    email: str
    employee_profile_status: EmployeeProfileStatus
    updated_at: str
    
