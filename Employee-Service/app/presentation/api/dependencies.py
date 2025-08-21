from fastapi import Depends, HTTPException, logger, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import AsyncGenerator, Dict, Any, List, Optional

from app.core.exceptions.employee_exceptions import EmployeePermissionException
from app.core.exceptions.role_exceptions import UnauthorizedException, ForbiddenException
from app.core.entities.user_claims import UserClaims
from app.infrastructure.database.connections import db_connection
from app.infrastructure.database.repositories.employee_repository import EmployeeRepository
from app.infrastructure.database.repositories.role_repository import RoleRepository
from app.infrastructure.database.repositories.event_repository import EventRepository
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.infrastructure.database.repositories.document_repository import DocumentRepository
from app.infrastructure.security.jwt_handler import JWTHandler
from app.infrastructure.security.permission_service import PermissionService, VerificationAwareMiddleware
from app.infrastructure.external.auth_service_client import auth_service_client
from app.domain.services import EmployeeDomainService, RoleBasedAccessControlService
from app.application.use_case.employee_use_cases import EmployeeUseCase
from app.application.use_case.role_use_cases import RoleUseCase
from app.application.use_case.admin_review_use_cases import AdminReviewUseCase
from app.application.use_case.document_use_cases import DocumentUseCase
from app.application.use_case.profile_use_cases import ProfileUseCase
from app.application.services.notification_service import NotificationService
from app.infrastructure.security.permission_service import AccessLevel, PermissionType

security = HTTPBearer()

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with db_connection.async_session() as session:
        try:
            yield session
        finally:
            await session.close()

def get_jwt_handler() -> JWTHandler:
    return JWTHandler()

def get_employee_repository(session: AsyncSession = Depends(get_db_session)) -> EmployeeRepository:
    return EmployeeRepository(session)

def get_role_repository(session: AsyncSession = Depends(get_db_session)) -> RoleRepository:
    return RoleRepository(session)

def get_event_repository(session: AsyncSession = Depends(get_db_session)) -> EventRepository:
    return EventRepository(session)

def get_audit_repository(session: AsyncSession = Depends(get_db_session)) -> AuditRepository:
    return AuditRepository(session)

def get_document_repository(session: AsyncSession = Depends(get_db_session)) -> DocumentRepository:
    return DocumentRepository(session)

def get_permission_service(
    role_repository: RoleRepository = Depends(get_role_repository),
    employee_repository: EmployeeRepository = Depends(get_employee_repository)
) -> PermissionService:
    return PermissionService(role_repository, employee_repository)

def get_notification_service(
    employee_repository: EmployeeRepository = Depends(get_employee_repository)
) -> NotificationService:
    return NotificationService(employee_repository)

def get_employee_domain_service(
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    role_repository: RoleRepository = Depends(get_role_repository),
    permission_service: PermissionService = Depends(get_permission_service)
) -> EmployeeDomainService:
    return EmployeeDomainService(employee_repository, role_repository, permission_service)

def get_rbac_service(
    role_repository: RoleRepository = Depends(get_role_repository),
    employee_repository: EmployeeRepository = Depends(get_employee_repository)
) -> RoleBasedAccessControlService:
    return RoleBasedAccessControlService(role_repository, employee_repository)

def get_employee_use_case(
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    event_repository: EventRepository = Depends(get_event_repository),
    domain_service: EmployeeDomainService = Depends(get_employee_domain_service),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> EmployeeUseCase:
    return EmployeeUseCase(employee_repository, event_repository, domain_service, rbac_service)

def get_profile_use_case(
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    role_repository: RoleRepository = Depends(get_role_repository),
    event_repository: EventRepository = Depends(get_event_repository)
) -> ProfileUseCase:
    return ProfileUseCase(
        employee_repository=employee_repository,
        role_repository=role_repository,
        event_repository=event_repository,
        auth_service_client=auth_service_client
    )

def get_role_use_case(
    role_repository: RoleRepository = Depends(get_role_repository),
    event_repository: EventRepository = Depends(get_event_repository),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> RoleUseCase:
    return RoleUseCase(role_repository, event_repository, rbac_service)

def get_document_use_case(
    document_repository: DocumentRepository = Depends(get_document_repository),
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    event_repository: EventRepository = Depends(get_event_repository)
) -> DocumentUseCase:
    return DocumentUseCase(
        document_repository=document_repository,
        employee_repository=employee_repository,
        event_repository=event_repository,
        auth_service_client=auth_service_client
    )

def get_admin_review_use_case(
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    document_repository: DocumentRepository = Depends(get_document_repository),
    role_repository: RoleRepository = Depends(get_role_repository),
    event_repository: EventRepository = Depends(get_event_repository),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> AdminReviewUseCase:
    return AdminReviewUseCase(
        employee_repository=employee_repository,
        document_repository=document_repository,
        role_repository=role_repository,
        event_repository=event_repository,
        rbac_service=rbac_service,
        auth_service_client=auth_service_client
    )

def get_verification_middleware(
    permission_service: PermissionService = Depends(get_permission_service)
) -> VerificationAwareMiddleware:
    return VerificationAwareMiddleware(permission_service)

def get_notification_service(
    employee_repository: EmployeeRepository = Depends(get_employee_repository)
) -> NotificationService:
    return NotificationService(employee_repository)

async def get_current_user_claims(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    jwt_handler: JWTHandler = Depends(get_jwt_handler)
) -> UserClaims:
    """Enhanced JWT token validation with comprehensive error handling."""
    
    try:
        token_data = jwt_handler.verify_token(credentials.credentials)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "INVALID_TOKEN",
                    "message": "Invalid or expired authentication token",
                    "hint": "Please login again to obtain a new token"
                },
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        validation_errors = []
        
        if not token_data.get("sub"):
            validation_errors.append("missing user ID")
        if not token_data.get("email"):
            validation_errors.append("missing email")
        if not token_data.get("employee_profile_status"):
            validation_errors.append("missing profile status")
            
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "INVALID_TOKEN_CLAIMS", 
                    "message": f"Token validation failed: {', '.join(validation_errors)}",
                    "hint": "Token may be from an older version. Please login again."
                },
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            user_claims = UserClaims(
                user_id=UUID(token_data["sub"]),
                email=token_data["email"],
                employee_profile_status=token_data.get("employee_profile_status", "NOT_STARTED"),
                token_type=token_data.get("type", "access"),
                issued_at=token_data.get("iat"),
                expires_at=token_data.get("exp"),
                audience=token_data.get("aud"),
                issuer=token_data.get("iss"),
                raw_payload=token_data
            )
            
            if user_claims.token_type != "access":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={
                        "error": "WRONG_TOKEN_TYPE",
                        "message": f"Expected access token, got {user_claims.token_type}",
                        "hint": "Use access token for API requests"
                    },
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            return user_claims
            
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "TOKEN_FORMAT_ERROR",
                    "message": f"Invalid token format: {str(e)}",
                    "hint": "Please login again to obtain a valid token"
                },
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    except HTTPException:
        raise  
    except Exception as e:
        logger.error(f"Unexpected JWT validation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "AUTHENTICATION_ERROR",
                "message": "Could not validate credentials",
                "hint": "Please try logging in again"
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(
    user_claims: UserClaims = Depends(get_current_user_claims)
) -> dict:
    """Legacy compatibility method that returns dict format."""
    return {
        "user_id": user_claims.user_id,
        "email": user_claims.email,
        "employee_profile_status": user_claims.employee_profile_status,
        "access_level": user_claims.get_access_level()
    }

async def require_profile_completion(
    user_claims: UserClaims = Depends(get_current_user_claims),
    middleware: VerificationAwareMiddleware = Depends(get_verification_middleware)
) -> UserClaims:
    """Require user to be able to complete their profile."""
    return await middleware.verify_access_level(
        user_claims, [AccessLevel.PROFILE_COMPLETION, AccessLevel.NEWCOMER, AccessLevel.VERIFIED, AccessLevel.ADMIN]
    )

async def require_newcomer_access(
    user_claims: UserClaims = Depends(get_current_user_claims),
    middleware: VerificationAwareMiddleware = Depends(get_verification_middleware)
) -> UserClaims:
    """Require newcomer level access or higher."""
    return await middleware.verify_access_level(
        user_claims, [AccessLevel.NEWCOMER, AccessLevel.VERIFIED, AccessLevel.ADMIN]
    )

async def require_verified_employee(
    user_claims: UserClaims = Depends(get_current_user_claims),
    middleware: VerificationAwareMiddleware = Depends(get_verification_middleware)
) -> UserClaims:
    """Require verified employee status."""
    return await middleware.verify_access_level(
        user_claims, [AccessLevel.VERIFIED, AccessLevel.ADMIN]
    )

async def require_admin_access(
    user_claims: UserClaims = Depends(get_current_user_claims),
    middleware: VerificationAwareMiddleware = Depends(get_verification_middleware)
) -> UserClaims:
    """Require admin access."""
    return await middleware.verify_access_level(
        user_claims, [AccessLevel.ADMIN]
    )

async def require_profile_management(
    user_claims: UserClaims = Depends(get_current_user_claims),
    middleware: VerificationAwareMiddleware = Depends(get_verification_middleware)
) -> UserClaims:
    """Require permission to manage own profile."""
    return await middleware.verify_permission(
        user_claims, PermissionType.UPDATE_OWN_PROFILE
    )

async def require_document_upload(
    user_claims: UserClaims = Depends(get_current_user_claims),
    middleware: VerificationAwareMiddleware = Depends(get_verification_middleware)
) -> UserClaims:
    """Require permission to upload documents."""
    return await middleware.verify_permission(
        user_claims, PermissionType.UPLOAD_DOCUMENTS
    )

async def require_admin_review(
    user_claims: UserClaims = Depends(get_current_user_claims),
    middleware: VerificationAwareMiddleware = Depends(get_verification_middleware)
) -> UserClaims:
    """Require permission to review profiles."""
    return await middleware.verify_permission(
        user_claims, PermissionType.REVIEW_PROFILES
    )

async def require_employee_view(
    user_claims: UserClaims = Depends(get_current_user_claims),
    middleware: VerificationAwareMiddleware = Depends(get_verification_middleware)
) -> UserClaims:
    """Require permission to view employees."""
    return await middleware.verify_permission(
        user_claims, PermissionType.VIEW_EMPLOYEES
    )

async def get_request_context(request: Request) -> dict:
    """Extract request context for audit logging."""
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "endpoint": f"{request.method} {request.url.path}",
        "query_params": dict(request.query_params)
    }
class ContextualPermissionChecker:
    """Helper for checking permissions with context."""
    
    def __init__(self, permission_service: PermissionService):
        self.permission_service = permission_service
    
    async def can_view_employee(
        self, 
        user_claims: UserClaims, 
        employee_id: UUID
    ) -> bool:
        """Check if user can view specific employee."""
        return await self.permission_service.has_permission(
            user_claims,
            PermissionType.VIEW_EMPLOYEES,
            {"employee_id": employee_id}
        )
    
    async def can_update_employee(
        self, 
        user_claims: UserClaims, 
        employee_id: UUID
    ) -> bool:
        """Check if user can update specific employee."""
        return await self.permission_service.has_permission(
            user_claims,
            PermissionType.UPDATE_EMPLOYEES,
            {"employee_id": employee_id}
        )
    
    async def can_manage_document(
        self, 
        user_claims: UserClaims, 
        document_owner_id: UUID
    ) -> bool:
        """Check if user can manage specific document."""
        return await self.permission_service.has_permission(
            user_claims,
            PermissionType.VIEW_OWN_DOCUMENTS,
            {"document_owner_id": document_owner_id}
        )

def get_permission_checker(
    permission_service: PermissionService = Depends(get_permission_service)
) -> ContextualPermissionChecker:
    return ContextualPermissionChecker(permission_service)

async def require_admin(
    user_claims: UserClaims = Depends(require_admin_access)
) -> dict:
    """Legacy admin requirement - returns dict format."""
    return {
        "user_id": user_claims.user_id,
        "email": user_claims.email,
        "employee_profile_status": user_claims.employee_profile_status,
        "access_level": "ADMIN"
    }

async def require_manager_or_admin(
    user_claims: UserClaims = Depends(get_current_user_claims),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> dict:
    """Require manager or admin role."""
    
    is_admin = await rbac_service.is_admin(user_claims.user_id)
    is_manager = await rbac_service.is_manager(user_claims.user_id)
    
    if not (is_admin or is_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin role required"
        )
    
    return {
        "user_id": user_claims.user_id,
        "email": user_claims.email,
        "employee_profile_status": user_claims.employee_profile_status,
        "access_level": "ADMIN" if is_admin else "MANAGER"
    }

async def get_current_user_with_employee(
    user_claims: UserClaims = Depends(get_current_user_claims),
    employee_repository: EmployeeRepository = Depends(get_employee_repository)
) -> tuple[UserClaims, Optional[any]]:
    """Get current user claims with their employee record if it exists."""
    
    try:
        employee = await employee_repository.get_by_user_id(user_claims.user_id)
        return user_claims, employee
    except Exception:
        return user_claims, None

async def allow_newcomer_access(
    user_claims: UserClaims = Depends(get_current_user_claims)
) -> UserClaims:
    """Allow access for newcomers and verified users (no permission error)."""
    
    # This is permissive - allows all authenticated users
    # but provides the claims for further permission checking
    return user_claims