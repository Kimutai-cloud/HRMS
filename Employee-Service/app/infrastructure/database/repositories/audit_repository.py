from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func

from app.infrastructure.database.models import AuditLogModel


class AuditRepository:
    """Repository for audit logging."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
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
        """Log an action for audit purposes."""
        
        audit_log = AuditLogModel(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user_id=user_id,
            changes=changes or {},
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        self.session.add(audit_log)
        await self.session.commit()
        await self.session.refresh(audit_log)
        
        return audit_log.id
    
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