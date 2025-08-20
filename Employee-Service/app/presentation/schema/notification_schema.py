from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID


class NotificationResponse(BaseModel):
    """Response schema for individual notifications."""
    
    id: UUID
    type: str = Field(..., description="Notification type")
    title: str = Field(..., description="Notification title")
    message: str = Field(..., description="Notification message")
    data: Dict[str, Any] = Field(default_factory=dict, description="Additional notification data")
    is_read: bool = Field(..., description="Whether notification has been read")
    created_at: datetime = Field(..., description="When notification was created")


class NotificationSummaryResponse(BaseModel):
    """Response schema for notification summary."""
    
    unread_count: int = Field(..., description="Number of unread notifications")
    total_count: int = Field(..., description="Total number of notifications")
    recent_notifications: List[NotificationResponse] = Field(..., description="Recent notifications")


class NotificationMarkReadRequest(BaseModel):
    """Request schema for marking notifications as read."""
    
    notification_ids: Optional[List[UUID]] = Field(None, description="Specific notification IDs to mark as read")
    mark_all: bool = Field(False, description="Mark all notifications as read")