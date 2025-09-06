#!/usr/bin/env python3
"""
Fix duplicate department assignments from migration.
This script consolidates departments and ensures each manager only manages one department.
"""

import asyncio
import asyncpg
from typing import Dict, List, Set
import os
from datetime import datetime


async def get_database_connection():
    """Get database connection."""
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/hrms_employee")
    return await asyncpg.connect(database_url)


async def find_duplicate_departments(conn) -> Dict[str, List[str]]:
    """Find departments with similar names that should be consolidated."""
    
    departments = await conn.fetch("""
        SELECT id, name, description
        FROM departments
        ORDER BY name
    """)
    
    # Group similar departments
    department_groups = {}
    for dept in departments:
        name = dept['name'].strip().lower()
        # Normalize department names
        if name in ['analytics', 'analytics department']:
            group_key = 'analytics'
        elif name in ['engineering', 'engineering department']:
            group_key = 'engineering'
        elif name in ['it', 'information technology', 'it department']:
            group_key = 'it'
        elif name in ['hr', 'human resources', 'human resources department']:
            group_key = 'hr'
        elif name in ['finance', 'finance department']:
            group_key = 'finance'
        elif name in ['marketing', 'marketing department']:
            group_key = 'marketing'
        else:
            group_key = name
        
        if group_key not in department_groups:
            department_groups[group_key] = []
        
        department_groups[group_key].append({
            'id': str(dept['id']),
            'name': dept['name'],
            'description': dept['description']
        })
    
    # Return only groups with duplicates
    duplicates = {k: v for k, v in department_groups.items() if len(v) > 1}
    return duplicates


async def consolidate_departments(conn, duplicates: Dict[str, List[str]]):
    """Consolidate duplicate departments."""
    
    print("🔄 Consolidating duplicate departments...")
    
    async with conn.transaction():
        for group_name, departments in duplicates.items():
            print(f"\n📁 Processing {group_name} group:")
            
            # Keep the first department as primary
            primary_dept = departments[0]
            duplicate_dept_ids = [dept['id'] for dept in departments[1:]]
            
            print(f"  ✅ Keeping: {primary_dept['name']} (ID: {primary_dept['id']})")
            for dept in departments[1:]:
                print(f"  🗑️  Removing: {dept['name']} (ID: {dept['id']})")
            
            # Update employees to use primary department
            for duplicate_id in duplicate_dept_ids:
                await conn.execute("""
                    UPDATE employees 
                    SET department_id = $1 
                    WHERE department_id = $2
                """, primary_dept['id'], duplicate_id)
                
                print(f"    📝 Updated employees from {duplicate_id} to {primary_dept['id']}")
            
            # Delete duplicate departments
            for duplicate_id in duplicate_dept_ids:
                await conn.execute("""
                    DELETE FROM departments WHERE id = $1
                """, duplicate_id)
                
                print(f"    🗑️  Deleted department {duplicate_id}")


async def fix_manager_multiple_departments(conn):
    """Ensure each manager only manages one department."""
    
    print("\n🔄 Fixing managers with multiple departments...")
    
    # Find managers with multiple departments
    managers_with_multiple = await conn.fetch("""
        SELECT 
            e.user_id,
            e.full_name,
            e.email,
            array_agg(DISTINCT d.name) as department_names,
            array_agg(DISTINCT d.id) as department_ids,
            count(DISTINCT d.id) as dept_count
        FROM employees e
        JOIN role_assignments ra ON e.user_id = ra.user_id
        JOIN roles r ON ra.role_id = r.id
        JOIN departments d ON e.department_id = d.id
        WHERE r.code = 'MANAGER' 
          AND ra.is_active = true
        GROUP BY e.user_id, e.full_name, e.email
        HAVING count(DISTINCT d.id) > 1
    """)
    
    if not managers_with_multiple:
        print("✅ No managers with multiple departments found")
        return
    
    async with conn.transaction():
        for manager in managers_with_multiple:
            print(f"\n👤 Manager: {manager['full_name']} ({manager['email']})")
            print(f"   📁 Currently in departments: {', '.join(manager['department_names'])}")
            
            # Keep the first department (alphabetically)
            dept_ids = manager['department_ids']
            primary_dept_id = dept_ids[0]  # Keep first department
            
            # Get department name for logging
            primary_dept_name = await conn.fetchval("""
                SELECT name FROM departments WHERE id = $1
            """, primary_dept_id)
            
            print(f"   ✅ Keeping in: {primary_dept_name}")
            
            # Update employee to only be in primary department
            await conn.execute("""
                UPDATE employees 
                SET department_id = $1
                WHERE user_id = $2
            """, primary_dept_id, manager['user_id'])
            
            print(f"   📝 Updated employee record to single department")


async def verify_fixes(conn):
    """Verify that fixes were applied correctly."""
    
    print("\n🔍 Verifying fixes...")
    
    # Check for users with multiple active roles
    multiple_roles = await conn.fetch("""
        SELECT 
            u_id,
            array_agg(role_code) as roles,
            count(*) as role_count
        FROM (
            SELECT 
                ra.user_id as u_id,
                r.code as role_code
            FROM role_assignments ra
            JOIN roles r ON ra.role_id = r.id
            WHERE ra.is_active = true
        ) subq
        GROUP BY u_id
        HAVING count(*) > 1
    """)
    
    if multiple_roles:
        print(f"⚠️  Found {len(multiple_roles)} users with multiple roles:")
        for user in multiple_roles[:5]:  # Show first 5
            print(f"   User ID: {user['u_id']}, Roles: {user['roles']}")
    else:
        print("✅ No users with multiple active roles")
    
    # Check for managers with multiple departments
    multiple_dept_managers = await conn.fetch("""
        SELECT count(*) as count
        FROM (
            SELECT 
                e.user_id,
                count(DISTINCT e.department_id) as dept_count
            FROM employees e
            JOIN role_assignments ra ON e.user_id = ra.user_id
            JOIN roles r ON ra.role_id = r.id
            WHERE r.code = 'MANAGER' 
              AND ra.is_active = true
            GROUP BY e.user_id
            HAVING count(DISTINCT e.department_id) > 1
        ) subq
    """)
    
    count = multiple_dept_managers[0]['count']
    if count > 0:
        print(f"⚠️  Still found {count} managers with multiple departments")
    else:
        print("✅ No managers with multiple departments")


async def main():
    """Main function."""
    print("🚀 Starting department consolidation and role cleanup...")
    
    conn = await get_database_connection()
    
    try:
        # Find duplicate departments
        duplicates = await find_duplicate_departments(conn)
        
        if duplicates:
            print(f"📋 Found {len(duplicates)} groups of duplicate departments")
            await consolidate_departments(conn, duplicates)
        else:
            print("✅ No duplicate departments found")
        
        # Fix managers with multiple departments
        await fix_manager_multiple_departments(conn)
        
        # Verify fixes
        await verify_fixes(conn)
        
        print("\n✅ Department cleanup completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())