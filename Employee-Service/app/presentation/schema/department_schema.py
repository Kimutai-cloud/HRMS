from pydantic import BaseModel, Field, validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class CreateDepartmentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Department name")
    description: Optional[str] = Field(None, max_length=1000, description="Department description")
    
    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()
    
    @validator('description')
    def validate_description(cls, v):
        if v is not None:
            return v.strip() if v.strip() else None
        return v


class UpdateDepartmentRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Department name")
    description: Optional[str] = Field(None, max_length=1000, description="Department description")
    
    @validator('name')
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Name cannot be empty')
        return v.strip() if v else v
    
    @validator('description')
    def validate_description(cls, v):
        if v is not None:
            return v.strip() if v.strip() else None
        return v


class AssignManagerRequest(BaseModel):
    manager_id: UUID = Field(..., description="ID of the employee to assign as manager")


class DepartmentResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    manager_id: Optional[UUID]
    manager_name: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: UUID
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class DepartmentListResponse(BaseModel):
    departments: List[DepartmentResponse]
    total: int


class DepartmentWithStatsResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    manager_id: Optional[UUID]
    manager_name: Optional[str]
    is_active: bool
    employee_count: int
    has_manager: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class DepartmentStatsListResponse(BaseModel):
    departments: List[DepartmentWithStatsResponse]
    total: int


class DepartmentForDropdownResponse(BaseModel):
    """Simplified response for dropdown/select components."""
    id: UUID
    name: str
    is_active: bool