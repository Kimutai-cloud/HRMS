from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

from app.core.exceptions.auth_exceptions import AuthException
from app.presentation.schema.common_schema import ErrorResponse

logger = logging.getLogger(__name__)


async def auth_exception_handler(request: Request, exc: AuthException):
    """Handle authentication exceptions."""
    logger.warning(f"Auth exception: {str(exc)}")
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            message=str(exc),
            error_code="AUTH_ERROR"
        ).dict()
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation exceptions."""
    logger.warning(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            message="Validation error",
            error_code="VALIDATION_ERROR"
        ).dict()
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            message=exc.detail,
            error_code="HTTP_ERROR"
        ).dict()
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            message="Internal server error",
            error_code="INTERNAL_ERROR"
        ).dict()
    )