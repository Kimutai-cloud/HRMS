from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings


def setup_cors(app: FastAPI) -> None:
    """Configure CORS middleware for the FastAPI application."""
    
    if settings.DEBUG:
        print(f"🔧 Setting up CORS middleware")
        print(f"📍 Allowed origins: {settings.ALLOWED_ORIGINS}")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=[
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS",
            "PATCH",
            "HEAD",
        ],
        allow_headers=[
            "Accept",
            "Accept-Language",
            "Content-Language",
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers",
            "Origin",
            "If-Match",  # For optimistic concurrency
            "X-CSRFToken",
        ],
        expose_headers=[
            "Content-Type",
            "Authorization",
            "ETag",  # For optimistic concurrency
        ],
        max_age=3600,
    )
    
    if settings.DEBUG:
        print("✅ CORS middleware configured successfully")