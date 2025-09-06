from typing import Optional, List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError

from app.core.entities.task import TaskComment, CommentType
from app.core.interfaces.repositories import TaskCommentRepositoryInterface
from app.infrastructure.database.models import TaskCommentModel


class TaskCommentRepository(TaskCommentRepositoryInterface):
    """Repository for task comment operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, comment: TaskComment) -> TaskComment:
        """Create a new task comment."""
        db_comment = TaskCommentModel(
            id=comment.id,
            task_id=comment.task_id,
            author_id=comment.author_id,
            comment=comment.comment,
            comment_type=comment.comment_type.value,
            created_at=comment.created_at,
            updated_at=comment.updated_at
        )
        
        try:
            self.session.add(db_comment)
            await self.session.commit()
            await self.session.refresh(db_comment)
            return self._to_entity(db_comment)
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError(f"Failed to create task comment: {str(e)}")
    
    async def get_by_id(self, comment_id: UUID) -> Optional[TaskComment]:
        """Get comment by ID."""
        query = select(TaskCommentModel).where(TaskCommentModel.id == comment_id).options(
            joinedload(TaskCommentModel.author),
            joinedload(TaskCommentModel.task)
        )
        result = await self.session.execute(query)
        db_comment = result.scalar_one_or_none()
        return self._to_entity(db_comment) if db_comment else None
    
    async def get_by_task_id(self, task_id: UUID) -> List[TaskComment]:
        """Get all comments for a task."""
        query = select(TaskCommentModel).where(TaskCommentModel.task_id == task_id).options(
            joinedload(TaskCommentModel.author)
        ).order_by(TaskCommentModel.created_at)
        
        result = await self.session.execute(query)
        db_comments = result.scalars().all()
        return [self._to_entity(db_comment) for db_comment in db_comments]
    
    async def update(self, comment: TaskComment) -> TaskComment:
        """Update task comment."""
        update_data = {
            "comment": comment.comment,
            "comment_type": comment.comment_type.value,
            "updated_at": comment.updated_at
        }
        
        query = update(TaskCommentModel).where(TaskCommentModel.id == comment.id).values(**update_data)
        await self.session.execute(query)
        await self.session.commit()
        
        return await self.get_by_id(comment.id)
    
    async def delete(self, comment_id: UUID) -> bool:
        """Delete task comment."""
        query = delete(TaskCommentModel).where(TaskCommentModel.id == comment_id)
        result = await self.session.execute(query)
        await self.session.commit()
        return result.rowcount > 0
    
    async def get_recent_comments_by_user(self, user_id: UUID, limit: int = 10) -> List[TaskComment]:
        """Get recent comments by a user."""
        query = select(TaskCommentModel).where(TaskCommentModel.author_id == user_id).options(
            joinedload(TaskCommentModel.task),
            joinedload(TaskCommentModel.author)
        ).order_by(desc(TaskCommentModel.created_at)).limit(limit)
        
        result = await self.session.execute(query)
        db_comments = result.scalars().all()
        return [self._to_entity(db_comment) for db_comment in db_comments]
    
    def _to_entity(self, db_comment: TaskCommentModel) -> TaskComment:
        """Convert database model to entity."""
        if not db_comment:
            return None
            
        return TaskComment(
            id=db_comment.id,
            task_id=db_comment.task_id,
            author_id=db_comment.author_id,
            comment=db_comment.comment,
            comment_type=CommentType(db_comment.comment_type),
            created_at=db_comment.created_at,
            updated_at=db_comment.updated_at
        )