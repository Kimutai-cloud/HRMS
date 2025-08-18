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
    priority: str = "normal"  # low, normal, high, urgent


class AdminReviewUseCase:
    """Use cases for admin review workflow and stage management."""
    
    def __init__(
        self,
        employee_repository: EmployeeRepositoryInterface,
        document_repository: DocumentRepositoryInterface,
        role_repository: RoleRepositoryInterface,
        event_repository: EventRepositoryInterface,
        rbac_service: RoleBasedAccessControlService,
        auth_service_client: AuthServiceClient
    ):
        self.employee_repository = employee_repository
        self.document_repository = document_repository
        self.role_repository = role_repository
        self.event_repository = event_repository
        self.rbac_service = rbac_service
        self.auth_service_client = auth_service_client
    
    # Dashboard and Summary Methods
    
    async def get_admin_dashboard_summary(self, admin_user_id: UUID) -> Dict[str, Any]:
        """Get comprehensive dashboard summary for admin."""
        
        # Verify admin permissions
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        # Get pending counts for each stage
        details_pending = await self._get_pending_count(VerificationStatus.PENDING_DETAILS_REVIEW)
        documents_pending = await self._get_pending_count(VerificationStatus.PENDING_DOCUMENTS_REVIEW)
        roles_pending = await self._get_pending_count(VerificationStatus.PENDING_ROLE_ASSIGNMENT)
        final_pending = await self._get_pending_count(VerificationStatus.PENDING_FINAL_APPROVAL)
        
        # Get document statistics
        doc_stats = await self.document_repository.get_document_statistics()
        
        # Calculate urgency (profiles pending > 7 days)
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
    
    # Stage 1: Details Review
    
    async def get_pending_details_reviews(self, admin_user_id: UUID, limit: int = 50) -> List[PendingReview]:
        """Get employees pending details review."""
        
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        # Get employees in details review stage
        result = await self.employee_repository.list_employees(
            page=1,
            size=limit,
            status=None,  # All statuses
            sort_by="submitted_at",
            sort_order="asc"  # Oldest first
        )
        
        # Filter for details review and enrich with metadata
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
        
        # Validate current stage
        if employee.verification_status != VerificationStatus.PENDING_DETAILS_REVIEW:
            raise EmployeeValidationException(
                f"Cannot approve details for employee in status: {employee.verification_status.value}"
            )
        
        # Advance to next stage
        employee.advance_verification_stage(VerificationStatus.PENDING_DOCUMENTS_REVIEW, reviewer_id)
        
        # Save employee
        updated_employee = await self.employee_repository.update(employee)
        
        # Record review action
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage="DETAILS_REVIEW",
            action="APPROVED",
            performed_by=reviewer_id,
            notes=notes
        ))
        
        # Sync with Auth Service
        await self.auth_service_client.update_user_profile_status(
            updated_employee.user_id, "PENDING_VERIFICATION"
        )
        
        # Emit domain event
        await self._emit_stage_advanced_event(employee_id, "DETAILS_REVIEW", "DOCUMENTS_REVIEW", reviewer_id)
        
        print(f"✅ Details approved for employee {employee_id}, advanced to documents review")
        return updated_employee
    
    # Stage 2: Documents Review
    
    async def get_pending_documents_reviews(self, admin_user_id: UUID, limit: int = 50) -> List[PendingReview]:
        """Get employees pending documents review."""
        
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        # Get employees in documents review stage
        result = await self.employee_repository.list_employees(
            page=1,
            size=limit,
            status=None,
            sort_by="updated_at",
            sort_order="asc"
        )
        
        pending_reviews = []
        for employee in result["employees"]:
            if employee.verification_status == VerificationStatus.PENDING_DOCUMENTS_REVIEW:
                # Get document summary for this employee
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
        
        # Validate current stage
        if employee.verification_status != VerificationStatus.PENDING_DOCUMENTS_REVIEW:
            raise EmployeeValidationException(
                f"Cannot approve documents for employee in status: {employee.verification_status.value}"
            )
        
        # Check that all required documents are approved
        doc_summary = await self.document_repository.get_employee_document_summary(employee_id)
        if not doc_summary.get("all_required_approved", False):
            raise EmployeeValidationException(
                "Cannot approve documents review: not all required documents are approved"
            )
        
        # Advance to next stage
        employee.advance_verification_stage(VerificationStatus.PENDING_ROLE_ASSIGNMENT, reviewer_id)
        
        # Save employee
        updated_employee = await self.employee_repository.update(employee)
        
        # Record review action
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage="DOCUMENTS_REVIEW",
            action="APPROVED",
            performed_by=reviewer_id,
            notes=notes
        ))
        
        # Emit domain event
        await self._emit_stage_advanced_event(employee_id, "DOCUMENTS_REVIEW", "ROLE_ASSIGNMENT", reviewer_id)
        
        print(f"✅ Documents approved for employee {employee_id}, advanced to role assignment")
        return updated_employee
    
    # Stage 3: Role Assignment
    
    async def get_pending_role_assignments(self, admin_user_id: UUID, limit: int = 50) -> List[PendingReview]:
        """Get employees pending role assignment."""
        
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        # Get employees in role assignment stage
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
        
        # Validate current stage
        if employee.verification_status != VerificationStatus.PENDING_ROLE_ASSIGNMENT:
            raise EmployeeValidationException(
                f"Cannot assign role for employee in status: {employee.verification_status.value}"
            )
        
        # Get the role
        role = await self.role_repository.get_role_by_code(role_code)
        if not role:
            raise EmployeeValidationException(f"Role {role_code.value} not found")
        
        # Remove NEWCOMER role and assign new role
        try:
            # Revoke NEWCOMER role
            newcomer_role = await self.role_repository.get_role_by_code(RoleCode.NEWCOMER)
            if newcomer_role:
                await self.role_repository.revoke_role(employee.user_id, newcomer_role.id)
            
            # Assign new role
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
        
        # Advance to final approval stage
        employee.advance_verification_stage(VerificationStatus.PENDING_FINAL_APPROVAL, reviewer_id)
        
        # Save employee
        updated_employee = await self.employee_repository.update(employee)
        
        # Record review action
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage="ROLE_ASSIGNMENT",
            action="ROLE_ASSIGNED",
            performed_by=reviewer_id,
            notes=notes,
            additional_data={"assigned_role": role_code.value}
        ))
        
        # Emit domain event
        await self._emit_stage_advanced_event(
            employee_id, "ROLE_ASSIGNMENT", "FINAL_APPROVAL", reviewer_id,
            additional_data={"assigned_role": role_code.value}
        )
        
        print(f"✅ Role {role_code.value} assigned to employee {employee_id}, advanced to final approval")
        return updated_employee
    
    # Stage 4: Final Approval
    
    async def get_pending_final_approvals(self, admin_user_id: UUID, limit: int = 50) -> List[PendingReview]:
        """Get employees pending final approval."""
        
        # Note: This might require SENIOR_ADMIN role in the future
        if not await self.rbac_service.is_admin(admin_user_id):
            raise ForbiddenException("Admin role required")
        
        # Get employees in final approval stage
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
        
        # Validate current stage
        if employee.verification_status != VerificationStatus.PENDING_FINAL_APPROVAL:
            raise EmployeeValidationException(
                f"Cannot final approve employee in status: {employee.verification_status.value}"
            )
        
        # Final approval
        employee.final_approve(approver_id)
        employee.hired_at = datetime.utcnow()  # Set hire date
        
        # Save employee
        updated_employee = await self.employee_repository.update(employee)
        
        # Record review action
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage="FINAL_APPROVAL",
            action="FINAL_APPROVED",
            performed_by=approver_id,
            notes=notes
        ))
        
        # Sync with Auth Service - user now has full access
        await self.auth_service_client.update_user_profile_status(
            updated_employee.user_id, "VERIFIED"
        )
        
        # Emit domain event
        await self._emit_stage_advanced_event(employee_id, "FINAL_APPROVAL", "VERIFIED", approver_id)
        
        print(f"🎉 Employee {employee_id} fully verified and approved!")
        return updated_employee
    
    # Rejection Methods
    
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
        
        # Validate that employee can be rejected
        if employee.verification_status in [VerificationStatus.VERIFIED, VerificationStatus.REJECTED]:
            raise EmployeeValidationException(
                f"Cannot reject employee in status: {employee.verification_status.value}"
            )
        
        current_stage = stage or employee.verification_status.value
        
        # Reject the profile
        employee.reject_verification(reason, reviewer_id)
        
        # Save employee
        updated_employee = await self.employee_repository.update(employee)
        
        # Record review action
        await self._record_review_action(ReviewAction(
            employee_id=employee_id,
            stage=current_stage,
            action="REJECTED",
            performed_by=reviewer_id,
            notes=reason
        ))
        
        # Sync with Auth Service
        await self.auth_service_client.update_user_profile_status(
            updated_employee.user_id, "REJECTED"
        )
        
        # Emit domain event
        await self._emit_rejection_event(employee_id, current_stage, reason, reviewer_id)
        
        print(f"❌ Employee {employee_id} rejected at {current_stage} stage")
        return updated_employee
    
    # Bulk Operations
    
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
                # Continue with other employees
        
        print(f"✅ Bulk approved {len(approved_employees)}/{len(employee_ids)} employees at {stage}")
        return approved_employees
    
    # Helper Methods
    
    async def _get_pending_count(self, status: VerificationStatus) -> int:
        """Get count of employees with specific verification status."""
        # This would be more efficient with a dedicated count query
        result = await self.employee_repository.list_employees(
            page=1, size=1000, status=None
        )
        return len([e for e in result["employees"] if e.verification_status == status])
    
    async def _get_urgent_reviews(self) -> List[PendingReview]:
        """Get reviews that are urgent (pending > 7 days)."""
        # Implementation would query for old pending reviews
        return []  # Placeholder
    
    async def _calculate_completion_rate(self) -> float:
        """Calculate verification completion rate."""
        # Implementation would calculate percentage of verified vs total
        return 0.0  # Placeholder
    
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
        # This would save to approval_stages table
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