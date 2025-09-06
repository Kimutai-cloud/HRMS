# Admin Dashboard 403 Error Fix

## Problem
When accessing the Manager Task Dashboard, the system was making unauthorized calls to `/api/v1/admin/dashboard` endpoint, resulting in 403 Forbidden errors. This occurred even when the user was accessing manager-specific pages.

## Root Cause
The `useDashboardData` hook was automatically calling admin endpoints whenever `isAdmin` returned true, regardless of the current context. Since users can have multiple roles (both MANAGER and ADMIN), the hook would always call admin endpoints for admin users, even on manager pages.

## Solution Applied
Modified the `useDashboardData` hook to accept a context parameter that specifies which dashboard type is being requested:

### 1. Updated Hook Signature
```typescript
export const useDashboardData = (context?: 'admin' | 'manager' | 'employee' | 'newcomer'): DashboardData
```

### 2. Modified Logic to Respect Context
- Admin endpoints are only called when `context === 'admin' && isAdmin`
- Manager endpoints are called when `(context === 'manager' || !context) && isManager`
- Employee endpoints are called when `(context === 'employee' || !context) && isEmployee`
- Newcomer endpoints are called when `(context === 'newcomer' || !context) && isNewcomer`

### 3. Updated All Calling Components
Fixed the following components to pass appropriate context:

- **AdminPanelPage.tsx**: `useDashboardData('admin')`
- **AdminDashboard.tsx**: `useDashboardData('admin')`
- **DashboardMetrics.tsx**: 
  - `AdminMetrics`: `useDashboardData('admin')`
  - `ManagerMetrics`: `useDashboardData('manager')`
- **TeamStats.tsx**: `useDashboardData('manager')`

## Files Modified
1. `auth-frontend/src/hooks/useDashboardData.ts` - Core hook logic
2. `auth-frontend/src/pages/AdminPanelPage.tsx` - Context parameter
3. `auth-frontend/src/pages/AdminDashboard.tsx` - Context parameter
4. `auth-frontend/src/components/dashboard/DashboardMetrics.tsx` - Context parameters
5. `auth-frontend/src/components/team/TeamStats.tsx` - Context parameter

## Result
- Manager Task Dashboard no longer makes unauthorized admin API calls
- 403 Forbidden errors eliminated when accessing manager pages
- Admin functionality remains intact when explicitly requested
- Multi-role users can access appropriate dashboards based on context

## Testing Considerations
- Test users with both MANAGER and ADMIN roles accessing different dashboard types
- Verify admin endpoints are only called from admin contexts
- Ensure manager endpoints work correctly for admin users in manager contexts
- Confirm no 403 errors occur during normal manager task workflow

## Date Fixed
2025-09-04