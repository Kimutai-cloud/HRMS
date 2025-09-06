from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone

from app.core.entities.task import Task, TaskActivity, TaskStatus, TaskAction
from app.core.entities.events import (
    TaskAssignedEvent, TaskStartedEvent, TaskProgressUpdatedEvent,
    TaskSubmittedEvent, TaskReviewStartedEvent, TaskApprovedEvent,
    TaskRejectedEvent, TaskCancelledEvent, TaskUpdatedEvent
)
from app.core.interfaces.repositories import TaskRepositoryInterface, TaskActivityRepositoryInterface


class TaskWorkflowService:
    """Service for managing task workflow transitions and business rules."""
    
    def __init__(self, 
                 task_repository: TaskRepositoryInterface,
                 activity_repository: TaskActivityRepositoryInterface):
        self.task_repository = task_repository
        self.activity_repository = activity_repository
    
    async def assign_task(self, task: Task, assignee_id: UUID, assigned_by: UUID) -> Task:
        """Assign task to an employee."""
        previous_status = task.status
        
        # Use entity business logic
        task.assign_to(assignee_id, assigned_by)
        
        # Save task
        updated_task = await self.task_repository.update(task)
        
        # Log activity
        activity = TaskActivity.create_status_change_activity(
            task_id=task.id,
            performed_by=assigned_by,
            previous_status=previous_status,
            new_status=task.status,
            details={"assignee_id": str(assignee_id)}
        )
        await self.activity_repository.create(activity)
        
        # Emit domain event
        event = TaskAssignedEvent(task.id, assignee_id, assigned_by)
        # Event handling would be implemented separately
        
        return updated_task
    
    async def start_task_work(self, task: Task, employee_id: UUID) -> Task:
        """Start work on a task."""
        # Validate employee can start this task
        if task.assignee_id != employee_id:
            raise ValueError("Only the assigned employee can start work on this task")
        
        previous_status = task.status
        
        # Use entity business logic
        task.start_work()
        
        # Save task
        updated_task = await self.task_repository.update(task)
        
        # Log activity
        activity = TaskActivity.create_status_change_activity(
            task_id=task.id,
            performed_by=employee_id,
            previous_status=previous_status,
            new_status=task.status
        )
        await self.activity_repository.create(activity)
        
        # Emit domain event
        event = TaskStartedEvent(task.id, employee_id)
        
        return updated_task
    
    async def update_task_progress(self, task: Task, employee_id: UUID, 
                                 progress: int, actual_hours: Optional[float] = None) -> Task:
        """Update task progress."""
        # Validate employee can update this task
        if task.assignee_id != employee_id:
            raise ValueError("Only the assigned employee can update task progress")
        
        previous_progress = task.progress_percentage
        
        # Use entity business logic
        task.update_progress(progress, actual_hours)
        
        # Save task
        updated_task = await self.task_repository.update(task)
        
        # Log activity
        activity = TaskActivity(
            id=None,
            task_id=task.id,
            performed_by=employee_id,
            action=TaskAction.UPDATED,
            details={
                "progress_change": {"from": previous_progress, "to": progress},
                "actual_hours": actual_hours
            }
        )
        await self.activity_repository.create(activity)
        
        # Emit domain event
        event = TaskProgressUpdatedEvent(task.id, employee_id, progress, previous_progress, actual_hours)
        
        return updated_task
    
    async def submit_task_for_review(self, task: Task, employee_id: UUID, 
                                   submission_notes: Optional[str] = None) -> Task:
        """Submit task for review."""
        # Validate employee can submit this task
        if task.assignee_id != employee_id:
            raise ValueError("Only the assigned employee can submit this task")
        
        previous_status = task.status
        
        # Use entity business logic
        task.submit_for_review(submission_notes)
        
        # Save task
        updated_task = await self.task_repository.update(task)
        
        # Log activity
        activity = TaskActivity.create_status_change_activity(
            task_id=task.id,
            performed_by=employee_id,
            previous_status=previous_status,
            new_status=task.status,
            details={"submission_notes": submission_notes}
        )
        await self.activity_repository.create(activity)
        
        # Emit domain event
        event = TaskSubmittedEvent(task.id, employee_id, submission_notes)
        
        return updated_task
    
    async def start_task_review(self, task: Task, reviewer_id: UUID) -> Task:
        """Start reviewing a submitted task."""
        # Validate reviewer can review this task (should be the assigner)
        if task.assigner_id != reviewer_id:
            raise ValueError("Only the task assigner can review this task")
        
        previous_status = task.status
        
        # Use entity business logic
        task.start_review(reviewer_id)
        
        # Save task
        updated_task = await self.task_repository.update(task)
        
        # Log activity
        activity = TaskActivity.create_status_change_activity(
            task_id=task.id,
            performed_by=reviewer_id,
            previous_status=previous_status,
            new_status=task.status
        )
        await self.activity_repository.create(activity)
        
        # Emit domain event
        event = TaskReviewStartedEvent(task.id, reviewer_id)
        
        return updated_task
    
    async def approve_task(self, task: Task, approved_by: UUID, 
                         approval_notes: Optional[str] = None) -> Task:
        """Approve and complete a task."""
        # Validate approver can approve this task (should be the assigner)
        if task.assigner_id != approved_by:
            raise ValueError("Only the task assigner can approve this task")
        
        previous_status = task.status
        
        # Handle status transition: SUBMITTED -> IN_REVIEW -> COMPLETED
        if task.status == TaskStatus.SUBMITTED:
            # First transition to IN_REVIEW
            task.start_review(approved_by)
            # Save intermediate state
            await self.task_repository.update(task)
            
            # Log the review start activity
            review_activity = TaskActivity.create_status_change_activity(
                task_id=task.id,
                performed_by=approved_by,
                previous_status=previous_status,
                new_status=task.status,
                details={"started_review": True}
            )
            await self.activity_repository.create(review_activity)
        
        # Now approve the task (should be IN_REVIEW status)
        approval_previous_status = task.status
        task.approve_task(approved_by, approval_notes)
        
        # Save task
        updated_task = await self.task_repository.update(task)
        
        # Log approval activity (from IN_REVIEW to COMPLETED)
        approval_activity = TaskActivity.create_status_change_activity(
            task_id=task.id,
            performed_by=approved_by,
            previous_status=approval_previous_status,
            new_status=task.status,
            details={"approval_notes": approval_notes}
        )
        await self.activity_repository.create(approval_activity)
        
        # Emit domain event
        event = TaskApprovedEvent(task.id, approved_by, approval_notes)
        
        return updated_task
    
    async def reject_task(self, task: Task, rejected_by: UUID, rejection_reason: str) -> Task:
        """Reject a task and send back for rework."""
        # Validate rejecter can reject this task (should be the assigner)
        if task.assigner_id != rejected_by:
            raise ValueError("Only the task assigner can reject this task")
        
        previous_status = task.status
        
        # Handle status transition: SUBMITTED -> IN_REVIEW -> IN_PROGRESS
        if task.status == TaskStatus.SUBMITTED:
            # First transition to IN_REVIEW
            task.start_review(rejected_by)
            # Save intermediate state
            await self.task_repository.update(task)
            
            # Log the review start activity
            review_activity = TaskActivity.create_status_change_activity(
                task_id=task.id,
                performed_by=rejected_by,
                previous_status=previous_status,
                new_status=task.status,
                details={"started_review": True}
            )
            await self.activity_repository.create(review_activity)
        
        # Now reject the task (should be IN_REVIEW status)
        rejection_previous_status = task.status
        task.reject_task(rejected_by, rejection_reason)
        
        # Save task
        updated_task = await self.task_repository.update(task)
        
        # Log rejection activity (from IN_REVIEW to IN_PROGRESS)
        rejection_activity = TaskActivity.create_status_change_activity(
            task_id=task.id,
            performed_by=rejected_by,
            previous_status=rejection_previous_status,
            new_status=task.status,
            details={"rejection_reason": rejection_reason}
        )
        await self.activity_repository.create(rejection_activity)
        
        # Emit domain event
        event = TaskRejectedEvent(task.id, rejected_by, rejection_reason)
        
        return updated_task
    
    async def cancel_task(self, task: Task, cancelled_by: UUID, 
                        cancellation_reason: Optional[str] = None) -> Task:
        """Cancel a task."""
        # Validate canceller can cancel this task (should be the assigner or admin)
        if task.assigner_id != cancelled_by:
            # Additional permission check would be done at use case level
            pass
        
        previous_status = task.status
        
        # Use entity business logic
        task.cancel_task(cancelled_by, cancellation_reason)
        
        # Save task
        updated_task = await self.task_repository.update(task)
        
        # Log activity
        activity = TaskActivity.create_status_change_activity(
            task_id=task.id,
            performed_by=cancelled_by,
            previous_status=previous_status,
            new_status=task.status,
            details={"cancellation_reason": cancellation_reason}
        )
        await self.activity_repository.create(activity)
        
        # Emit domain event
        event = TaskCancelledEvent(task.id, cancelled_by, cancellation_reason)
        
        return updated_task
    
    async def update_task_details(self, task: Task, updated_by: UUID, 
                                changes: Dict[str, Any]) -> Task:
        """Update task details."""
        # Validate updater can update this task
        if task.assigner_id != updated_by and task.assignee_id != updated_by:
            raise ValueError("Only the task assigner or assignee can update task details")
        
        # Track what changed
        change_log = {}
        
        # Use entity business logic to update
        if 'title' in changes:
            if task.title != changes['title']:
                change_log['title'] = {"from": task.title, "to": changes['title']}
        
        if 'description' in changes:
            if task.description != changes['description']:
                change_log['description'] = {"from": task.description, "to": changes['description']}
        
        if 'priority' in changes:
            if task.priority != changes['priority']:
                change_log['priority'] = {"from": task.priority.value, "to": changes['priority'].value}
        
        if 'due_date' in changes:
            old_due = task.due_date.isoformat() if task.due_date else None
            new_due = changes['due_date'].isoformat() if changes['due_date'] else None
            if old_due != new_due:
                change_log['due_date'] = {"from": old_due, "to": new_due}
        
        if 'estimated_hours' in changes:
            if task.estimated_hours != changes['estimated_hours']:
                change_log['estimated_hours'] = {"from": task.estimated_hours, "to": changes['estimated_hours']}
        
        if 'tags' in changes:
            if task.tags != changes['tags']:
                change_log['tags'] = {"from": task.tags, "to": changes['tags']}
        
        # Update using entity method
        task.update_details(
            title=changes.get('title'),
            description=changes.get('description'),
            priority=changes.get('priority'),
            due_date=changes.get('due_date'),
            estimated_hours=changes.get('estimated_hours'),
            tags=changes.get('tags')
        )
        
        # Save task
        updated_task = await self.task_repository.update(task)
        
        # Log activity only if there were actual changes
        if change_log:
            activity = TaskActivity(
                id=None,
                task_id=task.id,
                performed_by=updated_by,
                action=TaskAction.UPDATED,
                details={"changes": change_log}
            )
            await self.activity_repository.create(activity)
            
            # Emit domain event
            event = TaskUpdatedEvent(task.id, updated_by, change_log)
        
        return updated_task
    
    async def validate_task_permissions(self, task: Task, user_id: UUID, action: str) -> bool:
        """Validate if user has permission to perform action on task."""
        if action == "view" or action == "comment":
            # Permissive for viewing and commenting - managers can access any task
            return True
        
        elif action == "edit":
            # Can edit if created task or assigned to task (with restrictions)
            return (task.assigner_id == user_id or 
                   (task.assignee_id == user_id and task.can_be_edited()))
        
        elif action == "assign":
            # Only task creator can assign
            return task.assigner_id == user_id
        
        elif action == "start":
            # Only assignee can start
            return task.assignee_id == user_id and task.can_be_started()
        
        elif action == "submit":
            # Only assignee can submit
            return task.assignee_id == user_id and task.can_be_submitted()
        
        elif action == "review":
            # Only task creator can review
            return task.assigner_id == user_id and task.can_be_reviewed()
        
        elif action == "cancel":
            # Task creator or admin can cancel
            return task.assigner_id == user_id and task.can_be_cancelled()
        
        return False