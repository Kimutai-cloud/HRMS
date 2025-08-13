from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.core.entities.employee import Employee, EmploymentStatus
from app.core.entities.role import Role, RoleAssignment, RoleCode
from app.core.entities.events import DomainEvent


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