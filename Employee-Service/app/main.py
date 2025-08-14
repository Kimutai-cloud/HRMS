from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

from app.config.settings import settings
from app.config.logging import setup_logging
from app.presentation.api.v1 import employees, roles, me
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
            
            # Seed initial roles
            await seed_roles()
            
        except Exception as e:
            logger.error(f"❌ Failed to create database tables: {e}")


async def seed_roles():
    """Seed initial roles if they don't exist."""
    try:
        from app.infrastructure.database.connections import db_connection
        from app.infrastructure.database.repositories.role_repository import RoleRepository
        from app.core.entities.role import Role, RoleCode
        from uuid import uuid4
        
        async with db_connection.async_session() as session:
            role_repo = RoleRepository(session)
            
            # Check if roles already exist
            existing_admin = await role_repo.get_role_by_code(RoleCode.ADMIN)
            if existing_admin:
                logger.info("✅ Roles already seeded")
                return
            
            # Create default roles
            roles = [
                Role(
                    id=uuid4(),
                    code=RoleCode.ADMIN,
                    name="Administrator",
                    description="Full system access with all permissions"
                ),
                Role(
                    id=uuid4(),
                    code=RoleCode.MANAGER,
                    name="Manager",
                    description="Can manage team members and view team data"
                ),
                Role(
                    id=uuid4(),
                    code=RoleCode.EMPLOYEE,
                    name="Employee",
                    description="Basic employee access to view own profile"
                )
            ]
            
            for role in roles:
                await role_repo.create_role(role)
            
            logger.info("✅ Default roles seeded successfully!")
            
    except Exception as e:
        logger.error(f"❌ Failed to seed roles: {e}")


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