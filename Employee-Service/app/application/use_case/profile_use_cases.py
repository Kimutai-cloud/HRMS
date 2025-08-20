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
    """Enhanced use cases for employee profile management and submission."""
    
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
        """Enhanced profile submission with proper Auth Service integration."""
        
        print(f"🚀 Starting profile submission for user {request.user_id}")
        
        existing_employee = await self.employee_repository.get_by_user_id(request.user_id)
        if existing_employee:
            if not existing_employee.can_resubmit():
                raise EmployeeAlreadyExistsException(
                    f"Employee profile already exists with status: {existing_employee.verification_status.value}"
                )
            print(f"🔄 Updating existing employee profile for resubmission")
            return await self._update_existing_profile(existing_employee, request)
        
        existing_by_email = await self.employee_repository.get_by_email(request.email)
        if existing_by_email and existing_by_email.user_id != request.user_id:
            raise EmployeeAlreadyExistsException("An employee with this email already exists")
        
        if request.manager_id:
            manager = await self.employee_repository.get_by_id(request.manager_id)
            if not manager or not manager.is_active():
                raise EmployeeValidationException("Selected manager is not valid or active")
            
            if await self.employee_repository.check_circular_managership(
                employee_id=uuid4(), 
                manager_id=request.manager_id
            ):
                raise EmployeeValidationException("Manager assignment would create circular relationship")
        
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
            hired_at=None,  
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            version=1
        )
        
        employee.submit_profile(request.user_id)
        
        try:
            created_employee = await self.employee_repository.create(employee)
            print(f"✅ Employee created in database: {created_employee.id}")
        except Exception as e:
            print(f"❌ Failed to create employee: {e}")
            raise EmployeeValidationException(f"Failed to create employee profile: {str(e)}")
        
        try:
            await self._assign_newcomer_role(request.user_id)
            print(f"✅ NEWCOMER role assigned to user {request.user_id}")
        except Exception as e:
            print(f"⚠️  Warning: Failed to assign NEWCOMER role: {e}")
        
        try:
            success = await self._sync_auth_service_status(request.user_id, "PENDING_VERIFICATION")
            if success:
                print(f"✅ Auth Service status updated to PENDING_VERIFICATION")
            else:
                print(f"⚠️  Warning: Auth Service sync failed (non-critical)")
        except Exception as e:
            print(f"⚠️  Warning: Auth Service sync error (non-critical): {e}")

        event = EmployeeCreatedEvent(
            employee_id=created_employee.id,
            employee_data={
                "user_id": str(request.user_id),
                "email": request.email,
                "first_name": request.first_name,
                "last_name": request.last_name,
                "department": request.department,
                "verification_status": created_employee.verification_status.value,
                "submitted_at": created_employee.submitted_at.isoformat() if created_employee.submitted_at else None
            }
        )
        await self.event_repository.save_event(event)
        
        print(f"🎉 Profile submission completed successfully!")
        print(f"📋 Employee ID: {created_employee.id}")
        print(f"👤 User ID: {request.user_id}")
        print(f"🔄 Status: {created_employee.verification_status.value}")
        
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
        
        print(f"🔄 Resubmitting profile for employee {existing_employee.id}")
        return await self._update_existing_profile(existing_employee, request)
    
    async def _update_existing_profile(self, employee: Employee, request: SubmitProfileRequest) -> EmployeeProfileResponse:
        """Update existing employee profile for resubmission."""
        
        if request.manager_id and request.manager_id != employee.manager_id:
            manager = await self.employee_repository.get_by_id(request.manager_id)
            if not manager or not manager.is_active():
                raise EmployeeValidationException("Selected manager is not valid or active")
            
            if await self.employee_repository.check_circular_managership(
                employee_id=employee.id,
                manager_id=request.manager_id
            ):
                raise EmployeeValidationException("Manager assignment would create circular relationship")
        
        previous_status = employee.verification_status.value
        
        employee.first_name = request.first_name
        employee.last_name = request.last_name
        employee.phone = request.phone
        employee.title = request.title
        employee.department = request.department
        employee.manager_id = request.manager_id
        employee.updated_at = datetime.utcnow()
        employee.version += 1
        
        employee.submit_profile(request.user_id)
        
        updated_employee = await self.employee_repository.update(employee)
        
        try:
            await self._sync_auth_service_status(request.user_id, "PENDING_VERIFICATION")
            print(f"✅ Auth Service status updated after resubmission")
        except Exception as e:
            print(f"⚠️  Warning: Auth Service sync failed after resubmission: {e}")
        
        print(f"🔄 Profile resubmitted: {updated_employee.email}")
        print(f"📊 Status change: {previous_status} → {updated_employee.verification_status.value}")
        
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
            rejection_reason=getattr(employee, 'rejection_reason', None),
            rejected_at=getattr(employee, 'rejected_at', None),
            **completed_stages
        )
    
    async def upload_document(self, request: DocumentUploadRequest) -> DocumentResponse:
        """Upload document for employee profile verification."""
        
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
        
        return True
    
    async def get_departments(self) -> List[DepartmentResponse]:
        """Get list of departments for profile selection."""
        
        # In a real implementation, this would query a departments table
        # For now, return hardcoded departments with enhanced information
        departments = [
            DepartmentResponse(name="Engineering", description="Software development and technical operations"),
            DepartmentResponse(name="Human Resources", description="People operations and talent management"),
            DepartmentResponse(name="Finance", description="Financial planning and accounting"),
            DepartmentResponse(name="Marketing", description="Marketing and brand management"),
            DepartmentResponse(name="Sales", description="Sales and business development"),
            DepartmentResponse(name="Operations", description="Business operations and support"),
            DepartmentResponse(name="Legal", description="Legal and compliance"),
            DepartmentResponse(name="IT", description="Information technology and infrastructure"),
            DepartmentResponse(name="Product", description="Product management and strategy"),
            DepartmentResponse(name="Customer Success", description="Customer support and success")
        ]
        
        return departments
    
    async def get_managers(self, department_filter: Optional[str] = None) -> List[ManagerOptionResponse]:
        """Get list of managers for profile selection."""
        
        # Query for active employees who could be managers
        # This is a simplified implementation - in reality you'd want to:
        # 1. Query employees with MANAGER role
        # 2. Filter by department if specified
        # 3. Only show active, verified employees
        
        try:
            result = await self.employee_repository.list_employees(
                page=1,
                size=100,
                status=EmploymentStatus.ACTIVE
            )
            
            managers = []
            for employee in result["employees"]:
                if employee.verification_status == VerificationStatus.VERIFIED:
                    if department_filter and employee.department != department_filter:
                        continue
                    
                    managers.append(ManagerOptionResponse(
                        id=employee.id,
                        full_name=employee.get_full_name(),
                        title=employee.title or "Manager",
                        department=employee.department or "Unassigned",
                        email=employee.email
                    ))
            
            return managers
            
        except Exception as e:
            print(f"⚠️  Warning: Failed to load managers: {e}")
            return []
    
    async def _assign_newcomer_role(self, user_id: UUID):
        """Auto-assign NEWCOMER role to new user."""
        
        try:
            newcomer_role = await self.role_repository.get_role_by_code(RoleCode.NEWCOMER)
            if not newcomer_role:
                print("⚠️  NEWCOMER role not found in database - skipping auto-assignment")
                return
            
            existing_assignment = await self.role_repository.get_role_assignment(user_id, newcomer_role.id)
            if existing_assignment:
                print(f"✅ User {user_id} already has NEWCOMER role")
                return
            
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
            
        except Exception as e:
            print(f"❌ Error assigning NEWCOMER role to user {user_id}: {e}")
            raise 
    
    async def _sync_auth_service_status(self, user_id: UUID, status: str) -> bool:
        """Sync employee profile status with Auth Service."""
        
        try:
            success = await self.auth_service_client.update_user_profile_status(user_id, status)
            if success:
                print(f"✅ Auth Service synced: User {user_id} status → {status}")
                return True
            else:
                print(f"⚠️  Auth Service sync returned failure for user {user_id}")
                return False
        except Exception as e:
            print(f"❌ Auth Service sync error for user {user_id}: {e}")
            return False
    
    def _get_status_guidance(self, status: VerificationStatus) -> tuple[List[str], List[str]]:
        """Get next steps and required actions for verification status."""
        
        guidance = {
            VerificationStatus.NOT_SUBMITTED: (
                ["Complete your employee profile to get started"],
                ["Fill in all required profile information", "Submit your profile for review"]
            ),
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
                ["Address the rejection feedback", "Update your profile information", "Resubmit your corrected profile"]
            )
        }
        
        return guidance.get(status, (["Contact support for assistance"], []))
    
    def _get_current_stage_name(self, status: VerificationStatus) -> str:
        """Get human-readable stage name."""
        
        stage_names = {
            VerificationStatus.NOT_SUBMITTED: "Not Started",
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
        
        verification_details = await self.get_profile_verification_status(employee.user_id)
        
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
            submitted_at=getattr(employee, 'submitted_at', None),
            created_at=employee.created_at,
            updated_at=employee.updated_at,
            version=employee.version,
            documents=documents,
            verification_details=verification_details
        )