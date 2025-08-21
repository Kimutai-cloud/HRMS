from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, delete, text, desc, asc
import json

from app.infrastructure.database.models import AuditLogModel


class AuditLevel(Enum):
    """Audit logging levels."""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ActionCategory(Enum):
    """Categories of auditable actions."""
    USER_AUTH = "user_auth"
    PROFILE_MANAGEMENT = "profile_management"
    DOCUMENT_MANAGEMENT = "document_management"
    ADMIN_REVIEW = "admin_review"
    SYSTEM_OPERATION = "system_operation"
    BULK_OPERATION = "bulk_operation"
    NOTIFICATION = "notification"
    REPORTING = "reporting"
    SECURITY = "security"


@dataclass
class AuditContext:
    """Context information for audit logging."""
    user_id: Optional[UUID] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    request_id: Optional[str] = None
    correlation_id: Optional[str] = None
    additional_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PerformanceMetrics:
    """Performance metrics for audit logging."""
    execution_time_ms: Optional[float] = None
    memory_usage_mb: Optional[float] = None
    cpu_usage_percent: Optional[float] = None
    database_queries: Optional[int] = None
    api_calls: Optional[int] = None


class AuditRepository:
    """Enhanced repository for comprehensive audit logging."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def log_comprehensive_action(
        self,
        entity_type: str,
        entity_id: UUID,
        action: str,
        category: ActionCategory,
        level: AuditLevel,
        context: AuditContext,
        changes: Optional[Dict[str, Any]] = None,
        performance_metrics: Optional[PerformanceMetrics] = None,
        error_details: Optional[Dict[str, Any]] = None
    ) -> UUID:
        """Log a comprehensive audit action with full context."""
        
        audit_data = {
            "category": category.value,
            "level": level.value,
            "context": {
                "session_id": context.session_id,
                "endpoint": context.endpoint,
                "method": context.method,
                "request_id": context.request_id,
                "correlation_id": context.correlation_id,
                "additional_data": context.additional_data
            },
            "changes": changes or {},
            "error_details": error_details,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Add performance metrics if provided
        if performance_metrics:
            audit_data["performance"] = {
                "execution_time_ms": performance_metrics.execution_time_ms,
                "memory_usage_mb": performance_metrics.memory_usage_mb,
                "cpu_usage_percent": performance_metrics.cpu_usage_percent,
                "database_queries": performance_metrics.database_queries,
                "api_calls": performance_metrics.api_calls
            }
        
        audit_log = AuditLogModel(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user_id=context.user_id,
            changes=audit_data,
            ip_address=context.ip_address,
            user_agent=context.user_agent
        )
        
        self.session.add(audit_log)
        await self.session.commit()
        await self.session.refresh(audit_log)
        
        return audit_log.id
    
    async def log_user_action(
        self,
        user_id: UUID,
        action: str,
        details: Dict[str, Any],
        context: AuditContext,
        success: bool = True
    ) -> UUID:
        """Log user-specific actions."""
        
        return await self.log_comprehensive_action(
            entity_type="user",
            entity_id=user_id,
            action=action,
            category=ActionCategory.USER_AUTH if "login" in action.lower() or "auth" in action.lower() else ActionCategory.PROFILE_MANAGEMENT,
            level=AuditLevel.INFO if success else AuditLevel.WARNING,
            context=context,
            changes=details,
            error_details=None if success else {"action_failed": True, "details": details}
        )
    
    async def log_admin_action(
        self,
        admin_id: UUID,
        action: str,
        entity_type: str,
        entity_id: UUID,
        changes: Dict[str, Any],
        context: AuditContext,
        reasoning: Optional[str] = None
    ) -> UUID:
        """Log admin review and management actions."""
        
        admin_data = {
            "admin_reasoning": reasoning,
            "action_details": changes,
            "review_decision": action,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return await self.log_comprehensive_action(
            entity_type=entity_type,
            entity_id=entity_id,
            action=f"admin_{action}",
            category=ActionCategory.ADMIN_REVIEW,
            level=AuditLevel.INFO,
            context=context,
            changes=admin_data
        )
    
    async def log_bulk_operation(
        self,
        admin_id: UUID,
        operation_type: str,
        affected_entities: List[UUID],
        operation_details: Dict[str, Any],
        context: AuditContext,
        results: Dict[str, int]
    ) -> UUID:
        """Log bulk operations with detailed results."""
        
        bulk_data = {
            "operation_type": operation_type,
            "affected_count": len(affected_entities),
            "affected_entities": [str(eid) for eid in affected_entities],
            "operation_details": operation_details,
            "results": results,
            "success_rate": (results.get("successful", 0) / len(affected_entities)) * 100 if affected_entities else 0
        }
        
        return await self.log_comprehensive_action(
            entity_type="bulk_operation",
            entity_id=uuid4(),
            action=f"bulk_{operation_type}",
            category=ActionCategory.BULK_OPERATION,
            level=AuditLevel.INFO,
            context=context,
            changes=bulk_data
        )
    
    async def log_system_event(
        self,
        event_type: str,
        description: str,
        details: Dict[str, Any],
        level: AuditLevel = AuditLevel.INFO,
        performance_metrics: Optional[PerformanceMetrics] = None
    ) -> UUID:
        """Log system-level events and operations."""
        
        system_context = AuditContext(
            correlation_id=str(uuid4()),
            additional_data={"system_event": True, "description": description}
        )
        
        return await self.log_comprehensive_action(
            entity_type="system",
            entity_id=uuid4(),
            action=event_type,
            category=ActionCategory.SYSTEM_OPERATION,
            level=level,
            context=system_context,
            changes=details,
            performance_metrics=performance_metrics
        )
    
    async def log_security_event(
        self,
        event_type: str,
        user_id: Optional[UUID],
        details: Dict[str, Any],
        context: AuditContext,
        severity: AuditLevel = AuditLevel.WARNING
    ) -> UUID:
        """Log security-related events."""
        
        security_data = {
            "security_event": True,
            "event_type": event_type,
            "details": details,
            "risk_level": severity.value,
            "requires_review": severity in [AuditLevel.ERROR, AuditLevel.CRITICAL]
        }
        
        return await self.log_comprehensive_action(
            entity_type="security_event",
            entity_id=user_id or uuid4(),
            action=f"security_{event_type}",
            category=ActionCategory.SECURITY,
            level=severity,
            context=context,
            changes=security_data
        )
    
    async def log_performance_threshold_breach(
        self,
        threshold_type: str,
        current_value: float,
        threshold_value: float,
        context: AuditContext,
        metrics: PerformanceMetrics
    ) -> UUID:
        """Log performance threshold breaches."""
        
        breach_data = {
            "threshold_type": threshold_type,
            "current_value": current_value,
            "threshold_value": threshold_value,
            "breach_percentage": ((current_value - threshold_value) / threshold_value) * 100,
            "breach_detected_at": datetime.utcnow().isoformat()
        }
        
        return await self.log_comprehensive_action(
            entity_type="performance_threshold",
            entity_id=uuid4(),
            action="threshold_breach",
            category=ActionCategory.SYSTEM_OPERATION,
            level=AuditLevel.WARNING,
            context=context,
            changes=breach_data,
            performance_metrics=metrics
        )
    
    # Legacy method for backward compatibility
    async def log_action(
        self,
        entity_type: str,
        entity_id: UUID,
        action: str,
        user_id: UUID,
        changes: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> UUID:
        """Legacy log action method for backward compatibility."""
        
        context = AuditContext(
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return await self.log_comprehensive_action(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            category=ActionCategory.SYSTEM_OPERATION,
            level=AuditLevel.INFO,
            context=context,
            changes=changes
        )
    
    async def get_entity_audit_trail(
        self,
        entity_type: str,
        entity_id: UUID,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get audit trail for a specific entity."""
        
        result = await self.session.execute(
            select(AuditLogModel)
            .where(
                and_(
                    AuditLogModel.entity_type == entity_type,
                    AuditLogModel.entity_id == entity_id
                )
            )
            .order_by(AuditLogModel.timestamp.desc())
            .limit(limit)
        )
        
        audit_logs = result.scalars().all()
        
        return [
            {
                "id": log.id,
                "action": log.action,
                "user_id": log.user_id,
                "changes": log.changes,
                "timestamp": log.timestamp,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent
            }
            for log in audit_logs
        ]
    
    async def get_user_actions(
        self,
        user_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get actions performed by a specific user."""
        
        conditions = [AuditLogModel.user_id == user_id]
        
        if start_date:
            conditions.append(AuditLogModel.timestamp >= start_date)
        
        if end_date:
            conditions.append(AuditLogModel.timestamp <= end_date)
        
        result = await self.session.execute(
            select(AuditLogModel)
            .where(and_(*conditions))
            .order_by(AuditLogModel.timestamp.desc())
            .limit(limit)
        )
        
        audit_logs = result.scalars().all()
        
        return [
            {
                "id": log.id,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "action": log.action,
                "changes": log.changes,
                "timestamp": log.timestamp,
                "ip_address": log.ip_address
            }
            for log in audit_logs
        ]
    
    async def cleanup_old_logs(self, older_than_days: int = 365) -> int:
        """Clean up audit logs older than specified days."""
        
        cutoff_date = datetime.utcnow() - timedelta(days=older_than_days)
        
        result = await self.session.execute(
            select(func.count(AuditLogModel.id))
            .where(AuditLogModel.timestamp < cutoff_date)
        )
        count = result.scalar()
        
        if count > 0:
            await self.session.execute(
                delete(AuditLogModel)
                .where(AuditLogModel.timestamp < cutoff_date)
            )
            await self.session.commit()
        
        return count