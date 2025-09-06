from typing import List
from uuid import UUID, uuid4

from app.core.entities.task import TaskComment, CommentType
from app.core.entities.events import TaskCommentAddedEvent
from app.core.interfaces.repositories import (
    TaskRepositoryInterface,
    TaskCommentRepositoryInterface,
    TaskActivityRepositoryInterface,
    EmployeeRepositoryInterface
)
from app.domain.task_workflow_service import TaskWorkflowService


class TaskCommentUseCase:
    """Use case for task comment management."""
    
    def __init__(self,
                 task_repository: TaskRepositoryInterface,
                 comment_repository: TaskCommentRepositoryInterface,
                 activity_repository: TaskActivityRepositoryInterface,
                 employee_repository: EmployeeRepositoryInterface,
                 workflow_service: TaskWorkflowService):
        self.task_repository = task_repository
        self.comment_repository = comment_repository
        self.activity_repository = activity_repository
        self.employee_repository = employee_repository
        self.workflow_service = workflow_service
    
    async def add_comment_core(self, task_id: UUID, author_id: UUID, comment_text: str,
                         comment_type: CommentType = CommentType.COMMENT) -> TaskComment:
        """Add a comment to a task."""
        # Validate task exists
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Validate user has permission to comment on this task
        if not await self.workflow_service.validate_task_permissions(task, author_id, "view"):
            raise ValueError("You don't have permission to comment on this task")
        
        # Validate author exists
        author = await self.employee_repository.get_by_id(author_id)
        if not author:
            raise ValueError("Author not found")
        
        # Create comment
        comment = TaskComment(
            id=uuid4(),
            task_id=task_id,
            author_id=author_id,
            comment=comment_text,
            comment_type=comment_type
        )
        
        # Save comment
        saved_comment = await self.comment_repository.create(comment)
        
        # Log activity
        from app.core.entities.task import TaskActivity, TaskAction
        activity = TaskActivity(
            id=None,
            task_id=task_id,
            performed_by=author_id,
            action=TaskAction.COMMENTED,
            details={
                "comment_type": comment_type.value,
                "comment_preview": comment_text[:100] + "..." if len(comment_text) > 100 else comment_text
            }
        )
        await self.activity_repository.create(activity)
        
        # Emit domain event
        event = TaskCommentAddedEvent(task_id, saved_comment.id, author_id, comment_type.value)
        
        return saved_comment
    
    async def get_task_comments_core(self, task_id: UUID, user_id: UUID) -> List[TaskComment]:
        """Get all comments for a task."""
        # Validate task exists and user has permission
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        if not await self.workflow_service.validate_task_permissions(task, user_id, "view"):
            raise ValueError("You don't have permission to view comments on this task")
        
        return await self.comment_repository.get_by_task_id(task_id)
    
    async def update_comment_core(self, comment_id: UUID, user_id: UUID, new_text: str) -> TaskComment:
        """Update a comment (only author can update)."""
        # Get comment
        comment = await self.comment_repository.get_by_id(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        
        # Validate user is the author
        if comment.author_id != user_id:
            raise ValueError("You can only edit your own comments")
        
        # Update comment
        comment.update_comment(new_text)
        
        return await self.comment_repository.update(comment)
    
    async def delete_comment_core(self, comment_id: UUID, user_id: UUID) -> bool:
        """Delete a comment (only author can delete)."""
        # Get comment
        comment = await self.comment_repository.get_by_id(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        
        # Validate user is the author or task owner
        task = await self.task_repository.get_by_id(comment.task_id)
        if comment.author_id != user_id and task.assigner_id != user_id:
            raise ValueError("You can only delete your own comments or comments on your tasks")
        
        return await self.comment_repository.delete(comment_id)
    
    async def add_status_change_comment(self, task_id: UUID, author_id: UUID, 
                                       old_status: str, new_status: str) -> TaskComment:
        """Add an automatic comment for status changes."""
        comment_text = f"Status changed from {old_status} to {new_status}"
        
        return await self.add_comment_core(
            task_id=task_id,
            author_id=author_id,
            comment_text=comment_text,
            comment_type=CommentType.STATUS_CHANGE
        )
    
    async def add_progress_update_comment(self, task_id: UUID, author_id: UUID, 
                                        old_progress: int, new_progress: int,
                                        actual_hours: float = None) -> TaskComment:
        """Add an automatic comment for progress updates."""
        comment_text = f"Progress updated from {old_progress}% to {new_progress}%"
        if actual_hours:
            comment_text += f" (Actual hours: {actual_hours})"
        
        return await self.add_comment_core(
            task_id=task_id,
            author_id=author_id,
            comment_text=comment_text,
            comment_type=CommentType.PROGRESS_UPDATE
        )
    
    async def add_review_comment(self, task_id: UUID, reviewer_id: UUID, 
                               review_notes: str, is_approval: bool = False) -> TaskComment:
        """Add a review comment."""
        comment_type = CommentType.REVIEW_NOTE
        prefix = "✅ Approved: " if is_approval else "📝 Review: "
        comment_text = f"{prefix}{review_notes}"
        
        return await self.add_comment_core(
            task_id=task_id,
            author_id=reviewer_id,
            comment_text=comment_text,
            comment_type=comment_type
        )
    
    async def get_user_recent_comments(self, user_id: UUID, limit: int = 10) -> List[TaskComment]:
        """Get user's recent comments across all tasks."""
        return await self.comment_repository.get_recent_comments_by_user(user_id, limit)
    
    # =====================================================
    # ENDPOINT-COMPATIBLE METHODS (with user_id conversion)
    # =====================================================
    
    async def get_task_comments(self, task_id: UUID, requester_user_id: UUID, 
                               limit: int = 50, offset: int = 0) -> List[dict]:
        """Get task comments (endpoint-compatible method)."""
        # Convert user_id to employee_id
        employee = await self.employee_repository.get_by_user_id(requester_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Get comments using core method
        comments = await self.get_task_comments_core(task_id, employee.id)
        
        # Apply pagination
        paginated_comments = comments[offset:offset + limit] if comments else []
        
        # Convert to response format
        result = []
        for comment in paginated_comments:
            # Get author details
            author = await self.employee_repository.get_by_id(comment.author_id)
            author_name = f"{author.first_name} {author.last_name}" if author else "Unknown"
            
            result.append({
                "id": comment.id,
                "comment_text": comment.comment,
                "comment_type": comment.comment_type.value,
                "author_id": comment.author_id,
                "author_name": author_name,
                "created_at": comment.created_at,
                "updated_at": comment.updated_at
            })
        
        return result
    
    async def add_comment(self, task_id: UUID, author_user_id: UUID, 
                         comment_text: str, comment_type: str = "COMMENT") -> dict:
        """Add comment (endpoint-compatible method)."""
        # Convert user_id to employee_id
        employee = await self.employee_repository.get_by_user_id(author_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Convert string to enum
        comment_type_enum = CommentType.COMMENT
        try:
            comment_type_enum = CommentType(comment_type)
        except ValueError:
            comment_type_enum = CommentType.COMMENT
        
        # Add comment using core method
        comment = await self.add_comment_core(task_id, employee.id, comment_text, comment_type_enum)
        
        # Return response format matching TaskCommentResponse schema
        return {
            "id": comment.id,
            "comment_text": comment.comment,  # Map 'comment' field to 'comment_text'
            "comment_type": comment.comment_type.value,
            "author_id": comment.author_id,
            "author_name": f"{employee.first_name} {employee.last_name}",  # Add author_name
            "created_at": comment.created_at,
            "updated_at": comment.updated_at
        }
    
    async def update_comment(self, comment_id: UUID, task_id: UUID, 
                           author_user_id: UUID, comment_text: str) -> dict:
        """Update comment (endpoint-compatible method)."""
        # Convert user_id to employee_id
        employee = await self.employee_repository.get_by_user_id(author_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Update comment using core method
        comment = await self.update_comment_core(comment_id, employee.id, comment_text)
        
        # Return response format matching TaskCommentResponse schema
        return {
            "id": comment.id,
            "comment_text": comment.comment,  # Map 'comment' field to 'comment_text'
            "comment_type": comment.comment_type.value,
            "author_id": comment.author_id,
            "author_name": f"{employee.first_name} {employee.last_name}",  # Add author_name
            "created_at": comment.created_at,
            "updated_at": comment.updated_at
        }
    
    async def delete_comment(self, comment_id: UUID, task_id: UUID, author_user_id: UUID) -> bool:
        """Delete comment (endpoint-compatible method)."""
        # Convert user_id to employee_id
        employee = await self.employee_repository.get_by_user_id(author_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Delete comment using core method
        return await self.delete_comment_core(comment_id, employee.id)
    
    async def get_comment_by_id(self, comment_id: UUID, task_id: UUID, requester_user_id: UUID) -> dict:
        """Get comment by ID (endpoint-compatible method)."""
        # Convert user_id to employee_id
        employee = await self.employee_repository.get_by_user_id(requester_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Get comment
        comment = await self.comment_repository.get_by_id(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        
        # Validate task association
        if comment.task_id != task_id:
            raise ValueError("Comment does not belong to this task")
        
        # Validate permission
        task = await self.task_repository.get_by_id(task_id)
        if not await self.workflow_service.validate_task_permissions(task, employee.id, "view"):
            raise ValueError("You don't have permission to view this comment")
        
        # Get author details
        author = await self.employee_repository.get_by_id(comment.author_id)
        author_name = f"{author.first_name} {author.last_name}" if author else "Unknown"
        
        return {
            "id": comment.id,
            "comment_text": comment.comment,
            "comment_type": comment.comment_type.value,
            "author_id": comment.author_id,
            "author_name": author_name,
            "created_at": comment.created_at,
            "updated_at": comment.updated_at
        }
    
    async def get_comment_statistics(self, task_id: UUID, requester_user_id: UUID) -> dict:
        """Get comment statistics (endpoint-compatible method)."""
        # Convert user_id to employee_id
        employee = await self.employee_repository.get_by_user_id(requester_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Validate permission
        task = await self.task_repository.get_by_id(task_id)
        if not await self.workflow_service.validate_task_permissions(task, employee.id, "view"):
            raise ValueError("You don't have permission to view this task")
        
        # Get comments
        comments = await self.comment_repository.get_by_task_id(task_id)
        
        # Calculate statistics
        total_comments = len(comments)
        comment_types = {}
        authors = set()
        
        for comment in comments:
            comment_type = comment.comment_type.value
            comment_types[comment_type] = comment_types.get(comment_type, 0) + 1
            authors.add(comment.author_id)
        
        return {
            "total_comments": total_comments,
            "unique_authors": len(authors),
            "comment_types": comment_types
        }
    
    async def get_recent_comments(self, task_id: UUID, requester_user_id: UUID, limit: int = 10) -> List[dict]:
        """Get recent comments (endpoint-compatible method)."""
        # Get all comments and return the most recent
        all_comments = await self.get_task_comments(task_id, requester_user_id, limit=limit, offset=0)
        return all_comments[:limit]