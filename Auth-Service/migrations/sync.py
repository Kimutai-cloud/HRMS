"""
Migration: Sync EmployeeProfileStatus enum with Employee-Service VerificationStatus
Date: 2025-01-25
Purpose: Add detailed employee profile status values to match Employee-Service workflow

For Docker deployment:
1. Run this migration in your Auth-Service container
2. This will update the existing enum to include all detailed status values
3. Existing data with 'PENDING_VERIFICATION' will be mapped to 'PENDING_DETAILS_REVIEW'
"""

import asyncio
import asyncpg
import os
from typing import Optional

async def get_db_connection():
    """Get database connection from environment variables."""
    # Use the same DATABASE_URL format as the docker-compose.yml
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://hrms_user:hrms_password@postgres:5432/hrms_db')
    
    # Convert asyncpg format for raw asyncpg connection
    if DATABASE_URL.startswith('postgresql+asyncpg://'):
        DATABASE_URL = DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')
    
    print(f"🔗 Connecting to database: {DATABASE_URL}")
    return await asyncpg.connect(DATABASE_URL)

async def run_migration():
    """Run the migration to sync employee profile status enum."""
    conn = await get_db_connection()
    
    try:
        print("🔄 Starting Auth-Service employee profile status enum migration...")
        
        # Step 1: Add new enum values to existing type
        print("📝 Adding new status values to employee_profile_status enum...")
        
        await conn.execute("""
            ALTER TYPE employee_profile_status ADD VALUE IF NOT EXISTS 'NOT_SUBMITTED';
        """)
        
        await conn.execute("""
            ALTER TYPE employee_profile_status ADD VALUE IF NOT EXISTS 'PENDING_DETAILS_REVIEW';
        """)
        
        await conn.execute("""
            ALTER TYPE employee_profile_status ADD VALUE IF NOT EXISTS 'PENDING_DOCUMENTS_REVIEW';
        """)
        
        await conn.execute("""
            ALTER TYPE employee_profile_status ADD VALUE IF NOT EXISTS 'PENDING_ROLE_ASSIGNMENT';
        """)
        
        await conn.execute("""
            ALTER TYPE employee_profile_status ADD VALUE IF NOT EXISTS 'PENDING_FINAL_APPROVAL';
        """)
        
        print("✅ New enum values added successfully")
        
        # Step 2: Update existing data to use detailed status
        print("🔄 Mapping existing PENDING_VERIFICATION to PENDING_DETAILS_REVIEW...")
        
        result = await conn.execute("""
            UPDATE users 
            SET employee_profile_status = 'PENDING_DETAILS_REVIEW'
            WHERE employee_profile_status = 'PENDING_VERIFICATION';
        """)
        
        rows_updated = int(result.split()[-1]) if result else 0
        print(f"✅ Updated {rows_updated} user records")
        
        # Step 3: Verify migration
        print("🔍 Verifying migration results...")
        
        status_counts = await conn.fetch("""
            SELECT employee_profile_status, COUNT(*) as count
            FROM users 
            GROUP BY employee_profile_status
            ORDER BY employee_profile_status;
        """)
        
        print("📊 Current status distribution:")
        for row in status_counts:
            print(f"   {row['employee_profile_status']}: {row['count']} users")
        
        # Step 4: Check if old PENDING_VERIFICATION still exists
        old_status_count = await conn.fetchval("""
            SELECT COUNT(*) FROM users WHERE employee_profile_status = 'PENDING_VERIFICATION';
        """)
        
        if old_status_count > 0:
            print(f"⚠️  Warning: {old_status_count} users still have PENDING_VERIFICATION status")
        else:
            print("✅ All users successfully migrated to detailed status values")
            
        print("🎉 Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        await conn.close()

async def rollback_migration():
    """Rollback the migration (for development/testing only)."""
    conn = await get_db_connection()
    
    try:
        print("🔄 Rolling back employee profile status migration...")
        
        # Map detailed statuses back to simple ones
        await conn.execute("""
            UPDATE users 
            SET employee_profile_status = 'PENDING_VERIFICATION'
            WHERE employee_profile_status IN (
                'PENDING_DETAILS_REVIEW',
                'PENDING_DOCUMENTS_REVIEW', 
                'PENDING_ROLE_ASSIGNMENT',
                'PENDING_FINAL_APPROVAL'
            );
        """)
        
        print("⚠️  Rollback completed - detailed status information has been lost")
        
    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        asyncio.run(rollback_migration())
    else:
        asyncio.run(run_migration())