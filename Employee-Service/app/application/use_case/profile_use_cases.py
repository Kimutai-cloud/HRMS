from uuid import uuid4, UUID
from datetime import datetime
from typing import List, Optional
import os
from pathlib import Path

from app.core.entities.employee import Employee, EmploymentStatus, VerificationStatus
from app.core.entities.document import EmployeeDocument, DocumentType, DocumentReviewStatus
from app.core.entities.role import RoleCode
from app.core.entities.events import EmployeeCreatedEvent
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeValidationException,
    EmployeeAlreadyExistsException
)
from app.core.interfaces.repositories import EmployeeRepositoryInterface, EventRepositoryInterface, RoleRepositoryInterface
from app.infrastructure.external.auth_service_client import AuthServiceClient
from app.application.dto.profile_dto import (
    SubmitProfileRequest,
    DocumentUploadRequest,
    ProfileStatusResponse
)
from app.presentation.schema.profile_schema import (
    EmployeeProfileResponse,
    ProfileVerificationStatusResponse,
    DocumentResponse,
    DepartmentResponse,
    ManagerOptionResponse
)


class ProfileUseCase:
    """Use cases for employee profile management and submission."""
    
    def __init__(
        self,
        employee_repository: EmployeeRepositoryInterface,
        role_repository: RoleRepositoryInterface,
        event_repository: EventRepositoryInterface,
        auth_service_client: AuthServiceClient
    ):
        self.employee_repository = employee_repository
        self.role_repository = role_repository
        self.event_repository = event_repository
        self.auth_service_client = auth_service_client
    
    async def submit_employee_profile(self, request: SubmitProfileRequest) -> EmployeeProfileResponse:
        """Submit employee profile for verification workflow."""
        
        # Check if employee already exists for this user
        existing_employee = await self.employee_repository.get_by_user_id(request.user_id)
        if existing_employee:
            if not existing_employee.can_resubmit():
                raise EmployeeAlreadyExistsException(
                    f"Employee profile already exists with status: {existing_employee.verification_status.value}"
                )
            # If can resubmit, we'll update the existing record
            return await self._update_existing_profile(existing_employee, request)
        
        # Check if email is already used by another employee
        existing_by_email = await self.employee_repository.get_by_email(request.email)
        if existing_by_email:
            raise EmployeeAlreadyExistsException("An employee with this email already exists")
        
        # Validate manager if specified
        if request.manager_id:
            manager = await self.employee_repository.get_by_id(request.manager_id)
            if not manager or not manager.is_active():
                raise EmployeeValidationException("Selected manager is not valid or active")
        
        # Create new employee
        employee = Employee(
            id=uuid4(),
            user_id=request.user_id,
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            phone=request.phone,
            title=request.title,
            department=request.department,
            manager_id=request.manager_id,
            employment_status=EmploymentStatus.ACTIVE,
            verification_status=VerificationStatus.PENDING_DETAILS_REVIEW,
            hired_at=None,  # Will be set when verified
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            submitted_at=datetime.utcnow(),
            version=1
        )
        
        # Submit profile (sets verification status and submitted_at)
        employee.submit_profile(request.user_id)
        
        # Save employee
        created_employee = await self.employee_repository.create(employee)
        
        # Auto-assign NEWCOMER role
        await self._assign_newcomer_role(request.user_id)
        
        # Update Auth Service status
        await self._sync_auth_service_status(request.user_id, "PENDING_VERIFICATION")
        
        # Emit domain event
        event = EmployeeCreatedEvent(
            employee_id=created_employee.id,
            employee_data={
                "user_id": str(request.user_id),
                "email": request.email,
                "first_name": request.first_name,
                "last_name": request.last_name,
                "department": request.department,
                "verification_status": created_employee.verification_status.value,
                "submitted_at": created_employee.submitted_at.isoformat()
            }
        )
        await self.event_repository.save_event(event)
        
        print(f"✅ Employee profile submitted: {created_employee.email}")
        print(f"🔄 Status: {created_employee.verification_status.value}")
        print(f"👤 User ID: {request.user_id}")
        
        return await self._to_profile_response(created_employee)
    
    async def resubmit_employee_profile(self, request: SubmitProfileRequest) -> EmployeeProfileResponse:
        """Resubmit employee profile after rejection."""
        
        existing_employee = await self.employee_repository.get_by_user_id(request.user_id)
        if not existing_employee:
            raise EmployeeNotFoundException("Employee profile not found")
        
        if not existing_employee.can_resubmit():
            raise EmployeeValidationException(
                f"Cannot resubmit profile with status: {existing_employee.verification_status.value}"
            )
        
        return await self._update_existing_profile(existing_employee, request)
    
    async def _update_existing_profile(self, employee: Employee, request: SubmitProfileRequest) -> EmployeeProfileResponse:
        """Update existing employee profile for resubmission."""
        
        # Validate manager if specified
        if request.manager_id and request.manager_id != employee.manager_id:
            manager = await self.employee_repository.get_by_id(request.manager_id)
            if not manager or not manager.is_active():
                raise EmployeeValidationException("Selected manager is not valid or active")
        
        # Update employee details
        employee.first_name = request.first_name
        employee.last_name = request.last_name
        employee.phone = request.phone
        employee.title = request.title
        employee.department = request.department
        employee.manager_id = request.manager_id
        employee.updated_at = datetime.utcnow()
        
        # Submit profile (resets verification status and clears rejection info)
        employee.submit_profile(request.user_id)
        
        # Save updated employee
        updated_employee = await self.employee_repository.update(employee)
        
        # Update Auth Service status
        await self._sync_auth_service_status(request.user_id, "PENDING_VERIFICATION")
        
        print(f"✅ Employee profile resubmitted: {updated_employee.email}")
        print(f"🔄 Status: {updated_employee.verification_status.value}")
        
        return await self._to_profile_response(updated_employee)
    
    async def get_employee_profile_by_user_id(self, user_id: UUID) -> EmployeeProfileResponse:
        """Get employee profile by user ID."""
        
        employee = await self.employee_repository.get_by_user_id(user_id)
        if not employee:
            raise EmployeeNotFoundException("Employee profile not found")
        
        return await self._to_profile_response(employee)
    
    async def get_profile_verification_status(self, user_id: UUID) -> ProfileVerificationStatusResponse:
        """Get detailed verification status for user's profile."""
        
        employee = await self.employee_repository.get_by_user_id(user_id)
        if not employee:
            raise EmployeeNotFoundException("Employee profile not found")
        
        # Calculate progress percentage
        status_progress = {
            VerificationStatus.NOT_SUBMITTED: 0,
            VerificationStatus.PENDING_DETAILS_REVIEW: 25,
            VerificationStatus.PENDING_DOCUMENTS_REVIEW: 50,
            VerificationStatus.PENDING_ROLE_ASSIGNMENT: 75,
            VerificationStatus.PENDING_FINAL_APPROVAL: 90,
            VerificationStatus.VERIFIED: 100,
            VerificationStatus.REJECTED: 0
        }
        
        # Determine completed stages
        completed_stages = {
            "details_review_completed": employee.verification_status in [
                VerificationStatus.PENDING_DOCUMENTS_REVIEW,
                VerificationStatus.PENDING_ROLE_ASSIGNMENT,
                VerificationStatus.PENDING_FINAL_APPROVAL,
                VerificationStatus.VERIFIED
            ],
            "documents_review_completed": employee.verification_status in [
                VerificationStatus.PENDING_ROLE_ASSIGNMENT,
                VerificationStatus.PENDING_FINAL_APPROVAL,
                VerificationStatus.VERIFIED
            ],
            "role_assignment_completed": employee.verification_status in [
                VerificationStatus.PENDING_FINAL_APPROVAL,
                VerificationStatus.VERIFIED
            ],
            "final_approval_completed": employee.verification_status == VerificationStatus.VERIFIED
        }
        
        # Generate next steps and required actions
        next_steps, required_actions = self._get_status_guidance(employee.verification_status)
        
        return ProfileVerificationStatusResponse(
            employee_id=employee.id,
            user_id=employee.user_id,
            verification_status=employee.verification_status,
            status_description=employee.get_verification_stage(),
            current_stage=self._get_current_stage_name(employee.verification_status),
            progress_percentage=status_progress.get(employee.verification_status, 0),
            submitted_at=employee.submitted_at,
            next_steps=next_steps,
            required_actions=required_actions,
            can_resubmit=employee.can_resubmit(),
            rejection_reason=employee.rejection_reason,
            rejected_at=employee.rejected_at,
            **completed_stages
        )
    
    async def upload_document(self, request: DocumentUploadRequest) -> DocumentResponse:
        """Upload document for employee profile."""
        
        # Create document entity
        document = EmployeeDocument(
            id=uuid4(),
            employee_id=request.employee_id,
            document_type=request.document_type,
            file_name=request.file_name,
            file_path=request.file_path,
            file_size=request.file_size,
            mime_type=request.mime_type,
            uploaded_at=datetime.utcnow(),
            uploaded_by=request.uploaded_by,
            is_required=request.is_required,
            review_status=DocumentReviewStatus.PENDING
        )
        
        # Save document (this would go to a document repository)
        # For now, we'll return the created document
        # In a real implementation, you'd have a DocumentRepository
        
        return DocumentResponse(
            id=document.id,
            document_type=document.document_type,
            display_name=document.get_display_name(),
            file_name=document.file_name,
            file_size=document.file_size,
            mime_type=document.mime_type,
            uploaded_at=document.uploaded_at,
            review_status=document.review_status,
            review_notes=document.review_notes,
            reviewed_at=document.reviewed_at,
            is_required=document.is_required
        )
    
    async def get_user_documents(self, user_id: UUID) -> List[DocumentResponse]:
        """Get all documents for a user's employee profile."""
        
        employee = await self.employee_repository.get_by_user_id(user_id)
        if not employee:
            raise EmployeeNotFoundException("Employee profile not found")
        
        # This would query a document repository
        # For now, return empty list
        return []
    
    async def delete_user_document(self, document_id: UUID, user_id: UUID) -> bool:
        """Delete a user's document if allowed."""
        
        employee = await self.employee_repository.get_by_user_id(user_id)
        if not employee:
            raise EmployeeNotFoundException("Employee profile not found")
        
        # Check if deletion is allowed
        if employee.verification_status not in [
            VerificationStatus.PENDING_DETAILS_REVIEW,
            VerificationStatus.PENDING_DOCUMENTS_REVIEW,
            VerificationStatus.REJECTED
        ]:
            raise EmployeeValidationException(
                "Document deletion not allowed for current verification status"
            )
        
        # This would delete from document repository and file system
        # For now, return True
        return True
    
    async def get_departments(self) -> List[DepartmentResponse]:
        """Get list of departments for profile selection."""
        
        # This would typically query a departments table or be configured
        # For now, return hardcoded departments
        departments = [
            DepartmentResponse(name="Engineering", description="Software development and technical operations"),
            DepartmentResponse(name="Human Resources", description="People operations and talent management"),
            DepartmentResponse(name="Finance", description="Financial planning and accounting"),
            DepartmentResponse(name="Marketing", description="Marketing and brand management"),
            DepartmentResponse(name="Sales", description="Sales and business development"),
            DepartmentResponse(name="Operations", description="Business operations and support"),
            DepartmentResponse(name="Legal", description="Legal and compliance"),
            DepartmentResponse(name="IT", description="Information technology and infrastructure")
        ]
        
        return departments
    
    async def get_managers(self, department_filter: Optional[str] = None) -> List[ManagerOptionResponse]:
        """Get list of managers for profile selection."""
        
        # Query for managers (employees with MANAGER role and VERIFIED status)
        # This would typically join with role assignments
        # For now, return sample managers
        
        managers = []
        
        # This would be a proper database query in real implementation
        # managers = await self.employee_repository.get_managers_by_department(department_filter)
        
        return managers
    
    async def _assign_newcomer_role(self, user_id: UUID):
        """Auto-assign NEWCOMER role to new user."""
        
        # Get NEWCOMER role
        newcomer_role = await self.role_repository.get_role_by_code(RoleCode.NEWCOMER)
        if not newcomer_role:
            print("⚠️  NEWCOMER role not found - skipping auto-assignment")
            return
        
        # Check if user already has the role
        existing_assignment = await self.role_repository.get_role_assignment(user_id, newcomer_role.id)
        if existing_assignment:
            print(f"✅ User {user_id} already has NEWCOMER role")
            return
        
        # Create role assignment
        from app.core.entities.role import RoleAssignment
        assignment = RoleAssignment(
            id=uuid4(),
            user_id=user_id,
            role_id=newcomer_role.id,
            scope={},
            created_at=datetime.utcnow()
        )
        
        await self.role_repository.assign_role(assignment)
        print(f"✅ NEWCOMER role assigned to user {user_id}")
    
    async def _sync_auth_service_status(self, user_id: UUID, status: str):
        """Sync employee profile status with Auth Service."""
        
        try:
            success = await self.auth_service_client.update_user_profile_status(user_id, status)
            if success:
                print(f"✅ Auth Service synced: User {user_id} status → {status}")
            else:
                print(f"⚠️  Auth Service sync failed for user {user_id}")
        except Exception as e:
            print(f"❌ Auth Service sync error: {e}")
    
    def _get_status_guidance(self, status: VerificationStatus) -> tuple[List[str], List[str]]:
        """Get next steps and required actions for verification status."""
        
        guidance = {
            VerificationStatus.PENDING_DETAILS_REVIEW: (
                ["Admin is reviewing your profile details", "You will be notified once review is complete"],
                []
            ),
            VerificationStatus.PENDING_DOCUMENTS_REVIEW: (
                ["Admin is reviewing your uploaded documents", "Ensure all required documents are uploaded"],
                ["Upload any missing required documents"]
            ),
            VerificationStatus.PENDING_ROLE_ASSIGNMENT: (
                ["Admin is determining your role assignment", "This process typically takes 1-2 business days"],
                []
            ),
            VerificationStatus.PENDING_FINAL_APPROVAL: (
                ["Your profile is pending final approval", "Senior admin will complete the verification process"],
                []
            ),
            VerificationStatus.VERIFIED: (
                ["Your profile is fully verified!", "You now have complete access to the system"],
                []
            ),
            VerificationStatus.REJECTED: (
                ["Your profile was rejected", "Review the feedback and resubmit with corrections"],
                ["Address the rejection feedback", "Resubmit your corrected profile"]
            )
        }
        
        return guidance.get(status, (["Contact support for assistance"], []))
    
    def _get_current_stage_name(self, status: VerificationStatus) -> str:
        """Get human-readable stage name."""
        
        stage_names = {
            VerificationStatus.NOT_SUBMITTED: "Not Submitted",
            VerificationStatus.PENDING_DETAILS_REVIEW: "Details Review",
            VerificationStatus.PENDING_DOCUMENTS_REVIEW: "Documents Review",
            VerificationStatus.PENDING_ROLE_ASSIGNMENT: "Role Assignment",
            VerificationStatus.PENDING_FINAL_APPROVAL: "Final Approval",
            VerificationStatus.VERIFIED: "Completed",
            VerificationStatus.REJECTED: "Rejected"
        }
        
        return stage_names.get(status, "Unknown")
    
    async def _to_profile_response(self, employee: Employee) -> EmployeeProfileResponse:
        """Convert employee entity to profile response."""
        
        # Get verification status details
        verification_details = await self.get_profile_verification_status(employee.user_id)
        
        # Get documents (would be from document repository)
        documents = await self.get_user_documents(employee.user_id)
        
        return EmployeeProfileResponse(
            id=employee.id,
            user_id=employee.user_id,
            first_name=employee.first_name,
            last_name=employee.last_name,
            email=employee.email,
            phone=employee.phone,
            title=employee.title,
            department=employee.department,
            manager_id=employee.manager_id,
            verification_status=employee.verification_status,
            submitted_at=employee.submitted_at,
            created_at=employee.created_at,
            updated_at=employee.updated_at,
            version=employee.version,
            documents=documents,
            verification_details=verification_details
        )