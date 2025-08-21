from app.application.services.notification_service import NotificationService
from app.infrastructure.websocket.notification_sender import RealTimeNotificationSender
from typing import Optional, Dict, Any
from uuid import UUID

from app.core.entities.employee import Employee
class EnhancedNotificationService(NotificationService):
    """Enhanced notification service with real-time WebSocket support."""
    
    async def _create_notification(
        self,
        user_id: UUID,
        type: str,
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None
    ) -> UUID:
        """Create notification and send real-time update."""
        
        # Create database notification
        notification_id = await super()._create_notification(
            user_id, type, title, message, data
        )
        
        # Send real-time notification
        await RealTimeNotificationSender.send_notification(
            user_id=user_id,
            notification_id=notification_id,
            notification_type=type,
            title=title,
            message=message,
            data=data
        )
        
        return notification_id
    
    async def notify_stage_advanced(
        self, 
        employee: Employee, 
        from_stage: str, 
        to_stage: str,
        notes: Optional[str] = None
    ) -> bool:
        """Enhanced stage advancement notification with real-time update."""
        
        # Send standard notification
        result = await super().notify_stage_advanced(employee, from_stage, to_stage, notes)
        
        # Send real-time profile update
        if result and employee.user_id:
            await RealTimeNotificationSender.send_profile_update(
                user_id=employee.user_id,
                employee_id=employee.id,
                new_status=employee.verification_status.value,
                stage=to_stage
            )
        
        return result
    
    async def notify_new_profile_submission(self, employee: Employee) -> bool:
        """Enhanced new profile notification with admin alert."""
        
        # Send standard notifications
        result = await super().notify_new_profile_submission(employee)
        
        # Send real-time admin alert
        if result:
            await RealTimeNotificationSender.send_admin_alert(
                update_type="new_submission",
                message=f"New profile submission from {employee.get_full_name()}",
                affected_users=[employee.user_id] if employee.user_id else None
            )
        
        return result