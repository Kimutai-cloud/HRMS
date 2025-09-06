from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.entities.role import Role, RoleAssignment, RoleCode
from app.core.interfaces.repositories import RoleRepositoryInterface
from app.core.exceptions.role_exceptions import RoleAlreadyAssignedException
from app.infrastructure.database.models import RoleModel, RoleAssignmentModel


class RoleRepository(RoleRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_role(self, role: Role) -> Role:
        """Create a new role."""
        db_role = RoleModel(
            id=role.id,
            code=role.code.value,
            name=role.name,
            description=role.description,
            permissions=role.permissions
        )
        
        try:
            self.session.add(db_role)
            await self.session.commit()
            await self.session.refresh(db_role)
            return self._role_to_entity(db_role)
        except IntegrityError:
            await self.session.rollback()
            raise ValueError(f"Role with code {role.code} already exists")
    
    async def get_role_by_id(self, role_id: UUID) -> Optional[Role]:
        """Get role by ID."""
        result = await self.session.execute(
            select(RoleModel).where(RoleModel.id == role_id)
        )
        db_role = result.scalar_one_or_none()
        return self._role_to_entity(db_role) if db_role else None
    
    async def get_role_by_code(self, code: RoleCode) -> Optional[Role]:
        """Get role by code."""
        result = await self.session.execute(
            select(RoleModel).where(RoleModel.code == code.value)
        )
        db_role = result.scalar_one_or_none()
        return self._role_to_entity(db_role) if db_role else None
    
    async def list_roles(self) -> List[Role]:
        """List all active roles."""
        result = await self.session.execute(
            select(RoleModel)
            .where(RoleModel.is_active == True)
            .order_by(RoleModel.name)
        )
        db_roles = result.scalars().all()
        return [self._role_to_entity(role) for role in db_roles]
    
    async def assign_role(self, assignment: RoleAssignment) -> RoleAssignment:
        """Assign role to user with enhanced tracking."""
        
        existing = await self.get_role_assignment(assignment.user_id, assignment.role_id)
        if existing and existing.is_active:
            raise RoleAlreadyAssignedException("Role already assigned to user")
        
        db_assignment = RoleAssignmentModel(
            id=assignment.id,
            user_id=assignment.user_id,
            role_id=assignment.role_id,
            scope=assignment.scope,
            assigned_by=getattr(assignment, 'assigned_by', None),
            created_at=assignment.created_at,
            is_active=True
        )
        
        try:
            self.session.add(db_assignment)
            await self.session.commit()
            await self.session.refresh(db_assignment)
            return self._assignment_to_entity(db_assignment)
        except IntegrityError:
            await self.session.rollback()
            raise RoleAlreadyAssignedException("Role assignment constraint violation")
    
    async def revoke_role(self, user_id: UUID, role_id: UUID) -> bool:
        """Revoke role from user (soft delete)."""
        
        result = await self.session.execute(
            select(RoleAssignmentModel)
            .where(
                and_(
                    RoleAssignmentModel.user_id == user_id,
                    RoleAssignmentModel.role_id == role_id,
                    RoleAssignmentModel.is_active == True
                )
            )
        )
        db_assignment = result.scalar_one_or_none()
        
        if not db_assignment:
            return False
        
        db_assignment.is_active = False
        db_assignment.revoked_at = datetime.now(timezone.utc)
        
        await self.session.commit()
        return True
    
    async def get_user_roles(self, user_id: UUID) -> List[RoleAssignment]:
        """Get all active role assignments for a user."""
        result = await self.session.execute(
            select(RoleAssignmentModel)
            .options(selectinload(RoleAssignmentModel.role))
            .where(
                and_(
                    RoleAssignmentModel.user_id == user_id,
                    RoleAssignmentModel.is_active == True
                )
            )
            .order_by(RoleAssignmentModel.created_at)
        )
        db_assignments = result.scalars().all()
        return [self._assignment_to_entity(assignment) for assignment in db_assignments]
    
    async def get_role_assignment(self, user_id: UUID, role_id: UUID) -> Optional[RoleAssignment]:
        """Get specific role assignment (active or inactive)."""
        result = await self.session.execute(
            select(RoleAssignmentModel)
            .where(
                and_(
                    RoleAssignmentModel.user_id == user_id,
                    RoleAssignmentModel.role_id == role_id
                )
            )
            .order_by(RoleAssignmentModel.created_at.desc()) 
        )
        db_assignment = result.scalar_one_or_none()
        return self._assignment_to_entity(db_assignment) if db_assignment else None
    
    async def has_role(self, user_id: UUID, role_code: RoleCode) -> bool:
        """Check if user has specific active role."""
        result = await self.session.execute(
            select(RoleAssignmentModel)
            .join(RoleModel)
            .where(
                and_(
                    RoleAssignmentModel.user_id == user_id,
                    RoleModel.code == role_code.value,
                    RoleAssignmentModel.is_active == True
                )
            )
        )
        return result.scalar_one_or_none() is not None
    
    async def get_users_with_role(self, role_code: RoleCode) -> List[UUID]:
        """Get all users with a specific role."""
        result = await self.session.execute(
            select(RoleAssignmentModel.user_id)
            .join(RoleModel)
            .where(
                and_(
                    RoleModel.code == role_code.value,
                    RoleAssignmentModel.is_active == True
                )
            )
        )
        return [row[0] for row in result.fetchall()]
    
    async def revoke_all_user_roles(self, user_id: UUID, revoked_by: Optional[UUID] = None) -> int:
        """Revoke all active roles for a user."""
        result = await self.session.execute(
            update(RoleAssignmentModel)
            .where(
                and_(
                    RoleAssignmentModel.user_id == user_id,
                    RoleAssignmentModel.is_active == True
                )
            )
            .values(
                is_active=False,
                revoked_at=datetime.now(timezone.utc),
                revoked_by=revoked_by
            )
        )
        await self.session.commit()
        return result.rowcount
    
    async def transfer_role(
        self, 
        from_user_id: UUID, 
        to_user_id: UUID, 
        role_code: RoleCode,
        transferred_by: UUID
    ) -> bool:
        """Transfer role from one user to another."""
        
        role = await self.get_role_by_code(role_code)
        if not role:
            return False
        
        revoke_success = await self.revoke_role(from_user_id, role.id)
        if not revoke_success:
            return False
        
        try:
            from app.core.entities.role import RoleAssignment
            from uuid import uuid4
            
            new_assignment = RoleAssignment(
                id=uuid4(),
                user_id=to_user_id,
                role_id=role.id,
                scope={},
                created_at=datetime.now(timezone.utc)
            )
            
            await self.assign_role(new_assignment)
            return True
            
        except Exception:
            # If assignment fails, we could restore the original assignment
            # For now, just return False
            return False
    
    def _role_to_entity(self, db_role: RoleModel) -> Role:
        """Convert database model to entity."""
        return Role(
            id=db_role.id,
            code=RoleCode(db_role.code),
            name=db_role.name,
            description=db_role.description,
            permissions=db_role.permissions
        )
    
    def _assignment_to_entity(self, db_assignment: RoleAssignmentModel) -> RoleAssignment:
        """Convert database model to entity."""
        assignment = RoleAssignment(
            id=db_assignment.id,
            user_id=db_assignment.user_id,
            role_id=db_assignment.role_id,
            scope=db_assignment.scope,
            created_at=db_assignment.created_at
        )
        
        if hasattr(db_assignment, 'assigned_by'):
            assignment.assigned_by = db_assignment.assigned_by
        if hasattr(db_assignment, 'is_active'):
            assignment.is_active = db_assignment.is_active
        
        return assignment