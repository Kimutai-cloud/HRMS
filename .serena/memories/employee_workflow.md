# Employee Workflow System

## Overview
This HRMS system implements a 4-stage employee approval workflow with document management and role assignment capabilities.

## Architecture
- **Frontend**: React/TypeScript with Tailwind CSS v4
- **Backend**: FastAPI with PostgreSQL database
- **Containerization**: Docker with docker-compose

## Database Connection Info
- **Container**: `hrmstrial-postgres-1`
- **Database**: `hrms_db`
- **User**: `hrms_user`
- **Password**: `hrms_password`

## 4-Stage Approval Workflow

### Stage 1: Details Review
- **Component**: `DetailsReviewPanel`
- **Purpose**: Review employee personal information
- **Endpoint**: `/admin/reviews/{employee_id}/approve-details`
- **Status**: `PENDING_DETAILS_REVIEW` → `PENDING_DOCUMENTS_REVIEW`

### Stage 2: Documents Review
- **Component**: `DocumentsReviewPanel`
- **Purpose**: Review and approve uploaded documents
- **Endpoint**: `/admin/reviews/{employee_id}/approve-documents`
- **Status**: `PENDING_DOCUMENTS_REVIEW` → `PENDING_ROLE_ASSIGNMENT`

### Stage 3: Role Assignment
- **Component**: `RolesReviewPanel`
- **Purpose**: Assign roles and permissions
- **Endpoint**: `/admin/reviews/{employee_id}/assign-role`
- **Status**: `PENDING_ROLE_ASSIGNMENT` → `PENDING_FINAL_APPROVAL`

### Stage 4: Final Approval
- **Component**: `FinalApprovalPanel`
- **Purpose**: Complete verification and grant system access
- **Endpoint**: `/admin/reviews/{employee_id}/final-approve`
- **Status**: `PENDING_FINAL_APPROVAL` → `VERIFIED`

## Key Components

### AdminWorkflowDashboard
- **File**: `auth-frontend/src/components/admin/AdminWorkflowDashboard.tsx`
- **Purpose**: Main dashboard with workflow stepper
- **Key Fix**: Stage parameter now uses `currentStep` instead of hardcoded "details"

### AdminReviewPanel
- **File**: `auth-frontend/src/components/admin/AdminReviewPanel.tsx`
- **Purpose**: Routes to appropriate review panel based on stage
- **Features**: Loading states, error handling, query invalidation

### Panel Components
All panels support:
- Loading states with `isProcessing` prop
- Stage-specific toast notifications
- Real API integration with adminService
- Proper error handling

## Document Types
- ID_CARD
- EDUCATION_CERTIFICATE
- (Additional types as needed)

## Current Database State
3 users with documents:
1. **Kevin Korir** (`Korir@mailinator.com`) - 3 pending documents
2. **Test User** (`testuser@example.com`) - 2 pending documents  
3. **John WorkflowTest** (`endtoend@test.com`) - 1 approved document (VERIFIED)

## Recent Fixes
1. **useState Import Error**: Added React imports to all panel components
2. **Routing Issue**: Fixed AdminWorkflowDashboard stage parameter routing
3. **AdminService**: Fixed singleton import pattern
4. **Loading States**: Added isProcessing prop to all panels
5. **Notifications**: Implemented stage-specific success messages

## API Service Pattern
- **AdminService**: Singleton instance with real API calls
- **Query Invalidation**: Automatic data refresh after actions
- **Toast Notifications**: User feedback for all operations
- **Error Handling**: Comprehensive error management

## Development Commands
```bash
# Access database
docker exec hrmstrial-postgres-1 psql -U hrms_user -d hrms_db

# Check containers
docker ps

# View workflow data
SELECT * FROM employees WHERE verification_status != 'NOT_SUBMITTED';
```

This workflow system provides a comprehensive employee onboarding and verification process with proper admin controls and document management.