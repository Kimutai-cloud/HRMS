from typing import List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError

from app.core.entities.task import TaskActivity, TaskAction, TaskStatus
from app.core.interfaces.repositories import TaskActivityRepositoryInterface
from app.infrastructure.database.models import TaskActivityModel


class TaskActivityRepository(TaskActivityRepositoryInterface):
    """Repository for task activity operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, activity: TaskActivity) -> TaskActivity:
        """Create a new task activity."""
        db_activity = TaskActivityModel(
            id=activity.id,
            task_id=activity.task_id,
            performed_by=activity.performed_by,
            action=activity.action.value,
            previous_status=activity.previous_status.value if activity.previous_status else None,
            new_status=activity.new_status.value if activity.new_status else None,
            details=activity.details,
            created_at=activity.created_at
        )
        
        try:
            self.session.add(db_activity)
            await self.session.commit()
            await self.session.refresh(db_activity)
            return self._to_entity(db_activity)
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError(f"Failed to create task activity: {str(e)}")
    
    async def get_by_task_id(self, task_id: UUID) -> List[TaskActivity]:
        """Get all activities for a task."""
        query = select(TaskActivityModel).where(TaskActivityModel.task_id == task_id).options(
            joinedload(TaskActivityModel.performer),
            joinedload(TaskActivityModel.task)
        ).order_by(TaskActivityModel.created_at)
        
        result = await self.session.execute(query)
        db_activities = result.scalars().all()
        return [self._to_entity(db_activity) for db_activity in db_activities]
    
    async def get_user_activities(self, user_id: UUID, limit: int = 50) -> List[TaskActivity]:
        """Get recent activities performed by a user."""
        query = select(TaskActivityModel).where(TaskActivityModel.performed_by == user_id).options(
            joinedload(TaskActivityModel.task),
            joinedload(TaskActivityModel.performer)
        ).order_by(desc(TaskActivityModel.created_at)).limit(limit)
        
        result = await self.session.execute(query)
        db_activities = result.scalars().all()
        return [self._to_entity(db_activity) for db_activity in db_activities]
    
    async def get_recent_team_activities(self, manager_id: UUID, limit: int = 20) -> List[TaskActivity]:
        """Get recent activities for tasks managed by this manager."""
        # Get activities where the manager is either the assigner or the performer
        query = select(TaskActivityModel).join(TaskActivityModel.task).where(
            TaskActivityModel.task.has(assigner_id=manager_id)
        ).options(
            joinedload(TaskActivityModel.task),
            joinedload(TaskActivityModel.performer)
        ).order_by(desc(TaskActivityModel.created_at)).limit(limit)
        
        result = await self.session.execute(query)
        db_activities = result.scalars().all()
        return [self._to_entity(db_activity) for db_activity in db_activities]
    
    def _to_entity(self, db_activity: TaskActivityModel) -> TaskActivity:
        """Convert database model to entity."""
        if not db_activity:
            return None
            
        return TaskActivity(
            id=db_activity.id,
            task_id=db_activity.task_id,
            performed_by=db_activity.performed_by,
            action=TaskAction(db_activity.action),
            previous_status=TaskStatus(db_activity.previous_status) if db_activity.previous_status else None,
            new_status=TaskStatus(db_activity.new_status) if db_activity.new_status else None,
            details=db_activity.details,
            created_at=db_activity.created_at
        )