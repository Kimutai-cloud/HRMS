from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime

from app.infrastructure.websocket.notification_websocket import websocket_manager
from app.presentation.schema.websocket_schema import (
    NotificationWebSocketMessage,
    ProfileUpdateWebSocketMessage,
    SystemUpdateWebSocketMessage
)


class RealTimeNotificationSender:
    """Service for sending real-time notifications via WebSocket."""
    
    @staticmethod
    async def send_notification(
        user_id: UUID,
        notification_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send real-time notification to user."""
        
        websocket_message = NotificationWebSocketMessage(
            notification_id=notification_id,
            notification_type=notification_type,
            title=title,
            message=message,
            data=data or {},
            user_id=user_id
        )
        
        try:
            await websocket_manager.send_personal_message(
                websocket_message.dict(),
                str(user_id)
            )
            return True
        except Exception as e:
            print(f"❌ Failed to send real-time notification: {e}")
            return False
    
    @staticmethod
    async def send_profile_update(
        user_id: UUID,
        employee_id: UUID,
        new_status: str,
        stage: str
    ) -> bool:
        """Send profile update notification."""
        
        websocket_message = ProfileUpdateWebSocketMessage(
            employee_id=employee_id,
            new_status=new_status,
            stage=stage,
            user_id=user_id,
            data={
                "employee_id": str(employee_id),
                "new_status": new_status,
                "stage": stage
            }
        )
        
        try:
            await websocket_manager.send_personal_message(
                websocket_message.dict(),
                str(user_id)
            )
            return True
        except Exception as e:
            print(f"❌ Failed to send profile update: {e}")
            return False
    
    @staticmethod
    async def send_admin_alert(
        update_type: str,
        message: str,
        affected_users: Optional[List[UUID]] = None
    ) -> bool:
        """Send alert to admin users."""
        
        websocket_message = SystemUpdateWebSocketMessage(
            update_type=update_type,
            affected_users=affected_users,
            data={
                "message": message,
                "update_type": update_type,
                "affected_users": [str(uid) for uid in (affected_users or [])]
            }
        )
        
        try:
            await websocket_manager.send_to_admins(websocket_message.dict())
            return True
        except Exception as e:
            print(f"❌ Failed to send admin alert: {e}")
            return False
    
    @staticmethod
    async def send_system_broadcast(
        message: str,
        update_type: str = "system_announcement"
    ) -> bool:
        """Send system-wide broadcast message."""
        
        websocket_message = SystemUpdateWebSocketMessage(
            update_type=update_type,
            data={
                "message": message,
                "update_type": update_type,
                "is_broadcast": True
            }
        )
        
        try:
            await websocket_manager.broadcast(websocket_message.dict())
            return True
        except Exception as e:
            print(f"❌ Failed to send system broadcast: {e}")