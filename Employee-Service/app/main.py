from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

from app.config.settings import settings
from app.config.logging import setup_logging
from app.presentation.api.v1 import employees, roles, me, admin, profile 
from app.presentation.api.v1.health import router as health_router
from app.presentation.middleware.cors import setup_cors
from app.presentation.middleware.error_handler import (
    employee_exception_handler,
    role_exception_handler,
    validation_exception_handler,
    http_exception_handler,
    general_exception_handler
)

from app.core.exceptions.employee_exceptions import EmployeeException
from app.core.exceptions.role_exceptions import RoleException


# Setup logging
setup_logging()
logger = logging.getLogger(__name__)



# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Employee management microservice for HRMS",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Setup CORS
setup_cors(app)

app.include_router(admin.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")

@app.get("/api/v1/info")
async def service_info():
    """Service information endpoint."""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.APP_VERSION,
        "description": "Employee management microservice with admin verification workflow",
        "endpoints": {
            "employees": "/api/v1/employees",
            "roles": "/api/v1/roles", 
            "me": "/api/v1/me",
            "profile": "/api/v1/profile",
            "admin": "/api/v1/admin",
            "health": "/api/v1/health",
            "docs": "/docs" if settings.DEBUG else None
        },
        "features": [
            "Employee profile submission and verification",
            "Multi-stage admin approval workflow",
            "Document upload and review system",
            "Role-based access control",
            "Auth Service integration",
            "Audit logging and compliance"
        ]
    }

@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"Service port: {settings.SERVICE_PORT}")
    
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
            
            
        except Exception as e:
            logger.error(f"❌ Failed to create database tables: {e}")



@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("Shutting down Employee Service")
    
    try:
        from app.infrastructure.database.connections import db_connection
        await db_connection.close()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.error(f"❌ Error closing database connections: {e}")


# Add exception handlers
app.add_exception_handler(EmployeeException, employee_exception_handler)
app.add_exception_handler(RoleException, role_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include routers
app.include_router(health_router, prefix="/api/v1")
app.include_router(employees.router, prefix="/api/v1")
app.include_router(roles.router, prefix="/api/v1")
app.include_router(me.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "service": "employee-service"
    }


@app.get("/api/v1/info")
async def service_info():
    """Service information endpoint."""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.APP_VERSION,
        "description": "Employee management microservice",
        "endpoints": {
            "employees": "/api/v1/employees",
            "roles": "/api/v1/roles",
            "me": "/api/v1/me",
            "health": "/api/v1/health",
            "docs": "/docs" if settings.DEBUG else None
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.SERVICE_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )