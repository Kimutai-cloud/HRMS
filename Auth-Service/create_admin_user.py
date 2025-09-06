#!/usr/bin/env python3
"""
Create default admin user script for Auth Service.
Run this script to create admin@admin.com with password 'admin'.
"""

import asyncio
import sys
import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Add the app directory to the path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.config.settings import settings
from app.infrastructure.security.password_hasher import PasswordHasher
from app.core.entities.user import EmployeeProfileStatus

logger = logging.getLogger(__name__)

async def create_admin_user():
    """Create the default admin user in Auth Service database."""
    logger.info("🔧 Creating default admin user...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    password_hasher = PasswordHasher()
    
    admin_email = "admin@admin.com"
    admin_password = "admin"
    admin_name = "System Administrator"
    
    # Hash the password
    hashed_password = password_hasher.hash_password(admin_password)
    
    async with engine.begin() as conn:
        # Check if admin user already exists
        result = await conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": admin_email}
        )
        existing_user = result.fetchone()
        
        if existing_user:
            logger.info(f"✅ Admin user {admin_email} already exists!")
            return existing_user[0]
        
        # Create admin user
        result = await conn.execute(
            text("""
                INSERT INTO users (
                    email, 
                    hashed_password, 
                    full_name, 
                    is_verified, 
                    auth_provider, 
                    employee_profile_status
                ) VALUES (
                    :email,
                    :hashed_password,
                    :full_name,
                    :is_verified,
                    :auth_provider,
                    :employee_profile_status
                ) RETURNING id
            """),
            {
                "email": admin_email,
                "hashed_password": hashed_password,
                "full_name": admin_name,
                "is_verified": True,
                "auth_provider": "email",
                "employee_profile_status": EmployeeProfileStatus.VERIFIED.value
            }
        )
        
        user_id = result.fetchone()[0]
        logger.info(f"✅ Created admin user {admin_email} with ID: {user_id}")
        
        await engine.dispose()
        return user_id

async def main():
    """Main function to create admin user."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )
    
    try:
        user_id = await create_admin_user()
        logger.info(f"🎉 Admin user setup completed successfully!")
        logger.info(f"👤 Email: admin@admin.com")
        logger.info(f"🔑 Password: admin")
        logger.info(f"🆔 User ID: {user_id}")
        return user_id
    except Exception as e:
        logger.error(f"❌ Failed to create admin user: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())