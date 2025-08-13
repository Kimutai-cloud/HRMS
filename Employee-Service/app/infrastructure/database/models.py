from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SQLEnum, UUID, Integer, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

Base = declarative_base()


class EmployeeModel(Base):
    __tablename__ = "employees"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False) 
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey('employees.id'), nullable=True, index=True)
    status = Column(SQLEnum('ACTIVE', 'INACTIVE', name='employment_status'), nullable=False, default='ACTIVE')
    hired_at = Column(DateTime(timezone=True), nullable=True)
    deactivated_at = Column(DateTime(timezone=True), nullable=True)
    deactivation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    
    # Relationships
    manager = relationship("EmployeeModel", remote_side=[id], backref="direct_reports")
    
    # Indexes for common queries
    __table_args__ = (
        # Index for manager queries
        {'extend_existing': True}
    )


class RoleModel(Base):
    __tablename__ = "roles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(SQLEnum('ADMIN', 'MANAGER', 'EMPLOYEE', name='role_code'), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RoleAssignmentModel(Base):
    __tablename__ = "role_assignments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # From Auth Service
    role_id = Column(UUID(as_uuid=True), ForeignKey('roles.id', ondelete='CASCADE'), nullable=False)
    scope = Column(JSON, nullable=False, default={})  # JSONB for future scope like department, project
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    role = relationship("RoleModel", backref="assignments")
    
    # Unique constraint
    __table_args__ = (
        {'extend_existing': True}
    )


class DomainEventModel(Base):
    __tablename__ = "domain_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(255), nullable=False, index=True)
    aggregate_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    data = Column(JSON, nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    published = Column(Boolean, nullable=False, default=False, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AuditLogModel(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(100), nullable=False, index=True)  # employee, role_assignment
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # CREATE, UPDATE, DELETE, DEACTIVATE
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # Who performed the action
    changes = Column(JSON, nullable=True)  # What changed
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6
    user_agent = Column(Text, nullable=True)
