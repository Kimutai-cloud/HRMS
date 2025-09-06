from typing import Callable, Dict, Any, Optional
from uuid import uuid4
from datetime import datetime, timezone
import time
import asyncio
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
import json

from app.infrastructure.database.repositories.audit_repository import (
    EnhancedAuditRepository,
    AuditContext,
    AuditLevel,
    ActionCategory,
    PerformanceMetrics
)
from app.infrastructure.database.connections import db_connection
from app.core.entities.user_claims import UserClaims


class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware for automatic audit logging of API requests and responses."""
    
    def __init__(self, app, config: Optional[Dict[str, Any]] = None):
        super().__init__(app)
        self.config = config or {}
        self.enabled = self.config.get("enabled", True)
        self.log_requests = self.config.get("log_requests", True)
        self.log_responses = self.config.get("log_responses", False)
        self.log_performance = self.config.get("log_performance", True)
        self.exclude_paths = set(self.config.get("exclude_paths", [
            "/health",
            "/metrics",
            "/docs",
            "/openapi.json",
            "/favicon.ico"
        ]))
        self.exclude_methods = set(self.config.get("exclude_methods", ["OPTIONS"]))
        
        # Performance thresholds
        self.response_time_threshold_ms = self.config.get("response_time_threshold_ms", 5000)
        self.memory_threshold_mb = self.config.get("memory_threshold_mb", 100)
    
    async def dispatch(self, request: Request, call_next: Callable) -> StarletteResponse:
        """Process request and response with audit logging."""
        
        if not self.enabled or self._should_exclude_request(request):
            return await call_next(request)
        
        # Start timing
        start_time = time.time()
        request_id = str(uuid4())
        
        # Extract user context
        user_context = await self._extract_user_context(request)
        
        # Create audit context
        audit_context = AuditContext(
            user_id=user_context.get("user_id") if user_context else None,
            session_id=user_context.get("session_id") if user_context else None,
            ip_address=self._get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            endpoint=str(request.url.path),
            method=request.method,
            request_id=request_id,
            correlation_id=request.headers.get("x-correlation-id", str(uuid4())),
            additional_data={
                "query_params": dict(request.query_params),
                "path_params": dict(request.path_params) if hasattr(request, 'path_params') else {}
            }
        )
        
        # Log request if enabled
        if self.log_requests:
            await self._log_request(request, audit_context)
        
        # Process request
        try:
            response = await call_next(request)
            success = response.status_code < 400
            
        except Exception as e:
            # Log exception
            await self._log_exception(e, audit_context)
            raise
        
        # Calculate performance metrics
        end_time = time.time()
        execution_time_ms = (end_time - start_time) * 1000
        
        performance_metrics = PerformanceMetrics(
            execution_time_ms=execution_time_ms
        )
        
        # Log response if enabled
        if self.log_responses:
            await self._log_response(response, audit_context, performance_metrics)
        
        # Log performance issues if thresholds exceeded
        if self.log_performance and execution_time_ms > self.response_time_threshold_ms:
            await self._log_performance_issue(
                "slow_response_time",
                execution_time_ms,
                self.response_time_threshold_ms,
                audit_context,
                performance_metrics
            )
        
        # Add audit headers to response
        response.headers["x-request-id"] = request_id
        response.headers["x-correlation-id"] = audit_context.correlation_id
        
        return response
    
    def _should_exclude_request(self, request: Request) -> bool:
        """Determine if request should be excluded from audit logging."""
        
        if request.method in self.exclude_methods:
            return True
        
        path = request.url.path
        for exclude_path in self.exclude_paths:
            if path.startswith(exclude_path):
                return True
        
        return False
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        
        # Check for forwarded headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to client host
        if request.client:
            return request.client.host
        
        return "unknown"
    
    async def _extract_user_context(self, request: Request) -> Optional[Dict[str, Any]]:
        """Extract user context from request."""
        
        try:
            # Try to get user from request state (set by auth middleware)
            user = getattr(request.state, "user", None)
            if user and isinstance(user, UserClaims):
                return {
                    "user_id": user.user_id,
                    "email": user.email,
                    "session_id": user.raw_payload.get("session_id")
                }
            
            # Try to extract from Authorization header
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                # This would require JWT parsing - for now return placeholder
                return {
                    "user_id": None,
                    "session_id": None,
                    "has_auth_token": True
                }
        
        except Exception:
            pass
        
        return None
    
    async def _log_request(self, request: Request, context: AuditContext):
        """Log incoming request."""
        
        try:
            async with db_connection.async_session() as session:
                audit_repo = EnhancedAuditRepository(session)
                
                request_data = {
                    "method": request.method,
                    "url": str(request.url),
                    "headers": dict(request.headers),
                    "query_params": dict(request.query_params),
                    "content_type": request.headers.get("content-type"),
                    "content_length": request.headers.get("content-length")
                }
                
                # Try to capture request body for non-GET requests
                if request.method not in ["GET", "HEAD", "OPTIONS"]:
                    try:
                        body = await request.body()
                        if body and len(body) < 10000:  # Only log small bodies
                            content_type = request.headers.get("content-type", "")
                            if "application/json" in content_type:
                                try:
                                    request_data["body"] = json.loads(body.decode())
                                except:
                                    request_data["body_size"] = len(body)
                            else:
                                request_data["body_size"] = len(body)
                    except:
                        pass
                
                await audit_repo.log_comprehensive_action(
                    entity_type="http_request",
                    entity_id=uuid4(),
                    action=f"{request.method}_{request.url.path}",
                    category=ActionCategory.USER_AUTH if "/auth" in request.url.path else ActionCategory.SYSTEM_OPERATION,
                    level=AuditLevel.DEBUG,
                    context=context,
                    changes=request_data
                )
        
        except Exception as e:
            print(f"❌ Failed to log request audit: {e}")
    
    async def _log_response(
        self, 
        response: Response, 
        context: AuditContext, 
        performance_metrics: PerformanceMetrics
    ):
        """Log outgoing response."""
        
        try:
            async with db_connection.async_session() as session:
                audit_repo = EnhancedAuditRepository(session)
                
                response_data = {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "content_type": response.headers.get("content-type"),
                    "content_length": response.headers.get("content-length")
                }
                
                level = AuditLevel.INFO
                if response.status_code >= 500:
                    level = AuditLevel.ERROR
                elif response.status_code >= 400:
                    level = AuditLevel.WARNING
                
                await audit_repo.log_comprehensive_action(
                    entity_type="http_response",
                    entity_id=uuid4(),
                    action=f"response_{response.status_code}",
                    category=ActionCategory.SYSTEM_OPERATION,
                    level=level,
                    context=context,
                    changes=response_data,
                    performance_metrics=performance_metrics
                )
        
        except Exception as e:
            print(f"❌ Failed to log response audit: {e}")
    
    async def _log_exception(self, exception: Exception, context: AuditContext):
        """Log unhandled exceptions."""
        
        try:
            async with db_connection.async_session() as session:
                audit_repo = EnhancedAuditRepository(session)
                
                error_data = {
                    "exception_type": type(exception).__name__,
                    "exception_message": str(exception),
                    "traceback": None  # Could add traceback if needed
                }
                
                await audit_repo.log_comprehensive_action(
                    entity_type="system_error",
                    entity_id=uuid4(),
                    action="unhandled_exception",
                    category=ActionCategory.SYSTEM_OPERATION,
                    level=AuditLevel.ERROR,
                    context=context,
                    changes=error_data,
                    error_details=error_data
                )
        
        except Exception as e:
            print(f"❌ Failed to log exception audit: {e}")
    
    async def _log_performance_issue(
        self,
        issue_type: str,
        current_value: float,
        threshold_value: float,
        context: AuditContext,
        metrics: PerformanceMetrics
    ):
        """Log performance threshold breaches."""
        
        try:
            async with db_connection.async_session() as session:
                audit_repo = EnhancedAuditRepository(session)
                
                await audit_repo.log_performance_threshold_breach(
                    threshold_type=issue_type,
                    current_value=current_value,
                    threshold_value=threshold_value,
                    context=context,
                    metrics=metrics
                )
        
        except Exception as e:
            print(f"❌ Failed to log performance issue audit: {e}")


class AuditContextManager:
    """Context manager for tracking audit context across async operations."""
    
    def __init__(self, action: str, entity_type: str, entity_id: str, user_id: Optional[str] = None):
        self.action = action
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.user_id = user_id
        self.start_time = None
        self.context = None
    
    async def __aenter__(self):
        """Enter audit context."""
        self.start_time = time.time()
        self.context = AuditContext(
            user_id=self.user_id,
            correlation_id=str(uuid4()),
            additional_data={
                "operation_start": datetime.now(timezone.utc).isoformat()
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit audit context and log operation."""
        
        end_time = time.time()
        execution_time_ms = (end_time - self.start_time) * 1000
        
        success = exc_type is None
        level = AuditLevel.INFO if success else AuditLevel.ERROR
        
        operation_data = {
            "operation": self.action,
            "execution_time_ms": execution_time_ms,
            "success": success
        }
        
        if not success:
            operation_data["error"] = {
                "type": exc_type.__name__ if exc_type else None,
                "message": str(exc_val) if exc_val else None
            }
        
        try:
            async with db_connection.async_session() as session:
                audit_repo = EnhancedAuditRepository(session)
                
                await audit_repo.log_comprehensive_action(
                    entity_type=self.entity_type,
                    entity_id=self.entity_id,
                    action=self.action,
                    category=ActionCategory.SYSTEM_OPERATION,
                    level=level,
                    context=self.context,
                    changes=operation_data,
                    performance_metrics=PerformanceMetrics(execution_time_ms=execution_time_ms)
                )
        
        except Exception as e:
            print(f"❌ Failed to log operation audit: {e}")


# Factory function for creating audit middleware
def create_audit_middleware(config: Optional[Dict[str, Any]] = None):
    """Create audit middleware with configuration."""
    
    default_config = {
        "enabled": True,
        "log_requests": True,
        "log_responses": False,
        "log_performance": True,
        "response_time_threshold_ms": 5000,
        "exclude_paths": ["/health", "/metrics", "/docs", "/openapi.json"],
        "exclude_methods": ["OPTIONS"]
    }
    
    if config:
        default_config.update(config)
    
    def middleware_factory(app):
        return AuditMiddleware(app, default_config)
    
    return middleware_factory