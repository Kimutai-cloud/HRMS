from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID
from enum import Enum


class TaskType(str, Enum):
    """Task type enumeration."""
    PROJECT = "PROJECT"
    TASK = "TASK" 
    SUBTASK = "SUBTASK"


class Priority(str, Enum):
    """Task priority enumeration."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class TaskStatus(str, Enum):
    """Task status enumeration with workflow state machine."""
    DRAFT = "DRAFT"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class CommentType(str, Enum):
    """Task comment type enumeration."""
    COMMENT = "COMMENT"
    STATUS_CHANGE = "STATUS_CHANGE"
    PROGRESS_UPDATE = "PROGRESS_UPDATE"
    REVIEW_NOTE = "REVIEW_NOTE"


class TaskAction(str, Enum):
    """Task activity action enumeration."""
    CREATED = "CREATED"
    ASSIGNED = "ASSIGNED"
    STARTED = "STARTED"
    UPDATED = "UPDATED"
    SUBMITTED = "SUBMITTED"
    REVIEWED = "REVIEWED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    COMMENTED = "COMMENTED"


@dataclass
class Task:
    """Task entity with business logic and state machine validation."""
    
    # Core fields
    id: Optional[UUID]
    title: str
    description: Optional[str]
    task_type: TaskType
    priority: Priority
    status: TaskStatus
    
    # Relationships
    assignee_id: Optional[UUID]
    assigner_id: UUID
    department_id: Optional[UUID]
    parent_task_id: Optional[UUID]
    
    # Progress & Effort
    progress_percentage: int = 0
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    
    # Timeline
    created_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Additional Data
    tags: List[str] = field(default_factory=list)
    attachments: List[Dict[str, Any]] = field(default_factory=list)
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    approval_notes: Optional[str] = None
    version: int = 1
    
    def __post_init__(self):
        """Validate and normalize task data."""
        self._validate_required_fields()
        self._normalize_fields()
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc)
        if not self.updated_at:
            self.updated_at = datetime.now(timezone.utc)
    
    def _validate_required_fields(self):
        """Validate required fields are present and valid."""
        errors = []
        
        if not self.title or not self.title.strip():
            errors.append("title is required")
        if not self.assigner_id:
            errors.append("assigner_id is required")
        if self.progress_percentage < 0 or self.progress_percentage > 100:
            errors.append("progress_percentage must be between 0 and 100")
        if self.estimated_hours is not None and self.estimated_hours < 0:
            errors.append("estimated_hours must be non-negative")
        if self.actual_hours is not None and self.actual_hours < 0:
            errors.append("actual_hours must be non-negative")
            
        if errors:
            raise ValueError(f"Task validation failed: {', '.join(errors)}")
    
    def _normalize_fields(self):
        """Normalize field values."""
        if self.title:
            self.title = self.title.strip()
        if self.description:
            self.description = self.description.strip()
        if self.review_notes:
            self.review_notes = self.review_notes.strip()
        if self.rejection_reason:
            self.rejection_reason = self.rejection_reason.strip()
        if self.approval_notes:
            self.approval_notes = self.approval_notes.strip()
    
    # Status checking methods
    def is_draft(self) -> bool:
        return self.status == TaskStatus.DRAFT
    
    def is_assigned(self) -> bool:
        return self.status == TaskStatus.ASSIGNED
    
    def is_in_progress(self) -> bool:
        return self.status == TaskStatus.IN_PROGRESS
    
    def is_submitted(self) -> bool:
        return self.status == TaskStatus.SUBMITTED
    
    def is_in_review(self) -> bool:
        return self.status == TaskStatus.IN_REVIEW
    
    def is_completed(self) -> bool:
        return self.status == TaskStatus.COMPLETED
    
    def is_cancelled(self) -> bool:
        return self.status == TaskStatus.CANCELLED
    
    def is_active(self) -> bool:
        """Check if task is in an active state (not completed or cancelled)."""
        return self.status not in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]
    
    def can_be_edited(self) -> bool:
        """Check if task can be edited."""
        return self.status in [TaskStatus.DRAFT, TaskStatus.ASSIGNED]
    
    def can_be_started(self) -> bool:
        """Check if task can be started by assignee."""
        return self.status == TaskStatus.ASSIGNED
    
    def can_be_submitted(self) -> bool:
        """Check if task can be submitted by assignee."""
        return self.status == TaskStatus.IN_PROGRESS
    
    def can_be_reviewed(self) -> bool:
        """Check if task can be reviewed by manager."""
        return self.status == TaskStatus.SUBMITTED
    
    def can_be_cancelled(self) -> bool:
        """Check if task can be cancelled."""
        return self.status in [TaskStatus.DRAFT, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]
    
    # State transition methods
    def assign_to(self, assignee_id: UUID, assigned_by: UUID) -> None:
        """Assign task to an employee."""
        if self.status != TaskStatus.DRAFT:
            raise ValueError(f"Cannot assign task with status {self.status}")
        
        self.assignee_id = assignee_id
        self.status = TaskStatus.ASSIGNED
        self.assigned_at = datetime.now(timezone.utc)
        self._update_metadata()
    
    def start_work(self) -> None:
        """Start working on the task."""
        if not self.can_be_started():
            raise ValueError(f"Cannot start task with status {self.status}")
        
        self.status = TaskStatus.IN_PROGRESS
        self.started_at = datetime.now(timezone.utc)
        self._update_metadata()
    
    def update_progress(self, progress: int, actual_hours: Optional[float] = None) -> None:
        """Update task progress."""
        if not self.is_in_progress():
            raise ValueError(f"Cannot update progress for task with status {self.status}")
        
        if progress < 0 or progress > 100:
            raise ValueError("Progress must be between 0 and 100")
        
        self.progress_percentage = progress
        if actual_hours is not None:
            if actual_hours < 0:
                raise ValueError("Actual hours must be non-negative")
            self.actual_hours = actual_hours
        
        self._update_metadata()
    
    def submit_for_review(self, submission_notes: Optional[str] = None) -> None:
        """Submit task for review."""
        if not self.can_be_submitted():
            raise ValueError(f"Cannot submit task with status {self.status}")
        
        self.status = TaskStatus.SUBMITTED
        self.submitted_at = datetime.now(timezone.utc)
        self.progress_percentage = 100  # Mark as 100% when submitted
        
        if submission_notes:
            self.review_notes = submission_notes
        
        self._update_metadata()
    
    def start_review(self, reviewer_id: UUID) -> None:
        """Start reviewing the submitted task."""
        if not self.can_be_reviewed():
            raise ValueError(f"Cannot review task with status {self.status}")
        
        self.status = TaskStatus.IN_REVIEW
        self.reviewed_at = datetime.now(timezone.utc)
        self._update_metadata()
    
    def approve_task(self, approved_by: UUID, approval_notes: Optional[str] = None) -> None:
        """Approve and complete the task."""
        if not self.is_in_review():
            raise ValueError(f"Cannot approve task with status {self.status}")
        
        self.status = TaskStatus.COMPLETED
        self.completed_at = datetime.now(timezone.utc)
        self.approval_notes = approval_notes
        self._update_metadata()
    
    def reject_task(self, rejected_by: UUID, rejection_reason: str) -> None:
        """Reject task and send back for rework."""
        if not self.is_in_review():
            raise ValueError(f"Cannot reject task with status {self.status}")
        
        if not rejection_reason or not rejection_reason.strip():
            raise ValueError("Rejection reason is required")
        
        self.status = TaskStatus.IN_PROGRESS
        self.rejection_reason = rejection_reason.strip()
        self.progress_percentage = max(0, self.progress_percentage - 10)  # Reduce progress slightly
        self._update_metadata()
    
    def cancel_task(self, cancelled_by: UUID, cancellation_reason: Optional[str] = None) -> None:
        """Cancel the task."""
        if not self.can_be_cancelled():
            raise ValueError(f"Cannot cancel task with status {self.status}")
        
        self.status = TaskStatus.CANCELLED
        if cancellation_reason:
            self.rejection_reason = cancellation_reason
        self._update_metadata()
    
    def update_details(self, title: Optional[str] = None, description: Optional[str] = None, 
                      priority: Optional[Priority] = None, due_date: Optional[datetime] = None,
                      estimated_hours: Optional[float] = None, tags: Optional[List[str]] = None) -> None:
        """Update task details (only allowed in certain states)."""
        if not self.can_be_edited() and not self.is_in_progress():
            raise ValueError(f"Cannot edit task with status {self.status}")
        
        if title is not None:
            if not title.strip():
                raise ValueError("Title cannot be empty")
            self.title = title.strip()
        
        if description is not None:
            self.description = description.strip() if description else None
        
        if priority is not None:
            self.priority = priority
        
        if due_date is not None:
            self.due_date = due_date
        
        if estimated_hours is not None:
            if estimated_hours < 0:
                raise ValueError("Estimated hours must be non-negative")
            self.estimated_hours = estimated_hours
        
        if tags is not None:
            self.tags = [tag.strip() for tag in tags if tag.strip()]
        
        self._update_metadata()
    
    def add_attachment(self, attachment: Dict[str, Any]) -> None:
        """Add an attachment to the task."""
        if not isinstance(attachment, dict) or 'name' not in attachment:
            raise ValueError("Attachment must be a dict with 'name' key")
        
        self.attachments.append(attachment)
        self._update_metadata()
    
    def remove_attachment(self, attachment_name: str) -> None:
        """Remove an attachment from the task."""
        self.attachments = [att for att in self.attachments if att.get('name') != attachment_name]
        self._update_metadata()
    
    def _update_metadata(self) -> None:
        """Update metadata fields."""
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1
    
    def get_status_display(self) -> str:
        """Get human-readable status."""
        status_map = {
            TaskStatus.DRAFT: "Draft",
            TaskStatus.ASSIGNED: "Assigned",
            TaskStatus.IN_PROGRESS: "In Progress",
            TaskStatus.SUBMITTED: "Submitted",
            TaskStatus.IN_REVIEW: "Under Review",
            TaskStatus.COMPLETED: "Completed",
            TaskStatus.CANCELLED: "Cancelled"
        }
        return status_map.get(self.status, "Unknown")
    
    def get_priority_display(self) -> str:
        """Get human-readable priority."""
        priority_map = {
            Priority.LOW: "Low",
            Priority.MEDIUM: "Medium", 
            Priority.HIGH: "High",
            Priority.URGENT: "Urgent"
        }
        return priority_map.get(self.priority, "Unknown")
    
    def get_type_display(self) -> str:
        """Get human-readable task type."""
        type_map = {
            TaskType.PROJECT: "Project",
            TaskType.TASK: "Task",
            TaskType.SUBTASK: "Subtask"
        }
        return type_map.get(self.task_type, "Unknown")
    
    def is_overdue(self) -> bool:
        """Check if task is overdue."""
        if not self.due_date or self.is_completed() or self.is_cancelled():
            return False
        return datetime.now(timezone.utc) > self.due_date
    
    def days_until_due(self) -> Optional[int]:
        """Get number of days until due date."""
        if not self.due_date or self.is_completed() or self.is_cancelled():
            return None
        
        delta = self.due_date.date() - datetime.now(timezone.utc).date()
        return delta.days
    
    def get_duration(self) -> Optional[int]:
        """Get task duration in days from creation to completion."""
        if not self.completed_at:
            return None
        
        delta = self.completed_at.date() - self.created_at.date()
        return delta.days
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary representation."""
        return {
            'id': str(self.id) if self.id else None,
            'title': self.title,
            'description': self.description,
            'task_type': self.task_type.value,
            'priority': self.priority.value,
            'status': self.status.value,
            'assignee_id': str(self.assignee_id) if self.assignee_id else None,
            'assigner_id': str(self.assigner_id),
            'department_id': str(self.department_id) if self.department_id else None,
            'parent_task_id': str(self.parent_task_id) if self.parent_task_id else None,
            'progress_percentage': self.progress_percentage,
            'estimated_hours': self.estimated_hours,
            'actual_hours': self.actual_hours,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'tags': self.tags,
            'attachments': self.attachments,
            'review_notes': self.review_notes,
            'rejection_reason': self.rejection_reason,
            'approval_notes': self.approval_notes,
            'version': self.version
        }


@dataclass
class TaskComment:
    """Task comment entity."""
    
    id: Optional[UUID]
    task_id: UUID
    author_id: UUID
    comment: str
    comment_type: CommentType = CommentType.COMMENT
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        """Validate and normalize comment data."""
        if not self.comment or not self.comment.strip():
            raise ValueError("Comment text is required")
        
        self.comment = self.comment.strip()
        
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc)
        if not self.updated_at:
            self.updated_at = datetime.now(timezone.utc)
    
    def update_comment(self, new_comment: str) -> None:
        """Update comment text."""
        if not new_comment or not new_comment.strip():
            raise ValueError("Comment text is required")
        
        self.comment = new_comment.strip()
        self.updated_at = datetime.now(timezone.utc)


@dataclass
class TaskActivity:
    """Task activity log entity."""
    
    id: Optional[UUID]
    task_id: UUID
    performed_by: UUID
    action: TaskAction
    previous_status: Optional[TaskStatus] = None
    new_status: Optional[TaskStatus] = None
    details: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    
    def __post_init__(self):
        """Initialize activity log entry."""
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc)
    
    def get_action_display(self) -> str:
        """Get human-readable action."""
        action_map = {
            TaskAction.CREATED: "Created task",
            TaskAction.ASSIGNED: "Assigned task",
            TaskAction.STARTED: "Started work",
            TaskAction.UPDATED: "Updated task",
            TaskAction.SUBMITTED: "Submitted for review",
            TaskAction.REVIEWED: "Started review",
            TaskAction.APPROVED: "Approved task",
            TaskAction.REJECTED: "Rejected task",
            TaskAction.CANCELLED: "Cancelled task",
            TaskAction.COMMENTED: "Added comment"
        }
        return action_map.get(self.action, "Unknown action")
    
    @classmethod
    def create_status_change_activity(cls, task_id: UUID, performed_by: UUID, 
                                    previous_status: TaskStatus, new_status: TaskStatus,
                                    details: Optional[Dict[str, Any]] = None):
        """Create activity for status change."""
        action_map = {
            (TaskStatus.DRAFT, TaskStatus.ASSIGNED): TaskAction.ASSIGNED,
            (TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS): TaskAction.STARTED,
            (TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED): TaskAction.SUBMITTED,
            (TaskStatus.SUBMITTED, TaskStatus.IN_REVIEW): TaskAction.REVIEWED,
            (TaskStatus.IN_REVIEW, TaskStatus.COMPLETED): TaskAction.APPROVED,
            (TaskStatus.IN_REVIEW, TaskStatus.IN_PROGRESS): TaskAction.REJECTED,
        }
        
        action = action_map.get((previous_status, new_status), TaskAction.UPDATED)
        
        return cls(
            id=None,
            task_id=task_id,
            performed_by=performed_by,
            action=action,
            previous_status=previous_status,
            new_status=new_status,
            details=details
        )