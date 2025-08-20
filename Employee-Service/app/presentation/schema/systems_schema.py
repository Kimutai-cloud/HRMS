from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional


class SystemHealthResponse(BaseModel):
    """System health and status."""
    
    service_status: str = Field(..., description="Overall service status")
    database_status: str = Field(..., description="Database connectivity status") 
    auth_service_status: str = Field(..., description="Auth service connectivity")
    notification_service_status: str = Field(..., description="Notification service status")
    pending_reviews_count: int = Field(..., description="Number of pending reviews")
    urgent_items_count: int = Field(..., description="Number of urgent items")
    system_load: float = Field(..., description="Current system load")
    last_updated: str = Field(..., description="Last update timestamp")


class FeatureFlagResponse(BaseModel):
    """Feature flags for frontend."""
    
    notifications_enabled: bool = Field(..., description="Whether notifications are enabled")
    real_time_updates: bool = Field(..., description="Whether real-time updates are available")
    document_preview: bool = Field(..., description="Whether document preview is enabled")
    bulk_operations: bool = Field(..., description="Whether bulk operations are enabled")
    advanced_analytics: bool = Field(..., description="Whether advanced analytics are available")


class ConfigurationResponse(BaseModel):
    """Frontend configuration."""
    
    max_file_size: int = Field(..., description="Maximum file upload size")
    allowed_file_types: List[str] = Field(..., description="Allowed file types")
    verification_stages: List[str] = Field(..., description="Verification stage names")
    notification_types: List[str] = Field(..., description="Available notification types")
    polling_interval: int = Field(..., description="Recommended polling interval for updates")
