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


async def check_table_exists(conn, table_name: str):
    """Check if a table exists."""
    result = await conn.execute(text(f"""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '{table_name}'
        );
    """))
    
    return result.scalar()


async def check_table_schema(conn, table_name: str, expected_columns: dict):
    """Check if a table has all expected columns and return missing ones."""
    logger.info(f"Checking schema for table: {table_name}")
    
    # Check if table exists first
    if not await check_table_exists(conn, table_name):
        logger.warning(f"Table {table_name} does not exist, will create it.")
        return list(expected_columns.items())
    
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


async def create_departments_table(conn):
    """Create the departments table."""
    logger.info("Creating departments table...")
    
    create_table_sql = text("""
        CREATE TABLE IF NOT EXISTS departments (
            id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            manager_id UUID,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_by UUID NOT NULL,
            CONSTRAINT fk_departments_manager 
                FOREIGN KEY (manager_id) REFERENCES employees(id)
        );
    """)
    
    try:
        await conn.execute(create_table_sql)
        logger.info("✅ Departments table created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create departments table: {e}")
        raise


async def add_department_id_to_employees(conn):
    """Add department_id column to employees table."""
    logger.info("Adding department_id column to employees table...")
    
    add_column_sql = text("""
        ALTER TABLE employees 
        ADD COLUMN IF NOT EXISTS department_id UUID;
    """)
    
    add_fk_sql = text("""
        ALTER TABLE employees 
        ADD CONSTRAINT IF NOT EXISTS fk_employees_department 
        FOREIGN KEY (department_id) REFERENCES departments(id);
    """)
    
    try:
        await conn.execute(add_column_sql)
        logger.info("✅ Added department_id column to employees table")
        
        # Add foreign key constraint
        await conn.execute(add_fk_sql)
        logger.info("✅ Added foreign key constraint for department_id")
        
    except Exception as e:
        logger.error(f"❌ Failed to add department_id column: {e}")
        raise


async def create_indexes(conn):
    """Create indexes for performance."""
    logger.info("Creating department-related indexes...")
    
    index_commands = [
        "CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);",
        "CREATE INDEX IF NOT EXISTS idx_departments_manager_id ON departments(manager_id);",
        "CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);",
        "CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);",
    ]
    
    for cmd in index_commands:
        try:
            await conn.execute(text(cmd))
            logger.info(f"✅ Created index: {cmd}")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")


async def migrate_existing_department_data(conn):
    """Migrate existing department string data to normalized departments."""
    logger.info("Migrating existing department data...")
    
    # Get unique department names from employees
    result = await conn.execute(text("""
        SELECT DISTINCT department 
        FROM employees 
        WHERE department IS NOT NULL 
        AND department != '' 
        AND department_id IS NULL;
    """))
    
    departments = result.fetchall()
    
    if not departments:
        logger.info("No existing department data to migrate")
        return
    
    logger.info(f"Found {len(departments)} unique departments to migrate")
    
    # Create department records for each unique department
    for dept_row in departments:
        dept_name = dept_row[0].strip()
        if not dept_name:
            continue
            
        logger.info(f"Creating department record for: {dept_name}")
        
        # Create department record
        create_dept_sql = text("""
            INSERT INTO departments (name, description, is_active, created_by)
            VALUES (:name, :description, TRUE, '00000000-0000-0000-0000-000000000000')
            ON CONFLICT (name) DO NOTHING
            RETURNING id;
        """)
        
        try:
            result = await conn.execute(create_dept_sql, {
                "name": dept_name,
                "description": f"Migrated from legacy department field"
            })
            
            # Get the department ID (either newly created or existing)
            dept_result = await conn.execute(text("""
                SELECT id FROM departments WHERE name = :name
            """), {"name": dept_name})
            
            dept_id = dept_result.scalar()
            
            if dept_id:
                # Update employees to use the new department_id
                update_employees_sql = text("""
                    UPDATE employees 
                    SET department_id = :dept_id 
                    WHERE department = :dept_name 
                    AND department_id IS NULL;
                """)
                
                await conn.execute(update_employees_sql, {
                    "dept_id": dept_id,
                    "dept_name": dept_name
                })
                
                logger.info(f"✅ Updated employees for department: {dept_name}")
            
        except Exception as e:
            logger.error(f"❌ Failed to migrate department {dept_name}: {e}")
    
    # Log migration results
    result = await conn.execute(text("""
        SELECT COUNT(*) FROM employees WHERE department_id IS NOT NULL;
    """))
    migrated_count = result.scalar()
    
    result = await conn.execute(text("""
        SELECT COUNT(*) FROM employees WHERE department IS NOT NULL AND department != '';
    """))
    total_with_dept = result.scalar()
    
    logger.info(f"Migration complete: {migrated_count} employees assigned to normalized departments")
    logger.info(f"Total employees with department strings: {total_with_dept}")


async def run_migration():
    """Run Phase 6 - Department Management migration."""
    logger.info("Starting Phase 6 - Department Management migration...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        
        # Step 1: Create departments table
        await create_departments_table(conn)
        
        # Step 2: Add department_id column to employees table
        await add_department_id_to_employees(conn)
        
        # Step 3: Create indexes for performance
        await create_indexes(conn)
        
        # Step 4: Migrate existing department data
        await migrate_existing_department_data(conn)
        
        logger.info("✅ Phase 6 - Department Management migration completed successfully!")
    
    await engine.dispose()


async def verify_migration():
    """Verify the department management migration."""
    logger.info("🔍 Verifying Department Management migration...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Check departments table structure
        result = await conn.execute(text("""
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'departments'
            ORDER BY ordinal_position;
        """))
        
        dept_columns = result.fetchall()
        
        logger.info("\n" + "="*80)
        logger.info("📋 DEPARTMENTS TABLE SCHEMA")
        logger.info("="*80)
        
        if dept_columns:
            for col in dept_columns:
                nullable = "NULL" if col[2] == "YES" else "NOT NULL"
                default = f" DEFAULT {col[3]}" if col[3] else ""
                logger.info(f"  ✓ {col[0]:<25} {col[1]:<20} {nullable}{default}")
        else:
            logger.error("❌ Departments table not found!")
        
        # Check employee department_id column
        result = await conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'employees'
            AND column_name = 'department_id';
        """))
        
        has_dept_id = result.scalar()
        if has_dept_id:
            logger.info("✅ Employees table has department_id column")
        else:
            logger.error("❌ Employees table missing department_id column")
        
        # Check foreign key constraints
        result = await conn.execute(text("""
            SELECT 
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND (tc.table_name = 'departments' OR 
                 (tc.table_name = 'employees' AND kcu.column_name = 'department_id'))
            ORDER BY tc.table_name, tc.constraint_name;
        """))
        
        fk_constraints = result.fetchall()
        
        logger.info("\n📊 FOREIGN KEY CONSTRAINTS")
        logger.info("-" * 50)
        for fk in fk_constraints:
            logger.info(f"  ✓ {fk[1]}.{fk[2]} -> {fk[3]}.{fk[4]} ({fk[0]})")
        
        # Check data migration
        result = await conn.execute(text("""
            SELECT COUNT(*) FROM departments;
        """))
        dept_count = result.scalar()
        
        result = await conn.execute(text("""
            SELECT COUNT(*) FROM employees WHERE department_id IS NOT NULL;
        """))
        employees_with_dept_id = result.scalar()
        
        logger.info(f"\n📈 DATA MIGRATION STATS")
        logger.info("-" * 30)
        logger.info(f"  ✓ Departments created: {dept_count}")
        logger.info(f"  ✓ Employees with department_id: {employees_with_dept_id}")
        
        logger.info("\n" + "="*80)
        logger.info("✅ Department Management migration verification complete!")
        logger.info("="*80)
    
    await engine.dispose()


async def rollback_migration():
    """Rollback the department management migration (for development only)."""
    logger.warning("🔄 Rolling back Department Management migration...")
    logger.warning("This will DROP the departments table and remove department_id column!")
    
    # Confirm rollback
    confirm = input("Are you sure you want to rollback? This will delete all department data! (yes/no): ")
    if confirm.lower() != 'yes':
        logger.info("Rollback cancelled.")
        return
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        try:
            # Remove foreign key constraint first
            await conn.execute(text("""
                ALTER TABLE employees 
                DROP CONSTRAINT IF EXISTS fk_employees_department;
            """))
            
            # Remove department_id column from employees
            await conn.execute(text("""
                ALTER TABLE employees 
                DROP COLUMN IF EXISTS department_id;
            """))
            
            # Drop departments table
            await conn.execute(text("""
                DROP TABLE IF EXISTS departments CASCADE;
            """))
            
            logger.info("✅ Department Management migration rolled back successfully!")
            
        except Exception as e:
            logger.error(f"❌ Rollback failed: {e}")
            raise
    
    await engine.dispose()


if __name__ == "__main__":
    import argparse
    
    # Setup basic logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Phase 6 - Department Management Migration")
    parser.add_argument("--verify", action="store_true", help="Only verify migration, don't run it")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration (DESTRUCTIVE)")
    args = parser.parse_args()
    
    if args.rollback:
        asyncio.run(rollback_migration())
    elif args.verify:
        asyncio.run(verify_migration())
    else:
        asyncio.run(run_migration())
        # Run verification after migration
        asyncio.run(verify_migration())