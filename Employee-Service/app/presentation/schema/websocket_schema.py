from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID


class WebSocketMessage(BaseModel):
    """WebSocket message schema."""
    
    type: str = Field(..., description="Message type")
    data: Dict[str, Any] = Field(..., description="Message data")
    timestamp: datetime = Field(default_factory=datetime.now(timezone.utc))
    user_id: Optional[UUID] = Field(None, description="Target user ID")


class NotificationWebSocketMessage(WebSocketMessage):
    """Notification WebSocket message."""
    
    type: str = "notification"
    notification_id: UUID = Field(..., description="Notification ID")
    notification_type: str = Field(..., description="Notification type")
    title: str = Field(..., description="Notification title")
    message: str = Field(..., description="Notification message")


class ProfileUpdateWebSocketMessage(WebSocketMessage):
    """Profile update WebSocket message."""
    
    type: str = "profile_update"
    employee_id: UUID = Field(..., description="Employee ID")
    new_status: str = Field(..., description="New verification status")
    stage: str = Field(..., description="Current stage")


class SystemUpdateWebSocketMessage(WebSocketMessage):
    """System update WebSocket message."""
    
    type: str = "system_update"
    update_type: str = Field(..., description="Type of system update")
    affected_users: Optional[List[UUID]] = Field(None, description="Affected user IDs")


class TaskUpdateWebSocketMessage(WebSocketMessage):
    """Task update WebSocket message."""
    
    type: str = "task_update"
    task_id: UUID = Field(..., description="Task ID")
    task_title: str = Field(..., description="Task title")
    action: str = Field(..., description="Action performed on task")
    actor_name: str = Field(..., description="Name of person who performed the action")
    new_status: Optional[str] = Field(None, description="New task status")
    priority: Optional[str] = Field(None, description="Task priority")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    assignee_id: Optional[UUID] = Field(None, description="Assignee user ID")
    manager_id: Optional[UUID] = Field(None, description="Manager user ID")
    department_name: Optional[str] = Field(None, description="Department name")
    additional_data: Optional[Dict[str, Any]] = Field(None, description="Additional task data")


class TaskCommentWebSocketMessage(WebSocketMessage):
    """Task comment WebSocket message."""
    
    type: str = "task_comment"
    task_id: UUID = Field(..., description="Task ID")
    task_title: str = Field(..., description="Task title")
    comment_id: UUID = Field(..., description="Comment ID")
    comment_type: str = Field(..., description="Comment type")
    comment_text: str = Field(..., description="Comment text")
    author_id: UUID = Field(..., description="Comment author user ID")
    author_name: str = Field(..., description="Comment author name")
    action: str = Field(..., description="Comment action (added/updated/deleted)")
    assignee_id: Optional[UUID] = Field(None, description="Task assignee user ID")
    manager_id: Optional[UUID] = Field(None, description="Task manager user ID")


class TaskAssignmentWebSocketMessage(WebSocketMessage):
    """Task assignment WebSocket message."""
    
    type: str = "task_assignment"
    task_id: UUID = Field(..., description="Task ID")
    task_title: str = Field(..., description="Task title")
    task_type: str = Field(..., description="Task type")
    priority: str = Field(..., description="Task priority")
    assignee_id: UUID = Field(..., description="Assignee user ID")
    assignee_name: str = Field(..., description="Assignee name")
    manager_id: UUID = Field(..., description="Manager user ID")
    manager_name: str = Field(..., description="Manager name")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    department_name: str = Field(..., description="Department name")
    assignment_notes: Optional[str] = Field(None, description="Assignment notes")