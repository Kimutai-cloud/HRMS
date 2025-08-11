from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SQLEnum, UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class UserModel(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    auth_provider = Column(SQLEnum('email', 'google', name='auth_provider'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TokenModel(Base):
    __tablename__ = "tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    token = Column(Text, nullable=False, unique=True)
    token_type = Column(SQLEnum('access', 'refresh', 'email_verification', 'password_reset', name='token_type'), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
