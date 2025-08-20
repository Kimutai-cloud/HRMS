from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import AsyncGenerator

from app.core.exceptions.employee_exceptions import EmployeePermissionException
from app.core.exceptions.role_exceptions import UnauthorizedException, ForbiddenException
from app.core.entities.user_claims import UserClaims
from app.infrastructure.database.connections import db_connection
from app.infrastructure.database.repositories.employee_repository import EmployeeRepository
from app.infrastructure.database.repositories.role_repository import RoleRepository
from app.infrastructure.database.repositories.event_repository import EventRepository
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.infrastructure.security.jwt_handler import JWTHandler
from app.infrastructure.security.permission_service import PermissionService
from app.domain.services import EmployeeDomainService, RoleBasedAccessControlService
from app.application.use_case.employee_use_cases import EmployeeUseCase
from app.application.use_case.role_use_cases import RoleUseCase
from app.application.use_case.admin_review_use_cases import AdminReviewUseCase
from app.application.use_case.document_use_cases import DocumentUseCase
from app.application.use_case.profile_use_cases import ProfileUseCase  
from app.infrastructure.database.repositories.document_repository import DocumentRepository
from app.infrastructure.external.auth_service_client import auth_service_client
from app.core.entities.user_claims import UserClaims
from app.infrastructure.security.permission_service import (
    PermissionService, 
    VerificationAwareMiddleware,
    AccessLevel,
    PermissionType
)

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

def get_permission_service(
    role_repository: RoleRepository = Depends(get_role_repository),
    employee_repository: EmployeeRepository = Depends(get_employee_repository)
) -> PermissionService:
    return PermissionService(role_repository, employee_repository)

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

async def get_current_user_claims(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    jwt_handler: JWTHandler = Depends(get_jwt_handler)
) -> UserClaims:
    """Extract and validate JWT token, return enhanced user claims."""
    
    try:
        token_data = jwt_handler.verify_token(credentials.credentials)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create UserClaims object with enhanced information
        user_claims = UserClaims(
            user_id=token_data["user_id"],
            email=token_data["email"],
            employee_profile_status=token_data["employee_profile_status"],
            token_type=token_data["token_type"],
            issued_at=token_data.get("issued_at"),
            expires_at=token_data.get("expires_at"),
            audience=token_data.get("audience"),
            issuer=token_data.get("issuer"),
            raw_payload=token_data.get("raw_payload")
        )
        
        return user_claims
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
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

async def require_verified_profile(
    user_claims: UserClaims = Depends(get_current_user_claims)
) -> UserClaims:
    """Require user to have verified employee profile."""
    
    if not user_claims.is_verified_profile():
        detail = f"Verified employee profile required. Current status: {user_claims.employee_profile_status}"
        
        if user_claims.needs_profile_completion():
            detail += " Please complete your employee profile first."
        elif user_claims.is_pending_verification():
            detail += " Your profile is under review."
        elif user_claims.is_profile_rejected():
            detail += " Your profile was rejected. Please resubmit with corrections."
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )
    
    return user_claims

async def get_request_context(request: Request) -> dict:
    """Extract request context for audit logging."""
    
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "endpoint": f"{request.method} {request.url.path}",
        "query_params": dict(request.query_params)
    }

def get_document_repository(session: AsyncSession = Depends(get_db_session)) -> DocumentRepository:
    return DocumentRepository(session)

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


# Context-aware permission checker
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