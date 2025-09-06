# Fix Roles and Departments Issues

## Issues Fixed

1. **Multiple Active Roles per User**: Users were getting both NEWCOMER + MANAGER roles instead of having NEWCOMER replaced
2. **Multiple Department Assignments**: Managers were assigned to multiple departments due to migration issues

## Changes Made

### Code Changes

1. **Fixed Role Assignment Logic** (`Employee-Service/app/application/use_case/admin_review_use_cases.py`):
   - Changed role assignment to revoke ALL existing roles before assigning new role
   - Ensures only one active role per user at any time

2. **Fixed Regular Role Assignment** (`Employee-Service/app/application/use_case/role_use_cases.py`):
   - Added logic to revoke existing roles before assigning non-NEWCOMER roles
   - Prevents accumulation of multiple roles

### Database Cleanup Required

**Run this cleanup script to fix existing data:**

```bash
cd Employee-Service
python migrations/fix_duplicate_departments.py
```

## What the Cleanup Script Does

1. **Consolidates Duplicate Departments**:
   - Finds departments with similar names (e.g., "Analytics" and "Analytics Department")
   - Keeps one primary department and deletes duplicates
   - Updates all employee records to use the primary department

2. **Fixes Managers with Multiple Departments**:
   - Identifies managers assigned to multiple departments
   - Assigns each manager to only one department (keeps alphabetically first)

3. **Verifies Fixes**:
   - Checks that no users have multiple active roles
   - Confirms no managers have multiple departments

## Expected Results After Fix

- **Kevin Korir** should have:
  - Role: `MANAGER` (NEWCOMER role removed)
  - Department: Single department (either Analytics OR Engineering, not both)

## Environment Variables Required

Make sure these are set before running the script:

```bash
export DATABASE_URL="postgresql://postgres:password@localhost:5432/hrms_employee"
```

## Verification Commands

After running the cleanup, verify the fixes:

```sql
-- Check users with multiple roles
SELECT 
    ra.user_id,
    array_agg(r.code) as roles,
    count(*) as role_count
FROM role_assignments ra
JOIN roles r ON ra.role_id = r.id
WHERE ra.is_active = true
GROUP BY ra.user_id
HAVING count(*) > 1;

-- Check managers with multiple departments  
SELECT 
    e.user_id,
    e.full_name,
    e.email,
    array_agg(DISTINCT d.name) as department_names,
    count(DISTINCT d.id) as dept_count
FROM employees e
JOIN role_assignments ra ON e.user_id = ra.user_id
JOIN roles r ON ra.role_id = r.id
JOIN departments d ON e.department_id = d.id
WHERE r.code = 'MANAGER' 
  AND ra.is_active = true
GROUP BY e.user_id, e.full_name, e.email
HAVING count(DISTINCT d.id) > 1;
```

Both queries should return 0 rows after the fix.