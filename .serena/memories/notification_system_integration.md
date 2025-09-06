# Notification System Integration - Employee Approval Workflow

## Overview
Successfully integrated the existing notification system into the 4-stage employee approval workflow. All workflow actions now send comprehensive notifications to employees via WebSocket, email, and real-time updates.

## Notification Components Architecture

### Frontend Components
- **NotificationCenter.tsx** - Main notification display with WebSocket integration
- **NotificationContainer.tsx** - Container for toast notifications  
- **NotificationToast.tsx** - Toast notification component
- **NotificationPreferences.tsx** - User notification settings
- **WebSocketService.ts** - Real-time notification handling

### Backend Service
- **NotificationService.py** - Comprehensive notification service with email templates
- **WebSocket Integration** - Real-time notifications via RealTimeNotificationSender
- **Database Storage** - Persistent notification storage with read/unread tracking

## Workflow Stage Notifications Implemented

### Stage 1: Details Review
**When Admin Approves Details:**
- `notify_stage_advanced(employee, "DETAILS_REVIEW", "DOCUMENTS_REVIEW", notes)`
- Employee receives notification about advancing to document upload stage

### Stage 2: Documents Review  
**When Admin Approves All Documents:**
- `notify_stage_advanced(employee, "DOCUMENTS_REVIEW", "ROLE_ASSIGNMENT", notes)`
- Employee receives notification about advancing to role assignment stage

**When Admin Approves Individual Document:**
- `notify_document_approved(document, notes)`
- Employee receives specific document approval notification

**When Admin Rejects Individual Document:**
- `notify_document_rejected(document, reason)`
- Employee receives specific document rejection with reason

### Stage 3: Role Assignment
**When Admin Assigns Role:**
- `notify_stage_advanced(employee, "ROLE_ASSIGNMENT", "FINAL_APPROVAL", notes)`
- Employee receives notification about role assignment and final approval stage

### Stage 4: Final Approval
**When Admin Gives Final Approval:**
- `notify_profile_approved(employee)`
- Employee receives completion notification with full system access

### Profile Rejection (Any Stage)
**When Admin Rejects Profile:**
- `notify_profile_rejected(employee, reason, stage, can_resubmit=True)`
- Employee receives rejection notification with reason and resubmission option

## Technical Implementation

### Dependency Injection Updates
```python
# AdminReviewUseCase now receives NotificationService
def get_admin_review_use_case(
    # ... other dependencies
    notification_service: NotificationService = Depends(get_notification_service)
) -> AdminReviewUseCase

# DocumentUseCase now receives NotificationService  
def get_document_use_case(
    # ... other dependencies
    notification_service: NotificationService = Depends(get_notification_service)
) -> DocumentUseCase
```

### Use Case Constructor Updates
```python
class AdminReviewUseCase:
    def __init__(self, ..., notification_service: Optional[NotificationService] = None):
        self.notification_service = notification_service

class DocumentUseCase:
    def __init__(self, ..., notification_service: Optional['NotificationService'] = None):
        self.notification_service = notification_service
```

### Notification Integration Pattern
All workflow actions now follow this pattern:
```python
# Send notification to employee
if hasattr(self, 'notification_service'):
    try:
        await self.notification_service.notify_stage_advanced(...)
    except Exception as e:
        print(f"⚠️ Notification failed (non-critical): {e}")

# Send real-time WebSocket notification
try:
    await RealTimeNotificationSender.send_stage_advancement_notification(...)
except Exception as e:
    print(f"⚠️ Real-time notification failed (non-critical): {e}")
```

## Notification Types Available

### Stage Advancement Notifications
- **Title**: "Profile Update - Stage Advanced"
- **Message**: Details about new stage and next steps
- **Type**: "info" 
- **Action URL**: Link to relevant dashboard section

### Document Notifications  
- **Approval**: "Document Approved" with document type details
- **Rejection**: "Document Rejected" with reason and resubmission instructions
- **Type**: "success" for approval, "warning" for rejection

### Completion Notifications
- **Final Approval**: "Congratulations! Profile Verified" 
- **System Access**: Instructions for full system access
- **Type**: "success"

### Rejection Notifications
- **Profile Rejected**: Detailed reason and resubmission guidance
- **Type**: "error" 
- **Action URL**: Link to profile correction form

## Testing Workflow

### Manual Testing Steps
1. **Details Stage**: Approve employee details → Check notification
2. **Documents Stage**: 
   - Approve individual documents → Check document notifications
   - Approve all documents → Check stage advancement notification
3. **Role Assignment**: Assign role → Check role assignment notification  
4. **Final Approval**: Complete verification → Check completion notification
5. **Rejection Testing**: Reject at any stage → Check rejection notification

### Expected Notification Behaviors
- ✅ Real-time WebSocket updates in NotificationCenter
- ✅ Toast notifications for immediate feedback
- ✅ Email notifications (if SMTP configured)
- ✅ Persistent notification storage with read/unread status
- ✅ Action buttons for relevant follow-up actions
- ✅ Stage-specific messaging and guidance

## Integration Points

### Frontend Integration
- NotificationCenter displays all workflow notifications
- Toast notifications for immediate user feedback
- WebSocket connection for real-time updates
- Action buttons for navigation to relevant pages

### Backend Integration  
- All use case methods call notification service
- Graceful error handling (notifications don't break workflow)
- Audit trail of all notification attempts
- Email template system for formatted notifications

### Database Integration
- Notification persistence in notifications table
- User preference tracking
- Read/unread status management
- Notification history and analytics

## Configuration

### Environment Variables
- `NOTIFICATION_EMAIL_FROM` - Sender email address
- `MAIL_SERVER` - SMTP server configuration
- `MAIL_USERNAME` / `MAIL_PASSWORD` - SMTP credentials
- WebSocket URL: `ws://localhost:8002/ws`

### WebSocket Connection
- Auto-reconnection on network issues
- Queue notifications during offline periods
- Connection status indicators in UI
- Graceful degradation when WebSocket unavailable

This integration ensures employees receive timely, informative notifications throughout their entire verification journey, improving the user experience and reducing uncertainty about application status.