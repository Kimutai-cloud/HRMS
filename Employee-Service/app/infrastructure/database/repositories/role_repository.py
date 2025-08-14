from typing import Optional, List
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_, func, text, case, cast, asc, desc, null, not_
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
        db_role = RoleModel(
            id=role.id,
            code=role.code.value,
            name=role.name,
            description=role.description
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
        result = await self.session.execute(
            select(RoleModel).where(RoleModel.id == role_id)
        )
        db_role = result.scalar_one_or_none()
        return self._role_to_entity(db_role) if db_role else None
    
    async def get_role_by_code(self, code: RoleCode) -> Optional[Role]:
        result = await self.session.execute(
            select(RoleModel).where(RoleModel.code == code.value)
        )
        db_role = result.scalar_one_or_none()
        return self._role_to_entity(db_role) if db_role else None
    
    async def list_roles(self) -> List[Role]:
        result = await self.session.execute(
            select(RoleModel).order_by(RoleModel.name)
        )
        db_roles = result.scalars().all()
        return [self._role_to_entity(role) for role in db_roles]
    
    async def assign_role(self, assignment: RoleAssignment) -> RoleAssignment:
        db_assignment = RoleAssignmentModel(
            id=assignment.id,
            user_id=assignment.user_id,
            role_id=assignment.role_id,
            scope=assignment.scope,
            created_at=assignment.created_at
        )
        
        try:
            self.session.add(db_assignment)
            await self.session.commit()
            await self.session.refresh(db_assignment)
            return self._assignment_to_entity(db_assignment)
        except IntegrityError:
            await self.session.rollback()
            raise RoleAlreadyAssignedException("Role already assigned to user")
    
    async def revoke_role(self, assignment_id: UUID) -> bool:
        result = await self.session.execute(
            delete(RoleAssignmentModel).where(RoleAssignmentModel.id == assignment_id)
        )
        await self.session.commit()
        return result.rowcount > 0
    
    async def get_user_roles(self, user_id: UUID) -> List[RoleAssignment]:
        result = await self.session.execute(
            select(RoleAssignmentModel)
            .options(selectinload(RoleAssignmentModel.role))
            .where(RoleAssignmentModel.user_id == user_id)
            .order_by(RoleAssignmentModel.created_at)
        )
        db_assignments = result.scalars().all()
        return [self._assignment_to_entity(assignment) for assignment in db_assignments]
    
    async def get_role_assignment(self, user_id: UUID, role_id: UUID) -> Optional[RoleAssignment]:
        result = await self.session.execute(
            select(RoleAssignmentModel)
            .where(
                and_(
                    RoleAssignmentModel.user_id == user_id,
                    RoleAssignmentModel.role_id == role_id
                )
            )
        )
        db_assignment = result.scalar_one_or_none()
        return self._assignment_to_entity(db_assignment) if db_assignment else None
    
    async def has_role(self, user_id: UUID, role_code: RoleCode) -> bool:
        result = await self.session.execute(
            select(RoleAssignmentModel)
            .join(RoleModel)
            .where(
                and_(
                    RoleAssignmentModel.user_id == user_id,
                    RoleModel.code == role_code.value
                )
            )
        )
        return result.scalar_one_or_none() is not None
    
    def _role_to_entity(self, db_role: RoleModel) -> Role:
        return Role(
            id=db_role.id,
            code=RoleCode(db_role.code),
            name=db_role.name,
            description=db_role.description
        )
    
    def _assignment_to_entity(self, db_assignment: RoleAssignmentModel) -> RoleAssignment:
        return RoleAssignment(
            id=db_assignment.id,
            user_id=db_assignment.user_id,
            role_id=db_assignment.role_id,
            scope=db_assignment.scope,
            created_at=db_assignment.created_at
        )
