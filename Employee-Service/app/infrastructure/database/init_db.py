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
        # Drop all tables (for development)
        await conn.run_sync(Base.metadata.drop_all)
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    
    await engine.dispose()
    logger.info("Database tables created successfully!")


async def seed_initial_data():
    """Seed initial data."""
    from app.infrastructure.database.connection import db_connection
    from app.infrastructure.database.repositories.role_repository import RoleRepository
    from app.core.entities.role import Role, RoleCode
    from uuid import uuid4
    
    logger.info("Seeding initial data...")
    
    async with db_connection.async_session() as session:
        role_repo = RoleRepository(session)
        
        # Create default roles
        roles = [
            Role(
                id=uuid4(),
                code=RoleCode.ADMIN,
                name="Administrator", 
                description="Full system access with all permissions"
            ),
            Role(
                id=uuid4(),
                code=RoleCode.MANAGER,
                name="Manager",
                description="Can manage team members and view team data"
            ),
            Role(
                id=uuid4(),
                code=RoleCode.EMPLOYEE,
                name="Employee",
                description="Basic employee access to view own profile"
            )
        ]
        
        for role in roles:
            try:
                await role_repo.create_role(role)
                logger.info(f"✅ Created role: {role.name}")
            except Exception as e:
                logger.warning(f"⚠️  Role {role.name} might already exist: {e}")
    
    logger.info("Initial data seeded successfully!")


if __name__ == "__main__":
    # Setup basic logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )
    
    async def main():
        await create_tables()
        await seed_initial_data()
    
    asyncio.run(main())
