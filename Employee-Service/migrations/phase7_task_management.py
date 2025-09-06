import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text, inspect
from app.config.settings import settings
from app.infrastructure.database.models import Base
import logging

logger = logging.getLogger(__name__)


async def create_task_enums(conn):
    """Create all task-related ENUMs."""
    logger.info("Creating task management ENUMs...")
    
    enum_commands = [
        # Task Type
        """
        CREATE TYPE task_type_enum AS ENUM ('PROJECT', 'TASK', 'SUBTASK');
        """,
        
        # Priority  
        """
        CREATE TYPE priority_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
        """,
        
        # Status
        """
        CREATE TYPE task_status_enum AS ENUM (
            'DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 
            'IN_REVIEW', 'COMPLETED', 'CANCELLED'
        );
        """,
        
        # Comment Type
        """
        CREATE TYPE comment_type_enum AS ENUM (
            'COMMENT', 'STATUS_CHANGE', 'PROGRESS_UPDATE', 'REVIEW_NOTE'
        );
        """,
        
        # Activity Action
        """
        CREATE TYPE task_action_enum AS ENUM (
            'CREATED', 'ASSIGNED', 'STARTED', 'UPDATED', 'SUBMITTED', 
            'REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMMENTED'
        );
        """
    ]
    
    for cmd in enum_commands:
        try:
            await conn.execute(text(cmd))
            logger.info(f"✅ Created ENUM successfully")
        except Exception as e:
            if "already exists" in str(e):
                logger.info(f"✓ ENUM already exists, skipping")
            else:
                logger.error(f"❌ Failed to create ENUM: {e}")
                raise


async def create_tasks_table(conn):
    """Create the main tasks table."""
    logger.info("Creating tasks table...")
    
    create_table_sql = text("""
        CREATE TABLE IF NOT EXISTS tasks (
            id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            task_type task_type_enum NOT NULL DEFAULT 'TASK',
            priority priority_enum NOT NULL DEFAULT 'MEDIUM',
            status task_status_enum NOT NULL DEFAULT 'DRAFT',
            
            -- Relationships
            assignee_id UUID REFERENCES employees(id),
            assigner_id UUID NOT NULL REFERENCES employees(id),
            department_id UUID REFERENCES departments(id),
            parent_task_id UUID REFERENCES tasks(id),
            
            -- Progress & Effort
            progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
            estimated_hours DECIMAL(5,2),
            actual_hours DECIMAL(5,2),
            
            -- Timeline
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            assigned_at TIMESTAMP WITH TIME ZONE,
            started_at TIMESTAMP WITH TIME ZONE,
            due_date TIMESTAMP WITH TIME ZONE,
            submitted_at TIMESTAMP WITH TIME ZONE,
            reviewed_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            -- Additional Data
            tags JSONB DEFAULT '[]',
            attachments JSONB DEFAULT '[]',
            review_notes TEXT,
            rejection_reason TEXT,
            approval_notes TEXT,
            version INTEGER NOT NULL DEFAULT 1
        );
    """)
    
    try:
        await conn.execute(create_table_sql)
        logger.info("✅ Tasks table created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create tasks table: {e}")
        raise


async def create_task_comments_table(conn):
    """Create the task comments table."""
    logger.info("Creating task_comments table...")
    
    create_table_sql = text("""
        CREATE TABLE IF NOT EXISTS task_comments (
            id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            author_id UUID NOT NULL REFERENCES employees(id),
            comment TEXT NOT NULL,
            comment_type comment_type_enum DEFAULT 'COMMENT',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    """)
    
    try:
        await conn.execute(create_table_sql)
        logger.info("✅ Task comments table created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create task_comments table: {e}")
        raise


async def create_task_activities_table(conn):
    """Create the task activities table."""
    logger.info("Creating task_activities table...")
    
    create_table_sql = text("""
        CREATE TABLE IF NOT EXISTS task_activities (
            id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            performed_by UUID NOT NULL REFERENCES employees(id),
            action task_action_enum NOT NULL,
            previous_status task_status_enum,
            new_status task_status_enum,
            details JSONB,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    """)
    
    try:
        await conn.execute(create_table_sql)
        logger.info("✅ Task activities table created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create task_activities table: {e}")
        raise


async def create_indexes(conn):
    """Create indexes for performance."""
    logger.info("Creating task management indexes...")
    
    index_commands = [
        # Tasks table indexes
        "CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_assigner_id ON tasks(assigner_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_department_id ON tasks(department_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);",
        
        # Task comments indexes
        "CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);",
        "CREATE INDEX IF NOT EXISTS idx_task_comments_author_id ON task_comments(author_id);",
        "CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at);",
        
        # Task activities indexes
        "CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON task_activities(task_id);",
        "CREATE INDEX IF NOT EXISTS idx_task_activities_performed_by ON task_activities(performed_by);",
        "CREATE INDEX IF NOT EXISTS idx_task_activities_action ON task_activities(action);",
        "CREATE INDEX IF NOT EXISTS idx_task_activities_created_at ON task_activities(created_at);",
        
        # Composite indexes for common queries
        "CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_assigner_status ON tasks(assigner_id, status);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_department_status ON tasks(department_id, status);",
    ]
    
    for cmd in index_commands:
        try:
            await conn.execute(text(cmd))
            logger.info(f"✅ Created index: {cmd}")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")


async def run_migration():
    """Run Phase 7 - Task Management migration."""
    logger.info("Starting Phase 7 - Task Management migration...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        
        # Step 1: Create ENUMs
        await create_task_enums(conn)
        
        # Step 2: Create tasks table
        await create_tasks_table(conn)
        
        # Step 3: Create task_comments table
        await create_task_comments_table(conn)
        
        # Step 4: Create task_activities table
        await create_task_activities_table(conn)
        
        # Step 5: Create indexes for performance
        await create_indexes(conn)
        
        logger.info("✅ Phase 7 - Task Management migration completed successfully!")
    
    await engine.dispose()


async def verify_migration():
    """Verify the task management migration."""
    logger.info("🔍 Verifying Task Management migration...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Check all tables exist
        tables_to_check = ['tasks', 'task_comments', 'task_activities']
        
        for table in tables_to_check:
            result = await conn.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table}'
                );
            """))
            
            exists = result.scalar()
            if exists:
                logger.info(f"✅ Table {table} exists")
            else:
                logger.error(f"❌ Table {table} missing!")
        
        # Check ENUMs exist
        enums_to_check = [
            'task_type_enum', 'priority_enum', 'task_status_enum', 
            'comment_type_enum', 'task_action_enum'
        ]
        
        for enum_name in enums_to_check:
            result = await conn.execute(text(f"""
                SELECT EXISTS (
                    SELECT FROM pg_type 
                    WHERE typname = '{enum_name}'
                );
            """))
            
            exists = result.scalar()
            if exists:
                logger.info(f"✅ ENUM {enum_name} exists")
            else:
                logger.error(f"❌ ENUM {enum_name} missing!")
        
        logger.info("✅ Task Management migration verification complete!")
    
    await engine.dispose()


if __name__ == "__main__":
    import argparse
    
    # Setup basic logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Phase 7 - Task Management Migration")
    parser.add_argument("--verify", action="store_true", help="Only verify migration, don't run it")
    args = parser.parse_args()
    
    if args.verify:
        asyncio.run(verify_migration())
    else:
        asyncio.run(run_migration())
        # Run verification after migration
        asyncio.run(verify_migration())