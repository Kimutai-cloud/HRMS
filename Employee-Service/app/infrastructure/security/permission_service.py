
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import HTTPException, status
from enum import Enum

from app.core.entities.role import RoleCode
from app.core.interfaces.services import PermissionServiceInterface
from app.core.interfaces.repositories import RoleRepositoryInterface, EmployeeRepositoryInterface
from app.core.entities.user_claims import UserClaims
from app.core.entities.employee import VerificationStatus
from app.core.interfaces.repositories import RoleRepositoryInterface, EmployeeRepositoryInterface
from app.core.entities.role import RoleCode

class AccessLevel(str, Enum):
    """Access levels based on verification status."""
    NONE = "NONE"
    PROFILE_COMPLETION = "PROFILE_COMPLETION"
    NEWCOMER = "NEWCOMER"
    VERIFIED = "VERIFIED"
    ADMIN = "ADMIN"
class PermissionType(str, Enum):
    """Types of permissions in the system."""
    # Profile permissions
    VIEW_OWN_PROFILE = "view_own_profile"
    UPDATE_OWN_PROFILE = "update_own_profile"
    SUBMIT_PROFILE = "submit_profile"
    RESUBMIT_PROFILE = "resubmit_profile"
    
    # Document permissions
    UPLOAD_DOCUMENTS = "upload_documents"
    VIEW_OWN_DOCUMENTS = "view_own_documents"
    DELETE_OWN_DOCUMENTS = "delete_own_documents"
    
    # Employee permissions
    VIEW_EMPLOYEES = "view_employees"
    VIEW_TEAM_EMPLOYEES = "view_team_employees"
    UPDATE_EMPLOYEES = "update_employees"
    CREATE_EMPLOYEES = "create_employees"
    DEACTIVATE_EMPLOYEES = "deactivate_employees"
    
    # Admin permissions
    REVIEW_PROFILES = "review_profiles"
    APPROVE_DOCUMENTS = "approve_documents"
    ASSIGN_ROLES = "assign_roles"
    VIEW_ADMIN_DASHBOARD = "view_admin_dashboard"
    BULK_OPERATIONS = "bulk_operations"
    
    # System permissions
    VIEW_AUDIT_LOGS = "view_audit_logs"
    MANAGE_SYSTEM = "manage_system"

class PermissionService(PermissionServiceInterface):
    """Implementation of permission checking service."""
    
    def __init__(
        self,
        role_repository: RoleRepositoryInterface,
        employee_repository: EmployeeRepositoryInterface
    ):
        self.role_repository = role_repository
        self.employee_repository = employee_repository
        
        self.permission_matrix = {
            AccessLevel.NONE: [],
            AccessLevel.PROFILE_COMPLETION: [
                PermissionType.VIEW_OWN_PROFILE,
                PermissionType.UPDATE_OWN_PROFILE,
                PermissionType.SUBMIT_PROFILE,
                PermissionType.RESUBMIT_PROFILE,
                PermissionType.VIEW_OWN_DOCUMENTS,
                PermissionType.DELETE_OWN_DOCUMENTS,
                PermissionType.RESUBMIT_PROFILE,
            ],
            AccessLevel.NEWCOMER: [
                PermissionType.VIEW_OWN_PROFILE,
                PermissionType.UPDATE_OWN_PROFILE,
                PermissionType.UPLOAD_DOCUMENTS,
                PermissionType.VIEW_OWN_DOCUMENTS,
                PermissionType.DELETE_OWN_DOCUMENTS,
                PermissionType.RESUBMIT_PROFILE,
            ],
            AccessLevel.VERIFIED: [
                PermissionType.VIEW_OWN_PROFILE,
                PermissionType.UPDATE_OWN_PROFILE,
                PermissionType.VIEW_OWN_DOCUMENTS,
                PermissionType.VIEW_EMPLOYEES,
            ],
            AccessLevel.ADMIN: [
                # Admins get all permissions
                perm for perm in PermissionType
            ]
        }
    
    async def can_create_employee(self, user_id: UUID) -> bool:
        """Check if user can create employees."""
        return await self.role_repository.has_role(user_id, RoleCode.ADMIN)
    
    async def can_view_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can view specific employee."""
        # Admin can view all
        if await self.role_repository.has_role(user_id, RoleCode.ADMIN):
            return True
        
        # Manager can view their team
        if await self.role_repository.has_role(user_id, RoleCode.MANAGER):
            employee = await self.employee_repository.get_by_id(employee_id)
            if employee and employee.manager_id:
                # Get the user's employee record to compare with manager_id
                user_employee = await self._get_employee_by_user_id(user_id)
                if user_employee and employee.manager_id == user_employee.id:
                    return True
        
        # Employee can view themselves
        user_employee = await self._get_employee_by_user_id(user_id)
        if user_employee and user_employee.id == employee_id:
            return True
        
        return False
    
    async def can_update_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can update specific employee."""
        # Admin can update all
        if await self.role_repository.has_role(user_id, RoleCode.ADMIN):
            return True
        
        # Manager can update their team (limited fields)
        if await self.role_repository.has_role(user_id, RoleCode.MANAGER):
            employee = await self.employee_repository.get_by_id(employee_id)
            if employee and employee.manager_id:
                user_employee = await self._get_employee_by_user_id(user_id)
                if user_employee and employee.manager_id == user_employee.id:
                    return True
        
        # Employees cannot update in MVP
        return False
    
    async def can_deactivate_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can deactivate specific employee."""
        # Only admins can deactivate employees
        return await self.role_repository.has_role(user_id, RoleCode.ADMIN)
    
    async def can_assign_roles(self, user_id: UUID) -> bool:
        """Check if user can assign roles."""
        return await self.role_repository.has_role(user_id, RoleCode.ADMIN)
    
    async def get_viewable_employees(self, user_id: UUID) -> List[UUID]:
        """Get list of employee IDs that user can view."""
        viewable_ids = []
        
        # Admin can view all
        if await self.role_repository.has_role(user_id, RoleCode.ADMIN):
            # This would need pagination in real implementation
            # For now, return empty list to indicate "all"
            return []
        
        # Manager can view their team
        if await self.role_repository.has_role(user_id, RoleCode.MANAGER):
            user_employee = await self._get_employee_by_user_id(user_id)
            if user_employee:
                team_members = await self.employee_repository.get_by_manager_id(user_employee.id)
                viewable_ids.extend([emp.id for emp in team_members])
        
        # Employee can view themselves
        user_employee = await self._get_employee_by_user_id(user_id)
        if user_employee:
            viewable_ids.append(user_employee.id)
        
        return list(set(viewable_ids))  # Remove duplicates
    
    async def _get_employee_by_user_id(self, user_id: UUID) -> Optional[any]:
        """Get employee record by user ID."""
        return await self.employee_repository.get_by_user_id(user_id)
    

    
    async def get_user_access_level(self, user_claims: UserClaims) -> AccessLevel:
        """Determine user's access level based on verification status and roles."""
        
        # Check if user is admin first
        if await self.role_repository.has_role(user_claims.user_id, RoleCode.ADMIN):
            return AccessLevel.ADMIN
        
        # Check verification status
        if user_claims.needs_profile_completion():
            return AccessLevel.PROFILE_COMPLETION
        elif user_claims.is_pending_verification():
            return AccessLevel.NEWCOMER
        elif user_claims.is_verified_profile():
            return AccessLevel.VERIFIED
        elif user_claims.is_profile_rejected():
            return AccessLevel.PROFILE_COMPLETION
        else:
            return AccessLevel.NONE
    
    async def has_permission(
        self, 
        user_claims: UserClaims, 
        permission: PermissionType,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Check if user has a specific permission."""
        
        access_level = await self.get_user_access_level(user_claims)
        base_permissions = self.permission_matrix.get(access_level, [])
        
        # Check base permissions
        if permission not in base_permissions:
            return False
        
        # Apply contextual checks
        return await self._apply_contextual_checks(
            user_claims, permission, context, access_level
        )
    
    async def _apply_contextual_checks(
        self,
        user_claims: UserClaims,
        permission: PermissionType,
        context: Optional[Dict[str, Any]],
        access_level: AccessLevel
    ) -> bool:
        """Apply contextual permission checks."""
        
        if not context:
            return True
        
        # Admin bypass
        if access_level == AccessLevel.ADMIN:
            return True
        
        # Check employee-specific permissions
        if permission in [PermissionType.VIEW_EMPLOYEES, PermissionType.UPDATE_EMPLOYEES]:
            employee_id = context.get("employee_id")
            if employee_id:
                return await self._can_access_employee(user_claims, employee_id)
        
        # Check document permissions
        if permission in [PermissionType.VIEW_OWN_DOCUMENTS, PermissionType.DELETE_OWN_DOCUMENTS]:
            document_owner_id = context.get("document_owner_id")
            if document_owner_id:
                return document_owner_id == user_claims.user_id
        
        return True
    
    async def _can_access_employee(self, user_claims: UserClaims, employee_id: UUID) -> bool:
        """Check if user can access specific employee data."""
        
        # Get user's employee record
        user_employee = await self.employee_repository.get_by_user_id(user_claims.user_id)
        if not user_employee:
            return False
        
        # Can access own record
        if str(user_employee.id) == str(employee_id):
            return True
        
        # Managers can access their team members
        if await self.role_repository.has_role(user_claims.user_id, RoleCode.MANAGER):
            target_employee = await self.employee_repository.get_by_id(employee_id)
            if target_employee and target_employee.manager_id == user_employee.id:
                return True
        
        return False
    
    async def require_permission(
        self,
        user_claims: UserClaims,
        permission: PermissionType,
        context: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ) -> None:
        """Require a specific permission or raise HTTPException."""
        
        has_perm = await self.has_permission(user_claims, permission, context)
        if not has_perm:
            access_level = await self.get_user_access_level(user_claims)
            
            if error_message:
                detail = error_message
            else:
                detail = self._get_permission_error_message(permission, access_level)
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail
            )
    
    def _get_permission_error_message(
        self, 
        permission: PermissionType, 
        access_level: AccessLevel
    ) -> str:
        """Get appropriate error message for permission denial."""
        
        messages = {
            AccessLevel.NONE: "Account access required. Please contact support.",
            AccessLevel.PROFILE_COMPLETION: "Please complete your employee profile to access this feature.",
            AccessLevel.NEWCOMER: "This feature will be available once your profile is verified.",
            AccessLevel.VERIFIED: "You don't have permission to access this resource.",
        }
        
        return messages.get(access_level, "Access denied.")
    
    async def get_user_permissions(self, user_claims: UserClaims) -> List[str]:
        """Get all permissions for a user."""
        
        access_level = await self.get_user_access_level(user_claims)
        permissions = self.permission_matrix.get(access_level, [])
        
        return [perm.value for perm in permissions]
    
    async def get_access_summary(self, user_claims: UserClaims) -> Dict[str, Any]:
        """Get comprehensive access summary for a user."""
        
        access_level = await self.get_user_access_level(user_claims)
        permissions = await self.get_user_permissions(user_claims)
        
        # Get user roles
        user_roles = await self.role_repository.get_user_roles(user_claims.user_id)
        role_codes = []
        for assignment in user_roles:
            role = await self.role_repository.get_role_by_id(assignment.role_id)
            if role:
                role_codes.append(role.code.value)
        
        return {
            "user_id": str(user_claims.user_id),
            "email": user_claims.email,
            "access_level": access_level.value,
            "verification_status": user_claims.employee_profile_status,
            "roles": role_codes,
            "permissions": permissions,
            "can_access_system": access_level in [AccessLevel.VERIFIED, AccessLevel.ADMIN],
            "needs_profile_completion": access_level == AccessLevel.PROFILE_COMPLETION,
            "is_newcomer": access_level == AccessLevel.NEWCOMER,
            "is_admin": access_level == AccessLevel.ADMIN
        }


# Enhanced middleware and dependencies
class VerificationAwareMiddleware:
    """Middleware for verification-aware access control."""
    
    def __init__(self, permission_service: PermissionService):
        self.permission_service = permission_service
    
    async def verify_access_level(
        self, 
        user_claims: UserClaims, 
        required_levels: List[AccessLevel]
    ) -> UserClaims:
        """Verify user has required access level."""
        
        user_level = await self.permission_service.get_user_access_level(user_claims)
        
        if user_level not in required_levels:
            if AccessLevel.PROFILE_COMPLETION in required_levels:
                detail = "Please complete your employee profile first."
            elif AccessLevel.NEWCOMER in required_levels:
                detail = "Profile verification required to access this feature."
            elif AccessLevel.VERIFIED in required_levels:
                detail = "Verified employee status required."
            elif AccessLevel.ADMIN in required_levels:
                detail = "Administrator access required."
            else:
                detail = "Insufficient access level."
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail
            )
        
        return user_claims
    
    async def verify_permission(
        self,
        user_claims: UserClaims,
        permission: PermissionType,
        context: Optional[Dict[str, Any]] = None
    ) -> UserClaims:
        """Verify user has specific permission."""
        
        await self.permission_service.require_permission(
            user_claims, permission, context
        )
        
        return user_claims