from typing import List, Dict, Any, Optional, _Func
from fastapi import APIRouter, Depends, Query
from uuid import UUID
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import asyncio
from jinja2 import Template

from app.core.entities.employee import Employee, VerificationStatus
from app.core.entities.document import EmployeeDocument
from app.core.interfaces.repositories import EmployeeRepositoryInterface
from app.infrastructure.database.models import NotificationModel
from app.infrastructure.database.connections import db_connection
from app.config.settings import settings
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.websocket.notification_sender import RealTimeNotificationSender
from app.application.services.email_template_service import email_template_service



class NotificationService:
    """Comprehensive notification service for employee verification workflow."""
    
    def __init__(self, employee_repository: EmployeeRepositoryInterface):
        self.employee_repository = employee_repository
        self.smtp_enabled = all([
            settings.NOTIFICATION_EMAIL_FROM,
            hasattr(settings, 'MAIL_SERVER'),
            hasattr(settings, 'MAIL_USERNAME'),
            hasattr(settings, 'MAIL_PASSWORD')
        ])
    
    # User Workflow Notifications
    
    async def notify_profile_submitted(self, employee: Employee) -> bool:
        """Notify user that their profile has been submitted for review."""
        
        title = "Profile Submitted Successfully"
        message = f"""
        Hi {employee.first_name},
        
        Great news! Your employee profile has been submitted successfully and is now under review.
        
        What happens next:
        • Our admin team will review your details
        • You'll receive updates as your profile progresses
        • The process typically takes 2-3 business days
        
        You can check your status anytime in your dashboard.
        """
        
        # Create in-app notification
        await self._create_notification(
            user_id=employee.user_id,
            type="PROFILE_APPROVED",
            title=title,
            message=message.strip(),
            data={"employee_id": str(employee.id), "stage": "submitted"}
        )
        
        # Send enhanced template email
        try:
            await email_template_service.send_profile_submission_email(employee)
        except Exception as e:
            print(f"⚠️ Enhanced email failed, trying fallback: {e}")
            # Fallback to simple email
            if self.smtp_enabled:
                await self._send_email(
                    to_email=employee.email,
                    subject=title,
                    template="profile_submitted",
                    context={
                        "first_name": employee.first_name,
                        "employee": employee
                    }
                )
        
        return True
    
    async def notify_stage_advanced(
        self, 
        employee: Employee, 
        from_stage: str, 
        to_stage: str,
        notes: Optional[str] = None
    ) -> bool:
        """Notify user that their profile has advanced to the next stage."""
        
        stage_messages = {
            "DETAILS_REVIEW_TO_DOCUMENTS": {
                "title": "Profile Details Approved ✅",
                "message": f"""
                Hi {employee.first_name},
                
                Excellent! Your profile details have been approved.
                
                Next step: Document Upload
                • Please upload all required documents
                • Accepted formats: PDF, JPG, PNG, DOC, DOCX
                • Maximum file size: 10MB per document
                
                Your profile is progressing smoothly!
                """
            },
            "DOCUMENTS_REVIEW_TO_ROLE": {
                "title": "Documents Approved ✅",
                "message": f"""
                Hi {employee.first_name},
                
                Great news! All your documents have been approved.
                
                Next step: Role Assignment
                • Our team is determining your role and permissions
                • This usually takes 1 business day
                
                You're almost there!
                """
            },
            "ROLE_ASSIGNMENT_TO_FINAL": {
                "title": "Role Assigned - Final Review ✅",
                "message": f"""
                Hi {employee.first_name},
                
                Your role has been assigned and we're conducting the final review.
                
                What's happening:
                • Final verification of all details
                • System access preparation
                • Welcome package preparation
                
                You'll have full access very soon!
                """
            }
        }
        
        stage_key = f"{from_stage}_TO_{to_stage.split('_')[1]}"
        notification_data = stage_messages.get(stage_key, {
            "title": "Profile Update",
            "message": f"Your profile has been updated. Current stage: {to_stage}"
        })
        
        # Add admin notes if provided
        if notes:
            notification_data["message"] += f"\n\nAdmin notes: {notes}"
        
        # Create in-app notification
        await self._create_notification(
            user_id=employee.user_id,
            type="STAGE_ADVANCED",
            title=notification_data["title"],
            message=notification_data["message"].strip(),
            data={
                "employee_id": str(employee.id),
                "from_stage": from_stage,
                "to_stage": to_stage,
                "notes": notes
            }
        )
        
        # Send enhanced template email
        try:
            await email_template_service.send_stage_advancement_email(
                employee=employee,
                from_stage=from_stage,
                to_stage=to_stage,
                notes=notes
            )
        except Exception as e:
            print(f"⚠️ Enhanced email failed, trying fallback: {e}")
            # Fallback to simple email
            if self.smtp_enabled:
                await self._send_email(
                    to_email=employee.email,
                    subject=notification_data["title"],
                    template="stage_advanced",
                    context={
                        "first_name": employee.first_name,
                        "from_stage": from_stage,
                        "to_stage": to_stage,
                        "message": notification_data["message"],
                        "notes": notes
                    }
                )
        
        return True
    
    async def notify_profile_approved(self, employee: Employee) -> bool:
        """Notify user that their profile has been fully approved."""
        
        title = "🎉 Welcome to the Team!"
        message = f"""
        Congratulations {employee.first_name}!
        
        Your employee profile has been fully verified and approved.
        
        What you can do now:
        • Access all system features
        • Connect with your team
        • Complete your onboarding tasks
        • Explore available resources
        
        Welcome aboard! We're excited to have you join us.
        """
        
        # Create in-app notification
        await self._create_notification(
            user_id=employee.user_id,
            type="FINAL_VERIFICATION",
            title=title,
            message=message.strip(),
            data={
                "employee_id": str(employee.id),
                "verification_completed": True,
                "hired_at": employee.hired_at.isoformat() if employee.hired_at else None
            }
        )
        
        # Send email notification
        if self.smtp_enabled:
            await self._send_email(
                to_email=employee.email,
                subject=title,
                template="profile_approved",
                context={
                    "first_name": employee.first_name,
                    "last_name": employee.last_name,
                    "employee": employee
                }
            )
        
        return True
    
    async def notify_profile_rejected(
        self, 
        employee: Employee, 
        reason: str,
        stage: str
    ) -> bool:
        """Notify user that their profile has been rejected."""
        
        title = "Profile Update Required"
        message = f"""
        Hi {employee.first_name},
        
        We need some updates to your profile before we can proceed.
        
        Feedback from our review team:
        {reason}
        
        What to do next:
        • Review the feedback above
        • Update your profile information
        • Resubmit when ready
        
        Don't worry - this is a normal part of the process. We're here to help!
        """
        
        # Create in-app notification
        await self._create_notification(
            user_id=employee.user_id,
            type="PROFILE_REJECTED",
            title=title,
            message=message.strip(),
            data={
                "employee_id": str(employee.id),
                "reason": reason,
                "stage": stage,
                "can_resubmit": True
            }
        )
        
        # Send email notification
        if self.smtp_enabled:
            await self._send_email(
                to_email=employee.email,
                subject=title,
                template="profile_rejected",
                context={
                    "first_name": employee.first_name,
                    "reason": reason,
                    "stage": stage
                }
            )
        
        return True
    
    # Document Notifications
    
    async def notify_document_approved(
        self, 
        employee: Employee, 
        document: EmployeeDocument,
        reviewer_notes: Optional[str] = None
    ) -> bool:
        """Notify user that their document has been approved."""
        
        title = f"Document Approved: {document.get_display_name()}"
        message = f"""
        Hi {employee.first_name},
        
        Your {document.get_display_name()} has been approved!
        
        File: {document.file_name}
        Status: ✅ Approved
        """
        
        if reviewer_notes:
            message += f"\nReviewer notes: {reviewer_notes}"
        
        # Create in-app notification
        await self._create_notification(
            user_id=employee.user_id,
            type="DOCUMENT_APPROVED",
            title=title,
            message=message.strip(),
            data={
                "employee_id": str(employee.id),
                "document_id": str(document.id),
                "document_type": document.document_type.value,
                "notes": reviewer_notes
            }
        )
        
        return True
    
    async def notify_document_rejected(
        self, 
        employee: Employee, 
        document: EmployeeDocument,
        reason: str
    ) -> bool:
        """Notify user that their document has been rejected."""
        
        title = f"Document Needs Update: {document.get_display_name()}"
        message = f"""
        Hi {employee.first_name},
        
        We need you to update your {document.get_display_name()}.
        
        File: {document.file_name}
        Status: ❌ Needs Update
        
        Feedback: {reason}
        
        Please upload a new version when ready.
        """
        
        # Create in-app notification
        await self._create_notification(
            user_id=employee.user_id,
            type="DOCUMENT_REJECTED",
            title=title,
            message=message.strip(),
            data={
                "employee_id": str(employee.id),
                "document_id": str(document.id),
                "document_type": document.document_type.value,
                "reason": reason
            }
        )
        
        return True
    
    # Admin Notifications
    
    async def notify_new_profile_submission(self, employee: Employee) -> bool:
        """Notify admins of new profile submissions."""
        
        # Get all admins
        admin_ids = await self._get_admin_user_ids()
        
        title = "New Profile Submission"
        message = f"""
        New employee profile submitted for review:
        
        Name: {employee.get_full_name()}
        Email: {employee.email}
        Department: {employee.department}
        Submitted: {employee.submitted_at.strftime('%Y-%m-%d %H:%M')}
        
        Action required: Review profile details
        """
        
        # Notify all admins
        for admin_id in admin_ids:
            await self._create_notification(
                user_id=admin_id,
                type="ACTION_REQUIRED",
                title=title,
                message=message.strip(),
                data={
                    "employee_id": str(employee.id),
                    "action_type": "profile_review",
                    "priority": "normal"
                }
            )
        
        return True
    
    async def notify_urgent_reviews(self) -> bool:
        """Notify admins of reviews that are overdue."""
        
        # Get overdue reviews (>7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        async with db_connection.async_session() as session:
            # Get pending employees older than 7 days
            result = await session.execute(
                select(Employee).where(
                    Employee.verification_status.in_([
                        VerificationStatus.PENDING_DETAILS_REVIEW,
                        VerificationStatus.PENDING_DOCUMENTS_REVIEW,
                        VerificationStatus.PENDING_ROLE_ASSIGNMENT,
                        VerificationStatus.PENDING_FINAL_APPROVAL
                    ]),
                    Employee.submitted_at < seven_days_ago
                )
            )
            overdue_employees = result.scalars().all()
        
        if not overdue_employees:
            return True
        
        admin_ids = await self._get_admin_user_ids()
        
        title = f"🚨 Urgent: {len(overdue_employees)} Overdue Reviews"
        message = f"""
        The following profiles have been pending review for more than 7 days:
        
        """
        
        for emp in overdue_employees[:5]:  # Show first 5
            days_pending = (datetime.utcnow() - emp.submitted_at).days
            message += f"• {emp.get_full_name()} ({days_pending} days)\n"
        
        if len(overdue_employees) > 5:
            message += f"... and {len(overdue_employees) - 5} more"
        
        message += "\n\nPlease prioritize these reviews."
        
        # Notify all admins
        for admin_id in admin_ids:
            await self._create_notification(
                user_id=admin_id,
                type="ACTION_REQUIRED",
                title=title,
                message=message.strip(),
                data={
                    "overdue_count": len(overdue_employees),
                    "action_type": "urgent_review",
                    "priority": "urgent"
                }
            )
        
        return True
    
    # Core Notification Methods
    
    async def _create_notification(
        self,
        user_id: UUID,
        type: str,
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None
    ) -> UUID:
        """Create an in-app notification."""
        
        async with db_connection.async_session() as session:
            notification_data = {
                "user_id": user_id,
                "type": type,
                "title": title,
                "message": message,
                "data": data or {},
                "created_at": datetime.now(datetime.timezone.utc())
            }
            
            result = await session.execute(
                insert(NotificationModel).values(notification_data).returning(NotificationModel.id)
            )
            notification_id = result.scalar()
            await session.commit()
            
            return notification_id
    
    async def _send_email(
        self,
        to_email: str,
        subject: str,
        template: str,
        context: Dict[str, Any]
    ) -> bool:
        """Send email notification using SMTP."""
        
        if not self.smtp_enabled:
            print(f"📧 Would send email to {to_email}: {subject}")
            return True
        
        try:
            # Get email template
            email_content = self._render_email_template(template, context)
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = settings.NOTIFICATION_EMAIL_FROM
            msg['To'] = to_email
            
            # Add HTML content
            html_part = MIMEText(email_content, 'html')
            msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
                if settings.MAIL_STARTTLS:
                    server.starttls()
                server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                server.send_message(msg)
            
            print(f"📧 Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to send email to {to_email}: {e}")
            return False
    
    def _render_email_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render email template with context."""
        
        templates = {
            "profile_submitted": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1E88E5;">Profile Submitted Successfully!</h2>
                <p>Hi {{ first_name }},</p>
                <p>Great news! Your employee profile has been submitted successfully and is now under review.</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>What happens next:</h3>
                    <ul>
                        <li>Our admin team will review your details</li>
                        <li>You'll receive updates as your profile progresses</li>
                        <li>The process typically takes 2-3 business days</li>
                    </ul>
                </div>
                
                <p>You can check your status anytime in your dashboard.</p>
                <p>Thank you for your patience!</p>
            </div>
            """,
            
            "stage_advanced": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #43A047;">Profile Update ✅</h2>
                <p>Hi {{ first_name }},</p>
                <p>{{ message }}</p>
                
                {% if notes %}
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>Admin Notes:</strong> {{ notes }}
                </div>
                {% endif %}
                
                <p>Keep up the great progress!</p>
            </div>
            """,
            
            "profile_approved": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #43A047;">🎉 Welcome to the Team!</h2>
                <p>Congratulations {{ first_name }}!</p>
                <p>Your employee profile has been fully verified and approved.</p>
                
                <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>What you can do now:</h3>
                    <ul>
                        <li>Access all system features</li>
                        <li>Connect with your team</li>
                        <li>Complete your onboarding tasks</li>
                        <li>Explore available resources</li>
                    </ul>
                </div>
                
                <p>Welcome aboard! We're excited to have you join us.</p>
            </div>
            """,
            
            "profile_rejected": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #FB8C00;">Profile Update Required</h2>
                <p>Hi {{ first_name }},</p>
                <p>We need some updates to your profile before we can proceed.</p>
                
                <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <strong>Feedback from our review team:</strong>
                    <p>{{ reason }}</p>
                </div>
                
                <h3>What to do next:</h3>
                <ul>
                    <li>Review the feedback above</li>
                    <li>Update your profile information</li>
                    <li>Resubmit when ready</li>
                </ul>
                
                <p>Don't worry - this is a normal part of the process. We're here to help!</p>
            </div>
            """
        }
        
        template_str = templates.get(template_name, "<p>{{ message }}</p>")
        template = Template(template_str)
        return template.render(**context)
    
    async def _get_admin_user_ids(self) -> List[UUID]:
        """Get all admin user IDs."""
        # This would integrate with the role system
        # For now, return empty list - implement based on your role repository
        return []
    
    # Public API Methods
    
    async def get_user_notifications(
        self, 
        user_id: UUID, 
        limit: int = 50,
        unread_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Get notifications for a user."""
        
        async with db_connection.async_session() as session:
            query = select(NotificationModel).where(NotificationModel.user_id == user_id)
            
            if unread_only:
                query = query.where(NotificationModel.read_at.is_(None))
            
            query = query.order_by(NotificationModel.created_at.desc()).limit(limit)
            
            result = await session.execute(query)
            notifications = result.scalars().all()
            
            return [
                {
                    "id": notif.id,
                    "type": notif.type,
                    "title": notif.title,
                    "message": notif.message,
                    "data": notif.data,
                    "read_at": notif.read_at,
                    "created_at": notif.created_at,
                    "is_read": notif.read_at is not None
                }
                for notif in notifications
            ]
    
    async def mark_notification_read(self, notification_id: UUID, user_id: UUID) -> bool:
        """Mark a notification as read."""
        
        async with db_connection.async_session() as session:
            result = await session.execute(
                update(NotificationModel)
                .where(
                    NotificationModel.id == notification_id,
                    NotificationModel.user_id == user_id
                )
                .values(read_at=datetime.now(datetime.timezone.utc()))
            )
            await session.commit()
            
            return result.rowcount > 0
    
    async def mark_all_notifications_read(self, user_id: UUID) -> int:
        """Mark all notifications as read for a user."""
        
        async with db_connection.async_session() as session:
            result = await session.execute(
                update(NotificationModel)
                .where(
                    NotificationModel.user_id == user_id,
                    NotificationModel.read_at.is_(None)
                )
                .values(read_at=datetime.utcnow())
            )
            await session.commit()
            
            return result.rowcount
    
    async def get_unread_count(self, user_id: UUID) -> int:
        """Get count of unread notifications for a user."""
        
        async with db_connection.async_session() as session:
            result = await session.execute(
                select(func.count(NotificationModel.id))
                .where(
                    NotificationModel.user_id == user_id,
                    NotificationModel.read_at.is_(None)
                )
            )
            
            return result.scalar() or 0


# Notification task runner for background jobs
class NotificationTaskRunner:
    """Background task runner for periodic notifications."""
    
    def __init__(self, notification_service: NotificationService):
        self.notification_service = notification_service
    
    async def run_daily_tasks(self):
        """Run daily notification tasks."""
        
        print("🔔 Running daily notification tasks...")
        
        try:
            # Send urgent review notifications
            await self.notification_service.notify_urgent_reviews()
            print("✅ Sent urgent review notifications")
            
        except Exception as e:
            print(f"❌ Daily notification tasks failed: {e}")