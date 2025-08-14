from dataclasses import dataclass
from typing import Optional, Dict, Any
from uuid import UUID
from enum import Enum
from datetime import datetime


class RoleCode(str, Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER" 
    EMPLOYEE = "EMPLOYEE"


@dataclass
class Role:
    """Role entity for RBAC system."""
    
    id: Optional[UUID]
    code: RoleCode
    name: str
    description: Optional[str]
    
    def __post_init__(self):
        if self.code not in RoleCode:
            raise ValueError(f"Invalid role code: {self.code}")


@dataclass
class RoleAssignment:
    """Role assignment entity linking users to roles."""
    
    id: Optional[UUID]
    user_id: UUID  # From Auth Service
    role_id: UUID
    scope: Dict[str, Any]  # Future: department, project, etc.
    created_at: Optional[datetime]
    
    def has_scope(self, scope_key: str, scope_value: Any) -> bool:
        """Check if assignment has specific scope."""
        return self.scope.get(scope_key) == scope_value
