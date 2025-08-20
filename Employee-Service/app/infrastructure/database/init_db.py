import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from app.infrastructure.database.models import Base
from app.config.settings import settings
import logging

logger = logging.getLogger(__name__)


async def create_tables():
    """Create all database tables."""
    logger.info("Creating database tables...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    await engine.dispose()
    logger.info("Database tables created successfully!")


async def seed_initial_data():
    """Seed initial data including NEWCOMER role."""
    from app.infrastructure.database.connections import db_connection
    from app.infrastructure.database.repositories.role_repository import RoleRepository
    from app.core.entities.role import Role, RoleCode
    from uuid import uuid4
    
    logger.info("Seeding initial data...")
    
    async with db_connection.async_session() as session:
        role_repo = RoleRepository(session)
        
        roles = [
            Role(
                id=uuid4(),
                code=RoleCode.ADMIN,
                name="Administrator", 
                description="Full system access with all permissions",
                permissions={
                    "can_view_all_employees": True,
                    "can_create_employees": True,
                    "can_update_employees": True,
                    "can_deactivate_employees": True,
                    "can_assign_roles": True,
                    "can_approve_profiles": True,
                    "can_view_admin_dashboard": True,
                    "can_manage_departments": True,
                    "can_view_audit_logs": True,
                    "can_bulk_operations": True
                }
            ),
            Role(
                id=uuid4(),
                code=RoleCode.MANAGER,
                name="Manager",
                description="Can manage team members and view team data",
                permissions={
                    "can_view_team_employees": True,
                    "can_update_team_employees": True,
                    "can_view_reports": True,
                    "can_approve_team_requests": True,
                    "can_view_team_dashboard": True,
                    "can_view_own_profile": True,
                    "can_update_own_profile": True
                }
            ),
            Role(
                id=uuid4(),
                code=RoleCode.EMPLOYEE,
                name="Employee",
                description="Basic employee access to view own profile and company directory",
                permissions={
                    "can_view_own_profile": True,
                    "can_update_own_profile": True,
                    "can_view_company_directory": True,
                    "can_submit_requests": True,
                    "can_view_company_policies": True
                }
            ),
            Role(
                id=uuid4(),
                code=RoleCode.NEWCOMER,
                name="Newcomer",
                description="Limited access for users during profile verification",
                permissions={
                    "can_view_own_profile": True,
                    "can_update_basic_profile": True,
                    "can_view_verification_status": True,
                    "can_upload_documents": True,
                    "can_resubmit_profile": True,
                    "can_view_company_policies": True,
                    "can_view_guidance": True
                }
            )
        ]
        
        for role in roles:
            try:
                existing_role = await role_repo.get_role_by_code(role.code)
                if existing_role:
                    logger.info(f"⚠️  Role {role.name} already exists, skipping")
                    continue
                    
                await role_repo.create_role(role)
                logger.info(f"✅ Created role: {role.name} ({role.code.value})")
            except Exception as e:
                logger.warning(f"⚠️  Failed to create role {role.name}: {e}")
    
    logger.info("Initial data seeded successfully!")


async def seed_sample_departments():
    """Seed sample departments for testing."""
    from app.infrastructure.database.connections import db_connection
    from sqlalchemy import text
    
    logger.info("Seeding sample departments...")
    
    departments = [
        "Engineering", "Human Resources", "Finance", "Marketing", 
        "Sales", "Operations", "Legal", "IT", "Product", "Customer Success"
    ]
    
    async with db_connection.async_session() as session:
        # This would be implemented when we have a proper departments table
        # For now, departments are handled in the ProfileUseCase
        logger.info("✅ Departments will be handled via ProfileUseCase for now")


async def create_admin_user():
    """Create an admin user for testing (optional)."""
    logger.info("Admin user creation would be handled via Auth Service integration")
    logger.info("Use the Auth Service to create admin users, then assign ADMIN role via Employee Service")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )
    
    async def main():
        logger.info("🚀 Starting Employee Service database initialization...")
        
        try:
            await create_tables()
            
            await seed_initial_data()
            
            await seed_sample_departments()
            
            await create_admin_user()
            
            logger.info("🎉 Database initialization completed successfully!")
            logger.info("🔧 Next steps:")
            logger.info("   1. Start the Employee Service")
            logger.info("   2. Create admin users via Auth Service")
            logger.info("   3. Use Employee Service to assign ADMIN roles")
            logger.info("   4. Test profile submission workflow")
            
        except Exception as e:
            logger.error(f"❌ Database initialization failed: {e}")
            raise
    
    asyncio.run(main())