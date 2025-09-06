from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, timezone

from app.core.entities.task import Task, TaskType, Priority, TaskStatus
from app.core.entities.events import TaskCreatedEvent
from app.core.interfaces.repositories import (
    TaskRepositoryInterface, 
    TaskActivityRepositoryInterface,
    EmployeeRepositoryInterface,
    DepartmentRepositoryInterface
)
from app.domain.task_workflow_service import TaskWorkflowService


class ManagerTaskUseCase:
    """Use case for manager task management operations."""
    
    def __init__(self,
                 task_repository: TaskRepositoryInterface,
                 activity_repository: TaskActivityRepositoryInterface,
                 employee_repository: EmployeeRepositoryInterface,
                 department_repository: DepartmentRepositoryInterface,
                 workflow_service: TaskWorkflowService):
        self.task_repository = task_repository
        self.activity_repository = activity_repository
        self.employee_repository = employee_repository
        self.department_repository = department_repository
        self.workflow_service = workflow_service
    
    async def create_task(self, manager_id: UUID, title: str, description: Optional[str] = None,
                         task_type: TaskType = TaskType.TASK, priority: Priority = Priority.MEDIUM,
                         department_id: Optional[UUID] = None, assignee_id: Optional[UUID] = None,
                         parent_task_id: Optional[UUID] = None, estimated_hours: Optional[float] = None, 
                         due_date: Optional[datetime] = None, tags: Optional[List[str]] = None,
                         details: Optional[Dict[str, Any]] = None) -> Task:
        """Create a new task."""
        # Validate manager exists
        manager = await self.employee_repository.get_by_user_id(manager_id)
        if not manager:
            raise ValueError("Manager not found")
        
        # If parent task is specified, validate it exists and manager has access
        if parent_task_id:
            parent_task = await self.task_repository.get_by_id(parent_task_id)
            if not parent_task:
                raise ValueError("Parent task not found")
            if parent_task.assigner_id != manager_id:
                raise ValueError("You can only create subtasks for your own tasks")
        
        # Create task entity
        task = Task(
            id=uuid4(),
            title=title,
            description=description,
            task_type=task_type,
            priority=priority,
            status=TaskStatus.ASSIGNED if assignee_id else TaskStatus.DRAFT,
            assignee_id=assignee_id,
            assigner_id=manager.id,
            department_id=department_id or manager.department_id,
            parent_task_id=parent_task_id,
            progress_percentage=0,
            estimated_hours=estimated_hours,
            actual_hours=None,
            due_date=due_date,
            tags=tags or [],
            attachments=[],
            version=1
        )
        
        # Save task
        created_task = await self.task_repository.create(task)
        
        # Log creation activity
        from app.core.entities.task import TaskActivity, TaskAction
        activity = TaskActivity(
            id=None,
            task_id=created_task.id,
            performed_by=manager.id,
            action=TaskAction.CREATED,
            new_status=TaskStatus.DRAFT,
            details={"task_type": task_type.value, "priority": priority.value}
        )
        await self.activity_repository.create(activity)
        
        # Emit domain event
        event = TaskCreatedEvent(created_task.id, created_task.to_dict())
        
        return created_task
    
    async def assign_task_to_employee(self, task_id: UUID, manager_id: UUID, 
                                    assignee_id: UUID) -> Task:
        """Assign a task to an employee."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Get manager employee record to convert user_id to employee_id
        manager = await self.employee_repository.get_by_user_id(manager_id)
        if not manager:
            raise ValueError("Manager not found")
        
        # Validate permissions (use employee_id not user_id)
        if not await self.workflow_service.validate_task_permissions(task, manager.id, "assign"):
            raise ValueError("You don't have permission to assign this task")
        
        # Validate assignee exists
        assignee = await self.employee_repository.get_by_id(assignee_id)
        if not assignee:
            raise ValueError("Assignee not found")
        
        # Use workflow service to assign (pass employee_id not user_id)
        return await self.workflow_service.assign_task(task, assignee_id, manager.id)
    
    async def get_my_created_tasks(self, manager_id: UUID, status: Optional[TaskStatus] = None,
                                 limit: int = 50, offset: int = 0) -> List[Task]:
        """Get tasks created by the manager."""
        return await self.task_repository.get_tasks_by_assigner(manager_id, status)
    
    async def get_team_tasks(self, manager_id: UUID, status: Optional[TaskStatus] = None) -> List[Task]:
        """Get all tasks for employees managed by this manager."""
        return await self.task_repository.get_manager_team_tasks(manager_id, status)
    
    async def get_department_tasks(self, manager_id: UUID, department_id: UUID,
                                 status: Optional[TaskStatus] = None) -> List[Task]:
        """Get tasks for a specific department."""
        # Validate manager has access to department
        manager = await self.employee_repository.get_by_user_id(manager_id)
        if not manager:
            raise ValueError("Manager not found")
        
        # For now, allow if manager is in same department or manages the department
        # More sophisticated permission checks would be implemented here
        
        return await self.task_repository.get_tasks_by_department(department_id, status)
    
    async def start_task_review(self, task_id: UUID, manager_id: UUID) -> Task:
        """Start reviewing a submitted task."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Use workflow service to start review
        return await self.workflow_service.start_task_review(task, manager_id)
    
    async def approve_task(self, task_id: UUID, manager_id: UUID, 
                         approval_notes: Optional[str] = None) -> Task:
        """Approve and complete a task."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Get manager employee record to convert user_id to employee_id
        manager = await self.employee_repository.get_by_user_id(manager_id)
        if not manager:
            raise ValueError("Manager not found")
        
        # Use workflow service to approve (pass employee_id not user_id)
        return await self.workflow_service.approve_task(task, manager.id, approval_notes)
    
    async def reject_task(self, task_id: UUID, manager_id: UUID, rejection_reason: str) -> Task:
        """Reject a task and send back for rework."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        if not rejection_reason or not rejection_reason.strip():
            raise ValueError("Rejection reason is required")
        
        # Get manager employee record to convert user_id to employee_id
        manager = await self.employee_repository.get_by_user_id(manager_id)
        if not manager:
            raise ValueError("Manager not found")
        
        # Use workflow service to reject (pass employee_id not user_id)
        return await self.workflow_service.reject_task(task, manager.id, rejection_reason)
    
    async def update_task(self, task_id: UUID, manager_id: UUID, **updates) -> Task:
        """Update task details."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Validate permissions
        if not await self.workflow_service.validate_task_permissions(task, manager_id, "edit"):
            raise ValueError("You don't have permission to edit this task")
        
        # Use workflow service to update
        return await self.workflow_service.update_task_details(task, manager_id, updates)
    
    async def cancel_task(self, task_id: UUID, manager_id: UUID, 
                        cancellation_reason: Optional[str] = None) -> Task:
        """Cancel a task."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Use workflow service to cancel
        return await self.workflow_service.cancel_task(task, manager_id, cancellation_reason)
    
    async def get_task_details(self, task_id: UUID, manager_id: UUID) -> Dict[str, Any]:
        """Get detailed task information with related data."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Managers can view any task - no permission check needed
        # (Already authenticated as manager at API level)
        
        # Load related data
        assignee_data = None
        department_data = None
        
        if task.assignee_id:
            assignee = await self.employee_repository.get_by_id(task.assignee_id)
            if assignee:
                assignee_data = {
                    "id": assignee.id,
                    "first_name": assignee.first_name,
                    "last_name": assignee.last_name, 
                    "full_name": f"{assignee.first_name} {assignee.last_name}",
                    "email": assignee.email,
                    "department_name": assignee.department  # This is just a string name
                }
                
                # Load full department data if department_id exists
                if assignee.department_id:
                    department = await self.department_repository.get_by_id(assignee.department_id)
                    if department:
                        department_data = {
                            "id": department.id,
                            "name": department.name,
                            "code": department.name  # Use name as code since Department entity doesn't have code field
                        }
        
        # Also check if task itself has department_id (fallback)
        if not department_data and task.department_id:
            department = await self.department_repository.get_by_id(task.department_id)
            if department:
                department_data = {
                    "id": department.id,
                    "name": department.name,
                    "code": department.name  # Use name as code since Department entity doesn't have code field
                }
        
        # Create task data with related objects
        task_data = {
            **task.__dict__,
            "assignee": assignee_data,
            "department": department_data
        }
        
        # Handle computed fields
        if hasattr(task, 'is_overdue') and callable(task.is_overdue):
            task_data['is_overdue'] = task.is_overdue()
        else:
            task_data['is_overdue'] = False
            
        if hasattr(task, 'days_until_due') and callable(task.days_until_due):
            task_data['days_until_due'] = task.days_until_due()
        else:
            task_data['days_until_due'] = None
        
        return task_data
    
    async def get_tasks_requiring_review(self, manager_id: UUID) -> List[Task]:
        """Get tasks that require review from this manager."""
        return await self.task_repository.get_tasks_requiring_action(manager_id, is_manager=True)
    
    async def search_tasks_core(self, manager_id: UUID, title_search: Optional[str] = None,
                         assignee_id: Optional[UUID] = None, department_id: Optional[UUID] = None,
                         status: Optional[TaskStatus] = None, priority: Optional[Priority] = None,
                         overdue_only: bool = False, limit: int = 50, offset: int = 0) -> List[Task]:
        """Search tasks with filters (core business logic)."""
        # Get manager employee record
        manager = await self.employee_repository.get_by_user_id(manager_id)
        if not manager:
            raise ValueError("Manager not found")
            
        # For managers, we can search within their scope (tasks they created + team tasks)
        # This would be enhanced with proper permission filtering
        
        return await self.task_repository.search_tasks(
            title_search=title_search,
            assignee_id=assignee_id,
            assigner_id=manager.id,  # Limit to tasks they created
            department_id=department_id,
            status=status,
            priority=priority,
            overdue_only=overdue_only,
            limit=limit,
            offset=offset
        )

    async def search_tasks(self, manager_id: UUID, filters: Dict[str, Any],
                          page: int = 1, per_page: int = 50,
                          sort_by: str = "created_at", sort_order: str = "desc") -> Dict[str, Any]:
        """Search tasks (endpoint-compatible method)."""
        # Get manager employee record
        manager = await self.employee_repository.get_by_user_id(manager_id)
        if not manager:
            raise ValueError("Manager not found")
        
        # Extract and convert filter parameters
        title_search = filters.get("search")
        assignee_id = filters.get("assignee_id")
        department_id = filters.get("department_id")
        status = None
        priority = None
        
        # Convert status strings to enum
        if filters.get("status"):
            try:
                status = TaskStatus(filters["status"][0]) if isinstance(filters["status"], list) and filters["status"] else TaskStatus(filters["status"])
            except (ValueError, KeyError):
                status = None
                
        # Convert priority strings to enum  
        if filters.get("priority"):
            try:
                priority = Priority(filters["priority"][0]) if isinstance(filters["priority"], list) and filters["priority"] else Priority(filters["priority"])
            except (ValueError, KeyError):
                priority = None
        
        # Calculate pagination
        limit = min(per_page, 100)  # Cap at 100 for performance
        offset = (page - 1) * per_page
        
        # Call core search method with proper parameters
        tasks = await self.search_tasks_core(
            manager_id=manager_id,
            title_search=title_search,
            assignee_id=assignee_id,
            department_id=department_id,
            status=status,
            priority=priority,
            overdue_only=filters.get("is_overdue", False),
            limit=limit,
            offset=offset
        )
        
        # Get total count for pagination using proper count method  
        total_count = await self.task_repository.count_tasks(
            title_search=title_search,
            assignee_id=assignee_id,
            assigner_id=manager.id,
            department_id=department_id,
            status=status,
            priority=priority,
            overdue_only=filters.get("is_overdue", False)
        )
        
        # Convert to response format
        task_responses = []
        for task in tasks:
            task_responses.append(self._task_to_search_response(task))
        
        total_pages = (total_count + per_page - 1) // per_page if total_count > 0 else 0
        
        return {
            "tasks": task_responses,
            "total_count": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1
        }
    
    def _task_to_search_response(self, task) -> Dict[str, Any]:
        """Convert Task entity to search response format."""
        return {
            "id": str(task.id),
            "title": task.title,
            "description": task.description,
            "status": task.status.value,
            "priority": task.priority.value,
            "task_type": task.task_type.value,
            "assignee_name": f"{task.assignee.first_name} {task.assignee.last_name}" if hasattr(task, 'assignee') and task.assignee else None,
            "assigner_name": f"{task.assigner.first_name} {task.assigner.last_name}" if hasattr(task, 'assigner') and task.assigner else None,
            "department_name": getattr(task, 'department', {}).get('name', 'Unknown') if hasattr(task, 'department') else "Unknown",
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None,
            "progress_percentage": task.progress_percentage,
            "estimated_hours": task.estimated_hours,
            "actual_hours": task.actual_hours,
            "is_overdue": task.is_overdue() if hasattr(task, 'is_overdue') else False,
            "days_until_due": task.days_until_due() if hasattr(task, 'days_until_due') and task.due_date else None
        }
    
    async def get_task_statistics(self, manager_id: UUID) -> Dict[str, Any]:
        """Get task statistics for the manager."""
        return await self.task_repository.get_task_statistics(manager_id, is_manager=True)

    async def get_manager_dashboard(self, manager_id: UUID) -> Dict[str, Any]:
        """Get comprehensive manager dashboard data."""
        from datetime import datetime, timezone
        
        # Convert user_id to employee_id for repository queries
        manager = await self.employee_repository.get_by_user_id(manager_id)
        if not manager:
            raise ValueError("Manager employee record not found")
        
        manager_employee_id = manager.id
        
        # Get basic statistics
        stats = await self.get_task_statistics(manager_employee_id)
        
        # Get tasks requiring review
        pending_review = await self.get_tasks_requiring_review(manager_employee_id)
        
        # Load employee names for pending review tasks and convert to TaskSummaryResponse format
        pending_review_responses = []
        for task in pending_review:
            assignee_name = None
            manager_name = None
            department_name = "Default Department"
            
            if task.assignee_id:
                assignee = await self.employee_repository.get_by_id(task.assignee_id)
                if assignee:
                    assignee_name = f"{assignee.first_name} {assignee.last_name}"
            
            if task.assigner_id:
                assigner = await self.employee_repository.get_by_id(task.assigner_id)
                if assigner:
                    manager_name = f"{assigner.first_name} {assigner.last_name}"
            
            # Convert to TaskSummaryResponse format
            task_summary = {
                "id": task.id,
                "title": task.title,
                "task_type": task.task_type.value if task.task_type else "TASK",
                "priority": task.priority.value,
                "status": task.status.value,
                "assignee_name": assignee_name,
                "manager_name": manager_name,
                "department_name": department_name,
                "due_date": task.due_date,
                "progress_percentage": task.progress_percentage or 0,
                "created_at": task.created_at,
                "is_overdue": task.due_date and task.due_date < datetime.now(timezone.utc) if task.due_date else False
            }
            pending_review_responses.append(task_summary)
        
        # Get recent team tasks (last 10)
        recent_tasks = await self.get_team_tasks(manager_employee_id)
        
        # Get my created tasks
        my_tasks = await self.get_my_created_tasks(manager_employee_id)
        
        # Get recent activities from tasks managed by this manager
        recent_activities_raw = await self.activity_repository.get_recent_team_activities(manager_employee_id, limit=10)
        
        # Convert activities to TaskActivityResponse format
        recent_activities_responses = []
        for activity in recent_activities_raw:
            performed_by_name = "Unknown User"
            task_title = "Unknown Task"
            
            # Get performer name
            if activity.performed_by:
                performer = await self.employee_repository.get_by_id(activity.performed_by)
                if performer:
                    performed_by_name = f"{performer.first_name} {performer.last_name}"
            
            # Get task title
            if activity.task_id:
                task = await self.task_repository.get_by_id(activity.task_id)
                if task:
                    task_title = task.title
            
            # Convert to TaskActivityResponse format
            activity_response = {
                "id": activity.id if activity.id else uuid4(),
                "action": activity.action.value if hasattr(activity.action, 'value') else str(activity.action),
                "user_id": activity.performed_by,
                "user_name": performed_by_name,
                "details": {"task_title": task_title},
                "timestamp": activity.created_at or datetime.now(timezone.utc)
            }
            recent_activities_responses.append(activity_response)
        
        # Get overdue tasks and convert to TaskSummaryResponse format
        overdue_tasks_responses = []
        if recent_tasks:
            now = datetime.now(timezone.utc)
            overdue_tasks_raw = [task for task in recent_tasks if task.due_date and task.due_date < now and task.status.value not in ['COMPLETED', 'CANCELLED']]
            
            # Load employee names for overdue tasks
            for task in overdue_tasks_raw:
                assignee_name = None
                manager_name = None
                department_name = "Default Department"
                
                if task.assignee_id:
                    assignee = await self.employee_repository.get_by_id(task.assignee_id)
                    if assignee:
                        assignee_name = f"{assignee.first_name} {assignee.last_name}"
                
                if task.assigner_id:
                    assigner = await self.employee_repository.get_by_id(task.assigner_id)
                    if assigner:
                        manager_name = f"{assigner.first_name} {assigner.last_name}"
                
                # Convert to TaskSummaryResponse format
                task_summary = {
                    "id": task.id,
                    "title": task.title,
                    "task_type": task.task_type.value if task.task_type else "TASK",
                    "priority": task.priority.value,
                    "status": task.status.value,
                    "assignee_name": assignee_name,
                    "manager_name": manager_name,
                    "department_name": department_name,
                    "due_date": task.due_date,
                    "progress_percentage": task.progress_percentage or 0,
                    "created_at": task.created_at,
                    "is_overdue": True
                }
                overdue_tasks_responses.append(task_summary)
        
        # Build TaskStatsResponse for personal_stats
        personal_stats = {
            "total_tasks": len(my_tasks) if my_tasks else 0,
            "by_status": stats.get("status_breakdown", {}),
            "by_priority": stats.get("priority_breakdown", {}),
            "by_type": {},
            "overdue_count": stats.get("overdue_tasks", 0),
            "completion_rate": 0.0,
            "average_completion_days": 0.0
        }
        
        # Build TeamTaskStatsResponse for team_stats
        team_stats = {
            "department": {
                "id": "00000000-0000-0000-0000-000000000000",
                "name": "Default Department",
                "code": "DEFAULT"
            },
            "total_team_tasks": len(recent_tasks) if recent_tasks else 0,
            "active_tasks": len([t for t in recent_tasks if t.status.value in ['ASSIGNED', 'IN_PROGRESS']]) if recent_tasks else 0,
            "completed_tasks": len([t for t in recent_tasks if t.status.value == 'COMPLETED']) if recent_tasks else 0,
            "overdue_tasks": len(overdue_tasks_responses),
            "team_members": [],
            "completion_rate": 0.0,
            "average_task_age": 0.0
        }
        
        return {
            "personal_stats": personal_stats,
            "team_stats": team_stats,
            "recent_activities": recent_activities_responses,
            "pending_reviews": pending_review_responses,
            "overdue_tasks": overdue_tasks_responses
        }
    
    async def get_task_activities(self, task_id: UUID, manager_id: UUID) -> List:
        """Get activity log for a task."""
        # Get task first to validate permissions
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Validate permissions
        if not await self.workflow_service.validate_task_permissions(task, manager_id, "view"):
            raise ValueError("You don't have permission to view this task")
        
        return await self.activity_repository.get_by_task_id(task_id)
    
    async def get_subtasks(self, parent_task_id: UUID, manager_id: UUID) -> List[Task]:
        """Get subtasks of a parent task."""
        # Get parent task first to validate permissions
        parent_task = await self.task_repository.get_by_id(parent_task_id)
        if not parent_task:
            raise ValueError("Parent task not found")
        
        # Validate permissions
        if not await self.workflow_service.validate_task_permissions(parent_task, manager_id, "view"):
            raise ValueError("You don't have permission to view this task")
        
        return await self.task_repository.get_subtasks(parent_task_id)
    
    async def bulk_assign_tasks(self, task_ids: List[UUID], manager_id: UUID, 
                              assignee_id: UUID) -> List[Task]:
        """Assign multiple tasks to an employee."""
        # Validate assignee exists
        assignee = await self.employee_repository.get_by_id(assignee_id)
        if not assignee:
            raise ValueError("Assignee not found")
        
        assigned_tasks = []
        errors = []
        
        for task_id in task_ids:
            try:
                task = await self.assign_task_to_employee(task_id, manager_id, assignee_id)
                assigned_tasks.append(task)
            except Exception as e:
                errors.append({"task_id": task_id, "error": str(e)})
        
        if errors and not assigned_tasks:
            raise ValueError(f"Failed to assign any tasks: {errors}")
        
        return assigned_tasks