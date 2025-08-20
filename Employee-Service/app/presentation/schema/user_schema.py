from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID

from app.core.entities.employee import VerificationStatus


class UserAccessSummaryResponse(BaseModel):
    """Enhanced user access summary."""
    
    user_id: UUID
    email: str
    access_level: str = Field(..., description="User's access level")
    verification_status: str = Field(..., description="Employee profile verification status")
    roles: List[str] = Field(..., description="Assigned roles")
    permissions: List[str] = Field(..., description="Available permissions")
    can_access_system: bool = Field(..., description="Whether user has system access")
    needs_profile_completion: bool = Field(..., description="Whether profile completion is needed")
    is_newcomer: bool = Field(..., description="Whether user is in newcomer status")
    is_admin: bool = Field(..., description="Whether user has admin access")


class ProfileStatusDetailResponse(BaseModel):
    """Detailed profile status information."""
    
    employee_id: Optional[UUID] = None
    user_id: UUID
    verification_status: str
    status_description: str
    current_stage: str
    progress_percentage: int
    submitted_at: Optional[datetime] = None
    next_steps: List[str]
    required_actions: List[str]
    can_resubmit: bool
    rejection_reason: Optional[str] = None
    rejected_at: Optional[datetime] = None
    
    details_review_completed: bool = False
    documents_review_completed: bool = False
    role_assignment_completed: bool = False
    final_approval_completed: bool = False

class UserDashboardResponse(BaseModel):
    """Enhanced user dashboard data."""
    
    user_info: UserAccessSummaryResponse
    profile_status: ProfileStatusDetailResponse
    notifications_summary: Dict[str, Any]
    quick_actions: List[Dict[str, str]]
    recent_activity: List[Dict[str, Any]]