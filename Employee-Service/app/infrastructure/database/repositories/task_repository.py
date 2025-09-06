from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_, and_, text, desc
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.exc import IntegrityError

from app.core.entities.task import Task, TaskStatus, Priority, TaskType
from app.core.interfaces.repositories import TaskRepositoryInterface
from app.infrastructure.database.models import TaskModel, EmployeeModel, DepartmentModel


class TaskRepository(TaskRepositoryInterface):
    """Repository for task management operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, task: Task) -> Task:
        """Create a new task."""
        db_task = TaskModel(
            id=task.id,
            title=task.title,
            description=task.description,
            task_type=task.task_type.value,
            priority=task.priority.value,
            status=task.status.value,
            assignee_id=task.assignee_id,
            assigner_id=task.assigner_id,
            department_id=task.department_id,
            parent_task_id=task.parent_task_id,
            progress_percentage=task.progress_percentage,
            estimated_hours=task.estimated_hours,
            actual_hours=task.actual_hours,
            created_at=task.created_at,
            assigned_at=task.assigned_at,
            started_at=task.started_at,
            due_date=task.due_date,
            submitted_at=task.submitted_at,
            reviewed_at=task.reviewed_at,
            completed_at=task.completed_at,
            updated_at=task.updated_at,
            tags=task.tags,
            attachments=task.attachments,
            review_notes=task.review_notes,
            rejection_reason=task.rejection_reason,
            approval_notes=task.approval_notes,
            version=task.version
        )
        
        try:
            self.session.add(db_task)
            await self.session.commit()
            await self.session.refresh(db_task)
            return self._to_entity(db_task)
        except IntegrityError as e:
            await self.session.rollback()
            raise ValueError(f"Failed to create task: {str(e)}")
    
    async def get_by_id(self, task_id: UUID) -> Optional[Task]:
        """Get task by ID with relationships loaded."""
        query = select(TaskModel).where(TaskModel.id == task_id).options(
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.assigner),
            joinedload(TaskModel.department),
            joinedload(TaskModel.parent_task)
        )
        result = await self.session.execute(query)
        db_task = result.scalar_one_or_none()
        return self._to_entity(db_task) if db_task else None
    
    async def update(self, task: Task) -> Task:
        """Update task."""
        update_data = {
            "title": task.title,
            "description": task.description,
            "task_type": task.task_type.value,
            "priority": task.priority.value,
            "status": task.status.value,
            "assignee_id": task.assignee_id,
            "department_id": task.department_id,
            "parent_task_id": task.parent_task_id,
            "progress_percentage": task.progress_percentage,
            "estimated_hours": task.estimated_hours,
            "actual_hours": task.actual_hours,
            "assigned_at": task.assigned_at,
            "started_at": task.started_at,
            "due_date": task.due_date,
            "submitted_at": task.submitted_at,
            "reviewed_at": task.reviewed_at,
            "completed_at": task.completed_at,
            "updated_at": task.updated_at,
            "tags": task.tags,
            "attachments": task.attachments,
            "review_notes": task.review_notes,
            "rejection_reason": task.rejection_reason,
            "approval_notes": task.approval_notes,
            "version": task.version
        }
        
        query = update(TaskModel).where(TaskModel.id == task.id).values(**update_data)
        await self.session.execute(query)
        await self.session.commit()
        
        return await self.get_by_id(task.id)
    
    async def delete(self, task_id: UUID) -> bool:
        """Delete task."""
        query = delete(TaskModel).where(TaskModel.id == task_id)
        result = await self.session.execute(query)
        await self.session.commit()
        return result.rowcount > 0
    
    async def get_tasks_by_assignee(self, assignee_id: UUID, status: Optional[TaskStatus] = None) -> List[Task]:
        """Get tasks assigned to a specific employee."""
        query = select(TaskModel).where(TaskModel.assignee_id == assignee_id).options(
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.assigner),
            joinedload(TaskModel.department)
        ).order_by(desc(TaskModel.updated_at))
        
        if status:
            query = query.where(TaskModel.status == status.value)
        
        result = await self.session.execute(query)
        db_tasks = result.scalars().all()
        return [self._to_entity(db_task) for db_task in db_tasks]
    
    async def get_tasks_by_assigner(self, assigner_id: UUID, status: Optional[TaskStatus] = None) -> List[Task]:
        """Get tasks created by a specific manager."""
        query = select(TaskModel).where(TaskModel.assigner_id == assigner_id).options(
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.assigner),
            joinedload(TaskModel.department)
        ).order_by(desc(TaskModel.updated_at))
        
        if status:
            query = query.where(TaskModel.status == status.value)
        
        result = await self.session.execute(query)
        db_tasks = result.scalars().all()
        return [self._to_entity(db_task) for db_task in db_tasks]
    
    async def get_tasks_by_department(self, department_id: UUID, status: Optional[TaskStatus] = None) -> List[Task]:
        """Get tasks for a specific department."""
        query = select(TaskModel).where(TaskModel.department_id == department_id).options(
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.assigner),
            joinedload(TaskModel.department)
        ).order_by(desc(TaskModel.updated_at))
        
        if status:
            query = query.where(TaskModel.status == status.value)
        
        result = await self.session.execute(query)
        db_tasks = result.scalars().all()
        return [self._to_entity(db_task) for db_task in db_tasks]
    
    async def get_subtasks(self, parent_task_id: UUID) -> List[Task]:
        """Get all subtasks of a parent task."""
        query = select(TaskModel).where(TaskModel.parent_task_id == parent_task_id).options(
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.assigner),
            joinedload(TaskModel.department)
        ).order_by(TaskModel.created_at)
        
        result = await self.session.execute(query)
        db_tasks = result.scalars().all()
        return [self._to_entity(db_task) for db_task in db_tasks]
    
    async def search_tasks(self, 
                          title_search: Optional[str] = None,
                          assignee_id: Optional[UUID] = None,
                          assigner_id: Optional[UUID] = None,
                          department_id: Optional[UUID] = None,
                          status: Optional[TaskStatus] = None,
                          priority: Optional[Priority] = None,
                          overdue_only: bool = False,
                          limit: int = 50,
                          offset: int = 0) -> List[Task]:
        """Search tasks with various filters."""
        query = select(TaskModel).options(
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.assigner),
            joinedload(TaskModel.department)
        )
        
        # Apply filters
        if title_search:
            query = query.where(TaskModel.title.ilike(f"%{title_search}%"))
        
        if assignee_id:
            query = query.where(TaskModel.assignee_id == assignee_id)
        
        if assigner_id:
            query = query.where(TaskModel.assigner_id == assigner_id)
        
        if department_id:
            query = query.where(TaskModel.department_id == department_id)
        
        if status:
            query = query.where(TaskModel.status == status.value)
        
        if priority:
            query = query.where(TaskModel.priority == priority.value)
        
        if overdue_only:
            query = query.where(
                and_(
                    TaskModel.due_date < func.now(),
                    TaskModel.status.notin_(['COMPLETED', 'CANCELLED'])
                )
            )
        
        # Order, limit, and offset
        query = query.order_by(desc(TaskModel.updated_at)).limit(limit).offset(offset)
        
        result = await self.session.execute(query)
        db_tasks = result.scalars().all()
        return [self._to_entity(db_task) for db_task in db_tasks]
    
    async def count_tasks(self,
                         title_search: Optional[str] = None,
                         assignee_id: Optional[UUID] = None,
                         assigner_id: Optional[UUID] = None,
                         department_id: Optional[UUID] = None,
                         status: Optional[TaskStatus] = None,
                         priority: Optional[Priority] = None,
                         overdue_only: bool = False) -> int:
        """Count tasks matching filters for pagination."""
        query = select(func.count(TaskModel.id))
        
        # Apply the same filters as search_tasks
        if title_search:
            query = query.where(
                or_(
                    TaskModel.title.ilike(f"%{title_search}%"),
                    TaskModel.description.ilike(f"%{title_search}%")
                )
            )
        if assignee_id:
            query = query.where(TaskModel.assignee_id == assignee_id)
        if assigner_id:
            query = query.where(TaskModel.assigner_id == assigner_id)
        if department_id:
            query = query.where(TaskModel.department_id == department_id)
        if status:
            query = query.where(TaskModel.status == status)
        if priority:
            query = query.where(TaskModel.priority == priority)
        if overdue_only:
            query = query.where(
                and_(
                    TaskModel.due_date < func.now(),
                    TaskModel.status.notin_(['COMPLETED', 'CANCELLED'])
                )
            )
        
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def get_task_statistics(self, user_id: UUID, is_manager: bool = False) -> Dict[str, Any]:
        """Get task statistics for a user."""
        if is_manager:
            # Manager view: tasks they assigned
            base_query = select(TaskModel).where(TaskModel.assigner_id == user_id)
        else:
            # Employee view: tasks assigned to them
            base_query = select(TaskModel).where(TaskModel.assignee_id == user_id)
        
        # Total tasks
        total_result = await self.session.execute(
            base_query.with_only_columns(func.count())
        )
        total_tasks = total_result.scalar()
        
        # Tasks by status
        status_result = await self.session.execute(
            base_query.with_only_columns(TaskModel.status, func.count()).
            group_by(TaskModel.status)
        )
        status_counts = {status: count for status, count in status_result.fetchall()}
        
        # Overdue tasks
        overdue_query = base_query.where(
            and_(
                TaskModel.due_date < func.now(),
                TaskModel.status.notin_(['COMPLETED', 'CANCELLED'])
            )
        )
        overdue_result = await self.session.execute(
            overdue_query.with_only_columns(func.count())
        )
        overdue_tasks = overdue_result.scalar()
        
        # Priority breakdown
        priority_result = await self.session.execute(
            base_query.with_only_columns(TaskModel.priority, func.count()).
            group_by(TaskModel.priority)
        )
        priority_counts = {priority: count for priority, count in priority_result.fetchall()}
        
        return {
            "total_tasks": total_tasks,
            "status_breakdown": status_counts,
            "priority_breakdown": priority_counts,
            "overdue_tasks": overdue_tasks,
            "completed_tasks": status_counts.get('COMPLETED', 0),
            "in_progress_tasks": status_counts.get('IN_PROGRESS', 0),
            "pending_review_tasks": status_counts.get('SUBMITTED', 0) + status_counts.get('IN_REVIEW', 0)
        }
    
    async def get_manager_team_tasks(self, manager_id: UUID, status: Optional[TaskStatus] = None) -> List[Task]:
        """Get tasks for all employees managed by a manager."""
        # First get all employees under this manager
        employee_query = select(EmployeeModel.id).where(EmployeeModel.manager_id == manager_id)
        employee_result = await self.session.execute(employee_query)
        employee_ids = [row[0] for row in employee_result.fetchall()]
        
        if not employee_ids:
            return []
        
        # Then get tasks assigned to those employees
        query = select(TaskModel).where(TaskModel.assignee_id.in_(employee_ids)).options(
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.assigner),
            joinedload(TaskModel.department)
        ).order_by(desc(TaskModel.updated_at))
        
        if status:
            query = query.where(TaskModel.status == status.value)
        
        result = await self.session.execute(query)
        db_tasks = result.scalars().all()
        return [self._to_entity(db_task) for db_task in db_tasks]
    
    async def get_tasks_requiring_action(self, user_id: UUID, is_manager: bool = False) -> List[Task]:
        """Get tasks that require action from the user."""
        if is_manager:
            # Manager needs to review submitted tasks
            query = select(TaskModel).where(
                and_(
                    TaskModel.assigner_id == user_id,
                    TaskModel.status.in_(['SUBMITTED', 'IN_REVIEW'])
                )
            )
        else:
            # Employee needs to work on assigned/rejected tasks
            query = select(TaskModel).where(
                and_(
                    TaskModel.assignee_id == user_id,
                    TaskModel.status.in_(['ASSIGNED', 'IN_PROGRESS'])
                )
            )
        
        query = query.options(
            joinedload(TaskModel.assignee),
            joinedload(TaskModel.assigner),
            joinedload(TaskModel.department)
        ).order_by(desc(TaskModel.updated_at))
        
        result = await self.session.execute(query)
        db_tasks = result.scalars().all()
        return [self._to_entity(db_task) for db_task in db_tasks]
    
    def _to_entity(self, db_task: TaskModel) -> Task:
        """Convert database model to entity."""
        if not db_task:
            return None
            
        return Task(
            id=db_task.id,
            title=db_task.title,
            description=db_task.description,
            task_type=TaskType(db_task.task_type),
            priority=Priority(db_task.priority),
            status=TaskStatus(db_task.status),
            assignee_id=db_task.assignee_id,
            assigner_id=db_task.assigner_id,
            department_id=db_task.department_id,
            parent_task_id=db_task.parent_task_id,
            progress_percentage=db_task.progress_percentage,
            estimated_hours=float(db_task.estimated_hours) if db_task.estimated_hours else None,
            actual_hours=float(db_task.actual_hours) if db_task.actual_hours else None,
            created_at=db_task.created_at,
            assigned_at=db_task.assigned_at,
            started_at=db_task.started_at,
            due_date=db_task.due_date,
            submitted_at=db_task.submitted_at,
            reviewed_at=db_task.reviewed_at,
            completed_at=db_task.completed_at,
            updated_at=db_task.updated_at,
            tags=db_task.tags or [],
            attachments=db_task.attachments or [],
            review_notes=db_task.review_notes,
            rejection_reason=db_task.rejection_reason,
            approval_notes=db_task.approval_notes,
            version=db_task.version
        )