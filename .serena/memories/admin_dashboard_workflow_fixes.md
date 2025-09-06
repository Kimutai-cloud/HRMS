# Admin Dashboard Workflow Fixes

## Issues Fixed

### 1. Admin Role Authentication & Dashboard Routing
**Problem**: Admin users were getting routed to employee dashboard instead of admin dashboard due to inconsistent access level logic between frontend and backend.

**Root Cause**: Frontend `determineAccessLevel()` function was checking for `r.is_active` property, but backend role data had `is_active: undefined`. The condition `r.role_code === 'ADMIN' && r.is_active` failed because `undefined && true = false`.

**Solution**: 
```typescript
// Changed from:
const hasAdminRole = roles.some(r => r.role_code === 'ADMIN' && r.is_active);

// To:
const hasAdminRole = roles.some(r => r.role_code === 'ADMIN' && (r.is_active !== false));
```

This handles undefined roles as active by default, treating them as active unless explicitly set to false.

### 2. Profile Editing vs Creation Logic
**Problem**: Profile editing was failing with 404 errors because frontend was trying to call non-existent UPDATE endpoints.

**Backend Endpoints Available**:
- `POST /profile/submit` - Initial profile creation
- `POST /profile/resubmit` - Only for REJECTED profiles  
- No general "update" endpoint exists

**Solution**: Updated frontend logic to:
```typescript
const hasExistingProfile = !!userProfile?.id;
const isRejectedProfile = userProfile?.verification_status === 'REJECTED';

if (hasExistingProfile && isRejectedProfile) {
  // Use resubmit endpoint
  response = await employeeService.post('/profile/resubmit', submissionData);
} else if (!hasExistingProfile) {
  // Use submit endpoint  
  response = await employeeService.post('/profile/submit', submissionData);
} else {
  // Show message that editing is not available
  toast({ title: 'Profile Update Not Available', variant: 'destructive' });
}
```

### 3. Admin Approval Workflow Stage Management  
**Problem**: Admin dashboard had generic "Approve" button that called `/final-approve` endpoint regardless of employee's current verification stage, causing "Cannot final approve employee in status: PENDING_DOCUMENTS_REVIEW" errors.

**Business Logic**: Employee workflow requires stage-by-stage progression:
1. `PENDING_DETAILS_REVIEW` → Approve details
2. `PENDING_DOCUMENTS_REVIEW` → Review & approve documents  
3. `PENDING_ROLE_ASSIGNMENT` → Assign role
4. `PENDING_FINAL_APPROVAL` → Final approve

**Solution**: Replaced generic approve button with "Review" button:
```typescript
// Before: Generic approve that called /final-approve
<Button onClick={() => handleApproveEmployee(employee.id)}>
  <UserCheck className="w-3 h-3" />
</Button>

// After: Review button that navigates to proper workflow
<Button onClick={() => handleReviewEmployee(employee.id)}>
  <Eye className="w-3 h-3 mr-1" />
  Review
</Button>

const handleReviewEmployee = (employeeId: string) => {
  navigate(`${ROUTE_PATHS.ADMIN_PANEL}?employee=${employeeId}`);
};
```

### 4. Toast Notification Positioning
**Problem**: Toast notifications appeared at bottom-right, user requested top-left positioning.

**Solution**: Updated `ToastViewport` component:
```typescript
// Changed from bottom-right positioning:
"fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"

// To top-left positioning:
"fixed top-0 left-0 z-[100] flex max-h-screen w-full flex-col p-4 sm:top-0 sm:left-0 sm:flex-col md:max-w-[420px]"
```

### 5. Full Name Display Fix
**Problem**: Admin user showing "undefined undefined" in header.

**Solution**: Updated `getUserDisplayName()` to handle different data structures:
```typescript
const getUserDisplayName = () => {
  // Check userProfile directly (employee data at root level)
  if (userProfile?.first_name && userProfile?.last_name) {
    return `${userProfile.first_name} ${userProfile.last_name}`;
  }
  // Fallback to nested structure
  if (userProfile?.employee?.first_name && userProfile?.employee?.last_name) {
    return `${userProfile.employee.first_name} ${userProfile.employee.last_name}`;
  }
  // Fallback to user data
  if (user?.firstName && user?.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return "User";
};
```

## Current System State

### Role-Based Dashboard Routing (Working)
- **Admin users**: Always route to admin dashboard regardless of verification status
- **Manager users**: Route to manager dashboard only if VERIFIED + MANAGER role
- **Employee users**: Route to employee dashboard only if VERIFIED + EMPLOYEE role  
- **Newcomer/Pending users**: Route to newcomer dashboard during verification process

### Profile Management (Working)
- **New users**: Can submit initial profile via `/profile/submit`
- **Rejected profiles**: Can resubmit via `/profile/resubmit`
- **Verified/Pending profiles**: Cannot edit (no update endpoint available)
- **Form properly populates** existing data when editing rejected profiles

### Admin Workflow (Working)
- **Dashboard shows pending employees** with verification status
- **"Review" button** navigates to detailed approval workflow at `/admin?employee={id}`
- **"Reject" button** provides quick rejection with notifications
- **No more stage-based approval errors**

## Key Architectural Notes

### Backend vs Frontend Logic Consistency
The system uses **Option A** business logic:
- **Admin users are exceptions**: Get admin access regardless of verification status
- **All other users**: Must complete full verification workflow before accessing role-specific features

### Missing Backend Functionality  
- No general profile update endpoint for verified users
- Profile editing only available for rejected profiles via resubmit
- May need to add update endpoints in future for verified user profile edits

### Notification System Integration
- Toast notifications working and positioned correctly
- WebSocket notifications integrated with approval workflow
- Error handling provides user-friendly messages with actionable guidance