from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    APP_NAME: str = "Auth Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    DATABASE_URL: str
    
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    EMAIL_TOKEN_EXPIRE_MINUTES: int = 30
    
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    
    RESEND_API_KEY: str
    FROM_EMAIL: str = "noreply@dev.com"
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"  
    
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",      
        "http://localhost:5173",     
        "http://127.0.0.1:3000",      
        "http://127.0.0.1:5173",      
        "http://localhost:8080",      
        "http://127.0.0.1:8080",      
    ]
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
