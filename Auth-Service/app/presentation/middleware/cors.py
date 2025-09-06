# app/config/cors.py - Dedicated CORS configuration module
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings


def setup_cors(app: FastAPI) -> None:
    """
    Configure CORS middleware for the FastAPI application.
    
    This function must be called early in the application setup process,
    before adding routes, to ensure preflight requests are handled properly.
    """
    
    # Debug logging to help troubleshoot CORS issues in development
    if settings.DEBUG:
        print(f"🔧 Setting up CORS middleware")
        print(f"📍 Allowed origins: {settings.ALLOWED_ORIGINS}")
        print(f"🎯 Frontend URL: {settings.FRONTEND_URL}")
    
    # Add CORS middleware with comprehensive configuration
    app.add_middleware(
        CORSMiddleware,
        # Specify exact origins instead of wildcards for security
        allow_origins=settings.ALLOWED_ORIGINS,
        
        # Enable credentials (cookies, authorization headers) for auth flows
        allow_credentials=True,
        
        # Allow all standard HTTP methods including OPTIONS for preflight
        allow_methods=[
            "GET",      # Reading data
            "POST",     # Creating data (login, register)
            "PUT",      # Updating data
            "DELETE",   # Deleting data
            "OPTIONS",  # Preflight requests - THIS IS CRITICAL
            "PATCH",    # Partial updates
            "HEAD",     # Metadata requests
        ],
        
        # Allow common headers used in authentication and API requests
        allow_headers=[
            "Accept",                    # Content negotiation
            "Accept-Language",           # Internationalization
            "Content-Language",          # Response language
            "Content-Type",              # JSON payloads - REQUIRED for your API
            "Authorization",             # JWT tokens - REQUIRED for protected routes
            "X-Requested-With",          # AJAX identification
            "Access-Control-Request-Method",     # Preflight method specification
            "Access-Control-Request-Headers",    # Preflight headers specification
            "Origin",                    # Request origin identification
            "X-CSRFToken",              # CSRF protection if you add it later
            "x-service-type",           # Service type header for API routing
            "x-request-id",             # Request tracking
            "x-api-version",            # API versioning
        ],
        
        # Optional: Expose additional headers to the frontend
        expose_headers=[
            "Content-Type",
            "Authorization",
        ],
        
        # Cache preflight requests for 1 hour to reduce overhead
        max_age=3600,
    )
    
    if settings.DEBUG:
        print("✅ CORS middleware configured successfully")