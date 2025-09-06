from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SQLEnum, UUID, Integer, JSON, ForeignKey, DECIMAL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

Base = declarative_base()

class DepartmentModel(Base):
    __tablename__ = "departments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey('employees.id'), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    
    manager = relationship("EmployeeModel", foreign_keys=[manager_id], backref="managed_departments")
    
    __table_args__ = (
        {'extend_existing': True}
    )

class EmployeeModel(Base):
    __tablename__ = "employees"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True, unique=True, index=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False) 
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)  # Keep for backward compatibility
    department_id = Column(UUID(as_uuid=True), ForeignKey('departments.id'), nullable=True, index=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey('employees.id'), nullable=True, index=True)
    
    status = Column(
        SQLEnum('ACTIVE', 'INACTIVE', name='employment_status'), 
        nullable=False, 
        default='ACTIVE'
    )
    
    employment_status = Column(
        SQLEnum('ACTIVE', 'INACTIVE', name='employment_status'), 
        nullable=False, 
        default='ACTIVE'
    )
    
    verification_status = Column(
        SQLEnum(
            'NOT_SUBMITTED', 'PENDING_DETAILS_REVIEW', 'PENDING_DOCUMENTS_REVIEW',
            'PENDING_ROLE_ASSIGNMENT', 'PENDING_FINAL_APPROVAL', 'VERIFIED', 'REJECTED',
            name='verification_status'
        ),
        nullable=False,
        default='NOT_SUBMITTED',
        index=True
    )
    
    hired_at = Column(DateTime(timezone=True), nullable=True)
    deactivated_at = Column(DateTime(timezone=True), nullable=True)
    deactivation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    
    submitted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    details_reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    details_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    documents_reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    documents_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    role_assigned_by = Column(UUID(as_uuid=True), nullable=True)
    role_assigned_at = Column(DateTime(timezone=True), nullable=True)
    final_approved_by = Column(UUID(as_uuid=True), nullable=True)
    final_approved_at = Column(DateTime(timezone=True), nullable=True)

    
    rejection_reason = Column(Text, nullable=True)
    rejected_by = Column(UUID(as_uuid=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    
    manager = relationship("EmployeeModel", remote_side=[id], backref="direct_reports")
    department_ref = relationship("DepartmentModel", foreign_keys=[department_id], backref="employees")
    
    __table_args__ = (
        {'extend_existing': True}
    )

class RoleModel(Base):
    __tablename__ = "roles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(
        SQLEnum('ADMIN', 'MANAGER', 'EMPLOYEE', 'NEWCOMER', name='role_code'), 
        unique=True, 
        nullable=False
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(JSON, nullable=True)  
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

class RoleAssignmentModel(Base):
    __tablename__ = "role_assignments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey('roles.id', ondelete='CASCADE'), nullable=False)
    scope = Column(JSON, nullable=False, default={})
    assigned_by = Column(UUID(as_uuid=True), nullable=True)  
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by = Column(UUID(as_uuid=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    
    role = relationship("RoleModel", backref="assignments")
    
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
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    action = Column(String(50), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    changes = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)


class EmployeeDocumentModel(Base):
    __tablename__ = "employee_documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey('employees.id', ondelete='CASCADE'), nullable=False, index=True)
    document_type = Column(
        SQLEnum(
            'ID_CARD', 'PASSPORT', 'DRIVERS_LICENSE', 'BIRTH_CERTIFICATE',
            'EDUCATION_CERTIFICATE', 'EMPLOYMENT_CONTRACT', 'PREVIOUS_EMPLOYMENT_LETTER',
            'PROFESSIONAL_CERTIFICATION', 'OTHER',
            name='document_type'
        ), 
        nullable=False
    )
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    uploaded_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    reviewed_by = Column(UUID(as_uuid=True), nullable=True, index=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_status = Column(
        SQLEnum(
            'PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_REPLACEMENT',
            name='document_review_status'
        ),
        nullable=False,
        default='PENDING',
        index=True
    )
    review_notes = Column(Text, nullable=True)
    
    is_required = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, nullable=False, default=0)
    
    employee = relationship("EmployeeModel", foreign_keys=[employee_id], backref="documents")


class ApprovalStageModel(Base):
    __tablename__ = "approval_stages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey('employees.id', ondelete='CASCADE'), nullable=False, index=True)
    stage = Column(
        SQLEnum(
            'DETAILS_REVIEW', 'DOCUMENTS_REVIEW', 'ROLE_ASSIGNMENT', 'FINAL_APPROVAL',
            name='approval_stage'
        ),
        nullable=False
    )
    action = Column(
        SQLEnum(
            'APPROVED', 'REJECTED', 'ROLE_ASSIGNED', 'FINAL_APPROVED',
            name='approval_action'
        ),
        nullable=False
    )
    performed_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    performed_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    notes = Column(Text, nullable=True)
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    
    additional_data = Column(JSON, nullable=True)
    
    employee = relationship("EmployeeModel", backref="approval_stages")


class NotificationModel(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    type = Column(
        SQLEnum(
            'PROFILE_APPROVED', 'PROFILE_REJECTED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED',
            'STAGE_ADVANCED', 'FINAL_VERIFICATION', 'ACTION_REQUIRED',
            name='notification_type'
        ),
        nullable=False
    )
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)
    
    sent_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    
    email_sent = Column(Boolean, nullable=False, default=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)


# Task Management Models

class TaskModel(Base):
    __tablename__ = "tasks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(
        SQLEnum('PROJECT', 'TASK', 'SUBTASK', name='task_type_enum'),
        nullable=False,
        default='TASK'
    )
    priority = Column(
        SQLEnum('LOW', 'MEDIUM', 'HIGH', 'URGENT', name='priority_enum'),
        nullable=False,
        default='MEDIUM'
    )
    status = Column(
        SQLEnum(
            'DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 
            'IN_REVIEW', 'COMPLETED', 'CANCELLED', 
            name='task_status_enum'
        ),
        nullable=False,
        default='DRAFT'
    )
    
    # Relationships
    assignee_id = Column(UUID(as_uuid=True), ForeignKey('employees.id'), nullable=True, index=True)
    assigner_id = Column(UUID(as_uuid=True), ForeignKey('employees.id'), nullable=False, index=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey('departments.id'), nullable=True, index=True)
    parent_task_id = Column(UUID(as_uuid=True), ForeignKey('tasks.id'), nullable=True, index=True)
    
    # Progress & Effort
    progress_percentage = Column(Integer, default=0, nullable=False)
    estimated_hours = Column(DECIMAL(5,2), nullable=True)
    actual_hours = Column(DECIMAL(5,2), nullable=True)
    
    # Timeline
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    
    # Additional Data
    tags = Column(JSON, default=list, nullable=False)
    attachments = Column(JSON, default=list, nullable=False)
    review_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    approval_notes = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1)
    
    # Relationships
    assignee = relationship("EmployeeModel", foreign_keys=[assignee_id], backref="assigned_tasks")
    assigner = relationship("EmployeeModel", foreign_keys=[assigner_id], backref="created_tasks")
    department = relationship("DepartmentModel", backref="tasks")
    parent_task = relationship("TaskModel", remote_side=[id], backref="subtasks")
    
    __table_args__ = (
        {'extend_existing': True}
    )


class TaskCommentModel(Base):
    __tablename__ = "task_comments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey('tasks.id'), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey('employees.id'), nullable=False, index=True)
    comment = Column(Text, nullable=False)
    comment_type = Column(
        SQLEnum('COMMENT', 'STATUS_CHANGE', 'PROGRESS_UPDATE', 'REVIEW_NOTE', name='comment_type_enum'),
        default='COMMENT',
        nullable=False
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    
    # Relationships
    task = relationship("TaskModel", backref="comments")
    author = relationship("EmployeeModel", backref="task_comments")
    
    __table_args__ = (
        {'extend_existing': True}
    )


class TaskActivityModel(Base):
    __tablename__ = "task_activities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey('tasks.id'), nullable=False, index=True)
    performed_by = Column(UUID(as_uuid=True), ForeignKey('employees.id'), nullable=False, index=True)
    action = Column(
        SQLEnum(
            'CREATED', 'ASSIGNED', 'STARTED', 'UPDATED', 'SUBMITTED',
            'REVIEWED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMMENTED',
            name='task_action_enum'
        ),
        nullable=False
    )
    previous_status = Column(
        SQLEnum(
            'DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 
            'IN_REVIEW', 'COMPLETED', 'CANCELLED', 
            name='task_status_enum'
        ),
        nullable=True
    )
    new_status = Column(
        SQLEnum(
            'DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 
            'IN_REVIEW', 'COMPLETED', 'CANCELLED', 
            name='task_status_enum'
        ),
        nullable=True
    )
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    
    # Relationships
    task = relationship("TaskModel", backref="activities")
    performer = relationship("EmployeeModel", backref="task_activities")
    
    __table_args__ = (
        {'extend_existing': True}
    )