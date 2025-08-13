from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    APP_NAME: str = "Employee Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    DATABASE_URL: str
    
    # JWT Settings (should match Auth Service)
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_AUDIENCE: str = "hrms-services"
    JWT_ISSUER: str = "hrms-auth-service"
    
    # Auth Service Integration
    AUTH_SERVICE_URL: str = "http://localhost:8000"
    
    # CORS Settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]
    
    # Event Bus Settings
    EVENT_BUS_URL: str = "nats://localhost:4222"  # NATS or Kafka
    
    # Service Discovery
    SERVICE_NAME: str = "employee-service"
    SERVICE_PORT: int = 8001
    
    # Observability
    OTEL_EXPORTER_OTLP_ENDPOINT: str = ""
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    
    # Pagination
    MAX_PAGE_SIZE: int = 100
    DEFAULT_PAGE_SIZE: int = 20
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()