from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum


class EmploymentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


@dataclass
class Employee:
    """Employee entity representing an employee in the HRMS system."""
    
    id: Optional[UUID]
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
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    version: int = 1
    
    def __post_init__(self):
        if self.status == EmploymentStatus.INACTIVE and not self.deactivated_at:
            self.deactivated_at = datetime.utcnow()
    
    def is_active(self) -> bool:
        return self.status == EmploymentStatus.ACTIVE
    
    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
    
    def deactivate(self, reason: str) -> None:
        """Deactivate employee with reason."""
        self.status = EmploymentStatus.INACTIVE
        self.deactivated_at = datetime.utcnow()
        self.deactivation_reason = reason
    
    def reactivate(self) -> None:
        """Reactivate employee."""
        self.status = EmploymentStatus.ACTIVE
        self.deactivated_at = None
        self.deactivation_reason = None
