from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID


@dataclass
class Department:
    """Department entity for organizing employees."""
    
    id: Optional[UUID]
    name: str
    description: Optional[str]
    manager_id: Optional[UUID]
    is_active: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    created_by: UUID
    
    def __post_init__(self):
        """Validate and normalize department data."""
        self._validate_required_fields()
        self._normalize_fields()
    
    def _validate_required_fields(self):
        """Validate required fields are present and valid."""
        errors = []
        
        if not self.name or not self.name.strip():
            errors.append("name is required")
        if not self.created_by:
            errors.append("created_by is required")
            
        if errors:
            raise ValueError(f"Department validation failed: {', '.join(errors)}")
    
    def _normalize_fields(self):
        """Normalize field values."""
        if self.name:
            self.name = self.name.strip()
        if self.description:
            self.description = self.description.strip()
    
    def is_managed(self) -> bool:
        """Check if department has an assigned manager."""
        return self.manager_id is not None
    
    def assign_manager(self, manager_id: UUID) -> None:
        """Assign a manager to this department."""
        if not manager_id:
            raise ValueError("Manager ID is required")
        
        self.manager_id = manager_id
        self.updated_at = datetime.now(timezone.utc)
    
    def remove_manager(self) -> None:
        """Remove the current manager from this department."""
        self.manager_id = None
        self.updated_at = datetime.now(timezone.utc)
    
    def deactivate(self) -> None:
        """Deactivate the department."""
        self.is_active = False
        self.updated_at = datetime.now(timezone.utc)
    
    def activate(self) -> None:
        """Activate the department."""
        self.is_active = True
        self.updated_at = datetime.now(timezone.utc)
    
    def update_details(self, name: Optional[str] = None, description: Optional[str] = None) -> None:
        """Update department details."""
        if name is not None:
            if not name.strip():
                raise ValueError("Department name cannot be empty")
            self.name = name.strip()
        
        if description is not None:
            self.description = description.strip() if description.strip() else None
        
        self.updated_at = datetime.now(timezone.utc)