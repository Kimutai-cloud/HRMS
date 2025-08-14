from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

class AssignRoleRequest(BaseModel):
    user_id: UUID = Field(..., description="UUID of the user to assign role to")
    role_code: str = Field(..., description="Role code (ADMIN, MANAGER, EMPLOYEE)")
    scope: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Role scope for future use")
    
    @validator('role_code')
    def validate_role_code(cls, v):
        valid_codes = ['ADMIN', 'MANAGER', 'EMPLOYEE']
        if v not in valid_codes:
            raise ValueError(f'Role code must be one of: {valid_codes}')
        return v
    
    class Config:
        schema_extra = {
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "role_code": "MANAGER",
                "scope": {}
            }
        }


class RoleAssignmentResponse(BaseModel):
    id: UUID
    user_id: UUID
    role_code: str
    scope: Dict[str, Any]
    created_at: datetime
    
    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str]
    
    class Config:
        from_attributes = True
