from uuid import uuid4, UUID
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from app.core.entities.employee import Employee, VerificationStatus
from app.core.entities.role import RoleCode
from app.core.entities.events import DomainEvent
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeValidationException,
    EmployeePermissionException
)
from app.core.exceptions.role_exceptions import ForbiddenException
from app.core.interfaces.repositories import EmployeeRepositoryInterface, EventRepositoryInterface, RoleRepositoryInterface
from app.infrastructure.database.repositories.document_repository import DocumentRepositoryInterface
from app.infrastructure.database.repositories.document_repository import DocumentRepositoryInterface
from app.infrastructure.external.auth_service_client import AuthServiceClient
from app.domain.services import RoleBasedAccessControlService
from app.application.services.notification_service import NotificationService
from app.infrastructure.websocket.notification_sender import RealTimeNotificationSender
from app.infrastructure.database.repositories.audit_repository import (
    AuditRepository, 
    AuditContext, 
    AuditLevel, 
    ActionCategory
)
from app.infrastructure.database.connections import db_connection

@dataclass
class ReviewAction:
    """Represents a review action taken by an admin."""
    employee_id: UUID
    stage: str
    action: str
    performed_by: UUID
    notes: Optional[str] = None
    additional_data: Optional[Dict[str, Any]] = None


@dataclass
class PendingReview:
    """Represents an employee pending review at a specific stage."""
    employee: Employee
    documents_summary: Optional[Dict[str, Any]] = None
    days_pending: int = 0
    priority: str = "normal"  

@dataclass
class DocumentValidationResult:
        is_complete: bool
        missing_items: str
        required_count: int
        approved_count: int
class AdminReviewUseCase:
    """Use cases for admin review workflow and stage management."""
    
    def __init__(
        self,
        employee_repository: EmployeeRepositoryInterface,
        document_repository: DocumentRepositoryInterface,
        role_repository: RoleRepositoryInterface,
        event_repository: EventRepositoryInterface,
        rbac_service: RoleBasedAccessControlService,
        verification_status: VerificationStatus ,
        auth_service_client: AuthServiceClient,
        notification_service: Optional[NotificationService] = None,
        
    ):
        self.employee_repository = employee_repository
        self.document_repository = document_repository
        self.role_repository = role_repository
        self.event_repository = event_repository
        self.rbac_service = rbac_service
        self.auth_service_client = auth_service_client
        self.notification_service = notification_service 
    
    
    async def get_admin_dashboard_summary(self, admin_user_id: UUID) -> Dict[str, Any]:
        """Get comprehensive dashboard summary for admin."""
        
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        details_pending = await self._get_pending_count(VerificationStatus.PENDING_DETAILS_REVIEW)
        documents_pending = await self._get_pending_count(VerificationStatus.PENDING_DOCUMENTS_REVIEW)
        roles_pending = await self._get_pending_count(VerificationStatus.PENDING_ROLE_ASSIGNMENT)
        final_pending = await self._get_pending_count(VerificationStatus.PENDING_FINAL_APPROVAL)
        
        doc_stats = await self.document_repository.get_document_statistics()
        
        urgent_reviews = await self._get_urgent_reviews()
        
        return {
            "pending_reviews": {
                "details": details_pending,
                "documents": documents_pending,
                "roles": roles_pending,
                "final": final_pending,
                "total": details_pending + documents_pending + roles_pending + final_pending
            },
            "document_reviews": {
                "pending": doc_stats.get("pending", 0),
                "requires_replacement": doc_stats.get("requires_replacement", 0),
                "total_pending": doc_stats.get("pending", 0) + doc_stats.get("requires_replacement", 0)
            },
            "urgent_items": {
                "count": len(urgent_reviews),
                "oldest_days": max([r.days_pending for r in urgent_reviews], default=0)
            },
            "quick_stats": {
                "total_verified": await self._get_pending_count(VerificationStatus.VERIFIED),
                "total_rejected": await self._get_pending_count(VerificationStatus.REJECTED),
                "completion_rate": await self._calculate_completion_rate()
            }
        }
    
    
    async def get_pending_details_reviews(self, admin_user_id: UUID, limit: int = 50) -> List[PendingReview]:
        """Get employees pending details review."""
        
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        result = await self.employee_repository.list_employees(
            page=1,
            size=limit,
            status=None,  
            sort_by="submitted_at",
            sort_order="asc" 
        )
        
        pending_reviews = []
        for employee in result["employees"]:
            if employee.verification_status == VerificationStatus.PENDING_DETAILS_REVIEW:
                days_pending = self._calculate_days_pending(employee.submitted_at)
                priority = self._determine_priority(days_pending)
                
                pending_reviews.append(PendingReview(
                    employee=employee,
                    days_pending=days_pending,
                    priority=priority
                ))
        
        return pending_reviews
    
    async def approve_details_review(
        self,
        employee_id: UUID,
        reviewer_id: UUID,
        notes: Optional[str] = None
    ) -> Employee:
        """Approve employee details and advance to documents review."""
        
        if not await self.rbac_service.is_admin(reviewer_id):
            raise ForbiddenException("Admin role required")
        
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            raise EmployeeNotFoundException(f"Employee {employee_id} not found")
        
        if employee.verification_status != VerificationStatus.PENDING_DETAILS_REVIEW:
            raise EmployeeValidationException(
                f"Cannot approve details for employee in status: {employee.verification_status.value}"
            )
        
        employee.advance_verification_stage(VerificationStatus.PENDING_DOCUMENTS_REVIEW, reviewer_id)
        
        updated_employee = await self.employee_repository.update(employee)

        if hasattr(self, 'notification_service'):
            try:
                await self.notification_service.notify_stage_advanced(
                    employee=updated_employee,
                    from_stage="DETAILS_REVIEW",
                    to_stage="DOCUMENTS_REVIEW",
                    notes=notes
                )
            except Exception as e:
                print(f"⚠️ Notification failed (non-critical): {e}")
        
        # Send real-time WebSocket notification
        try:
            await RealTimeNotificationSender.send_stage_advancement_notification(
                employee=updated_employee,
                from_stage="DETAILS_REVIEW",
                to_stage="DOCUMENTS_REVIEW",
                notes=notes
            )
        except Exception as e:
            print(f"⚠️ Real-time notification failed (non-critical): {e}")
            
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage="DETAILS_REVIEW",
            action="APPROVED",
            performed_by=reviewer_id,
            notes=notes
        ))
        
        await self.auth_service_client.update_user_profile_status(
            updated_employee.user_id, "PENDING_VERIFICATION"
        )
        
        await self._emit_stage_advanced_event(employee_id, "DETAILS_REVIEW", "DOCUMENTS_REVIEW", reviewer_id)
        
        # Comprehensive audit logging
        try:
            async with db_connection.async_session() as audit_session:
                audit_repo = AuditRepository(audit_session)
                audit_context = AuditContext(
                    user_id=reviewer_id,
                    correlation_id=str(uuid4()),
                    additional_data={
                        "operation": "approve_details_review",
                        "employee_email": updated_employee.email,
                        "employee_name": updated_employee.get_full_name(),
                        "previous_status": "PENDING_DETAILS_REVIEW",
                        "new_status": "PENDING_DOCUMENTS_REVIEW"
                    }
                )
                
                await audit_repo.log_admin_action(
                    admin_id=reviewer_id,
                    action="approve_details_review",
                    entity_type="employee",
                    entity_id=employee_id,
                    changes={
                        "status_change": "PENDING_DETAILS_REVIEW -> PENDING_DOCUMENTS_REVIEW",
                        "reviewer_notes": notes,
                        "approved_at": datetime.utcnow().isoformat()
                    },
                    context=audit_context,
                    reasoning=notes
                )
        except Exception as e:
            print(f"⚠️ Audit logging failed (non-critical): {e}")
        
        print(f"✅ Details approved for employee {employee_id}, advanced to documents review")
        return updated_employee
    
    
    async def get_pending_documents_reviews(self, admin_user_id: UUID, limit: int = 50) -> List[PendingReview]:
        """Get employees pending documents review."""
        
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        result = await self.employee_repository.list_employees(
            page=1,
            size=limit,
            status=None,
            sort_by="updated_at",
            sort_order="asc"
        )
        
        pending_reviews = []
        for employee in result["employees"]:
            if employee.verification_status == VerificationStatus.PENDING_DOCUMENTS_REVIEW.value:
                doc_summary = await self.document_repository.get_employee_document_summary(employee.id)
                days_pending = self._calculate_days_pending(employee.updated_at)
                priority = self._determine_priority(days_pending)
                
                pending_reviews.append(PendingReview(
                    employee=employee,
                    documents_summary=doc_summary,
                    days_pending=days_pending,
                    priority=priority
                ))
        
        return pending_reviews
    
    async def approve_documents_review(
        self,
        employee_id: UUID,
        reviewer_id: UUID,
        notes: Optional[str] = None
    ) -> Employee:
        """Approve employee documents and advance to role assignment."""
        
        if not await self.rbac_service.is_admin(reviewer_id):
            raise ForbiddenException("Admin role required")
        
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            raise EmployeeNotFoundException(f"Employee {employee_id} not found")
        
        if employee.verification_status != VerificationStatus.PENDING_DOCUMENTS_REVIEW:
            raise EmployeeValidationException(
                f"Cannot approve documents for employee in status: {employee.verification_status.value}"
            )
        
        doc_summary = await self.document_repository.get_employee_document_summary(employee_id)
        validation_result = await self._validate_documents_completion(doc_summary)

        if not validation_result.is_complete:
            raise EmployeeValidationException(
                f"Cannot approve documents review: {validation_result.missing_items}"
            )
        
        if not doc_summary.get("all_required_approved", False):
            raise EmployeeValidationException(
                "Cannot approve documents review: not all required documents are approved"
            )
        
        employee.advance_verification_stage(VerificationStatus.PENDING_ROLE_ASSIGNMENT, reviewer_id)
        
        updated_employee = await self.employee_repository.update(employee)
        
        # Send real-time WebSocket notification
        try:
            await RealTimeNotificationSender.send_stage_advancement_notification(
                employee=updated_employee,
                from_stage="DOCUMENTS_REVIEW", 
                to_stage="ROLE_ASSIGNMENT",
                notes=notes
            )
        except Exception as e:
            print(f"⚠️ Real-time notification failed (non-critical): {e}")
        
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage="DOCUMENTS_REVIEW",
            action="APPROVED",
            performed_by=reviewer_id,
            notes=notes
        ))
        
        await self._emit_stage_advanced_event(employee_id, "DOCUMENTS_REVIEW", "ROLE_ASSIGNMENT", reviewer_id)
        
        print(f"✅ Documents approved for employee {employee_id}, advanced to role assignment")
        return updated_employee
  
    
    async def get_pending_role_assignments(self, admin_user_id: UUID, limit: int = 50) -> List[PendingReview]:
        """Get employees pending role assignment."""
        
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        result = await self.employee_repository.list_employees(
            page=1,
            size=limit,
            status=None,
            sort_by="updated_at",
            sort_order="asc"
        )
        
        pending_reviews = []
        for employee in result["employees"]:
            if employee.verification_status == VerificationStatus.PENDING_ROLE_ASSIGNMENT:
                days_pending = self._calculate_days_pending(employee.updated_at)
                priority = self._determine_priority(days_pending)
                
                pending_reviews.append(PendingReview(
                    employee=employee,
                    days_pending=days_pending,
                    priority=priority
                ))
        
        return pending_reviews
    
    async def assign_role_and_advance(
        self,
        employee_id: UUID,
        role_code: RoleCode,
        reviewer_id: UUID,
        notes: Optional[str] = None
    ) -> Employee:
        """Assign role to employee and advance to final approval."""
        
        if not await self.rbac_service.is_admin(reviewer_id):
            raise ForbiddenException("Admin role required")
        
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            raise EmployeeNotFoundException(f"Employee {employee_id} not found")
        
 
        if employee.verification_status != VerificationStatus.PENDING_ROLE_ASSIGNMENT:
            raise EmployeeValidationException(
                f"Cannot assign role for employee in status: {employee.verification_status.value}"
            )
 
        role = await self.role_repository.get_role_by_code(role_code)
        if not role:
            raise EmployeeValidationException(f"Role {role_code.value} not found")
        
        try:
        
            newcomer_role = await self.role_repository.get_role_by_code(RoleCode.NEWCOMER)
            if newcomer_role:
                await self.role_repository.revoke_role(employee.user_id, newcomer_role.id)
   
            from app.core.entities.role import RoleAssignment
            assignment = RoleAssignment(
                id=uuid4(),
                user_id=employee.user_id,
                role_id=role.id,
                scope={},
                created_at=datetime.utcnow()
            )
            await self.role_repository.assign_role(assignment)
            
        except Exception as e:
            raise EmployeeValidationException(f"Failed to assign role: {str(e)}")
        
   
        employee.advance_verification_stage(VerificationStatus.PENDING_FINAL_APPROVAL, reviewer_id)
        
        updated_employee = await self.employee_repository.update(employee)
        
        # Send real-time WebSocket notification
        try:
            await RealTimeNotificationSender.send_stage_advancement_notification(
                employee=updated_employee,
                from_stage="ROLE_ASSIGNMENT",
                to_stage="FINAL_APPROVAL",
                notes=f"Role assigned: {role_code.value}. {notes}" if notes else f"Role assigned: {role_code.value}"
            )
        except Exception as e:
            print(f"⚠️ Real-time notification failed (non-critical): {e}")
        
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage="ROLE_ASSIGNMENT",
            action="ROLE_ASSIGNED",
            performed_by=reviewer_id,
            notes=notes,
            additional_data={"assigned_role": role_code.value}
        ))
        
        await self._emit_stage_advanced_event(
            employee_id, "ROLE_ASSIGNMENT", "FINAL_APPROVAL", reviewer_id,
            additional_data={"assigned_role": role_code.value}
        )
        
        print(f"✅ Role {role_code.value} assigned to employee {employee_id}, advanced to final approval")
        return updated_employee
    
    
    async def get_pending_final_approvals(self, admin_user_id: UUID, limit: int = 50) -> List[PendingReview]:
        """Get employees pending final approval."""

        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
     
        result = await self.employee_repository.list_employees(
            page=1,
            size=limit,
            status=None,
            sort_by="updated_at",
            sort_order="asc"
        )
        
        pending_reviews = []
        for employee in result["employees"]:
            if employee.verification_status == VerificationStatus.PENDING_FINAL_APPROVAL:
                days_pending = self._calculate_days_pending(employee.updated_at)
                priority = self._determine_priority(days_pending)
                
                pending_reviews.append(PendingReview(
                    employee=employee,
                    days_pending=days_pending,
                    priority=priority
                ))
        
        return pending_reviews
    
    async def final_approve_employee(
        self,
        employee_id: UUID,
        approver_id: UUID,
        notes: Optional[str] = None
    ) -> Employee:
        """Give final approval and complete verification."""
        
        if not await self.rbac_service.is_admin(approver_id):
            raise ForbiddenException("Admin role required")
        
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            raise EmployeeNotFoundException(f"Employee {employee_id} not found")

        if employee.verification_status != VerificationStatus.PENDING_FINAL_APPROVAL:
            raise EmployeeValidationException(
                f"Cannot final approve employee in status: {employee.verification_status.value}"
            )

        employee.final_approve(approver_id)
        employee.hired_at = datetime.utcnow() 
        
     
        updated_employee = await self.employee_repository.update(employee)
        
        # Send real-time WebSocket notification
        try:
            await RealTimeNotificationSender.send_stage_advancement_notification(
                employee=updated_employee,
                from_stage="FINAL_APPROVAL",
                to_stage="VERIFIED",
                notes=notes
            )
        except Exception as e:
            print(f"⚠️ Real-time notification failed (non-critical): {e}")
    
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage="FINAL_APPROVAL",
            action="FINAL_APPROVED",
            performed_by=approver_id,
            notes=notes
        ))
        
        await self.auth_service_client.update_user_profile_status(
            updated_employee.user_id, "VERIFIED"
        )
        
        await self._emit_stage_advanced_event(employee_id, "FINAL_APPROVAL", "VERIFIED", approver_id)
        
        print(f"🎉 Employee {employee_id} fully verified and approved!")
        return updated_employee
    
    
    async def reject_employee_profile(
        self,
        employee_id: UUID,
        reason: str,
        reviewer_id: UUID,
        stage: Optional[str] = None
    ) -> Employee:
        """Reject employee profile at any stage."""
        
        if not await self.rbac_service.is_admin(reviewer_id):
            raise ForbiddenException("Admin role required")
        
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            raise EmployeeNotFoundException(f"Employee {employee_id} not found")
        
        if employee.verification_status in [VerificationStatus.VERIFIED, VerificationStatus.REJECTED]:
            raise EmployeeValidationException(
                f"Cannot reject employee in status: {employee.verification_status.value}"
            )
        
        current_stage = stage or employee.verification_status.value
        
        employee.reject_verification(reason, reviewer_id)
        
        updated_employee = await self.employee_repository.update(employee)
        
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage=current_stage,
            action="REJECTED",
            performed_by=reviewer_id,
            notes=reason
        ))
        
        await self.auth_service_client.update_user_profile_status(
            updated_employee.user_id, "REJECTED"
        )
        
        await self._emit_rejection_event(employee_id, current_stage, reason, reviewer_id)
        
        print(f"❌ Employee {employee_id} rejected at {current_stage} stage")
        return updated_employee
    
    
    async def bulk_approve_stage(
        self,
        employee_ids: List[UUID],
        stage: str,
        reviewer_id: UUID,
        notes: Optional[str] = None
    ) -> List[Employee]:
        """Bulk approve multiple employees at a specific stage."""
        
        if not await self.rbac_service.is_admin(reviewer_id):
            raise ForbiddenException("Admin role required")
        
        approved_employees = []
        
        for employee_id in employee_ids:
            try:
                if stage == "DETAILS_REVIEW":
                    employee = await self.approve_details_review(employee_id, reviewer_id, notes)
                elif stage == "DOCUMENTS_REVIEW":
                    employee = await self.approve_documents_review(employee_id, reviewer_id, notes)
                elif stage == "FINAL_APPROVAL":
                    employee = await self.final_approve_employee(employee_id, reviewer_id, notes)
                else:
                    print(f"❌ Unknown stage for bulk approval: {stage}")
                    continue
                
                approved_employees.append(employee)
                
            except Exception as e:
                print(f"❌ Failed to approve employee {employee_id} at {stage}: {e}")

        
        # Comprehensive audit logging for bulk operation
        try:
            async with db_connection.async_session() as audit_session:
                audit_repo = AuditRepository(audit_session)
                audit_context = AuditContext(
                    user_id=reviewer_id,
                    correlation_id=str(uuid4()),
                    additional_data={
                        "operation": "bulk_approve_stage",
                        "stage": stage,
                        "requested_count": len(employee_ids),
                        "successful_count": len(approved_employees)
                    }
                )
                
                await audit_repo.log_bulk_operation(
                    admin_id=reviewer_id,
                    operation_type=f"approve_{stage.lower()}",
                    affected_entities=employee_ids,
                    operation_details={
                        "stage": stage,
                        "reviewer_notes": notes,
                        "operation_timestamp": datetime.utcnow().isoformat()
                    },
                    context=audit_context,
                    results={
                        "successful": len(approved_employees),
                        "failed": len(employee_ids) - len(approved_employees),
                        "total": len(employee_ids)
                    }
                )
        except Exception as e:
            print(f"⚠️ Bulk operation audit logging failed (non-critical): {e}")
        
        print(f"✅ Bulk approved {len(approved_employees)}/{len(employee_ids)} employees at {stage}")
        return approved_employees
    
    async def bulk_reject_profiles(
        self,
        employee_ids: List[UUID],
        reason: str,
        reviewer_id: UUID,
        stage: Optional[str] = None
    ) -> List[Employee]:
        """Bulk reject multiple employee profiles."""
        
        if not await self.rbac_service.is_admin(reviewer_id):
            raise ForbiddenException("Admin role required")
        
        rejected_employees = []
        
        for employee_id in employee_ids:
            try:
                employee = await self.reject_employee_profile(
                    employee_id, reason, reviewer_id, stage
                )
                rejected_employees.append(employee)
                
            except Exception as e:
                print(f"❌ Failed to reject employee {employee_id}: {e}")
        
        print(f"✅ Bulk rejected {len(rejected_employees)}/{len(employee_ids)} employees")
        return rejected_employees
    
    async def bulk_send_notifications(
        self,
        user_ids: List[UUID],
        notification_type: str,
        title: str,
        message: str,
        sender_id: UUID,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, int]:
        """Bulk send notifications to multiple users."""
        
        if not await self.rbac_service.is_admin(sender_id):
            raise ForbiddenException("Admin role required")
        
        results = {"successful": 0, "failed": 0}
        
        for user_id in user_ids:
            try:
                if self.notification_service:
                    await self.notification_service._create_notification(
                        user_id=user_id,
                        type=notification_type,
                        title=title,
                        message=message,
                        data=data or {}
                    )
                
                # Send real-time notification
                await RealTimeNotificationSender.send_notification(
                    user_id=user_id,
                    notification_id=uuid4(),
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    data=data
                )
                
                results["successful"] += 1
                
            except Exception as e:
                print(f"❌ Failed to send notification to user {user_id}: {e}")
                results["failed"] += 1
        
        print(f"✅ Bulk notifications sent: {results['successful']} successful, {results['failed']} failed")
        return results
    
    async def bulk_role_assignments(
        self,
        employee_role_assignments: List[Dict[str, Any]],  # [{"employee_id": UUID, "role_code": RoleCode}]
        reviewer_id: UUID,
        notes: Optional[str] = None
    ) -> List[Employee]:
        """Bulk assign roles to multiple employees."""
        
        if not await self.rbac_service.is_admin(reviewer_id):
            raise ForbiddenException("Admin role required")
        
        assigned_employees = []
        
        for assignment in employee_role_assignments:
            try:
                employee_id = assignment["employee_id"]
                role_code = assignment["role_code"]
                
                employee = await self.assign_role_and_advance(
                    employee_id, role_code, reviewer_id, notes
                )
                assigned_employees.append(employee)
                
            except Exception as e:
                employee_id = assignment.get("employee_id", "unknown")
                print(f"❌ Failed to assign role to employee {employee_id}: {e}")
        
        print(f"✅ Bulk role assignments: {len(assigned_employees)}/{len(employee_role_assignments)} successful")
        return assigned_employees
    
    async def send_reminder_notifications(
        self,
        admin_user_id: UUID,
        reminder_type: str = "overdue",
        days_threshold: int = 7
    ) -> Dict[str, int]:
        """Send reminder notifications for overdue reviews."""
        
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        # Get overdue employees
        cutoff_date = datetime.utcnow() - timedelta(days=days_threshold)
        
        # Get all pending employees
        all_pending = []
        all_pending.extend(await self.get_pending_details_reviews(admin_user_id, 1000))
        all_pending.extend(await self.get_pending_documents_reviews(admin_user_id, 1000))
        all_pending.extend(await self.get_pending_role_assignments(admin_user_id, 1000))
        all_pending.extend(await self.get_pending_final_approvals(admin_user_id, 1000))
        
        overdue_employees = [
            review.employee for review in all_pending 
            if review.days_pending >= days_threshold
        ]
        
        results = {"reminders_sent": 0, "admin_alerts": 0}
        
        # Send reminders to users
        for employee in overdue_employees:
            try:
                title = f"Profile Review Reminder - {employee.days_pending} days pending"
                message = f"""
                Hi {employee.first_name},
                
                Your profile has been under review for {employee.days_pending} days. 
                We're working to process it as quickly as possible.
                
                Current status: {employee.verification_status.value}
                
                Thank you for your patience.
                """
                
                if self.notification_service:
                    await self.notification_service._create_notification(
                        user_id=employee.user_id,
                        type="REMINDER",
                        title=title,
                        message=message.strip(),
                        data={
                            "days_pending": employee.days_pending,
                            "status": employee.verification_status.value,
                            "reminder_type": reminder_type
                        }
                    )
                
                results["reminders_sent"] += 1
                
            except Exception as e:
                print(f"❌ Failed to send reminder to employee {employee.id}: {e}")
        
        # Send admin alert about overdue reviews
        if overdue_employees:
            try:
                await RealTimeNotificationSender.send_admin_urgent_review_alert(
                    overdue_count=len(overdue_employees),
                    oldest_days=max([emp.days_pending for emp in overdue_employees])
                )
                results["admin_alerts"] = 1
            except Exception as e:
                print(f"❌ Failed to send admin alert: {e}")
        
        print(f"✅ Reminder notifications: {results['reminders_sent']} user reminders, {results['admin_alerts']} admin alerts")
        return results

    
    async def _get_pending_count(self, status: VerificationStatus) -> int:
        """Get count of employees with specific verification status."""

        result = await self.employee_repository.list_employees(
            page=1, size=1000, status=None
        )
        return len([e for e in result["employees"] if e.verification_status == status])
    
    async def _get_urgent_reviews(self) -> List[PendingReview]:
        """Get reviews that are urgent (pending > 7 days)."""

        return [] 
    
    async def _calculate_completion_rate(self) -> float:
        """Calculate verification completion rate."""

        return 0.0
    
    def _calculate_days_pending(self, since_date: Optional[datetime]) -> int:
        """Calculate days since a date."""
        if not since_date:
            return 0
        return (datetime.utcnow() - since_date).days
    
    def _determine_priority(self, days_pending: int) -> str:
        """Determine priority based on days pending."""
        if days_pending > 14:
            return "urgent"
        elif days_pending > 7:
            return "high"
        elif days_pending > 3:
            return "normal"
        else:
            return "low"
    
    async def _record_review_action(self, action: ReviewAction) -> None:
        """Record review action in audit trail."""

        print(f"📝 Recording review action: {action.action} for {action.employee_id} at {action.stage}")
    
    async def _emit_stage_advanced_event(
        self,
        employee_id: UUID,
        from_stage: str,
        to_stage: str,
        reviewer_id: UUID,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Emit domain event for stage advancement."""
        event = DomainEvent(
            id=uuid4(),
            event_type="employee.stage_advanced",
            aggregate_id=employee_id,
            data={
                "from_stage": from_stage,
                "to_stage": to_stage,
                "reviewer_id": str(reviewer_id),
                **(additional_data or {})
            },
            occurred_at=datetime.utcnow()
        )
        await self.event_repository.save_event(event)
    
    async def _emit_rejection_event(
        self,
        employee_id: UUID,
        stage: str,
        reason: str,
        reviewer_id: UUID
    ) -> None:
        """Emit domain event for profile rejection."""
        event = DomainEvent(
            id=uuid4(),
            event_type="employee.profile_rejected",
            aggregate_id=employee_id,
            data={
                "stage": stage,
                "reason": reason,
                "reviewer_id": str(reviewer_id)
            },
            occurred_at=datetime.utcnow()
        )
        await self.event_repository.save_event(event)

    async def check_and_escalate_overdue_reviews(self) -> Dict[str, int]:
        """Check for overdue reviews and send escalation notifications."""
        
        escalation_thresholds = {
            "reminder": 3,  # 3 days
            "urgent": 7,    # 7 days
            "critical": 14  # 14 days
        }
        
        escalation_counts = {"reminder": 0, "urgent": 0, "critical": 0}
        
        # Get all pending reviews
        all_pending = []
        all_pending.extend(await self.get_pending_details_reviews(UUID(int=0), 1000))
        all_pending.extend(await self.get_pending_documents_reviews(UUID(int=0), 1000))
        all_pending.extend(await self.get_pending_role_assignments(UUID(int=0), 1000))
        all_pending.extend(await self.get_pending_final_approvals(UUID(int=0), 1000))
        
        for review in all_pending:
            days_pending = review.days_pending
            
            if days_pending >= escalation_thresholds["critical"]:
                await self._send_critical_escalation(review)
                escalation_counts["critical"] += 1
            elif days_pending >= escalation_thresholds["urgent"]:
                await self._send_urgent_escalation(review)
                escalation_counts["urgent"] += 1
            elif days_pending >= escalation_thresholds["reminder"]:
                await self._send_reminder_escalation(review)
                escalation_counts["reminder"] += 1
        
        return escalation_counts

    async def _send_critical_escalation(self, review: PendingReview):
        """Send critical escalation for very overdue reviews."""
        if self.notification_service and review.employee.user_id:
            await self.notification_service._create_notification(
                user_id=review.employee.user_id,
                type="ACTION_REQUIRED",
                title="🚨 Profile Review Severely Overdue",
                message=f"Your profile has been pending review for {review.days_pending} days. This has been escalated to senior management.",
                data={"escalation_level": "critical", "days_pending": review.days_pending}
            )



    async def _validate_documents_completion(self, doc_summary: Dict[str, Any]) -> DocumentValidationResult:
        """Validate that all required documents are properly approved."""
        
        required_count = doc_summary.get("required_documents_count", 0)
        approved_count = doc_summary.get("required_approved_count", 0)
        
        if required_count == 0:
            return DocumentValidationResult(
                False, "No required documents found. At least one ID document is required.", 0, 0
            )
        
        if approved_count < required_count:
            missing_count = required_count - approved_count
            return DocumentValidationResult(
                False, 
                f"{missing_count} required document(s) still need approval",
                required_count,
                approved_count
            )
        
        return DocumentValidationResult(True, "", required_count, approved_count)    