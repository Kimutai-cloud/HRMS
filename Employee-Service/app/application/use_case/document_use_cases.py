from uuid import uuid4, UUID
from datetime import datetime
from typing import List, Optional, Dict, Any, BinaryIO
from pathlib import Path
import aiofiles
import aiofiles.os
import mimetypes

from app.core.entities.document import EmployeeDocument, DocumentType, DocumentReviewStatus
from app.core.entities.employee import VerificationStatus
from app.core.entities.events import DomainEvent
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeValidationException,
    EmployeePermissionException
)
from app.core.interfaces.repositories import EmployeeRepositoryInterface, EventRepositoryInterface
from app.infrastructure.database.repositories.document_repository import DocumentRepositoryInterface
from app.infrastructure.external.auth_service_client import AuthServiceClient
from app.config.settings import settings


class DocumentNotFoundException(Exception):
    """Raised when document is not found."""
    pass


class DocumentValidationException(Exception):
    """Raised when document validation fails."""
    pass


class DocumentUseCase:
    """Use cases for document management and review."""
    
    def __init__(
        self,
        document_repository: DocumentRepositoryInterface,
        employee_repository: EmployeeRepositoryInterface,
        event_repository: EventRepositoryInterface,
        auth_service_client: AuthServiceClient
    ):
        self.document_repository = document_repository
        self.employee_repository = employee_repository
        self.event_repository = event_repository
        self.auth_service_client = auth_service_client
    
    async def upload_document(
        self,
        employee_id: UUID,
        uploaded_by: UUID,
        document_type: DocumentType,
        file_content: bytes,
        file_name: str,
        mime_type: str,
        is_required: bool = True,
        notes: Optional[str] = None
    ) -> EmployeeDocument:
        """Upload a document for an employee."""
        
        # Validate employee exists and can upload documents
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            raise EmployeeNotFoundException(f"Employee {employee_id} not found")
        
        # Check if employee can upload documents
        if not self._can_upload_documents(employee.verification_status):
            raise EmployeeValidationException(
                f"Document uploads not allowed for verification status: {employee.verification_status.value}"
            )
        
        # Validate file type and size
        self._validate_file(file_content, file_name, mime_type)
        
        # Create upload directory
        upload_dir = Path(settings.UPLOAD_DIR) / "employee_documents" / str(employee_id)
        await self._ensure_directory_exists(upload_dir)
        
        # Generate unique file name
        file_id = uuid4()
        file_extension = Path(file_name).suffix
        saved_filename = f"{file_id}{file_extension}"
        file_path = upload_dir / saved_filename
        
        # Save file to disk
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(file_content)
        
        # Create document entity
        document = EmployeeDocument(
            id=uuid4(),
            employee_id=employee_id,
            document_type=document_type,
            file_name=file_name,
            file_path=str(file_path),
            file_size=len(file_content),
            mime_type=mime_type,
            uploaded_at=datetime.utcnow(),
            uploaded_by=uploaded_by,
            review_status=DocumentReviewStatus.PENDING,
            is_required=is_required
        )
        
        # Save to database
        try:
            created_document = await self.document_repository.create(document)
            
            # Emit domain event
            event = DomainEvent(
                id=uuid4(),
                event_type="document.uploaded",
                aggregate_id=employee_id,
                data={
                    "document_id": str(created_document.id),
                    "document_type": document_type.value,
                    "file_name": file_name,
                    "uploaded_by": str(uploaded_by),
                    "is_required": is_required
                },
                occurred_at=datetime.utcnow()
            )
            await self.event_repository.save_event(event)
            
            print(f"✅ Document uploaded: {file_name} for employee {employee_id}")
            return created_document
            
        except Exception as e:
            # Clean up file if database operation failed
            try:
                await aiofiles.os.remove(file_path)
            except:
                pass
            raise e
    
    async def get_employee_document_summary(self, employee_id: UUID) -> Dict[str, Any]:
        """Get document summary for an employee."""
        return await self.document_repository.get_employee_document_summary(employee_id)
    
    # Private helper methods
    
    def _can_upload_documents(self, verification_status: VerificationStatus) -> bool:
        """Check if documents can be uploaded for current verification status."""
        allowed_statuses = [
            VerificationStatus.PENDING_DETAILS_REVIEW,
            VerificationStatus.PENDING_DOCUMENTS_REVIEW,
            VerificationStatus.REJECTED
        ]
        return verification_status in allowed_statuses
    
    def _can_delete_documents(self, verification_status: VerificationStatus) -> bool:
        """Check if documents can be deleted for current verification status."""
        allowed_statuses = [
            VerificationStatus.PENDING_DETAILS_REVIEW,
            VerificationStatus.PENDING_DOCUMENTS_REVIEW,
            VerificationStatus.REJECTED
        ]
        return verification_status in allowed_statuses
    
    def _validate_file(self, file_content: bytes, file_name: str, mime_type: str) -> None:
        """Validate uploaded file."""
        
        # Check file size
        if len(file_content) > settings.MAX_FILE_SIZE:
            raise DocumentValidationException(
                f"File size {len(file_content)} exceeds maximum allowed size {settings.MAX_FILE_SIZE}"
            )
        
        # Check file extension
        file_extension = Path(file_name).suffix.lower().lstrip('.')
        if file_extension not in settings.ALLOWED_FILE_TYPES:
            raise DocumentValidationException(
                f"File type '{file_extension}' not allowed. Allowed types: {', '.join(settings.ALLOWED_FILE_TYPES)}"
            )
        
        # Validate MIME type matches extension
        expected_mime = mimetypes.guess_type(file_name)[0]
        if expected_mime and not mime_type.startswith(expected_mime.split('/')[0]):
            print(f"⚠️  MIME type mismatch: expected {expected_mime}, got {mime_type}")
            # Don't raise error, just log warning as browsers can send different MIME types
    
    async def _ensure_directory_exists(self, directory: Path) -> None:
        """Ensure directory exists, create if not."""
        try:
            await aiofiles.os.makedirs(directory, exist_ok=True)
        except Exception as e:
            raise DocumentValidationException(f"Failed to create upload directory: {e}")
    
    async def _can_access_employee_documents(self, employee_id: UUID, requester_user_id: UUID) -> bool:
        """Check if user can access employee documents."""
        # This would integrate with RBAC service
        # For now, simplified logic:
        # 1. User can access their own documents
        # 2. Admins can access all documents
        # 3. Managers can access their team's documents
        
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            return False
        
        # Check if it's the user's own documents (via user_id or email matching)
        if employee.user_id == requester_user_id:
            return True
        
        # TODO: Add RBAC integration here
        # For now, assume admin access if not own documents
        return True  # This should be replaced with proper RBAC check
    
    async def _can_delete_employee_documents(self, employee_id: UUID, requester_user_id: UUID) -> bool:
        """Check if user can delete employee documents."""
        # Similar to access check but more restrictive
        employee = await self.employee_repository.get_by_id(employee_id)
        if not employee:
            return False
        
        # Users can delete their own documents if verification allows it
        if employee.user_id == requester_user_id:
            return True
        
        # TODO: Add admin check via RBAC
        return True  # This should be replaced with proper RBAC check
    
    async def _check_documents_completion(self, employee_id: UUID) -> None:
        """Check if all required documents are approved and advance stage if needed."""
        
        # Get document summary
        summary = await self.get_employee_document_summary(employee_id)
        
        # If all required documents are approved, potentially advance to next stage
        if summary.get("all_required_approved", False):
            employee = await self.employee_repository.get_by_id(employee_id)
            
            # If employee is in documents review stage, they might be ready for role assignment
            if employee and employee.verification_status == VerificationStatus.PENDING_DOCUMENTS_REVIEW:
                print(f"✅ All required documents approved for employee {employee_id}")
                # Note: The actual stage advancement will be handled by AdminReviewUseCase
                # This is just notification that documents are complete
    
    async def bulk_approve_documents(
        self,
        document_ids: List[UUID],
        reviewer_id: UUID,
        notes: Optional[str] = None
    ) -> List[EmployeeDocument]:
        """Approve multiple documents at once."""
        
        approved_documents = []
        
        for document_id in document_ids:
            try:
                approved_doc = await self.approve_document(document_id, reviewer_id, notes)
                approved_documents.append(approved_doc)
            except Exception as e:
                print(f"❌ Failed to approve document {document_id}: {e}")
                # Continue with other documents
        
        return approved_documents
    
    async def get_documents_requiring_attention(self, limit: int = 50) -> Dict[str, List[EmployeeDocument]]:
        """Get documents that require admin attention."""
        
        pending = await self.document_repository.get_documents_by_status(
            DocumentReviewStatus.PENDING, limit
        )
        
        requires_replacement = await self.document_repository.get_documents_by_status(
            DocumentReviewStatus.REQUIRES_REPLACEMENT, limit
        )
        
        return {
            "pending_review": pending,
            "requires_replacement": requires_replacement,
            "total_requiring_attention": len(pending) + len(requires_replacement)
        }
    
    async def get_document(self, document_id: UUID, requester_user_id: UUID) -> EmployeeDocument:
        """Get a specific document."""
        
        document = await self.document_repository.get_by_id(document_id)
        if not document:
            raise DocumentNotFoundException(f"Document {document_id} not found")
        
        # Check permissions
        if not await self._can_access_employee_documents(document.employee_id, requester_user_id):
            raise EmployeePermissionException("Insufficient permissions to view document")
        
        return document
    
    async def download_document(self, document_id: UUID, requester_user_id: UUID) -> tuple[bytes, str, str]:
        """Download document file content."""
        
        document = await self.get_document(document_id, requester_user_id)
        
        # Read file content
        try:
            async with aiofiles.open(document.file_path, "rb") as f:
                content = await f.read()
            
            return content, document.file_name, document.mime_type
            
        except FileNotFoundError:
            raise DocumentNotFoundException(f"Document file not found: {document.file_path}")
    
    async def approve_document(
        self,
        document_id: UUID,
        reviewer_id: UUID,
        notes: Optional[str] = None
    ) -> EmployeeDocument:
        """Approve a document."""
        
        document = await self.document_repository.get_by_id(document_id)
        if not document:
            raise DocumentNotFoundException(f"Document {document_id} not found")
        
        # Update document status
        document.approve_document(reviewer_id, notes)
        
        # Save to database
        updated_document = await self.document_repository.update(document)
        
        # Check if all required documents are approved for this employee
        await self._check_documents_completion(document.employee_id)
        
        # Emit domain event
        event = DomainEvent(
            id=uuid4(),
            event_type="document.approved",
            aggregate_id=document.employee_id,
            data={
                "document_id": str(document_id),
                "document_type": document.document_type.value,
                "reviewed_by": str(reviewer_id),
                "notes": notes
            },
            occurred_at=datetime.utcnow()
        )
        await self.event_repository.save_event(event)
        
        print(f"✅ Document approved: {document.file_name} by {reviewer_id}")
        return updated_document
    
    async def reject_document(
        self,
        document_id: UUID,
        reviewer_id: UUID,
        reason: str
    ) -> EmployeeDocument:
        """Reject a document."""
        
        document = await self.document_repository.get_by_id(document_id)
        if not document:
            raise DocumentNotFoundException(f"Document {document_id} not found")
        
        # Update document status
        document.reject_document(reviewer_id, reason)
        
        # Save to database
        updated_document = await self.document_repository.update(document)
        
        # Emit domain event
        event = DomainEvent(
            id=uuid4(),
            event_type="document.rejected",
            aggregate_id=document.employee_id,
            data={
                "document_id": str(document_id),
                "document_type": document.document_type.value,
                "reviewed_by": str(reviewer_id),
                "reason": reason
            },
            occurred_at=datetime.utcnow()
        )
        await self.event_repository.save_event(event)
        
        print(f"❌ Document rejected: {document.file_name} by {reviewer_id}")
        return updated_document
    
    async def request_document_replacement(
        self,
        document_id: UUID,
        reviewer_id: UUID,
        reason: str
    ) -> EmployeeDocument:
        """Request document replacement."""
        
        document = await self.document_repository.get_by_id(document_id)
        if not document:
            raise DocumentNotFoundException(f"Document {document_id} not found")
        
        # Update document status
        document.request_replacement(reviewer_id, reason)
        
        # Save to database
        updated_document = await self.document_repository.update(document)
        
        # Emit domain event
        event = DomainEvent(
            id=uuid4(),
            event_type="document.replacement_requested",
            aggregate_id=document.employee_id,
            data={
                "document_id": str(document_id),
                "document_type": document.document_type.value,
                "reviewed_by": str(reviewer_id),
                "reason": reason
            },
            occurred_at=datetime.utcnow()
        )
        await self.event_repository.save_event(event)
        
        print(f"🔄 Document replacement requested: {document.file_name} by {reviewer_id}")
        return updated_document
    
    async def delete_document(self, document_id: UUID, requester_user_id: UUID) -> bool:
        """Delete a document."""
        
        document = await self.document_repository.get_by_id(document_id)
        if not document:
            raise DocumentNotFoundException(f"Document {document_id} not found")
        
        # Check if user can delete this document
        employee = await self.employee_repository.get_by_id(document.employee_id)
        if not employee:
            raise EmployeeNotFoundException("Employee not found")
        
        # Only allow deletion if profile is still pending or rejected
        if not self._can_delete_documents(employee.verification_status):
            raise EmployeeValidationException(
                "Document deletion not allowed for current verification status"
            )
        
        # Check permissions (user can delete their own, admins can delete any)
        if not await self._can_delete_employee_documents(document.employee_id, requester_user_id):
            raise EmployeePermissionException("Insufficient permissions to delete document")
        
        # Delete document
        success = await self.document_repository.delete(document_id)
        
        if success:
            # Emit domain event
            event = DomainEvent(
                id=uuid4(),
                event_type="document.deleted",
                aggregate_id=document.employee_id,
                data={
                    "document_id": str(document_id),
                    "document_type": document.document_type.value,
                    "deleted_by": str(requester_user_id)
                },
                occurred_at=datetime.utcnow()
            )
            await self.event_repository.save_event(event)
            
            print(f"🗑️  Document deleted: {document.file_name}")
        
        return success
    
    async def get_pending_document_reviews(self, limit: int = 100) -> List[EmployeeDocument]:
        """Get documents pending review for admin dashboard."""
        return await self.document_repository.get_pending_document_reviews(limit)
    
    async def get_document_statistics(self) -> Dict[str, Any]:
        """Get document review statistics."""
        return await self.document_repository.get_document_statistics()
    
    async def get_employee_documents(
        self, employee_id: UUID, requester_user_id: UUID
    ) -> List[EmployeeDocument]:
        """Get all documents for an employee."""
        
        # Validate access permissions
        if not await self._can_access_employee_documents(employee_id, requester_user_id):
            raise EmployeePermissionException("Insufficient permissions to view documents")
        
        documents = await self.document_repository.get_employee_documents(employee_id)
        return documents