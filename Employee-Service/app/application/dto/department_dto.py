from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID


@dataclass
class CreateDepartmentRequest:
    name: str
    description: Optional[str] = None


@dataclass
class UpdateDepartmentRequest:
    name: Optional[str] = None
    description: Optional[str] = None


@dataclass
class AssignManagerRequest:
    manager_id: UUID


@dataclass
class DepartmentResponse:
    id: UUID
    name: str
    description: Optional[str]
    manager_id: Optional[UUID]
    manager_name: Optional[str]  # Will be populated from manager relationship
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: UUID


@dataclass
class DepartmentListResponse:
    departments: List[DepartmentResponse]
    total: int


@dataclass
class DepartmentWithStatsResponse:
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


@dataclass
class DepartmentStatsListResponse:
    departments: List[DepartmentWithStatsResponse]
    total: int