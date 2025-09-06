from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.application.use_case.employee_task_use_cases import EmployeeTaskUseCase
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.core.entities.user_claims import UserClaims
from app.presentation.schema.task_schema import (
    TaskResponse,
    TaskSummaryResponse,
    UpdateTaskProgressRequest,
    SubmitTaskRequest,
    TaskSearchFilters,
    TaskSearchResponse,
    EmployeeTaskDashboardResponse,
    TaskStatsResponse,
    EmployeeWorkloadResponse,
    TaskActivityResponse
)
from app.presentation.schema.common_schema import SuccessResponse
from app.presentation.api.dependencies import (
    get_employee_task_use_case,
    get_audit_repository,
    get_request_context,
    get_current_user_claims,
    require_verified_employee
)
from app.core.exceptions.employee_exceptions import (
    EmployeeNotFoundException,
    EmployeeValidationException,
    EmployeePermissionException
)
from app.core.exceptions.role_exceptions import ForbiddenException

router = APIRouter(prefix="/employee/tasks", tags=["Employee - Task Management"])


# Dashboard and Overview

@router.get("/dashboard", response_model=EmployeeTaskDashboardResponse)
async def get_employee_dashboard(
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get comprehensive employee task dashboard with personal statistics and assigned tasks.
    Verified employee only.
    """
    
    try:
        dashboard_data = await employee_task_use_case.get_employee_dashboard(
            current_user.user_id
        )
        return dashboard_data
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Personal Task Management

@router.get("/assigned", response_model=List[TaskSummaryResponse])
async def get_assigned_tasks(
    status: Optional[List[str]] = Query(None, description="Filter by task status"),
    priority: Optional[List[str]] = Query(None, description="Filter by task priority"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get all tasks assigned to the current employee.
    Verified employee only.
    """
    
    try:
        filters = {}
        if status:
            filters["status"] = status
        if priority:
            filters["priority"] = priority
            
        assigned_tasks = await employee_task_use_case.get_assigned_tasks(
            employee_user_id=current_user.user_id,
            filters=filters,
            limit=limit
        )
        
        return assigned_tasks
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID = Path(..., description="Task ID"),
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get a specific task by ID (must be assigned to current employee).
    Verified employee only.
    """
    
    try:
        task = await employee_task_use_case.get_task_by_id(
            task_id=task_id,
            employee_id=current_user.user_id
        )
        return task
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or not assigned to you"
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Task Workflow Actions

@router.post("/{task_id}/start", response_model=SuccessResponse)
async def start_task(
    task_id: UUID = Path(..., description="Task ID"),
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Start work on a task.
    Verified employee only.
    """
    
    try:
        updated_task = await employee_task_use_case.start_task(
            task_id=task_id,
            employee_user_id=current_user.user_id
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="task",
            entity_id=task_id,
            action="TASK_STARTED",
            user_id=current_user.user_id,
            changes={
                "status": "IN_PROGRESS",
                "started_at": updated_task.started_at.isoformat() if updated_task.started_at else None
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(message="Task started successfully")
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or not assigned to you"
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/{task_id}/update-progress", response_model=SuccessResponse)
async def update_task_progress(
    request: UpdateTaskProgressRequest,
    task_id: UUID = Path(..., description="Task ID"),
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Update task progress and log hours worked.
    Verified employee only.
    """
    
    try:
        updated_task = await employee_task_use_case.update_progress(
            task_id=task_id,
            employee_user_id=current_user.user_id,
            progress_percentage=request.progress_percentage,
            hours_worked=request.hours_worked,
            notes=request.notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="task",
            entity_id=task_id,
            action="TASK_PROGRESS_UPDATED",
            user_id=current_user.user_id,
            changes={
                "progress_percentage": request.progress_percentage,
                "hours_worked": request.hours_worked,
                "notes": request.notes,
                "actual_hours": updated_task.actual_hours
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(message="Task progress updated successfully")
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or not assigned to you"
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/{task_id}/submit", response_model=SuccessResponse)
async def submit_task(
    request: SubmitTaskRequest,
    task_id: UUID = Path(..., description="Task ID"),
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Submit a task for manager review.
    Verified employee only.
    """
    
    try:
        updated_task = await employee_task_use_case.submit_task(
            task_id=task_id,
            employee_user_id=current_user.user_id,
            submission_notes=request.submission_notes,
            attachments=request.attachments
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="task",
            entity_id=task_id,
            action="TASK_SUBMITTED",
            user_id=current_user.user_id,
            changes={
                "status": "SUBMITTED",
                "submission_notes": request.submission_notes,
                "submitted_at": updated_task.submitted_at.isoformat() if updated_task.submitted_at else None,
                "attachment_count": len(request.attachments) if request.attachments else 0
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(message="Task submitted for review successfully")
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or not assigned to you"
        )
    except EmployeeValidationException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Task Search and Filtering

@router.post("/search", response_model=TaskSearchResponse)
async def search_personal_tasks(
    filters: TaskSearchFilters,
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Search and filter personal tasks with pagination.
    Verified employee only.
    """
    
    try:
        # Convert enum values to strings if provided and scope to current user
        filter_dict = {"assignee_id": current_user.user_id}  # Always scope to current user
        
        if filters.search:
            filter_dict["search"] = filters.search
        if filters.status:
            filter_dict["status"] = [s.value for s in filters.status]
        if filters.priority:
            filter_dict["priority"] = [p.value for p in filters.priority]
        if filters.task_type:
            filter_dict["task_type"] = [t.value for t in filters.task_type]
        if filters.due_date_from:
            filter_dict["due_date_from"] = filters.due_date_from
        if filters.due_date_to:
            filter_dict["due_date_to"] = filters.due_date_to
        if filters.created_date_from:
            filter_dict["created_date_from"] = filters.created_date_from
        if filters.created_date_to:
            filter_dict["created_date_to"] = filters.created_date_to
        if filters.is_overdue is not None:
            filter_dict["is_overdue"] = filters.is_overdue
        if filters.tags:
            filter_dict["tags"] = filters.tags
        
        search_results = await employee_task_use_case.search_personal_tasks(
            employee_user_id=current_user.user_id,
            filters=filter_dict,
            page=filters.page,
            per_page=filters.per_page,
            sort_by=filters.sort_by,
            sort_order=filters.sort_order
        )
        
        return search_results
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Task Activity and History

@router.get("/{task_id}/activities", response_model=List[TaskActivityResponse])
async def get_task_activities(
    task_id: UUID = Path(..., description="Task ID"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get activity history for a specific task.
    Verified employee only.
    """
    
    try:
        activities = await employee_task_use_case.get_task_activity_history(
            task_id=task_id,
            employee_user_id=current_user.user_id,
            limit=limit
        )
        
        return activities
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or not assigned to you"
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/activities/recent", response_model=List[TaskActivityResponse])
async def get_recent_task_activities(
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results"),
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get recent activity history for all employee's tasks.
    Verified employee only.
    """
    
    try:
        activities = await employee_task_use_case.get_recent_activities(
            employee_user_id=current_user.user_id,
            limit=limit
        )
        
        return activities
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Statistics and Analytics

@router.get("/stats/personal", response_model=TaskStatsResponse)
async def get_personal_task_stats(
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get personal task statistics for the employee.
    Verified employee only.
    """
    
    try:
        stats = await employee_task_use_case.get_employee_task_statistics(
            employee_user_id=current_user.user_id
        )
        
        return stats
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/workload", response_model=EmployeeWorkloadResponse)
async def get_personal_workload(
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get current workload analysis for the employee.
    Verified employee only.
    """
    
    try:
        workload = await employee_task_use_case.get_workload_analysis(
            employee_user_id=current_user.user_id
        )
        
        return workload
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Quick Actions

@router.get("/upcoming-deadlines", response_model=List[TaskSummaryResponse])
async def get_upcoming_deadlines(
    days: int = Query(7, ge=1, le=30, description="Number of days to look ahead"),
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get tasks with upcoming deadlines.
    Verified employee only.
    """
    
    try:
        upcoming_tasks = await employee_task_use_case.get_upcoming_deadlines(
            employee_user_id=current_user.user_id,
            days_ahead=days
        )
        
        return upcoming_tasks
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/overdue", response_model=List[TaskSummaryResponse])
async def get_overdue_tasks(
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get all overdue tasks for the employee.
    Verified employee only.
    """
    
    try:
        overdue_tasks = await employee_task_use_case.get_overdue_tasks(
            employee_user_id=current_user.user_id
        )
        
        return overdue_tasks
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/in-progress", response_model=List[TaskSummaryResponse])
async def get_in_progress_tasks(
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get all tasks currently in progress for the employee.
    Verified employee only.
    """
    
    try:
        in_progress_tasks = await employee_task_use_case.get_in_progress_tasks(
            employee_user_id=current_user.user_id
        )
        
        return in_progress_tasks
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/pending-review", response_model=List[TaskSummaryResponse])
async def get_tasks_pending_review(
    current_user: UserClaims = Depends(require_verified_employee),
    employee_task_use_case: EmployeeTaskUseCase = Depends(get_employee_task_use_case)
):
    """
    Get all tasks submitted and pending review.
    Verified employee only.
    """
    
    try:
        pending_review_tasks = await employee_task_use_case.get_tasks_pending_review(
            employee_user_id=current_user.user_id
        )
        
        return pending_review_tasks
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )