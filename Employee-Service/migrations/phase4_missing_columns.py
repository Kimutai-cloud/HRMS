import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config.settings import settings
import logging

logger = logging.getLogger(__name__)


async def run_migration():
    """Run Phase 4 database migration - Add missing columns to employees table."""
    logger.info("Starting Phase 4 database migration (missing columns)...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        logger.info("Adding missing columns to employees table...")
        
        # Add the missing columns that were causing the database error
        await conn.execute(text("""
            ALTER TABLE employees 
            ADD COLUMN IF NOT EXISTS details_reviewed_by UUID,
            ADD COLUMN IF NOT EXISTS details_reviewed_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS documents_reviewed_by UUID,
            ADD COLUMN IF NOT EXISTS documents_reviewed_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS role_assigned_by UUID,
            ADD COLUMN IF NOT EXISTS role_assigned_at TIMESTAMP WITH TIME ZONE;
        """))
        
        logger.info("Creating indexes for new columns...")
        
        # Create indexes for the new reviewer columns to improve query performance
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employees_details_reviewed_by 
            ON employees(details_reviewed_by);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employees_documents_reviewed_by 
            ON employees(documents_reviewed_by);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employees_role_assigned_by 
            ON employees(role_assigned_by);
        """))
        
        # Create indexes for timestamp columns for date-based queries
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employees_details_reviewed_at 
            ON employees(details_reviewed_at);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employees_documents_reviewed_at 
            ON employees(documents_reviewed_at);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employees_role_assigned_at 
            ON employees(role_assigned_at);
        """))
        
        logger.info("✅ Phase 4 database migration completed successfully!")
        logger.info("Added missing columns:")
        logger.info("  - details_reviewed_by (UUID)")
        logger.info("  - details_reviewed_at (TIMESTAMP WITH TIME ZONE)")
        logger.info("  - documents_reviewed_by (UUID)")
        logger.info("  - documents_reviewed_at (TIMESTAMP WITH TIME ZONE)")
        logger.info("  - role_assigned_by (UUID)")
        logger.info("  - role_assigned_at (TIMESTAMP WITH TIME ZONE)")
    
    await engine.dispose()


async def rollback_migration():
    """Rollback Phase 4 migration (for development)."""
    logger.info("Rolling back Phase 4 database migration...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Drop indexes first
        await conn.execute(text("DROP INDEX IF EXISTS idx_employees_details_reviewed_by;"))
        await conn.execute(text("DROP INDEX IF EXISTS idx_employees_documents_reviewed_by;"))
        await conn.execute(text("DROP INDEX IF EXISTS idx_employees_role_assigned_by;"))
        await conn.execute(text("DROP INDEX IF EXISTS idx_employees_details_reviewed_at;"))
        await conn.execute(text("DROP INDEX IF EXISTS idx_employees_documents_reviewed_at;"))
        await conn.execute(text("DROP INDEX IF EXISTS idx_employees_role_assigned_at;"))
        
        # Drop the columns
        await conn.execute(text("""
            ALTER TABLE employees 
            DROP COLUMN IF EXISTS details_reviewed_by,
            DROP COLUMN IF EXISTS details_reviewed_at,
            DROP COLUMN IF EXISTS documents_reviewed_by,
            DROP COLUMN IF EXISTS documents_reviewed_at,
            DROP COLUMN IF EXISTS role_assigned_by,
            DROP COLUMN IF EXISTS role_assigned_at;
        """))
        
        logger.info("✅ Phase 4 rollback completed!")
    
    await engine.dispose()


if __name__ == "__main__":
    import argparse
    
    # Setup basic logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Phase 4 Database Migration - Missing Columns")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    args = parser.parse_args()
    
    if args.rollback:
        asyncio.run(rollback_migration())
    else:
        asyncio.run(run_migration())