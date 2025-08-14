
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    APP_NAME: str = "Employee Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    DATABASE_URL: str
    
    # JWT Settings (MUST match Auth Service exactly)
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_AUDIENCE: str = "hrms-services"  # Must match Auth Service
    JWT_ISSUER: str = "hrms-auth-service"  # Must match Auth Service
    
    # Auth Service Integration (Enhanced)
    AUTH_SERVICE_URL: str = "http://localhost:8000"
    INTERNAL_SERVICE_TOKEN: str = "MY_INTERNAL_SERVICE_TOKEN"
    INTERNAL_SERVICE_NAME: str = "Employee-Service"
    
    # CORS Settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://host.docker.internal:3000",
        "http://host.docker.internal:5173",
    ]
    
    # Event Bus Settings
    EVENT_BUS_URL: str = "nats://localhost:4222"  # NATS or Kafka
    
    # Service Discovery
    SERVICE_NAME: str = "Employee-Service"
    SERVICE_PORT: int = 8001
    
    # File Upload Settings (for document management)
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_FILE_TYPES: List[str] = ["pdf", "jpg", "jpeg", "png", "doc", "docx"]
    
    # Observability
    OTEL_EXPORTER_OTLP_ENDPOINT: str = ""
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    
    # Pagination
    MAX_PAGE_SIZE: int = 100
    DEFAULT_PAGE_SIZE: int = 20
    
    # Verification Workflow Settings
    AUTO_ASSIGN_NEWCOMER_ROLE: bool = True
    REQUIRE_DOCUMENT_UPLOAD: bool = True
    MAX_REJECTION_RESUBMISSIONS: int = 3
    
    ENABLE_EMAIL_NOTIFICATIONS: bool = False
    NOTIFICATION_EMAIL_FROM: str = "kevin.kimu0306@gmail.com"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()