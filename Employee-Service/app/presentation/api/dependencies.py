from fastapi import Depends, HTTPException, logger, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
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
from app.infrastructure.database.repositories.department_repository import DepartmentRepository
from app.infrastructure.security.jwt_handler import JWTHandler
from app.infrastructure.security.permission_service import PermissionService, VerificationAwareMiddleware
from app.infrastructure.external.auth_service_client import auth_service_client
from app.domain.services import EmployeeDomainService, RoleBasedAccessControlService
from app.application.use_case.employee_use_cases import EmployeeUseCase
from app.application.use_case.role_use_cases import RoleUseCase
from app.application.use_case.admin_review_use_cases import AdminReviewUseCase
from app.application.use_case.document_use_cases import DocumentUseCase
from app.application.use_case.profile_use_cases import ProfileUseCase
from app.application.use_case.department_use_cases import DepartmentUseCase
from app.application.use_case.manager_task_use_cases import ManagerTaskUseCase
from app.application.use_case.employee_task_use_cases import EmployeeTaskUseCase
from app.application.use_case.task_comment_use_cases import TaskCommentUseCase
from app.infrastructure.database.repositories.task_repository import TaskRepository
from app.infrastructure.database.repositories.task_comment_repository import TaskCommentRepository
from app.infrastructure.database.repositories.task_activity_repository import TaskActivityRepository
from app.domain.task_workflow_service import TaskWorkflowService
from app.application.services.notification_service import NotificationService
from app.infrastructure.security.permission_service import AccessLevel, PermissionType

class CORSAwareHTTPBearer(HTTPBearer):
    """Custom HTTPBearer that allows OPTIONS requests without authentication."""
    
    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        # Skip authentication for OPTIONS (preflight) requests
        if request.method == "OPTIONS":
            return None
        
        # For all other requests, use standard HTTPBearer authentication
        return await super().__call__(request)

security = CORSAwareHTTPBearer()

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

def get_department_repository(session: AsyncSession = Depends(get_db_session)) -> DepartmentRepository:
    return DepartmentRepository(session)

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
    event_repository: EventRepository = Depends(get_event_repository),
    notification_service: NotificationService = Depends(get_notification_service)
) -> DocumentUseCase:
    return DocumentUseCase(
        document_repository=document_repository,
        employee_repository=employee_repository,
        event_repository=event_repository,
        auth_service_client=auth_service_client,
        notification_service=notification_service
    )

def get_admin_review_use_case(
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    document_repository: DocumentRepository = Depends(get_document_repository),
    role_repository: RoleRepository = Depends(get_role_repository),
    event_repository: EventRepository = Depends(get_event_repository),
    rbac_service: RoleBasedAccessControlService = Depends(get_rbac_service),
    notification_service: NotificationService = Depends(get_notification_service)
) -> AdminReviewUseCase:
    from app.core.entities.employee import VerificationStatus
    return AdminReviewUseCase(
        employee_repository=employee_repository,
        document_repository=document_repository,
        role_repository=role_repository,
        event_repository=event_repository,
        rbac_service=rbac_service,
        verification_status=VerificationStatus.PENDING_DETAILS_REVIEW,  # Default status for reviews
        auth_service_client=auth_service_client,
        notification_service=notification_service
    )

def get_department_use_case(
    department_repository: DepartmentRepository = Depends(get_department_repository),
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    role_repository: RoleRepository = Depends(get_role_repository),
    event_repository: EventRepository = Depends(get_event_repository)
) -> DepartmentUseCase:
    return DepartmentUseCase(
        department_repository=department_repository,
        employee_repository=employee_repository,
        role_repository=role_repository,
        event_repository=event_repository
    )

def get_verification_middleware(
    permission_service: PermissionService = Depends(get_permission_service)
) -> VerificationAwareMiddleware:
    return VerificationAwareMiddleware(permission_service)

# Task Management Dependencies

def get_task_repository(session: AsyncSession = Depends(get_db_session)) -> TaskRepository:
    return TaskRepository(session)

def get_task_comment_repository(session: AsyncSession = Depends(get_db_session)) -> TaskCommentRepository:
    return TaskCommentRepository(session)

def get_task_activity_repository(session: AsyncSession = Depends(get_db_session)) -> TaskActivityRepository:
    return TaskActivityRepository(session)

def get_task_workflow_service(
    task_repository: TaskRepository = Depends(get_task_repository),
    task_activity_repository: TaskActivityRepository = Depends(get_task_activity_repository)
) -> TaskWorkflowService:
    return TaskWorkflowService(
        task_repository=task_repository,
        activity_repository=task_activity_repository
    )

def get_manager_task_use_case(
    task_repository: TaskRepository = Depends(get_task_repository),
    task_activity_repository: TaskActivityRepository = Depends(get_task_activity_repository),
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    department_repository: DepartmentRepository = Depends(get_department_repository),
    task_workflow_service: TaskWorkflowService = Depends(get_task_workflow_service)
) -> ManagerTaskUseCase:
    return ManagerTaskUseCase(
        task_repository=task_repository,
        activity_repository=task_activity_repository,
        employee_repository=employee_repository,
        department_repository=department_repository,
        workflow_service=task_workflow_service
    )

def get_employee_task_use_case(
    task_repository: TaskRepository = Depends(get_task_repository),
    task_activity_repository: TaskActivityRepository = Depends(get_task_activity_repository),
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    task_workflow_service: TaskWorkflowService = Depends(get_task_workflow_service)
) -> EmployeeTaskUseCase:
    return EmployeeTaskUseCase(
        task_repository=task_repository,
        activity_repository=task_activity_repository,
        employee_repository=employee_repository,
        workflow_service=task_workflow_service
    )

def get_task_comment_use_case(
    task_repository: TaskRepository = Depends(get_task_repository),
    task_comment_repository: TaskCommentRepository = Depends(get_task_comment_repository),
    task_activity_repository: TaskActivityRepository = Depends(get_task_activity_repository),
    employee_repository: EmployeeRepository = Depends(get_employee_repository),
    task_workflow_service: TaskWorkflowService = Depends(get_task_workflow_service)
) -> TaskCommentUseCase:
    return TaskCommentUseCase(
        task_repository=task_repository,
        comment_repository=task_comment_repository,
        activity_repository=task_activity_repository,
        employee_repository=employee_repository,
        workflow_service=task_workflow_service
    )

def get_notification_service(
    employee_repository: EmployeeRepository = Depends(get_employee_repository)
) -> NotificationService:
    return NotificationService(employee_repository)

async def get_current_user_claims_with_cors(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    jwt_handler: JWTHandler = Depends(get_jwt_handler)
) -> UserClaims:
    """CORS-aware JWT token validation that skips authentication for OPTIONS requests."""
    
    # Skip authentication for OPTIONS (preflight) requests
    if request.method == "OPTIONS" or credentials is None:
        # Return a mock UserClaims for OPTIONS requests - they won't be processed anyway
        from uuid import uuid4
        return UserClaims(
            user_id=uuid4(),
            email="options@preflight.com",
            employee_profile_status="NOT_STARTED",
            roles=[]
        )
    
    # For all other requests, proceed with normal authentication
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

        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "INVALID_TOKEN_CLAIMS",
                    "message": f"Token validation failed: {', '.join(validation_errors)}",
                    "missing_claims": validation_errors
                },
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        try:
            user_id = UUID(token_data["sub"])
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": "INVALID_USER_ID_FORMAT",
                    "message": "User ID in token is not a valid UUID"
                },
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        employee_profile_status = token_data.get("employee_profile_status", "NOT_STARTED")
        
        # Fetch roles from database since they're not in JWT token
        roles = []
        try:
            from app.infrastructure.database.connections import db_connection
            async with db_connection.async_session() as session:
                from app.infrastructure.database.repositories.role_repository import RoleRepository
                role_repo = RoleRepository(session)
                user_role_assignments = await role_repo.get_user_roles(user_id)
                
                # Get actual Role entities for each assignment
                for assignment in user_role_assignments:
                    role = await role_repo.get_role_by_id(assignment.role_id)
                    if role:
                        roles.append({"code": role.code.value, "name": role.name, "id": str(role.id)})
        except Exception as e:
            print(f"⚠️ Warning: Could not fetch user roles: {e}")
            roles = []
        
        user_claims = UserClaims(
            user_id=user_id,
            email=token_data["email"],
            employee_profile_status=employee_profile_status,
            token_type=token_data.get("token_type", "access"),
            roles=roles,
            issued_at=token_data.get("issued_at"),
            expires_at=token_data.get("expires_at"),
            audience=token_data.get("audience"),
            issuer=token_data.get("issuer"),
            raw_payload=token_data.get("raw_payload")
        )
        
        return user_claims
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected JWT validation error: {e}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "AUTHENTICATION_SERVICE_ERROR",
                "message": "Authentication service temporarily unavailable",
                "hint": "Please try again in a few moments"
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

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
            user_id = UUID(token_data["sub"])
            
            # Fetch roles from database since they're not in JWT token
            roles = []
            try:
                from app.infrastructure.database.connections import db_connection
                async with db_connection.async_session() as session:
                    from app.infrastructure.database.repositories.role_repository import RoleRepository
                    role_repo = RoleRepository(session)
                    user_role_assignments = await role_repo.get_user_roles(user_id)
                    
                    # Get actual Role entities for each assignment
                    for assignment in user_role_assignments:
                        role = await role_repo.get_role_by_id(assignment.role_id)
                        if role:
                            roles.append({"code": role.code.value, "name": role.name, "id": str(role.id)})
            except Exception as e:
                print(f"⚠️ Warning: Could not fetch user roles: {e}")
                roles = []
            
            user_claims = UserClaims(
                user_id=user_id,
                email=token_data["email"],
                employee_profile_status=token_data.get("employee_profile_status"),
                token_type=token_data.get("type", "access"),
                roles=roles,
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

async def require_newcomer_access_with_cors(
    request: Request,
    user_claims: UserClaims = Depends(get_current_user_claims_with_cors),
    middleware: VerificationAwareMiddleware = Depends(get_verification_middleware)
) -> UserClaims:
    """CORS-aware newcomer access requirement."""
    
    # Skip processing for OPTIONS requests
    if request.method == "OPTIONS":
        return user_claims
    
    return await middleware.verify_access_level(
        user_claims, [AccessLevel.NEWCOMER, AccessLevel.VERIFIED, AccessLevel.ADMIN]
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

async def allow_newcomer_access_with_cors(
    request: Request,
    user_claims: UserClaims = Depends(get_current_user_claims_with_cors)
) -> UserClaims:
    """CORS-aware access control for newcomers and verified users."""
    
    # Skip processing for OPTIONS requests
    if request.method == "OPTIONS":
        return user_claims
    
    # This is permissive - allows all authenticated users
    # but provides the claims for further permission checking
    return user_claims

async def allow_newcomer_access(
    user_claims: UserClaims = Depends(get_current_user_claims)
) -> UserClaims:
    """Allow access for newcomers and verified users (no permission error)."""
    
    # This is permissive - allows all authenticated users
    # but provides the claims for further permission checking
    return user_claims