from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime

from app.infrastructure.websocket.notification_websocket import websocket_manager
from app.presentation.schema.websocket_schema import (
    TaskUpdateWebSocketMessage,
    TaskCommentWebSocketMessage,
    TaskAssignmentWebSocketMessage,
    NotificationWebSocketMessage
)


class TaskNotificationSender:
    """Service for sending real-time task-related notifications via WebSocket."""
    
    @staticmethod
    async def send_task_assigned(
        assignee_user_id: UUID,
        manager_user_id: UUID,
        task_id: UUID,
        task_title: str,
        task_type: str,
        priority: str,
        assignee_name: str,
        manager_name: str,
        department_name: str,
        due_date: Optional[datetime] = None,
        assignment_notes: Optional[str] = None
    ) -> bool:
        """Send task assignment notification to assignee and manager."""
        
        assignment_message = TaskAssignmentWebSocketMessage(
            task_id=task_id,
            task_title=task_title,
            task_type=task_type,
            priority=priority,
            assignee_id=assignee_user_id,
            assignee_name=assignee_name,
            manager_id=manager_user_id,
            manager_name=manager_name,
            due_date=due_date,
            department_name=department_name,
            assignment_notes=assignment_notes,
            user_id=assignee_user_id
        )
        
        try:
            # Send to assignee
            await websocket_manager.send_personal_message(
                assignment_message.dict(),
                str(assignee_user_id)
            )
            
            # Send to manager (different perspective)
            manager_message = assignment_message.copy()
            manager_message.user_id = manager_user_id
            await websocket_manager.send_personal_message(
                manager_message.dict(),
                str(manager_user_id)
            )
            
            return True
        except Exception as e:
            print(f"❌ Failed to send task assignment notification: {e}")
            return False
    
    @staticmethod
    async def send_task_status_update(
        task_id: UUID,
        task_title: str,
        action: str,
        actor_name: str,
        new_status: Optional[str] = None,
        priority: Optional[str] = None,
        due_date: Optional[datetime] = None,
        assignee_user_id: Optional[UUID] = None,
        manager_user_id: Optional[UUID] = None,
        department_name: Optional[str] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send task status update notification to relevant users."""
        
        # Determine recipients
        recipients = []
        if assignee_user_id:
            recipients.append(assignee_user_id)
        if manager_user_id and manager_user_id != assignee_user_id:
            recipients.append(manager_user_id)
        
        if not recipients:
            return True  # No one to notify
        
        try:
            for recipient_id in recipients:
                update_message = TaskUpdateWebSocketMessage(
                    task_id=task_id,
                    task_title=task_title,
                    action=action,
                    actor_name=actor_name,
                    new_status=new_status,
                    priority=priority,
                    due_date=due_date,
                    assignee_id=assignee_user_id,
                    manager_id=manager_user_id,
                    department_name=department_name,
                    additional_data=additional_data,
                    user_id=recipient_id
                )
                
                await websocket_manager.send_personal_message(
                    update_message.dict(),
                    str(recipient_id)
                )
            
            return True
        except Exception as e:
            print(f"❌ Failed to send task status update notification: {e}")
            return False
    
    @staticmethod
    async def send_task_comment_notification(
        task_id: UUID,
        task_title: str,
        comment_id: UUID,
        comment_type: str,
        comment_text: str,
        author_user_id: UUID,
        author_name: str,
        action: str,  # "added", "updated", "deleted"
        assignee_user_id: Optional[UUID] = None,
        manager_user_id: Optional[UUID] = None
    ) -> bool:
        """Send task comment notification to relevant users."""
        
        # Determine recipients (exclude the author)
        recipients = []
        if assignee_user_id and assignee_user_id != author_user_id:
            recipients.append(assignee_user_id)
        if manager_user_id and manager_user_id != author_user_id and manager_user_id not in recipients:
            recipients.append(manager_user_id)
        
        if not recipients:
            return True  # No one to notify
        
        try:
            for recipient_id in recipients:
                comment_message = TaskCommentWebSocketMessage(
                    task_id=task_id,
                    task_title=task_title,
                    comment_id=comment_id,
                    comment_type=comment_type,
                    comment_text=comment_text[:100] + "..." if len(comment_text) > 100 else comment_text,  # Truncate for notification
                    author_id=author_user_id,
                    author_name=author_name,
                    action=action,
                    assignee_id=assignee_user_id,
                    manager_id=manager_user_id,
                    user_id=recipient_id
                )
                
                await websocket_manager.send_personal_message(
                    comment_message.dict(),
                    str(recipient_id)
                )
            
            return True
        except Exception as e:
            print(f"❌ Failed to send task comment notification: {e}")
            return False
    
    @staticmethod
    async def send_task_deadline_reminder(
        assignee_user_id: UUID,
        manager_user_id: UUID,
        task_id: UUID,
        task_title: str,
        due_date: datetime,
        priority: str,
        days_until_due: int
    ) -> bool:
        """Send task deadline reminder notification."""
        
        urgency = "critical" if days_until_due <= 1 else "high" if days_until_due <= 3 else "medium"
        
        reminder_data = {
            "task_id": str(task_id),
            "task_title": task_title,
            "due_date": due_date.isoformat(),
            "priority": priority,
            "days_until_due": days_until_due,
            "urgency": urgency
        }
        
        try:
            # Send to assignee
            assignee_notification = NotificationWebSocketMessage(
                notification_id=task_id,  # Use task_id as notification_id for simplicity
                notification_type="task_deadline_reminder",
                title=f"Task Due {'Today' if days_until_due == 0 else f'in {days_until_due} day(s)'}",
                message=f"Task '{task_title}' is due {'today' if days_until_due == 0 else f'in {days_until_due} day(s)'}",
                data=reminder_data,
                user_id=assignee_user_id
            )
            
            await websocket_manager.send_personal_message(
                assignee_notification.dict(),
                str(assignee_user_id)
            )
            
            # Send to manager if different from assignee
            if manager_user_id != assignee_user_id:
                manager_notification = assignee_notification.copy()
                manager_notification.user_id = manager_user_id
                manager_notification.message = f"Team member's task '{task_title}' is due {'today' if days_until_due == 0 else f'in {days_until_due} day(s)'}"
                
                await websocket_manager.send_personal_message(
                    manager_notification.dict(),
                    str(manager_user_id)
                )
            
            return True
        except Exception as e:
            print(f"❌ Failed to send task deadline reminder: {e}")
            return False
    
    @staticmethod
    async def send_task_overdue_notification(
        assignee_user_id: UUID,
        manager_user_id: UUID,
        task_id: UUID,
        task_title: str,
        due_date: datetime,
        priority: str,
        days_overdue: int
    ) -> bool:
        """Send task overdue notification."""
        
        overdue_data = {
            "task_id": str(task_id),
            "task_title": task_title,
            "due_date": due_date.isoformat(),
            "priority": priority,
            "days_overdue": days_overdue,
            "urgency": "critical"
        }
        
        try:
            # Send to assignee
            assignee_notification = NotificationWebSocketMessage(
                notification_id=task_id,
                notification_type="task_overdue",
                title=f"Task Overdue by {days_overdue} day(s)",
                message=f"Task '{task_title}' is overdue by {days_overdue} day(s). Please complete immediately.",
                data=overdue_data,
                user_id=assignee_user_id
            )
            
            await websocket_manager.send_personal_message(
                assignee_notification.dict(),
                str(assignee_user_id)
            )
            
            # Send to manager if different from assignee
            if manager_user_id != assignee_user_id:
                manager_notification = assignee_notification.copy()
                manager_notification.user_id = manager_user_id
                manager_notification.message = f"Team member's task '{task_title}' is overdue by {days_overdue} day(s)."
                
                await websocket_manager.send_personal_message(
                    manager_notification.dict(),
                    str(manager_user_id)
                )
            
            return True
        except Exception as e:
            print(f"❌ Failed to send task overdue notification: {e}")
            return False
    
    @staticmethod
    async def send_task_submitted_for_review(
        manager_user_id: UUID,
        assignee_user_id: UUID,
        assignee_name: str,
        task_id: UUID,
        task_title: str,
        submission_notes: Optional[str] = None
    ) -> bool:
        """Send notification when task is submitted for review."""
        
        submission_data = {
            "task_id": str(task_id),
            "task_title": task_title,
            "assignee_id": str(assignee_user_id),
            "assignee_name": assignee_name,
            "submission_notes": submission_notes
        }
        
        try:
            # Send to manager
            manager_notification = NotificationWebSocketMessage(
                notification_id=task_id,
                notification_type="task_submitted_for_review",
                title="Task Submitted for Review",
                message=f"{assignee_name} submitted task '{task_title}' for your review.",
                data=submission_data,
                user_id=manager_user_id
            )
            
            await websocket_manager.send_personal_message(
                manager_notification.dict(),
                str(manager_user_id)
            )
            
            return True
        except Exception as e:
            print(f"❌ Failed to send task submission notification: {e}")
            return False
    
    @staticmethod
    async def send_task_review_completed(
        assignee_user_id: UUID,
        manager_name: str,
        task_id: UUID,
        task_title: str,
        approved: bool,
        review_notes: Optional[str] = None
    ) -> bool:
        """Send notification when task review is completed."""
        
        review_data = {
            "task_id": str(task_id),
            "task_title": task_title,
            "approved": approved,
            "manager_name": manager_name,
            "review_notes": review_notes
        }
        
        try:
            # Send to assignee
            status = "approved" if approved else "rejected"
            assignee_notification = NotificationWebSocketMessage(
                notification_id=task_id,
                notification_type=f"task_{status}",
                title=f"Task {status.title()}",
                message=f"Your task '{task_title}' has been {status} by {manager_name}.",
                data=review_data,
                user_id=assignee_user_id
            )
            
            await websocket_manager.send_personal_message(
                assignee_notification.dict(),
                str(assignee_user_id)
            )
            
            return True
        except Exception as e:
            print(f"❌ Failed to send task review notification: {e}")
            return False