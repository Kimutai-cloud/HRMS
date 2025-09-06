from typing import Dict, List, Optional, Any
from uuid import UUID
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from pathlib import Path
import json
import aiofiles

from app.infrastructure.external.email_service_enhanced import (
    enhanced_email_service,
    EmailTemplate,
    EmailDeliveryResult
)
from app.core.entities.employee import Employee
from app.core.entities.document import EmployeeDocument


@dataclass
class EmailContext:
    """Context for email template rendering."""
    employee: Optional[Employee] = None
    document: Optional[EmployeeDocument] = None
    admin_user: Optional[Dict[str, Any]] = None
    custom_data: Dict[str, Any] = field(default_factory=dict)
    base_url: str = "https://hrms.company.com"


class EmailTemplateService:
    """Service for managing email templates and sending templated emails."""
    
    def __init__(self):
        self.enhanced_email_service = enhanced_email_service
        self._setup_hrms_templates()
    
    def _setup_hrms_templates(self):
        """Setup HRMS-specific email templates."""
        
        # Profile rejection template
        rejection_template = EmailTemplate(
            name="profile_rejected",
            subject_template="Profile Update Required - {{ employee_name }}",
            html_template="""
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                <div style="background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">Profile Update Required</h1>
                </div>
                <div style="padding: 30px; background: white; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{ first_name }},</p>
                    <p style="color: #555; line-height: 1.6;">We need some updates to your profile before we can proceed with the verification process.</p>
                    
                    <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #FF9800;">
                        <h3 style="color: #E65100; margin: 0 0 15px 0;">Feedback from our review team:</h3>
                        <div style="background: white; padding: 15px; border-radius: 6px; color: #555; line-height: 1.6;">
                            {{ rejection_reason }}
                        </div>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196F3;">
                        <h3 style="color: #1976D2; margin: 0 0 15px 0;">What to do next:</h3>
                        <ol style="color: #555; line-height: 1.8; padding-left: 20px;">
                            <li>Review the feedback above carefully</li>
                            <li>Update your profile information as needed</li>
                            <li>Resubmit your profile when ready</li>
                            <li>Contact support if you need assistance</li>
                        </ol>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <strong style="color: #333;">Current Status:</strong><br>
                        <span style="color: #666;">Stage: {{ stage }}</span><br>
                        <span style="color: #666;">Action Required: Profile Update</span><br>
                        <span style="color: #666;">Updated: {{ updated_at }}</span>
                    </div>
                    
                    <p style="color: #555; line-height: 1.6;">Don't worry - this is a normal part of the process. We're here to help you succeed!</p>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="{{ dashboard_url }}" style="background: #FF9800; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">Update Profile</a>
                        <a href="{{ support_url }}" style="background: #2196F3; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block;">Get Support</a>
                    </div>
                </div>
            </div>
            """,
            required_variables=["first_name", "rejection_reason", "stage", "updated_at"],
            default_variables={"dashboard_url": "/dashboard", "support_url": "/support"}
        )
        
        # Document rejected template
        document_rejected_template = EmailTemplate(
            name="document_rejected",
            subject_template="Document Update Required: {{ document_name }}",
            html_template="""
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                <div style="background: linear-gradient(135deg, #F44336 0%, #D32F2F 100%); padding: 25px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 22px;">Document Update Required</h1>
                </div>
                <div style="padding: 30px; background: white; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{ first_name }},</p>
                    <p style="color: #555; line-height: 1.6;">We need you to update your {{ document_name }} before we can continue with your profile verification.</p>
                    
                    <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #F44336;">
                        <h3 style="color: #C62828; margin: 0 0 15px 0;">Document Details:</h3>
                        <p style="color: #555; margin: 5px 0;"><strong>File:</strong> {{ file_name }}</p>
                        <p style="color: #555; margin: 5px 0;"><strong>Type:</strong> {{ document_type }}</p>
                        <p style="color: #555; margin: 5px 0;"><strong>Status:</strong> ❌ Requires Update</p>
                        <p style="color: #555; margin: 5px 0;"><strong>Reviewed:</strong> {{ reviewed_at }}</p>
                    </div>
                    
                    <div style="background: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 3px solid #FF9800;">
                        <strong style="color: #E65100;">Reason for rejection:</strong><br>
                        <span style="color: #555;">{{ rejection_reason }}</span>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196F3;">
                        <h3 style="color: #1976D2; margin: 0 0 15px 0;">Next Steps:</h3>
                        <ul style="color: #555; line-height: 1.8; padding-left: 20px;">
                            <li>Review the feedback above</li>
                            <li>Prepare an updated document that addresses the concerns</li>
                            <li>Upload the new document to replace the current one</li>
                            <li>Wait for the new document to be reviewed</li>
                        </ul>
                    </div>
                    
                    <p style="color: #555; line-height: 1.6;">Please upload a new version when ready. Our team will review it as quickly as possible.</p>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="{{ upload_url }}" style="background: #F44336; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block;">Upload New Document</a>
                    </div>
                </div>
            </div>
            """,
            required_variables=["first_name", "document_name", "file_name", "document_type", "reviewed_at", "rejection_reason"],
            default_variables={"upload_url": "/documents/upload"}
        )
        
        # Admin notification template
        admin_notification_template = EmailTemplate(
            name="admin_new_submission",
            subject_template="New Profile Submission - {{ employee_name }} ({{ department }})",
            html_template="""
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #f8f9fa;">
                <div style="background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%); padding: 25px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 22px;">New Profile Submission</h1>
                    <p style="color: #bbdefb; margin: 10px 0 0 0;">Action Required - Details Review</p>
                </div>
                <div style="padding: 30px; background: white; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">New employee profile submitted for review:</p>
                    
                    <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #1976D2;">
                        <h3 style="color: #1976D2; margin: 0 0 15px 0;">Employee Information:</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <strong style="color: #333;">Name:</strong><br>
                                <span style="color: #555;">{{ first_name }} {{ last_name }}</span>
                            </div>
                            <div>
                                <strong style="color: #333;">Email:</strong><br>
                                <span style="color: #555;">{{ email }}</span>
                            </div>
                            <div>
                                <strong style="color: #333;">Department:</strong><br>
                                <span style="color: #555;">{{ department }}</span>
                            </div>
                            <div>
                                <strong style="color: #333;">Position:</strong><br>
                                <span style="color: #555;">{{ title }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 3px solid #FF9800;">
                        <strong style="color: #E65100;">Priority:</strong> {{ priority }}<br>
                        <strong style="color: #E65100;">Submitted:</strong> {{ submitted_at }}<br>
                        <strong style="color: #E65100;">Days Pending:</strong> {{ days_pending }} days
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <h3 style="color: #333; margin: 0 0 15px 0;">Action Required:</h3>
                        <ul style="color: #555; line-height: 1.8; padding-left: 20px;">
                            <li>Review employee profile details</li>
                            <li>Verify provided information</li>
                            <li>Approve or request updates as needed</li>
                            <li>Process within SLA timeframe (2-3 business days)</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="{{ review_url }}" style="background: #1976D2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; margin-right: 10px;">Review Profile</a>
                        <a href="{{ admin_dashboard_url }}" style="background: #43A047; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px;">Admin Dashboard</a>
                    </div>
                </div>
            </div>
            """,
            required_variables=["first_name", "last_name", "email", "department", "title", "submitted_at", "days_pending"],
            default_variables={"priority": "Normal", "review_url": "/admin/reviews", "admin_dashboard_url": "/admin/dashboard"}
        )
        
        # Bulk operation summary template
        bulk_summary_template = EmailTemplate(
            name="bulk_operation_summary",
            subject_template="Bulk Operation Complete - {{ operation_type }}",
            html_template="""
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                <div style="background: linear-gradient(135deg, #43A047 0%, #388E3C 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">Bulk Operation Complete</h1>
                    <p style="color: #c8e6c9; margin: 10px 0 0 0;">{{ operation_type }}</p>
                </div>
                <div style="padding: 30px; background: white; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hello Admin,</p>
                    <p style="color: #555; line-height: 1.6;">Your bulk operation has been completed. Here's a summary of the results:</p>
                    
                    <div style="background: #e8f5e8; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #43A047;">
                        <h3 style="color: #2E7D32; margin: 0 0 20px 0;">Operation Results:</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                <div style="font-size: 24px; font-weight: bold; color: #43A047;">{{ successful_count }}</div>
                                <div style="color: #666; font-size: 14px;">Successful</div>
                            </div>
                            <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
                                <div style="font-size: 24px; font-weight: bold; color: #F44336;">{{ failed_count }}</div>
                                <div style="color: #666; font-size: 14px;">Failed</div>
                            </div>
                        </div>
                        <div style="margin-top: 15px; padding: 10px; background: white; border-radius: 6px; text-align: center;">
                            <strong style="color: #333;">Total Processed: {{ total_count }}</strong>
                        </div>
                    </div>
                    
                    {% if operation_details %}
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <h3 style="color: #333; margin: 0 0 15px 0;">Operation Details:</h3>
                        <ul style="color: #555; line-height: 1.6; padding-left: 20px;">
                            {% for detail in operation_details %}
                            <li>{{ detail }}</li>
                            {% endfor %}
                        </ul>
                    </div>
                    {% endif %}
                    
                    <div style="background: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 3px solid #FF9800;">
                        <strong style="color: #E65100;">Operation Info:</strong><br>
                        <span style="color: #555;">Performed by: {{ performed_by }}</span><br>
                        <span style="color: #555;">Completed: {{ completed_at }}</span><br>
                        <span style="color: #555;">Duration: {{ duration }}</span>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="{{ admin_dashboard_url }}" style="background: #43A047; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dashboard</a>
                    </div>
                </div>
            </div>
            """,
            required_variables=["operation_type", "successful_count", "failed_count", "total_count", "performed_by", "completed_at"],
            default_variables={"duration": "< 1 minute", "admin_dashboard_url": "/admin/dashboard"}
        )
        
        # Register all templates
        self.enhanced_email_service.register_template(rejection_template)
        self.enhanced_email_service.register_template(document_rejected_template)
        self.enhanced_email_service.register_template(admin_notification_template)
        self.enhanced_email_service.register_template(bulk_summary_template)
    
    async def send_profile_submission_email(self, employee: Employee) -> EmailDeliveryResult:
        """Send profile submission confirmation email."""
        
        variables = {
            "first_name": employee.first_name,
            "employee_name": employee.get_full_name(),
            "submitted_at": employee.submitted_at.strftime("%B %d, %Y at %I:%M %p") if employee.submitted_at else "Just now",
            "department": employee.department,
            "dashboard_url": f"/dashboard?employee_id={employee.id}"
        }
        
        return await self.enhanced_email_service.send_template_email(
            to_email=employee.email,
            template_name="profile_submitted",
            template_variables=variables,
            priority="normal"
        )
    
    async def send_stage_advancement_email(
        self, 
        employee: Employee, 
        from_stage: str, 
        to_stage: str,
        notes: Optional[str] = None
    ) -> EmailDeliveryResult:
        """Send stage advancement notification email."""
        
        stage_progress = {
            "PENDING_DETAILS_REVIEW": 20,
            "PENDING_DOCUMENTS_REVIEW": 40,
            "PENDING_ROLE_ASSIGNMENT": 60,
            "PENDING_FINAL_APPROVAL": 80,
            "VERIFIED": 100
        }
        
        stage_names = {
            "DETAILS_REVIEW": "Profile Details Review",
            "DOCUMENTS_REVIEW": "Document Review",
            "ROLE_ASSIGNMENT": "Role Assignment",
            "FINAL_APPROVAL": "Final Approval"
        }
        
        advancement_messages = {
            "DETAILS_REVIEW_TO_DOCUMENTS": "Excellent! Your profile details have been approved. Next step: document upload.",
            "DOCUMENTS_REVIEW_TO_ROLE": "Great news! All your documents have been approved. Role assignment is in progress.",
            "ROLE_ASSIGNMENT_TO_FINAL": "Your role has been assigned and we're conducting the final review.",
            "FINAL_APPROVAL_TO_VERIFIED": "🎉 Congratulations! Your profile has been fully verified and approved."
        }
        
        stage_key = f"{from_stage}_TO_{to_stage.split('_')[1]}" if "_" in to_stage else f"{from_stage}_TO_{to_stage}"
        
        variables = {
            "first_name": employee.first_name,
            "stage_name": stage_names.get(from_stage, from_stage),
            "advancement_message": advancement_messages.get(stage_key, f"Your profile has been advanced to {to_stage}"),
            "progress_percentage": stage_progress.get(to_stage, 0),
            "to_stage": to_stage,
            "updated_at": datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p"),
            "notes": notes,
            "dashboard_url": f"/dashboard?employee_id={employee.id}"
        }
        
        return await self.enhanced_email_service.send_template_email(
            to_email=employee.email,
            template_name="stage_advanced",
            template_variables=variables,
            priority="normal"
        )
    
    async def send_profile_approved_email(self, employee: Employee) -> EmailDeliveryResult:
        """Send profile approved (welcome) email."""
        
        variables = {
            "first_name": employee.first_name,
            "last_name": employee.last_name,
            "department": employee.department,
            "hired_at": employee.hired_at.strftime("%B %d, %Y") if employee.hired_at else "Today",
            "dashboard_url": f"/dashboard?employee_id={employee.id}",
            "onboarding_url": f"/onboarding?employee_id={employee.id}"
        }
        
        return await self.enhanced_email_service.send_template_email(
            to_email=employee.email,
            template_name="profile_approved",
            template_variables=variables,
            priority="high"
        )
    
    async def send_profile_rejection_email(
        self, 
        employee: Employee, 
        reason: str, 
        stage: str
    ) -> EmailDeliveryResult:
        """Send profile rejection email."""
        
        variables = {
            "first_name": employee.first_name,
            "employee_name": employee.get_full_name(),
            "rejection_reason": reason,
            "stage": stage,
            "updated_at": datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p"),
            "dashboard_url": f"/dashboard?employee_id={employee.id}",
            "support_url": "/support"
        }
        
        return await self.enhanced_email_service.send_template_email(
            to_email=employee.email,
            template_name="profile_rejected",
            template_variables=variables,
            priority="high"
        )
    
    async def send_document_approved_email(
        self, 
        employee: Employee, 
        document: EmployeeDocument,
        reviewer_notes: Optional[str] = None
    ) -> EmailDeliveryResult:
        """Send document approved email."""
        
        variables = {
            "first_name": employee.first_name,
            "document_name": document.get_display_name(),
            "file_name": document.file_name,
            "document_type": document.document_type.value,
            "reviewed_at": document.reviewed_at.strftime("%B %d, %Y at %I:%M %p") if document.reviewed_at else "Just now",
            "reviewer_notes": reviewer_notes
        }
        
        return await self.enhanced_email_service.send_template_email(
            to_email=employee.email,
            template_name="document_approved",
            template_variables=variables,
            priority="normal"
        )
    
    async def send_document_rejection_email(
        self, 
        employee: Employee, 
        document: EmployeeDocument,
        reason: str
    ) -> EmailDeliveryResult:
        """Send document rejection email."""
        
        variables = {
            "first_name": employee.first_name,
            "document_name": document.get_display_name(),
            "file_name": document.file_name,
            "document_type": document.document_type.value,
            "reviewed_at": document.reviewed_at.strftime("%B %d, %Y at %I:%M %p") if document.reviewed_at else "Just now",
            "rejection_reason": reason,
            "upload_url": f"/documents/upload?employee_id={employee.id}&replace={document.id}"
        }
        
        return await self.enhanced_email_service.send_template_email(
            to_email=employee.email,
            template_name="document_rejected",
            template_variables=variables,
            priority="high"
        )
    
    async def send_admin_new_submission_email(
        self, 
        admin_email: str, 
        employee: Employee,
        days_pending: int = 0
    ) -> EmailDeliveryResult:
        """Send new submission alert to admin."""
        
        variables = {
            "first_name": employee.first_name,
            "last_name": employee.last_name,
            "email": employee.email,
            "department": employee.department,
            "title": employee.title or "Not specified",
            "submitted_at": employee.submitted_at.strftime("%B %d, %Y at %I:%M %p") if employee.submitted_at else "Just now",
            "days_pending": days_pending,
            "priority": "High" if days_pending > 3 else "Normal",
            "review_url": f"/admin/reviews/details/{employee.id}",
            "admin_dashboard_url": "/admin/dashboard"
        }
        
        return await self.enhanced_email_service.send_template_email(
            to_email=admin_email,
            template_name="admin_new_submission",
            template_variables=variables,
            priority="normal"
        )
    
    async def send_bulk_operation_summary_email(
        self,
        admin_email: str,
        operation_type: str,
        successful_count: int,
        failed_count: int,
        performed_by: str,
        operation_details: Optional[List[str]] = None
    ) -> EmailDeliveryResult:
        """Send bulk operation summary email to admin."""
        
        variables = {
            "operation_type": operation_type,
            "successful_count": successful_count,
            "failed_count": failed_count,
            "total_count": successful_count + failed_count,
            "performed_by": performed_by,
            "completed_at": datetime.now(timezone.utc).strftime("%B %d, %Y at %I:%M %p"),
            "operation_details": operation_details or [],
            "admin_dashboard_url": "/admin/dashboard"
        }
        
        return await self.enhanced_email_service.send_template_email(
            to_email=admin_email,
            template_name="bulk_operation_summary",
            template_variables=variables,
            priority="normal"
        )
    
    async def get_delivery_statistics(self, days: int = 30) -> Dict[str, Any]:
        """Get email delivery statistics for the last N days."""
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        end_date = datetime.now(timezone.utc)
        
        return await self.enhanced_email_service.get_delivery_statistics(start_date, end_date)
    
    def get_available_templates(self) -> List[str]:
        """Get list of available email templates."""
        return self.enhanced_email_service.get_available_templates()


# Global email template service instance
email_template_service = EmailTemplateService()