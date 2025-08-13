from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID, uuid4


@dataclass
class DomainEvent:
    """Base domain event."""
    
    id: UUID
    event_type: str
    aggregate_id: UUID
    data: Dict[str, Any]
    occurred_at: datetime
    version: int = 1
    
    def __post_init__(self):
        if not self.id:
            self.id = uuid4()
        if not self.occurred_at:
            self.occurred_at = datetime.utcnow()


@dataclass 
class EmployeeCreatedEvent(DomainEvent):
    """Event raised when employee is created."""
    
    def __init__(self, employee_id: UUID, employee_data: Dict[str, Any]):
        super().__init__(
            id=uuid4(),
            event_type="employee.created",
            aggregate_id=employee_id,
            data=employee_data,
            occurred_at=datetime.utcnow()
        )


@dataclass
class EmployeeUpdatedEvent(DomainEvent):
    """Event raised when employee is updated."""
    
    def __init__(self, employee_id: UUID, changes: Dict[str, Any]):
        super().__init__(
            id=uuid4(),
            event_type="employee.updated", 
            aggregate_id=employee_id,
            data={"changes": changes},
            occurred_at=datetime.utcnow()
        )


@dataclass
class EmployeeDeactivatedEvent(DomainEvent):
    """Event raised when employee is deactivated."""
    
    def __init__(self, employee_id: UUID, reason: str):
        super().__init__(
            id=uuid4(),
            event_type="employee.deactivated",
            aggregate_id=employee_id, 
            data={"reason": reason},
            occurred_at=datetime.utcnow()
        )


@dataclass
class RoleAssignedEvent(DomainEvent):
    """Event raised when role is assigned to user."""
    
    def __init__(self, assignment_id: UUID, user_id: UUID, role_code: str):
        super().__init__(
            id=uuid4(),
            event_type="role.assigned",
            aggregate_id=assignment_id,
            data={"user_id": str(user_id), "role_code": role_code},
            occurred_at=datetime.utcnow()
        )


@dataclass
class RoleRevokedEvent(DomainEvent):
    """Event raised when role is revoked from user."""
    
    def __init__(self, assignment_id: UUID, user_id: UUID, role_code: str):
        super().__init__(
            id=uuid4(),
            event_type="role.revoked",
            aggregate_id=assignment_id,
            data={"user_id": str(user_id), "role_code": role_code},
            occurred_at=datetime.utcnow()
        )