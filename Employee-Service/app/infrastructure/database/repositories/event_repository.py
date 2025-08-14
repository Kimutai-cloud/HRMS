from typing import List
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func, text, case, cast, asc, desc, null, not_

from app.core.entities.events import DomainEvent
from app.core.interfaces.repositories import EventRepositoryInterface
from app.infrastructure.database.models import DomainEventModel


class EventRepository(EventRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def save_event(self, event: DomainEvent) -> DomainEvent:
        db_event = DomainEventModel(
            id=event.id,
            event_type=event.event_type,
            aggregate_id=event.aggregate_id,
            data=event.data,
            occurred_at=event.occurred_at,
            version=event.version,
            published=False
        )
        
        self.session.add(db_event)
        await self.session.commit()
        await self.session.refresh(db_event)
        
        return self._to_entity(db_event)
    
    async def get_unpublished_events(self, limit: int = 100) -> List[DomainEvent]:
        result = await self.session.execute(
            select(DomainEventModel)
            .where(DomainEventModel.published == False)
            .order_by(DomainEventModel.occurred_at)
            .limit(limit)
        )
        db_events = result.scalars().all()
        return [self._to_entity(event) for event in db_events]
    
    async def mark_event_published(self, event_id: UUID) -> bool:
        result = await self.session.execute(
            update(DomainEventModel)
            .where(DomainEventModel.id == event_id)
            .values(published=True, published_at=datetime.utcnow())
        )
        await self.session.commit()
        return result.rowcount > 0
    
    async def cleanup_published_events(self, older_than_days: int = 7) -> int:
        cutoff_date = datetime.utcnow() - timedelta(days=older_than_days)
        
        result = await self.session.execute(
            delete(DomainEventModel)
            .where(
                and_(
                    DomainEventModel.published == True,
                    DomainEventModel.published_at < cutoff_date
                )
            )
        )
        await self.session.commit()
        return result.rowcount
    
    def _to_entity(self, db_event: DomainEventModel) -> DomainEvent:
        return DomainEvent(
            id=db_event.id,
            event_type=db_event.event_type,
            aggregate_id=db_event.aggregate_id,
            data=db_event.data,
            occurred_at=db_event.occurred_at,
            version=db_event.version
        )
