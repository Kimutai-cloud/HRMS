from pydantic import BaseModel, Field, field_validator, ConfigDict, computed_field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from enum import Enum

from app.core.entities.task import TaskType, Priority, TaskStatus


# Enums for API responses
class TaskTypeResponse(str, Enum):
    """Task types for API responses."""
    PROJECT = "PROJECT"
    TASK = "TASK"
    SUBTASK = "SUBTASK"


# Using Priority from task entity directly for consistency


class TaskStatusResponse(str, Enum):
    """Task statuses for API responses."""
    DRAFT = "DRAFT"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# Employee summary for task responses
class TaskEmployeeSummary(BaseModel):
    """Employee summary for task responses."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Employee ID")
    first_name: str = Field(..., description="Employee first name")
    last_name: str = Field(..., description="Employee last name")
    full_name: str = Field(..., description="Employee full name")
    email: str = Field(..., description="Employee email")
    department_name: Optional[str] = Field(None, description="Department name")


class TaskDepartmentSummary(BaseModel):
    """Department summary for task responses."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Department ID")
    name: str = Field(..., description="Department name")
    code: str = Field(..., description="Department code")


# Comment schemas
class TaskCommentResponse(BaseModel):
    """Task comment response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Comment ID")
    comment_text: str = Field(..., description="Comment text")
    comment_type: str = Field(..., description="Comment type")
    author_id: UUID = Field(..., description="Author ID")
    author_name: str = Field(..., description="Author full name")
    created_at: datetime = Field(..., description="Comment creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Comment update timestamp")


class AddTaskCommentRequest(BaseModel):
    """Request to add a comment to a task."""
    comment_text: str = Field(..., min_length=1, max_length=2000, description="Comment text")
    comment_type: str = Field("USER_COMMENT", description="Comment type")


class UpdateTaskCommentRequest(BaseModel):
    """Request to update a task comment."""
    comment_text: str = Field(..., min_length=1, max_length=2000, description="Updated comment text")


# Task activity schemas
class TaskActivityResponse(BaseModel):
    """Task activity response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Activity ID")
    action: str = Field(..., description="Action performed")
    user_id: UUID = Field(..., description="User who performed the action")
    user_name: str = Field(..., description="User full name")
    details: Optional[Dict[str, Any]] = Field(None, description="Activity details")
    timestamp: datetime = Field(..., description="Activity timestamp")


# Core task schemas
class TaskResponse(BaseModel):
    """Task response for API."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    task_type: TaskTypeResponse = Field(..., description="Task type")
    priority: Priority = Field(..., description="Task priority")
    status: TaskStatusResponse = Field(..., description="Task status")
    
    # Relationships
    assignee_id: Optional[UUID] = Field(None, description="Assignee ID")
    assignee: Optional[TaskEmployeeSummary] = Field(None, description="Assignee details")
    assigner_id: UUID = Field(..., description="Assigner ID (Manager who created task)")
    manager: Optional[TaskEmployeeSummary] = Field(None, description="Manager details")
    department_id: Optional[UUID] = Field(None, description="Department ID")
    department: Optional[TaskDepartmentSummary] = Field(None, description="Department details")
    parent_task_id: Optional[UUID] = Field(None, description="Parent task ID")
    
    # Timeline
    created_at: datetime = Field(..., description="Task creation timestamp")
    assigned_at: Optional[datetime] = Field(None, description="Task assignment timestamp")
    started_at: Optional[datetime] = Field(None, description="Task start timestamp")
    submitted_at: Optional[datetime] = Field(None, description="Task submission timestamp")
    completed_at: Optional[datetime] = Field(None, description="Task completion timestamp")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    
    # Progress tracking
    progress_percentage: int = Field(0, ge=0, le=100, description="Task progress percentage")
    estimated_hours: Optional[float] = Field(None, ge=0, description="Estimated hours")
    actual_hours: Optional[float] = Field(None, ge=0, description="Actual hours worked")
    
    # Additional data
    tags: Optional[List[str]] = Field(None, description="Task tags")
    attachments: Optional[List[Dict[str, Any]]] = Field(None, description="Task attachments")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional task details")
    
    # Metadata
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    
    @computed_field(return_type=bool)
    def is_overdue(self) -> bool:
        """Whether task is overdue."""
        if not self.due_date:
            return False
        return self.due_date < datetime.now(timezone.utc) and self.status != TaskStatusResponse.COMPLETED

    @computed_field(return_type=Optional[int])
    def days_until_due(self) -> Optional[int]:
        """Days until due date."""
        if not self.due_date:
            return None
        delta = (self.due_date - datetime.now(timezone.utc)).days
        return max(delta, 0)


class TaskSummaryResponse(BaseModel):
    """Simplified task response for lists."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID = Field(..., description="Task ID")
    title: str = Field(..., description="Task title")
    task_type: TaskTypeResponse = Field(..., description="Task type")
    priority: Priority = Field(..., description="Task priority")
    status: TaskStatusResponse = Field(..., description="Task status")
    assignee_name: Optional[str] = Field(None, description="Assignee name")
    manager_name: Optional[str] = Field(None, description="Manager name")
    department_name: str = Field(..., description="Department name")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    progress_percentage: int = Field(0, ge=0, le=100, description="Task progress percentage")
    created_at: datetime = Field(..., description="Task creation timestamp")
    is_overdue: bool = Field(False, description="Whether task is overdue")


# Request schemas for task creation and updates
class CreateTaskRequest(BaseModel):
    """Request to create a new task."""
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field(None, max_length=2000, description="Task description")
    task_type: TaskTypeResponse = Field(..., description="Task type")
    priority: Priority = Field(..., description="Task priority")
    assignee_id: Optional[UUID] = Field(None, description="Assignee ID")
    department_id: UUID = Field(..., description="Department ID")
    parent_task_id: Optional[UUID] = Field(None, description="Parent task ID")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    estimated_hours: Optional[float] = Field(None, ge=0, le=1000, description="Estimated hours")
    tags: Optional[List[str]] = Field(None, description="Task tags")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional task details")


class UpdateTaskRequest(BaseModel):
    """Request to update a task."""
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field(None, max_length=2000, description="Task description")
    task_type: Optional[TaskTypeResponse] = Field(None, description="Task type")
    priority: Optional[Priority] = Field(None, description="Task priority")
    assignee_id: Optional[UUID] = Field(None, description="Assignee ID")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    estimated_hours: Optional[float] = Field(None, ge=0, le=1000, description="Estimated hours")
    tags: Optional[List[str]] = Field(None, description="Task tags")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional task details")


class AssignTaskRequest(BaseModel):
    """Request to assign a task."""
    assignee_id: UUID = Field(..., description="Employee ID to assign task to")
    notes: Optional[str] = Field(None, max_length=500, description="Assignment notes")


class UpdateTaskProgressRequest(BaseModel):
    """Request to update task progress."""
    progress_percentage: int = Field(..., ge=0, le=100, description="Progress percentage")
    hours_worked: Optional[float] = Field(None, ge=0, le=100, description="Hours worked in this update")
    notes: Optional[str] = Field(None, max_length=500, description="Progress notes")


class SubmitTaskRequest(BaseModel):
    """Request to submit a task for review."""
    submission_notes: Optional[str] = Field(None, max_length=1000, description="Submission notes")
    attachments: Optional[List[Dict[str, Any]]] = Field(None, description="Submission attachments")


class ReviewTaskRequest(BaseModel):
    """Request to review a task."""
    approved: bool = Field(..., description="Whether task is approved")
    review_notes: Optional[str] = Field(None, max_length=1000, description="Review notes")


class CancelTaskRequest(BaseModel):
    """Request to cancel a task."""
    reason: str = Field(..., min_length=1, max_length=500, description="Cancellation reason")


class BulkTaskActionRequest(BaseModel):
    """Request for bulk task operations."""
    task_ids: List[UUID] = Field(..., min_items=1, max_items=100, description="Task IDs to process")
    action: str = Field(..., description="Action to perform")
    notes: Optional[str] = Field(None, max_length=500, description="Operation notes")


class BulkAssignTasksRequest(BaseModel):
    """Request to bulk assign tasks."""
    task_ids: List[UUID] = Field(..., min_items=1, max_items=50, description="Task IDs to assign")
    assignee_id: UUID = Field(..., description="Employee ID to assign tasks to")
    notes: Optional[str] = Field(None, max_length=500, description="Assignment notes")


# Statistics and analytics schemas
class TaskStatsResponse(BaseModel):
    """Task statistics response."""
    total_tasks: int = Field(..., description="Total number of tasks")
    by_status: Dict[str, int] = Field(..., description="Tasks grouped by status")
    by_priority: Dict[str, int] = Field(..., description="Tasks grouped by priority")
    by_type: Dict[str, int] = Field(..., description="Tasks grouped by type")
    overdue_count: int = Field(..., description="Number of overdue tasks")
    completion_rate: float = Field(..., description="Task completion rate percentage")
    average_completion_days: Optional[float] = Field(None, description="Average days to complete tasks")


class EmployeeWorkloadResponse(BaseModel):
    """Employee workload response."""
    employee: TaskEmployeeSummary = Field(..., description="Employee details")
    assigned_tasks: int = Field(..., description="Number of assigned tasks")
    in_progress_tasks: int = Field(..., description="Number of tasks in progress")
    pending_review_tasks: int = Field(..., description="Number of tasks pending review")
    completed_this_month: int = Field(..., description="Tasks completed this month")
    total_estimated_hours: float = Field(..., description="Total estimated hours")
    total_actual_hours: float = Field(..., description="Total actual hours logged")
    utilization_rate: float = Field(..., description="Utilization rate percentage")


class TeamTaskStatsResponse(BaseModel):
    """Team task statistics response."""
    department: TaskDepartmentSummary = Field(..., description="Department details")
    total_team_tasks: int = Field(..., description="Total tasks for the team")
    active_tasks: int = Field(..., description="Active tasks (assigned/in_progress)")
    completed_tasks: int = Field(..., description="Completed tasks")
    overdue_tasks: int = Field(..., description="Overdue tasks")
    team_members: List[EmployeeWorkloadResponse] = Field(..., description="Team member workloads")
    completion_rate: float = Field(..., description="Team completion rate")
    average_task_age: float = Field(..., description="Average age of active tasks in days")


# Dashboard schemas
class ManagerTaskDashboardResponse(BaseModel):
    """Manager task dashboard response."""
    personal_stats: TaskStatsResponse = Field(..., description="Manager's personal task statistics")
    team_stats: TeamTaskStatsResponse = Field(..., description="Team task statistics")
    recent_activities: List[TaskActivityResponse] = Field(..., description="Recent task activities")
    pending_reviews: List[TaskSummaryResponse] = Field(..., description="Tasks pending manager review")
    overdue_tasks: List[TaskSummaryResponse] = Field(..., description="Overdue tasks in team")


class EmployeeTaskDashboardResponse(BaseModel):
    """Employee task dashboard response."""
    personal_stats: TaskStatsResponse = Field(..., description="Employee's personal task statistics")
    assigned_tasks: List[TaskSummaryResponse] = Field(..., description="Currently assigned tasks")
    recent_activities: List[TaskActivityResponse] = Field(..., description="Recent activities on employee's tasks")
    upcoming_deadlines: List[TaskSummaryResponse] = Field(..., description="Tasks with upcoming deadlines")
    workload_summary: EmployeeWorkloadResponse = Field(..., description="Current workload summary")


# Search and filtering schemas
class TaskSearchFilters(BaseModel):
    """Task search and filtering parameters."""
    search: Optional[str] = Field(None, max_length=100, description="Search term for title/description")
    status: Optional[List[TaskStatusResponse]] = Field(None, description="Filter by task status")
    priority: Optional[List[Priority]] = Field(None, description="Filter by task priority")
    task_type: Optional[List[TaskTypeResponse]] = Field(None, description="Filter by task type")
    assignee_id: Optional[UUID] = Field(None, description="Filter by assignee")
    manager_id: Optional[UUID] = Field(None, description="Filter by manager")
    department_id: Optional[UUID] = Field(None, description="Filter by department")
    parent_task_id: Optional[UUID] = Field(None, description="Filter by parent task")
    due_date_from: Optional[datetime] = Field(None, description="Filter by due date from")
    due_date_to: Optional[datetime] = Field(None, description="Filter by due date to")
    created_date_from: Optional[datetime] = Field(None, description="Filter by creation date from")
    created_date_to: Optional[datetime] = Field(None, description="Filter by creation date to")
    is_overdue: Optional[bool] = Field(None, description="Filter by overdue status")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    
    # Pagination
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(20, ge=1, le=100, description="Items per page")
    
    # Sorting
    sort_by: str = Field("created_at", description="Field to sort by")
    sort_order: str = Field("desc", pattern="^(asc|desc)$", description="Sort order")


class TaskSearchResponse(BaseModel):
    """Task search response with pagination."""
    tasks: List[TaskSummaryResponse] = Field(..., description="List of tasks")
    total_count: int = Field(..., description="Total number of matching tasks")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_previous: bool = Field(..., description="Whether there are previous pages")


# Notification schemas for task events
class TaskNotificationData(BaseModel):
    """Task notification data."""
    task_id: UUID = Field(..., description="Task ID")
    task_title: str = Field(..., description="Task title")
    action: str = Field(..., description="Action performed")
    actor_name: str = Field(..., description="Name of person who performed the action")
    department_name: str = Field(..., description="Department name")
    priority: Priority = Field(..., description="Task priority")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    message: Optional[str] = Field(None, description="Additional notification message")