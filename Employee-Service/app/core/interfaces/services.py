from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from uuid import UUID

from app.core.entities.employee import Employee
from app.core.entities.role import RoleCode


class AuthServiceInterface(ABC):
    """Abstract interface for authentication service integration."""
    
    @abstractmethod
    async def get_user_info(self, user_id: UUID) -> Dict[str, Any]:
        """Get user information from Auth Service."""
        pass
    
    @abstractmethod
    def verify_jwt_token(self, token: str) -> Dict[str, Any]:
        """Verify JWT token and extract claims."""
        pass


class PermissionServiceInterface(ABC):
    """Abstract interface for permission checking."""
    
    @abstractmethod
    async def can_create_employee(self, user_id: UUID) -> bool:
        """Check if user can create employees."""
        pass
    
    @abstractmethod
    async def can_view_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can view specific employee."""
        pass
    
    @abstractmethod
    async def can_update_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can update specific employee."""
        pass
    
    @abstractmethod
    async def can_deactivate_employee(self, user_id: UUID, employee_id: UUID) -> bool:
        """Check if user can deactivate specific employee."""
        pass
    
    @abstractmethod
    async def can_assign_roles(self, user_id: UUID) -> bool:
        """Check if user can assign roles."""
        pass
    
    @abstractmethod
    async def get_viewable_employees(self, user_id: UUID) -> List[UUID]:
        """Get list of employee IDs that user can view."""
        pass


class EventPublisherInterface(ABC):
    """Abstract interface for event publishing."""
    
    @abstractmethod
    async def publish_event(self, event_type: str, data: Dict[str, Any]) -> bool:
        """Publish domain event to message bus."""
        pass
