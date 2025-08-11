from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.config.settings import settings


class DatabaseConnection:
    def __init__(self):
        self.engine = create_async_engine(
            settings.DATABASE_URL,
            poolclass=NullPool,
            echo=settings.DEBUG
        )
        self.async_session = sessionmaker(
            self.engine, 
            class_=AsyncSession, 
            expire_on_commit=False
        )
    
    async def get_session(self) -> AsyncSession:
        async with self.async_session() as session:
            yield session
    
    async def close(self):
        await self.engine.dispose()


db_connection = DatabaseConnection()
