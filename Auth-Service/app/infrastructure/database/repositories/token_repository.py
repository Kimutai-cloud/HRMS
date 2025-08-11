from typing import Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.core.entities.token import Token, TokenType
from app.core.interfaces.repositories import TokenRepositoryInterface
from app.infrastructure.database.models import TokenModel


class TokenRepository(TokenRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, token: Token) -> Token:
        db_token = TokenModel(
            id=token.id,
            user_id=token.user_id,
            token=token.token,
            token_type=token.token_type.value,
            expires_at=token.expires_at,
            is_revoked=token.is_revoked,
            user_agent=token.user_agent,
            created_at=token.created_at
        )
        
        self.session.add(db_token)
        await self.session.commit()
        await self.session.refresh(db_token)
        return self._to_entity(db_token)
    
    async def get_by_token(self, token: str) -> Optional[Token]:
        result = await self.session.execute(
            select(TokenModel).where(TokenModel.token == token)
        )
        db_token = result.scalar_one_or_none()
        return self._to_entity(db_token) if db_token else None
    
    async def get_user_tokens(self, user_id: UUID, token_type: str) -> List[Token]:
        result = await self.session.execute(
            select(TokenModel).where(
                TokenModel.user_id == user_id,
                TokenModel.token_type == token_type
            )
        )
        db_tokens = result.scalars().all()
        return [self._to_entity(db_token) for db_token in db_tokens]
    
    async def revoke_token(self, token: str) -> bool:
        result = await self.session.execute(
            update(TokenModel)
            .where(TokenModel.token == token)
            .values(is_revoked=True)
        )
        await self.session.commit()
        return result.rowcount > 0
    
    async def revoke_user_tokens(self, user_id: UUID, token_type: str) -> bool:
        result = await self.session.execute(
            update(TokenModel)
            .where(
                TokenModel.user_id == user_id,
                TokenModel.token_type == token_type
            )
            .values(is_revoked=True)
        )
        await self.session.commit()
        return result.rowcount > 0
    
    async def cleanup_expired_tokens(self) -> int:
        result = await self.session.execute(
            delete(TokenModel)
            .where(TokenModel.expires_at < datetime.utcnow())
        )
        await self.session.commit()
        return result.rowcount
    
    def _to_entity(self, db_token: TokenModel) -> Token:
        return Token(
            id=db_token.id,
            user_id=db_token.user_id,
            token=db_token.token,
            token_type=TokenType(db_token.token_type),
            expires_at=db_token.expires_at,
            is_revoked=db_token.is_revoked,
            user_agent=db_token.user_agent,
            created_at=db_token.created_at
        )
