from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.core.entities.employee import Employee, EmploymentStatus
from app.core.entities.role import Role, RoleAssignment, RoleCode
from app.core.entities.events import DomainEvent
from app.core.entities.document import EmployeeDocument, DocumentType, DocumentReviewStatus
from app.core.entities.department import Department
from app.core.entities.task import Task, TaskComment, TaskActivity, TaskStatus, Priority  


class EmployeeRepositoryInterface(ABC):
    """Abstract interface for employee repository."""
    
    @abstractmethod
    async def create(self, employee: Employee) -> Employee:
        """Create a new employee."""
        pass
    
    @abstractmethod
    async def get_by_id(self, employee_id: UUID) -> Optional[Employee]:
        """Get employee by ID."""
        pass
    
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[Employee]:
        """Get employee by email."""
        pass
    
    @abstractmethod
    async def get_by_manager_id(self, manager_id: UUID) -> List[Employee]:
        """Get all employees under a specific manager."""
        pass
    
    @abstractmethod
    async def update(self, employee: Employee) -> Employee:
        """Update employee."""
        pass
    
    @abstractmethod
    async def delete(self, employee_id: UUID) -> bool:
        """Soft delete employee."""
        pass
    
    @abstractmethod
    async def list_employees(
        self,
        page: int = 1,
        size: int = 20,
        status: Optional[EmploymentStatus] = None,
        department: Optional[str] = None,
        manager_id: Optional[UUID] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """List employees with pagination and filtering."""
        pass
    
    @abstractmethod
    async def get_employee_count(self) -> int:
        """Get total employee count."""
        pass
    
    @abstractmethod
    async def check_circular_managership(self, employee_id: UUID, manager_id: UUID) -> bool:
        """Check if assigning manager would create circular relationship."""
        pass

    @abstractmethod
    async def get_by_user_id(self, user_id: UUID) -> Optional[Employee]:
        """Get employee by user ID."""
        pass
    
    @abstractmethod
    async def update_employee_profile_status(self, user_id: UUID, status: str) -> bool:
        """Update user's employee profile status."""
        pass
    
    @abstractmethod
    async def get_employees_by_profile_status(self, status: str, limit: int = 100) -> List[Employee]:
        """Get employees by their profile status."""
        pass


class RoleRepositoryInterface(ABC):
    """Abstract interface for role repository."""
    
    @abstractmethod
    async def create_role(self, role: Role) -> Role:
        """Create a new role."""
        pass
    
    @abstractmethod
    async def get_role_by_id(self, role_id: UUID) -> Optional[Role]:
        """Get role by ID."""
        pass
    
    @abstractmethod
    async def get_role_by_code(self, code: RoleCode) -> Optional[Role]:
        """Get role by code."""
        pass
    
    @abstractmethod
    async def list_roles(self) -> List[Role]:
        """List all roles."""
        pass
    
    @abstractmethod
    async def assign_role(self, assignment: RoleAssignment) -> RoleAssignment:
        """Assign role to user."""
        pass
    
    @abstractmethod
    async def revoke_role(self, assignment_id: UUID) -> bool:
        """Revoke role assignment."""
        pass
    
    @abstractmethod
    async def get_user_roles(self, user_id: UUID) -> List[RoleAssignment]:
        """Get all role assignments for a user."""
        pass
    
    @abstractmethod
    async def get_role_assignment(self, user_id: UUID, role_id: UUID) -> Optional[RoleAssignment]:
        """Get specific role assignment."""
        pass
    
    @abstractmethod
    async def has_role(self, user_id: UUID, role_code: RoleCode) -> bool:
        """Check if user has specific role."""
        pass


class EventRepositoryInterface(ABC):
    """Abstract interface for event repository (Outbox pattern)."""
    
    @abstractmethod
    async def save_event(self, event: DomainEvent) -> DomainEvent:
        """Save domain event for publishing."""
        pass
    
    @abstractmethod
    async def get_unpublished_events(self, limit: int = 100) -> List[DomainEvent]:
        """Get unpublished events for processing."""
        pass
    
    @abstractmethod
    async def mark_event_published(self, event_id: UUID) -> bool:
        """Mark event as published."""
        pass
    
    @abstractmethod
    async def cleanup_published_events(self, older_than_days: int = 7) -> int:
        """Clean up old published events."""
        pass

class DocumentRepositoryInterface(ABC):
    """Abstract interface for document repository."""
    
    @abstractmethod
    async def create(self, document: EmployeeDocument) -> EmployeeDocument:
        """Create a new document record."""
        pass
    
    @abstractmethod
    async def get_by_id(self, document_id: UUID) -> Optional[EmployeeDocument]:
        """Get document by ID."""
        pass
    
    @abstractmethod
    async def get_employee_documents(self, employee_id: UUID) -> List[EmployeeDocument]:
        """Get all documents for an employee."""
        pass
    
    @abstractmethod
    async def get_documents_by_type(self, employee_id: UUID, document_type: DocumentType) -> List[EmployeeDocument]:
        """Get documents by type for an employee."""
        pass
    
    @abstractmethod
    async def get_documents_by_status(self, review_status: DocumentReviewStatus, limit: int = 100) -> List[EmployeeDocument]:
        """Get documents by review status."""
        pass
    
    @abstractmethod
    async def update(self, document: EmployeeDocument) -> EmployeeDocument:
        """Update document."""
        pass
    
    @abstractmethod
    async def delete(self, document_id: UUID) -> bool:
        """Delete document and file."""
        pass
    
    @abstractmethod
    async def get_pending_document_reviews(self, limit: int = 100) -> List[EmployeeDocument]:
        """Get documents pending review."""
        pass
    
    @abstractmethod
    async def get_document_statistics(self) -> Dict[str, Any]:
        """Get document review statistics."""
        pass
    
    @abstractmethod
    async def get_employee_document_summary(self, employee_id: UUID) -> Dict[str, Any]:
        """Get document summary for an employee."""
        pass


class DepartmentRepositoryInterface(ABC):
    """Abstract interface for department repository."""
    
    @abstractmethod
    async def create(self, department: Department) -> Department:
        """Create a new department."""
        pass
    
    @abstractmethod
    async def get_by_id(self, department_id: UUID) -> Optional[Department]:
        """Get department by ID."""
        pass
    
    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[Department]:
        """Get department by name."""
        pass
    
    @abstractmethod
    async def list_departments(self, include_inactive: bool = False) -> List[Department]:
        """List all departments."""
        pass
    
    @abstractmethod
    async def update(self, department: Department) -> Department:
        """Update department."""
        pass
    
    @abstractmethod
    async def delete(self, department_id: UUID) -> bool:
        """Soft delete department."""
        pass
    
    @abstractmethod
    async def assign_manager(self, department_id: UUID, manager_id: UUID) -> bool:
        """Assign manager to department."""
        pass
    
    @abstractmethod
    async def remove_manager(self, department_id: UUID) -> bool:
        """Remove manager from department."""
        pass
    
    @abstractmethod
    async def get_managed_departments(self, manager_id: UUID) -> List[Department]:
        """Get departments managed by a specific manager."""
        pass
    
    @abstractmethod
    async def get_department_employees(self, department_id: UUID) -> List[Employee]:
        """Get all employees in a department."""
        pass
    
    @abstractmethod
    async def get_departments_with_stats(self) -> List[Dict[str, Any]]:
        """Get departments with employee count statistics."""
        pass


# Task Management Repository Interfaces

class TaskRepositoryInterface(ABC):
    """Abstract interface for task repository."""
    
    @abstractmethod
    async def create(self, task: Task) -> Task:
        """Create a new task."""
        pass
    
    @abstractmethod
    async def get_by_id(self, task_id: UUID) -> Optional[Task]:
        """Get task by ID."""
        pass
    
    @abstractmethod
    async def update(self, task: Task) -> Task:
        """Update task."""
        pass
    
    @abstractmethod
    async def delete(self, task_id: UUID) -> bool:
        """Delete task."""
        pass
    
    @abstractmethod
    async def get_tasks_by_assignee(self, assignee_id: UUID, status: Optional[TaskStatus] = None) -> List[Task]:
        """Get tasks assigned to a specific employee."""
        pass
    
    @abstractmethod
    async def get_tasks_by_assigner(self, assigner_id: UUID, status: Optional[TaskStatus] = None) -> List[Task]:
        """Get tasks created by a specific manager."""
        pass
    
    @abstractmethod
    async def get_tasks_by_department(self, department_id: UUID, status: Optional[TaskStatus] = None) -> List[Task]:
        """Get tasks for a specific department."""
        pass
    
    @abstractmethod
    async def get_subtasks(self, parent_task_id: UUID) -> List[Task]:
        """Get all subtasks of a parent task."""
        pass
    
    @abstractmethod
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
        pass
    
    @abstractmethod
    async def count_tasks(self,
                         title_search: Optional[str] = None,
                         assignee_id: Optional[UUID] = None,
                         assigner_id: Optional[UUID] = None,
                         department_id: Optional[UUID] = None,
                         status: Optional[TaskStatus] = None,
                         priority: Optional[Priority] = None,
                         overdue_only: bool = False) -> int:
        """Count tasks matching filters for pagination."""
        pass
    
    @abstractmethod
    async def get_task_statistics(self, user_id: UUID, is_manager: bool = False) -> Dict[str, Any]:
        """Get task statistics for a user."""
        pass


class TaskCommentRepositoryInterface(ABC):
    """Abstract interface for task comment repository."""
    
    @abstractmethod
    async def create(self, comment: TaskComment) -> TaskComment:
        """Create a new task comment."""
        pass
    
    @abstractmethod
    async def get_by_id(self, comment_id: UUID) -> Optional[TaskComment]:
        """Get comment by ID."""
        pass
    
    @abstractmethod
    async def get_by_task_id(self, task_id: UUID) -> List[TaskComment]:
        """Get all comments for a task."""
        pass
    
    @abstractmethod
    async def update(self, comment: TaskComment) -> TaskComment:
        """Update task comment."""
        pass
    
    @abstractmethod
    async def delete(self, comment_id: UUID) -> bool:
        """Delete task comment."""
        pass


class TaskActivityRepositoryInterface(ABC):
    """Abstract interface for task activity repository."""
    
    @abstractmethod
    async def create(self, activity: TaskActivity) -> TaskActivity:
        """Create a new task activity."""
        pass
    
    @abstractmethod
    async def get_by_task_id(self, task_id: UUID) -> List[TaskActivity]:
        """Get all activities for a task."""
        pass
    
    @abstractmethod
    async def get_user_activities(self, user_id: UUID, limit: int = 50) -> List[TaskActivity]:
        """Get recent activities performed by a user."""
        pass