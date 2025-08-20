from fastapi import APIRouter, Depends
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime

from app.application.use_case.profile_use_cases import ProfileUseCase
from app.presentation.api.dependencies import require_profile_completion, require_newcomer_access
from app.core.entities.user_claims import UserClaims
from app.presentation.schema.guidance_schema import (
    UserGuidanceResponse,
    NextStepsResponse,
    ProfileProgressResponse,
    RequirementsResponse
)
from app.presentation.api.dependencies import (
    get_profile_use_case,
    get_employee_repository,
    get_enhanced_permission_service
)

router = APIRouter(prefix="/guidance", tags=["User Guidance"])


@router.get("/", response_model=UserGuidanceResponse)
async def get_user_guidance(
    user_claims: UserClaims = Depends(require_profile_completion),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case),
    permission_service = Depends(get_enhanced_permission_service)
):
    """Get comprehensive guidance for the current user."""
    
    try:
        # Try to get profile status
        profile_status = await profile_use_case.get_profile_verification_status(user_claims.user_id)
        
        # Get access summary
        access_summary = await permission_service.get_access_summary(user_claims)
        
        return UserGuidanceResponse(
            user_id=user_claims.user_id,
            current_status=user_claims.employee_profile_status,
            access_level=access_summary["access_level"],
            verification_progress=profile_status.progress_percentage,
            next_steps=profile_status.next_steps,
            required_actions=profile_status.required_actions,
            can_resubmit=profile_status.can_resubmit,
            permissions=access_summary["permissions"],
            guidance_message=_get_guidance_message(user_claims.employee_profile_status)
        )
        
    except Exception:
        # User hasn't submitted profile yet
        access_summary = await permission_service.get_access_summary(user_claims)
        
        return UserGuidanceResponse(
            user_id=user_claims.user_id,
            current_status=user_claims.employee_profile_status,
            access_level=access_summary["access_level"],
            verification_progress=0,
            next_steps=["Complete your employee profile to get started"],
            required_actions=["Submit your employee profile with all required information"],
            can_resubmit=True,
            permissions=access_summary["permissions"],
            guidance_message="Welcome! Please complete your employee profile to begin the verification process."
        )


@router.get("/next-steps", response_model=NextStepsResponse)
async def get_next_steps(
    user_claims: UserClaims = Depends(require_profile_completion),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case)
):
    """Get detailed next steps for the user."""
    
    try:
        profile_status = await profile_use_case.get_profile_verification_status(user_claims.user_id)
        
        # Generate detailed steps based on current status
        detailed_steps = _get_detailed_next_steps(
            profile_status.verification_status.value,
            profile_status.next_steps,
            profile_status.required_actions
        )
        
        return NextStepsResponse(
            current_stage=profile_status.current_stage,
            next_steps=detailed_steps,
            estimated_time=_get_estimated_completion_time(profile_status.verification_status.value),
            priority="high" if profile_status.can_resubmit else "normal"
        )
        
    except Exception:
        return NextStepsResponse(
            current_stage="Not Started",
            next_steps=[
                {
                    "title": "Complete Employee Profile",
                    "description": "Fill in your personal information, select department and manager",
                    "action_url": "/profile/submit",
                    "is_required": True
                }
            ],
            estimated_time="5-10 minutes",
            priority="high"
        )


@router.get("/progress", response_model=ProfileProgressResponse)
async def get_profile_progress(
    user_claims: UserClaims = Depends(require_newcomer_access),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case)
):
    """Get detailed progress information."""
    
    try:
        profile_status = await profile_use_case.get_profile_verification_status(user_claims.user_id)
        
        return ProfileProgressResponse(
            overall_progress=profile_status.progress_percentage,
            stages=[
                {
                    "name": "Details Review",
                    "completed": profile_status.details_review_completed,
                    "description": "Admin reviews your profile information"
                },
                {
                    "name": "Documents Review", 
                    "completed": profile_status.documents_review_completed,
                    "description": "Admin reviews your uploaded documents"
                },
                {
                    "name": "Role Assignment",
                    "completed": profile_status.role_assignment_completed,
                    "description": "System role and permissions assignment"
                },
                {
                    "name": "Final Approval",
                    "completed": profile_status.final_approval_completed,
                    "description": "Final verification and account activation"
                }
            ],
            current_stage=profile_status.current_stage,
            submitted_at=profile_status.submitted_at,
            estimated_completion=_calculate_estimated_completion(profile_status)
        )
        
    except Exception:
        return ProfileProgressResponse(
            overall_progress=0,
            stages=[
                {
                    "name": "Profile Submission",
                    "completed": False,
                    "description": "Complete and submit your employee profile"
                },
                {
                    "name": "Details Review",
                    "completed": False,
                    "description": "Admin reviews your profile information"
                },
                {
                    "name": "Documents Review",
                    "completed": False, 
                    "description": "Admin reviews your uploaded documents"
                },
                {
                    "name": "Role Assignment",
                    "completed": False,
                    "description": "System role and permissions assignment"
                },
                {
                    "name": "Final Approval",
                    "completed": False,
                    "description": "Final verification and account activation"
                }
            ],
            current_stage="Not Started",
            submitted_at=None,
            estimated_completion=None
        )


@router.get("/requirements", response_model=RequirementsResponse)
async def get_requirements(
    user_claims: UserClaims = Depends(require_profile_completion),
    profile_use_case: ProfileUseCase = Depends(get_profile_use_case)
):
    """Get requirements for profile completion."""
    
    # Get available departments and managers
    departments = await profile_use_case.get_departments()
    managers = await profile_use_case.get_managers()
    
    return RequirementsResponse(
        profile_fields=[
            {
                "field": "first_name",
                "required": True,
                "description": "Your first name"
            },
            {
                "field": "last_name", 
                "required": True,
                "description": "Your last name"
            },
            {
                "field": "phone",
                "required": False,
                "description": "Your contact phone number"
            },
            {
                "field": "title",
                "required": False,
                "description": "Your job title or position"
            },
            {
                "field": "department",
                "required": True,
                "description": "Your department"
            },
            {
                "field": "manager",
                "required": False,
                "description": "Your direct manager (if applicable)"
            }
        ],
        document_types=[
            {
                "type": "ID_CARD",
                "required": True,
                "description": "Government-issued ID card",
                "accepted_formats": ["PDF", "JPG", "PNG"]
            },
            {
                "type": "EDUCATION_CERTIFICATE",
                "required": False,
                "description": "Educational qualifications",
                "accepted_formats": ["PDF", "JPG", "PNG"]
            }
        ],
        departments=[{"name": dept.name, "description": dept.description} for dept in departments],
        managers=[{"id": str(mgr.id), "name": mgr.full_name, "department": mgr.department} for mgr in managers]
    )


# Helper functions

def _get_guidance_message(status: str) -> str:
    """Get appropriate guidance message for status."""
    
    messages = {
        "NOT_STARTED": "Welcome! Please complete your employee profile to get started.",
        "PENDING_VERIFICATION": "Your profile is being reviewed. You'll receive updates as it progresses.",
        "VERIFIED": "Congratulations! Your profile is verified and you have full access.",
        "REJECTED": "Your profile needs some updates. Please review the feedback and resubmit."
    }
    
    return messages.get(status, "Please check your profile status for next steps.")


def _get_detailed_next_steps(status: str, next_steps: List[str], required_actions: List[str]) -> List[Dict[str, Any]]:
    """Generate detailed next steps with actions."""
    
    steps = []
    
    for step in next_steps + required_actions:
        step_info = {
            "title": step,
            "description": step,
            "action_url": None,
            "is_required": step in required_actions
        }
        
        # Add action URLs based on step content
        if "complete" in step.lower() and "profile" in step.lower():
            step_info["action_url"] = "/profile/submit"
        elif "upload" in step.lower() and "document" in step.lower():
            step_info["action_url"] = "/profile/upload-document"
        elif "resubmit" in step.lower():
            step_info["action_url"] = "/profile/resubmit"
        
        steps.append(step_info)
    
    return steps


def _get_estimated_completion_time(status: str) -> str:
    """Get estimated time for completion."""
    
    times = {
        "NOT_SUBMITTED": "5-10 minutes",
        "PENDING_DETAILS_REVIEW": "1-2 business days",
        "PENDING_DOCUMENTS_REVIEW": "2-3 business days", 
        "PENDING_ROLE_ASSIGNMENT": "1 business day",
        "PENDING_FINAL_APPROVAL": "1 business day",
        "VERIFIED": "Complete",
        "REJECTED": "Depends on updates needed"
    }
    
    return times.get(status, "Unknown")


def _calculate_estimated_completion(profile_status) -> Optional[str]:
    """Calculate estimated completion date."""
    
    if profile_status.verification_status.value == "VERIFIED":
        return None
    
    if not profile_status.submitted_at:
        return None
    
    # Simple estimation: 5 business days from submission
    from datetime import timedelta
    estimated = profile_status.submitted_at + timedelta(days=5)
    return estimated.strftime("%Y-%m-%d")