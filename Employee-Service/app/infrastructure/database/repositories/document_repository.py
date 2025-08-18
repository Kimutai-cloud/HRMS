from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.exc import IntegrityError
from pathlib import Path
import aiofiles
import os

from app.core.entities.document import EmployeeDocument, DocumentType, DocumentReviewStatus
from app.core.interfaces.repositories import DocumentRepositoryInterface  # FIXED IMPORT
from app.infrastructure.database.models import EmployeeDocumentModel
from app.config.settings import settings


class DocumentRepository(DocumentRepositoryInterface):
    """Implementation of document repository."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, document: EmployeeDocument) -> EmployeeDocument:
        """Create a new document record."""
        db_document = EmployeeDocumentModel(
            id=document.id,
            employee_id=document.employee_id,
            document_type=document.document_type.value,
            file_name=document.file_name,
            file_path=document.file_path,
            file_size=document.file_size,
            mime_type=document.mime_type,
            uploaded_at=document.uploaded_at,
            uploaded_by=document.uploaded_by,
            reviewed_by=document.reviewed_by,
            reviewed_at=document.reviewed_at,
            review_status=document.review_status.value,
            review_notes=document.review_notes,
            is_required=document.is_required,
            display_order=document.display_order
        )
        
        try:
            self.session.add(db_document)
            await self.session.commit()
            await self.session.refresh(db_document)
            return self._to_entity(db_document)
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError(f"Failed to create document: {str(e)}")
    
    async def get_by_id(self, document_id: UUID) -> Optional[EmployeeDocument]:
        """Get document by ID."""
        result = await self.session.execute(
            select(EmployeeDocumentModel).where(EmployeeDocumentModel.id == document_id)
        )
        db_document = result.scalar_one_or_none()
        return self._to_entity(db_document) if db_document else None
    
    async def get_employee_documents(self, employee_id: UUID) -> List[EmployeeDocument]:
        """Get all documents for an employee."""
        result = await self.session.execute(
            select(EmployeeDocumentModel)
            .where(EmployeeDocumentModel.employee_id == employee_id)
            .order_by(EmployeeDocumentModel.display_order, EmployeeDocumentModel.uploaded_at)
        )
        db_documents = result.scalars().all()
        return [self._to_entity(doc) for doc in db_documents]
    
    async def get_documents_by_type(self, employee_id: UUID, document_type: DocumentType) -> List[EmployeeDocument]:
        """Get documents by type for an employee."""
        result = await self.session.execute(
            select(EmployeeDocumentModel)
            .where(
                and_(
                    EmployeeDocumentModel.employee_id == employee_id,
                    EmployeeDocumentModel.document_type == document_type.value
                )
            )
            .order_by(EmployeeDocumentModel.uploaded_at.desc())
        )
        db_documents = result.scalars().all()
        return [self._to_entity(doc) for doc in db_documents]
    
    async def get_documents_by_status(self, review_status: DocumentReviewStatus, limit: int = 100) -> List[EmployeeDocument]:
        """Get documents by review status."""
        result = await self.session.execute(
            select(EmployeeDocumentModel)
            .where(EmployeeDocumentModel.review_status == review_status.value)
            .order_by(EmployeeDocumentModel.uploaded_at)
            .limit(limit)
        )
        db_documents = result.scalars().all()
        return [self._to_entity(doc) for doc in db_documents]
    
    async def update(self, document: EmployeeDocument) -> EmployeeDocument:
        """Update document."""
        result = await self.session.execute(
            select(EmployeeDocumentModel).where(EmployeeDocumentModel.id == document.id)
        )
        db_document = result.scalar_one_or_none()
        
        if not db_document:
            raise ValueError("Document not found")
        
        # Update fields
        db_document.document_type = document.document_type.value
        db_document.file_name = document.file_name
        db_document.file_path = document.file_path
        db_document.file_size = document.file_size
        db_document.mime_type = document.mime_type
        db_document.reviewed_by = document.reviewed_by
        db_document.reviewed_at = document.reviewed_at
        db_document.review_status = document.review_status.value
        db_document.review_notes = document.review_notes
        db_document.is_required = document.is_required
        db_document.display_order = document.display_order
        
        await self.session.commit()
        await self.session.refresh(db_document)
        return self._to_entity(db_document)
    
    async def delete(self, document_id: UUID) -> bool:
        """Delete document and file."""
        # Get document first to access file path
        document = await self.get_by_id(document_id)
        if not document:
            return False
        
        # Delete file from filesystem
        try:
            file_path = Path(document.file_path)
            if file_path.exists():
                file_path.unlink()
                print(f"✅ Deleted file: {file_path}")
        except Exception as e:
            print(f"⚠️  Failed to delete file {document.file_path}: {e}")
            # Continue with database deletion even if file deletion fails
        
        # Delete from database
        result = await self.session.execute(
            delete(EmployeeDocumentModel).where(EmployeeDocumentModel.id == document_id)
        )
        await self.session.commit()
        return result.rowcount > 0
    
    async def get_pending_document_reviews(self, limit: int = 100) -> List[EmployeeDocument]:
        """Get documents pending review."""
        return await self.get_documents_by_status(DocumentReviewStatus.PENDING, limit)
    
    async def get_document_statistics(self) -> Dict[str, Any]:
        """Get document review statistics."""
        result = await self.session.execute(
            select(
                EmployeeDocumentModel.review_status,
                func.count(EmployeeDocumentModel.id).label('count')
            )
            .group_by(EmployeeDocumentModel.review_status)
        )
        
        stats = {row.review_status: row.count for row in result}
        
        return {
            "pending": stats.get("PENDING", 0),
            "approved": stats.get("APPROVED", 0),
            "rejected": stats.get("REJECTED", 0),
            "requires_replacement": stats.get("REQUIRES_REPLACEMENT", 0),
            "total": sum(stats.values())
        }
    
    async def get_employee_document_summary(self, employee_id: UUID) -> Dict[str, Any]:
        """Get document summary for an employee."""
        result = await self.session.execute(
            select(
                EmployeeDocumentModel.review_status,
                EmployeeDocumentModel.is_required,
                func.count(EmployeeDocumentModel.id).label('count')
            )
            .where(EmployeeDocumentModel.employee_id == employee_id)
            .group_by(EmployeeDocumentModel.review_status, EmployeeDocumentModel.is_required)
        )
        
        stats = {}
        for row in result:
            key = f"{row.review_status}_{'required' if row.is_required else 'optional'}"
            stats[key] = row.count
        
        # Calculate completion status
        required_approved = stats.get("APPROVED_required", 0)
        required_total = sum(v for k, v in stats.items() if "required" in k)
        
        return {
            "statistics": stats,
            "required_documents_count": required_total,
            "required_approved_count": required_approved,
            "all_required_approved": required_total > 0 and required_approved == required_total,
            "completion_percentage": (required_approved / required_total * 100) if required_total > 0 else 0
        }
    
    def _to_entity(self, db_document: EmployeeDocumentModel) -> EmployeeDocument:
        """Convert database model to entity."""
        return EmployeeDocument(
            id=db_document.id,
            employee_id=db_document.employee_id,
            document_type=DocumentType(db_document.document_type),
            file_name=db_document.file_name,
            file_path=db_document.file_path,
            file_size=db_document.file_size,
            mime_type=db_document.mime_type,
            uploaded_at=db_document.uploaded_at,
            uploaded_by=db_document.uploaded_by,
            reviewed_by=db_document.reviewed_by,
            reviewed_at=db_document.reviewed_at,
            review_status=DocumentReviewStatus(db_document.review_status),
            review_notes=db_document.review_notes,
            is_required=db_document.is_required,
            display_order=db_document.display_order
        )