from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from enum import Enum


class RoleCode(str, Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER" 
    EMPLOYEE = "EMPLOYEE"
    NEWCOMER = "NEWCOMER"  # New role for unverified employees


@dataclass
class Role:
    """Role entity for RBAC system."""
p    id: Optional[UUID]
    code: RoleCode
    name: str
    description: Optional[str]
    permissions: Optional[Dict[str, Any]] = None  # Store permissions as JSON
    
    def __post_init__(self):
        if self.code not in RoleCode:
            raise ValueError(f"Invalid role code: {self.code}")
    
    def get_permissions(self) -> Dict[str, Any]:
        """Get role permissions with defaults."""
        if self.permissions:
            return self.permissions
        
        # Default permissions based on role
        default_permissions = {
            RoleCode.ADMIN: {
                "can_view_all_employees": True,
                "can_create_employees": True,
                "can_update_employees": True,
                "can_deactivate_employees": True,
                "can_assign_roles": True,
                "can_approve_profiles": True,
                "can_view_admin_dashboard": True,
                "can_manage_departments": True,
                "can_view_audit_logs": True
            },
            RoleCode.MANAGER: {
                "can_view_team_employees": True,
                "can_update_team_employees": True,
                "can_view_reports": True,
                "can_approve_team_requests": True,
                "can_view_team_dashboard": True
            },
            RoleCode.EMPLOYEE: {
                "can_view_own_profile": True,
                "can_update_own_profile": True,
                "can_view_company_directory": True,
                "can_submit_requests": True
            },
            RoleCode.NEWCOMER: {
                "can_view_own_profile": True,
                "can_update_basic_profile": True,
                "can_view_verification_status": True,
                "can_upload_documents": True,
                "can_resubmit_profile": True,
                "can_view_company_policies": True
            }
        }
        
        return default_permissions.get(self.code, {})
    
    def has_permission(self, permission: str) -> bool:
        """Check if role has specific permission."""
        permissions = self.get_permissions()
        return permissions.get(permission, False)


@dataclass
class RoleAssignment:
    """Role assignment entity linking users to roles."""
    
    id: Optional[UUID]
    user_id: UUID  # From Auth Service
    role_id: UUID
    scope: Dict[str, Any]  # Future: department, project, etc.
    created_at: Optional[datetime]
    assigned_by: Optional[UUID] = None
    is_active: bool = True
    
    def has_scope(self, scope_key: str, scope_value: Any) -> bool:
        """Check if assignment has specific scope."""
        return self.scope.get(scope_key) == scope_value
    
    def deactivate(self, deactivated_by: UUID) -> None:
        """Deactivate role assignment."""
        self.is_active = False
        # Note: We'd need an updated_at field to track this properly