from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID

from app.application.services.notification_service import NotificationService
from app.presentation.api.dependencies import require_newcomer_access
from app.core.entities.user_claims import UserClaims
from app.presentation.schema.notification_schema import (
    NotificationResponse,
    NotificationMarkReadRequest,
    NotificationSummaryResponse
)
from app.presentation.api.dependencies import get_employee_repository

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = Query(50, ge=1, le=100, description="Maximum number of notifications"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
    user_claims: UserClaims = Depends(require_newcomer_access),
    employee_repository = Depends(get_employee_repository)
):
    """Get notifications for the current user."""
    
    notification_service = NotificationService(employee_repository)
    
    notifications = await notification_service.get_user_notifications(
        user_id=user_claims.user_id,
        limit=limit,
        unread_only=unread_only
    )
    
    return [
        NotificationResponse(
            id=notif["id"],
            type=notif["type"],
            title=notif["title"],
            message=notif["message"],
            data=notif["data"],
            is_read=notif["is_read"],
            created_at=notif["created_at"]
        )
        for notif in notifications
    ]


@router.get("/summary", response_model=NotificationSummaryResponse)
async def get_notification_summary(
    user_claims: UserClaims = Depends(require_newcomer_access),
    employee_repository = Depends(get_employee_repository)
):
    """Get notification summary for the current user."""
    
    notification_service = NotificationService(employee_repository)
    
    unread_count = await notification_service.get_unread_count(user_claims.user_id)
    recent_notifications = await notification_service.get_user_notifications(
        user_id=user_claims.user_id,
        limit=5
    )
    
    return NotificationSummaryResponse(
        unread_count=unread_count,
        total_count=len(recent_notifications),
        recent_notifications=[
            NotificationResponse(
                id=notif["id"],
                type=notif["type"],
                title=notif["title"],
                message=notif["message"],
                data=notif["data"],
                is_read=notif["is_read"],
                created_at=notif["created_at"]
            )
            for notif in recent_notifications
        ]
    )


@router.post("/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: UUID,
    user_claims: UserClaims = Depends(require_newcomer_access),
    employee_repository = Depends(get_employee_repository)
):
    """Mark a specific notification as read."""
    
    notification_service = NotificationService(employee_repository)
    
    success = await notification_service.mark_notification_read(
        notification_id=notification_id,
        user_id=user_claims.user_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    return {"message": "Notification marked as read"}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    user_claims: UserClaims = Depends(require_newcomer_access),
    employee_repository = Depends(get_employee_repository)
):
    """Mark all notifications as read for the current user."""
    
    notification_service = NotificationService(employee_repository)
    
    count = await notification_service.mark_all_notifications_read(user_claims.user_id)
    
    return {"message": f"Marked {count} notifications as read"}