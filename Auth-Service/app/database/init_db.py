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

if __name__ == "__main__":
    asyncio.run(create_tables())