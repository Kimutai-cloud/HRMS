from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone, timedelta

from app.core.entities.task import Task, TaskStatus, Priority
from app.core.interfaces.repositories import (
    TaskRepositoryInterface, 
    TaskActivityRepositoryInterface,
    EmployeeRepositoryInterface
)
from app.domain.task_workflow_service import TaskWorkflowService


class EmployeeTaskUseCase:
    """Use case for employee task management operations."""
    
    def __init__(self,
                 task_repository: TaskRepositoryInterface,
                 activity_repository: TaskActivityRepositoryInterface,
                 employee_repository: EmployeeRepositoryInterface,
                 workflow_service: TaskWorkflowService):
        self.task_repository = task_repository
        self.activity_repository = activity_repository
        self.employee_repository = employee_repository
        self.workflow_service = workflow_service
    
    async def get_my_tasks(self, employee_id: UUID, status: Optional[TaskStatus] = None) -> List[Task]:
        """Get tasks assigned to the employee."""
        return await self.task_repository.get_tasks_by_assignee(employee_id, status)
    
    async def get_task_details(self, task_id: UUID, employee_id: UUID) -> Task:
        """Get detailed task information."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Validate permissions
        if not await self.workflow_service.validate_task_permissions(task, employee_id, "view"):
            raise ValueError("You don't have permission to view this task")
        
        return task
    
    async def start_task(self, task_id: UUID, employee_user_id: UUID) -> Task:
        """Start working on a task."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Get employee by user_id
        employee = await self.employee_repository.get_by_user_id(employee_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Use workflow service to start task
        return await self.workflow_service.start_task_work(task, employee.id)
    
    async def update_progress(self, task_id: UUID, employee_user_id: UUID, 
                            progress_percentage: int, hours_worked: Optional[float] = None, 
                            notes: Optional[str] = None) -> Task:
        """Update progress on a task (endpoint-compatible method)."""
        # Get employee by user_id
        employee = await self.employee_repository.get_by_user_id(employee_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Use the existing method with employee_id
        return await self.update_task_progress(task_id, employee.id, progress_percentage, hours_worked)
    
    async def update_task_progress(self, task_id: UUID, employee_id: UUID, 
                                 progress: int, actual_hours: Optional[float] = None) -> Task:
        """Update progress on a task."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Validate progress value
        if progress < 0 or progress > 100:
            raise ValueError("Progress must be between 0 and 100")
        
        # Use workflow service to update progress
        return await self.workflow_service.update_task_progress(task, employee_id, progress, actual_hours)
    
    async def submit_task(self, task_id: UUID, employee_user_id: UUID, 
                         submission_notes: Optional[str] = None, attachments: Optional[List] = None) -> Task:
        """Submit task for review."""
        # Get employee by user_id
        employee = await self.employee_repository.get_by_user_id(employee_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Use workflow service to submit task
        return await self.workflow_service.submit_task_for_review(task, employee.id, submission_notes)
    
    async def get_tasks_requiring_action(self, employee_id: UUID) -> List[Task]:
        """Get tasks that require action from this employee."""
        return await self.task_repository.get_tasks_requiring_action(employee_id, is_manager=False)
    
    async def get_task_statistics(self, employee_id: UUID) -> Dict[str, Any]:
        """Get task statistics for the employee."""
        return await self.task_repository.get_task_statistics(employee_id, is_manager=False)
    
    async def get_task_activities(self, task_id: UUID, employee_id: UUID) -> List:
        """Get activity log for a task."""
        # Get task first to validate permissions
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Validate permissions
        if not await self.workflow_service.validate_task_permissions(task, employee_id, "view"):
            raise ValueError("You don't have permission to view this task")
        
        return await self.activity_repository.get_by_task_id(task_id)
    
    async def get_task_by_id(self, task_id: UUID, employee_id: UUID) -> Task:
        """Get task by ID with permission check."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Validate permissions
        if not await self.workflow_service.validate_task_permissions(task, employee_id, "view"):
            raise ValueError("You don't have permission to view this task")
        
        return await self.task_repository.get_by_id(task_id)
    
    async def search_my_tasks(self, employee_id: UUID, title_search: Optional[str] = None,
                             status: Optional[TaskStatus] = None, priority: Optional[Priority] = None,
                             overdue_only: bool = False, limit: int = 50, offset: int = 0) -> List[Task]:
        """Search employee's assigned tasks."""
        return await self.task_repository.search_tasks(
            title_search=title_search,
            assignee_id=employee_id,
            status=status,
            priority=priority,
            overdue_only=overdue_only,
            limit=limit,
            offset=offset
        )
    
    async def get_overdue_tasks(self, employee_id: UUID) -> List[Task]:
        """Get employee's overdue tasks."""
        return await self.task_repository.search_tasks(
            assignee_id=employee_id,
            overdue_only=True,
            limit=100
        )
    
    async def get_high_priority_tasks(self, employee_id: UUID) -> List[Task]:
        """Get employee's high priority tasks."""
        return await self.task_repository.search_tasks(
            assignee_id=employee_id,
            priority=Priority.HIGH,
            status=TaskStatus.ASSIGNED,
            limit=50
        ) + await self.task_repository.search_tasks(
            assignee_id=employee_id,
            priority=Priority.URGENT,
            limit=50
        )
    
    async def get_completed_tasks(self, employee_id: UUID, limit: int = 20) -> List[Task]:
        """Get employee's recently completed tasks."""
        return await self.task_repository.search_tasks(
            assignee_id=employee_id,
            status=TaskStatus.COMPLETED,
            limit=limit
        )
    
    async def get_my_recent_activities(self, employee_id: UUID, limit: int = 20) -> List:
        """Get employee's recent task activities."""
        return await self.activity_repository.get_user_activities(employee_id, limit)
    
    async def update_task_notes(self, task_id: UUID, employee_id: UUID, 
                              notes: str) -> Task:
        """Update personal notes on a task."""
        # Get task
        task = await self.task_repository.get_by_id(task_id)
        if not task:
            raise ValueError("Task not found")
        
        # Validate permissions
        if task.assignee_id != employee_id:
            raise ValueError("You can only update notes on your assigned tasks")
        
        # For now, we'll store notes in the task's review_notes field when it's the employee
        # In a more complete implementation, you might have separate employee_notes field
        changes = {"review_notes": notes}
        
        # Use workflow service to update
        return await self.workflow_service.update_task_details(task, employee_id, changes)
    
    async def get_dashboard_summary(self, employee_id: UUID) -> Dict[str, Any]:
        """Get dashboard summary for employee."""
        # Get statistics
        stats = await self.get_task_statistics(employee_id)
        
        # Get tasks requiring action
        action_tasks = await self.get_tasks_requiring_action(employee_id)
        
        # Get overdue tasks
        overdue_tasks = await self.get_overdue_tasks(employee_id)
        
        # Get high priority tasks
        high_priority = await self.get_high_priority_tasks(employee_id)
        
        # Get recent activities
        recent_activities = await self.get_my_recent_activities(employee_id, limit=5)
        
        return {
            "statistics": stats,
            "tasks_requiring_action": len(action_tasks),
            "overdue_tasks": len(overdue_tasks),
            "high_priority_tasks": len(high_priority),
            "recent_activities": recent_activities,
            "action_tasks_preview": action_tasks[:3],  # Preview of first 3
            "overdue_tasks_preview": overdue_tasks[:3],
            "high_priority_preview": high_priority[:3]
        }
    
    async def get_workload_analysis(self, employee_id: UUID) -> Dict[str, Any]:
        """Get workload analysis for employee."""
        # Get all active tasks
        active_tasks = await self.task_repository.search_tasks(
            assignee_id=employee_id,
            limit=1000  # Get all tasks for analysis
        )
        
        # Filter to active statuses
        active_statuses = [TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED, TaskStatus.IN_REVIEW]
        active_tasks = [t for t in active_tasks if t.status in active_statuses]
        
        # Calculate workload metrics
        total_estimated_hours = sum(t.estimated_hours or 0 for t in active_tasks)
        total_actual_hours = sum(t.actual_hours or 0 for t in active_tasks)
        
        # Tasks by priority
        priority_breakdown = {}
        for priority in Priority:
            priority_breakdown[priority.value] = len([t for t in active_tasks if t.priority == priority])
        
        # Average progress
        total_progress = sum(t.progress_percentage for t in active_tasks)
        avg_progress = total_progress / len(active_tasks) if active_tasks else 0
        
        # Tasks approaching deadline
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        approaching_deadline = [
            t for t in active_tasks 
            if t.due_date and t.due_date <= now + timedelta(days=3) and t.due_date > now
        ]
        
        return {
            "total_active_tasks": len(active_tasks),
            "total_estimated_hours": total_estimated_hours,
            "total_actual_hours": total_actual_hours,
            "average_progress": round(avg_progress, 1),
            "priority_breakdown": priority_breakdown,
            "tasks_approaching_deadline": len(approaching_deadline),
            "approaching_deadline_preview": approaching_deadline[:5]
        }
    
    async def get_employee_dashboard(self, user_id: UUID):
        """Get comprehensive employee task dashboard with personal statistics and assigned tasks."""
        # Convert user_id to employee_id
        employee = await self.employee_repository.get_by_user_id(user_id)
        if not employee:
            raise ValueError("Employee profile not found")
        
        employee_id = employee.id
        
        # Get statistics using existing method
        stats = await self.get_task_statistics(employee_id)
        
        # Get tasks requiring action  
        action_tasks = await self.get_tasks_requiring_action(employee_id)
        
        # Get overdue tasks
        overdue_tasks = await self.get_overdue_tasks(employee_id)
        
        # Get high priority tasks  
        high_priority = await self.get_high_priority_tasks(employee_id)
        
        # Get recent activities
        recent_activities = await self.get_my_recent_activities(employee_id, limit=10)
        
        # Calculate task counts by status
        assigned_tasks = await self.task_repository.search_tasks(
            assignee_id=employee_id,
            status=TaskStatus.ASSIGNED,
            limit=50
        )
        
        in_progress_tasks = await self.task_repository.search_tasks(
            assignee_id=employee_id, 
            status=TaskStatus.IN_PROGRESS,
            limit=50
        )
        
        submitted_tasks = await self.task_repository.search_tasks(
            assignee_id=employee_id,
            status=TaskStatus.SUBMITTED,
            limit=50
        )
        
        completed_tasks = await self.task_repository.search_tasks(
            assignee_id=employee_id,
            status=TaskStatus.COMPLETED,
            limit=20
        )
        
        # Get upcoming deadlines (tasks due within 7 days)
        from datetime import timedelta
        upcoming_deadline_date = datetime.now(timezone.utc) + timedelta(days=7)
        upcoming_deadlines = await self.task_repository.search_tasks(
            assignee_id=employee_id,
            limit=50
        )
        # Filter for upcoming deadlines
        upcoming_deadlines = [
            task for task in upcoming_deadlines 
            if task.due_date and task.due_date <= upcoming_deadline_date and not task.is_overdue()
        ]
        
        # Calculate workload summary  
        workload_analysis = await self.get_workload_analysis(employee_id)
        
        # Return the correct structure matching EmployeeTaskDashboardResponse
        return {
            "personal_stats": {
                "total_tasks": len(assigned_tasks) + len(in_progress_tasks) + len(submitted_tasks) + len(completed_tasks),
                "by_status": {
                    "ASSIGNED": len(assigned_tasks),
                    "IN_PROGRESS": len(in_progress_tasks),
                    "SUBMITTED": len(submitted_tasks),
                    "COMPLETED": len(completed_tasks)
                },
                "by_priority": workload_analysis.get("priority_breakdown", {}),
                "by_type": {"PROJECT": 0, "TASK": len(assigned_tasks) + len(in_progress_tasks)},
                "overdue_count": len(overdue_tasks),
                "completion_rate": stats.get("completion_rate", 0.0),
                "average_completion_days": None
            },
            "assigned_tasks": [self._task_to_summary_with_schema(task) for task in assigned_tasks[:5]],
            "recent_activities": [self._activity_to_response(activity) for activity in recent_activities[:10]],
            "upcoming_deadlines": [self._task_to_summary_with_schema(task) for task in upcoming_deadlines[:5]],
            "workload_summary": {
                "employee": {
                    "id": employee.id,
                    "first_name": employee.first_name,
                    "last_name": employee.last_name,
                    "full_name": f"{employee.first_name} {employee.last_name}",
                    "email": employee.email,
                    "department_name": employee.department or "Unknown"
                },
                "assigned_tasks": len(assigned_tasks),
                "in_progress_tasks": len(in_progress_tasks),
                "pending_review_tasks": len(submitted_tasks),
                "completed_this_month": len(completed_tasks),
                "total_estimated_hours": workload_analysis.get("total_estimated_hours", 0.0),
                "total_actual_hours": workload_analysis.get("total_actual_hours", 0.0),
                "utilization_rate": workload_analysis.get("utilization_rate", 0.0)
            }
        }
    
    def _task_to_summary(self, task):
        """Convert task entity to summary dict."""
        return {
            "id": str(task.id),
            "title": task.title,
            "description": task.description,
            "status": task.status.value,
            "priority": task.priority.value,
            "progress_percentage": task.progress_percentage,
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "estimated_hours": task.estimated_hours,
            "actual_hours": task.actual_hours,
            "is_overdue": task.is_overdue(),
            "days_until_due": task.days_until_due(),
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None
        }
    
    def _task_to_summary_with_schema(self, task):
        """Convert task entity to summary dict with all schema fields."""
        return {
            "id": str(task.id),
            "title": task.title,
            "task_type": task.task_type.value,  # Required field
            "priority": task.priority.value,
            "status": task.status.value,
            "assignee_name": f"{task.assignee.first_name} {task.assignee.last_name}" if hasattr(task, 'assignee') and task.assignee else None,
            "manager_name": f"{task.assigner.first_name} {task.assigner.last_name}" if hasattr(task, 'assigner') and task.assigner else None,
            "department_name": getattr(task, 'department', {}).get('name', 'Unknown') if hasattr(task, 'department') else "Unknown",  # Required field
            "due_date": task.due_date.isoformat() if task.due_date else None,
            "progress_percentage": task.progress_percentage,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "is_overdue": task.is_overdue()
        }

    def _activity_to_response(self, activity):
        """Convert TaskActivity entity to response dict."""
        return {
            "id": str(activity.id),
            "task_id": str(activity.task_id) if hasattr(activity, "task_id") else None,
            "task_title": getattr(activity, "task_title", "Unknown Task"),
            "action": getattr(activity, "activity_type", "UPDATE"),
            "description": getattr(activity, "description", ""),
            "user_id": str(activity.performed_by) if hasattr(activity, "performed_by") else None,
            "user_name": getattr(activity, "performed_by_name", "Unknown"),
            "timestamp": activity.created_at.isoformat() if getattr(activity, "created_at", None) else None,
        }


    async def search_personal_tasks(self, employee_user_id: UUID, filters: Dict[str, Any],
                                   page: int = 1, per_page: int = 50, 
                                   sort_by: str = "created_at", sort_order: str = "desc") -> Dict[str, Any]:
        """Search personal tasks (endpoint-compatible method)."""
        # Convert user_id to employee_id
        employee = await self.employee_repository.get_by_user_id(employee_user_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Extract and convert filter parameters
        title_search = filters.get("search")
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
        
        # Call existing search method with proper parameters
        tasks = await self.search_my_tasks(
            employee_id=employee.id,
            title_search=title_search,
            status=status,
            priority=priority,
            overdue_only=filters.get("is_overdue", False),
            limit=limit,
            offset=offset
        )
        
        # Get total count for pagination using proper count method
        total_count = await self.task_repository.count_tasks(
            title_search=title_search,
            assignee_id=employee.id,
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