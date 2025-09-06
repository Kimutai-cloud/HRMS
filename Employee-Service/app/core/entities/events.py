from dataclasses import dataclass
from datetime import datetime, timezone
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
            self.occurred_at = datetime.now(timezone.utc)


@dataclass 
class EmployeeCreatedEvent(DomainEvent):
    """Event raised when employee is created."""
    
    def __init__(self, employee_id: UUID, employee_data: Dict[str, Any]):
        super().__init__(
            id=uuid4(),
            event_type="employee.created",
            aggregate_id=employee_id,
            data=employee_data,
            occurred_at=datetime.now(timezone.utc)
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
            occurred_at=datetime.now(timezone.utc)
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
            occurred_at=datetime.now(timezone.utc)
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
            occurred_at=datetime.now(timezone.utc)
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
            occurred_at=datetime.now(timezone.utc)
        )


# Task Management Events

@dataclass
class TaskCreatedEvent(DomainEvent):
    """Event raised when task is created."""
    
    def __init__(self, task_id: UUID, task_data: Dict[str, Any]):
        super().__init__(
            id=uuid4(),
            event_type="task.created",
            aggregate_id=task_id,
            data=task_data,
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskAssignedEvent(DomainEvent):
    """Event raised when task is assigned to employee."""
    
    def __init__(self, task_id: UUID, assignee_id: UUID, assigner_id: UUID):
        super().__init__(
            id=uuid4(),
            event_type="task.assigned",
            aggregate_id=task_id,
            data={
                "assignee_id": str(assignee_id),
                "assigner_id": str(assigner_id)
            },
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskStartedEvent(DomainEvent):
    """Event raised when task work is started."""
    
    def __init__(self, task_id: UUID, employee_id: UUID):
        super().__init__(
            id=uuid4(),
            event_type="task.started",
            aggregate_id=task_id,
            data={"employee_id": str(employee_id)},
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskProgressUpdatedEvent(DomainEvent):
    """Event raised when task progress is updated."""
    
    def __init__(self, task_id: UUID, employee_id: UUID, progress: int, 
                 previous_progress: int, actual_hours: Optional[float] = None):
        super().__init__(
            id=uuid4(),
            event_type="task.progress_updated",
            aggregate_id=task_id,
            data={
                "employee_id": str(employee_id),
                "progress": progress,
                "previous_progress": previous_progress,
                "actual_hours": actual_hours
            },
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskSubmittedEvent(DomainEvent):
    """Event raised when task is submitted for review."""
    
    def __init__(self, task_id: UUID, employee_id: UUID, submission_notes: Optional[str] = None):
        super().__init__(
            id=uuid4(),
            event_type="task.submitted",
            aggregate_id=task_id,
            data={
                "employee_id": str(employee_id),
                "submission_notes": submission_notes
            },
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskReviewStartedEvent(DomainEvent):
    """Event raised when task review is started."""
    
    def __init__(self, task_id: UUID, reviewer_id: UUID):
        super().__init__(
            id=uuid4(),
            event_type="task.review_started",
            aggregate_id=task_id,
            data={"reviewer_id": str(reviewer_id)},
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskApprovedEvent(DomainEvent):
    """Event raised when task is approved and completed."""
    
    def __init__(self, task_id: UUID, approved_by: UUID, approval_notes: Optional[str] = None):
        super().__init__(
            id=uuid4(),
            event_type="task.approved",
            aggregate_id=task_id,
            data={
                "approved_by": str(approved_by),
                "approval_notes": approval_notes
            },
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskRejectedEvent(DomainEvent):
    """Event raised when task is rejected and sent back for rework."""
    
    def __init__(self, task_id: UUID, rejected_by: UUID, rejection_reason: str):
        super().__init__(
            id=uuid4(),
            event_type="task.rejected",
            aggregate_id=task_id,
            data={
                "rejected_by": str(rejected_by),
                "rejection_reason": rejection_reason
            },
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskCancelledEvent(DomainEvent):
    """Event raised when task is cancelled."""
    
    def __init__(self, task_id: UUID, cancelled_by: UUID, cancellation_reason: Optional[str] = None):
        super().__init__(
            id=uuid4(),
            event_type="task.cancelled",
            aggregate_id=task_id,
            data={
                "cancelled_by": str(cancelled_by),
                "cancellation_reason": cancellation_reason
            },
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskUpdatedEvent(DomainEvent):
    """Event raised when task details are updated."""
    
    def __init__(self, task_id: UUID, updated_by: UUID, changes: Dict[str, Any]):
        super().__init__(
            id=uuid4(),
            event_type="task.updated",
            aggregate_id=task_id,
            data={
                "updated_by": str(updated_by),
                "changes": changes
            },
            occurred_at=datetime.now(timezone.utc)
        )


@dataclass
class TaskCommentAddedEvent(DomainEvent):
    """Event raised when comment is added to task."""
    
    def __init__(self, task_id: UUID, comment_id: UUID, author_id: UUID, comment_type: str):
        super().__init__(
            id=uuid4(),
            event_type="task.comment_added",
            aggregate_id=task_id,
            data={
                "comment_id": str(comment_id),
                "author_id": str(author_id),
                "comment_type": comment_type
            },
            occurred_at=datetime.now(timezone.utc)
        )