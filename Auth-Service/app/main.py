from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

from starlette.requests import Request
from app.config.settings import settings
from app.config.logging import setup_logging
from app.presentation.api.v1 import auth, users, health, internal  # Add internal
from app.presentation.middleware.cors import setup_cors
from app.presentation.middleware.error_handler import (
    auth_exception_handler,
    validation_exception_handler,
    http_exception_handler,
    general_exception_handler
)
from app.core.exceptions.auth_exceptions import AuthException

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Authentication microservice with employee profile status management",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Setup CORS
setup_cors(app)


@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"JWT Audience: {settings.JWT_AUDIENCE}")
    logger.info(f"JWT Issuer: {settings.JWT_ISSUER}")
    
    if settings.DEBUG:
        try:
            logger.info("🔧 Auto-creating database tables...")
            from sqlalchemy.ext.asyncio import create_async_engine
            from app.infrastructure.database.models import Base
            
            engine = create_async_engine(settings.DATABASE_URL)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            await engine.dispose()
            
            logger.info("✅ Database tables created successfully!")
            
            # Check if we need to migrate existing users
            await migrate_existing_users()
            
        except Exception as e:
            logger.error(f"❌ Failed to create database tables: {e}")


async def migrate_existing_users():
    """Migrate existing users to have employee_profile_status."""
    try:
        from app.infrastructure.database.connection import db_connection
        from sqlalchemy import text
        
        async with db_connection.async_session() as session:
            # Check if any users exist without employee_profile_status
            result = await session.execute(
                text("SELECT COUNT(*) FROM users WHERE employee_profile_status IS NULL")
            )
            null_count = result.scalar()
            
            if null_count > 0:
                logger.info(f"🔄 Migrating {null_count} users to have employee_profile_status...")
                
                # Update existing users to have NOT_STARTED status
                await session.execute(
                    text("UPDATE users SET employee_profile_status = 'NOT_STARTED' WHERE employee_profile_status IS NULL")
                )
                await session.commit()
                
                logger.info("✅ User migration completed!")
            else:
                logger.info("✅ All users already have employee_profile_status")
                
    except Exception as e:
        logger.error(f"❌ User migration failed: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("Shutting down Auth Service")


# Add exception handlers
app.add_exception_handler(AuthException, auth_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(internal.router, prefix="/api/v1")  # Add internal API


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "features": [
            "User Authentication",
            "JWT Token Management", 
            "Employee Profile Status Tracking",
            "Internal Service API"
        ]
    }


@app.get("/api/v1/info")
async def service_info():
    """Service information endpoint."""
    return {
        "service": "auth-service",
        "version": settings.APP_VERSION,
        "description": "Authentication service with employee profile management",
        "endpoints": {
            "auth": "/api/v1/auth",
            "users": "/api/v1/users",
            "internal": "/api/v1/internal",
            "health": "/api/v1/health",
            "docs": "/docs" if settings.DEBUG else None
        },
        "jwt_config": {
            "algorithm": settings.JWT_ALGORITHM,
            "audience": settings.JWT_AUDIENCE,
            "issuer": settings.JWT_ISSUER,
            "access_token_expire_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )