"""
CORS Preflight Middleware
Handles OPTIONS requests before they reach route dependencies, ensuring CORS preflight always succeeds.
"""

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

from app.config.settings import settings

logger = logging.getLogger(__name__)


class CORSPreflightMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle CORS preflight OPTIONS requests before route dependencies.
    
    This ensures that OPTIONS requests always return 200 OK with proper CORS headers,
    preventing CORS failures due to dependency processing errors.
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.allowed_origins = set(settings.ALLOWED_ORIGINS)
        
    def is_cors_preflight(self, request: Request) -> bool:
        """Check if request is a CORS preflight request."""
        return (
            request.method == "OPTIONS" and
            request.headers.get("access-control-request-method") is not None
        )
    
    def is_origin_allowed(self, origin: str) -> bool:
        """Check if the origin is in allowed origins."""
        return origin in self.allowed_origins
    
    def create_preflight_response(self, request: Request) -> Response:
        """Create proper CORS preflight response."""
        origin = request.headers.get("origin")
        
        headers = {
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
            "Access-Control-Allow-Headers": (
                "Accept, Accept-Language, Content-Language, Content-Type, "
                "Authorization, X-Requested-With, Access-Control-Request-Method, "
                "Access-Control-Request-Headers, Origin, If-Match, X-CSRFToken, "
                "x-request-id,"
                "x-service,"
                "x-service-type,"
                "x-api-version"
            ),
            "Access-Control-Max-Age": "3600",
        }
        
        # Add origin-specific headers if origin is allowed
        if origin and self.is_origin_allowed(origin):
            headers["Access-Control-Allow-Origin"] = origin
            headers["Access-Control-Allow-Credentials"] = "true"
        
        if settings.DEBUG:
            logger.debug(f"✅ CORS preflight handled for {request.url.path} from origin: {origin}")
        
        return JSONResponse(
            content={},
            status_code=200,
            headers=headers
        )
    
    async def dispatch(self, request: Request, call_next):
        """Process request and handle CORS preflight if needed."""
        
        # Handle CORS preflight requests immediately
        if self.is_cors_preflight(request):
            return self.create_preflight_response(request)
        
        # For all other requests, proceed normally
        return await call_next(request)