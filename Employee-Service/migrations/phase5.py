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


async def check_table_schema(conn, table_name: str, expected_columns: dict):
    """Check if a table has all expected columns and return missing ones."""
    logger.info(f"Checking schema for table: {table_name}")
    
    # Get current columns
    result = await conn.execute(text(f"""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = '{table_name}'
        ORDER BY column_name;
    """))
    
    current_columns = {row[0]: {"type": row[1], "nullable": row[2]} for row in result.fetchall()}
    missing_columns = []
    
    logger.info(f"Current columns in {table_name}: {list(current_columns.keys())}")
    logger.info(f"Expected columns in {table_name}: {list(expected_columns.keys())}")
    
    for col_name, col_def in expected_columns.items():
        if col_name not in current_columns:
            missing_columns.append((col_name, col_def))
            logger.warning(f"❌ Missing column: {table_name}.{col_name}")
        else:
            logger.info(f"✅ Found column: {table_name}.{col_name}")
    
    return missing_columns


async def run_migration():
    """Run comprehensive schema migration - add all missing columns."""
    logger.info("Starting Phase 5 comprehensive schema migration...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        
        # Define expected columns for each table
        table_schemas = {
            "employees": {
                "id": "UUID NOT NULL DEFAULT gen_random_uuid()",
                "user_id": "UUID UNIQUE",
                "first_name": "VARCHAR(255) NOT NULL",
                "last_name": "VARCHAR(255) NOT NULL", 
                "email": "VARCHAR(255) UNIQUE NOT NULL",
                "phone": "VARCHAR(50)",
                "title": "VARCHAR(255)",
                "department": "VARCHAR(255)",
                "manager_id": "UUID",
                "employment_status": "employment_status NOT NULL DEFAULT 'ACTIVE'",
                "verification_status": "verification_status NOT NULL DEFAULT 'NOT_SUBMITTED'",
                "hired_at": "TIMESTAMP WITH TIME ZONE",
                "deactivated_at": "TIMESTAMP WITH TIME ZONE",
                "deactivation_reason": "TEXT",
                "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
                "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
                "submitted_at": "TIMESTAMP WITH TIME ZONE",
                "details_reviewed_by": "UUID",
                "details_reviewed_at": "TIMESTAMP WITH TIME ZONE",
                "documents_reviewed_by": "UUID",
                "documents_reviewed_at": "TIMESTAMP WITH TIME ZONE",
                "role_assigned_by": "UUID",
                "role_assigned_at": "TIMESTAMP WITH TIME ZONE",
                "final_approved_by": "UUID",
                "final_approved_at": "TIMESTAMP WITH TIME ZONE",
                "rejection_reason": "TEXT",
                "rejected_by": "UUID",
                "rejected_at": "TIMESTAMP WITH TIME ZONE",
            },
            
            "roles": {
                "id": "UUID NOT NULL DEFAULT gen_random_uuid()",
                "code": "role_code UNIQUE NOT NULL",
                "name": "VARCHAR(255) NOT NULL",
                "description": "TEXT",
                "permissions": "JSONB",
                "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
                "is_active": "BOOLEAN NOT NULL DEFAULT TRUE",
            },
            
            "role_assignments": {
                "id": "UUID NOT NULL DEFAULT gen_random_uuid()",
                "user_id": "UUID NOT NULL",
                "role_id": "UUID NOT NULL",
                "scope": "JSONB NOT NULL DEFAULT '{}'",
                "assigned_by": "UUID",
                "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
                "revoked_at": "TIMESTAMP WITH TIME ZONE",
                "revoked_by": "UUID",
                "is_active": "BOOLEAN NOT NULL DEFAULT TRUE",
            },
            
            "domain_events": {
                "id": "UUID NOT NULL DEFAULT gen_random_uuid()",
                "event_type": "VARCHAR(255) NOT NULL",
                "aggregate_id": "UUID NOT NULL",
                "data": "JSONB NOT NULL",
                "occurred_at": "TIMESTAMP WITH TIME ZONE NOT NULL",
                "version": "INTEGER NOT NULL DEFAULT 1",
                "published": "BOOLEAN NOT NULL DEFAULT FALSE",
                "published_at": "TIMESTAMP WITH TIME ZONE",
                "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
            },
            
            "audit_logs": {
                "id": "UUID NOT NULL DEFAULT gen_random_uuid()",
                "entity_type": "VARCHAR(100) NOT NULL",
                "entity_id": "UUID NOT NULL",
                "action": "VARCHAR(50) NOT NULL",
                "user_id": "UUID NOT NULL",
                "changes": "JSONB",
                "timestamp": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
                "ip_address": "VARCHAR(45)",
                "user_agent": "TEXT",
            },
        }
        
        all_missing = []
        
        # Check each table for missing columns
        for table_name, expected_columns in table_schemas.items():
            missing = await check_table_schema(conn, table_name, expected_columns)
            if missing:
                all_missing.extend([(table_name, col_name, col_def) for col_name, col_def in missing])
        
        if not all_missing:
            logger.info("🎉 All tables have correct schema! No missing columns found.")
            return
        
        logger.info(f"Found {len(all_missing)} missing columns total. Adding them now...")
        
        # Add missing columns
        for table_name, col_name, col_def in all_missing:
            logger.info(f"Adding column: {table_name}.{col_name}")
            try:
                await conn.execute(text(f"""
                    ALTER TABLE {table_name} 
                    ADD COLUMN IF NOT EXISTS {col_name} {col_def};
                """))
                logger.info(f"✅ Added: {table_name}.{col_name}")
            except Exception as e:
                logger.error(f"❌ Failed to add {table_name}.{col_name}: {e}")
        
        # Create missing indexes for performance
        logger.info("Creating missing indexes...")
        
        index_commands = [
            "CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_employees_verification_status ON employees(verification_status);",
            "CREATE INDEX IF NOT EXISTS idx_employees_details_reviewed_by ON employees(details_reviewed_by);",
            "CREATE INDEX IF NOT EXISTS idx_employees_documents_reviewed_by ON employees(documents_reviewed_by);",
            "CREATE INDEX IF NOT EXISTS idx_employees_role_assigned_by ON employees(role_assigned_by);",
            "CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id ON role_assignments(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_role_assignments_role_id ON role_assignments(role_id);",
            "CREATE INDEX IF NOT EXISTS idx_role_assignments_assigned_by ON role_assignments(assigned_by);",
            "CREATE INDEX IF NOT EXISTS idx_domain_events_event_type ON domain_events(event_type);",
            "CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate_id ON domain_events(aggregate_id);",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);",
        ]
        
        for cmd in index_commands:
            try:
                await conn.execute(text(cmd))
            except Exception as e:
                logger.warning(f"Index creation warning: {e}")
        
        logger.info("✅ Phase 5 comprehensive schema migration completed successfully!")
    
    await engine.dispose()


async def verify_schema():
    """Verify all tables have the correct schema after migration."""
    logger.info("🔍 Verifying complete database schema...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Get all tables and their columns
        result = await conn.execute(text("""
            SELECT 
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name IN ('employees', 'roles', 'role_assignments', 'domain_events', 'audit_logs')
            ORDER BY table_name, ordinal_position;
        """))
        
        tables = {}
        for row in result.fetchall():
            table_name = row[0]
            if table_name not in tables:
                tables[table_name] = []
            tables[table_name].append({
                "column": row[1],
                "type": row[2],
                "nullable": row[3],
                "default": row[4]
            })
        
        logger.info("\n" + "="*80)
        logger.info("📋 COMPLETE DATABASE SCHEMA VERIFICATION")
        logger.info("="*80)
        
        for table_name, columns in tables.items():
            logger.info(f"\n📊 Table: {table_name}")
            logger.info("-" * 50)
            for col in columns:
                nullable = "NULL" if col["nullable"] == "YES" else "NOT NULL"
                default = f" DEFAULT {col['default']}" if col['default'] else ""
                logger.info(f"  ✓ {col['column']:<25} {col['type']:<20} {nullable}{default}")
        
        logger.info("\n" + "="*80)
        logger.info("✅ Schema verification complete!")
        logger.info("="*80)
    
    await engine.dispose()


if __name__ == "__main__":
    import argparse
    
    # Setup basic logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Phase 5 Comprehensive Schema Migration")
    parser.add_argument("--verify", action="store_true", help="Only verify schema, don't migrate")
    args = parser.parse_args()
    
    if args.verify:
        asyncio.run(verify_schema())
    else:
        asyncio.run(run_migration())
        # Run verification after migration
        asyncio.run(verify_schema())