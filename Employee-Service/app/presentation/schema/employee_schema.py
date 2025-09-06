from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.core.entities.employee import EmploymentStatus, VerificationStatus


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
    user_id: Optional[UUID] = None
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    title: Optional[str]
    department: Optional[str]
    manager_id: Optional[UUID]
    status: EmploymentStatus
    employment_status: EmploymentStatus
    verification_status: VerificationStatus
    hired_at: Optional[datetime]
    deactivated_at: Optional[datetime]
    deactivation_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    version: int
    
    # Verification fields
    submitted_at: Optional[datetime] = None
    final_approved_by: Optional[UUID] = None
    final_approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    rejected_by: Optional[UUID] = None
    rejected_at: Optional[datetime] = None
    
    


class EmployeeListResponse(BaseModel):
    employees: List[EmployeeResponse]
    total: int
    page: int
    size: int
    pages: int
    
    