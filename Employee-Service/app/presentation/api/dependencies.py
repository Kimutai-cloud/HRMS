from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

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
from app.infrastructure.database.repositories.document_repository import DocumentRepository
from app.infrastructure.external.auth_service_client import auth_service_client

# Security scheme
security = HTTPBearer()


# Database session dependency
async def get_db_session() -> AsyncSession:
    async with db_connection.async_session() as session:
        try:
            yield session
        finally:
            await session.close()


# Service dependencies
def get_jwt_handler() -> JWTHandler:
    return JWTHandler()


# Repository dependencies
def get_employee_repository(session: AsyncSession = Depends(get_db_session)) -> EmployeeRepository:
    return EmployeeRepository(session)


def get_role_repository(session: AsyncSession = Depends(get_db_session)) -> RoleRepository:
    return RoleRepository(session)


def get_event_repository(session: AsyncSession = Depends(get_db_session)) -> EventRepository:
    return EventRepository(session)


def get_audit_repository(session: AsyncSession = Depends(get_db_session)) -> AuditRepository:
    return AuditRepository(session)


# Domain service dependencies
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


# Use case dependencies
def get_employee_use_case(
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    event_repository: EventRepository = Depends(get_event_repository),
    domain_service: EmployeeDomainService = Depends(get_employee_domain_service),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> EmployeeUseCase:
    return EmployeeUseCase(employee_repository, event_repository, domain_service, rbac_service)


def get_role_use_case(
    role_repository: RoleRepository = Depends(get_role_repository),
    event_repository: EventRepository = Depends(get_event_repository),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> RoleUseCase:
    return RoleUseCase(role_repository, event_repository, rbac_service)


# Enhanced Authentication dependencies

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


# Legacy compatibility - returns dict like before
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


# Enhanced authorization helpers with profile status checking

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


async def require_admin(
    user_claims: UserClaims = Depends(require_verified_profile),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> UserClaims:
    """Require admin role AND verified profile."""
    
    if not await rbac_service.is_admin(user_claims.user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required"
        )
    
    return user_claims


async def require_manager_or_admin(
    user_claims: UserClaims = Depends(require_verified_profile),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> UserClaims:
    """Require manager or admin role AND verified profile."""
    
    user_id = user_claims.user_id
    if not (await rbac_service.is_admin(user_id) or await rbac_service.is_manager(user_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin role required"
        )
    
    return user_claims


async def allow_newcomer_access(
    user_claims: UserClaims = Depends(get_current_user_claims)
) -> UserClaims:
    """Allow access for pending verification or verified users (newcomer + full access)."""
    
    if not user_claims.can_access_newcomer_endpoints():
        detail = f"Profile verification required. Current status: {user_claims.employee_profile_status}"
        
        if user_claims.needs_profile_completion():
            detail += " Please complete your employee profile first."
        elif user_claims.is_profile_rejected():
            detail += " Your profile was rejected. Please resubmit with corrections."
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )
    
    return user_claims


# Request context for audit logging
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