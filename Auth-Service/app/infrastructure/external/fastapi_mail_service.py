from typing import Optional
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from app.core.interfaces.services import EmailServiceInterface
from app.config.settings import settings


class FastAPIMailService(EmailServiceInterface):
    def __init__(self):
        try:
            # Create connection config with only the required fields
            conf_dict = {
                "MAIL_USERNAME": settings.MAIL_USERNAME,
                "MAIL_PASSWORD": settings.MAIL_PASSWORD,
                "MAIL_FROM": settings.MAIL_FROM,
                "MAIL_PORT": settings.MAIL_PORT,
                "MAIL_SERVER": settings.MAIL_SERVER,
                "MAIL_FROM_NAME": settings.MAIL_FROM_NAME,
                "MAIL_STARTTLS": settings.MAIL_STARTTLS,
                "MAIL_SSL_TLS": settings.MAIL_SSL_TLS,
                "USE_CREDENTIALS": True,
                "VALIDATE_CERTS": True
            }
            
            print(f"📧 Email config: {conf_dict}")  # Debug logging
            
            self.conf = ConnectionConfig(**conf_dict)
            self.fast_mail = FastMail(self.conf)
            self.frontend_url = settings.FRONTEND_URL
            
            print("📧 Email service initialized successfully")
            
        except Exception as e:
            print(f"❌ Email service initialization failed: {e}")
            # For development, create a dummy service that doesn't actually send emails
            self.conf = None
            self.fast_mail = None
            self.frontend_url = settings.FRONTEND_URL
    
    async def send_verification_email(self, email: str, token: str) -> bool:
        if not self.fast_mail:
            print(f"📧 Would send verification email to {email} (email service disabled)")
            return True
            
        verification_url = f"{self.frontend_url}/verify-email?token={token}"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for signing up! Please click the button below to verify your email address:</p>
            <a href="{verification_url}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0;">
                Verify Email
            </a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>{verification_url}</p>
            <p>This link will expire in 30 minutes.</p>
        </div>
        """
        
        return await self._send_email(
            to_email=email,
            subject="Verify Your Email Address",
            html_content=html_content
        )
    
    async def send_password_reset_email(self, email: str, token: str) -> bool:
        if not self.fast_mail:
            print(f"📧 Would send password reset email to {email} (email service disabled)")
            return True
            
        reset_url = f"{self.frontend_url}/reset-password?token={token}"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Your Password</h2>
            <p>You requested to reset your password. Click the button below to set a new password:</p>
            <a href="{reset_url}" 
               style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0;">
                Reset Password
            </a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>{reset_url}</p>
            <p>This link will expire in 30 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        </div>
        """
        
        return await self._send_email(
            to_email=email,
            subject="Reset Your Password",
            html_content=html_content
        )
    
    async def send_welcome_email(self, email: str, name: str) -> bool:
        if not self.fast_mail:
            print(f"📧 Would send welcome email to {email} (email service disabled)")
            return True
            
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome, {name}!</h2>
            <p>Your account has been successfully verified. Welcome to our platform!</p>
            <p>You can now access all features of your account.</p>
            <p>If you have any questions, feel free to contact our support team.</p>
        </div>
        """
        
        return await self._send_email(
            to_email=email,
            subject="Welcome to Our Platform!",
            html_content=html_content
        )
    
    async def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        if not self.fast_mail:
            print(f"📧 Email disabled - would send '{subject}' to {to_email}")
            return True
            
        try:
            message = MessageSchema(
                subject=subject,
                recipients=[to_email],
                body=html_content,
                subtype="html"
            )
            
            await self.fast_mail.send_message(message)
            print(f"📧 Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            print(f"❌ Email sending failed: {e}")
            return False