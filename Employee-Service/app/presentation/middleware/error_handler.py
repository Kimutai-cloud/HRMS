from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

from app.core.exceptions.employee_exceptions import EmployeeException
from app.core.exceptions.role_exceptions import RoleException
from app.presentation.schema.common_schema import ErrorResponse, ValidationErrorResponse

logger = logging.getLogger(__name__)


async def employee_exception_handler(request: Request, exc: EmployeeException):
    """Handle employee domain exceptions."""
    logger.warning(f"Employee exception: {str(exc)}")
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            message=str(exc),
            error_code="EMPLOYEE_ERROR"
        ).dict()
    )


async def role_exception_handler(request: Request, exc: RoleException):
    """Handle role domain exceptions."""
    logger.warning(f"Role exception: {str(exc)}")
    
    status_code = 400
    if "permission" in str(exc).lower() or "forbidden" in str(exc).lower():
        status_code = 403
    elif "unauthorized" in str(exc).lower():
        status_code = 401
    elif "not found" in str(exc).lower():
        status_code = 404
    
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(
            message=str(exc),
            error_code="ROLE_ERROR"
        ).dict()
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation exceptions."""
    logger.warning(f"Validation error: {exc.errors()}")
    
    error_details = []
    for error in exc.errors():
        error_details.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=422,
        content=ValidationErrorResponse(
            details=error_details
        ).dict()
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    
    # Handle both string and dict detail formats
    if isinstance(exc.detail, dict):
        # Extract message from dict detail or use the entire dict as structured error
        message = exc.detail.get("message", "HTTP Error")
        error_code = exc.detail.get("error", "HTTP_ERROR")
        details = exc.detail if len(exc.detail) > 2 else None
    else:
        # Handle string detail (backward compatibility)
        message = str(exc.detail)
        error_code = "HTTP_ERROR"
        details = None
    
    # Add CORS headers to error responses
    headers = {}
    origin = request.headers.get("origin")
    if origin and origin in ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"]:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            message=message,
            error_code=error_code,
            details=details
        ).dict(),
        headers=headers
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    
    # Add CORS headers to error responses
    headers = {}
    origin = request.headers.get("origin")
    if origin and origin in ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"]:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            message="Internal server error",
            error_code="INTERNAL_ERROR"
        ).dict(),
        headers=headers
    )