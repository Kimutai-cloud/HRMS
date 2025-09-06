from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.application.use_case.manager_task_use_cases import ManagerTaskUseCase
from app.core.entities.task import TaskType, Priority
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.core.entities.user_claims import UserClaims
from app.presentation.schema.task_schema import (
    TaskResponse,
    TaskSummaryResponse,
    CreateTaskRequest,
    UpdateTaskRequest,
    AssignTaskRequest,
    ReviewTaskRequest,
    CancelTaskRequest,
    BulkAssignTasksRequest,
    BulkTaskActionRequest,
    TaskSearchFilters,
    TaskSearchResponse,
    ManagerTaskDashboardResponse,
    TaskStatsResponse,
    TeamTaskStatsResponse,
    EmployeeWorkloadResponse
)
from app.presentation.schema.common_schema import SuccessResponse
from app.presentation.api.dependencies import (
    get_manager_task_use_case,
    get_audit_repository,
    require_manager_or_admin,
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

router = APIRouter(prefix="/manager/tasks", tags=["Manager - Task Management"])


# Dashboard and Overview

@router.get("/dashboard", response_model=ManagerTaskDashboardResponse)
async def get_manager_dashboard(
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case)
):
    """
    Get comprehensive manager task dashboard with personal and team statistics.
    Manager/Admin only.
    """
    
    try:
        dashboard_data = await manager_task_use_case.get_manager_dashboard(
            current_user["user_id"]
        )
        return dashboard_data
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Task Creation and Management

@router.post("/create", response_model=TaskResponse)
async def create_task(
    request: CreateTaskRequest,
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Create a new task.
    Manager/Admin only.
    """
    
    try:
        new_task = await manager_task_use_case.create_task(
            manager_id=current_user["user_id"],
            title=request.title,
            description=request.description,
            task_type=TaskType(request.task_type.value),
            priority=Priority(request.priority.value),
            department_id=request.department_id,
            assignee_id=request.assignee_id,
            parent_task_id=request.parent_task_id,
            due_date=request.due_date,
            estimated_hours=request.estimated_hours,
            tags=request.tags,
            details=request.details
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="task",
            entity_id=new_task.id,
            action="TASK_CREATED",
            user_id=current_user["user_id"],
            changes={
                "title": request.title,
                "task_type": request.task_type.value,
                "priority": request.priority.value,
                "assignee_id": str(request.assignee_id) if request.assignee_id else None,
                "department_id": str(request.department_id)
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return TaskResponse.from_entity(new_task)
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
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


# Task Review and Approval - MOVED BEFORE GENERIC ROUTES

@router.get("/pending-review", response_model=List[TaskSummaryResponse])
async def get_pending_review_tasks(
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case)
):
    """
    Get tasks pending manager review.
    Manager/Admin only.
    """
    
    try:
        pending_tasks = await manager_task_use_case.get_tasks_requiring_review(
            manager_id=current_user["user_id"]
        )
        return pending_tasks
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID = Path(..., description="Task ID"),
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case)
):
    """
    Get a specific task by ID.
    Manager/Admin only.
    """
    
    try:
        task_data = await manager_task_use_case.get_task_details(
            task_id=task_id,
            manager_id=current_user["user_id"]
        )
        return TaskResponse(**task_data)
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    request: UpdateTaskRequest,
    task_id: UUID = Path(..., description="Task ID"),
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Update a task.
    Manager/Admin only.
    """
    
    try:
        # Build update data from request
        update_data = {}
        if request.title is not None:
            update_data["title"] = request.title
        if request.description is not None:
            update_data["description"] = request.description
        if request.task_type is not None:
            update_data["task_type"] = request.task_type.value
        if request.priority is not None:
            update_data["priority"] = request.priority.value
        if request.assignee_id is not None:
            update_data["assignee_id"] = request.assignee_id
        if request.due_date is not None:
            update_data["due_date"] = request.due_date
        if request.estimated_hours is not None:
            update_data["estimated_hours"] = request.estimated_hours
        if request.tags is not None:
            update_data["tags"] = request.tags
        if request.details is not None:
            update_data["details"] = request.details
        
        updated_task = await manager_task_use_case.update_task(
            task_id=task_id,
            manager_id=current_user["user_id"],
            **update_data
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="task",
            entity_id=task_id,
            action="TASK_UPDATED",
            user_id=current_user["user_id"],
            changes=update_data,
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return updated_task
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
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


# Task Assignment

@router.post("/{task_id}/assign", response_model=SuccessResponse)
async def assign_task(
    request: AssignTaskRequest,
    task_id: UUID = Path(..., description="Task ID"),
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Assign a task to an employee.
    Manager/Admin only.
    """
    
    try:
        updated_task = await manager_task_use_case.assign_task_to_employee(
            task_id=task_id,
            manager_id=current_user["user_id"],
            assignee_id=request.assignee_id
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="task",
            entity_id=task_id,
            action="TASK_ASSIGNED",
            user_id=current_user["user_id"],
            changes={
                "assignee_id": str(request.assignee_id),
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(message="Task assigned successfully")
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task or employee not found"
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


@router.post("/bulk-assign", response_model=SuccessResponse)
async def bulk_assign_tasks(
    request: BulkAssignTasksRequest,
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Bulk assign multiple tasks to an employee.
    Manager/Admin only.
    """
    
    try:
        assigned_tasks = await manager_task_use_case.bulk_assign_tasks(
            task_ids=request.task_ids,
            assignee_id=request.assignee_id,
            manager_id=current_user["user_id"],
            notes=request.notes
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="bulk_operation",
            entity_id=current_user["user_id"],
            action="BULK_TASK_ASSIGNMENT",
            user_id=current_user["user_id"],
            changes={
                "task_count": len(request.task_ids),
                "assigned_count": len(assigned_tasks),
                "assignee_id": str(request.assignee_id),
                "task_ids": [str(id) for id in request.task_ids],
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(
            message=f"Bulk assignment completed: {len(assigned_tasks)}/{len(request.task_ids)} tasks assigned"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bulk assignment failed: {str(e)}"
        )


# Task Review and Approval - MOVED ABOVE


@router.post("/{task_id}/review", response_model=SuccessResponse)
async def review_task(
    request: ReviewTaskRequest,
    task_id: UUID = Path(..., description="Task ID"),
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Review and approve/reject a submitted task.
    Manager/Admin only.
    """
    
    try:
        if request.approved:
            updated_task = await manager_task_use_case.approve_task(
                task_id=task_id,
                manager_id=current_user["user_id"],
                approval_notes=request.review_notes
            )
            action = "TASK_APPROVED"
            message = "Task approved successfully"
        else:
            updated_task = await manager_task_use_case.reject_task(
                task_id=task_id,
                manager_id=current_user["user_id"],
                rejection_reason=request.review_notes or "No reason provided"
            )
            action = "TASK_REJECTED"
            message = "Task rejected and sent back for revision"
        
        # Audit log
        await audit_repository.log_action(
            entity_type="task",
            entity_id=task_id,
            action=action,
            user_id=current_user["user_id"],
            changes={
                "approved": request.approved,
                "review_notes": request.review_notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(message=message)
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
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


# Task Cancellation

@router.post("/{task_id}/cancel", response_model=SuccessResponse)
async def cancel_task(
    request: CancelTaskRequest,
    task_id: UUID = Path(..., description="Task ID"),
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Cancel a task.
    Manager/Admin only.
    """
    
    try:
        updated_task = await manager_task_use_case.cancel_task(
            task_id=task_id,
            manager_id=current_user["user_id"],
            reason=request.reason
        )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="task",
            entity_id=task_id,
            action="TASK_CANCELLED",
            user_id=current_user["user_id"],
            changes={
                "reason": request.reason
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(message="Task cancelled successfully")
        
    except EmployeeNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
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
async def search_tasks(
    filters: TaskSearchFilters,
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case)
):
    """
    Search and filter tasks with pagination.
    Manager/Admin only.
    """
    
    try:
        # Convert enum values to strings if provided
        filter_dict = {}
        
        if filters.search:
            filter_dict["search"] = filters.search
        if filters.status:
            filter_dict["status"] = [s.value for s in filters.status]
        if filters.priority:
            filter_dict["priority"] = [p.value for p in filters.priority]
        if filters.task_type:
            filter_dict["task_type"] = [t.value for t in filters.task_type]
        if filters.assignee_id:
            filter_dict["assignee_id"] = filters.assignee_id
        if filters.manager_id:
            filter_dict["manager_id"] = filters.manager_id
        if filters.department_id:
            filter_dict["department_id"] = filters.department_id
        if filters.parent_task_id:
            filter_dict["parent_task_id"] = filters.parent_task_id
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
        
        search_results = await manager_task_use_case.search_tasks(
            manager_id=current_user["user_id"],
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


# Team Management

@router.get("/team/tasks", response_model=List[TaskSummaryResponse])
async def get_team_tasks(
    status: Optional[List[str]] = Query(None, description="Filter by task status"),
    priority: Optional[List[str]] = Query(None, description="Filter by task priority"),
    assignee_id: Optional[UUID] = Query(None, description="Filter by specific team member"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of results"),
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case)
):
    """
    Get all tasks for the manager's team.
    Manager/Admin only.
    """
    
    try:
        filters = {}
        if status:
            filters["status"] = status
        if priority:
            filters["priority"] = priority
        if assignee_id:
            filters["assignee_id"] = assignee_id
            
        team_tasks = await manager_task_use_case.get_team_tasks(
            manager_id=current_user["user_id"],
            filters=filters,
            limit=limit
        )
        
        return team_tasks
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/team/workload", response_model=List[EmployeeWorkloadResponse])
async def get_team_workload(
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case)
):
    """
    Get workload analysis for all team members.
    Manager/Admin only.
    """
    
    try:
        workload_data = await manager_task_use_case.get_team_workload_analysis(
            manager_id=current_user["user_id"]
        )
        
        return workload_data
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Statistics and Analytics

@router.get("/stats/personal", response_model=TaskStatsResponse)
async def get_personal_task_stats(
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case)
):
    """
    Get personal task statistics for the manager.
    Manager/Admin only.
    """
    
    try:
        stats = await manager_task_use_case.get_manager_task_statistics(
            manager_id=current_user["user_id"]
        )
        
        return stats
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/stats/team", response_model=TeamTaskStatsResponse)
async def get_team_task_stats(
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case)
):
    """
    Get comprehensive team task statistics.
    Manager/Admin only.
    """
    
    try:
        stats = await manager_task_use_case.get_team_task_statistics(
            manager_id=current_user["user_id"]
        )
        
        return stats
        
    except ForbiddenException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


# Bulk Operations

@router.post("/bulk-action", response_model=SuccessResponse)
async def bulk_task_action(
    request: BulkTaskActionRequest,
    current_user: dict = Depends(require_manager_or_admin),
    manager_task_use_case: ManagerTaskUseCase = Depends(get_manager_task_use_case),
    audit_repository: AuditRepository = Depends(get_audit_repository),
    request_context: dict = Depends(get_request_context)
):
    """
    Perform bulk actions on multiple tasks.
    Manager/Admin only.
    """
    
    try:
        result_count = 0
        
        if request.action == "cancel":
            result_count = await manager_task_use_case.bulk_cancel_tasks(
                task_ids=request.task_ids,
                manager_id=current_user["user_id"],
                reason=request.notes or "Bulk cancellation"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported bulk action: {request.action}"
            )
        
        # Audit log
        await audit_repository.log_action(
            entity_type="bulk_operation",
            entity_id=current_user["user_id"],
            action=f"BULK_TASK_{request.action.upper()}",
            user_id=current_user["user_id"],
            changes={
                "action": request.action,
                "task_count": len(request.task_ids),
                "successful_count": result_count,
                "task_ids": [str(id) for id in request.task_ids],
                "notes": request.notes
            },
            ip_address=request_context.get("ip_address"),
            user_agent=request_context.get("user_agent")
        )
        
        return SuccessResponse(
            message=f"Bulk {request.action} completed: {result_count}/{len(request.task_ids)} tasks processed"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bulk operation failed: {str(e)}"
        )