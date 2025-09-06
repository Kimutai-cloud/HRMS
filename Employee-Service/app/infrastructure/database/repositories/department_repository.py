from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.core.entities.department import Department
from app.core.entities.employee import Employee, EmploymentStatus
from app.core.interfaces.repositories import DepartmentRepositoryInterface
from app.infrastructure.database.models import DepartmentModel, EmployeeModel


class DepartmentRepository(DepartmentRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create(self, department: Department) -> Department:
        """Create a new department."""
        db_department = DepartmentModel(
            id=department.id,
            name=department.name,
            description=department.description,
            manager_id=department.manager_id,
            is_active=department.is_active,
            created_at=department.created_at,
            updated_at=department.updated_at,
            created_by=department.created_by
        )
        
        try:
            self.session.add(db_department)
            await self.session.commit()
            await self.session.refresh(db_department)
            return self._to_entity(db_department)
        except IntegrityError as e:
            await self.session.rollback()
            if "name" in str(e):
                raise ValueError("Department with this name already exists")
            raise
    
    async def get_by_id(self, department_id: UUID) -> Optional[Department]:
        """Get department by ID with manager relationship."""
        result = await self.session.execute(
            select(DepartmentModel)
            .options(selectinload(DepartmentModel.manager))
            .where(DepartmentModel.id == department_id)
        )
        db_department = result.scalar_one_or_none()
        return self._to_entity(db_department) if db_department else None
    
    async def get_by_name(self, name: str) -> Optional[Department]:
        """Get department by name."""
        result = await self.session.execute(
            select(DepartmentModel)
            .where(DepartmentModel.name == name.strip())
        )
        db_department = result.scalar_one_or_none()
        return self._to_entity(db_department) if db_department else None
    
    async def list_departments(self, include_inactive: bool = False) -> List[Department]:
        """List all departments."""
        query = select(DepartmentModel).options(selectinload(DepartmentModel.manager))
        
        if not include_inactive:
            query = query.where(DepartmentModel.is_active == True)
        
        query = query.order_by(DepartmentModel.name)
        
        result = await self.session.execute(query)
        db_departments = result.scalars().all()
        return [self._to_entity(dept) for dept in db_departments]
    
    async def update(self, department: Department) -> Department:
        """Update department."""
        result = await self.session.execute(
            select(DepartmentModel).where(DepartmentModel.id == department.id)
        )
        db_department = result.scalar_one_or_none()
        
        if not db_department:
            raise ValueError("Department not found")
        
        db_department.name = department.name
        db_department.description = department.description
        db_department.manager_id = department.manager_id
        db_department.is_active = department.is_active
        db_department.updated_at = department.updated_at
        
        try:
            await self.session.commit()
            await self.session.refresh(db_department)
            return self._to_entity(db_department)
        except IntegrityError as e:
            await self.session.rollback()
            if "name" in str(e):
                raise ValueError("Department with this name already exists")
            raise
    
    async def delete(self, department_id: UUID) -> bool:
        """Soft delete department by setting is_active to False."""
        result = await self.session.execute(
            select(DepartmentModel).where(DepartmentModel.id == department_id)
        )
        db_department = result.scalar_one_or_none()
        
        if db_department:
            db_department.is_active = False
            db_department.updated_at = datetime.now(timezone.utc)
            await self.session.commit()
            return True
        return False
    
    async def assign_manager(self, department_id: UUID, manager_id: UUID) -> bool:
        """Assign manager to department."""
        result = await self.session.execute(
            select(DepartmentModel).where(DepartmentModel.id == department_id)
        )
        db_department = result.scalar_one_or_none()
        
        if not db_department:
            return False
        
        # Verify the manager exists and is active
        manager_result = await self.session.execute(
            select(EmployeeModel)
            .where(and_(
                EmployeeModel.id == manager_id,
                EmployeeModel.employment_status == EmploymentStatus.ACTIVE.value
            ))
        )
        manager = manager_result.scalar_one_or_none()
        
        if not manager:
            raise ValueError("Manager not found or inactive")
        
        db_department.manager_id = manager_id
        db_department.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        return True
    
    async def remove_manager(self, department_id: UUID) -> bool:
        """Remove manager from department."""
        result = await self.session.execute(
            select(DepartmentModel).where(DepartmentModel.id == department_id)
        )
        db_department = result.scalar_one_or_none()
        
        if db_department:
            db_department.manager_id = None
            db_department.updated_at = datetime.now(timezone.utc)
            await self.session.commit()
            return True
        return False
    
    async def get_managed_departments(self, manager_id: UUID) -> List[Department]:
        """Get departments managed by a specific manager."""
        result = await self.session.execute(
            select(DepartmentModel)
            .options(selectinload(DepartmentModel.manager))
            .where(and_(
                DepartmentModel.manager_id == manager_id,
                DepartmentModel.is_active == True
            ))
            .order_by(DepartmentModel.name)
        )
        db_departments = result.scalars().all()
        return [self._to_entity(dept) for dept in db_departments]
    
    async def get_department_employees(self, department_id: UUID) -> List[Employee]:
        """Get all employees in a department."""
        result = await self.session.execute(
            select(EmployeeModel)
            .where(and_(
                EmployeeModel.department_id == department_id,
                EmployeeModel.employment_status == EmploymentStatus.ACTIVE.value
            ))
            .order_by(EmployeeModel.first_name, EmployeeModel.last_name)
        )
        db_employees = result.scalars().all()
        return [self._employee_to_entity(emp) for emp in db_employees]
    
    async def get_departments_with_stats(self) -> List[Dict[str, Any]]:
        """Get departments with employee count statistics."""
        result = await self.session.execute(
            select(
                DepartmentModel,
                func.count(EmployeeModel.id).label('employee_count')
            )
            .outerjoin(EmployeeModel, and_(
                DepartmentModel.id == EmployeeModel.department_id,
                EmployeeModel.employment_status == EmploymentStatus.ACTIVE.value
            ))
            .where(DepartmentModel.is_active == True)
            .group_by(DepartmentModel.id)
            .order_by(DepartmentModel.name)
        )
        
        departments_with_stats = []
        for db_department, employee_count in result:
            department = self._to_entity(db_department)
            departments_with_stats.append({
                'department': department,
                'employee_count': employee_count,
                'has_manager': department.manager_id is not None
            })
        
        return departments_with_stats
    
    def _to_entity(self, db_department: DepartmentModel) -> Department:
        """Convert database model to entity."""
        return Department(
            id=db_department.id,
            name=db_department.name,
            description=db_department.description,
            manager_id=db_department.manager_id,
            is_active=db_department.is_active,
            created_at=db_department.created_at,
            updated_at=db_department.updated_at,
            created_by=db_department.created_by
        )
    
    def _employee_to_entity(self, db_employee: EmployeeModel) -> Employee:
        """Convert employee database model to entity."""
        from app.core.entities.employee import EmploymentStatus, VerificationStatus
        
        return Employee(
            id=db_employee.id,
            user_id=db_employee.user_id,
            first_name=db_employee.first_name,
            last_name=db_employee.last_name,
            email=db_employee.email,
            phone=db_employee.phone,
            title=db_employee.title,
            department=db_employee.department,
            department_id=db_employee.department_id,
            manager_id=db_employee.manager_id,
            status=EmploymentStatus(db_employee.employment_status),
            employment_status=EmploymentStatus(db_employee.employment_status),
            verification_status=VerificationStatus(db_employee.verification_status),
            created_at=db_employee.created_at,
            updated_at=db_employee.updated_at,
            hired_at=db_employee.hired_at,
            deactivated_at=db_employee.deactivated_at,
            deactivation_reason=db_employee.deactivation_reason,
            version=getattr(db_employee, 'version', 1)
        )