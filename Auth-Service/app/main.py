from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

from starlette.requests import Request
from app.config.settings import settings
from app.config.logging import setup_logging
from app.presentation.api.v1 import auth, users, health
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
    description="Authentication microservice",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Setup CORS
setup_cors(app)

# Add exception handlers
app.add_exception_handler(AuthException, auth_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Include routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("Shutting down application")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }

@app.options("/api/v1/{path:path}")
async def handle_preflight(request: Request, path: str):
    """
    Explicit preflight handler for debugging CORS issues.
    Remove this once CORS middleware is working properly.
    """
    if settings.DEBUG:
        print(f"🔍 Received preflight request for path: /api/v1/{path}")
        print(f"🔍 Origin: {request.headers.get('origin')}")
        print(f"🔍 Method: {request.headers.get('access-control-request-method')}")
    
    return {}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )