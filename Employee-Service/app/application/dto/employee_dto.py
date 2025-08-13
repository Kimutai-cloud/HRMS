from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID

from app.core.entities.employee import EmploymentStatus


@dataclass
class CreateEmployeeRequest:
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    manager_id: Optional[UUID] = None


@dataclass
class UpdateEmployeeRequest:
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    manager_id: Optional[UUID] = None


@dataclass
class DeactivateEmployeeRequest:
    reason: str


@dataclass
class EmployeeResponse:
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


@dataclass
class EmployeeListResponse:
    employees: List[EmployeeResponse]
    total: int
    page: int
    size: int
    pages: int


@dataclass
class AssignRoleRequest:
    user_id: UUID
    role_code: str
    scope: Optional[Dict[str, Any]] = None


@dataclass
class RoleAssignmentResponse:
    id: UUID
    user_id: UUID
    role_code: str
    scope: Dict[str, Any]
    created_at: datetime