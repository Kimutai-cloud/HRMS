from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.core.entities.employee import EmploymentStatus


class CreateEmployeeRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=255, description="Employee's first name")
    last_name: str = Field(..., min_length=1, max_length=255, description="Employee's last name")
    email: EmailStr = Field(..., description="Employee's email address")
    phone: Optional[str] = Field(None, max_length=50, description="Employee's phone number")
    title: Optional[str] = Field(None, max_length=255, description="Employee's job title")
    department: Optional[str] = Field(None, max_length=255, description="Employee's department")
    manager_id: Optional[UUID] = Field(None, description="UUID of the employee's manager")
    
    @validator('first_name', 'last_name')
    def validate_names(cls, v):
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()
    
    @validator('email')
    def validate_email(cls, v):
        return v.lower().strip()
    
    class Config:
        schema_extra = {
            "example": {
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@example.com",
                "phone": "+1-555-0123",
                "title": "Software Engineer",
                "department": "Engineering",
                "manager_id": "123e4567-e89b-12d3-a456-426614174000"
            }
        }


class UpdateEmployeeRequest(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=255)
    last_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = Field(None)
    phone: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    manager_id: Optional[UUID] = Field(None)
    
    @validator('first_name', 'last_name')
    def validate_names(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Name cannot be empty')
        return v.strip() if v else v
    
    @validator('email')
    def validate_email(cls, v):
        return v.lower().strip() if v else v


class DeactivateEmployeeRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000, description="Reason for deactivation")


class EmployeeResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    title: Optional[str]
    department: Optional[str]
    manager_id: Optional[UUID]
    status: EmploymentStatus
    hired_at: Optional[datetime]
    deactivated_at: Optional[datetime]
    deactivation_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    version: int
    
    class Config:
        from_attributes = True
        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@example.com",
                "phone": "+1-555-0123",
                "title": "Software Engineer",
                "department": "Engineering",
                "manager_id": "456e7890-e89b-12d3-a456-426614174001",
                "status": "ACTIVE",
                "hired_at": "2024-01-15T09:00:00Z",
                "deactivated_at": None,
                "deactivation_reason": None,
                "created_at": "2024-01-15T09:00:00Z",
                "updated_at": "2024-01-15T09:00:00Z",
                "version": 1
            }
        }


class EmployeeListResponse(BaseModel):
    employees: List[EmployeeResponse]
    total: int
    page: int
    size: int
    pages: int
    
    class Config:
        schema_extra = {
            "example": {
                "employees": [
                    {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "first_name": "John",
                        "last_name": "Doe",
                        "email": "john.doe@example.com",
                        "status": "ACTIVE",
                        "title": "Software Engineer",
                        "department": "Engineering"
                    }
                ],
                "total": 1,
                "page": 1,
                "size": 20,
                "pages": 1
            }
        }