from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional

from app.core.exceptions.employee_exceptions import EmployeePermissionException
from app.core.exceptions.role_exceptions import UnauthorizedException, ForbiddenException
from app.infrastructure.database.connection import db_connection
from app.infrastructure.database.repositories.employee_repository import EmployeeRepository
from app.infrastructure.database.repositories.role_repository import RoleRepository
from app.infrastructure.database.repositories.event_repository import EventRepository
from app.infrastructure.database.repositories.audit_repository import AuditRepository
from app.infrastructure.security.jwt_handler import JWTHandler
from app.infrastructure.security.permission_service import PermissionService
from app.domain.services import EmployeeDomainService, RoleBasedAccessControlService
from app.application.use_case.employee_use_cases import EmployeeUseCase
from app.application.use_case.role_use_cases import RoleUseCase

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


# Authentication dependency
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    jwt_handler: JWTHandler = Depends(get_jwt_handler)
) -> dict:
    """Extract and validate JWT token, return user claims."""
    
    try:
        token_data = jwt_handler.verify_token(credentials.credentials)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if it's an access token
        if token_data.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id = token_data.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return {
            "user_id": UUID(user_id),
            "email": token_data.get("email"),
            "roles": token_data.get("roles", []),
            "scope": token_data.get("scope", {})
        }
        
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


# Authorization helpers
async def require_admin(
    current_user: dict = Depends(get_current_user),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> dict:
    """Require admin role for the current user."""
    
    if not await rbac_service.is_admin(current_user["user_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required"
        )
    
    return current_user


async def require_manager_or_admin(
    current_user: dict = Depends(get_current_user),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service)
) -> dict:
    """Require manager or admin role for the current user."""
    
    user_id = current_user["user_id"]
    if not (await rbac_service.is_admin(user_id) or await rbac_service.is_manager(user_id)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin role required"
        )
    
    return current_user


# Request context for audit logging
async def get_request_context(request: Request) -> dict:
    """Extract request context for audit logging."""
    
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "endpoint": f"{request.method} {request.url.path}",
        "query_params": dict(request.query_params)
    }