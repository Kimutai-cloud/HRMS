from pydantic import BaseModel, Field
from datetime import datetime
from typing import Dict, Any, Optional, List
from uuid import UUID


class WebSocketMessage(BaseModel):
    """WebSocket message schema."""
    
    type: str = Field(..., description="Message type")
    data: Dict[str, Any] = Field(..., description="Message data")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
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