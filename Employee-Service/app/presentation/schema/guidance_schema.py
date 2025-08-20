from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID


class UserGuidanceResponse(BaseModel):
    """Comprehensive user guidance response."""
    
    user_id: UUID
    current_status: str = Field(..., description="Current employee profile status")
    access_level: str = Field(..., description="User's access level")
    verification_progress: int = Field(..., description="Verification progress percentage")
    next_steps: List[str] = Field(..., description="Next steps for the user")
    required_actions: List[str] = Field(..., description="Required actions to progress")
    can_resubmit: bool = Field(..., description="Whether user can resubmit profile")
    permissions: List[str] = Field(..., description="User's current permissions")
    guidance_message: str = Field(..., description="Personalized guidance message")


class NextStepItem(BaseModel):
    """Individual next step item."""
    
    title: str = Field(..., description="Step title")
    description: str = Field(..., description="Step description")
    action_url: Optional[str] = Field(None, description="URL to perform this action")
    is_required: bool = Field(..., description="Whether this step is required")


class NextStepsResponse(BaseModel):
    """Detailed next steps response."""
    
    current_stage: str = Field(..., description="Current verification stage")
    next_steps: List[NextStepItem] = Field(..., description="Detailed next steps")
    estimated_time: str = Field(..., description="Estimated time to complete")
    priority: str = Field(..., description="Priority level (low, normal, high, urgent)")


class ProgressStage(BaseModel):
    """Individual progress stage."""
    
    name: str = Field(..., description="Stage name")
    completed: bool = Field(..., description="Whether stage is completed")
    description: str = Field(..., description="Stage description")


class ProfileProgressResponse(BaseModel):
    """Profile progress tracking response."""
    
    overall_progress: int = Field(..., description="Overall progress percentage")
    stages: List[ProgressStage] = Field(..., description="Individual stage progress")
    current_stage: str = Field(..., description="Current active stage")
    submitted_at: Optional[datetime] = Field(None, description="When profile was submitted")
    estimated_completion: Optional[str] = Field(None, description="Estimated completion date")


class RequirementField(BaseModel):
    """Profile field requirement."""
    
    field: str = Field(..., description="Field name")
    required: bool = Field(..., description="Whether field is required")
    description: str = Field(..., description="Field description")


class DocumentRequirement(BaseModel):
    """Document requirement."""
    
    type: str = Field(..., description="Document type")
    required: bool = Field(..., description="Whether document is required")
    description: str = Field(..., description="Document description")
    accepted_formats: List[str] = Field(..., description="Accepted file formats")


class DepartmentOption(BaseModel):
    """Department option."""
    
    name: str = Field(..., description="Department name")
    description: str = Field(..., description="Department description")


class ManagerOption(BaseModel):
    """Manager option."""
    
    id: str = Field(..., description="Manager ID")
    name: str = Field(..., description="Manager name")
    department: str = Field(..., description="Manager's department")


class RequirementsResponse(BaseModel):
    """Profile requirements response."""
    
    profile_fields: List[RequirementField] = Field(..., description="Required profile fields")
    document_types: List[DocumentRequirement] = Field(..., description="Document requirements")
    departments: List[DepartmentOption] = Field(..., description="Available departments")
    managers: List[ManagerOption] = Field(..., description="Available managers")