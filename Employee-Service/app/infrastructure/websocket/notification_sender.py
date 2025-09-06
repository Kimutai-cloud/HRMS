from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime , timezone

from app.infrastructure.websocket.notification_websocket import websocket_manager
from app.presentation.schema.websocket_schema import (
    NotificationWebSocketMessage,
    ProfileUpdateWebSocketMessage,
    SystemUpdateWebSocketMessage
)
from app.core.entities.employee import Employee
from app.core.entities.document import EmployeeDocument


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
            return False
    
    # Workflow-specific real-time notifications
    
    @staticmethod
    async def send_profile_submission_confirmation(employee: Employee) -> bool:
        """Send instant confirmation when profile is submitted."""
        
        websocket_message = ProfileUpdateWebSocketMessage(
            employee_id=employee.id,
            new_status="SUBMITTED",
            stage="PENDING_DETAILS_REVIEW",
            user_id=employee.user_id,
            data={
                "employee_id": str(employee.id),
                "status": "SUBMITTED",
                "stage": "PENDING_DETAILS_REVIEW",
                "submitted_at": employee.submitted_at.isoformat() if employee.submitted_at else None,
                "message": f"Profile submitted successfully! Review typically takes 2-3 business days.",
                "progress_percentage": 20
            }
        )
        
        try:
            await websocket_manager.send_personal_message(
                websocket_message.dict(),
                str(employee.user_id)
            )
            return True
        except Exception as e:
            print(f"❌ Failed to send profile submission confirmation: {e}")
            return False
    
    @staticmethod
    async def send_stage_advancement_notification(
        employee: Employee, 
        from_stage: str, 
        to_stage: str,
        notes: Optional[str] = None
    ) -> bool:
        """Send real-time stage advancement notification to user."""
        
        stage_progress = {
            "PENDING_DETAILS_REVIEW": 20,
            "PENDING_DOCUMENTS_REVIEW": 40,
            "PENDING_ROLE_ASSIGNMENT": 60,
            "PENDING_FINAL_APPROVAL": 80,
            "VERIFIED": 100
        }
        
        stage_messages = {
            "DETAILS_REVIEW_TO_DOCUMENTS": "Profile details approved! Time to upload documents.",
            "DOCUMENTS_REVIEW_TO_ROLE": "Documents approved! Role assignment in progress.",
            "ROLE_ASSIGNMENT_TO_FINAL": "Role assigned! Final review underway.",
            "FINAL_APPROVAL_TO_VERIFIED": "🎉 Profile fully verified! Welcome to the team!"
        }
        
        stage_key = f"{from_stage}_TO_{to_stage.split('_')[1]}" if "_" in to_stage else f"{from_stage}_TO_{to_stage}"
        message = stage_messages.get(stage_key, f"Profile advanced from {from_stage} to {to_stage}")
        
        websocket_message = ProfileUpdateWebSocketMessage(
            employee_id=employee.id,
            new_status=employee.verification_status.value,
            stage=to_stage,
            user_id=employee.user_id,
            data={
                "employee_id": str(employee.id),
                "from_stage": from_stage,
                "to_stage": to_stage,
                "status": employee.verification_status.value,
                "message": message,
                "notes": notes,
                "progress_percentage": stage_progress.get(to_stage, 0),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )
        
        try:
            await websocket_manager.send_personal_message(
                websocket_message.dict(),
                str(employee.user_id)
            )
            return True
        except Exception as e:
            print(f"❌ Failed to send stage advancement notification: {e}")
            return False
    
    @staticmethod
    async def send_document_upload_confirmation(
        employee: Employee, 
        document: EmployeeDocument
    ) -> bool:
        """Send instant document upload confirmation."""
        
        websocket_message = NotificationWebSocketMessage(
            notification_id=document.id,
            notification_type="DOCUMENT_UPLOADED",
            title="Document Uploaded Successfully",
            message=f"Your {document.get_display_name()} has been uploaded and is pending review.",
            data={
                "employee_id": str(employee.id),
                "document_id": str(document.id),
                "document_type": document.document_type.value,
                "file_name": document.file_name,
                "status": document.review_status.value,
                "uploaded_at": document.uploaded_at.isoformat() if document.uploaded_at else None
            },
            user_id=employee.user_id
        )
        
        try:
            await websocket_manager.send_personal_message(
                websocket_message.dict(),
                str(employee.user_id)
            )
            return True
        except Exception as e:
            print(f"❌ Failed to send document upload confirmation: {e}")
            return False
    
    @staticmethod
    async def send_document_review_result(
        employee: Employee, 
        document: EmployeeDocument,
        approved: bool,
        reviewer_notes: Optional[str] = None
    ) -> bool:
        """Send real-time document review result."""
        
        status_text = "approved" if approved else "requires update"
        emoji = "✅" if approved else "❌"
        
        websocket_message = NotificationWebSocketMessage(
            notification_id=document.id,
            notification_type="DOCUMENT_REVIEWED",
            title=f"Document {status_text.title()}",
            message=f"{emoji} Your {document.get_display_name()} has been {status_text}.",
            data={
                "employee_id": str(employee.id),
                "document_id": str(document.id),
                "document_type": document.document_type.value,
                "file_name": document.file_name,
                "approved": approved,
                "status": document.review_status.value,
                "reviewer_notes": reviewer_notes,
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            },
            user_id=employee.user_id
        )
        
        try:
            await websocket_manager.send_personal_message(
                websocket_message.dict(),
                str(employee.user_id)
            )
            return True
        except Exception as e:
            print(f"❌ Failed to send document review result: {e}")
            return False
    
    @staticmethod
    async def send_admin_new_submission_alert(employee: Employee) -> bool:
        """Send alert to admins about new profile submission."""
        
        websocket_message = SystemUpdateWebSocketMessage(
            update_type="NEW_PROFILE_SUBMISSION",
            affected_users=[employee.user_id],
            data={
                "employee_id": str(employee.id),
                "employee_name": employee.get_full_name(),
                "email": employee.email,
                "department": employee.department,
                "submitted_at": employee.submitted_at.isoformat() if employee.submitted_at else None,
                "message": f"New profile submission from {employee.get_full_name()}",
                "priority": "normal",
                "action_required": "DETAILS_REVIEW"
            }
        )
        
        try:
            await websocket_manager.send_to_admins(websocket_message.dict())
            return True
        except Exception as e:
            print(f"❌ Failed to send admin new submission alert: {e}")
            return False
    
    @staticmethod
    async def send_admin_urgent_review_alert(overdue_count: int, oldest_days: int) -> bool:
        """Send urgent review alert to admins."""
        
        websocket_message = SystemUpdateWebSocketMessage(
            update_type="URGENT_REVIEWS_ALERT",
            data={
                "overdue_count": overdue_count,
                "oldest_days": oldest_days,
                "message": f"🚨 {overdue_count} reviews are overdue (oldest: {oldest_days} days)",
                "priority": "urgent",
                "action_required": "IMMEDIATE_ATTENTION"
            }
        )
        
        try:
            await websocket_manager.send_to_admins(websocket_message.dict())
            return True
        except Exception as e:
            print(f"❌ Failed to send admin urgent review alert: {e}")
            return False
    
    @staticmethod
    async def send_admin_dashboard_update(dashboard_data: Dict[str, Any]) -> bool:
        """Send live dashboard update to admins."""
        
        websocket_message = SystemUpdateWebSocketMessage(
            update_type="DASHBOARD_UPDATE",
            data={
                "pending_reviews": dashboard_data.get("pending_reviews", {}),
                "document_reviews": dashboard_data.get("document_reviews", {}),
                "urgent_items": dashboard_data.get("urgent_items", {}),
                "quick_stats": dashboard_data.get("quick_stats", {}),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "message": "Dashboard statistics updated"
            }
        )
        
        try:
            await websocket_manager.send_to_admins(websocket_message.dict())
            return True
        except Exception as e:
            print(f"❌ Failed to send admin dashboard update: {e}")
            return False