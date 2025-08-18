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
    """Run Phase 3 database migration."""
    logger.info("Starting Phase 3 database migration...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    # First, add the enum value outside of transaction
    logger.info("Adding NEWCOMER to role_code enum...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TYPE role_code ADD VALUE 'NEWCOMER';"))
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.info("NEWCOMER already exists in role_code enum")
            else:
                raise e
    
    async with engine.begin() as conn:
        
        # 1. Add user_id column to employees table if it doesn't exist
        logger.info("Adding user_id column to employees table...")
        await conn.execute(text("""
            ALTER TABLE employees 
            ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE;
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employees_user_id 
            ON employees(user_id);
        """))
        
        # 2. Add verification status enum and column if not exists
        logger.info("Adding verification status support...")
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE verification_status AS ENUM (
                    'NOT_SUBMITTED', 'PENDING_DETAILS_REVIEW', 'PENDING_DOCUMENTS_REVIEW',
                    'PENDING_ROLE_ASSIGNMENT', 'PENDING_FINAL_APPROVAL', 'VERIFIED', 'REJECTED'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        await conn.execute(text("""
            ALTER TABLE employees 
            ADD COLUMN IF NOT EXISTS verification_status verification_status DEFAULT 'NOT_SUBMITTED';
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employees_verification_status 
            ON employees(verification_status);
        """))
        
        # 3. Add verification workflow columns
        logger.info("Adding verification workflow columns...")
        await conn.execute(text("""
            ALTER TABLE employees 
            ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS final_approved_by UUID,
            ADD COLUMN IF NOT EXISTS final_approved_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
            ADD COLUMN IF NOT EXISTS rejected_by UUID,
            ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
        """))
        
        # 4. Create employee_documents table
        logger.info("Creating employee_documents table...")
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE document_type AS ENUM (
                    'ID_CARD', 'PASSPORT', 'DRIVERS_LICENSE', 'BIRTH_CERTIFICATE',
                    'EDUCATION_CERTIFICATE', 'EMPLOYMENT_CONTRACT', 'PREVIOUS_EMPLOYMENT_LETTER',
                    'PROFESSIONAL_CERTIFICATION', 'OTHER'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE document_review_status AS ENUM (
                    'PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_REPLACEMENT'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS employee_documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                document_type document_type NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                uploaded_by UUID NOT NULL,
                
                reviewed_by UUID NULL,
                reviewed_at TIMESTAMP WITH TIME ZONE NULL,
                review_status document_review_status NOT NULL DEFAULT 'PENDING',
                review_notes TEXT NULL,
                
                is_required BOOLEAN NOT NULL DEFAULT TRUE,
                display_order INTEGER NOT NULL DEFAULT 0,
                
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        """))
        
        # Create indexes for employee_documents
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id 
            ON employee_documents(employee_id);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employee_documents_review_status 
            ON employee_documents(review_status);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_employee_documents_uploaded_by 
            ON employee_documents(uploaded_by);
        """))
        
        # 5. Create approval_stages table
        logger.info("Creating approval_stages table...")
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE approval_stage AS ENUM (
                    'DETAILS_REVIEW', 'DOCUMENTS_REVIEW', 'ROLE_ASSIGNMENT', 'FINAL_APPROVAL'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE approval_action AS ENUM (
                    'APPROVED', 'REJECTED', 'ROLE_ASSIGNED', 'FINAL_APPROVED'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS approval_stages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                stage approval_stage NOT NULL,
                action approval_action NOT NULL,
                performed_by UUID NOT NULL,
                performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                notes TEXT NULL,
                previous_status VARCHAR(50) NULL,
                new_status VARCHAR(50) NOT NULL,
                additional_data JSONB NULL,
                
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        """))
        
        # Create indexes for approval_stages
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_approval_stages_employee_id 
            ON approval_stages(employee_id);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_approval_stages_performed_by 
            ON approval_stages(performed_by);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_approval_stages_stage 
            ON approval_stages(stage);
        """))
        
        # 6. Create notifications table
        logger.info("Creating notifications table...")
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE notification_type AS ENUM (
                    'PROFILE_APPROVED', 'PROFILE_REJECTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED',
                    'STAGE_ADVANCED', 'FINAL_VERIFICATION', 'ACTION_REQUIRED'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                type notification_type NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                data JSONB NULL,
                
                sent_at TIMESTAMP WITH TIME ZONE NULL,
                read_at TIMESTAMP WITH TIME ZONE NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                
                email_sent BOOLEAN NOT NULL DEFAULT FALSE,
                email_sent_at TIMESTAMP WITH TIME ZONE NULL
            );
        """))
        
        # Create indexes for notifications
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
            ON notifications(user_id);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notifications_type 
            ON notifications(type);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
            ON notifications(created_at);
        """))
        
        # 7. Add NEWCOMER role 
        logger.info("Adding NEWCOMER role...")
        await conn.execute(text("""
            INSERT INTO roles (id, code, name, description, created_at)
            VALUES (
                gen_random_uuid(),
                'NEWCOMER',
                'Newcomer',
                'Limited access role for users pending employee verification',
                NOW()
            )
            ON CONFLICT (code) DO NOTHING;
        """))
        
        # 8. Update existing employees to have NOT_SUBMITTED verification status
        logger.info("Migrating existing employees...")
        await conn.execute(text("""
            UPDATE employees 
            SET verification_status = 'NOT_SUBMITTED'
            WHERE verification_status IS NULL;
        """))
        
        # 9. Create upload directories
        logger.info("Creating upload directories...")
        import os
        from pathlib import Path
        
        upload_dir = Path(settings.UPLOAD_DIR) / "employee_documents"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info("✅ Phase 3 database migration completed successfully!")
    
    await engine.dispose()


async def rollback_migration():
    """Rollback Phase 3 migration (for development)."""
    logger.info("Rolling back Phase 3 database migration...")
    
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Drop tables in reverse order
        await conn.execute(text("DROP TABLE IF EXISTS notifications CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS approval_stages CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS employee_documents CASCADE;"))
        
        # Drop types
        await conn.execute(text("DROP TYPE IF EXISTS notification_type CASCADE;"))
        await conn.execute(text("DROP TYPE IF EXISTS approval_action CASCADE;"))
        await conn.execute(text("DROP TYPE IF EXISTS approval_stage CASCADE;"))
        await conn.execute(text("DROP TYPE IF EXISTS document_review_status CASCADE;"))
        await conn.execute(text("DROP TYPE IF EXISTS document_type CASCADE;"))
        await conn.execute(text("DROP TYPE IF EXISTS verification_status CASCADE;"))
        
        # Remove columns from employees
        await conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS user_id CASCADE;"))
        await conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS verification_status CASCADE;"))
        await conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS submitted_at CASCADE;"))
        await conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS final_approved_by CASCADE;"))
        await conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS final_approved_at CASCADE;"))
        await conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS rejection_reason CASCADE;"))
        await conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS rejected_by CASCADE;"))
        await conn.execute(text("ALTER TABLE employees DROP COLUMN IF EXISTS rejected_at CASCADE;"))
        
        # Remove NEWCOMER role
        await conn.execute(text("DELETE FROM role_assignments WHERE role_id IN (SELECT id FROM roles WHERE code = 'NEWCOMER');"))
        await conn.execute(text("DELETE FROM roles WHERE code = 'NEWCOMER';"))
        
        logger.info("✅ Phase 3 rollback completed!")
    
    await engine.dispose()


if __name__ == "__main__":
    import argparse
    
    # Setup basic logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Phase 3 Database Migration")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    args = parser.parse_args()
    
    if args.rollback:
        asyncio.run(rollback_migration())
    else:
        asyncio.run(run_migration())