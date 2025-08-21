from typing import Dict, List, Optional, Any, Union
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import smtplib
import aiofiles
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from jinja2 import Environment, FileSystemLoader, Template
from dataclasses import dataclass, field
import json
from pathlib import Path

from app.config.settings import settings
from app.infrastructure.database.connections import db_connection
from sqlalchemy import insert, select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession


class EmailProvider(Enum):
    """Supported email service providers."""
    SMTP = "smtp"
    SENDGRID = "sendgrid"
    AWS_SES = "aws_ses"
    MAILGUN = "mailgun"


class EmailStatus(Enum):
    """Email delivery status."""
    PENDING = "pending"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    BOUNCED = "bounced"
    FAILED = "failed"
    COMPLAINED = "complained"


@dataclass
class EmailDeliveryResult:
    """Result of email delivery attempt."""
    success: bool
    message_id: Optional[str] = None
    provider: Optional[EmailProvider] = None
    error_message: Optional[str] = None
    status: EmailStatus = EmailStatus.PENDING
    sent_at: Optional[datetime] = None


@dataclass
class EmailTemplate:
    """Email template configuration."""
    name: str
    subject_template: str
    html_template: str
    text_template: Optional[str] = None
    required_variables: List[str] = field(default_factory=list)
    default_variables: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EmailMessage:
    """Email message structure."""
    id: UUID
    to_email: str
    subject: str
    html_content: str
    text_content: Optional[str] = None
    from_email: Optional[str] = None
    reply_to: Optional[str] = None
    attachments: List[Dict[str, Any]] = field(default_factory=list)
    template_name: Optional[str] = None
    template_variables: Dict[str, Any] = field(default_factory=dict)
    priority: str = "normal"
    scheduled_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


class EnhancedEmailService:
    """Advanced email service with template support, delivery tracking, and multiple provider support."""
    
    def __init__(self):
        self.providers = self._initialize_providers()
        self.primary_provider = EmailProvider.SMTP
        self.template_env = self._setup_template_environment()
        self.templates: Dict[str, EmailTemplate] = {}
        self._load_templates()
        
    def _initialize_providers(self) -> Dict[EmailProvider, Dict[str, Any]]:
        """Initialize email service providers."""
        return {
            EmailProvider.SMTP: {
                "enabled": bool(getattr(settings, 'MAIL_SERVER', None)),
                "config": {
                    "server": getattr(settings, 'MAIL_SERVER', ''),
                    "port": getattr(settings, 'MAIL_PORT', 587),
                    "username": getattr(settings, 'MAIL_USERNAME', ''),
                    "password": getattr(settings, 'MAIL_PASSWORD', ''),
                    "use_tls": getattr(settings, 'MAIL_STARTTLS', True),
                    "from_email": getattr(settings, 'NOTIFICATION_EMAIL_FROM', '')
                }
            },
            EmailProvider.SENDGRID: {
                "enabled": bool(getattr(settings, 'SENDGRID_API_KEY', None)),
                "config": {
                    "api_key": getattr(settings, 'SENDGRID_API_KEY', ''),
                    "from_email": getattr(settings, 'SENDGRID_FROM_EMAIL', '')
                }
            },
            EmailProvider.AWS_SES: {
                "enabled": bool(getattr(settings, 'AWS_SES_ACCESS_KEY', None)),
                "config": {
                    "access_key": getattr(settings, 'AWS_SES_ACCESS_KEY', ''),
                    "secret_key": getattr(settings, 'AWS_SES_SECRET_KEY', ''),
                    "region": getattr(settings, 'AWS_SES_REGION', 'us-east-1'),
                    "from_email": getattr(settings, 'AWS_SES_FROM_EMAIL', '')
                }
            }
        }
    
    def _setup_template_environment(self) -> Environment:
        """Setup Jinja2 template environment."""
        template_dir = Path(__file__).parent.parent.parent / "templates" / "email"
        template_dir.mkdir(parents=True, exist_ok=True)
        
        return Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=True
        )
    
    def _load_templates(self):
        """Load email templates."""
        self.templates = {
            "profile_submitted": EmailTemplate(
                name="profile_submitted",
                subject_template="Profile Submitted Successfully - {{ employee_name }}",
                html_template="""
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                    <div style="background: linear-gradient(135deg, #1E88E5 0%, #1976D2 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Profile Submitted Successfully!</h1>
                    </div>
                    <div style="padding: 30px; background: white; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{ first_name }},</p>
                        <p style="color: #555; line-height: 1.6;">Great news! Your employee profile has been submitted successfully and is now under review.</p>
                        
                        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #1976D2;">
                            <h3 style="color: #1976D2; margin: 0 0 15px 0; font-size: 18px;">What happens next:</h3>
                            <ul style="color: #555; line-height: 1.8; padding-left: 20px;">
                                <li>Our admin team will review your details within 2-3 business days</li>
                                <li>You'll receive real-time updates as your profile progresses</li>
                                <li>Check your dashboard anytime for current status</li>
                            </ul>
                        </div>
                        
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <strong style="color: #333;">Submission Details:</strong><br>
                            <span style="color: #666;">Submitted: {{ submitted_at }}</span><br>
                            <span style="color: #666;">Department: {{ department }}</span><br>
                            <span style="color: #666;">Status: Under Review</span>
                        </div>
                        
                        <p style="color: #555; line-height: 1.6;">Thank you for your patience during the review process!</p>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="{{ dashboard_url }}" style="background: #1976D2; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dashboard</a>
                        </div>
                    </div>
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
                        <p>This is an automated message from the HRMS system.</p>
                    </div>
                </div>
                """,
                required_variables=["first_name", "submitted_at", "department"],
                default_variables={"dashboard_url": "/dashboard"}
            ),
            
            "stage_advanced": EmailTemplate(
                name="stage_advanced",
                subject_template="Profile Update - {{ stage_name }} Complete ✅",
                html_template="""
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                    <div style="background: linear-gradient(135deg, #43A047 0%, #388E3C 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">{{ stage_name }} Complete ✅</h1>
                    </div>
                    <div style="padding: 30px; background: white; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{ first_name }},</p>
                        <p style="color: #555; line-height: 1.6;">{{ advancement_message }}</p>
                        
                        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #43A047;">
                            <h3 style="color: #2E7D32; margin: 0 0 15px 0;">Progress Update:</h3>
                            <div style="background: #fff; border-radius: 10px; overflow: hidden; margin: 10px 0;">
                                <div style="background: #43A047; height: 8px; width: {{ progress_percentage }}%; transition: width 0.3s ease;"></div>
                            </div>
                            <p style="color: #555; margin: 10px 0 0 0; font-size: 14px;">{{ progress_percentage }}% Complete</p>
                        </div>
                        
                        {% if notes %}
                        <div style="background: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 3px solid #FF9800;">
                            <strong style="color: #E65100;">Admin Notes:</strong><br>
                            <span style="color: #555;">{{ notes }}</span>
                        </div>
                        {% endif %}
                        
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <strong style="color: #333;">Current Status:</strong><br>
                            <span style="color: #666;">Stage: {{ to_stage }}</span><br>
                            <span style="color: #666;">Updated: {{ updated_at }}</span>
                        </div>
                        
                        <p style="color: #555; line-height: 1.6;">Keep up the great progress! We'll notify you as soon as the next stage is complete.</p>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="{{ dashboard_url }}" style="background: #43A047; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; display: inline-block;">View Progress</a>
                        </div>
                    </div>
                </div>
                """,
                required_variables=["first_name", "stage_name", "advancement_message", "progress_percentage", "to_stage", "updated_at"],
                default_variables={"dashboard_url": "/dashboard"}
            ),
            
            "profile_approved": EmailTemplate(
                name="profile_approved",
                subject_template="🎉 Welcome to the Team, {{ first_name }}!",
                html_template="""
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                    <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 40px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to the Team!</h1>
                        <p style="color: #e8f5e9; margin: 10px 0 0 0; font-size: 16px;">Your profile has been fully approved</p>
                    </div>
                    <div style="padding: 40px; background: white; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <p style="font-size: 18px; color: #333; margin-bottom: 20px;">Congratulations {{ first_name }}!</p>
                        <p style="color: #555; line-height: 1.6; font-size: 16px;">Your employee profile has been fully verified and approved. Welcome aboard!</p>
                        
                        <div style="background: #e8f5e8; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #4CAF50;">
                            <h3 style="color: #2E7D32; margin: 0 0 20px 0; font-size: 20px;">What you can do now:</h3>
                            <ul style="color: #555; line-height: 2; padding-left: 20px; font-size: 15px;">
                                <li>Access all system features and tools</li>
                                <li>Connect with your team and colleagues</li>
                                <li>Complete your onboarding tasks</li>
                                <li>Explore available resources and training</li>
                                <li>Set up your workspace preferences</li>
                            </ul>
                        </div>
                        
                        <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2196F3;">
                            <h4 style="color: #1976D2; margin: 0 0 15px 0;">Next Steps:</h4>
                            <ol style="color: #555; line-height: 1.8; padding-left: 20px;">
                                <li>Log into your dashboard to access your workspace</li>
                                <li>Complete your profile setup if needed</li>
                                <li>Check your assigned onboarding tasks</li>
                                <li>Meet with your manager to discuss your role</li>
                            </ol>
                        </div>
                        
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 25px 0;">
                            <strong style="color: #333;">Employee Details:</strong><br>
                            <span style="color: #666;">Name: {{ first_name }} {{ last_name }}</span><br>
                            <span style="color: #666;">Department: {{ department }}</span><br>
                            <span style="color: #666;">Start Date: {{ hired_at }}</span><br>
                            <span style="color: #666;">Status: ✅ Fully Verified</span>
                        </div>
                        
                        <p style="color: #555; line-height: 1.6; font-size: 16px; margin-top: 30px;">We're excited to have you join us and look forward to working with you!</p>
                        
                        <div style="text-align: center; margin-top: 40px;">
                            <a href="{{ dashboard_url }}" style="background: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; margin-right: 10px;">Access Dashboard</a>
                            <a href="{{ onboarding_url }}" style="background: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px;">Start Onboarding</a>
                        </div>
                    </div>
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
                        <p>Welcome to the team! 🚀</p>
                    </div>
                </div>
                """,
                required_variables=["first_name", "last_name", "department", "hired_at"],
                default_variables={"dashboard_url": "/dashboard", "onboarding_url": "/onboarding"}
            ),
            
            "document_approved": EmailTemplate(
                name="document_approved",
                subject_template="Document Approved: {{ document_name }}",
                html_template="""
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                    <div style="background: linear-gradient(135deg, #43A047 0%, #388E3C 100%); padding: 25px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 22px;">Document Approved ✅</h1>
                    </div>
                    <div style="padding: 30px; background: white; margin: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi {{ first_name }},</p>
                        <p style="color: #555; line-height: 1.6;">Great news! Your {{ document_name }} has been approved by our review team.</p>
                        
                        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #43A047;">
                            <h3 style="color: #2E7D32; margin: 0 0 15px 0;">Document Details:</h3>
                            <p style="color: #555; margin: 5px 0;"><strong>File:</strong> {{ file_name }}</p>
                            <p style="color: #555; margin: 5px 0;"><strong>Type:</strong> {{ document_type }}</p>
                            <p style="color: #555; margin: 5px 0;"><strong>Status:</strong> ✅ Approved</p>
                            <p style="color: #555; margin: 5px 0;"><strong>Reviewed:</strong> {{ reviewed_at }}</p>
                        </div>
                        
                        {% if reviewer_notes %}
                        <div style="background: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 3px solid #FF9800;">
                            <strong style="color: #E65100;">Reviewer Notes:</strong><br>
                            <span style="color: #555;">{{ reviewer_notes }}</span>
                        </div>
                        {% endif %}
                        
                        <p style="color: #555; line-height: 1.6;">This document is now part of your verified profile. Thank you for providing the required documentation!</p>
                    </div>
                </div>
                """,
                required_variables=["first_name", "document_name", "file_name", "document_type", "reviewed_at"],
                default_variables={}
            )
        }
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        template_name: Optional[str] = None,
        template_variables: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        priority: str = "normal",
        scheduled_at: Optional[datetime] = None
    ) -> EmailDeliveryResult:
        """Send email with delivery tracking."""
        
        message = EmailMessage(
            id=uuid4(),
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            template_name=template_name,
            template_variables=template_variables or {},
            attachments=attachments or [],
            priority=priority,
            scheduled_at=scheduled_at
        )
        
        # Store email for tracking
        await self._store_email_record(message, EmailStatus.PENDING)
        
        # Send immediately if not scheduled
        if scheduled_at is None or scheduled_at <= datetime.utcnow():
            return await self._send_email_now(message)
        else:
            print(f"📧 Email scheduled for {scheduled_at}: {subject}")
            return EmailDeliveryResult(success=True, status=EmailStatus.PENDING)
    
    async def send_template_email(
        self,
        to_email: str,
        template_name: str,
        template_variables: Dict[str, Any],
        priority: str = "normal",
        scheduled_at: Optional[datetime] = None
    ) -> EmailDeliveryResult:
        """Send email using template."""
        
        if template_name not in self.templates:
            return EmailDeliveryResult(
                success=False,
                error_message=f"Template '{template_name}' not found",
                status=EmailStatus.FAILED
            )
        
        template = self.templates[template_name]
        
        # Validate required variables
        missing_vars = [var for var in template.required_variables if var not in template_variables]
        if missing_vars:
            return EmailDeliveryResult(
                success=False,
                error_message=f"Missing required variables: {', '.join(missing_vars)}",
                status=EmailStatus.FAILED
            )
        
        # Merge with default variables
        merged_variables = {**template.default_variables, **template_variables}
        
        # Render templates
        try:
            subject = Template(template.subject_template).render(**merged_variables)
            html_content = Template(template.html_template).render(**merged_variables)
            text_content = Template(template.text_template).render(**merged_variables) if template.text_template else None
            
        except Exception as e:
            return EmailDeliveryResult(
                success=False,
                error_message=f"Template rendering failed: {str(e)}",
                status=EmailStatus.FAILED
            )
        
        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            template_name=template_name,
            template_variables=merged_variables,
            priority=priority,
            scheduled_at=scheduled_at
        )
    
    async def _send_email_now(self, message: EmailMessage) -> EmailDeliveryResult:
        """Send email immediately with failover support."""
        
        await self._update_email_status(message.id, EmailStatus.SENDING)
        
        # Try primary provider first
        for provider in [self.primary_provider] + [p for p in EmailProvider if p != self.primary_provider]:
            if not self.providers[provider]["enabled"]:
                continue
                
            try:
                result = await self._send_with_provider(message, provider)
                if result.success:
                    await self._update_email_status(message.id, EmailStatus.SENT, result.message_id)
                    print(f"✅ Email sent via {provider.value}: {message.subject}")
                    return result
                    
            except Exception as e:
                print(f"❌ Failed to send via {provider.value}: {e}")
                continue
        
        # All providers failed
        await self._update_email_status(message.id, EmailStatus.FAILED, error_message="All providers failed")
        return EmailDeliveryResult(
            success=False,
            error_message="All email providers failed",
            status=EmailStatus.FAILED
        )
    
    async def _send_with_provider(self, message: EmailMessage, provider: EmailProvider) -> EmailDeliveryResult:
        """Send email with specific provider."""
        
        if provider == EmailProvider.SMTP:
            return await self._send_with_smtp(message)
        elif provider == EmailProvider.SENDGRID:
            return await self._send_with_sendgrid(message)
        elif provider == EmailProvider.AWS_SES:
            return await self._send_with_aws_ses(message)
        else:
            return EmailDeliveryResult(
                success=False,
                error_message=f"Provider {provider.value} not implemented",
                status=EmailStatus.FAILED
            )
    
    async def _send_with_smtp(self, message: EmailMessage) -> EmailDeliveryResult:
        """Send email via SMTP."""
        
        config = self.providers[EmailProvider.SMTP]["config"]
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = message.subject
            msg['From'] = message.from_email or config["from_email"]
            msg['To'] = message.to_email
            
            # Add text and HTML parts
            if message.text_content:
                text_part = MIMEText(message.text_content, 'plain', 'utf-8')
                msg.attach(text_part)
            
            html_part = MIMEText(message.html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Add attachments
            for attachment in message.attachments:
                await self._add_attachment(msg, attachment)
            
            # Send email
            with smtplib.SMTP(config["server"], config["port"]) as server:
                if config["use_tls"]:
                    server.starttls()
                server.login(config["username"], config["password"])
                server.send_message(msg)
            
            return EmailDeliveryResult(
                success=True,
                message_id=str(message.id),
                provider=EmailProvider.SMTP,
                status=EmailStatus.SENT,
                sent_at=datetime.utcnow()
            )
            
        except Exception as e:
            return EmailDeliveryResult(
                success=False,
                provider=EmailProvider.SMTP,
                error_message=str(e),
                status=EmailStatus.FAILED
            )
    
    async def _send_with_sendgrid(self, message: EmailMessage) -> EmailDeliveryResult:
        """Send email via SendGrid (placeholder - requires sendgrid library)."""
        # This would integrate with SendGrid's Python library
        return EmailDeliveryResult(
            success=False,
            error_message="SendGrid integration not implemented",
            status=EmailStatus.FAILED
        )
    
    async def _send_with_aws_ses(self, message: EmailMessage) -> EmailDeliveryResult:
        """Send email via AWS SES (placeholder - requires boto3 library)."""
        # This would integrate with AWS SES via boto3
        return EmailDeliveryResult(
            success=False,
            error_message="AWS SES integration not implemented",
            status=EmailStatus.FAILED
        )
    
    async def _add_attachment(self, msg: MIMEMultipart, attachment: Dict[str, Any]):
        """Add attachment to email message."""
        try:
            file_path = attachment.get("file_path")
            filename = attachment.get("filename", Path(file_path).name)
            
            async with aiofiles.open(file_path, "rb") as f:
                file_data = await f.read()
            
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(file_data)
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {filename}'
            )
            msg.attach(part)
            
        except Exception as e:
            print(f"❌ Failed to add attachment {attachment}: {e}")
    
    async def _store_email_record(self, message: EmailMessage, status: EmailStatus):
        """Store email record in database for tracking."""
        # This would store email tracking info in database
        print(f"📧 Storing email record: {message.id} - {status.value}")
    
    async def _update_email_status(
        self, 
        message_id: UUID, 
        status: EmailStatus, 
        provider_message_id: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """Update email delivery status."""
        print(f"📧 Email {message_id} status updated: {status.value}")
    
    async def get_email_status(self, message_id: UUID) -> Optional[Dict[str, Any]]:
        """Get email delivery status."""
        # This would query the database for email status
        return {
            "message_id": str(message_id),
            "status": "sent",
            "sent_at": datetime.utcnow().isoformat(),
            "delivered_at": None,
            "opened_at": None,
            "clicked_at": None
        }
    
    async def get_delivery_statistics(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get email delivery statistics for date range."""
        # This would query delivery statistics from database
        return {
            "total_sent": 150,
            "delivered": 145,
            "bounced": 3,
            "failed": 2,
            "opened": 98,
            "clicked": 42,
            "delivery_rate": 96.7,
            "open_rate": 67.6,
            "click_rate": 28.9
        }
    
    def register_template(self, template: EmailTemplate):
        """Register a new email template."""
        self.templates[template.name] = template
        print(f"📧 Email template registered: {template.name}")
    
    def get_available_templates(self) -> List[str]:
        """Get list of available email templates."""
        return list(self.templates.keys())


# Global enhanced email service instance
enhanced_email_service = EnhancedEmailService()